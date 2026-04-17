/**
 * SSE streaming endpoint for the Cench Studio agent system.
 *
 * POST /api/agent
 * Accepts a JSON body with message, agent settings, and current world state.
 * Streams Server-Sent Events back to the client.
 *
 * Event format: `data: <JSON>\n\n`
 */

import { NextRequest } from 'next/server'
import crypto from 'crypto'
import type {
  AgentType,
  ModelId,
  ModelTier,
  ThinkingMode,
  SSEEvent,
  ChatMessage,
  MessageContent,
  Storyboard,
} from '@/lib/agents/types'
import { messageContentToText } from '@/lib/agents/types'
import type { Scene, GlobalStyle, APIPermissions, SceneGraph } from '@/lib/types'
import { runAgent } from '@/lib/agents/runner'
import { AgentLogger } from '@/lib/agents/logger'
import { createGenerationLog, updateGenerationLog } from '@/lib/db/queries/generation-logs'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { projectAssets as projectAssetsTable, projects as projectsTable } from '@/lib/db/schema'
import { readProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { readProjectScenesFromTables } from '@/lib/db/project-scene-table'
import { persistScenesFromAgentRun, getRunCheckpoint, clearRunCheckpoint } from '@/lib/db/queries/projects'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { getMemoriesForUser, upsertMemory } from '@/lib/db/queries/user-memory'
import { extractMemories } from '@/lib/agents/memory-extractor'
import { registerBuiltInHooks } from '@/lib/agents/built-in-hooks'
import { detectFrustration, computeRunMetrics, logRunAnalytics, serializeRunMetrics } from '@/lib/agents/run-analytics'
import { eq, desc } from 'drizzle-orm'

// Register built-in hooks once at module load
registerBuiltInHooks()

// Per-project mutex: prevents concurrent agent runs on the same project.
// In-memory is fine for single-server deployments; use Redis for multi-server.
const activeRuns = new Map<string, { startedAt: number }>()
const STALE_RUN_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes — multi-scene videos need time for sequential code generation

export interface AgentAPIRequest {
  message: MessageContent
  agentOverride?: AgentType
  modelOverride?: ModelId | null
  modelTier?: ModelTier
  thinkingMode?: ThinkingMode
  sceneContext?: 'all' | 'selected' | 'auto' | string
  activeTools?: string[]
  history?: ChatMessage[]
  projectId?: string
  conversationId?: string
  // World state from client
  scenes: Scene[]
  globalStyle: GlobalStyle
  projectName: string
  outputMode: 'mp4' | 'interactive'
  sceneGraph?: SceneGraph
  selectedSceneId?: string | null
  apiPermissions?: APIPermissions
  enabledModelIds?: string[]
  audioProviderEnabled?: Record<string, boolean>
  mediaGenEnabled?: Record<string, boolean>
  /** Master switch for web research tools — flipped by user via Research toggle in chat input. */
  researchEnabled?: boolean
  /** Per-provider enabled map for research providers (brave, tavily, exa). */
  researchProviderEnabled?: Record<string, boolean>
  /** Project IDs where the user has accepted the yt-dlp legal disclaimer. */
  ytDlpConsentedProjectIds?: string[]
  sessionPermissions?: Record<string, string>
  generationOverrides?: Record<string, { provider?: string; prompt?: string; config?: Record<string, any> }>
  autoChooseDefaults?: Record<string, { provider: string; config: Record<string, any> }>
  /** Approved storyboard from review UI — Director implements from turn 1 */
  initialStoryboard?: Storyboard | null
  /** Resume a previously-blocked tool call (e.g., after permission approval) */
  resumeToolCall?: { toolName: string; toolInput: Record<string, unknown> } | null
  /** User ID for cross-session memory */
  userId?: string
  /** Resume an interrupted run from its checkpoint */
  resumeCheckpoint?: boolean
  /** Director template variant (explainer, onboarding, product-demo) */
  directorTemplate?: string
  /** When true, agent plans first (calls plan_scenes then stops for review) */
  planFirstMode?: boolean
  /** Local mode flag — routes all calls through local LLM */
  localMode?: boolean
  /** Mock mode — use canned SSE stream, no API credits spent */
  mockMode?: boolean
  /** Model configs for resolving local model endpoints */
  modelConfigs?: import('@/lib/agents/model-config').ModelConfig[]
  /** MP4/export settings including aspect ratio */
  mp4Settings?: import('@/lib/types').MP4Settings
}

export async function POST(req: NextRequest) {
  let body: AgentAPIRequest

  try {
    body = await req.json()
  } catch {
    console.warn('[Agent API] Invalid JSON body received')
    return new Response('Invalid JSON body', { status: 400 })
  }

  const isValidMessage =
    (typeof body.message === 'string' && body.message.trim().length > 0) ||
    (Array.isArray(body.message) && body.message.length > 0)
  if (!isValidMessage) {
    console.warn('[Agent API] Missing required field: message')
    return new Response('Missing required field: message', { status: 400 })
  }

  if (!body.scenes || !Array.isArray(body.scenes)) {
    console.warn('[Agent API] Missing required field: scenes')
    return new Response('Missing required field: scenes', { status: 400 })
  }

  // ── Input size limits ──────────────────────────────────────────────────────
  const MAX_MESSAGE_LENGTH = 50_000
  const MAX_SCENES = 100
  const MAX_HISTORY = 200

  const msgTextForValidation = typeof body.message === 'string' ? body.message : JSON.stringify(body.message)
  if (msgTextForValidation.length > MAX_MESSAGE_LENGTH) {
    return new Response('Message too long', { status: 413 })
  }
  if (body.scenes.length > MAX_SCENES) {
    return new Response('Too many scenes', { status: 413 })
  }
  if (body.history && body.history.length > MAX_HISTORY) {
    return new Response('History too long', { status: 413 })
  }

  // Verify project ownership if projectId is provided
  // Also derive authenticated userId from session (never trust client-supplied userId)
  let authenticatedUserId: string | null = null
  if (body.projectId) {
    const access = await assertProjectAccess(body.projectId)
    if (access.error) return access.error
    authenticatedUserId = access.user?.id ?? null
  }

  // Server-side authoritative scene read — merge with client scenes to prevent
  // stripped code fields from corrupting agent context (Fix 4)
  let serverScenes: Scene[] = []
  if (body.projectId) {
    try {
      const { getFullProject } = await import('@/lib/db/queries/projects')
      const dbProject = await getFullProject(body.projectId)
      if (dbProject?.scenes) {
        serverScenes = dbProject.scenes as unknown as Scene[]
      }
    } catch (e) {
      console.warn(`[Agent API] Could not read server scenes: ${(e as Error).message}`)
    }
  }

  // Merge: prefer server's code fields when client's are empty/stripped
  if (serverScenes.length > 0) {
    const mergedScenes = body.scenes.map((clientScene: any) => {
      const serverScene = serverScenes.find((s: any) => s.id === clientScene.id)
      if (!serverScene) return clientScene
      return {
        ...clientScene,
        canvasCode: clientScene.canvasCode || (serverScene as any).canvasCode || '',
        sceneCode: clientScene.sceneCode || (serverScene as any).sceneCode || '',
        sceneHTML: clientScene.sceneHTML || (serverScene as any).sceneHTML || '',
        svgContent: clientScene.svgContent || (serverScene as any).svgContent || '',
        canvasBackgroundCode: clientScene.canvasBackgroundCode || (serverScene as any).canvasBackgroundCode || '',
        lottieSource: clientScene.lottieSource || (serverScene as any).lottieSource || '',
      }
    })
    // Add any server scenes not present in client
    for (const serverScene of serverScenes) {
      if (!mergedScenes.some((s: any) => s.id === (serverScene as any).id)) {
        mergedScenes.push(serverScene as any)
      }
    }
    body.scenes = mergedScenes
  }

  // ── Mock mode: return canned SSE stream without hitting any LLM API ──────
  // Activated via env var OR client-side toggle (body.mockMode)
  if (process.env.MOCK_AGENT === 'true' || body.mockMode === true) {
    return createMockAgentResponse(body)
  }

  // Abort controller — signals the runner to stop when the client disconnects
  const abortController = new AbortController()
  req.signal.addEventListener('abort', () => {
    console.log('[Agent API] Client disconnected, aborting runner')
    abortController.abort()
  })

  // Create SSE stream
  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController<Uint8Array>
  let streamClosed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
    },
    cancel() {
      streamClosed = true
      abortController.abort()
    },
  })

  function sendEvent(event: SSEEvent) {
    if (streamClosed) {
      console.warn('[Agent API] Attempted to send after stream closed', event.type)
      return
    }
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`
      streamController.enqueue(encoder.encode(data))
    } catch (e) {
      streamClosed = true
      console.error('[Agent API] Stream write failed:', (e as Error).message)
      // Signal the runner to stop — no point continuing if we can't send results
      abortController.abort()
    }
  }

  // SSE keepalive heartbeat — prevents proxies (Cloudflare, Vercel, nginx)
  // from closing the connection during long tool executions
  const heartbeatInterval = setInterval(() => {
    sendEvent({ type: 'heartbeat' })
  }, 20_000)

  // Extract text portion of message for logging (images are not logged)
  const messageText = messageContentToText(body.message)

  // Create structured logger for this run
  const logger = new AgentLogger()
  // Detect frustration signals in user message (for analytics, not filtering)
  const frustration = detectFrustration(messageText)

  logger.log('api', 'Request received', {
    agent: body.agentOverride ?? 'auto',
    model: body.modelOverride ?? 'auto',
    sceneCount: body.scenes.length,
    messageLength: messageText.length,
    hasImages: typeof body.message !== 'string',
    ...(frustration.detected ? { frustration: frustration.level, frustrationTriggers: frustration.triggers } : {}),
  })

  // Emit run_start as the first SSE event so client can correlate logs
  sendEvent({ type: 'run_start', runId: logger.runId })

  // Create generation log before starting
  const genStartTime = Date.now()
  let generationLogId: string | null = null
  let thinkingContentBuffer = ''

  try {
    generationLogId = await createGenerationLog({
      projectId: body.projectId,
      userPrompt: messageText,
      systemPromptHash: crypto
        .createHash('sha256')
        .update(messageText + (body.globalStyle?.presetId ?? ''))
        .digest('hex')
        .slice(0, 16),
      stylePresetId: body.globalStyle?.presetId ?? undefined,
      agentType: body.agentOverride,
      modelUsed: body.modelOverride ?? undefined,
      thinkingMode: body.thinkingMode ?? 'adaptive',
    })
  } catch (e) {
    console.error('[Agent API] Failed to create generation log:', e)
    // Warn client that usage tracking is unavailable for this run
    sendEvent({ type: 'warning', message: 'Usage tracking unavailable for this run.' } as any)
  }

  // Wrap emit to capture thinking content for the log
  const originalSendEvent = sendEvent
  const wrappedSendEvent = (event: SSEEvent) => {
    if (event.type === 'thinking_token' && event.token) {
      thinkingContentBuffer += event.token
    }
    originalSendEvent(event)
  }

  // Fetch project assets + brand kit + workspace id + user memories in parallel.
  // Project row pulls brandKit + workspaceId in one round-trip since both live
  // on the same row.
  const [assetsResult, projectRowResult, memoriesResult] = await Promise.all([
    body.projectId
      ? db
          .select()
          .from(projectAssetsTable)
          .where(eq(projectAssetsTable.projectId, body.projectId))
          .orderBy(desc(projectAssetsTable.createdAt))
          .catch((e) => {
            console.warn('[Agent API] Failed to fetch project assets:', e)
            return [] as any[]
          })
      : Promise.resolve([] as any[]),
    body.projectId
      ? db
          .select({ brandKit: projectsTable.brandKit, workspaceId: projectsTable.workspaceId })
          .from(projectsTable)
          .where(eq(projectsTable.id, body.projectId))
          .limit(1)
          .catch((e) => {
            console.warn('[Agent API] Failed to fetch project row:', e)
            return [] as Array<{ brandKit: unknown; workspaceId: string | null }>
          })
      : Promise.resolve([] as Array<{ brandKit: unknown; workspaceId: string | null }>),
    authenticatedUserId
      ? getMemoriesForUser(authenticatedUserId, 20).catch((e) => {
          console.warn('[Agent API] Failed to fetch user memories:', e)
          return [] as Awaited<ReturnType<typeof getMemoriesForUser>>
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof getMemoriesForUser>>),
  ])

  const fetchedAssets: any[] = assetsResult
  const fetchedBrandKit = (projectRowResult[0]?.brandKit as any) ?? null
  const runWorkspaceId: string | null = projectRowResult[0]?.workspaceId ?? null
  const userMemories = memoriesResult.map((r) => ({
    category: r.category,
    key: r.key,
    value: r.value,
    confidence: r.confidence,
  }))
  if (userMemories.length > 0) {
    logger.log('api', `Loaded ${userMemories.length} user memories`, { userId: authenticatedUserId })
  }

  // Rule fetch depends on the workspace id resolved above.
  let permissionRules: import('@/lib/types/permissions').PermissionRule[] = []
  if (authenticatedUserId) {
    try {
      const { findMatchingRules } = await import('@/lib/db/queries/permission-rules')
      permissionRules = await findMatchingRules({
        userId: authenticatedUserId,
        workspaceId: runWorkspaceId,
        projectId: body.projectId ?? null,
        conversationId: body.conversationId ?? null,
      })
      if (permissionRules.length > 0) {
        logger.log('api', `Loaded ${permissionRules.length} permission rules`, { userId: authenticatedUserId })
      }
    } catch (e) {
      console.warn('[Agent API] Failed to fetch permission rules:', e)
    }
  }

  // Handle checkpoint resume — override message, scenes, and storyboard from saved state
  let resumedCheckpoint: import('@/lib/agents/types').RunCheckpoint | null = null
  if (body.resumeCheckpoint && body.projectId) {
    try {
      resumedCheckpoint = await getRunCheckpoint(body.projectId)
      if (resumedCheckpoint) {
        const built = resumedCheckpoint.completedSceneIds.length
        const total = resumedCheckpoint.storyboard?.scenes.length ?? 0
        const remaining = total - built
        logger.log('api', `Resuming checkpoint: ${built}/${total} scenes complete, ${remaining} remaining`, {
          runId: resumedCheckpoint.runId,
          reason: resumedCheckpoint.reason,
        })
      } else {
        logger.warn('api', 'resumeCheckpoint requested but no checkpoint found')
      }
    } catch (e) {
      console.warn('[Agent API] Failed to fetch run checkpoint:', e)
      sendEvent({ type: 'warning', message: 'Failed to load checkpoint — starting fresh' })
    }
  }

  // Build effective message and state (checkpoint merges with current state if resuming)
  const effectiveMessage = resumedCheckpoint
    ? (() => {
        const resumeCtx = `Continue building the video. ${resumedCheckpoint.completedSceneIds.length} of ${resumedCheckpoint.storyboard?.scenes.length ?? '?'} scenes are already built. Build the remaining scenes following the storyboard.`
        const userMsg = typeof body.message === 'string' ? body.message.trim() : ''
        return userMsg && userMsg !== 'Resume interrupted build' ? `${userMsg}\n\n${resumeCtx}` : resumeCtx
      })()
    : body.message

  // Merge checkpoint scenes with current client scenes:
  // - Keep user-edited scenes (scenes in client but not in checkpoint, or modified since checkpoint)
  // - Use checkpoint scenes for those the agent was building
  const effectiveScenes = (() => {
    if (!resumedCheckpoint) return body.scenes
    const checkpointScenes = resumedCheckpoint.worldSnapshot.scenes ?? []
    const clientScenes: any[] = body.scenes ?? []
    if (clientScenes.length === 0) return checkpointScenes
    const checkpointMap = new Map(checkpointScenes.map((s: any) => [s.id, s]))
    const clientMap = new Map(clientScenes.map((s: any) => [s.id, s]))
    const merged: any[] = []
    // Start with client scenes — preserve user edits
    for (const cs of clientScenes) {
      const cpScene = checkpointMap.get(cs.id)
      if (!cpScene) {
        // Scene only in client (user added it while agent was paused) — keep it
        merged.push(cs)
      } else if (resumedCheckpoint.completedSceneIds.includes(cs.id)) {
        // Scene was completed by agent — use checkpoint version (has generated content),
        // UNLESS the user edited the scene after the checkpoint was saved
        const clientNewer = cs.updatedAt && cpScene.updatedAt && cs.updatedAt > cpScene.updatedAt
        merged.push(clientNewer ? cs : cpScene)
      } else {
        // Scene exists in both but wasn't completed — prefer client version (user may have edited)
        merged.push(cs)
      }
    }
    // Add any checkpoint-only scenes (agent created them before pause)
    for (const cpScene of checkpointScenes) {
      if (!clientMap.has(cpScene.id)) {
        merged.push(cpScene)
      }
    }
    return merged
  })()
  const effectiveGlobalStyle = resumedCheckpoint ? resumedCheckpoint.worldSnapshot.globalStyle : body.globalStyle
  const effectiveStoryboard = resumedCheckpoint?.storyboard ?? body.initialStoryboard ?? null

  // When building from an approved storyboard, pre-approve session permissions
  // for APIs that the storyboard's feature flags will need. This avoids
  // interrupting the agent run with permission dialogs for each API separately.
  if (effectiveStoryboard?.featureFlags) {
    const sp = body.sessionPermissions ?? {}
    const flags = effectiveStoryboard.featureFlags
    if (flags.narration && !sp['elevenLabs']) sp['elevenLabs'] = 'allow'
    if (flags.music && !sp['elevenLabs']) sp['elevenLabs'] = 'allow'
    body.sessionPermissions = sp
  }

  // Log local mode info
  if (body.localMode) {
    const localModelCount = body.modelConfigs?.length ?? 0
    logger.log('api', `Local mode enabled: modelOverride=${body.modelOverride}, ${localModelCount} local model configs`)
  }

  // Reject concurrent runs on the same project
  if (body.projectId) {
    const existing = activeRuns.get(body.projectId)
    if (existing && Date.now() - existing.startedAt < STALE_RUN_TIMEOUT_MS) {
      return new Response(JSON.stringify({ error: 'Agent run already in progress for this project' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Clean up stale entry if any, then register this run
    activeRuns.set(body.projectId, { startedAt: Date.now() })
  }

  // Run agent asynchronously
  runAgent({
    message: effectiveMessage,
    agentOverride: resumedCheckpoint ? resumedCheckpoint.agentType : body.agentOverride,
    modelOverride: body.modelOverride,
    modelTier: body.modelTier,
    thinkingMode: body.thinkingMode ?? 'adaptive',
    sceneContext: body.sceneContext,
    activeTools: body.activeTools,
    history: resumedCheckpoint ? [] : body.history, // fresh history on resume
    projectId: body.projectId,
    scenes: effectiveScenes,
    globalStyle: effectiveGlobalStyle ?? {
      palette: ['#181818', '#121212', '#e84545', '#151515', '#f0ece0'],
      strokeWidth: 2,
      font: 'Caveat',
      duration: 8,
      theme: 'dark',
    },
    projectName: body.projectName ?? 'Untitled Project',
    outputMode: body.outputMode ?? 'mp4',
    sceneGraph: body.sceneGraph,
    selectedSceneId: body.selectedSceneId,
    apiPermissions: body.apiPermissions,
    enabledModelIds: body.enabledModelIds,
    audioProviderEnabled: body.audioProviderEnabled,
    mediaGenEnabled: body.mediaGenEnabled,
    researchEnabled: body.researchEnabled,
    researchProviderEnabled: body.researchProviderEnabled,
    ytDlpConsentedProjectIds: body.ytDlpConsentedProjectIds,
    sessionPermissions: body.sessionPermissions,
    permissionRules,
    workspaceId: runWorkspaceId,
    conversationId: body.conversationId ?? null,
    generationOverrides: body.generationOverrides,
    autoChooseDefaults: body.autoChooseDefaults,
    projectAssets: fetchedAssets,
    initialStoryboard: effectiveStoryboard,
    resumeToolCall: body.resumeToolCall ?? null,
    abortSignal: abortController.signal,
    logger,
    emit: wrappedSendEvent,
    userMemories: userMemories.length > 0 ? userMemories : undefined,
    userId: authenticatedUserId ?? undefined,
    modelConfigs: body.modelConfigs,
    planFirstMode: body.planFirstMode,
    directorTemplate: body.directorTemplate,
    mp4Settings: body.mp4Settings,
    brandKit: fetchedBrandKit,
  })
    .then(async (result) => {
      logger.log('api', 'Runner complete', {
        agentType: result.agentType,
        modelId: result.modelId,
        toolCalls: result.toolCalls.length,
        durationMs: result.usage.totalDurationMs,
      })
      // Persist scenes first so the client can refetch after SSE drops (timeouts / disconnects).
      // Filter out scenes with placeholder content (lightScenes strips content for non-focused scenes).
      // Placeholder strings like "[123 chars]" must NOT be persisted to DB.
      const isPlaceholder = (v: string | undefined | null) => !!v && /^\[\d+ chars\]$/.test(v)
      const cleanScenesForPersistence = result.updatedScenes.map((s: any) => {
        if (
          isPlaceholder(s.svgContent) ||
          isPlaceholder(s.canvasCode) ||
          isPlaceholder(s.sceneCode) ||
          isPlaceholder(s.lottieSource)
        ) {
          // Find the original scene from the request to get the original (stripped) state.
          // Since we don't have the real content server-side, skip writing content fields for this scene
          // by setting them to empty — the DB already has the real content.
          const orig = body.scenes.find((os: any) => os.id === s.id)
          return {
            ...s,
            svgContent: orig?.svgContent && !isPlaceholder(orig.svgContent) ? s.svgContent : undefined,
            canvasCode: orig?.canvasCode && !isPlaceholder(orig.canvasCode) ? s.canvasCode : undefined,
            sceneCode: orig?.sceneCode && !isPlaceholder(orig.sceneCode) ? s.sceneCode : undefined,
            lottieSource: orig?.lottieSource && !isPlaceholder(orig.lottieSource) ? s.lottieSource : undefined,
            sceneHTML: undefined, // will be regenerated from real content
          }
        }
        return s
      })

      if (body.projectId) {
        let persistOk = false
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            persistOk = await persistScenesFromAgentRun(body.projectId, {
              scenes: cleanScenesForPersistence,
              sceneGraph: result.updatedSceneGraph,
              globalStyle: result.updatedGlobalStyle,
              storyboard: result.updatedStoryboard,
              zdogLibrary: result.updatedZdogLibrary,
              zdogStudioLibrary: result.updatedZdogStudioLibrary,
            })
            if (persistOk) break
            // No-op return (conflict) — wait and retry
            if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)))
          } catch (e) {
            logger.error('api', `persistScenesFromAgentRun threw (attempt ${attempt + 1}): ${(e as Error).message}`)
            if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)))
          }
        }
        if (!persistOk) {
          logger.error(
            'api',
            'persistScenesFromAgentRun failed after 3 attempts — agent work may not be persisted to DB',
          )
          sendEvent({
            type: 'warning',
            message: 'Your changes were applied but could not be saved to the database. Please save manually.',
          } as any)
        } else {
          logger.log('api', 'Agent run persisted to DB successfully')
        }
      }
      // Clear checkpoint after successful completion (if we were resuming)
      if (resumedCheckpoint && body.projectId) {
        try {
          await clearRunCheckpoint(body.projectId)
          logger.log('api', 'Cleared run checkpoint after successful resume')
        } catch (e) {
          console.warn('[Agent API] Failed to clear run checkpoint:', e)
        }
      }

      // Extract and persist user memories (fire-and-forget)
      if (authenticatedUserId && result.toolCalls.length > 0) {
        try {
          const memories = extractMemories(result.agentType, result.toolCalls, result.updatedGlobalStyle)
          for (const mem of memories) {
            await upsertMemory(authenticatedUserId, mem.category, mem.key, mem.value, mem.confidence, logger.runId)
          }
          if (memories.length > 0) {
            logger.log('api', `Extracted ${memories.length} memories`, { memories: memories.map((m) => m.key) })
          }
        } catch (e) {
          console.warn('[Agent API] Failed to extract/persist memories:', e)
        }
      }

      // Compute run analytics metrics
      // Derive scene counts from tool calls since runner doesn't return them directly
      const scenesCreated = result.toolCalls.filter(
        (tc: any) => tc.toolName === 'create_scene' && tc.output?.success !== false,
      ).length
      const scenesVerified = result.toolCalls.filter(
        (tc: any) => tc.toolName === 'verify_scene' && tc.output?.success !== false,
      ).length
      const planCall = result.toolCalls.find((tc: any) => tc.toolName === 'plan_scenes' && tc.output?.success !== false)
      const scenesPlanned = (planCall?.input as any)?.scenes?.length ?? 0

      const runMetrics = computeRunMetrics({
        toolCalls: result.toolCalls,
        usage: result.usage,
        durationMs: Date.now() - genStartTime,
        iterationsUsed: result.toolCalls.length, // approximation: 1 tool call ≈ 1 iteration
        iterationsMax: 15,
        scenesPlanned,
        scenesCreated,
        scenesVerified,
        userMessage: messageText,
        wasAborted: false,
        wasPermissionBlocked: false,
      })
      logRunAnalytics(logger, runMetrics)

      // Update generation log with results + trace + analytics
      if (generationLogId) {
        try {
          await updateGenerationLog(generationLogId, {
            agentType: result.agentType,
            modelUsed: result.modelId,
            generationTimeMs: Date.now() - genStartTime,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            costUsd: result.usage.costUsd,
            thinkingContent: thinkingContentBuffer.slice(0, 2000),
            generatedCodeLength: result.fullText.length,
            runId: logger.runId,
            runTrace: result.logger.getTrace(),
            analysisNotes: serializeRunMetrics(runMetrics),
          })
        } catch (e) {
          console.error('[Agent API] Failed to update generation log:', e)
        }
      }

      // The 'done' event is already emitted inside runAgent.
      // Send the final updated state + generationLogId as a state_change event.
      // Use cleanScenesForPersistence to avoid sending placeholder content to the client.
      logger.log(
        'api',
        `Sending state_change: ${cleanScenesForPersistence.length} scenes, hasGlobalStyle=${!!result.updatedGlobalStyle}`,
      )
      for (const s of cleanScenesForPersistence) {
        const sc = s as any
        logger.log(
          'api',
          `  scene ${sc.id?.slice(0, 8)}… type=${sc.sceneType} react=${sc.reactCode?.length ?? 0} html=${sc.sceneHTML?.length ?? 0}`,
        )
      }
      sendEvent({
        type: 'state_change',
        changes: [
          {
            type: 'global_updated',
            description: '__final_state__',
          },
        ],
        updatedScenes: cleanScenesForPersistence,
        updatedGlobalStyle: result.updatedGlobalStyle,
        updatedSceneGraph: result.updatedSceneGraph,
        generationLogId: generationLogId ?? undefined,
        // Recording state from agent tools
        recordingCommand: result.recordingCommand,
        recordingCommandNonce: result.recordingCommandNonce,
        recordingConfig: result.recordingConfig,
        recordingAttachSceneId: result.recordingAttachSceneId,
      } as any)
    })
    .catch(async (error) => {
      logger.error('api', `Runner error: ${error?.message ?? 'Unknown error'}`, { stack: error?.stack })
      if (!error?._agentHandled) {
        sendEvent({ type: 'error', error: `Agent error: ${error?.message ?? 'Unknown error'}` })
      }
      // Update generation log with partial data + trace so failed runs are tracked
      if (generationLogId) {
        try {
          await updateGenerationLog(generationLogId, {
            generationTimeMs: Date.now() - genStartTime,
            thinkingContent: thinkingContentBuffer.slice(0, 2000) || undefined,
            analysisNotes: `Error: ${error?.message ?? 'Unknown error'}`,
            runId: logger.runId,
            runTrace: logger.getTrace(),
          })
        } catch (e) {
          console.error('[Agent API] Failed to update generation log on error:', e)
        }
      }
    })
    .finally(() => {
      // Release per-project mutex
      if (body.projectId) {
        activeRuns.delete(body.projectId)
      }
      clearInterval(heartbeatInterval)
      logger.log('api', 'Stream closing')
      try {
        streamController.close()
      } catch {
        // Already closed
      }
    })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ── Mock agent response for UI testing without API credits ─────────────────
//
// Keyword triggers in user message select scenario:
//   "storyboard"  → storyboard proposal + review card
//   "permission"  → tool blocked by permission (GenerationConfirmCard)
//   "error"       → error mid-stream
//   "multi"       → multi-iteration with several tool calls
//   (default)     → standard thinking → text → tool → done flow
//
// All scenarios exercise SSE parsing, streaming UI, and state management
// without touching any LLM or third-party API.

function createMockAgentResponse(body: AgentAPIRequest) {
  const encoder = new TextEncoder()
  const runId = crypto.randomUUID()
  const messageText = (typeof body.message === 'string' ? body.message : 'mock message').toLowerCase()
  const mockSceneId = body.scenes[0]?.id ?? 'mock-scene-1'

  // Pick scenario based on keywords in user message
  const scenario = messageText.includes('storyboard')
    ? 'storyboard'
    : messageText.includes('permission')
      ? 'permission'
      : messageText.includes('error')
        ? 'error'
        : messageText.includes('multi')
          ? 'multi'
          : 'default'

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
      const streamWords = async (text: string, ms = 45) => {
        for (const word of text.split(' ')) {
          send({ type: 'token', token: word + ' ' })
          await delay(ms)
        }
      }

      // ── Common preamble ──────────────────────────────────────────────
      send({ type: 'run_start', runId })
      await delay(80)

      send({
        type: 'agent_routed',
        agentType: 'director' as AgentType,
        routeMethod: 'heuristic',
        toolCount: 8,
      })
      await delay(150)

      // Thinking block (shared by all scenarios)
      send({ type: 'thinking_start' })
      const thinkingChunks = [
        'Let me analyze the request. ',
        `The user said "${messageText.slice(0, 50)}". `,
        "I'll determine the best approach ",
        'and generate the appropriate output.',
      ]
      for (const chunk of thinkingChunks) {
        send({ type: 'thinking_token', token: chunk })
        await delay(35)
      }
      send({ type: 'thinking_complete', fullThinking: thinkingChunks.join('') })
      await delay(120)

      // ── Scenario: STORYBOARD ─────────────────────────────────────────
      if (scenario === 'storyboard') {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("Great, I'll plan out a multi-scene video for you. Let me create a storyboard first.")
        await delay(200)

        // plan_scenes tool call
        send({
          type: 'tool_start',
          toolName: 'plan_scenes',
          toolInput: { prompt: messageText.slice(0, 100), targetScenes: 3 },
        })
        await delay(600)

        const mockStoryboard = {
          title: 'How Neural Networks Learn',
          scenes: [
            {
              name: 'Introduction',
              purpose: 'Hook the viewer with a compelling question',
              sceneType: 'motion',
              duration: 5,
              narrationDraft: 'Have you ever wondered how AI learns to recognize a cat?',
              visualElements: 'Animated question mark morphing into a brain icon',
            },
            {
              name: 'Forward Pass',
              purpose: 'Show data flowing through layers',
              sceneType: 'motion',
              duration: 8,
              narrationDraft: 'Data flows through layers of neurons, each one transforming the input.',
              visualElements: 'Animated network diagram with glowing data particles',
            },
            {
              name: 'Backpropagation',
              purpose: 'Explain how the network adjusts',
              sceneType: 'canvas2d',
              duration: 10,
              narrationDraft: 'The network compares its guess to the answer and adjusts its weights.',
              visualElements: 'Hand-drawn arrows flowing backwards through the network',
            },
          ],
          totalDuration: 23,
          styleNotes: 'Clean whiteboard style with blue accent colors',
          featureFlags: { narration: true, music: true, sfx: false, interactions: false },
        }

        send({
          type: 'tool_complete',
          toolName: 'plan_scenes',
          toolResult: {
            success: true,
            data: { storyboard: mockStoryboard },
          },
        })
        await delay(100)

        // Also send storyboard_proposed event (some code paths listen to this)
        send({ type: 'storyboard_proposed', storyboard: mockStoryboard as any })
        await delay(200)

        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)
        await streamWords(
          "I've created a 3-scene storyboard above. Review it and click Approve to start building, or edit the scenes first.",
        )

        const fullText =
          "Great, I'll plan out a multi-scene video for you. Let me create a storyboard first. I've created a 3-scene storyboard above. Review it and click Approve to start building, or edit the scenes first."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'plan_scenes',
              input: { prompt: messageText.slice(0, 100), targetScenes: 3 },
              output: { success: true, data: { storyboard: mockStoryboard } },
              durationMs: 600,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 4000 },
        })

        // ── Scenario: PERMISSION ─────────────────────────────────────────
      } else if (scenario === 'permission') {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("I'll add narration to your scene. Let me generate the voiceover.")
        await delay(200)

        // Tool starts then gets blocked by permission
        send({
          type: 'tool_start',
          toolName: 'generate_narration',
          toolInput: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
        })
        await delay(500)

        send({
          type: 'tool_complete',
          toolName: 'generate_narration',
          toolInput: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
          toolResult: {
            success: false,
            error: 'Permission required',
            permissionNeeded: {
              api: 'elevenLabs',
              estimatedCost: '$0.03',
              reason: 'Text-to-speech generation requires ElevenLabs API access',
              generationType: 'tts' as any,
              prompt: 'Welcome to this animated explainer.',
              provider: 'elevenlabs',
              availableProviders: [
                { id: 'elevenlabs', name: 'ElevenLabs', cost: '$0.03/request', isFree: false },
                { id: 'googleTts', name: 'Google TTS', cost: 'Free', isFree: true },
                { id: 'openaiTts', name: 'OpenAI TTS', cost: '$0.015/request', isFree: false },
              ],
              config: { voice: 'alloy', model: 'eleven_multilingual_v2' },
              toolArgs: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
            },
          },
        })
        await delay(200)

        await streamWords(
          'I need your permission to use the text-to-speech API. Please approve or choose a provider above.',
        )

        const fullText =
          "I'll add narration to your scene. Let me generate the voiceover. I need your permission to use the text-to-speech API. Please approve or choose a provider above."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_narration',
              input: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
              output: { success: false, error: 'Permission required' },
              durationMs: 500,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 3000 },
        })

        // ── Scenario: ERROR ──────────────────────────────────────────────
      } else if (scenario === 'error') {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords('Let me generate that scene for you.')
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: mockSceneId, prompt: 'test scene', sceneType: 'motion' },
        })
        await delay(400)

        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: false,
            error: 'Scene generation failed: template rendering error — invalid animation keyframe at offset 240',
          },
        })
        await delay(150)

        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)
        await streamWords("The scene generation hit an error. I'll try a different approach with simpler keyframes.")
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: mockSceneId, prompt: 'test scene (simplified)', sceneType: 'motion' },
        })
        await delay(600)

        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: mockSceneId,
            changes: [
              { type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Generated simplified animation' },
            ],
          },
        })
        await delay(100)

        send({
          type: 'state_change',
          changes: [{ type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Scene updated after retry' }],
        })
        await delay(100)

        send({ type: 'preview_update', sceneId: mockSceneId })
        await delay(100)

        send({ type: 'iteration_start', iteration: 3, maxIterations: 10 })
        await delay(80)
        await streamWords('Fixed! I simplified the animation keyframes and the scene rendered successfully.')

        const fullText =
          "Let me generate that scene for you. The scene generation hit an error. I'll try a different approach with simpler keyframes. Fixed! I simplified the animation keyframes and the scene rendered successfully."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: mockSceneId, prompt: 'test scene', sceneType: 'motion' },
              output: { success: false, error: 'template rendering error' },
              durationMs: 400,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: mockSceneId, prompt: 'test scene (simplified)', sceneType: 'motion' },
              output: { success: true, affectedSceneId: mockSceneId },
              durationMs: 600,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 5000 },
        })

        // ── Scenario: MULTI (many iterations + tools) ────────────────────
      } else if (scenario === 'multi') {
        const sceneIds = body.scenes.map((s) => s.id)
        if (sceneIds.length < 2) sceneIds.push('mock-scene-2', 'mock-scene-3')

        // Sub-agent start events
        send({
          type: 'sub_agent_start',
          subAgentId: 'sub-1',
          subAgentSceneIndex: 0,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Intro Scene',
        })
        await delay(100)

        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("I'll build all your scenes. Starting with the intro.")
        await delay(200)

        // First scene generation
        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: sceneIds[0], prompt: 'intro animation', sceneType: 'motion' },
        })
        await delay(700)
        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: sceneIds[0],
            changes: [{ type: 'scene_updated' as const, sceneId: sceneIds[0], description: 'Generated intro scene' }],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [{ type: 'scene_updated' as const, sceneId: sceneIds[0], description: 'Intro scene created' }],
        })
        send({ type: 'preview_update', sceneId: sceneIds[0] })
        await delay(100)

        send({
          type: 'sub_agent_complete',
          subAgentId: 'sub-1',
          subAgentSceneIndex: 0,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Intro Scene',
          subAgentSuccess: true,
        })
        await delay(100)

        // Second scene
        send({
          type: 'sub_agent_start',
          subAgentId: 'sub-2',
          subAgentSceneIndex: 1,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Main Content',
        })
        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)

        await streamWords('Intro done. Now building the main content scene.')
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: sceneIds[1], prompt: 'main content with charts', sceneType: 'd3' },
        })
        await delay(900)
        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: sceneIds[1],
            changes: [
              { type: 'scene_updated' as const, sceneId: sceneIds[1], description: 'Generated D3 data visualization' },
            ],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [
            { type: 'scene_updated' as const, sceneId: sceneIds[1], description: 'Main content scene created' },
          ],
        })
        send({ type: 'preview_update', sceneId: sceneIds[1] })
        await delay(100)

        send({
          type: 'sub_agent_complete',
          subAgentId: 'sub-2',
          subAgentSceneIndex: 1,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Main Content',
          subAgentSuccess: true,
        })
        await delay(100)

        // Third scene — update global style too
        send({ type: 'iteration_start', iteration: 3, maxIterations: 10 })
        await delay(80)

        send({
          type: 'tool_start',
          toolName: 'update_style',
          toolInput: { preset: 'whiteboard', palette: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'] },
        })
        await delay(300)
        send({
          type: 'tool_complete',
          toolName: 'update_style',
          toolResult: {
            success: true,
            changes: [{ type: 'global_updated' as const, description: 'Applied whiteboard style preset' }],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [{ type: 'global_updated' as const, description: 'Style preset updated to whiteboard' }],
        })
        await delay(100)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: sceneIds[2] ?? 'mock-scene-3', prompt: 'closing scene', sceneType: 'motion' },
        })
        await delay(600)
        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: sceneIds[2] ?? 'mock-scene-3',
            changes: [
              {
                type: 'scene_created' as const,
                sceneId: sceneIds[2] ?? 'mock-scene-3',
                description: 'Created closing scene',
              },
            ],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [
            {
              type: 'scene_created' as const,
              sceneId: sceneIds[2] ?? 'mock-scene-3',
              description: 'Closing scene added',
            },
          ],
        })
        send({ type: 'preview_update', sceneId: sceneIds[2] ?? 'mock-scene-3' })
        await delay(100)

        // Final iteration with summary
        send({ type: 'iteration_start', iteration: 4, maxIterations: 10 })
        await delay(80)
        await streamWords(
          "All 3 scenes are ready! I've built an intro with Motion, a D3 data chart for the main content, and a closing animation. The whiteboard style has been applied across the project.",
        )

        const fullText =
          "I'll build all your scenes. Starting with the intro. Intro done. Now building the main content scene. All 3 scenes are ready!"
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: sceneIds[0] },
              output: { success: true, affectedSceneId: sceneIds[0] },
              durationMs: 700,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: sceneIds[1] },
              output: { success: true, affectedSceneId: sceneIds[1] },
              durationMs: 900,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'update_style',
              input: { preset: 'whiteboard' },
              output: { success: true },
              durationMs: 300,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: sceneIds[2] ?? 'mock-scene-3' },
              output: { success: true },
              durationMs: 600,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 8000 },
        })

        // ── Scenario: DEFAULT ────────────────────────────────────────────
      } else {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("I'll create an animated explainer scene for you. Let me generate the code now.")
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: mockSceneId, prompt: messageText.slice(0, 100), sceneType: 'motion' },
        })
        await delay(800)

        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: mockSceneId,
            changes: [
              { type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Generated animation code' },
            ],
          },
        })
        await delay(100)

        send({
          type: 'state_change',
          changes: [
            {
              type: 'scene_updated' as const,
              sceneId: mockSceneId,
              description: 'Scene code updated with new animation',
            },
          ],
        })
        send({ type: 'preview_update', sceneId: mockSceneId })
        await delay(200)

        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)

        await streamWords(
          "Here's your animation! The scene features smooth transitions with the Motion renderer. You can preview it in the player above, or tweak it by sending another message.",
        )

        const fullText =
          "I'll create an animated explainer scene for you. Let me generate the code now. Here's your animation! The scene features smooth transitions with the Motion renderer."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: mockSceneId, prompt: messageText.slice(0, 100), sceneType: 'motion' },
              output: {
                success: true,
                affectedSceneId: mockSceneId,
                changes: [
                  { type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Generated animation code' },
                ],
              },
              durationMs: 800,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 3000 },
        })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

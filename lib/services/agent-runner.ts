/**
 * Agent runner service — transport-agnostic orchestration extracted from
 * `app/api/agent/route.ts` POST handler.
 *
 * Callers:
 *   - HTTP route (thin wrapper): enqueues JSON-encoded `data: ...\n\n` frames
 *     into a ReadableStream and returns it as text/event-stream.
 *   - Electron IPC handler (future): forwards each event to
 *     `webContents.send('cench:agent.event', runId, event)`.
 *
 * The service takes `emit(event)` as a callback — it does not know about HTTP,
 * SSE framing, or webContents. It DOES still emit `run_start` / `warning` /
 * `state_change` events inline, matching the original route's behavior exactly.
 *
 * Preconditions (caller's responsibility):
 *   - body already validated (message present, scenes array, size limits).
 *   - `authenticatedUserId` already resolved (or null for guest mode).
 *   - `abortSignal` wired to whatever cancellation the transport exposes
 *     (HTTP: req.signal; IPC: cench:agent.abort handler).
 *
 * Postconditions:
 *   - Every event the runner needed to communicate has been passed to `emit`.
 *   - All side effects (generation log, scene persistence, memory extraction)
 *     have completed. The returned promise resolves on success, rejects on
 *     fatal error. Non-fatal errors are emitted via `emit({ type: 'error' })`
 *     and the promise still resolves.
 */

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
import { projectAssets as projectAssetsTable, projects as projectsTable } from '@/lib/db/schema'
import { persistScenesFromAgentRun, getRunCheckpoint, clearRunCheckpoint } from '@/lib/db/queries/projects'
import { getMemoriesForUser, upsertMemory } from '@/lib/db/queries/user-memory'
import { extractMemories } from '@/lib/agents/memory-extractor'
import { registerBuiltInHooks } from '@/lib/agents/built-in-hooks'
import { detectFrustration, computeRunMetrics, logRunAnalytics, serializeRunMetrics } from '@/lib/agents/run-analytics'
import { eq, desc } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const log = createLogger('agent.runner')

// Ensure built-in hooks register once at module load. Moved here from the
// route so IPC callers pick them up too.
registerBuiltInHooks()

// Per-project mutex: prevents concurrent agent runs on the same project.
// In-memory is fine for single-user Electron; use Redis for multi-server.
const activeRuns = new Map<string, { startedAt: number }>()
const STALE_RUN_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

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
  researchEnabled?: boolean
  researchProviderEnabled?: Record<string, boolean>
  ytDlpConsentedProjectIds?: string[]
  sessionPermissions?: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationOverrides?: Record<string, { provider?: string; prompt?: string; config?: Record<string, any> }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoChooseDefaults?: Record<string, { provider: string; config: Record<string, any> }>
  initialStoryboard?: Storyboard | null
  resumeToolCall?: { toolName: string; toolInput: Record<string, unknown> } | null
  userId?: string
  resumeCheckpoint?: boolean
  directorTemplate?: string
  planFirstMode?: boolean
  localMode?: boolean
  mockMode?: boolean
  modelConfigs?: import('@/lib/agents/model-config').ModelConfig[]
  mp4Settings?: import('@/lib/types').MP4Settings
}

export interface RunAgentRequestOptions {
  body: AgentAPIRequest
  /** Server-authoritative userId. Null for guest mode. Never trust body.userId. */
  authenticatedUserId: string | null
  /** Cancels the runner when the transport's client disconnects. */
  abortSignal: AbortSignal
  /** Sink for all SSE events. HTTP enqueues; IPC forwards to webContents.send. */
  emit: (event: SSEEvent) => void
}

export type RejectConcurrentResult = { ok: true } | { ok: false; reason: 'IN_PROGRESS' }

/** Pre-flight concurrency gate. Transport uses this to return 409 before opening the stream. */
export function reserveRunSlot(projectId: string | undefined): RejectConcurrentResult {
  if (!projectId) return { ok: true }
  const existing = activeRuns.get(projectId)
  if (existing && Date.now() - existing.startedAt < STALE_RUN_TIMEOUT_MS) {
    return { ok: false, reason: 'IN_PROGRESS' }
  }
  activeRuns.set(projectId, { startedAt: Date.now() })
  return { ok: true }
}

/** Release a slot reserved by `reserveRunSlot`. Safe to call even if unreserved. */
export function releaseRunSlot(projectId: string | undefined): void {
  if (projectId) activeRuns.delete(projectId)
}

/**
 * Main agent orchestration — runs the agent, streams events via `emit`, and
 * handles all post-run side effects (persistence, log update, memory extraction).
 * Returns when the `runAgent` promise resolves AND all post-run work has
 * completed (or failed and been logged). Never throws — errors become emitted
 * `error` events. Caller is responsible for releasing the run slot.
 */
export async function runAgentRequest({
  body,
  authenticatedUserId,
  abortSignal,
  emit,
}: RunAgentRequestOptions): Promise<void> {
  // Extract text portion of message for logging (images are not logged)
  const messageText = messageContentToText(body.message)

  const logger = new AgentLogger()
  const frustration = detectFrustration(messageText)

  logger.log('api', 'Request received', {
    agent: body.agentOverride ?? 'auto',
    model: body.modelOverride ?? 'auto',
    sceneCount: body.scenes.length,
    messageLength: messageText.length,
    hasImages: typeof body.message !== 'string',
    ...(frustration.detected ? { frustration: frustration.level, frustrationTriggers: frustration.triggers } : {}),
  })

  // run_start first so the client can correlate subsequent events with this runId.
  emit({ type: 'run_start', runId: logger.runId })

  // Generation log before starting
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
    log.error('failed to create generation log', { error: e })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit({ type: 'warning', message: 'Usage tracking unavailable for this run.' } as any)
  }

  // Wrap emit to capture thinking content for the log
  const wrappedEmit = (event: SSEEvent) => {
    if (event.type === 'thinking_token' && event.token) {
      thinkingContentBuffer += event.token
    }
    emit(event)
  }

  // Fetch project assets + brand kit + workspace id + user memories in parallel.
  const [assetsResult, projectRowResult, memoriesResult] = await Promise.all([
    body.projectId
      ? db
          .select()
          .from(projectAssetsTable)
          .where(eq(projectAssetsTable.projectId, body.projectId))
          .orderBy(desc(projectAssetsTable.createdAt))
          .catch((e) => {
            log.warn('failed to fetch project assets', { error: e })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return [] as any[]
          })
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Promise.resolve([] as any[]),
    body.projectId
      ? db
          .select({ brandKit: projectsTable.brandKit, workspaceId: projectsTable.workspaceId })
          .from(projectsTable)
          .where(eq(projectsTable.id, body.projectId))
          .limit(1)
          .catch((e) => {
            log.warn('failed to fetch project row', { error: e })
            return [] as Array<{ brandKit: unknown; workspaceId: string | null }>
          })
      : Promise.resolve([] as Array<{ brandKit: unknown; workspaceId: string | null }>),
    authenticatedUserId
      ? getMemoriesForUser(authenticatedUserId, 20).catch((e) => {
          log.warn('failed to fetch user memories', { error: e })
          return [] as Awaited<ReturnType<typeof getMemoriesForUser>>
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof getMemoriesForUser>>),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchedAssets: any[] = assetsResult
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Permission rule fetch depends on the workspace id resolved above.
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
      log.warn('failed to fetch permission rules', { error: e })
    }
  }

  // Checkpoint resume — override message, scenes, and storyboard from saved state
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
      log.warn('failed to fetch run checkpoint', { error: e })
      emit({ type: 'warning', message: 'Failed to load checkpoint — starting fresh' })
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

  // Merge checkpoint scenes with current client scenes
  const effectiveScenes = (() => {
    if (!resumedCheckpoint) return body.scenes
    const checkpointScenes = resumedCheckpoint.worldSnapshot.scenes ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientScenes: any[] = body.scenes ?? []
    if (clientScenes.length === 0) return checkpointScenes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkpointMap = new Map(checkpointScenes.map((s: any) => [s.id, s]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientMap = new Map(clientScenes.map((s: any) => [s.id, s]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged: any[] = []
    for (const cs of clientScenes) {
      const cpScene = checkpointMap.get(cs.id)
      if (!cpScene) {
        merged.push(cs)
      } else if (resumedCheckpoint.completedSceneIds.includes(cs.id)) {
        const clientNewer = cs.updatedAt && cpScene.updatedAt && cs.updatedAt > cpScene.updatedAt
        merged.push(clientNewer ? cs : cpScene)
      } else {
        merged.push(cs)
      }
    }
    for (const cpScene of checkpointScenes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!clientMap.has((cpScene as any).id)) {
        merged.push(cpScene)
      }
    }
    return merged
  })()
  const effectiveGlobalStyle = resumedCheckpoint ? resumedCheckpoint.worldSnapshot.globalStyle : body.globalStyle
  const effectiveStoryboard = resumedCheckpoint?.storyboard ?? body.initialStoryboard ?? null

  // Pre-approve session permissions for APIs the storyboard's feature flags will need.
  if (effectiveStoryboard?.featureFlags) {
    const sp = body.sessionPermissions ?? {}
    const flags = effectiveStoryboard.featureFlags
    if (flags.narration && !sp['elevenLabs']) sp['elevenLabs'] = 'allow'
    if (flags.music && !sp['elevenLabs']) sp['elevenLabs'] = 'allow'
    body.sessionPermissions = sp
  }

  if (body.localMode) {
    const localModelCount = body.modelConfigs?.length ?? 0
    logger.log('api', `Local mode enabled: modelOverride=${body.modelOverride}, ${localModelCount} local model configs`)
  }

  // Run agent — await it so the caller's release/teardown happens after all
  // post-run work completes.
  try {
    const result = await runAgent({
      message: effectiveMessage,
      agentOverride: resumedCheckpoint ? resumedCheckpoint.agentType : body.agentOverride,
      modelOverride: body.modelOverride,
      modelTier: body.modelTier,
      thinkingMode: body.thinkingMode ?? 'adaptive',
      sceneContext: body.sceneContext,
      activeTools: body.activeTools,
      history: resumedCheckpoint ? [] : body.history,
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
      abortSignal,
      logger,
      emit: wrappedEmit,
      userMemories: userMemories.length > 0 ? userMemories : undefined,
      userId: authenticatedUserId ?? undefined,
      modelConfigs: body.modelConfigs,
      planFirstMode: body.planFirstMode,
      directorTemplate: body.directorTemplate,
      mp4Settings: body.mp4Settings,
      brandKit: fetchedBrandKit,
    })

    logger.log('api', 'Runner complete', {
      agentType: result.agentType,
      modelId: result.modelId,
      toolCalls: result.toolCalls.length,
      durationMs: result.usage.totalDurationMs,
    })

    // Persist scenes first so the client can refetch after transport drops.
    // Filter out scenes with placeholder content (lightScenes strips content for non-focused scenes).
    const isPlaceholder = (v: string | undefined | null) => !!v && /^\[\d+ chars\]$/.test(v)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanScenesForPersistence = result.updatedScenes.map((s: any) => {
      if (
        isPlaceholder(s.svgContent) ||
        isPlaceholder(s.canvasCode) ||
        isPlaceholder(s.sceneCode) ||
        isPlaceholder(s.lottieSource)
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orig = body.scenes.find((os: any) => os.id === s.id)
        return {
          ...s,
          svgContent: orig?.svgContent && !isPlaceholder(orig.svgContent) ? s.svgContent : undefined,
          canvasCode: orig?.canvasCode && !isPlaceholder(orig.canvasCode) ? s.canvasCode : undefined,
          sceneCode: orig?.sceneCode && !isPlaceholder(orig.sceneCode) ? s.sceneCode : undefined,
          lottieSource: orig?.lottieSource && !isPlaceholder(orig.lottieSource) ? s.lottieSource : undefined,
          sceneHTML: undefined,
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
          if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)))
        } catch (e) {
          logger.error('api', `persistScenesFromAgentRun threw (attempt ${attempt + 1}): ${(e as Error).message}`)
          if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)))
        }
      }
      if (!persistOk) {
        logger.error('api', 'persistScenesFromAgentRun failed after 3 attempts — agent work may not be persisted to DB')
        emit({
          type: 'warning',
          message: 'Your changes were applied but could not be saved to the database. Please save manually.',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        log.warn('failed to clear run checkpoint', { error: e })
      }
    }

    // Extract and persist user memories (fire-and-forget-ish — logged, not propagated)
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
        log.warn('failed to extract/persist memories', { error: e })
      }
    }

    // Compute run analytics metrics
    const scenesCreated = result.toolCalls.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tc: any) => tc.toolName === 'create_scene' && tc.output?.success !== false,
    ).length
    const scenesVerified = result.toolCalls.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tc: any) => tc.toolName === 'verify_scene' && tc.output?.success !== false,
    ).length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planCall = result.toolCalls.find((tc: any) => tc.toolName === 'plan_scenes' && tc.output?.success !== false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scenesPlanned = (planCall?.input as any)?.scenes?.length ?? 0

    const runMetrics = computeRunMetrics({
      toolCalls: result.toolCalls,
      usage: result.usage,
      durationMs: Date.now() - genStartTime,
      iterationsUsed: result.toolCalls.length,
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
        log.error('failed to update generation log', { error: e })
      }
    }

    // Final state_change event. 'done' is already emitted inside runAgent.
    logger.log(
      'api',
      `Sending state_change: ${cleanScenesForPersistence.length} scenes, hasGlobalStyle=${!!result.updatedGlobalStyle}`,
    )
    for (const s of cleanScenesForPersistence) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sc = s as any
      logger.log(
        'api',
        `  scene ${sc.id?.slice(0, 8)}… type=${sc.sceneType} react=${sc.reactCode?.length ?? 0} html=${sc.sceneHTML?.length ?? 0}`,
      )
    }
    emit({
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
      recordingCommand: result.recordingCommand,
      recordingCommandNonce: result.recordingCommandNonce,
      recordingConfig: result.recordingConfig,
      recordingAttachSceneId: result.recordingAttachSceneId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error('api', `Runner error: ${error?.message ?? 'Unknown error'}`, { stack: error?.stack })
    if (!error?._agentHandled) {
      emit({ type: 'error', error: `Agent error: ${error?.message ?? 'Unknown error'}` })
    }
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
        log.error('failed to update generation log on error', { error: e })
      }
    }
  }

  logger.log('api', 'Run complete')
}

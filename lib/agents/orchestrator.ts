/**
 * Orchestrator: Delegates scene-building to sub-agents.
 *
 * When a Director has a storyboard with 3+ scenes, instead of building
 * everything in a single 15-iteration loop, the orchestrator spawns
 * focused SceneMaker sub-agents — one per scene — each with its own
 * tool budget and narrowed context.
 *
 * Sub-agents are recursive runAgent() calls (not separate processes).
 * They share the parent's emit function for SSE streaming and operate
 * on isolated world state clones (same pattern as parallel tool execution).
 */

import { v4 as uuidv4 } from 'uuid'
import type { Scene, GlobalStyle, SceneGraph } from '../types'
import type { AgentType, ModelId, SSEEvent, Storyboard, StoryboardScene, UsageStats, ToolCallRecord } from './types'
import { runAgent, type RunnerOptions } from './runner'
import type { WorldStateMutable } from './tool-executor'
import { AgentLogger } from './logger'

/** Max iterations per sub-agent (much smaller than the parent's 15) */
const SUB_AGENT_MAX_ITERATIONS = 5

/** Wall-clock timeout per sub-agent in ms (90 seconds). maxIterations alone
 *  doesn't bound time — an agent could iterate slowly with expensive API calls. */
const SUB_AGENT_TIMEOUT_MS = 90_000

/** Max retries for a sub-agent that fails with a transient error */
const SUB_AGENT_MAX_RETRIES = 1

function isTransientError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('timeout') || lower.includes('rate limit') || lower.includes('overloaded') || lower.includes('529')
}

/**
 * Build a focused activeTools list for a sub-agent based on scene type.
 * This ensures the sub-agent only sees tools relevant to the scene it's building,
 * reducing cognitive load and irrelevant tool options.
 *
 * Always includes: audio (narration/SFX/music) + assets (images/media overlays).
 * Conditionally includes: scene-type-specific tools from TOOL_CATEGORY_MAP.
 */
function buildActiveToolsForSceneType(
  sceneType: string,
  parentActiveTools?: string[],
  featureFlags?: { narration?: boolean; music?: boolean; sfx?: boolean; interactions?: boolean },
): string[] {
  // Scene type → tool category mapping
  const SCENE_TYPE_TO_CATEGORIES: Record<string, string[]> = {
    svg: ['svg'],
    canvas2d: ['canvas2d'],
    d3: ['d3'],
    three: ['three'],
    motion: ['motion'],
    lottie: ['lottie'],
    zdog: ['zdog'],
    physics: ['physics'],
    avatar_scene: ['motion', 'avatars'],
    '3d_world': ['three'],
  }

  const categories = new Set<string>(SCENE_TYPE_TO_CATEGORIES[sceneType] ?? ['motion'])

  // Always include audio for narration/music/sfx (unless parent explicitly disabled)
  if (!parentActiveTools || parentActiveTools.includes('audio')) {
    categories.add('audio')
  }

  // Always include assets for image placement and media overlays
  if (!parentActiveTools || parentActiveTools.includes('assets')) {
    categories.add('assets')
  }

  // Include avatars if parent allows and scene type benefits
  if (
    (!parentActiveTools || parentActiveTools.includes('avatars')) &&
    (sceneType === 'avatar_scene' || sceneType === 'motion')
  ) {
    categories.add('avatars')
  }

  // Include interactions if feature flags request it
  if (featureFlags?.interactions && (!parentActiveTools || parentActiveTools.includes('interactions'))) {
    categories.add('interactions')
  }

  return Array.from(categories)
}

/** Max scenes to build in parallel (controls LLM cost) */
const MAX_PARALLEL_SUB_AGENTS = 3

export interface OrchestratorOptions {
  storyboard: Storyboard
  /** The parent's mutable world state — sub-agent results are merged back into this */
  parentWorld: WorldStateMutable
  /** The parent's full RunnerOptions (used to inherit settings) */
  parentOpts: RunnerOptions
  /** SSE emitter shared with parent */
  emit: (event: SSEEvent) => void
  /** Parent's logger for correlation */
  logger: AgentLogger
  /** Remaining tool call budget from parent (stops spawning sub-agents when exhausted) */
  toolBudgetRemaining?: number
  /** Parent's accumulated LLM cost at handoff time */
  parentCostUsd?: number
  /** Max cost for the entire run (parent + sub-agents) */
  maxRunCostUsd?: number
}

export interface SubAgentResult {
  sceneIndex: number
  sceneName: string
  success: boolean
  sceneId?: string
  usage: UsageStats
  toolCalls: ToolCallRecord[]
  error?: string
}

/**
 * Run orchestrated scene-building: spawn a sub-agent for each storyboard scene.
 *
 * Preconditions (enforced by caller):
 * - Director has already planned the storyboard
 * - Director has already set global style and transitions
 *
 * If scene shells were created by the Director, sub-agents will populate them.
 * If no shells exist, sub-agents will create the scenes themselves.
 *
 * The orchestrator:
 * 1. Matches storyboard scenes to existing scene shells (by name or index)
 * 2. For each scene, spawns a SceneMaker sub-agent with focused context
 * 3. Merges results back into the parent world state
 * 4. Returns aggregated results
 */
export async function runOrchestrated(opts: OrchestratorOptions): Promise<SubAgentResult[]> {
  const { storyboard, parentWorld, parentOpts, emit, logger } = opts
  const results: SubAgentResult[] = []
  const totalScenes = storyboard.scenes.length
  let cumulativeToolCalls = 0
  let cumulativeCostUsd = 0

  logger.log('orchestrator', `Starting orchestrated build: ${totalScenes} scenes (max ${MAX_PARALLEL_SUB_AGENTS} parallel)`, {
    sceneNames: storyboard.scenes.map((s) => s.name),
  })

  // Match storyboard scenes to existing scene shells in the world
  const sceneMap = matchStoryboardToScenes(storyboard.scenes, parentWorld.scenes)

  // Build scenes in batches of MAX_PARALLEL_SUB_AGENTS for parallelism
  for (let batchStart = 0; batchStart < totalScenes; batchStart += MAX_PARALLEL_SUB_AGENTS) {
    if (parentOpts.abortSignal?.aborted) {
      logger.warn('orchestrator', `Aborted before batch starting at scene ${batchStart + 1}`)
      break
    }

    // Tool budget guardrail: stop spawning sub-agents when tool budget is exhausted
    if (opts.toolBudgetRemaining != null && cumulativeToolCalls >= opts.toolBudgetRemaining) {
      logger.warn('orchestrator', `Tool budget exhausted (${cumulativeToolCalls}/${opts.toolBudgetRemaining}) — skipping remaining scenes`)
      const msg = `\n\n⚠ Tool call budget exhausted during orchestration. ${totalScenes - batchStart} scene(s) skipped.`
      emit({ type: 'token', token: msg })
      break
    }

    // Cost guardrail: stop if cumulative cost (parent + sub-agents) exceeds the run cap
    if (opts.maxRunCostUsd != null && opts.parentCostUsd != null) {
      const totalCost = opts.parentCostUsd + cumulativeCostUsd
      if (totalCost > opts.maxRunCostUsd) {
        logger.warn('orchestrator', `Cost limit exceeded during orchestration ($${totalCost.toFixed(3)} > $${opts.maxRunCostUsd}) — skipping remaining scenes`)
        const msg = `\n\n⚠ Cost limit reached during orchestration ($${totalCost.toFixed(2)} / $${opts.maxRunCostUsd.toFixed(2)}). ${totalScenes - batchStart} scene(s) skipped.`
        emit({ type: 'token', token: msg })
        break
      }
    }

    const batchEnd = Math.min(batchStart + MAX_PARALLEL_SUB_AGENTS, totalScenes)
    const batchItems: Array<{ index: number; planned: StoryboardScene; existingScene?: Scene; subAgentId: string }> = []

    for (let i = batchStart; i < batchEnd; i++) {
      const planned = storyboard.scenes[i]
      const existingScene = sceneMap.get(i)
      const subAgentId = uuidv4().slice(0, 8)

      batchItems.push({ index: i, planned, existingScene, subAgentId })

      emit({
        type: 'sub_agent_start',
        subAgentId,
        subAgentSceneIndex: i,
        subAgentTotal: totalScenes,
        subAgentSceneName: planned.name,
      })

      logger.log('orchestrator', `Sub-agent ${subAgentId}: building "${planned.name}" (${i + 1}/${totalScenes})`, {
        sceneType: planned.sceneType,
        duration: planned.duration,
        existingSceneId: existingScene?.id ?? null,
        batchIndex: i - batchStart,
        batchSize: batchEnd - batchStart,
      })
    }

    // Run batch in parallel with per-sub-agent timeout and retry
    const batchPromises = batchItems.map(async ({ index: i, planned, existingScene, subAgentId }) => {
      for (let attempt = 0; attempt <= SUB_AGENT_MAX_RETRIES; attempt++) {
        // Per-sub-agent AbortController with wall-clock timeout,
        // composed with the parent's abort signal so parent abort cascades.
        const subAbort = new AbortController()
        const timer = setTimeout(() => subAbort.abort(), SUB_AGENT_TIMEOUT_MS)
        const onParentAbort = () => subAbort.abort()
        parentOpts.abortSignal?.addEventListener('abort', onParentAbort, { once: true })

        try {
          const subResult = await buildSceneWithSubAgent({
            planned,
            sceneIndex: i,
            existingScene,
            parentWorld,
            parentOpts: { ...parentOpts, abortSignal: subAbort.signal },
            featureFlags: storyboard.featureFlags,
            emit,
            logger,
            subAgentId,
          })

          return {
            index: i,
            planned,
            subAgentId,
            result: subResult,
            error: undefined as string | undefined,
          }
        } catch (err) {
          const errMsg = (err as Error).message
          if (attempt < SUB_AGENT_MAX_RETRIES && isTransientError(errMsg)) {
            logger.warn('orchestrator', `Sub-agent ${subAgentId} failed (transient), retrying: ${errMsg}`, {
              sceneIndex: i,
              attempt,
            })
            continue
          }
          logger.error('orchestrator', `Sub-agent ${subAgentId} crashed: ${errMsg}`, {
            sceneIndex: i,
            sceneName: planned.name,
          })
          return {
            index: i,
            planned,
            subAgentId,
            result: undefined as BuildSceneResult | undefined,
            error: errMsg,
          }
        } finally {
          clearTimeout(timer)
          parentOpts.abortSignal?.removeEventListener('abort', onParentAbort)
        }
      }
      // Unreachable, but TypeScript needs it
      return { index: i, planned, subAgentId, result: undefined as BuildSceneResult | undefined, error: 'max retries exceeded' }
    })

    const batchResults = await Promise.all(batchPromises)

    // Merge results back in scene order (not completion order) to preserve ordering
    for (const { index: i, planned, subAgentId, result: subResult, error } of batchResults) {
      if (subResult?.success && subResult.updatedScene) {
        const worldIdx = parentWorld.scenes.findIndex((s) => s.id === subResult.updatedScene!.id)
        if (worldIdx !== -1) {
          parentWorld.scenes[worldIdx] = subResult.updatedScene
        } else {
          parentWorld.scenes.push(subResult.updatedScene)
        }
        logger.log('orchestrator', `Merged scene "${planned.name}" into parent world`, {
          sceneId: subResult.updatedScene.id,
        })
      }

      const subUsage = subResult?.usage ?? { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 0 }
      const subToolCalls = subResult?.toolCalls ?? []
      cumulativeToolCalls += subToolCalls.length
      cumulativeCostUsd += subUsage.costUsd

      results.push({
        sceneIndex: i,
        sceneName: planned.name,
        success: subResult?.success ?? false,
        sceneId: subResult?.sceneId,
        usage: subUsage,
        toolCalls: subToolCalls,
        error: error ?? subResult?.error,
      })

      emit({
        type: 'sub_agent_complete',
        subAgentId,
        subAgentSceneIndex: i,
        subAgentTotal: totalScenes,
        subAgentSceneName: planned.name,
        subAgentSuccess: subResult?.success ?? false,
      })

      if (subResult?.success && subResult.sceneId) {
        emit({
          type: 'preview_update',
          sceneId: subResult.sceneId,
          changes: [
            { type: 'scene_updated', sceneId: subResult.sceneId, description: `Sub-agent built "${planned.name}"` },
          ],
        })
        emit({
          type: 'state_change',
          changes: [
            { type: 'scene_updated', sceneId: subResult.sceneId, description: `Sub-agent built "${planned.name}"` },
          ],
        })
      }
    }
  }

  // Cross-scene consistency check — detect issues across the full sequence
  const consistencyIssues = checkCrossSceneConsistency(parentWorld.scenes, storyboard, results)
  if (consistencyIssues.length > 0) {
    logger.warn('orchestrator', `Cross-scene consistency issues: ${consistencyIssues.length}`, {
      issues: consistencyIssues,
    })
    // Emit as a text token so the Director agent can see and address them
    const issueText = [
      '\n\n⚠ Cross-scene consistency check:',
      ...consistencyIssues.map((issue) => `  - ${issue}`),
      'Consider fixing these in the polish phase.',
    ].join('\n')
    emit({ type: 'token', token: issueText })
  }

  // Log summary
  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const totalUsage = aggregateUsage(results)

  logger.log('orchestrator', `Orchestration complete: ${succeeded}/${totalScenes} succeeded, ${failed} failed`, {
    totalUsage,
    failedScenes: results.filter((r) => !r.success).map((r) => r.sceneName),
  })

  return results
}

/** Check for visual/structural inconsistencies across scenes built by different sub-agents */
function checkCrossSceneConsistency(
  scenes: Scene[],
  storyboard: Storyboard,
  results: SubAgentResult[],
): string[] {
  const issues: string[] = []
  const builtScenes = results.filter((r) => r.success && r.sceneId)

  // Check for scenes that failed to build
  const failedScenes = results.filter((r) => !r.success)
  if (failedScenes.length > 0) {
    issues.push(`${failedScenes.length} scene(s) failed to build: ${failedScenes.map((r) => r.sceneName).join(', ')}`)
  }

  // Check for missing audio on scenes that should have narration
  if (storyboard.featureFlags?.narration !== false) {
    for (const result of builtScenes) {
      const scene = scenes.find((s) => s.id === result.sceneId)
      if (scene && !(scene.audioLayer?.enabled)) {
        issues.push(`Scene "${scene.name}" has no audio — narration may be missing`)
      }
    }
  }

  // Check for duplicate scene types exceeding 3 consecutive
  const sceneTypes = scenes
    .filter((s) => builtScenes.some((r) => r.sceneId === s.id))
    .map((s) => s.sceneType)
  let consecutiveCount = 1
  for (let i = 1; i < sceneTypes.length; i++) {
    if (sceneTypes[i] === sceneTypes[i - 1]) {
      consecutiveCount++
      if (consecutiveCount > 3) {
        issues.push(`${consecutiveCount}+ consecutive ${sceneTypes[i]} scenes — consider varying renderer types`)
        break
      }
    } else {
      consecutiveCount = 1
    }
  }

  // Check for scenes with very different durations from their storyboard spec
  for (const result of builtScenes) {
    const scene = scenes.find((s) => s.id === result.sceneId)
    const planned = storyboard.scenes[result.sceneIndex]
    if (scene && planned && Math.abs(scene.duration - planned.duration) > 3) {
      issues.push(
        `Scene "${scene.name}" duration ${scene.duration}s differs from planned ${planned.duration}s by ${Math.abs(scene.duration - planned.duration)}s`,
      )
    }
  }

  return issues
}

// ── Sub-agent execution ──────────────────────────────────────────────────────

interface BuildSceneOptions {
  planned: StoryboardScene
  sceneIndex: number
  existingScene: Scene | undefined
  parentWorld: WorldStateMutable
  parentOpts: RunnerOptions
  emit: (event: SSEEvent) => void
  logger: AgentLogger
  subAgentId: string
  featureFlags?: { narration?: boolean; music?: boolean; sfx?: boolean; interactions?: boolean }
}

interface BuildSceneResult {
  success: boolean
  sceneId?: string
  updatedScene?: Scene
  usage: UsageStats
  toolCalls: ToolCallRecord[]
  error?: string
}

async function buildSceneWithSubAgent(opts: BuildSceneOptions): Promise<BuildSceneResult> {
  const { planned, sceneIndex, existingScene, parentWorld, parentOpts, emit, logger, subAgentId } = opts

  // Build a focused message for the SceneMaker
  const scenePrompt = buildScenePrompt(planned, existingScene)

  // Clone the parent world for isolation (deep clone to prevent cross-agent mutations)
  const isolatedScenes = JSON.parse(JSON.stringify(parentWorld.scenes)) as Scene[]
  const isolatedGlobalStyle = JSON.parse(JSON.stringify(parentWorld.globalStyle)) as GlobalStyle

  // Create a sub-agent logger that correlates to the parent run
  const subLogger = new AgentLogger()
  subLogger.log('sub_agent', `Starting for "${planned.name}"`, {
    parentRunId: logger.runId,
    subAgentId,
    sceneIndex,
  })

  const result = await runAgent({
    message: scenePrompt,
    agentOverride: 'scene-maker' as AgentType,
    modelOverride: parentOpts.modelOverride,
    modelTier: parentOpts.modelTier,
    thinkingMode: parentOpts.thinkingMode ?? 'adaptive',
    sceneContext: existingScene?.id ?? 'all',
    activeTools: buildActiveToolsForSceneType(planned.sceneType, parentOpts.activeTools, opts.featureFlags),
    history: [], // fresh context per scene
    projectId: parentOpts.projectId,
    scenes: isolatedScenes,
    globalStyle: isolatedGlobalStyle,
    projectName: parentOpts.projectName,
    outputMode: parentOpts.outputMode,
    sceneGraph: parentWorld.sceneGraph ? JSON.parse(JSON.stringify(parentWorld.sceneGraph)) : undefined,
    selectedSceneId: existingScene?.id ?? null,
    apiPermissions: parentOpts.apiPermissions,
    enabledModelIds: parentOpts.enabledModelIds,
    audioProviderEnabled: parentOpts.audioProviderEnabled,
    mediaGenEnabled: parentOpts.mediaGenEnabled,
    sessionPermissions: parentOpts.sessionPermissions,
    generationOverrides: parentOpts.generationOverrides,
    autoChooseDefaults: parentOpts.autoChooseDefaults,
    abortSignal: parentOpts.abortSignal,
    logger: subLogger,
    emit, // shared SSE stream
    userMemories: parentOpts.userMemories,
    userId: parentOpts.userId,
    // Sub-agent specific
    maxIterations: SUB_AGENT_MAX_ITERATIONS,
    isSubAgent: true,
    parentRunId: logger.runId,
    // Focused prompt: only include guidance for this scene's type
    focusedSceneType: planned.sceneType,
  })

  // Find the scene that was built/updated by the sub-agent
  const updatedScene = existingScene
    ? result.updatedScenes.find((s) => s.id === existingScene.id)
    : result.updatedScenes.find((s) => s.name === planned.name || s.prompt?.includes(planned.purpose))

  const success =
    !!updatedScene &&
    (!!updatedScene.svgContent ||
      !!updatedScene.canvasCode ||
      !!updatedScene.sceneCode ||
      !!updatedScene.lottieSource ||
      (updatedScene.aiLayers?.length ?? 0) > 0 ||
      (updatedScene.svgObjects?.length ?? 0) > 0 ||
      ((updatedScene as any).chartLayers?.length ?? 0) > 0)

  return {
    success,
    sceneId: updatedScene?.id,
    updatedScene,
    usage: result.usage,
    toolCalls: result.toolCalls,
    error: success ? undefined : 'Sub-agent did not produce content for this scene',
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a focused prompt for a SceneMaker sub-agent based on the storyboard scene spec */
function buildScenePrompt(planned: StoryboardScene, existingScene?: Scene): string {
  const parts: string[] = []

  if (existingScene) {
    parts.push(`Build the visual content for scene "${planned.name}" (ID: ${existingScene.id}).`)
    parts.push(
      `The scene shell already exists with duration ${existingScene.duration}s and background ${existingScene.bgColor}.`,
    )
  } else {
    parts.push(`Create and build a scene called "${planned.name}".`)
    parts.push(`Duration: ${planned.duration}s.`)
  }

  parts.push(`\nScene purpose: ${planned.purpose}`)
  parts.push(`Scene type: ${planned.sceneType}`)

  if (planned.visualElements) {
    parts.push(`Key visual elements: ${planned.visualElements}`)
  }
  if (planned.narrationDraft) {
    parts.push(`Narration: "${planned.narrationDraft}"`)
    parts.push(`Add narration with this text using add_narration.`)
  }
  if (planned.audioNotes) {
    parts.push(`Audio: ${planned.audioNotes}`)
  }
  if (planned.chartSpec) {
    parts.push(`Chart: ${planned.chartSpec.type} — ${planned.chartSpec.dataDescription}`)
    parts.push(`Use generate_chart for this visualization.`)
  }
  if (planned.transition) {
    parts.push(`Transition to next scene: ${planned.transition}`)
  }

  parts.push(`\nAfter generating visual content, call verify_scene to check your work.`)

  return parts.join('\n')
}

/** Match storyboard scene specs to existing scene shells in the world by name or index.
 *  Each world scene can only be matched once — prevents duplicate sub-agent builds. */
function matchStoryboardToScenes(planned: StoryboardScene[], worldScenes: Scene[]): Map<number, Scene> {
  const map = new Map<number, Scene>()
  const claimedIds = new Set<string>()

  for (let i = 0; i < planned.length; i++) {
    // Try exact name match first
    const byName = worldScenes.find(
      (s) => !claimedIds.has(s.id) && s.name.toLowerCase() === planned[i].name.toLowerCase(),
    )
    if (byName) {
      map.set(i, byName)
      claimedIds.add(byName.id)
      continue
    }

    // Fall back to index-based match (scenes created in storyboard order)
    if (i < worldScenes.length && !claimedIds.has(worldScenes[i].id)) {
      map.set(i, worldScenes[i])
      claimedIds.add(worldScenes[i].id)
    }
    // If no match, sub-agent will create the scene itself
  }

  return map
}

/** Aggregate usage stats from all sub-agent results */
function aggregateUsage(results: SubAgentResult[]): UsageStats {
  return results.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + r.usage.inputTokens,
      outputTokens: acc.outputTokens + r.usage.outputTokens,
      apiCalls: acc.apiCalls + r.usage.apiCalls,
      costUsd: acc.costUsd + r.usage.costUsd,
      totalDurationMs: acc.totalDurationMs + r.usage.totalDurationMs,
    }),
    { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 0 },
  )
}

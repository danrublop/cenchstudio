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
const SUB_AGENT_MAX_ITERATIONS = 8

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

  logger.log('orchestrator', `Starting orchestrated build: ${totalScenes} scenes`, {
    sceneNames: storyboard.scenes.map((s) => s.name),
  })

  // Match storyboard scenes to existing scene shells in the world
  const sceneMap = matchStoryboardToScenes(storyboard.scenes, parentWorld.scenes)

  for (let i = 0; i < totalScenes; i++) {
    const planned = storyboard.scenes[i]
    const existingScene = sceneMap.get(i)

    // Check abort
    if (parentOpts.abortSignal?.aborted) {
      logger.warn('orchestrator', `Aborted at scene ${i + 1}/${totalScenes}`)
      break
    }

    const subAgentId = uuidv4().slice(0, 8)

    emit({
      type: 'sub_agent_start',
      subAgentId,
      subAgentSceneIndex: i,
      subAgentTotal: totalScenes,
      subAgentSceneName: planned.name,
    })

    const subAgentActiveTools = buildActiveToolsForSceneType(
      planned.sceneType,
      parentOpts.activeTools,
      storyboard.featureFlags,
    )

    logger.log('orchestrator', `Sub-agent ${subAgentId}: building "${planned.name}" (${i + 1}/${totalScenes})`, {
      sceneType: planned.sceneType,
      duration: planned.duration,
      existingSceneId: existingScene?.id ?? null,
      activeTools: subAgentActiveTools,
      focusedSceneType: planned.sceneType,
    })

    try {
      const subResult = await buildSceneWithSubAgent({
        planned,
        sceneIndex: i,
        existingScene,
        parentWorld,
        parentOpts,
        featureFlags: storyboard.featureFlags,
        emit,
        logger,
        subAgentId,
      })

      results.push({
        sceneIndex: i,
        sceneName: planned.name,
        success: subResult.success,
        sceneId: subResult.sceneId,
        usage: subResult.usage,
        toolCalls: subResult.toolCalls,
        error: subResult.error,
      })

      // Merge the sub-agent's updated scene back into parent world
      if (subResult.success && subResult.updatedScene) {
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

      emit({
        type: 'sub_agent_complete',
        subAgentId,
        subAgentSceneIndex: i,
        subAgentTotal: totalScenes,
        subAgentSceneName: planned.name,
        subAgentSuccess: subResult.success,
      })

      // Emit state_change so client updates preview
      if (subResult.success && subResult.sceneId) {
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
    } catch (err) {
      logger.error('orchestrator', `Sub-agent ${subAgentId} crashed: ${(err as Error).message}`, {
        sceneIndex: i,
        sceneName: planned.name,
      })

      results.push({
        sceneIndex: i,
        sceneName: planned.name,
        success: false,
        usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 0 },
        toolCalls: [],
        error: (err as Error).message,
      })

      emit({
        type: 'sub_agent_complete',
        subAgentId,
        subAgentSceneIndex: i,
        subAgentTotal: totalScenes,
        subAgentSceneName: planned.name,
        subAgentSuccess: false,
      })

      // Continue with next scene — don't abort the whole orchestration
    }
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

  // Clone the parent world for isolation
  const isolatedScenes = JSON.parse(JSON.stringify(parentWorld.scenes)) as Scene[]
  const isolatedGlobalStyle = { ...parentWorld.globalStyle } as GlobalStyle

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

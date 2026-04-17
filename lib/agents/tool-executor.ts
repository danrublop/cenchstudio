/**
 * Tool execution engine for the Cench Studio agent system.
 *
 * Each tool creates a snapshot before execution, performs the operation
 * against the world state (passed as mutable objects), and returns a
 * structured result with success/failure and affected scene info.
 *
 * Note: This module is SERVER-SIDE only and should be used inside API routes.
 * It does NOT directly access the Zustand store — instead it operates on
 * plain Scene[] and GlobalStyle objects, returning updated versions that
 * the API route then forwards to the client to apply via store actions.
 */

import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import type { Scene, GlobalStyle, SceneType, APIPermissions, SceneGraph, ZdogPersonAsset } from '../types'
import type { ToolResult, StateSnapshot } from './types'
import type { AgentLogger } from './logger'
import { toolRegistry } from './tool-registry'
import { generateSceneHTML } from '../sceneTemplate'
import { resolveProjectDimensions } from '../dimensions'
import { resolveStyle } from '../styles/presets'
import { API_COST_ESTIMATES, API_DISPLAY_NAMES, checkPermission, estimateApiCostUsd } from '../permissions'
import { evaluatePermission } from '../permissions/evaluator'
import { generateCode } from '../generation/generate'
import { ALL_TOOLS } from './tools'
import { SCENE_ID_RE } from '../api/constants'
import { createSceneToolHandler, SCENE_TOOL_NAMES } from './tool-handlers/scene-tools'
import { createStyleToolHandler, STYLE_TOOL_NAMES } from './tool-handlers/style-tools'
import { createInteractionToolHandler, INTERACTION_TOOL_NAMES } from './tool-handlers/interaction-tools'
import { AUDIO_TOOL_NAMES, createAudioToolHandler } from './tool-handlers/audio-tools'
import { createImageVideoToolHandler, IMAGE_VIDEO_TOOL_NAMES } from './tool-handlers/image-video-tools'
import { createMediaLibraryExtHandler, MEDIA_LIBRARY_EXT_TOOL_NAMES } from './tool-handlers/media-library-tools'
import { AVATAR_TOOL_NAMES, createAvatarToolHandler } from './tool-handlers/avatar-tools'
import { createLayerToolHandler, LAYER_TOOL_NAMES } from './tool-handlers/layer-tools'
import { createChartToolHandler, CHART_TOOL_NAMES } from './tool-handlers/chart-tools'
import { createElementToolHandler, ELEMENT_TOOL_NAMES } from './tool-handlers/element-tools'
import { createAILayerToolHandler, AI_LAYER_TOOL_NAMES } from './tool-handlers/ai-layer-tools'
import { createParentingToolHandler, PARENTING_TOOL_NAMES } from './tool-handlers/parenting-tools'
import { createAssetMediaToolHandler, ASSET_MEDIA_TOOL_NAMES } from './tool-handlers/asset-media-tools'
import { createRecordingToolHandler, RECORDING_TOOL_NAMES } from './tool-handlers/recording-tools'
import { createTemplateToolHandler, TEMPLATE_TOOL_NAMES } from './tool-handlers/template-tools'
import { createPlanningExportToolHandler, PLANNING_EXPORT_TOOL_NAMES } from './tool-handlers/planning-export-tools'
import { createThreeWorldToolHandler, THREE_WORLD_TOOL_NAMES } from './tool-handlers/three-world-tools'
import { createPhysicsToolHandler, PHYSICS_TOOL_NAMES } from './tool-handlers/physics-tools'
import { createMotionToolHandler, MOTION_TOOL_NAMES } from './tool-handlers/motion-tools'
import { createSkillToolHandler, SKILL_TOOL_NAMES } from './tool-handlers/skill-tools'
import { createBrandToolHandler, BRAND_TOOL_NAMES } from './tool-handlers/brand-tools'
import { createResearchToolHandler, RESEARCH_TOOL_NAMES } from './tool-handlers/research-tools'

// ── Tool Error Rate Tracking ─────────────────────────────────────────────────

const toolStats = new Map<string, { success: number; failure: number }>()

function recordToolResult(toolName: string, success: boolean): void {
  const entry = toolStats.get(toolName) ?? { success: 0, failure: 0 }
  if (success) entry.success++
  else entry.failure++
  toolStats.set(toolName, entry)
}

/** Get per-tool success/failure counts accumulated during the current run */
export function getToolStats(): Record<string, { success: number; failure: number }> {
  return Object.fromEntries(toolStats)
}

/** Reset tool stats (call at the start of each agent run) */
export function resetToolStats(): void {
  toolStats.clear()
}

// ── Snapshot System ───────────────────────────────────────────────────────────

const snapshots: StateSnapshot[] = []
const MAX_SNAPSHOTS = 50

export function createSnapshot(world: WorldStateMutable, description: string): StateSnapshot {
  if (!world.snapshots) world.snapshots = []
  const snapshot: StateSnapshot = {
    id: uuidv4(),
    timestamp: Date.now(),
    description,
    // Deep clone
    scenes: JSON.parse(JSON.stringify(world.scenes)),
    globalStyle: JSON.parse(JSON.stringify(world.globalStyle)),
  }
  world.snapshots.push(snapshot)
  if (world.snapshots.length > 20) world.snapshots.shift() // per-run cap
  // Also keep module-level fallback in sync for legacy call sites
  snapshots.push(snapshot)
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift()
  return snapshot
}

export function getSnapshots(): StateSnapshot[] {
  return [...snapshots]
}

export function getLastSnapshot(world?: WorldStateMutable): StateSnapshot | null {
  const arr = world?.snapshots?.length ? world.snapshots : snapshots
  return arr.length > 0 ? arr[arr.length - 1] : null
}

/** Restore world state from a snapshot. Used for rollback when a tool throws.
 *  Replaces scenes and globalStyle entirely (not shallow merge) to ensure
 *  nested objects like palette arrays are fully reverted. */
export function restoreSnapshot(world: WorldStateMutable, snapshot: StateSnapshot): void {
  world.scenes = JSON.parse(JSON.stringify(snapshot.scenes))
  // Clear all existing keys then apply snapshot to avoid stale nested refs
  for (const key of Object.keys(world.globalStyle)) {
    delete (world.globalStyle as unknown as Record<string, unknown>)[key]
  }
  Object.assign(world.globalStyle, JSON.parse(JSON.stringify(snapshot.globalStyle)))
}

// ── Tool timeouts ────────────────────────────────────────────────────────────
const TOOL_TIMEOUT_MS = 60_000 // 60s default per tool
const GENERATION_TOOL_TIMEOUT_MS = 120_000 // 120s for LLM-backed generation tools

// ── Generation tools that benefit from auto-validation ───────────────────────
const GENERATION_TOOL_SET = new Set([
  'add_layer',
  'regenerate_layer',
  'edit_layer',
  'generate_chart',
  'generate_physics_scene',
  'create_world_scene',
  'write_scene_code',
])

/** Quick validation checks run automatically after generation tools succeed.
 *  Returns a list of warning strings (empty = no issues detected). */
function quickValidateScene(scene: Scene): string[] {
  const warnings: string[] = []
  const hasContent = !!(scene.svgContent || scene.canvasCode || scene.sceneCode || scene.lottieSource)
  const layerCount = (scene.svgObjects?.length ?? 0) + (scene.aiLayers?.length ?? 0)
  if (!hasContent && layerCount === 0) {
    warnings.push('EMPTY: Scene has no visual content after generation.')
  }
  if (scene.duration < 3) {
    warnings.push(`SHORT: Duration is ${scene.duration}s — minimum recommended is 6s.`)
  }
  // Check for suspiciously short generated code (likely failed generation)
  const codeLength = (scene.sceneCode?.length ?? 0) + (scene.canvasCode?.length ?? 0) + (scene.svgContent?.length ?? 0)
  if (hasContent && codeLength < 100) {
    warnings.push(`MINIMAL: Generated code is only ${codeLength} chars — may be incomplete.`)
  }
  return warnings
}

// ── World State Container ─────────────────────────────────────────────────────

export interface WorldStateMutable {
  scenes: Scene[]
  globalStyle: GlobalStyle
  projectName: string
  projectId?: string
  outputMode: 'mp4' | 'interactive'
  sceneGraph: SceneGraph
  activeTools?: string[]
  /** Per-run snapshot store for undo/recovery (isolates concurrent runs) */
  snapshots?: StateSnapshot[]
  apiPermissions?: APIPermissions
  audioProviderEnabled?: Record<string, boolean>
  mediaGenEnabled?: Record<string, boolean>
  /** Master switch for web research tools (web_search, fetch_url_content). Model-agnostic. */
  researchEnabled?: boolean
  /** Per-provider enabled map for research providers (brave, tavily, exa). */
  researchProviderEnabled?: Record<string, boolean>
  /** Project IDs where the user has acknowledged the yt-dlp legal disclaimer. Downloads
   *  are refused for projects not in this set. Probe calls are always allowed. */
  ytDlpConsentedProjects?: Set<string>
  sessionPermissions?: Record<string, string>
  generationOverrides?: Record<string, { provider?: string; prompt?: string; config?: Record<string, any> }>
  autoChooseDefaults?: Record<string, { provider: string; config: Record<string, any> }>
  /** Model ID used by the agent — forwarded to generateCode so it respects the user's model choice */
  modelId?: string
  /** Model tier — forwarded to generateCode so it respects the user's tier choice */
  modelTier?: 'auto' | 'premium' | 'budget'
  /** When true, prefer free/local providers for TTS and generation */
  localMode?: boolean
  /** Model configs for resolving local model endpoints */
  modelConfigs?: import('./model-config').ModelConfig[]
  /** Storyboard set by plan_scenes — provides narrative context for downstream generation */
  storyboard?: import('./types').Storyboard
  zdogLibrary?: ZdogPersonAsset[]
  zdogStudioLibrary?: import('@/lib/types/zdog-studio').ZdogStudioAsset[]
  /** NLE timeline with clips on tracks */
  timeline?: import('../types').Timeline | null
  /** MP4/export settings including aspect ratio */
  mp4Settings?: import('../types').MP4Settings
  // Recording state (agent-controlled)
  recordingState?: import('@/types/electron').RecordingStoreState
  recordingConfig?: import('@/types/electron').RecordingConfig
  recordingCommand?: import('@/types/electron').RecordingCommand
  recordingCommandNonce?: number
  recordingResult?: import('@/types/electron').RecordingSessionManifest | null
  recordingError?: string | null
  recordingElapsed?: number
  recordingAttachSceneId?: string | null
  /** Project assets (media library) for brand kit and SVG extrusion */
  projectAssets?: import('../types/media').ProjectAsset[]
  /** Brand kit data for branding tools */
  brandKit?: import('../types/media').BrandKit | null
  /** Layered permission rules (user/workspace/project/session) resolved at
   *  request start. Supersedes the legacy apiPermissions enum modes for the
   *  allow/deny decision; apiPermissions still carries spend caps. */
  permissionRules?: import('../types/permissions').PermissionRule[]
  /** Authenticated userId (trusted, set server-side from session). Needed to
   *  author new session-scope rules from the dialog's "This session" button. */
  authUserId?: string | null
  /** Conversation id for session-scope rule authoring. */
  conversationId?: string | null
  /** Workspace id plumbed for evaluator context. */
  workspaceId?: string | null
}

// ── Tool Hook Pipeline ───────────────────────────────────────────────────────
//
// Pre-tool hooks run before execution and can deny or modify tool inputs.
// Post-tool hooks run after execution and can augment or flag results.
// Hooks are registered globally and matched by tool name or wildcard '*'.

export interface PreToolHookContext {
  toolName: string
  args: Record<string, unknown>
  world: WorldStateMutable
}

export interface PreToolHookResult {
  /** If true, tool execution is blocked with the provided reason */
  deny?: boolean
  reason?: string
  /** Optionally modify tool args before execution */
  modifiedArgs?: Record<string, unknown>
}

export interface PostToolHookContext {
  toolName: string
  args: Record<string, unknown>
  result: ToolResult
  world: WorldStateMutable
  durationMs: number
}

export interface PostToolHookResult {
  /** Optionally override or augment the tool result */
  modifiedResult?: ToolResult
  /** Warning message appended to result data */
  warning?: string
}

export type PreToolHook = (ctx: PreToolHookContext) => PreToolHookResult | Promise<PreToolHookResult>
export type PostToolHook = (ctx: PostToolHookContext) => PostToolHookResult | Promise<PostToolHookResult>

interface RegisteredHook<T> {
  /** Tool name pattern: exact name or '*' for all tools */
  pattern: string
  name: string
  hook: T
}

const preToolHooks: RegisteredHook<PreToolHook>[] = []
const postToolHooks: RegisteredHook<PostToolHook>[] = []

/** Register a pre-tool hook. Pattern can be an exact tool name or '*' for all. */
export function registerPreToolHook(pattern: string, name: string, hook: PreToolHook): void {
  preToolHooks.push({ pattern, name, hook })
}

/** Register a post-tool hook. Pattern can be an exact tool name or '*' for all. */
export function registerPostToolHook(pattern: string, name: string, hook: PostToolHook): void {
  postToolHooks.push({ pattern, name, hook })
}

/** Remove all hooks (useful for testing). */
export function clearToolHooks(): void {
  preToolHooks.length = 0
  postToolHooks.length = 0
}

/** Remove hooks by name. Used by loadProjectHooks cleanup to remove
 *  only user-configured hooks without affecting built-in hooks. */
export function removeHooksByName(names: string[]): void {
  const nameSet = new Set(names)
  for (let i = preToolHooks.length - 1; i >= 0; i--) {
    if (nameSet.has(preToolHooks[i].name)) preToolHooks.splice(i, 1)
  }
  for (let i = postToolHooks.length - 1; i >= 0; i--) {
    if (nameSet.has(postToolHooks[i].name)) postToolHooks.splice(i, 1)
  }
}

function matchesPattern(pattern: string, toolName: string): boolean {
  return pattern === '*' || pattern === toolName
}

async function runPreToolHooks(ctx: PreToolHookContext, logger?: AgentLogger): Promise<PreToolHookResult> {
  let currentArgs = ctx.args
  for (const { pattern, name, hook } of preToolHooks) {
    if (!matchesPattern(pattern, ctx.toolName)) continue
    try {
      const result = await hook({ ...ctx, args: currentArgs })
      if (result.deny) {
        logger?.log('hook', `Pre-tool hook "${name}" denied ${ctx.toolName}: ${result.reason}`)
        return result
      }
      if (result.modifiedArgs) {
        currentArgs = result.modifiedArgs
      }
    } catch (err) {
      logger?.warn('hook', `Pre-tool hook "${name}" threw: ${(err as Error).message}`)
      // Hook errors don't block execution
    }
  }
  return { modifiedArgs: currentArgs }
}

async function runPostToolHooks(ctx: PostToolHookContext, logger?: AgentLogger): Promise<ToolResult> {
  let currentResult = ctx.result
  for (const { pattern, name, hook } of postToolHooks) {
    if (!matchesPattern(pattern, ctx.toolName)) continue
    try {
      const hookResult = await hook({ ...ctx, result: currentResult })
      if (hookResult.modifiedResult) {
        currentResult = hookResult.modifiedResult
      }
      if (hookResult.warning) {
        currentResult = {
          ...currentResult,
          data: {
            ...(typeof currentResult.data === 'object' && currentResult.data ? currentResult.data : {}),
            _hookWarning: hookResult.warning,
          },
        }
        logger?.log('hook', `Post-tool hook "${name}" warning on ${ctx.toolName}: ${hookResult.warning}`)
      }
    } catch (err) {
      logger?.warn('hook', `Post-tool hook "${name}" threw: ${(err as Error).message}`)
    }
  }
  return currentResult
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function findScene(world: WorldStateMutable, sceneId: string): Scene | undefined {
  return world.scenes.find((s) => s.id === sceneId)
}

function updateScene(world: WorldStateMutable, sceneId: string, updates: Partial<Scene>): Scene | null {
  const idx = world.scenes.findIndex((s) => s.id === sceneId)
  if (idx === -1) return null
  const updated = { ...world.scenes[idx], ...updates, updatedAt: Date.now() }
  // Keep D3 structured data coherent when scene type changes.
  if (updates.sceneType && updates.sceneType !== 'd3') {
    updated.chartLayers = []
    updated.d3Data = null
  }
  world.scenes[idx] = updated
  return updated
}

/** Clear code fields that don't belong to the given scene type */
export function clearStaleCodeFields(sceneType: SceneType): Partial<Scene> {
  const clear: Partial<Scene> = {}
  if (sceneType !== 'svg') {
    clear.svgContent = ''
    clear.svgObjects = []
  }
  if (sceneType !== 'canvas2d') clear.canvasCode = ''
  if (sceneType !== 'lottie') clear.lottieSource = ''
  if (sceneType !== 'react') clear.reactCode = ''
  if (sceneType !== 'd3') {
    clear.d3Data = null
    clear.chartLayers = [] as any
  }
  if (!['d3', 'three', 'motion', 'zdog', 'physics'].includes(sceneType)) clear.sceneCode = ''
  if (sceneType === 'canvas2d' || !['motion', 'd3', 'svg'].includes(sceneType)) {
    clear.canvasBackgroundCode = ''
  }
  return clear
}

function err(message: string): ToolResult {
  return { success: false, error: message }
}

// ── Permission Helpers ────────────────────────────────────────────────────────

type APIName = keyof APIPermissions

/**
 * Check whether an API is permitted to be called based on the project's
 * APIPermissions config. Returns an error ToolResult when the call should be
 * blocked, or null when execution should proceed.
 *
 * For always_ask / ask_once modes: returns a structured result with
 * `permissionNeeded` so the chat UI can render approve/deny buttons.
 * For ask_once: checks sessionPermissions first — if already approved this
 * session, allows the call without prompting.
 */
function checkApiPermission(
  world: WorldStateMutable,
  api: APIName,
  context?: {
    reason?: string
    details?: {
      prompt?: string
      duration?: number
      model?: string
      resolution?: string
      textLength?: number
    }
  },
): ToolResult | null {
  if (!world.apiPermissions) return null
  const config = world.apiPermissions[api]
  if (!config) return null

  const sessionPermissionsMap = new Map<string, string>(Object.entries(world.sessionPermissions ?? {}))
  const sessionDecision = world.sessionPermissions?.[api]

  // Compute the scalar cost estimate up front — we need it both to evaluate
  // the threshold AND to keep an "approved but expensive" call honest.
  const estimatedCostUsd = estimateApiCostUsd(api, context?.details)

  // ── Rule-based evaluation (layered: user/workspace/project/session) ──────
  // If rules are plumbed in, they supersede the enum-mode path for the
  // allow/deny decision. Spend caps are still enforced via the legacy gate
  // below so the existing sessionSpend/monthlySpend tracking keeps working.
  if (world.permissionRules && world.authUserId) {
    const ruleResult = evaluatePermission(
      {
        userId: world.authUserId,
        workspaceId: world.workspaceId ?? null,
        projectId: world.projectId ?? null,
        conversationId: world.conversationId ?? null,
        api,
        call: {
          prompt: context?.details?.prompt,
          duration: context?.details?.duration,
          model: context?.details?.model,
          resolution: context?.details?.resolution,
          estimatedCostUsd,
        },
      },
      world.permissionRules,
      {
        sessionSpend: config.sessionSpend,
        sessionLimit: config.sessionLimit,
        monthlySpend: config.monthlySpend,
        monthlyLimit: config.monthlyLimit,
      },
    )

    if (ruleResult.action === 'deny') return err(ruleResult.reason)
    if (ruleResult.action === 'allow') {
      // Rule-based allow wins — still honor the per-API single-call threshold
      // as an orthogonal cost guard.
      const threshold =
        config.singleCallCostThreshold ?? (api === 'freesound' || api === 'pixabay' || api === 'unsplash' ? null : 0.5)
      if (threshold === null || estimatedCostUsd <= threshold) return null
      // Fall through to the legacy cost-gate flow to produce the permissionNeeded
      // response with costThresholdExceeded=true.
    } else if (ruleResult.action === 'ask') {
      return {
        success: false,
        error: ruleResult.costTriggered
          ? `Cost approval required: ${api} call estimated at $${estimatedCostUsd.toFixed(2)} exceeds the rule cap.`
          : `Permission required: ${api} usage needs approval.`,
        permissionNeeded: {
          api,
          estimatedCost: API_COST_ESTIMATES[api] ?? 'unknown',
          estimatedCostUsd,
          costThresholdExceeded: ruleResult.costTriggered,
          reason: ruleResult.reason,
          details: context?.details ?? {},
        },
      }
    }
  }

  // Preserve current UX: once approved in session, skip repeated prompts —
  // UNLESS this particular call is above the single-call threshold, in which
  // case the gate re-asks even after a blanket session approval.
  if (config.mode === 'always_ask' && sessionDecision === 'allow') {
    const threshold =
      config.singleCallCostThreshold ?? (api === 'freesound' || api === 'pixabay' || api === 'unsplash' ? null : 0.5)
    if (threshold === null || estimatedCostUsd <= threshold) {
      return null
    }
  }

  const permission = checkPermission(
    world.apiPermissions,
    api,
    API_COST_ESTIMATES[api] ?? 'unknown',
    context?.reason ?? `Agent requested ${API_DISPLAY_NAMES[api]}`,
    context?.details ?? {},
    sessionPermissionsMap,
    { estimatedCostUsd },
  )

  if (permission.action === 'allow') return null
  if (permission.action === 'deny') return err(permission.reason)

  return {
    success: false,
    error: permission.request.costThresholdExceeded
      ? `Cost approval required: ${api} call estimated at $${estimatedCostUsd.toFixed(2)} exceeds your threshold.`
      : `Permission required: ${api} usage needs approval.`,
    permissionNeeded: {
      api,
      estimatedCost: API_COST_ESTIMATES[api] ?? 'unknown',
      estimatedCostUsd,
      costThresholdExceeded: permission.request.costThresholdExceeded,
      reason: permission.request.reason,
      details: context?.details ?? {},
    },
  }
}

/** Check if a media gen provider is enabled. Returns error ToolResult if disabled, null if ok. */
function checkMediaEnabled(world: WorldStateMutable, providerId: string, label: string): ToolResult | null {
  if (world.mediaGenEnabled && world.mediaGenEnabled[providerId] === false) {
    return err(`${label} is disabled in media settings`)
  }
  return null
}

/** Enrich a permission-blocked ToolResult with generation context for the universal confirmation card */
function enrichPermission(
  result: ToolResult,
  context: {
    generationType: import('../types').GenerationType
    prompt?: string
    provider?: string
    availableProviders?: import('../types').GenerationProviderOption[]
    config?: Record<string, any>
    toolArgs?: Record<string, any>
  },
): ToolResult {
  if (result.permissionNeeded) {
    result.permissionNeeded = {
      ...result.permissionNeeded,
      ...context,
    }
  }
  return result
}

// ── Registration & Coverage ──────────────────────────────────────────────────
// All tool implementations are now in explicit handler files under ./tool-handlers/

let registryCoverageChecked = false
const CANONICAL_TOOL_NAMES = new Set(ALL_TOOLS.map((t) => t.name))
let registryCoverageLogged = false
let handlersRegistered = false

export function getToolRegistryStatus(): {
  canonicalCount: number
  explicitCount: number
  defaultBackedCount: number
  explicitTools: string[]
  defaultBackedTools: string[]
  hasDefaultHandler: boolean
} {
  ensureAllHandlersRegistered()
  const canonical = [...CANONICAL_TOOL_NAMES]
  const explicitTools = canonical.filter((name) => toolRegistry.hasExplicit(name))
  const defaultBackedTools = canonical.filter((name) => !toolRegistry.hasExplicit(name))
  return {
    canonicalCount: canonical.length,
    explicitCount: explicitTools.length,
    defaultBackedCount: defaultBackedTools.length,
    explicitTools,
    defaultBackedTools,
    hasDefaultHandler: toolRegistry.hasDefault(),
  }
}

// ── Unified Handler Registration ──────────────────────────────────────────────
// All tool families are now explicitly registered. No legacy fallback needed.

function ensureAllHandlersRegistered(): void {
  if (handlersRegistered) return

  // ── Scene tools ──
  const sceneHandler = createSceneToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...SCENE_TOOL_NAMES], (toolName, args, world, logger) =>
    sceneHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Style tools ──
  const styleHandler = createStyleToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...STYLE_TOOL_NAMES], (toolName, args, world, logger) =>
    styleHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Interaction tools ──
  const interactionHandler = createInteractionToolHandler()
  toolRegistry.registerMany([...INTERACTION_TOOL_NAMES], (toolName, args, world) =>
    interactionHandler(toolName, args, world as WorldStateMutable),
  )

  // ── Audio tools ──
  const audioHandler = createAudioToolHandler({
    checkApiPermission,
    enrichPermission,
  })
  toolRegistry.registerMany([...AUDIO_TOOL_NAMES], (toolName, args, world) =>
    audioHandler(toolName, args, world as WorldStateMutable),
  )

  // ── Image/Video tools ──
  const imageVideoHandler = createImageVideoToolHandler({
    checkMediaEnabled,
    checkApiPermission,
    enrichPermission,
    regenerateHTML,
  })
  toolRegistry.registerMany([...IMAGE_VIDEO_TOOL_NAMES], (toolName, args, world, logger) =>
    imageVideoHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Media-library tools (query / reuse / regenerate / i2i / variation) ──
  const mediaLibraryExtHandler = createMediaLibraryExtHandler({
    checkMediaEnabled,
    checkApiPermission,
    enrichPermission,
    regenerateHTML,
  })
  toolRegistry.registerMany([...MEDIA_LIBRARY_EXT_TOOL_NAMES], (toolName, args, world, logger) =>
    mediaLibraryExtHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Research tools (web search, URL reader) — gated on researchEnabled world flag ──
  const researchHandler = createResearchToolHandler()
  toolRegistry.registerMany([...RESEARCH_TOOL_NAMES], (toolName, args, world) =>
    researchHandler(toolName, args, world as WorldStateMutable),
  )

  // ── Avatar tools ──
  const avatarHandler = createAvatarToolHandler({
    checkMediaEnabled,
    checkApiPermission,
    enrichPermission,
  })
  toolRegistry.registerMany([...AVATAR_TOOL_NAMES], (toolName, args, world) =>
    avatarHandler(toolName, args, world as WorldStateMutable),
  )

  // ── Layer tools ──
  const layerHandler = createLayerToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...LAYER_TOOL_NAMES], (toolName, args, world, logger) =>
    layerHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Chart tools ──
  const chartHandler = createChartToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...CHART_TOOL_NAMES], (toolName, args, world, logger) =>
    chartHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Element tools ──
  const elementHandler = createElementToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...ELEMENT_TOOL_NAMES], (toolName, args, world, logger) =>
    elementHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── AI Layer tools ──
  const aiLayerHandler = createAILayerToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...AI_LAYER_TOOL_NAMES], (toolName, args, world, logger) =>
    aiLayerHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Parenting tools ──
  const parentingHandler = createParentingToolHandler()
  toolRegistry.registerMany([...PARENTING_TOOL_NAMES], (toolName, args, world) =>
    parentingHandler(toolName, args, world as WorldStateMutable),
  )

  // ── Asset/Media tools ──
  const assetMediaHandler = createAssetMediaToolHandler({
    checkApiPermission: checkApiPermission as (
      world: WorldStateMutable,
      api: string,
      context?: { reason?: string; details?: Record<string, any> },
    ) => ToolResult | null,
    regenerateHTML,
  })
  toolRegistry.registerMany([...ASSET_MEDIA_TOOL_NAMES], (toolName, args, world, logger) =>
    assetMediaHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Recording tools ──
  const recordingHandler = createRecordingToolHandler()
  toolRegistry.registerMany([...RECORDING_TOOL_NAMES], (toolName, args, world, logger) =>
    recordingHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Template tools ──
  const templateHandler = createTemplateToolHandler()
  toolRegistry.registerMany([...TEMPLATE_TOOL_NAMES], (toolName, args, world) =>
    templateHandler(toolName, args, world as WorldStateMutable),
  )

  // ── Planning & Export tools ──
  const planningExportHandler = createPlanningExportToolHandler()
  toolRegistry.registerMany([...PLANNING_EXPORT_TOOL_NAMES], (toolName, args, world) =>
    planningExportHandler(toolName, args, world as WorldStateMutable),
  )

  // ── Three.js / World / Model Library / Lottie tools ──
  const threeWorldHandler = createThreeWorldToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...THREE_WORLD_TOOL_NAMES], (toolName, args, world, logger) =>
    threeWorldHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Brand Kit tools ──
  const brandHandler = createBrandToolHandler()
  toolRegistry.registerMany([...BRAND_TOOL_NAMES], (toolName, args, world, logger) =>
    brandHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Motion design tools ──
  const motionHandler = createMotionToolHandler()
  toolRegistry.registerMany([...MOTION_TOOL_NAMES], (toolName, args, _world, logger) =>
    motionHandler(toolName, args as Record<string, unknown>, logger),
  )

  // ── Physics tools ──
  const physicsHandler = createPhysicsToolHandler({ regenerateHTML })
  toolRegistry.registerMany([...PHYSICS_TOOL_NAMES], (toolName, args, world, logger) =>
    physicsHandler(toolName, args, world as WorldStateMutable, logger),
  )

  // ── Skill discovery tools ──
  const skillHandler = createSkillToolHandler()
  toolRegistry.registerMany([...SKILL_TOOL_NAMES], (toolName, args) =>
    skillHandler(toolName, args as Record<string, unknown>),
  )

  // ── Visual feedback tools ──
  toolRegistry.register('capture_frame', async (_toolName, args, w) => {
    const world = w as WorldStateMutable
    const { sceneId, time } = args as { sceneId: string; time?: number }
    const scene = world.scenes.find((s) => s.id === sceneId)
    if (!scene) return { success: false, error: `Scene ${sceneId} not found` }

    // Build a structured description of the scene's visual state
    const layers: string[] = []
    const t = Math.max(0, time ?? 1)

    // Main renderer
    if (scene.sceneType) layers.push(`Main renderer: ${scene.sceneType}`)
    if (scene.svgContent) layers.push(`SVG content: ${scene.svgContent.length} chars`)
    if (scene.canvasCode) layers.push(`Canvas2D code: ${scene.canvasCode.length} chars`)
    if (scene.sceneCode) layers.push(`Scene code (${scene.sceneType}): ${scene.sceneCode.length} chars`)

    // Text overlays
    for (const t of scene.textOverlays ?? []) {
      layers.push(
        `Text overlay "${t.content?.slice(0, 40) ?? ''}" at (${t.x ?? 0}%, ${t.y ?? 0}%) size=${t.size ?? 24}px color=${t.color ?? '#fff'} animation=${t.animation ?? 'none'}`,
      )
    }

    // SVG objects
    for (const obj of scene.svgObjects ?? []) {
      layers.push(
        `SVG object at (${obj.x ?? 0}%, ${obj.y ?? 0}%) width=${obj.width ?? 10}% opacity=${obj.opacity ?? 1}`,
      )
    }

    // AI layers
    for (const ai of scene.aiLayers ?? []) {
      layers.push(
        `AI layer "${ai.type}" at (${Math.round(ai.x ?? 0)}, ${Math.round(ai.y ?? 0)}) ${Math.round(ai.width ?? 0)}x${Math.round(ai.height ?? 0)} opacity=${ai.opacity ?? 1} startAt=${ai.startAt ?? 0}s`,
      )
    }

    // Chart layers
    for (const ch of (scene as any).chartLayers ?? []) {
      layers.push(`Chart "${ch.chartType ?? 'unknown'}" title="${ch.title ?? ''}"`)
    }

    // Video layer
    if (scene.videoLayer?.enabled && scene.videoLayer.src) {
      layers.push(
        `Video layer: ${scene.videoLayer.src.slice(0, 60)} opacity=${scene.videoLayer.opacity ?? 1} trim=${scene.videoLayer.trimStart ?? 0}-${scene.videoLayer.trimEnd ?? 'end'}`,
      )
    }

    // Audio
    if (scene.audioLayer?.enabled) {
      const al = scene.audioLayer
      const parts: string[] = []
      if (al.src) parts.push(`audio: ${al.src.slice(0, 40)}`)
      if ((al as any).tts?.src) parts.push(`TTS narration`)
      if ((al as any).music?.src) parts.push(`background music`)
      if ((al as any).sfx?.length) parts.push(`${(al as any).sfx.length} SFX`)
      if (parts.length) layers.push(`Audio: ${parts.join(', ')}`)
    }

    // Camera motion
    if (scene.cameraMotion?.length) {
      layers.push(`Camera: ${scene.cameraMotion.map((m: any) => m.type).join(' → ')}`)
    }

    // Code-level checks for common issues
    const codeIssues: string[] = []
    const code = scene.sceneCode || scene.canvasCode || scene.svgContent || ''
    if (code.length > 0) {
      if (code.includes('Math.random()') && !code.includes('mulberry32') && scene.sceneType === 'canvas2d') {
        codeIssues.push('Uses Math.random() instead of seeded PRNG — will produce different results each render')
      }
      if (code.includes('setInterval') || code.includes('requestAnimationFrame')) {
        if (!code.includes('clearInterval') && !code.includes('cancelAnimationFrame')) {
          codeIssues.push('Has setInterval/rAF without cleanup — may leak when scene ends')
        }
      }
      if (scene.sceneType === 'svg' && code.includes('<svg') && !code.includes('viewBox')) {
        codeIssues.push('SVG missing viewBox attribute — may not scale correctly')
      }
      if (scene.sceneType === 'd3' && code.includes('d3.event')) {
        codeIssues.push('Uses d3.event (removed in D3 v7) — use event parameter in callbacks instead')
      }
    }

    const description = [
      `Scene "${scene.name}" (${scene.id.slice(0, 8)}…)`,
      `Type: ${scene.sceneType ?? 'svg'} | Duration: ${scene.duration}s | BG: ${scene.bgColor}`,
      `Capture time: ${t}s`,
      (() => {
        const d = resolveProjectDimensions(world.mp4Settings?.aspectRatio, world.mp4Settings?.resolution)
        return `Dimensions: ${d.width}×${d.height}`
      })(),
      '',
      `Layers (${layers.length}):`,
      ...layers.map((l) => `  • ${l}`),
      ...(codeIssues.length > 0
        ? ['', `Code issues (${codeIssues.length}):`, ...codeIssues.map((i) => `  ⚠ ${i}`)]
        : []),
    ].join('\n')

    return {
      success: true,
      affectedSceneId: sceneId,
      data: {
        clientAction: 'capture_frame',
        sceneId,
        time: t,
        description,
        codeIssueCount: codeIssues.length,
      },
    }
  })

  // ── Verify scene tool (self-verification loop) ──
  toolRegistry.register('verify_scene', async (_toolName, args, w) => {
    const world = w as WorldStateMutable
    const { sceneId, time, expectedElements } = args as {
      sceneId: string
      time?: number
      expectedElements?: string[]
    }
    const scene = world.scenes.find((s) => s.id === sceneId)
    if (!scene) return { success: false, error: `Scene ${sceneId} not found` }

    const t = Math.max(0, time ?? 1)
    const issues: string[] = []
    const checks: Record<string, 'pass' | 'warn' | 'fail'> = {}

    // 1. Check scene has content
    const hasMainContent = !!(scene.svgContent || scene.canvasCode || scene.sceneCode || scene.lottieSource)
    const layerCount =
      (scene.svgObjects?.length ?? 0) + (scene.aiLayers?.length ?? 0) + ((scene as any).chartLayers?.length ?? 0)
    const hasLayers = layerCount > 0
    const hasContent = hasMainContent || hasLayers

    if (!hasContent) {
      checks.content = 'fail'
      issues.push('EMPTY: Scene has no content — no code, no layers, no charts. Call add_layer or generate_chart.')
    } else {
      checks.content = 'pass'
    }

    // 2. Check text overlays for potential issues
    const overlays = scene.textOverlays ?? []
    if (overlays.length > 0) {
      const overlapping = overlays.filter((a, i) =>
        overlays.some(
          (b, j) => i !== j && Math.abs((a.y ?? 0) - (b.y ?? 0)) < 5 && Math.abs((a.x ?? 0) - (b.x ?? 0)) < 20,
        ),
      )
      if (overlapping.length > 0) {
        checks.text_layout = 'warn'
        issues.push(`OVERLAP: ${overlapping.length} text overlays may overlap — check positions.`)
      } else {
        checks.text_layout = 'pass'
      }
    }

    // 3. Check palette adherence (if global style has palette)
    const palette = world.globalStyle?.palette
    if (palette && palette.length > 0 && scene.bgColor) {
      const bgInPalette = palette.some((c) => c.toLowerCase() === scene.bgColor.toLowerCase())
      // Background doesn't need to be in palette, but note if it's very different
      checks.palette = bgInPalette ? 'pass' : 'pass' // bg can differ from palette
    }

    // 4. Check audio presence (for Director builds with narration expected)
    const hasAudio = scene.audioLayer?.enabled ?? false
    const hasTTS = !!(scene.audioLayer as any)?.tts?.src
    checks.audio = hasAudio ? 'pass' : 'warn'

    // 5. Check duration sanity
    if (scene.duration < 3) {
      checks.duration = 'warn'
      issues.push(`SHORT: Duration is ${scene.duration}s — minimum recommended is 6s for content scenes.`)
    } else if (scene.duration > 30) {
      checks.duration = 'warn'
      issues.push(`LONG: Duration is ${scene.duration}s — consider splitting into multiple scenes.`)
    } else {
      checks.duration = 'pass'
    }

    // 6. Check expected elements if provided
    if (expectedElements && expectedElements.length > 0) {
      // Build a searchable text from all scene content
      const contentText = [
        scene.name,
        scene.prompt,
        scene.svgContent ?? '',
        scene.canvasCode ?? '',
        scene.sceneCode ?? '',
        ...overlays.map((o) => o.content ?? ''),
        ...(scene.svgObjects ?? []).map((o) => o.prompt ?? ''),
        ...(scene.aiLayers ?? []).map((l) => l.label ?? ''),
        ...((scene as any).chartLayers ?? []).map((c: any) => `${c.name ?? ''} ${c.chartType ?? ''}`),
      ]
        .join(' ')
        .toLowerCase()

      const missing = expectedElements.filter((el) => !contentText.includes(el.toLowerCase()))
      if (missing.length > 0) {
        checks.completeness = 'warn'
        issues.push(
          `MISSING: Expected elements not found in scene content: ${missing.join(', ')}. They may be in generated code — verify visually.`,
        )
      } else {
        checks.completeness = 'pass'
      }
    }

    // Build description of scene state for context
    const layers: string[] = []
    if (scene.sceneType) layers.push(`Main renderer: ${scene.sceneType}`)
    if (scene.svgContent) layers.push(`SVG content: ${scene.svgContent.length} chars`)
    if (scene.canvasCode) layers.push(`Canvas2D code: ${scene.canvasCode.length} chars`)
    if (scene.sceneCode) layers.push(`Scene code (${scene.sceneType}): ${scene.sceneCode.length} chars`)
    for (const overlay of overlays) {
      layers.push(`Text: "${overlay.content?.slice(0, 40) ?? ''}" at (${overlay.x ?? 0}%, ${overlay.y ?? 0}%)`)
    }
    for (const obj of scene.svgObjects ?? []) {
      layers.push(`SVG object at (${obj.x ?? 0}%, ${obj.y ?? 0}%) w:${obj.width ?? 10}%`)
    }
    for (const ai of scene.aiLayers ?? []) {
      layers.push(`AI layer "${ai.type}" "${ai.label}" at (${Math.round(ai.x ?? 0)}, ${Math.round(ai.y ?? 0)})`)
    }
    for (const ch of (scene as any).chartLayers ?? []) {
      layers.push(`Chart "${ch.chartType ?? 'unknown'}" title="${ch.title ?? ''}"`)
    }
    if (hasAudio) layers.push(`Audio: ${hasTTS ? 'TTS narration' : 'audio layer'}`)

    const allPassed = issues.length === 0
    const verdict = allPassed
      ? 'PASS — Scene looks good. Proceed to next scene.'
      : `ISSUES FOUND (${issues.length}) — Fix these before moving on:`

    const report = [
      `── VERIFY: "${scene.name}" (${scene.id.slice(0, 8)}…) at t=${t}s ──`,
      `Type: ${scene.sceneType ?? 'svg'} | Duration: ${scene.duration}s | BG: ${scene.bgColor}`,
      '',
      `Checks: ${Object.entries(checks)
        .map(([k, v]) => `${k}:${v}`)
        .join(' | ')}`,
      '',
      verdict,
      ...issues.map((i) => `  ⚠ ${i}`),
      '',
      `Layers (${layers.length}):`,
      ...layers.map((l) => `  • ${l}`),
    ].join('\n')

    return {
      success: allPassed,
      affectedSceneId: sceneId,
      data: {
        // Trigger client frame capture so verify includes visual feedback alongside structural report
        clientAction: 'capture_frame',
        sceneId,
        time: t,
        report,
        checks,
        issues,
        layerCount: layers.length,
        hasAudio,
        hasTTS,
        sceneType: scene.sceneType,
        duration: scene.duration,
      },
    }
  })

  // ── Pedagogy rubric (Tutor agent signature) ──
  toolRegistry.register('verify_scene_pedagogy', async (_toolName, args, w) => {
    const world = w as WorldStateMutable
    const { sceneId, learningObjective, expectedTakeaway, audienceLevel } = args as {
      sceneId: string
      learningObjective: string
      expectedTakeaway: string
      audienceLevel: 'beginner' | 'intermediate' | 'advanced'
    }
    const scene = world.scenes.find((s) => s.id === sceneId)
    if (!scene) return { success: false, error: `Scene ${sceneId} not found` }

    const lower = (s: string) => (s ?? '').toLowerCase()
    const overlayText = (scene.textOverlays ?? []).map((o) => o.content ?? '').join(' ')
    const narrationText = (scene.audioLayer as any)?.tts?.text ?? ''
    const allText = [
      scene.name ?? '',
      scene.prompt ?? '',
      overlayText,
      narrationText,
      scene.svgContent ?? '',
      scene.canvasCode ?? '',
      scene.sceneCode ?? '',
      (scene as any).reactCode ?? '',
      ...(scene.aiLayers ?? []).map((l) => l.label ?? ''),
    ]
      .join(' ')
      .toLowerCase()

    // Extract meaningful keywords from the objective and takeaway (drop stopwords)
    const STOPWORDS = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'to',
      'of',
      'in',
      'on',
      'at',
      'by',
      'for',
      'with',
      'and',
      'or',
      'but',
      'if',
      'as',
      'it',
      'its',
      'this',
      'that',
      'these',
      'those',
      'how',
      'why',
      'what',
      'when',
      'where',
      'will',
      'would',
      'can',
      'should',
      'from',
      'into',
      'onto',
      'we',
      'you',
      'your',
      'our',
      'their',
      'they',
      'he',
      'she',
      'them',
      'his',
      'her',
      'i',
      'me',
      'my',
    ])
    const keywords = (s: string) =>
      lower(s)
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 3 && !STOPWORDS.has(t))
    const objKeywords = keywords(learningObjective)
    const takeKeywords = keywords(expectedTakeaway)

    const coverage = (kws: string[]) => {
      if (kws.length === 0) return 1
      const hit = kws.filter((k) => allText.includes(k)).length
      return hit / kws.length
    }

    const checks: Record<string, 'pass' | 'warn' | 'fail'> = {}
    const issues: string[] = []
    const suggestions: string[] = []

    // 1) Objective clarity — scene name signals an explicit objective OR the objective is well-reflected in the content
    const nameHasObjective = /objective\s*:/i.test(scene.name ?? '')
    const objectiveCoverage = coverage(objKeywords)
    const objectiveClear = nameHasObjective || objectiveCoverage >= 0.5
    checks.objectiveClear = objectiveClear ? 'pass' : 'fail'
    if (!objectiveClear) {
      issues.push(
        `OBJECTIVE: Scene name "${scene.name}" does not lead with "Objective:" and only ${Math.round(
          objectiveCoverage * 100,
        )}% of objective keywords appear in the scene. Rename the scene to "Objective: <concept>" or ensure the objective's core terms appear in narration/overlays.`,
      )
      suggestions.push(`Rename scene to: "Objective: ${learningObjective.slice(0, 60)}"`)
    }

    // 2) Visual supports the claim — scene has content AND objective keywords show up in visible/audible material
    const hasContent = !!(
      scene.svgContent ||
      scene.canvasCode ||
      scene.sceneCode ||
      (scene as any).reactCode ||
      scene.lottieSource ||
      (scene.aiLayers?.length ?? 0) > 0 ||
      (scene.svgObjects?.length ?? 0) > 0 ||
      ((scene as any).chartLayers?.length ?? 0) > 0
    )
    const visualSupports = hasContent && objectiveCoverage >= 0.33
    checks.visualSupports = visualSupports ? 'pass' : 'warn'
    if (!visualSupports) {
      issues.push(
        `SUPPORT: Visuals + narration cover only ${Math.round(objectiveCoverage * 100)}% of the objective's key terms. ` +
          (hasContent
            ? 'Edit narration or overlays to explicitly reference the objective.'
            : 'Scene has no visual content yet.'),
      )
    }

    // 3) Complexity matches audience — beginner scenes flag heavy jargon, advanced scenes flag basic-only content
    const textForComplexity = [overlayText, narrationText].join(' ').toLowerCase()
    const longWordRatio = (() => {
      const words = textForComplexity.split(/\s+/).filter((w) => w.length > 0)
      if (words.length === 0) return 0
      const long = words.filter((w) => w.replace(/[^a-z]/g, '').length >= 10).length
      return long / words.length
    })()
    let complexityMatches = true
    if (audienceLevel === 'beginner' && longWordRatio > 0.18) {
      complexityMatches = false
      issues.push(
        `COMPLEXITY: ${Math.round(longWordRatio * 100)}% of words are 10+ letters — likely too jargon-heavy for beginner audience. Simplify or gloss technical terms.`,
      )
      suggestions.push('Replace multi-syllabic technical terms with plain-English equivalents or add a brief gloss.')
    }
    if (audienceLevel === 'advanced' && textForComplexity.length > 0 && longWordRatio < 0.04) {
      complexityMatches = false
      issues.push(
        `COMPLEXITY: Content reads as overly introductory for advanced audience — consider adding domain terminology and skipping basics.`,
      )
    }
    checks.complexityMatches = complexityMatches ? 'pass' : 'warn'

    // 4) Takeaway present — expected takeaway keywords appear AND narration is long enough to include a closing thought
    const takeawayCoverage = coverage(takeKeywords)
    const narrationWordCount = narrationText.split(/\s+/).filter(Boolean).length
    const hasTakeaway = takeawayCoverage >= 0.4 || /remember|so[,\s]|in short|the key|bottom line/i.test(narrationText)
    checks.hasTakeaway = hasTakeaway ? 'pass' : 'fail'
    if (!hasTakeaway) {
      issues.push(
        `TAKEAWAY: Expected takeaway keywords appear in only ${Math.round(
          takeawayCoverage * 100,
        )}% of content. Narration is ${narrationWordCount} words. Append a closing line like "So, ${expectedTakeaway}" to narration.`,
      )
      suggestions.push(`Append to narration: "So, ${expectedTakeaway}"`)
    }

    // 5) Duration sanity for teaching — tutor scenes need absorb time
    if (scene.duration < 8) {
      checks.duration = 'warn'
      issues.push(
        `DURATION: ${scene.duration}s is short for a teaching scene — learners need absorb time. Minimum recommended is 8s, ideal 10–16s.`,
      )
    } else {
      checks.duration = 'pass'
    }

    const passed = objectiveClear && hasTakeaway && complexityMatches
    const verdict = passed
      ? 'PASS — Pedagogy rubric met. Proceed to next scene.'
      : `ISSUES FOUND (${issues.length}) — Revise ONCE, then proceed. Do not loop more than once per scene.`

    const report = [
      `── PEDAGOGY VERIFY: "${scene.name}" (${scene.id.slice(0, 8)}…) ──`,
      `Audience: ${audienceLevel} | Duration: ${scene.duration}s`,
      `Objective: ${learningObjective}`,
      `Takeaway: ${expectedTakeaway}`,
      '',
      `Rubric: ${Object.entries(checks)
        .map(([k, v]) => `${k}:${v}`)
        .join(' | ')}`,
      '',
      verdict,
      ...issues.map((i) => `  ⚠ ${i}`),
      ...(suggestions.length > 0 ? ['', 'Suggestions:', ...suggestions.map((s) => `  → ${s}`)] : []),
    ].join('\n')

    return {
      success: passed,
      affectedSceneId: sceneId,
      data: {
        report,
        checks,
        issues,
        suggestions,
        objectiveClear,
        visualSupports,
        complexityMatches,
        hasTakeaway,
        objectiveCoverage: Math.round(objectiveCoverage * 100) / 100,
        takeawayCoverage: Math.round(takeawayCoverage * 100) / 100,
      },
    }
  })

  // ── Timeline / Clip tools ──
  const TIMELINE_TOOL_NAMES = [
    'init_timeline',
    'add_track',
    'place_clip',
    'move_clip',
    'trim_clip',
    'split_clip',
    'remove_clip',
    'set_clip_speed',
    'set_keyframe',
    'remove_keyframe',
    'slip_edit',
    'set_clip_filter',
    'remove_clip_filter',
    'set_clip_blend_mode',
  ] as const

  toolRegistry.registerMany([...TIMELINE_TOOL_NAMES], async (toolName, args, w) => {
    const world = w as WorldStateMutable
    type TL = import('../types').Timeline
    type TK = import('../types').Track
    type CL = import('../types').Clip
    const tl = (): TL | null => world.timeline ?? null
    const ok = (desc: string, data?: unknown): ToolResult => ({
      success: true,
      changes: [{ type: 'project_updated', description: desc }],
      data,
    })
    const fail = (msg: string): ToolResult => ({ success: false, error: msg })

    const setTimeline = (timeline: import('../types').Timeline) => {
      world.timeline = timeline
    }

    switch (toolName) {
      case 'init_timeline': {
        if (tl()) return ok('Timeline already exists', { trackCount: tl()!.tracks.length })
        const tracks: import('../types').Track[] = [
          {
            id: uuidv4(),
            name: 'Main',
            type: 'video',
            clips: [],
            muted: false,
            locked: false,
            position: 0,
          },
        ]
        let acc = 0
        for (const scene of world.scenes) {
          tracks[0].clips.push({
            id: uuidv4(),
            trackId: tracks[0].id,
            sourceType: 'scene',
            sourceId: scene.id,
            label: scene.name || 'Untitled',
            startTime: acc,
            duration: scene.duration,
            trimStart: 0,
            trimEnd: null,
            speed: 1,
            opacity: 1,
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            filters: [],
            keyframes: [],
            transition: null,
          })
          acc += scene.duration
        }
        setTimeline({ tracks })
        return ok(`Timeline initialized with ${tracks[0].clips.length} clips on 1 track`, {
          trackId: tracks[0].id,
          clipCount: tracks[0].clips.length,
        })
      }

      case 'add_track': {
        if (!tl()) return fail('Timeline not initialized. Call init_timeline first.')
        const { type, name } = args as { type: 'video' | 'audio' | 'overlay'; name?: string }
        const id = uuidv4()
        const maxPos = tl()!.tracks.reduce((m: number, t: TK) => Math.max(m, t.position), -1)
        const newTrack: import('../types').Track = {
          id,
          name: name ?? `Track ${tl()!.tracks.length + 1}`,
          type,
          clips: [],
          muted: false,
          locked: false,
          position: maxPos + 1,
        }
        setTimeline({ tracks: [...tl()!.tracks, newTrack] })
        return ok(`Added ${type} track "${newTrack.name}"`, { trackId: id })
      }

      case 'place_clip': {
        if (!tl()) return fail('Timeline not initialized. Call init_timeline first.')
        const { trackId, sourceType, sourceId, label, startTime, duration, trimStart, trimEnd, opacity } = args as any
        const track = tl()!.tracks.find((t) => t.id === trackId)
        if (!track) return fail(`Track ${trackId} not found`)
        if (sourceType === 'scene' && !world.scenes.find((s) => s.id === sourceId)) {
          return fail(`Scene ${sourceId} not found`)
        }
        const id = uuidv4()
        const clip: import('../types').Clip = {
          id,
          trackId,
          sourceType,
          sourceId,
          label: label ?? '',
          startTime: Math.max(0, startTime),
          duration: Math.max(0.1, duration),
          trimStart: trimStart ?? 0,
          trimEnd: trimEnd ?? null,
          speed: 1,
          opacity: opacity ?? 1,
          position: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotation: 0,
          filters: [],
          keyframes: [],
          transition: null,
        }
        setTimeline({
          tracks: tl()!.tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t)),
        })
        return ok(`Placed ${sourceType} clip at ${startTime}s (${duration}s)`, { clipId: id })
      }

      case 'move_clip': {
        if (!tl()) return fail('No timeline')
        const { clipId, toTrackId, startTime } = args as { clipId: string; toTrackId: string; startTime: number }
        let moved: CL | null = null
        const after = tl()!.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => {
            if (c.id === clipId) {
              moved = c
              return false
            }
            return true
          }),
        }))
        if (!moved) return fail(`Clip ${clipId} not found`)
        const updated: CL = { ...(moved as CL), trackId: toTrackId, startTime }
        setTimeline({
          tracks: after.map((t) => (t.id === toTrackId ? { ...t, clips: [...t.clips, updated] } : t)),
        })
        return ok(`Moved clip to track ${toTrackId} at ${startTime}s`)
      }

      case 'trim_clip': {
        if (!tl()) return fail('No timeline')
        const { clipId, trimStart: ts, trimEnd: te, duration: dur } = args as any
        const updates: Partial<import('../types').Clip> = {}
        if (ts != null) updates.trimStart = ts
        if (te !== undefined) updates.trimEnd = te
        if (dur != null) updates.duration = Math.max(0.1, dur)
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
          })),
        })
        return ok(`Trimmed clip ${clipId}`)
      }

      case 'split_clip': {
        if (!tl()) return fail('No timeline')
        const { clipId, atTime } = args as { clipId: string; atTime: number }
        let clip: import('../types').Clip | null = null
        for (const t of tl()!.tracks) {
          const c = t.clips.find((c) => c.id === clipId)
          if (c) {
            clip = c
            break
          }
        }
        if (!clip) return fail(`Clip ${clipId} not found`)
        if (atTime <= 0 || atTime >= clip.duration)
          return fail(`Split time ${atTime}s out of range (0–${clip.duration}s)`)
        const leftId = uuidv4(),
          rightId = uuidv4()
        const left: import('../types').Clip = {
          ...clip,
          id: leftId,
          duration: atTime,
          trimEnd: clip.trimStart + atTime * clip.speed,
          keyframes: clip.keyframes.filter((k) => k.time < atTime),
        }
        const right: import('../types').Clip = {
          ...clip,
          id: rightId,
          startTime: clip.startTime + atTime,
          duration: clip.duration - atTime,
          trimStart: clip.trimStart + atTime * clip.speed,
          keyframes: clip.keyframes.filter((k) => k.time >= atTime).map((k) => ({ ...k, time: k.time - atTime })),
        }
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])),
          })),
        })
        return ok(`Split clip into two at ${atTime}s`, { leftId, rightId })
      }

      case 'remove_clip': {
        if (!tl()) return fail('No timeline')
        const { clipId } = args as { clipId: string }
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) })),
        })
        return ok(`Removed clip ${clipId}`)
      }

      case 'set_clip_speed': {
        if (!tl()) return fail('No timeline')
        const { clipId, speed } = args as { clipId: string; speed: number }
        const s = Math.max(0.25, Math.min(4, speed))
        // Find current clip to recalculate duration
        let foundClip: CL | null = null
        for (const t of tl()!.tracks) {
          const c = t.clips.find((c) => c.id === clipId)
          if (c) {
            foundClip = c
            break
          }
        }
        if (!foundClip) return fail(`Clip ${clipId} not found`)
        // Auto-adjust duration: if source span is known, recalculate
        const oldSpeed = foundClip.speed || 1
        const newDuration = foundClip.duration * (oldSpeed / s)
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (c.id === clipId ? { ...c, speed: s, duration: newDuration } : c)),
          })),
        })
        return ok(`Set clip speed to ${s}x (duration adjusted to ${newDuration.toFixed(1)}s)`)
      }

      case 'set_keyframe': {
        if (!tl()) return fail('No timeline')
        const {
          clipId,
          property,
          time: kfTime,
          value,
          easing,
        } = args as {
          clipId: string
          property: string
          time: number
          value: number
          easing?: string
        }
        const kf: import('../types').Keyframe = {
          time: Math.max(0, kfTime),
          property,
          value,
          easing: easing ?? 'linear',
        }
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => {
              if (c.id !== clipId) return c
              // Remove existing keyframe at same property+time, then add new one
              const filtered = c.keyframes.filter(
                (k) => !(k.property === property && Math.abs(k.time - kfTime) < 0.001),
              )
              return { ...c, keyframes: [...filtered, kf] }
            }),
          })),
        })
        return ok(`Set keyframe: ${property}=${value} at ${kfTime}s (${easing ?? 'linear'})`)
      }

      case 'remove_keyframe': {
        if (!tl()) return fail('No timeline')
        const { clipId, property, time: kfTime } = args as { clipId: string; property: string; time: number }
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => {
              if (c.id !== clipId) return c
              return {
                ...c,
                keyframes: c.keyframes.filter((k) => !(k.property === property && Math.abs(k.time - kfTime) < 0.001)),
              }
            }),
          })),
        })
        return ok(`Removed keyframe: ${property} at ${kfTime}s`)
      }

      case 'slip_edit': {
        if (!tl()) return fail('No timeline')
        const { clipId, offsetSeconds } = args as { clipId: string; offsetSeconds: number }
        let found: CL | null = null
        for (const t of tl()!.tracks) {
          const c = t.clips.find((c) => c.id === clipId)
          if (c) {
            found = c
            break
          }
        }
        if (!found) return fail(`Clip ${clipId} not found`)
        const newTrimStart = Math.max(0, found.trimStart + offsetSeconds)
        const newTrimEnd = found.trimEnd != null ? found.trimEnd + offsetSeconds : null
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (c.id === clipId ? { ...c, trimStart: newTrimStart, trimEnd: newTrimEnd } : c)),
          })),
        })
        return ok(
          `Slip edit: shifted source window by ${offsetSeconds > 0 ? '+' : ''}${offsetSeconds}s (trimStart=${newTrimStart.toFixed(1)}s)`,
        )
      }

      case 'set_clip_filter': {
        if (!tl()) return fail('No timeline')
        const { clipId, filterType, value } = args as { clipId: string; filterType: string; value: number }
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => {
              if (c.id !== clipId) return c
              // Replace existing filter of same type, or add new
              const filters = c.filters.filter((f) => f.type !== filterType)
              filters.push({ type: filterType as any, value })
              return { ...c, filters }
            }),
          })),
        })
        return ok(`Set ${filterType} filter to ${value} on clip`)
      }

      case 'remove_clip_filter': {
        if (!tl()) return fail('No timeline')
        const { clipId, filterType } = args as { clipId: string; filterType: string }
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId ? { ...c, filters: c.filters.filter((f) => f.type !== filterType) } : c,
            ),
          })),
        })
        return ok(`Removed ${filterType} filter from clip`)
      }

      case 'set_clip_blend_mode': {
        if (!tl()) return fail('No timeline')
        const { clipId, blendMode } = args as { clipId: string; blendMode: string }
        setTimeline({
          tracks: tl()!.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (c.id === clipId ? { ...c, blendMode } : c)),
          })),
        })
        return ok(`Set blend mode to "${blendMode}"`)
      }

      default:
        return fail(`Unknown timeline tool: ${toolName}`)
    }
  })

  handlersRegistered = true
}

function ensureRegistryCoverage(): void {
  if (registryCoverageChecked) return
  const unresolved = [...CANONICAL_TOOL_NAMES].filter((name) => !toolRegistry.hasExplicit(name))
  if (unresolved.length > 0) {
    throw new Error(`Tool registry missing explicit handlers for canonical tools: ${unresolved.join(', ')}`)
  }
  if (process.env.NODE_ENV !== 'production' && !registryCoverageLogged) {
    console.info(`[ToolRegistry] All ${CANONICAL_TOOL_NAMES.size} canonical tools are explicitly registered.`)
    registryCoverageLogged = true
  }
  registryCoverageChecked = true
}

export function registerToolHandler(
  toolName: string,
  handler: (
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ) => Promise<ToolResult>,
): void {
  ensureAllHandlersRegistered()
  toolRegistry.register(toolName, (name, args, world, logger) =>
    handler(name, args, world as WorldStateMutable, logger),
  )
}

// Throttle the stale-reservation sweep — once per minute is plenty, and
// keeps us off the hot path for every single tool call.
let lastReservationSweepMs = 0
const RESERVATION_SWEEP_INTERVAL_MS = 60_000

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  world: WorldStateMutable,
  logger?: AgentLogger,
): Promise<ToolResult> {
  ensureAllHandlersRegistered()
  ensureRegistryCoverage()
  if (!CANONICAL_TOOL_NAMES.has(toolName)) {
    return err(`Unknown tool: ${toolName}`)
  }

  // Housekeeping: sweep any budget reservations that never got reconciled
  // (crashed tool handlers, network failures). Running once per minute is a
  // good balance between leak protection and overhead.
  const now = Date.now()
  if (now - lastReservationSweepMs > RESERVATION_SWEEP_INTERVAL_MS) {
    lastReservationSweepMs = now
    try {
      const { sweepStaleReservations } = await import('./budget-tracker')
      const swept = sweepStaleReservations()
      if (swept > 0) logger?.log('budget', `Swept ${swept} stale budget reservation(s)`)
    } catch {
      /* best-effort */
    }
  }

  // Log tool inputs (truncate large string values like code/prompt)
  const inputSummary: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v.length > 150) {
      inputSummary[k] = `${v.slice(0, 150)}… [${v.length} chars]`
    } else {
      inputSummary[k] = v
    }
  }
  logger?.log('tool_exec', `executeTool(${toolName})`, inputSummary)

  // Run pre-tool hooks (can deny or modify args)
  const preResult = await runPreToolHooks({ toolName, args, world }, logger)
  if (preResult.deny) {
    return err(`Hook denied: ${preResult.reason ?? 'blocked by pre-tool hook'}`)
  }
  const finalArgs = preResult.modifiedArgs ?? args

  // Snapshot before every execution for undo/recovery
  const preSnapshot = createSnapshot(world, `before:${toolName}`)

  const timeoutMs = GENERATION_TOOL_SET.has(toolName) ? GENERATION_TOOL_TIMEOUT_MS : TOOL_TIMEOUT_MS
  const startMs = Date.now()
  let result: ToolResult
  try {
    let timer: ReturnType<typeof setTimeout>
    result = await Promise.race([
      toolRegistry.execute(toolName, finalArgs, world, logger),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ]).finally(() => clearTimeout(timer!))
  } catch (thrown) {
    // Rollback world state to the pre-execution snapshot so partial
    // mutations from a failed/timed-out tool don't persist.
    restoreSnapshot(world, preSnapshot)
    const message = thrown instanceof Error ? thrown.message : String(thrown)
    logger?.error('tool_exec', `Tool ${toolName} threw: ${message}`)
    result = { success: false, error: `Tool ${toolName} failed: ${message}` }
  }
  const durationMs = Date.now() - startMs
  recordToolResult(toolName, result.success)

  // Auto-validate after generation tools — append quick checks to the result
  // so the agent gets immediate feedback without needing a separate verify_scene call.
  if (result.success && result.affectedSceneId && GENERATION_TOOL_SET.has(toolName)) {
    const scene = world.scenes.find((s) => s.id === result.affectedSceneId)
    if (scene) {
      const warnings = quickValidateScene(scene)
      if (warnings.length > 0) {
        result.data = {
          ...(typeof result.data === 'object' && result.data !== null ? result.data : {}),
          _autoValidation: {
            status: 'warnings',
            issues: warnings,
            hint: 'Fix these issues with patch_layer_code or regenerate_layer, then call verify_scene.',
          },
        }
        logger?.warn('auto_validate', `${toolName} succeeded but scene has issues`, {
          sceneId: result.affectedSceneId,
          warnings,
        })
      }
    }
  }

  // Run post-tool hooks (can augment or flag results)
  return runPostToolHooks({ toolName, args: finalArgs, result, world, durationMs }, logger)
}

// ── HTML Regeneration ─────────────────────────────────────────────────────────

async function regenerateHTML(
  world: WorldStateMutable,
  sceneId: string,
  logger?: AgentLogger,
): Promise<{ htmlWritten: boolean }> {
  const scene = findScene(world, sceneId)
  if (!scene) return { htmlWritten: false }
  // Sanitize sceneId to prevent path traversal — must match the same
  // pattern enforced in app/api/scene/route.ts POST handler.
  if (!SCENE_ID_RE.test(sceneId)) {
    logger?.error('html', `Invalid sceneId rejected: ${sceneId}`)
    return { htmlWritten: false }
  }
  try {
    const start = Date.now()
    const html = generateSceneHTML(
      scene,
      world.globalStyle,
      undefined,
      undefined,
      resolveProjectDimensions(world.mp4Settings?.aspectRatio, world.mp4Settings?.resolution),
    )
    updateScene(world, sceneId, { sceneHTML: html })
    // Write to disk immediately so preview iframes can load the latest content
    const scenesDir = path.join(process.cwd(), 'public', 'scenes')
    await fs.mkdir(scenesDir, { recursive: true })
    // Atomic write: write to temp file then rename to prevent partial HTML
    // from concurrent tool calls writing to the same scene
    const finalPath = path.join(scenesDir, `${sceneId}.html`)
    const tmpPath = path.join(scenesDir, `${sceneId}.tmp.${Date.now()}.html`)
    await fs.writeFile(tmpPath, html, 'utf-8')
    await fs.rename(tmpPath, finalPath)
    const durationMs = Date.now() - start
    logger?.log('html', `Wrote ${sceneId}.html`, { sceneId, htmlLength: html.length, durationMs })
    return { htmlWritten: true }
  } catch (e) {
    logger?.error('html', `HTML regeneration failed for ${sceneId}: ${(e as Error).message}`)
    console.error('[ToolExecutor] HTML regeneration failed:', e)
    return { htmlWritten: false }
  }
}

// ── Layer Generation ──────────────────────────────────────────────────────────

interface GenerationResult {
  success: boolean
  code?: string
  error?: string
}

export async function generateLayerContent(
  layerType: SceneType,
  prompt: string,
  scene: Scene,
  globalStyle: GlobalStyle,
  modelId?: string,
  modelTier?: 'auto' | 'premium' | 'budget',
  logger?: AgentLogger,
  modelConfigs?: import('./model-config').ModelConfig[],
): Promise<GenerationResult> {
  try {
    const resolved = resolveStyle(globalStyle.presetId, globalStyle)
    logger?.log('generation', `Generating ${layerType} code`, { layerType, promptLength: prompt.length, modelId })
    const genStart = Date.now()
    const hasPreset = globalStyle.presetId != null
    const result = await generateCode(layerType, prompt, {
      palette: hasPreset ? resolved.palette : undefined,
      bgColor: scene.bgColor,
      duration: scene.duration,
      font: hasPreset ? resolved.font : undefined,
      strokeWidth: globalStyle.strokeWidth ?? 2,
      d3Data: scene.d3Data ?? undefined,
      modelId,
      modelTier,
      modelConfigs,
    })
    const genMs = Date.now() - genStart

    // Basic validation: ensure we got non-trivial code
    const code = result.code?.trim() ?? ''
    logger?.log('generation', `Generation complete`, {
      layerType,
      durationMs: genMs,
      codeLength: code.length,
      inputTokens: result.usage?.input_tokens,
      outputTokens: result.usage?.output_tokens,
    })
    if (!code) {
      logger?.warn('generation', 'Generation returned empty code')
      return { success: false, error: 'Generation returned empty code — please retry' }
    }
    if (result.truncated) {
      logger?.warn(
        'generation',
        `Generation was truncated (${result.usage?.output_tokens} tokens) — code is incomplete`,
      )
      return {
        success: false,
        error: 'Scene code was too long and got cut off — try a simpler prompt or break into multiple scenes',
      }
    }
    if (layerType === 'svg' && !code.includes('<svg')) {
      logger?.warn('generation', `SVG generation missing <svg> tag (length=${code.length})`)
    }

    return { success: true, code }
  } catch (e) {
    logger?.error('generation', `Generation failed: ${String(e)}`)
    return { success: false, error: `Generation failed: ${String(e)}` }
  }
}

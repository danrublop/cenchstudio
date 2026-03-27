/**
 * Builds agent context including system prompts, world state summaries,
 * and filtered tool lists — all within token budget constraints.
 */

import type { Scene, GlobalStyle } from '../types'
import type {
  AgentType, ContextOpts, AgentContext, WorldState, SceneSummary, ModelId, ModelTier, ClaudeToolDefinition,
} from './types'
import { getAgentPrompt } from './prompts'
import { ALL_TOOLS, AGENT_TOOLS } from './tools'

// Token budget constants
const MAX_WORLD_STATE_TOKENS = 2000
const MAX_FULL_SCENE_TOKENS = 3000
const MAX_HISTORY_MESSAGES = 10

const MODEL_DEFAULTS: Record<AgentType, ModelId> = {
  router: 'claude-haiku-4-5-20251001',
  director: 'claude-sonnet-4-5-20250514',
  'scene-maker': 'claude-sonnet-4-5-20250514',
  editor: 'claude-haiku-4-5-20251001',
  dop: 'claude-haiku-4-5-20251001',
}

/** Model assignments per tier */
const MODEL_TIERS: Record<ModelTier, Record<AgentType, ModelId>> = {
  auto: MODEL_DEFAULTS,
  fast: {
    router: 'claude-haiku-4-5-20251001',
    director: 'claude-haiku-4-5-20251001',
    'scene-maker': 'claude-haiku-4-5-20251001',
    editor: 'claude-haiku-4-5-20251001',
    dop: 'claude-haiku-4-5-20251001',
  },
  balanced: {
    router: 'claude-haiku-4-5-20251001',
    director: 'claude-sonnet-4-5-20250514',
    'scene-maker': 'claude-sonnet-4-5-20250514',
    editor: 'claude-sonnet-4-5-20250514',
    dop: 'claude-sonnet-4-5-20250514',
  },
  performance: {
    router: 'claude-haiku-4-5-20251001',
    director: 'claude-opus-4-5-20250514',
    'scene-maker': 'claude-opus-4-5-20250514',
    editor: 'claude-sonnet-4-5-20250514',
    dop: 'claude-sonnet-4-5-20250514',
  },
}

/** Resolve model for an agent given tier and optional explicit override */
export function resolveModel(agentType: AgentType, tier: ModelTier, explicitOverride?: ModelId | null): ModelId {
  if (explicitOverride) return explicitOverride
  return MODEL_TIERS[tier]?.[agentType] ?? MODEL_DEFAULTS[agentType]
}

const MAX_TOKENS_BY_AGENT: Record<AgentType, number> = {
  router: 20,        // returns only the agent name
  director: 8192,
  'scene-maker': 12288,
  editor: 4096,
  dop: 4096,
}

// ── Scene Helpers ─────────────────────────────────────────────────────────────

/** A scene is "empty" if it has no content — no prompt, no code, no layers */
function isEmptyScene(scene: Scene): boolean {
  return !scene.prompt &&
    !scene.svgContent &&
    !scene.canvasCode &&
    !scene.sceneCode &&
    !scene.lottieSource &&
    (scene.svgObjects?.length ?? 0) === 0 &&
    (scene.aiLayers?.length ?? 0) === 0 &&
    (scene.textOverlays?.length ?? 0) === 0
}

// ── Scene Summarization ────────────────────────────────────────────────────────

function summarizeScene(scene: Scene): SceneSummary {
  return {
    id: scene.id,
    name: scene.name || '(untitled)',
    prompt: scene.prompt,
    summary: scene.summary,
    sceneType: scene.sceneType,
    duration: scene.duration,
    bgColor: scene.bgColor,
    layerCount: (scene.svgObjects?.length ?? 0) + (scene.aiLayers?.length ?? 0),
    hasAudio: scene.audioLayer?.enabled ?? false,
    hasVideo: scene.videoLayer?.enabled ?? false,
    transition: scene.transition,
    interactionCount: scene.interactions?.length ?? 0,
  }
}

// ── World State Building ───────────────────────────────────────────────────────

export function buildWorldState(
  scenes: Scene[],
  globalStyle: GlobalStyle,
  projectName: string,
  outputMode: 'mp4' | 'interactive',
  focusedSceneId: string | null,
): WorldState {
  // Skip empty scenes from context so they don't confuse the agent
  const nonEmptyScenes = scenes.filter(s => !isEmptyScene(s))
  const summaries = nonEmptyScenes.map(summarizeScene)
  const totalDuration = nonEmptyScenes.reduce((a, s) => a + s.duration, 0)
  const focusedScene = focusedSceneId ? scenes.find(s => s.id === focusedSceneId) ?? null : null

  return {
    projectName,
    outputMode,
    globalStyle,
    sceneCount: nonEmptyScenes.length,
    totalDuration,
    scenes: summaries,
    focusedScene,
  }
}

// ── World State Serialization ──────────────────────────────────────────────────

function serializeGlobalStyle(style: GlobalStyle): string {
  return `Global Style:
  palette: [${style.palette.join(', ')}]
  font: ${style.font}
  strokeWidth: ${style.strokeWidth}
  theme: ${style.theme}
  defaultDuration: ${style.duration}s`
}

function serializeSceneSummary(s: SceneSummary, index: number): string {
  const parts = [`[${index}] "${s.name}" (${s.id})`]
  parts.push(`  type:${s.sceneType} dur:${s.duration}s bg:${s.bgColor} transition:${s.transition}`)
  if (s.prompt) parts.push(`  prompt: ${s.prompt.slice(0, 100)}`)
  if (s.summary) parts.push(`  summary: ${s.summary.slice(0, 100)}`)
  if (s.layerCount > 0) parts.push(`  layers: ${s.layerCount}`)
  if (s.hasAudio) parts.push(`  audio: yes`)
  if (s.hasVideo) parts.push(`  video: yes`)
  if (s.interactionCount > 0) parts.push(`  interactions: ${s.interactionCount}`)
  return parts.join('\n')
}

function serializeFullScene(scene: Scene): string {
  const parts: string[] = []
  parts.push(`FOCUSED SCENE: "${scene.name}" (${scene.id})`)
  parts.push(`  type: ${scene.sceneType}`)
  parts.push(`  duration: ${scene.duration}s`)
  parts.push(`  bgColor: ${scene.bgColor}`)
  parts.push(`  transition: ${scene.transition}`)
  parts.push(`  prompt: ${scene.prompt}`)

  if (scene.textOverlays?.length > 0) {
    parts.push(`  textOverlays (${scene.textOverlays.length}):`)
    scene.textOverlays.forEach(o => {
      parts.push(`    - (${o.id}) "${o.content}" font:${o.font} size:${o.size} color:${o.color} pos:(${o.x}%,${o.y}%) anim:${o.animation} delay:${o.delay}s dur:${o.duration}s`)
    })
  }

  if (scene.svgObjects?.length > 0) {
    parts.push(`  svgObjects (${scene.svgObjects.length}):`)
    scene.svgObjects.forEach(o => {
      parts.push(`    - (${o.id}) prompt:"${o.prompt.slice(0, 60)}" pos:(${o.x}%,${o.y}%) w:${o.width}% opacity:${o.opacity} z:${o.zIndex}`)
      // Include code preview for surgical edits
      const codeSnippet = (scene.sceneType === 'svg' ? o.svgContent : '')
      if (codeSnippet) {
        // Only include first 500 chars of code to stay within token budget
        parts.push(`      code preview: ${codeSnippet.slice(0, 500)}${codeSnippet.length > 500 ? '...' : ''}`)
      }
    })
  }

  if (scene.aiLayers?.length > 0) {
    parts.push(`  aiLayers (${scene.aiLayers.length}):`)
    scene.aiLayers.forEach(l => {
      parts.push(`    - (${l.id}) type:${l.type} status:${l.status} label:"${l.label}"`)
    })
  }

  if (scene.interactions?.length > 0) {
    parts.push(`  interactions (${scene.interactions.length}):`)
    scene.interactions.forEach(el => {
      parts.push(`    - (${el.id}) type:${el.type} pos:(${el.x}%,${el.y}%) appearsAt:${el.appearsAt}s`)
    })
  }

  // Include scene code for canvas/d3/three/motion for patching
  const codeField = scene.sceneType === 'canvas2d' ? scene.canvasCode
    : scene.sceneType === 'd3' || scene.sceneType === 'three' || scene.sceneType === 'motion' ? scene.sceneCode
    : ''
  if (codeField) {
    const preview = codeField.slice(0, 800)
    parts.push(`  ${scene.sceneType} code preview:\n${preview}${codeField.length > 800 ? '\n  ... (truncated)' : ''}`)
  }

  return parts.join('\n')
}

export function serializeWorldState(world: WorldState): string {
  const parts: string[] = []
  parts.push(`PROJECT: "${world.projectName}"`)
  parts.push(`mode: ${world.outputMode} | scenes: ${world.sceneCount} | total: ${world.totalDuration}s`)
  parts.push('')
  parts.push(serializeGlobalStyle(world.globalStyle))
  parts.push('')
  parts.push(`SCENES:`)
  world.scenes.forEach((s, i) => parts.push(serializeSceneSummary(s, i)))

  if (world.focusedScene) {
    parts.push('')
    parts.push(serializeFullScene(world.focusedScene))
  }

  const raw = parts.join('\n')
  // Hard cap to stay within token budget (rough 4 chars per token estimate)
  const maxChars = MAX_WORLD_STATE_TOKENS * 4 + (world.focusedScene ? MAX_FULL_SCENE_TOKENS * 4 : 0)
  return raw.length > maxChars ? raw.slice(0, maxChars) + '\n... (state truncated)' : raw
}

// ── Tool Filtering ─────────────────────────────────────────────────────────────

function filterToolsForAgent(agentType: AgentType, activeTools: string[]): ClaudeToolDefinition[] {
  const agentTools = AGENT_TOOLS[agentType] ?? ALL_TOOLS

  // If no filter active, return all agent tools
  if (!activeTools || activeTools.length === 0) return agentTools

  // The 'add_layer' tool is conditionally available based on layer type filters
  const allowedLayerTypes = new Set<string>()
  if (activeTools.includes('svg')) allowedLayerTypes.add('svg')
  if (activeTools.includes('canvas2d')) allowedLayerTypes.add('canvas2d')
  if (activeTools.includes('d3')) allowedLayerTypes.add('d3')
  if (activeTools.includes('three')) allowedLayerTypes.add('three')
  if (activeTools.includes('lottie')) allowedLayerTypes.add('lottie')
  if (activeTools.includes('motion')) allowedLayerTypes.add('motion')

  // Filter tools based on active tool categories
  return agentTools.filter(tool => {
    // These are always available
    if (['create_scene', 'delete_scene', 'duplicate_scene', 'reorder_scenes',
      'set_scene_duration', 'set_scene_background', 'set_transition',
      'remove_layer', 'reorder_layer', 'set_layer_opacity', 'set_layer_visibility',
      'set_layer_timing', 'regenerate_layer', 'patch_layer_code',
      'add_element', 'edit_element', 'delete_element', 'move_element',
      'resize_element', 'reorder_element', 'adjust_element_timing',
      'set_global_style', 'set_all_transitions', 'set_roughness_all', 'plan_scenes',
      'export_mp4', 'publish_interactive'].includes(tool.name)) {
      return true
    }

    // Conditionally filtered tools
    if (tool.name === 'add_layer' && allowedLayerTypes.size === 0) return false
    if (tool.name === 'search_images' || tool.name === 'place_image') return activeTools.includes('assets')
    if (tool.name === 'set_audio_layer') return activeTools.includes('audio')
    if (tool.name === 'set_video_layer') return activeTools.includes('video')
    if (['add_interaction', 'edit_interaction', 'connect_scenes'].includes(tool.name)) return activeTools.includes('interactions')

    return true
  })
}

// ── Context Builder ────────────────────────────────────────────────────────────

/**
 * Build the complete AgentContext for an agent execution.
 */
export function buildAgentContext(
  agentType: AgentType,
  opts: ContextOpts,
  scenes: Scene[],
  globalStyle: GlobalStyle,
  projectName: string,
  outputMode: 'mp4' | 'interactive',
  modelOverride?: ModelId | null,
  modelTier?: ModelTier,
): AgentContext {
  // Determine focused scene
  let focusedSceneId: string | null = null

  // 'auto' scene context: director gets all scenes, editor/scene-maker get selected
  const effectiveSceneContext = opts.sceneContext === 'auto'
    ? (agentType === 'director' || agentType === 'dop' ? 'all' : 'selected')
    : opts.sceneContext

  if (effectiveSceneContext === 'selected' || opts.focusedSceneId) {
    focusedSceneId = opts.focusedSceneId ?? null
  } else if (effectiveSceneContext !== 'all' && effectiveSceneContext) {
    // Treat as a specific scene ID
    focusedSceneId = effectiveSceneContext
  }

  const worldState = buildWorldState(scenes, globalStyle, projectName, outputMode, focusedSceneId)
  const worldStateSerialized = serializeWorldState(worldState)

  const basePrompt = getAgentPrompt(agentType)
  const systemPrompt = `${basePrompt}

## Current World State
\`\`\`
${worldStateSerialized}
\`\`\``

  const tools = filterToolsForAgent(agentType, opts.activeTools)
  const modelId = resolveModel(agentType, modelTier ?? 'auto', modelOverride)
  const maxTokens = MAX_TOKENS_BY_AGENT[agentType]

  return {
    systemPrompt,
    worldState,
    tools,
    maxTokens,
    modelId,
  }
}

/**
 * Build the minimal context for the router agent (just system prompt + world summary).
 */
export function buildRouterContext(
  scenes: Scene[],
  globalStyle: GlobalStyle,
  projectName: string,
  outputMode: 'mp4' | 'interactive',
): { systemPrompt: string; modelId: ModelId; maxTokens: number } {
  const world = buildWorldState(scenes, globalStyle, projectName, outputMode, null)
  const summary = `Project: "${world.projectName}" | ${world.sceneCount} scenes | ${world.totalDuration}s | mode: ${world.outputMode}`

  return {
    systemPrompt: `${getAgentPrompt('router')}\n\nWorld state: ${summary}`,
    modelId: 'claude-haiku-4-5-20251001',
    maxTokens: 20,
  }
}

/**
 * Trim message history to last N messages to stay within context limits.
 */
export function trimHistory(history: Array<{ role: string; content: string }>) {
  return history.slice(-MAX_HISTORY_MESSAGES)
}

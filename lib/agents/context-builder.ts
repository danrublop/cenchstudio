/**
 * Builds agent context including system prompts, world state summaries,
 * and filtered tool lists — all within token budget constraints.
 */

import type { Scene, GlobalStyle } from '../types'
import type {
  AgentType,
  ContextOpts,
  AgentContext,
  WorldState,
  SceneSummary,
  ModelId,
  ModelTier,
  ThinkingMode,
  ClaudeToolDefinition,
  Storyboard,
  CompactionConfig,
} from './types'
import { getAgentPrompt } from './prompts'
import { getModelProvider } from './types'
import { resolveStyle, getPreset, type StylePresetId } from '../styles/presets'
import { ALL_TOOLS, AGENT_TOOLS } from './tools'
import { AUDIO_PROVIDERS } from '../audio/provider-registry'
import { MEDIA_PROVIDERS } from '../media/provider-registry'
import { DEFAULT_MODELS, type ModelConfig } from './model-config'

// Token budget constants
const MAX_WORLD_STATE_TOKENS = 2000
const MAX_FULL_SCENE_TOKENS = 3000
const MAX_HISTORY_MESSAGES = 20

const MODEL_DEFAULTS: Record<AgentType, ModelId> = {
  router: 'claude-haiku-4-5-20251001',
  director: 'claude-sonnet-4-6',
  planner: 'claude-sonnet-4-6',
  'scene-maker': 'claude-sonnet-4-6',
  editor: 'claude-haiku-4-5-20251001',
  dop: 'claude-haiku-4-5-20251001',
}

/** Model assignments per tier */
const MODEL_TIERS: Record<ModelTier, Record<AgentType, ModelId>> = {
  auto: MODEL_DEFAULTS,
  premium: {
    router: 'claude-haiku-4-5-20251001',
    director: 'claude-opus-4-6',
    planner: 'claude-opus-4-6',
    'scene-maker': 'claude-opus-4-6',
    editor: 'claude-sonnet-4-6',
    dop: 'claude-sonnet-4-6',
  },
  budget: {
    router: 'claude-haiku-4-5-20251001',
    director: 'claude-haiku-4-5-20251001',
    planner: 'claude-haiku-4-5-20251001',
    'scene-maker': 'claude-haiku-4-5-20251001',
    editor: 'claude-haiku-4-5-20251001',
    dop: 'claude-haiku-4-5-20251001',
  },
}

/** Provider-specific tier preferences for multi-provider fallback */
const PROVIDER_TIER_PREFERENCES: Record<'budget' | 'balanced' | 'premium', Record<string, ModelId[]>> = {
  budget: {
    anthropic: ['claude-haiku-4-5-20251001'],
    openai: ['gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4o-mini'],
    google: ['gemini-2.5-flash-preview-05-20'],
  },
  balanced: {
    anthropic: ['claude-sonnet-4-6', 'claude-3-5-sonnet-20241022'],
    openai: ['gpt-4.1', 'gpt-4o', 'o3-mini'],
    google: ['gemini-2.5-pro-preview-05-06'],
  },
  premium: {
    anthropic: ['claude-opus-4-6'],
    openai: ['o1', 'o3-mini'],
    google: ['gemini-2.5-pro-preview-05-06'],
  },
}

/** Look up a model's quality tier from the model config registry.
 *  Falls back to 'balanced' if the model isn't found. */
function getModelQualityTier(modelId: ModelId, modelConfigs?: ModelConfig[]): 'budget' | 'balanced' | 'premium' {
  const configs = modelConfigs ?? DEFAULT_MODELS
  const config = configs.find((m) => m.modelId === modelId)
  if (!config) return 'balanced'
  if (config.tier === 'budget') return 'budget'
  if (config.tier === 'performance') return 'premium'
  return 'balanced' // 'balanced' and 'custom' both map to balanced
}

/** Check if a model supports tool use (required for agent execution).
 *  Returns true if the model isn't in the registry (assume it supports tools). */
function modelSupportsTools(modelId: string, modelConfigs?: ModelConfig[]): boolean {
  const configs = modelConfigs ?? DEFAULT_MODELS
  const config = configs.find((m) => m.modelId === modelId)
  return config?.supportsTools ?? true
}

/** Resolve model for an agent given tier and optional explicit override.
 *  If enabledModelIds is provided, validates that the resolved model is enabled.
 *  Falls back to a same-tier model from another provider if the default is disabled.
 *  Models that don't support tools are excluded from fallback candidates. */
export function resolveModel(
  agentType: AgentType,
  tier: ModelTier,
  explicitOverride?: ModelId | null,
  enabledModelIds?: string[],
  modelConfigs?: ModelConfig[],
): ModelId {
  // Normalize: treat 'auto' as no override
  const override = explicitOverride && explicitOverride !== 'auto' ? explicitOverride : null

  // Filter enabled models to only those that support tools
  const toolCapableIds = enabledModelIds?.filter((id) => modelSupportsTools(id, modelConfigs))

  const tierResolved = MODEL_TIERS[tier]?.[agentType] ?? MODEL_DEFAULTS[agentType]

  // If override provided, validate it's enabled and supports tools before using.
  // For local models, the override may be the model `id` (e.g. "ollama-llama3") while
  // enabledModelIds contains `modelId` (e.g. "llama3.1:8b") — check both.
  const overrideIsEnabled =
    !toolCapableIds ||
    toolCapableIds.length === 0 ||
    toolCapableIds.includes(override ?? '') ||
    (modelConfigs ?? []).some(
      (m) => (m.id === override || m.modelId === override) && toolCapableIds.includes(m.modelId),
    )
  const resolved = override && overrideIsEnabled ? override : tierResolved

  // If no enabled list provided, trust the resolved model
  if (!toolCapableIds || toolCapableIds.length === 0) return resolved

  // If the resolved model is in the tool-capable enabled list, use it
  if (toolCapableIds.includes(resolved)) return resolved

  // Determine the effective quality tier using model registry instead of string matching
  const qualityTier = getModelQualityTier(tierResolved, modelConfigs)

  // Try same-quality-tier models from all providers
  const preferences = PROVIDER_TIER_PREFERENCES[qualityTier]
  for (const providerModels of Object.values(preferences)) {
    for (const modelId of providerModels) {
      if (toolCapableIds.includes(modelId)) return modelId
    }
  }

  // Final fallback: first tool-capable enabled model
  return (toolCapableIds[0] as ModelId) ?? resolved
}

const MAX_TOKENS_BY_AGENT: Record<AgentType, number> = {
  router: 20, // returns only the agent name
  director: 16384, // needs headroom for multi-scene planning + tool calls
  planner: 12288, // rich storyboard JSON with narration drafts + new fields
  'scene-maker': 12288,
  editor: 4096,
  dop: 4096,
}

/** Thinking budget tokens per mode */
export const THINKING_BUDGETS: Record<ThinkingMode, number> = {
  off: 0,
  adaptive: 5000,
  deep: 16000,
}

/** Ensure max_tokens > budget_tokens when thinking is enabled */
function resolveMaxTokensForThinking(baseMaxTokens: number, thinkingMode: ThinkingMode): number {
  if (thinkingMode === 'off') return baseMaxTokens
  const budget = THINKING_BUDGETS[thinkingMode]
  // max_tokens must be greater than budget_tokens; add headroom for the actual response
  return Math.max(baseMaxTokens, budget + 4000)
}

// ── Scene Helpers ─────────────────────────────────────────────────────────────

/** A scene is "empty" if it has no content — no prompt, no code, no layers */
function isEmptyScene(scene: Scene): boolean {
  return (
    !scene.prompt &&
    !scene.svgContent &&
    !scene.canvasCode &&
    !(scene.canvasBackgroundCode && scene.canvasBackgroundCode.trim()) &&
    !scene.sceneCode &&
    !scene.lottieSource &&
    (scene.svgObjects?.length ?? 0) === 0 &&
    (scene.aiLayers?.length ?? 0) === 0 &&
    (scene.textOverlays?.length ?? 0) === 0
  )
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
  const nonEmptyScenes = scenes.filter((s) => !isEmptyScene(s))
  const summaries = nonEmptyScenes.map(summarizeScene)
  const totalDuration = nonEmptyScenes.reduce((a, s) => a + s.duration, 0)
  const focusedScene = focusedSceneId ? (scenes.find((s) => s.id === focusedSceneId) ?? null) : null

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
  const resolved = resolveStyle(style.presetId, style)
  const palette = resolved.palette
  const font = resolved.font
  return `Global Style:
  preset: ${style.presetId ?? 'none (custom)'}
  palette: [${palette.join(', ')}]
  font: ${font}
  roughness: ${resolved.roughnessLevel}
  tool: ${resolved.defaultTool}
  renderer: ${resolved.preferredRenderer}`
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
  if (s.sceneType === 'd3' && (s as any).chartLayers?.length) parts.push(`  charts: ${(s as any).chartLayers.length}`)
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
    scene.textOverlays.forEach((o) => {
      parts.push(
        `    - (${o.id}) "${o.content}" font:${o.font} size:${o.size} color:${o.color} pos:(${o.x}%,${o.y}%) anim:${o.animation} delay:${o.delay}s dur:${o.duration}s`,
      )
    })
  }

  if (scene.svgObjects?.length > 0) {
    parts.push(`  svgObjects (${scene.svgObjects.length}):`)
    scene.svgObjects.forEach((o) => {
      parts.push(
        `    - (${o.id}) prompt:"${o.prompt.slice(0, 60)}" pos:(${o.x}%,${o.y}%) w:${o.width}% opacity:${o.opacity} z:${o.zIndex}`,
      )
      // Include code preview for surgical edits
      const codeSnippet = scene.sceneType === 'svg' ? o.svgContent : ''
      if (codeSnippet) {
        // Only include first 500 chars of code to stay within token budget
        parts.push(`      code preview: ${codeSnippet.slice(0, 500)}${codeSnippet.length > 500 ? '...' : ''}`)
      }
    })
  }

  if (scene.aiLayers?.length > 0) {
    parts.push(`  aiLayers (${scene.aiLayers.length}):`)
    scene.aiLayers.forEach((l) => {
      parts.push(`    - (${l.id}) type:${l.type} status:${l.status} label:"${l.label}"`)
    })
  }

  if (scene.interactions?.length > 0) {
    parts.push(`  interactions (${scene.interactions.length}):`)
    scene.interactions.forEach((el) => {
      parts.push(`    - (${el.id}) type:${el.type} pos:(${el.x}%,${el.y}%) appearsAt:${el.appearsAt}s`)
    })
  }

  if (scene.sceneType === 'd3' && (scene.chartLayers?.length ?? 0) > 0) {
    parts.push(`  chartLayers (${scene.chartLayers!.length}):`)
    scene.chartLayers!.forEach((c) => {
      const pointCount = Array.isArray(c.data) ? c.data.length : c.data ? 1 : 0
      parts.push(
        `    - (${c.id}) ${c.name} type:${c.chartType} dataPoints:${pointCount} layout:(${c.layout.x}%,${c.layout.y}%,${c.layout.width}%,${c.layout.height}%) animated:${c.timing.animated}`,
      )
    })
  }

  // Include scene code for canvas/d3/three/motion for patching
  const codeField =
    scene.sceneType === 'canvas2d'
      ? scene.canvasCode
      : scene.sceneType === 'svg'
        ? scene.svgContent
        : scene.sceneType === 'lottie'
          ? scene.lottieSource
          : scene.sceneType === 'react'
            ? scene.reactCode
            : scene.sceneType === 'd3' ||
                scene.sceneType === 'three' ||
                scene.sceneType === 'motion' ||
                scene.sceneType === 'zdog' ||
                scene.sceneType === 'physics'
              ? scene.sceneCode
              : ''
  if (codeField) {
    const preview = codeField.slice(0, 800)
    parts.push(`  ${scene.sceneType} code preview:\n${preview}${codeField.length > 800 ? '\n  ... (truncated)' : ''}`)
  }

  if (scene.canvasBackgroundCode?.trim()) {
    parts.push(
      `  canvasBackgroundCode: [${scene.canvasBackgroundCode.length} chars] (animated canvas behind ${scene.sceneType})`,
    )
  }

  return parts.join('\n')
}

export function serializeWorldState(world: WorldState): string {
  const parts: string[] = []
  parts.push(`PROJECT: "${world.projectName}"`)
  parts.push(`mode: ${world.outputMode} | scenes: ${world.sceneCount} | total: ${world.totalDuration}s`)

  // Scene type distribution for variety awareness
  if (world.scenes.length > 0) {
    const typeCounts = new Map<string, number>()
    world.scenes.forEach((s) => typeCounts.set(s.sceneType, (typeCounts.get(s.sceneType) || 0) + 1))
    const coreTypes = ['svg', 'canvas2d', 'd3', 'motion', 'three', 'lottie', 'zdog'] as const
    const mix = coreTypes.map((t) => `${t}(${typeCounts.get(t) || 0})`).join(' ')
    const unused = coreTypes.filter((t) => !typeCounts.has(t))
    parts.push(`SCENE TYPE MIX: ${mix}`)
    if (unused.length > 0) parts.push(`UNUSED TYPES: ${unused.join(', ')}`)
  }

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

function filterToolsForAgent(
  agentType: AgentType,
  activeTools: string[],
  audioProviderEnabled?: Record<string, boolean>,
  mediaGenEnabled?: Record<string, boolean>,
): ClaudeToolDefinition[] {
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
  if (activeTools.includes('zdog')) allowedLayerTypes.add('zdog')
  if (activeTools.includes('physics')) allowedLayerTypes.add('physics')

  // Check which provider categories have at least one enabled provider
  const isAudioEnabled = (id: string) => !audioProviderEnabled || (audioProviderEnabled[id] ?? true)
  const isMediaEnabled = (id: string) => !mediaGenEnabled || (mediaGenEnabled[id] ?? true)
  const hasTTS = AUDIO_PROVIDERS.some((p) => p.category === 'tts' && isAudioEnabled(p.id))
  const hasSFX = AUDIO_PROVIDERS.some((p) => p.category === 'sfx' && isAudioEnabled(p.id))
  const hasMusic = AUDIO_PROVIDERS.some((p) => p.category === 'music' && isAudioEnabled(p.id))
  const hasAvatar = MEDIA_PROVIDERS.some((p) => p.category === 'avatar' && isMediaEnabled(p.id))
  const hasVideo = MEDIA_PROVIDERS.some((p) => p.category === 'video' && isMediaEnabled(p.id))

  // Filter tools based on active tool categories
  return agentTools.filter((tool) => {
    // These are always available
    if (
      [
        'create_scene',
        'delete_scene',
        'duplicate_scene',
        'reorder_scenes',
        'set_scene_duration',
        'set_scene_background',
        'set_transition',
        'remove_layer',
        'reorder_layer',
        'set_layer_opacity',
        'set_layer_visibility',
        'set_layer_timing',
        'regenerate_layer',
        'patch_layer_code',
        'add_element',
        'edit_element',
        'delete_element',
        'move_element',
        'resize_element',
        'reorder_element',
        'adjust_element_timing',
        'set_global_style',
        'set_all_transitions',
        'set_roughness_all',
        'plan_scenes',
        'export_mp4',
        'publish_interactive',
      ].includes(tool.name)
    ) {
      return true
    }

    // Conditionally filtered tools
    if (tool.name === 'add_layer' && allowedLayerTypes.size === 0) return false
    if (['generate_chart', 'update_chart', 'remove_chart', 'reorder_charts'].includes(tool.name)) {
      return activeTools.includes('d3')
    }
    if (tool.name === 'search_images' || tool.name === 'place_image') return activeTools.includes('assets')

    // Audio tools — gated on activeTools AND provider availability per category
    if (tool.name === 'set_audio_layer') return activeTools.includes('audio')
    if (tool.name === 'add_narration') return activeTools.includes('audio') && hasTTS
    if (tool.name === 'add_sound_effect') return activeTools.includes('audio') && hasSFX
    if (tool.name === 'add_background_music') return activeTools.includes('audio') && hasMusic

    // Video/avatar tools — gated on provider availability
    if (tool.name === 'set_video_layer') return activeTools.includes('video') && hasVideo
    if (['generate_avatar', 'list_avatars', 'generate_avatar_narration'].includes(tool.name))
      return activeTools.includes('avatars') && hasAvatar

    if (['add_interaction', 'add_multiple_interactions', 'edit_interaction', 'connect_scenes'].includes(tool.name))
      return activeTools.includes('interactions')
    if (
      ['generate_physics_scene', 'explain_physics_concept', 'annotate_simulation', 'set_simulation_params'].includes(
        tool.name,
      )
    )
      return activeTools.includes('physics')
    if (tool.name === 'apply_canvas_motion_template') {
      return activeTools.includes('canvas2d')
    }
    if (tool.name === 'three_data_scatter_scene') {
      return activeTools.includes('three')
    }

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
  thinkingMode: ThinkingMode = 'adaptive',
  enabledModelIds?: string[],
  storyboard?: Storyboard | null,
  userMemories?: Array<{ category: string; key: string; value: string; confidence: number }>,
  focusedSceneType?: string,
  directorTemplate?: string,
): AgentContext {
  // Determine focused scene
  let focusedSceneId: string | null = null

  // 'auto' scene context: builder/director/dop/planner get all scenes, editor gets selected
  const effectiveSceneContext =
    opts.sceneContext === 'auto'
      ? agentType === 'director' || agentType === 'dop' || agentType === 'planner' || agentType === 'scene-maker'
        ? 'all'
        : 'selected'
      : opts.sceneContext

  if (effectiveSceneContext === 'selected' || opts.focusedSceneId) {
    focusedSceneId = opts.focusedSceneId ?? null
  } else if (effectiveSceneContext !== 'all' && effectiveSceneContext) {
    // Treat as a specific scene ID
    focusedSceneId = effectiveSceneContext
  }

  const worldState = buildWorldState(scenes, globalStyle, projectName, outputMode, focusedSceneId)
  const worldStateSerialized = serializeWorldState(worldState)

  const presetId = globalStyle?.presetId ?? null
  const resolvedStyle = resolveStyle(presetId, globalStyle)
  const preset = getPreset(presetId)
  const basePrompt = getAgentPrompt(agentType, resolvedStyle, focusedSceneType, directorTemplate)

  // Build cascade guidance from preset
  const cascadeParts: string[] = []

  if (agentType === 'director' || agentType === 'planner' || agentType === 'scene-maker') {
    const planGuidance =
      agentType === 'planner'
        ? 'You are in plan-only mode: output a storyboard via plan_scenes only — do not create scenes or layers.'
        : agentType === 'scene-maker'
          ? 'Generate scenes directly without a planning pass.'
          : preset.agent.planFirst
            ? 'Plan scenes before generating — lay out the narrative arc first.'
            : 'Generate scenes directly without a planning pass.'
    cascadeParts.push(`## ${presetId ? 'Style Cascade Guidance' : 'Planning Guidance'}
${presetId ? `Preferred scene count for this style: ${preset.agent.preferredSceneCount.min}–${preset.agent.preferredSceneCount.max} scenes.` : 'Scene count is up to you — match it to the content.'}
${planGuidance}`)

    // Variety alert when one scene type dominates
    const typeCounts = new Map<string, number>()
    scenes.forEach((s) => typeCounts.set(s.sceneType, (typeCounts.get(s.sceneType) || 0) + 1))
    const dominant = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0]
    const unused = ['svg', 'canvas2d', 'd3', 'motion', 'three'].filter((t) => !typeCounts.has(t))

    if (scenes.length >= 3 && dominant && dominant[1] >= scenes.length * 0.6) {
      cascadeParts.push(`## Variety Alert
${dominant[0]} is overrepresented (${dominant[1]}/${scenes.length} scenes).
Consider using: ${unused.length > 0 ? unused.join(', ') : 'any underused type'} for the next scene.`)
    }
  }

  if (agentType === 'scene-maker' || agentType === 'editor') {
    cascadeParts.push(`## Density Guidance
Element density: ${preset.density.elementsPerScene.min}–${preset.density.elementsPerScene.max} elements per scene.
${preset.density.labelEverything ? 'Label every diagram element.' : 'Labels only on key elements.'}
${preset.density.breathingRoom ? 'Leave generous whitespace between elements.' : 'Pack elements efficiently.'}
Annotation style: ${preset.density.annotationStyle}`)
  }

  // Interactive video guidance — injected when interactions tool is enabled
  if (opts.activeTools.includes('interactions')) {
    cascadeParts.push(`## Interactive Video Mode
The user wants an interactive video experience. Design scenes with viewer participation in mind.
All interactions render via the CenchInteract component library (loaded in every scene).
Use add_interaction or add_multiple_interactions to place elements, then connect_scenes to wire flow.

### When to use each interaction type:
- HOTSPOT — Diagram/chart labels. Use on any visual with named parts (anatomy, circuits, UI).
  Max 5 per scene. Trigger: hover (default) or click.
- TOOLTIP — Optional depth, non-blocking info. Lighter than hotspot, good for equation terms or data points.
- CHOICE — Decision points and engagement. "Which approach?" or "What happens next?"
- QUIZ — After a concept is explained, check understanding. One quiz per scene max.
  Always include an explanation — it IS the teaching moment.
- GATE — Blocks progression until condition met. Use sparingly (timer or quiz_pass types).
  Max 1 per scene. Avoid arbitrary gates that frustrate viewers.
- FORM — Data collection or personalization. "Enter your revenue to see comparison."
  Never combine form + quiz in same scene.

### Style selection:
Style auto-detects from preset if set to "auto" (default). Override when needed:
- professional: corporate training, boardroom (pairs with corporate/journal presets)
- glassmorphic: SaaS demos, tech explainers (pairs with dark/neon/cinematic presets)
- edu: structured learning, courses (pairs with pastel_edu, chalkboard)
- chalk: physics lectures, hand-drawn labels (pairs with chalkboard, feynman, pencil)
- terminal: coding tutorials, decision trees (pairs with retro_terminal)
- minimal: documentation, subtle guidance (pairs with clean, minimal_zen, threeblueonebrown)

### Density rules:
- Max 1 quiz per scene, max 5 hotspots, max 1 gate, tooltips unlimited
- Title/intro scenes auto-advance; content scenes pause for interaction
- Plan the scene graph as a tree or network, not just a linear sequence`)

    if (agentType === 'director' || agentType === 'planner') {
      cascadeParts.push(`## Interactive Planning
When planning scenes, design a scene graph — not just a list:
- Identify decision points where the viewer chooses a path
- Create at least 2-3 branches from key decision scenes
- Include a "default" path for viewers who don't interact
- Plan scene connections: which choices lead where
- Consider adding a quiz gate before revealing the conclusion
- Use plan_scenes to lay out the full interactive structure first`)
    }
  }

  // Audio provider availability — only show categories with enabled providers
  if (
    opts.activeTools.includes('audio') &&
    (agentType === 'director' || agentType === 'scene-maker' || agentType === 'planner')
  ) {
    const enabledMap = opts.audioProviderEnabled ?? {}
    const isEnabled = (id: string) => enabledMap[id] ?? true
    const enabledTTS = AUDIO_PROVIDERS.filter((p) => p.category === 'tts' && isEnabled(p.id)).map((p) => p.name)
    const enabledSFX = AUDIO_PROVIDERS.filter((p) => p.category === 'sfx' && isEnabled(p.id)).map((p) => p.name)
    const enabledMusic = AUDIO_PROVIDERS.filter((p) => p.category === 'music' && isEnabled(p.id)).map((p) => p.name)
    const parts = []
    if (enabledTTS.length > 0) parts.push(`TTS: ${enabledTTS.join(', ')}`)
    if (enabledSFX.length > 0) parts.push(`SFX: ${enabledSFX.join(', ')}`)
    if (enabledMusic.length > 0) parts.push(`Music: ${enabledMusic.join(', ')}`)
    if (parts.length > 0) {
      cascadeParts.push(`## Audio Providers\nEnabled: ${parts.join(' | ')}`)
    }
  }

  // Media provider availability — only show enabled providers
  if (agentType === 'director' || agentType === 'scene-maker' || agentType === 'planner') {
    const mediaMap = opts.mediaGenEnabled ?? {}
    const isMediaEnabled = (id: string) => mediaMap[id] ?? true
    const enabled = MEDIA_PROVIDERS.filter((p) => isMediaEnabled(p.id)).map((p) => p.name)
    if (enabled.length > 0) {
      cascadeParts.push(`## Media Providers\nEnabled: ${enabled.join(', ')}`)
    }
  }

  // Inject project asset library
  if (opts.projectAssets && opts.projectAssets.length > 0) {
    const assetLines = opts.projectAssets.map((a) => {
      const dims = a.width && a.height ? `, ${a.width}x${a.height}px` : ''
      const dur = a.durationSeconds ? `, ${a.durationSeconds.toFixed(1)}s` : ''
      const tags = a.tags.length > 0 ? ` (${a.tags.join(', ')})` : ''
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      return `- "${a.name}"${tags} — ${a.type}${dims}${dur} — ID: ${a.id} — URL: ${baseUrl}${a.publicUrl}`
    })
    cascadeParts.push(`## Available Project Assets
The user has uploaded the following assets to this project's media library:

${assetLines.join('\n')}

When the user references their logo, brand assets, or uploaded content, use these URLs directly in generated scene HTML. Always use the full absolute URL (including http://localhost:3000) because WVC renders scenes in headless Chrome which needs absolute URLs.
Use the use_asset_in_scene tool to formally reference an asset, or embed the URL directly in generated code.`)
  }

  // Inject storyboard context when available (set by plan_scenes tool)
  if (storyboard && storyboard.scenes.length > 0) {
    const sbLines = storyboard.scenes.map((s, i) => {
      const parts = [`  [${i + 1}] "${s.name}" — ${s.sceneType}, ${s.duration}s`]
      if (s.purpose) parts.push(`      Purpose: ${s.purpose}`)
      if (s.narrationDraft)
        parts.push(`      Narration: "${s.narrationDraft.slice(0, 120)}${s.narrationDraft.length > 120 ? '...' : ''}"`)
      if (s.visualElements) parts.push(`      Visuals: ${s.visualElements}`)
      if (s.chartSpec) parts.push(`      Chart: ${s.chartSpec.type} — ${s.chartSpec.dataDescription}`)
      if (s.mediaLayers) parts.push(`      Media: ${s.mediaLayers}`)
      if (s.cameraMovement) parts.push(`      Camera: ${s.cameraMovement}`)
      if (s.physicsSimulation) parts.push(`      Simulation: ${s.physicsSimulation}`)
      if (s.worldEnvironment) parts.push(`      Environment: ${s.worldEnvironment}`)
      if (s.transition) parts.push(`      Transition: ${s.transition}`)
      return parts.join('\n')
    })
    const flagsStr = storyboard.featureFlags
      ? `  Features: narration=${storyboard.featureFlags.narration}, music=${storyboard.featureFlags.music}, sfx=${storyboard.featureFlags.sfx}, interactions=${storyboard.featureFlags.interactions}`
      : ''
    cascadeParts.push(`## Storyboard (from plan_scenes)
Title: "${storyboard.title}" | ${storyboard.scenes.length} scenes | ${storyboard.totalDuration}s total
${storyboard.styleNotes ? `Style: ${storyboard.styleNotes}` : ''}
${flagsStr}

Scenes:
${sbLines.join('\n')}

Follow this storyboard when building scenes. Each scene should match its planned type, visuals, and narration.`)
  }

  // Inject user memory (cross-session learnings)
  if (userMemories && userMemories.length > 0) {
    const relevantMemories = userMemories.filter((m) => m.confidence >= 0.3).slice(0, 8) // cap at 8 to keep prompt lightweight
    if (relevantMemories.length > 0) {
      const memoryLines = relevantMemories.map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
      cascadeParts.push(
        `## User Preferences (learned from past sessions)\nThese are patterns observed from this user's previous work. Use them as defaults unless the user explicitly requests otherwise.\n${memoryLines.join('\n')}`,
      )
    }
  }

  const cascadeBlock = cascadeParts.length > 0 ? '\n\n' + cascadeParts.join('\n\n') : ''

  // Split prompt into static (cacheable) and dynamic (per-turn) portions.
  // The static portion contains agent persona + rules + style guidance — stable across turns.
  // The dynamic portion contains world state, storyboard, run progress — changes each turn.
  // This enables Anthropic prompt caching: static portion stays cache-hot.
  const staticPrompt = basePrompt
  const dynamicPrompt = `${cascadeBlock}

## Current World State
\`\`\`
${worldStateSerialized}
\`\`\``
  const systemPrompt = `${staticPrompt}${dynamicPrompt}`

  const tools = filterToolsForAgent(agentType, opts.activeTools, opts.audioProviderEnabled, opts.mediaGenEnabled)
  const modelId = resolveModel(agentType, modelTier ?? 'auto', modelOverride, enabledModelIds)
  // Router never uses thinking; non-Anthropic models don't support thinking param
  const provider = getModelProvider(modelId)
  const effectiveThinking = agentType === 'router' || provider !== 'anthropic' ? ('off' as ThinkingMode) : thinkingMode
  // Only inflate maxTokens for thinking budget on Anthropic models
  const maxTokens = resolveMaxTokensForThinking(MAX_TOKENS_BY_AGENT[agentType], effectiveThinking)

  return {
    systemPrompt,
    staticPrompt,
    dynamicPrompt,
    worldState,
    tools,
    maxTokens,
    modelId,
    thinkingMode: effectiveThinking,
  }
}

/**
 * Build the minimal context for the router agent (just system prompt + world summary).
 * If enabledModelIds is provided, resolves the cheapest available model.
 */
export function buildRouterContext(
  scenes: Scene[],
  globalStyle: GlobalStyle,
  projectName: string,
  outputMode: 'mp4' | 'interactive',
  enabledModelIds?: string[],
): { systemPrompt: string; modelId: ModelId; maxTokens: number } {
  const world = buildWorldState(scenes, globalStyle, projectName, outputMode, null)
  const summary = `Project: "${world.projectName}" | ${world.sceneCount} scenes | ${world.totalDuration}s | mode: ${world.outputMode}`

  return {
    systemPrompt: `${getAgentPrompt('router')}\n\nWorld state: ${summary}`,
    modelId: resolveModel('router', 'auto', null, enabledModelIds),
    maxTokens: 20,
  }
}

/**
 * Trim message history to last N messages to stay within context limits.
 */
/** Rough token estimate: ~4 chars per token for text, ~1600 per image */
const IMAGE_TOKEN_ESTIMATE = 1600

function estimateContentTokens(content: import('./types').MessageContent): number {
  if (typeof content === 'string') return Math.ceil(content.length / 4)
  return content.reduce((sum, block) => {
    if (block.type === 'text') return sum + Math.ceil(block.text.length / 4)
    if (block.type === 'image') return sum + IMAGE_TOKEN_ESTIMATE
    return sum
  }, 0)
}

const MAX_HISTORY_TOKENS = 12000

/**
 * Strip image blocks from a message, replacing with text placeholders.
 * Used to save tokens in older history entries.
 */
function stripImages(content: import('./types').MessageContent): import('./types').MessageContent {
  if (typeof content === 'string') return content
  const hasImages = content.some((b) => b.type === 'image')
  if (!hasImages) return content
  return content.map((b) => (b.type === 'image' ? { type: 'text' as const, text: '[image]' } : b))
}

/** Number of recent messages to keep in full detail (verbatim, not summarized) */
const RECENT_WINDOW = 8

/**
 * Summarize older messages into a structured summary that preserves
 * tool call decisions, scene operations, and conversation flow.
 *
 * Produces structured sections: scope, user intent, tool history (with counts),
 * scene state, style decisions, storyboard progress, and key results.
 * When re-compacting, merges with any existing summary found in the messages.
 */
function summarizeOlderMessages(messages: Array<{ role: string; content: import('./types').MessageContent }>): string {
  if (messages.length === 0) return ''

  const userRequests: string[] = []
  const toolCallCounts: Record<string, number> = {}
  const keyResults: string[] = []
  // Track scene & style state from tool call context
  const scenesMentioned: Set<string> = new Set()
  const styleDecisions: string[] = []
  const storyboardInfo: string[] = []
  let existingSummary = ''

  for (const msg of messages) {
    const text =
      typeof msg.content === 'string'
        ? msg.content
        : msg.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join(' ')

    // Extract content blocks for richer analysis
    const blocks = typeof msg.content === 'string' ? [] : msg.content

    if (msg.role === 'user') {
      // Capture existing summary for merge on re-compaction
      if (text.startsWith('[CONVERSATION SUMMARY')) {
        existingSummary = text
        continue
      }
      // Skip context refresh messages
      if (text.startsWith('[CONTEXT REFRESH') || text.startsWith('[CONTINUATION')) continue
      // Extract user intent — first 150 chars
      const trimmedText = text.slice(0, 150).replace(/\n/g, ' ').trim()
      if (trimmedText && !trimmedText.startsWith('{')) userRequests.push(trimmedText)

      // Extract tool result summaries from user messages (tool results come as user role)
      for (const block of blocks) {
        if ((block as any).functionResponse) {
          const fr = (block as any).functionResponse
          const resultText = typeof fr.response === 'string' ? fr.response : JSON.stringify(fr.response)
          // Track scene creation/modification from results
          if (resultText.includes('sceneId') || resultText.includes('scene_id')) {
            const sceneMatch = resultText.match(/(?:sceneId|scene_id)['":\s]+([a-zA-Z0-9-]+)/)
            if (sceneMatch) scenesMentioned.add(sceneMatch[1])
          }
          if (resultText.includes('success') || resultText.includes('created') || resultText.includes('error')) {
            keyResults.push(`${fr.name}: ${resultText.slice(0, 80)}`)
          }
        }
        // Anthropic tool_result blocks
        if ((block as any).type === 'tool_result') {
          const tr = block as any
          const resultContent = typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
          keyResults.push(resultContent.slice(0, 80))
        }
      }
    } else if (msg.role === 'assistant') {
      // Extract actual tool call names from function call blocks
      for (const block of blocks) {
        let toolName: string | undefined
        let toolArgs: string | undefined

        if ((block as any).functionCall) {
          const fc = (block as any).functionCall
          toolName = fc.name
          toolArgs = typeof fc.args === 'string' ? fc.args : JSON.stringify(fc.args)
        } else if ((block as any).type === 'tool_use') {
          const tu = block as any
          toolName = tu.name
          toolArgs = JSON.stringify(tu.input)
        }

        if (toolName) {
          toolCallCounts[toolName] = (toolCallCounts[toolName] || 0) + 1
          // Extract scene/style context from tool args
          if (toolArgs) {
            const sceneMatch = toolArgs.match(/(?:sceneId|scene_id)['":\s]+([a-zA-Z0-9-]+)/)
            if (sceneMatch) scenesMentioned.add(sceneMatch[1])
            if (toolName.includes('style') || toolName === 'set_global_style' || toolName === 'set_palette') {
              const presetMatch = toolArgs.match(/(?:preset|style)['":\s]+"?([a-zA-Z-]+)/)
              if (presetMatch) styleDecisions.push(`${toolName}: ${presetMatch[1]}`)
            }
            if (toolName === 'plan_scenes') {
              storyboardInfo.push('Storyboard created via plan_scenes')
            }
          }
        }

        // OpenAI tool_calls
        if ((block as any).tool_calls) {
          for (const tc of (block as any).tool_calls) {
            const name = tc.function?.name ?? tc.name
            toolCallCounts[name] = (toolCallCounts[name] || 0) + 1
          }
        }
      }
    }
  }

  // ── Build structured summary ──────────────────────────────────────────────
  const parts: string[] = ['[CONVERSATION SUMMARY — older messages compressed]']

  // Scope
  parts.push(`Scope: ${messages.length} messages summarized`)

  // Merge with prior summary if re-compacting
  if (existingSummary) {
    // Extract the prior message count from existing summary
    const priorCountMatch = existingSummary.match(/(\d+) messages summarized/)
    const priorCount = priorCountMatch ? parseInt(priorCountMatch[1], 10) : 0
    // Subtract 1 from messages.length because the summary message itself is in the list
    const newMessageCount = messages.length - 1
    parts[1] = `Scope: ${newMessageCount + priorCount} messages summarized (${priorCount} from prior compaction + ${newMessageCount} new)`
    // Extract prior user requests that aren't duplicated
    const priorRequestsMatch = existingSummary.match(/User requests: (.+)/)
    if (priorRequestsMatch) {
      const priorReqs = priorRequestsMatch[1].split(' → ').map((r) => r.trim())
      // Prepend prior requests, dedup
      const allRequests = [...priorReqs, ...userRequests]
      userRequests.length = 0
      userRequests.push(...allRequests)
    }
    // Extract prior tool counts (format: "tool_name x3" or "tool_name")
    const priorToolsMatch = existingSummary.match(/Tools used: (.+)/)
    if (priorToolsMatch) {
      const priorTools = priorToolsMatch[1].split(', ')
      for (const entry of priorTools) {
        const match = entry.trim().match(/^([\w_]+)\s*(?:x(\d+))?$/)
        if (match) {
          const name = match[1]
          const count = match[2] ? parseInt(match[2], 10) : 1
          toolCallCounts[name] = (toolCallCounts[name] || 0) + count
        }
      }
    }
    // Extract prior scenes
    const priorScenesMatch = existingSummary.match(/Scenes touched: (.+)/)
    if (priorScenesMatch) {
      priorScenesMatch[1].split(', ').forEach((s) => scenesMentioned.add(s.trim()))
    }
  }

  // User intent (last 5 requests, oldest first)
  if (userRequests.length > 0) {
    parts.push(`User requests: ${userRequests.slice(-5).join(' → ')}`)
  }

  // Tool history with counts (deduplicated)
  const toolEntries = Object.entries(toolCallCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
  if (toolEntries.length > 0) {
    parts.push(`Tools used: ${toolEntries.join(', ')}`)
  }

  // Scene state
  if (scenesMentioned.size > 0) {
    parts.push(`Scenes touched: ${[...scenesMentioned].slice(0, 10).join(', ')}`)
  }

  // Style decisions
  if (styleDecisions.length > 0) {
    parts.push(`Style decisions: ${[...new Set(styleDecisions)].slice(0, 5).join('; ')}`)
  }

  // Storyboard progress
  if (storyboardInfo.length > 0) {
    parts.push(`Storyboard: ${storyboardInfo[0]}`)
  }

  // Key results (last 6)
  if (keyResults.length > 0) {
    parts.push(`Key results: ${keyResults.slice(-6).join('; ')}`)
  }

  return parts.join('\n')
}

/**
 * Compact an in-flight messages array during a tool loop.
 *
 * Called after context refresh intervals to prevent unbounded growth.
 * Preserves the last `preserveRecent` messages verbatim and replaces
 * everything before with a structured summary + continuation instruction.
 *
 * The continuation instruction tells the model to resume naturally without
 * recapping or asking for clarification — critical for long Director builds.
 */
export function compactInFlightMessages(
  messages: Array<{ role: string; content: any }>,
  opts: {
    maxTokens?: number
    preserveRecent?: number
  } = {},
): Array<{ role: string; content: any }> {
  const maxTokens = opts.maxTokens ?? 6000
  const preserveRecent = opts.preserveRecent ?? 8

  // Check if compaction is needed
  const totalTokens = messages.reduce((sum, m) => sum + estimateContentTokens(m.content), 0)
  if (totalTokens <= maxTokens || messages.length <= preserveRecent + 2) {
    return messages // No compaction needed
  }

  // Split: older messages to summarize, recent to preserve
  const olderMessages = messages.slice(0, messages.length - preserveRecent)
  const recentMessages = messages.slice(messages.length - preserveRecent)

  const summary = summarizeOlderMessages(olderMessages)

  // Build continuation message with structured resume instruction
  const continuationContent = [
    summary,
    '',
    '[CONTINUATION — Resume directly from where you left off.',
    `${olderMessages.length} earlier messages have been summarized above. Recent messages below are verbatim.`,
    'Do NOT recap, summarize, or ask "where were we?". Proceed to the next action immediately.]',
  ].join('\n')

  return [{ role: 'user' as const, content: [{ text: continuationContent }] }, ...recentMessages]
}

/**
 * Trim conversation history using a two-tier approach:
 * 1. Recent window: last RECENT_WINDOW messages kept in full
 * 2. Summary buffer: older messages compressed into a structured summary
 *
 * This preserves conversation awareness without token bloat.
 * Images are stripped from all but the last 2 user messages.
 */
export function trimHistory(history: Array<{ role: string; content: import('./types').MessageContent }>) {
  // First apply message count limit
  let all = history.slice(-MAX_HISTORY_MESSAGES)

  // Strip images from all but the last 2 user messages to save tokens
  let userMsgCount = 0
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].role === 'user') {
      userMsgCount++
      if (userMsgCount > 2) {
        all[i] = { ...all[i], content: stripImages(all[i].content) }
      }
    }
  }

  // Two-tier split: summarize older messages, keep recent in full
  if (all.length > RECENT_WINDOW) {
    const olderMessages = all.slice(0, all.length - RECENT_WINDOW)
    const recentMessages = all.slice(all.length - RECENT_WINDOW)

    const summary = summarizeOlderMessages(olderMessages)
    if (summary) {
      // Prepend the summary as a synthetic user message
      const summaryMsg = { role: 'user' as const, content: summary as import('./types').MessageContent }
      all = [summaryMsg, ...recentMessages]
    } else {
      all = recentMessages
    }
  }

  // Apply token budget — drop oldest (after summary) until under limit
  let totalTokens = all.reduce((sum, m) => sum + estimateContentTokens(m.content), 0)
  while (totalTokens > MAX_HISTORY_TOKENS && all.length > 2) {
    const removed = all.shift()!
    totalTokens -= estimateContentTokens(removed.content)
  }

  return all
}

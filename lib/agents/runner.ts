/**
 * Main agent execution loop for Cench Studio.
 *
 * Handles:
 * - Agent routing (auto or override)
 * - Context building with world state
 * - Streaming Claude API calls
 * - Multi-turn tool_use loops
 * - SSE event emission
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { v4 as uuidv4 } from 'uuid'
import Ajv, { type ValidateFunction } from 'ajv'
import type { Scene, GlobalStyle, APIPermissions, SceneGraph } from '../types'
import { syncSceneGraphWithScenes } from '../scene-graph-sync'
import type {
  AgentType,
  ModelId,
  ModelTier,
  ThinkingMode,
  SSEEvent,
  ToolCallRecord,
  ToolResult,
  ChatMessage,
  UsageStats,
  MessageContent,
  ContentBlock,
  Storyboard,
  RunProgress,
} from './types'
import { getModelPricing, getModelProvider, messageContentToText, serializeRunProgress } from './types'
import { THINKING_BUDGETS } from './context-builder'
import { getAgentPrompt } from './prompts'
import { AGENT_TOOLS, ALL_TOOLS } from './tools'
import { resolveStyle } from '../styles/presets'
// import { routeMessage } from './router' // preserved for future builder delegation
import {
  buildAgentContext,
  trimHistory,
  compactInFlightMessages,
  buildWorldState,
  serializeWorldState,
} from './context-builder'
import { executeTool, resetToolStats, getToolStats, type WorldStateMutable } from './tool-executor'
import { logSpend, logAgentUsage } from '../db'
import { persistRunCheckpoint } from '../db/queries/projects'
import { AgentLogger } from './logger'

const anthropicClient = new Anthropic()

// Lazy-init OpenAI client — only created when an OpenAI model is actually used.
// The constructor throws if OPENAI_API_KEY is not set, which would crash the
// entire module import even when only using Anthropic models.
let _openaiClient: OpenAI | null = null
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) _openaiClient = new OpenAI()
  return _openaiClient
}

let _googleClient: GoogleGenAI | null = null
function getGoogleClient(): GoogleGenAI {
  if (!_googleClient) _googleClient = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_KEY })
  return _googleClient
}

const _localClients = new Map<string, OpenAI>()
function getLocalClient(endpoint: string): OpenAI {
  if (!_localClients.has(endpoint)) {
    _localClients.set(endpoint, new OpenAI({ baseURL: `${endpoint}/v1`, apiKey: 'ollama' }))
  }
  return _localClients.get(endpoint)!
}

/** Tunable parameters for a single agent run.
 *  Override via RunnerOptions.runConfig for per-project or per-agent customization. */
export interface RunConfig {
  /** Max tool-bearing iterations before forced stop */
  maxToolIterations: number
  /** Default timeout per tool execution in ms */
  toolTimeoutMs: number
  /** Timeout for LLM-backed generation tools in ms */
  generationToolTimeoutMs: number
  /** Timeout for stream.finalMessage() in ms */
  finalMessageTimeoutMs: number
  /** Refresh world state context every N tool-bearing iterations */
  contextRefreshInterval: number
  /** Maximum cost in USD for a single run before circuit breaker fires */
  maxRunCostUsd: number
  /** Maximum total tool calls (across all iterations + sub-agents) before forced stop */
  maxToolCalls: number
  /** Max tokens for in-flight message compaction */
  compactionMaxTokens: number
  /** Number of recent messages to preserve during compaction */
  compactionPreserveRecent: number
}

const DEFAULT_RUN_CONFIG: RunConfig = {
  maxToolIterations: 15,
  toolTimeoutMs: 60_000,
  generationToolTimeoutMs: 120_000,
  finalMessageTimeoutMs: 10_000,
  contextRefreshInterval: 3,
  maxRunCostUsd: 2.0,
  maxToolCalls: 50,
  compactionMaxTokens: 6000,
  compactionPreserveRecent: 8,
}

// Tool timeout constants — used by withRetry() and getToolTimeout() which run
// outside the per-request RunConfig scope (module-level utilities).
const TOOL_TIMEOUT_MS = DEFAULT_RUN_CONFIG.toolTimeoutMs
const GENERATION_TOOL_TIMEOUT_MS = DEFAULT_RUN_CONFIG.generationToolTimeoutMs

/** Tools that invoke LLM code generation and need a longer timeout */
const GENERATION_TOOLS = new Set(['add_layer', 'regenerate_layer', 'edit_layer'])

/** Tools safe to run in parallel when targeting different scenes */
const PARALLELIZABLE_TOOLS = GENERATION_TOOLS
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true })
const schemaValidatorCache = new Map<string, ValidateFunction>()

function getToolTimeout(toolName: string): number {
  return GENERATION_TOOLS.has(toolName) ? GENERATION_TOOL_TIMEOUT_MS : TOOL_TIMEOUT_MS
}

/** Race a promise against a timeout. Rejects with a descriptive error if the timeout fires. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    }),
  ]).finally(() => clearTimeout(timer!))
}

/** Wrap an async iterable with an inactivity timeout.
 *  Resets the timer on each yielded value. If no value arrives within `timeoutMs`, throws. */
async function* withInactivityTimeout<T>(
  iterable: AsyncIterable<T>,
  timeoutMs: number,
  label: string,
): AsyncGenerator<T> {
  let timer: ReturnType<typeof setTimeout>
  let rejectTimeout: ((err: Error) => void) | null = null

  const resetTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      rejectTimeout?.(new Error(`Stream inactivity timeout after ${timeoutMs}ms: ${label}`))
    }, timeoutMs)
  }

  try {
    const iterator = iterable[Symbol.asyncIterator]()
    resetTimer()
    while (true) {
      const result = await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          rejectTimeout = reject
        }),
      ])
      if (result.done) break
      resetTimer()
      yield result.value
    }
  } finally {
    clearTimeout(timer!)
    rejectTimeout = null
  }
}

const STREAM_INACTIVITY_TIMEOUT_MS = 90_000 // 90 seconds

/** Errors worth retrying — transient timeouts and empty generation results */
function isRetryableError(err: Error): boolean {
  const msg = err.message.toLowerCase()
  return (
    msg.includes('timeout') || msg.includes('empty code') || msg.includes('rate limit') || msg.includes('overloaded')
  )
}

/** Execute a tool with automatic retry for transient failures (timeout, empty code, rate limit).
 *  Generation tools get 2 retries (they're expensive to fail); others get 1.
 *  Uses exponential backoff with jitter (prevents thundering herd).
 *  Never retries validation or permission errors. */
async function withRetry(fn: () => Promise<ToolResult>, toolName: string, logger?: AgentLogger): Promise<ToolResult> {
  const MAX_RETRIES = GENERATION_TOOLS.has(toolName) ? 2 : 1
  const BASE_DELAY_MS = 1000

  let lastResult: ToolResult
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastResult = await fn()
      // Retry on soft failures (success: false with retryable error messages)
      if (!lastResult.success && lastResult.error && !lastResult.permissionNeeded) {
        const isRetryable =
          lastResult.error.toLowerCase().includes('empty code') ||
          lastResult.error.toLowerCase().includes('timeout') ||
          lastResult.error.toLowerCase().includes('rate limit')
        if (isRetryable && attempt < MAX_RETRIES) {
          // Exponential backoff with jitter: base * 2^attempt * (0.5–1.5)
          const delay = Math.round(BASE_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random()))
          logger?.log('retry', `Retrying ${toolName} after soft failure (attempt ${attempt + 1})`, {
            error: lastResult.error,
            delayMs: delay,
          })
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
      }
      return lastResult
    } catch (err) {
      if (attempt < MAX_RETRIES && isRetryableError(err as Error)) {
        const delay = Math.round(BASE_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random()))
        logger?.log('retry', `Retrying ${toolName} after error (attempt ${attempt + 1})`, {
          error: (err as Error).message,
          delayMs: delay,
        })
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  return lastResult!
}

/** Keys that always pass through summarization even when their values are large */
const METADATA_KEYS = new Set([
  'sceneId',
  'layerId',
  'elementId',
  'chartId',
  'interactionId',
  'sceneType',
  'layerType',
  'chartType',
  'type',
  'id',
  'name',
  'label',
  'title',
  'duration',
  'width',
  'height',
  'x',
  'y',
  'success',
  'report',
  'checks',
  'issues',
])

/**
 * Summarize a tool result for feeding back into the LLM message history.
 * Strips generated code from the result to prevent token bloat across iterations,
 * but preserves structured metadata (IDs, types, dimensions) so the agent can
 * reference them in subsequent tool calls.
 */
function summarizeToolResult(result: ToolResult): Record<string, unknown> {
  const summary: Record<string, unknown> = { success: result.success }
  if (result.affectedSceneId) summary.affectedSceneId = result.affectedSceneId
  if (result.error) summary.error = result.error
  if (result.data) {
    // Keep data but strip large code strings (preserve metadata keys)
    if (typeof result.data === 'object' && result.data !== null) {
      const d = result.data as Record<string, unknown>
      const cleaned: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(d)) {
        if (METADATA_KEYS.has(k)) {
          // Always keep metadata fields
          cleaned[k] = v
        } else if (typeof v === 'string' && v.length > 500) {
          cleaned[k] = `[${v.length} chars generated]`
        } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
          // For arrays of objects (e.g. layers, elements), keep count + first item's metadata
          cleaned[k] = `[${v.length} items]`
          const firstItem = v[0] as Record<string, unknown>
          const metaKeys = Object.keys(firstItem).filter((ik) => METADATA_KEYS.has(ik))
          if (metaKeys.length > 0) {
            const firstMeta: Record<string, unknown> = {}
            for (const mk of metaKeys) firstMeta[mk] = firstItem[mk]
            cleaned[`${k}_first`] = firstMeta
          }
        } else {
          cleaned[k] = v
        }
      }
      summary.data = cleaned
    } else {
      summary.data = result.data
    }
  }
  if (result.changes) {
    // Keep change descriptions but strip any code content
    summary.changes = result.changes.map((c) => ({
      type: c.type,
      sceneId: c.sceneId,
      description: c.description,
    }))
  }
  return summary
}

/**
 * Lightweight runtime validation for Claude tool inputs.
 * Purpose: catch malformed JSON / missing required keys early so we
 * don't execute tools with accidental `{}` inputs.
 */
function validateToolInputAgainstSchema(inputSchema: any, input: unknown): { ok: true } | { ok: false; error: string } {
  if (!inputSchema) return { ok: true }

  const schemaKey = JSON.stringify(inputSchema)
  let validator = schemaValidatorCache.get(schemaKey)
  if (!validator) {
    try {
      validator = ajv.compile(inputSchema)
      schemaValidatorCache.set(schemaKey, validator)
    } catch (e) {
      return { ok: false, error: `Failed to compile tool schema: ${(e as Error).message}` }
    }
  }

  const valid = validator(input)
  if (valid) return { ok: true }

  const first = validator.errors?.[0]
  if (!first) return { ok: false, error: 'Tool input failed schema validation' }
  const at = first.instancePath ? first.instancePath : '(root)'
  return { ok: false, error: `Invalid tool args at ${at}: ${first.message ?? 'schema mismatch'}` }
}

/** Calculate cost in USD from token counts and model.
 *  Anthropic returns input_tokens, cache_creation_input_tokens, and cache_read_input_tokens
 *  as separate additive fields. Cache creation costs 25% more; cache reads cost 10% of normal. */
function calculateCost(
  modelId: ModelId,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
): number {
  const pricing = getModelPricing(modelId)
  if (!pricing || (pricing.inputPer1M === 0 && pricing.outputPer1M === 0)) return 0
  // input_tokens is already the non-cached portion; cache tokens are separate
  const inputCost =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (cacheCreationTokens / 1_000_000) * pricing.inputPer1M * 1.25 +
    (cacheReadTokens / 1_000_000) * pricing.inputPer1M * 0.1
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M
  return inputCost + outputCost
}

export interface RunnerOptions {
  message: MessageContent
  agentOverride?: AgentType
  modelOverride?: ModelId | null
  modelTier?: ModelTier
  thinkingMode?: ThinkingMode
  sceneContext?: 'all' | 'selected' | 'auto' | string
  activeTools?: string[]
  history?: ChatMessage[]
  projectId?: string
  // World state references (mutated in-place during execution)
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
  /** Master switch for web research tools — model-agnostic toggle from chat input. */
  researchEnabled?: boolean
  /** Per-provider enabled map for research providers (brave, tavily, exa). */
  researchProviderEnabled?: Record<string, boolean>
  sessionPermissions?: Record<string, string>
  generationOverrides?: Record<string, { provider?: string; prompt?: string; config?: Record<string, any> }>
  autoChooseDefaults?: Record<string, { provider: string; config: Record<string, any> }>
  /** When set (e.g. after user approves storyboard), Director implements this plan from the first turn */
  initialStoryboard?: Storyboard | null
  /** Resume a blocked tool call after permission approval */
  resumeToolCall?: { toolName: string; toolInput: Record<string, unknown> } | null
  // Abort signal — checked between tool iterations to stop when client disconnects
  abortSignal?: AbortSignal
  // Structured logger for correlation and tracing
  logger?: AgentLogger
  // SSE emitter
  emit: (event: SSEEvent) => void
  // Cross-session user memory (persistent preferences)
  userMemories?: Array<{ category: string; key: string; value: string; confidence: number }>
  userId?: string
  // Orchestrator / sub-agent support
  /** Override max tool iterations (sub-agents use a smaller budget). Default: 15. */
  maxIterations?: number
  /** If true, this is a sub-agent run — prevents nested orchestration and adjusts logging. */
  isSubAgent?: boolean
  /** Parent run ID for log correlation when running as a sub-agent. */
  parentRunId?: string
  /** When set, SceneMaker gets a focused prompt with only this scene type's guidance. */
  focusedSceneType?: string
  /** Override default run configuration (timeouts, cost cap, compaction, etc.) */
  runConfig?: Partial<RunConfig>
  /** Model configs for resolving local model endpoints */
  modelConfigs?: import('./model-config').ModelConfig[]
  /** When true, agent stops after plan_scenes for user review (plan-first mode) */
  planFirstMode?: boolean
  /** Director template variant (explainer, onboarding, product-demo) */
  directorTemplate?: string
  /** MP4/export settings including aspect ratio — threaded to scene HTML generation */
  mp4Settings?: import('../types').MP4Settings
  /** Project assets for brand kit and SVG extrusion tools */
  projectAssets?: import('../types/media').ProjectAsset[]
  /** Brand kit data for branding tools */
  brandKit?: import('../types/media').BrandKit | null
}

// ── Vision content formatters ──────────────────────────────────────────────

function extractBase64(dataUri: string): { mimeType: string; data: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return { mimeType: 'image/png', data: '' }
  return { mimeType: match[1], data: match[2] }
}

function toAnthropicContent(content: MessageContent): any {
  if (typeof content === 'string') return content
  return content.map((block) => {
    if (block.type === 'text') return { type: 'text', text: block.text }
    const { mimeType, data } = extractBase64(block.image.dataUri)
    return { type: 'image', source: { type: 'base64', media_type: mimeType, data } }
  })
}

function toOpenAIContent(content: MessageContent): any {
  if (typeof content === 'string') return content
  return content.map((block) => {
    if (block.type === 'text') return { type: 'text', text: block.text }
    return { type: 'image_url', image_url: { url: block.image.dataUri } }
  })
}

function toGeminiParts(content: MessageContent): any[] {
  if (typeof content === 'string') return [{ text: content }]
  return content.map((block) => {
    if (block.type === 'text') return { text: block.text }
    const { mimeType, data } = extractBase64(block.image.dataUri)
    return { inlineData: { mimeType, data } }
  })
}

function emitToolCompleteWithStoryboard(
  emit: (event: SSEEvent) => void,
  toolName: string,
  toolInput: Record<string, unknown>,
  result: ToolResult,
  world: WorldStateMutable,
) {
  emit({ type: 'tool_complete', toolName, toolInput, toolResult: result })
  if (toolName === 'plan_scenes' && result.success && world.storyboard) {
    emit({ type: 'storyboard_proposed', storyboard: world.storyboard })
  }
}

/** Derive a scene's build phase from the tool that just ran and the scene's content state. */
function deriveBuildPhase(
  toolName: string,
  scene: { svgContent?: string; canvasCode?: string; sceneCode?: string; reactCode?: string; lottieSource?: string },
): 'created' | 'generating' | 'rendered' | 'verified' | 'done' | 'deleted' {
  if (toolName === 'delete_scene') return 'deleted'
  if (toolName === 'verify_scene') return 'verified'
  // Polish/metadata tools — scene is functionally done
  if (
    /^(set_transition|add_narration|set_scene_background|set_scene_duration|set_scene_style|set_camera_motion|add_sound_effect|add_background_music|add_interaction|edit_interaction|add_multiple_interactions|connect_scenes)$/.test(
      toolName,
    )
  )
    return 'done'
  if (toolName === 'create_scene') return 'created'
  // Code generation / content modification tools
  if (
    /^(add_layer|write_scene_code|regenerate_layer|patch_layer_code|generate_chart|update_chart|remove_chart|reorder_charts|apply_canvas_motion_template|generate_physics_scene|create_world_scene|migrate_to_react|three_data_scatter_scene|create_zdog_composed_scene)$/.test(
      toolName,
    )
  ) {
    const hasCode = !!(scene.svgContent || scene.canvasCode || scene.sceneCode || scene.reactCode || scene.lottieSource)
    return hasCode ? 'rendered' : 'generating'
  }
  const hasCode = !!(scene.svgContent || scene.canvasCode || scene.sceneCode || scene.reactCode || scene.lottieSource)
  return hasCode ? 'rendered' : 'generating'
}

/** Emit state_change with an incremental scene snapshot so the client can
 *  update the timeline progressively during the agent build. */
function emitIncrementalStateChange(
  emit: (event: SSEEvent) => void,
  result: ToolResult,
  world: WorldStateMutable,
  toolName?: string,
) {
  if (!result.changes?.length) return
  const scene = result.affectedSceneId ? world.scenes.find((s) => s.id === result.affectedSceneId) : undefined
  if (!scene) {
    emit({ type: 'state_change', changes: result.changes })
    return
  }
  const phase = deriveBuildPhase(toolName ?? '', scene)
  if (phase === 'deleted') {
    // Don't emit the deleted scene — let the client remove it via changes array
    emit({ type: 'state_change', changes: result.changes })
    return
  }
  const isStillBuilding = phase !== 'verified' && phase !== 'done'
  emit({
    type: 'state_change',
    changes: result.changes,
    incrementalScene: { ...scene, _building: isStillBuilding, _buildPhase: phase },
  } as any)
}

/**
 * Run the agent execution loop, emitting SSE events throughout.
 * Returns the final accumulated state of scenes and globalStyle after all tool calls.
 */
export async function runAgent(opts: RunnerOptions): Promise<{
  agentType: AgentType
  modelId: ModelId
  fullText: string
  toolCalls: ToolCallRecord[]
  updatedScenes: Scene[]
  updatedGlobalStyle: GlobalStyle
  updatedSceneGraph: SceneGraph
  updatedStoryboard?: Storyboard | null
  updatedZdogLibrary?: any[]
  updatedZdogStudioLibrary?: any[]
  // Recording state (from agent tools)
  recordingCommand?: import('@/types/electron').RecordingCommand
  recordingCommandNonce?: number
  recordingConfig?: import('@/types/electron').RecordingConfig
  recordingAttachSceneId?: string | null
  usage: UsageStats
  logger: AgentLogger
}> {
  const {
    message,
    agentOverride,
    modelOverride,
    thinkingMode,
    sceneContext,
    activeTools,
    history,
    scenes,
    globalStyle,
    projectName,
    outputMode,
    sceneGraph,
    selectedSceneId,
    apiPermissions,
    audioProviderEnabled,
    mediaGenEnabled,
    researchEnabled,
    researchProviderEnabled,
    sessionPermissions,
    abortSignal,
    emit,
  } = opts
  const logger = opts.logger ?? new AgentLogger()
  const rc: RunConfig = { ...DEFAULT_RUN_CONFIG, ...opts.runConfig }
  resetToolStats()

  // Declare tracking variables outside try so catch can access them for partial usage logging
  const pid = opts.projectId ?? 'unknown'
  const runStartTime = Date.now()
  let agentType: AgentType = agentOverride ?? 'scene-maker'
  let modelId: ModelId = 'claude-sonnet-4-6'
  let fullText = ''
  const allToolCalls: ToolCallRecord[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheCreationTokens = 0
  let totalCacheReadTokens = 0
  let totalApiCalls = 0

  try {
    // ── 0. CLI providers — early exit before any LLM setup ─────────────────
    if (modelOverride === 'claude-code' || modelOverride === 'codex-cli') {
      const isClaudeCode = modelOverride === 'claude-code'
      logger.log('run', `${isClaudeCode ? 'Claude Code' : 'Codex CLI'} provider: delegating to CLI subprocess`)
      const runCli = isClaudeCode
        ? (await import('./claude-code-provider')).runWithClaudeCode
        : (await import('./codex-cli-provider')).runWithCodexCli

      // ── Resolve agent type (same logic as in-app path) ──
      const cliAgentType: AgentType = agentOverride ?? 'scene-maker'
      agentType = cliAgentType
      logger.log('run', `CLI agent type: ${cliAgentType}`)

      // ── Build rich system prompt — mirrors the in-app agent's context ──
      // This is the ONLY context Claude Code gets (no CLAUDE.md, no skills, no hooks).

      // 1. World state
      const cliWorldState = buildWorldState(scenes, globalStyle, projectName, outputMode, selectedSceneId ?? null)
      const cliWorldSerialized = serializeWorldState(cliWorldState)

      // 2. Agent-specific persona prompt (director, planner, editor, dop, or scene-maker)
      const resolvedStyle = resolveStyle(globalStyle?.presetId ?? null, globalStyle)
      const { resolveProjectDimensions: resolveDims } = await import('@/lib/dimensions')
      const cliDims = resolveDims((opts as any).aspectRatio ?? '16:9', (opts as any).resolution ?? '1080p')
      const agentBasePrompt = getAgentPrompt(
        cliAgentType,
        resolvedStyle,
        opts.focusedSceneType,
        opts.directorTemplate,
        cliDims,
      )

      // 3. User memories
      const memoriesBlock = opts.userMemories?.length
        ? `\n## User Preferences (from prior sessions)\n${opts.userMemories.map((m) => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')}\n`
        : ''

      // 4. Permission warnings
      const permissionWarnings = [
        `## Cost-Aware Tool Usage`,
        `The following tools call paid external APIs. Use them only when the user explicitly requests:`,
        `- add_narration (TTS via ElevenLabs — ~$0.01-0.05 per generation)`,
        `- generate_avatar_narration / generate_avatar_scene (HeyGen — ~$0.10+ per generation)`,
        `- set_video_layer (Veo3 video generation — expensive)`,
        `- search_images / place_image (stock image search — generally free, but track usage)`,
        `Do NOT call these proactively. Only use when the user asks for narration, avatars, or video.`,
      ].join('\n')

      // 5. Per-agent tool guidance — tells Claude Code which tools to use/avoid per role
      const agentToolGuidance: Record<string, string> = {
        planner: [
          `## Your Role: Planner`,
          `You ONLY create storyboards. Call plan_scenes with a structured storyboard JSON.`,
          `Do NOT create scenes, write code, or use any tool other than plan_scenes.`,
          `Your output is a storyboard for the user to review before building begins.`,
        ].join('\n'),
        director: [
          `## Your Role: Director`,
          `You orchestrate multi-scene video creation. Your workflow:`,
          `1. Call plan_scenes to create a storyboard (hook → build → climax → resolution)`,
          `2. After the user approves, create each scene using write_scene_code or add_layer`,
          `3. Set transitions between scenes`,
          `4. Add narration if requested`,
          `5. Verify each scene`,
          ``,
          `You have access to scene tools, layer tools, audio tools, style tools, and more.`,
          `Focus on narrative arc, pacing, and scene variety.`,
          ``,
          `## Skill Library`,
          `Use search_skills(query) to find animation techniques before building unfamiliar scene types.`,
          `Use load_skill(skillId) to get full implementation guides with code patterns.`,
        ].join('\n'),
        'scene-maker': [
          `## Your Role: Master Builder`,
          `You are the flexible default agent with full creative control.`,
          ``,
          `## Skill Library`,
          `You have a library of animation techniques and rendering patterns. Use these before building unfamiliar things:`,
          `- search_skills(query) — find techniques by description (e.g. "particle explosion", "3D camera flyover")`,
          `- load_skill(skillId) — get the full implementation guide with code patterns and gotchas`,
          `- list_skill_categories() — browse what's available`,
          ``,
          `## How to create/update scenes`,
          `Use the write_scene_code MCP tool to write code directly, or add_layer to trigger AI generation.`,
          `- write_scene_code: pass raw JSX as sceneCode (faster, you write the code)`,
          `- add_layer: describe what you want and the system generates code (costs an extra LLM call)`,
          `- Prefer write_scene_code when you can reason about the code. Use add_layer as a fallback.`,
          ``,
          `You can also use: generate_chart, set_transition, add_narration, set_global_style,`,
          `plan_scenes, verify_scene, create_interaction, apply_physics_to_scene, search_3d_models, etc.`,
          ``,
          `## Multi-Scene Workflow`,
          `When the user asks for multiple scenes (e.g. "create a 5-scene explainer about X"):`,
          `1. First call plan_scenes to create a storyboard`,
          `2. Then create each scene in order using write_scene_code or add_layer`,
          `3. After each scene, call verify_scene`,
          `4. Set transitions between scenes`,
          `5. Add narration if requested (only after scenes are built)`,
          ``,
          `For single-scene requests, skip planning and create directly.`,
        ].join('\n'),
        editor: [
          `## Your Role: Editor`,
          `You make surgical, precise changes to existing scenes. You do NOT create new scenes.`,
          ``,
          `## Before editing, always call read_scene_code or read_scene to see the full code.`,
          `The world state preview is truncated — you need the full source for precise patches.`,
          ``,
          `Your tools: read_scene_code (read full code), patch_layer_code (find-and-replace),`,
          `write_scene_code (full rewrite), regenerate_layer, set_scene_background, set_transition, verify_scene.`,
          ``,
          `Keep changes minimal and targeted. Don't rewrite entire scenes unless asked.`,
        ].join('\n'),
        dop: [
          `## Your Role: Director of Photography`,
          `You control the global visual style. You do NOT create scenes or write scene code.`,
          ``,
          `Your tools: set_global_style, set_all_transitions, set_roughness_all,`,
          `style_scene, set_camera_motion, capture_frame.`,
          ``,
          `Focus on palette, font, roughness, transitions, and camera motion.`,
          `Make the project visually cohesive.`,
        ].join('\n'),
      }
      const roleBlock = agentToolGuidance[cliAgentType] ?? agentToolGuidance['scene-maker']

      // 6. Scene code reference — only for agents that write code
      const codeWritingAgent =
        cliAgentType === 'scene-maker' || cliAgentType === 'director' || cliAgentType === 'editor'
      const sceneCodeReference = codeWritingAgent
        ? [
            `## CRITICAL: Scene code runs in a browser sandbox`,
            ``,
            `All APIs are injected as globals. Do NOT use require(), import statements, or any module system.`,
            `The code runs via Babel in the browser — CommonJS and ES modules are NOT available.`,
            ``,
            `### Available globals (do NOT import — they already exist)`,
            `- useCurrentFrame() — returns current integer frame number`,
            `- useVideoConfig() — returns { fps, width, height, durationInFrames }`,
            `- interpolate(value, inputRange, outputRange, options?) — map a value between ranges`,
            `- spring({ frame, fps, config?, from?, to? }) — spring-based animation`,
            `- Easing.ease, Easing.easeIn, Easing.easeOut, Easing.bezier(x1,y1,x2,y2)`,
            `- AbsoluteFill — full-frame absolute positioning div`,
            `- Sequence — timing container (from, durationInFrames props)`,
            `- React — available globally (React.useState, React.useEffect, etc.)`,
            `- ThreeJSLayer, Canvas2DLayer, D3Layer, SVGLayer, LottieLayer — bridge components`,
            `- CenchCamera — camera motion (see camera section below)`,
            `- WIDTH, HEIGHT, PALETTE, DURATION, FONT, STROKE_COLOR, ROUGHNESS — scene globals`,
            ``,
            `### Scene code pattern`,
            `\`\`\`jsx`,
            `export default function Scene() {`,
            `  const frame = useCurrentFrame();`,
            `  const { fps, durationInFrames } = useVideoConfig();`,
            `  // Pick a DIFFERENT camera move per scene — don't repeat the same one`,
            `  React.useEffect(() => { CenchCamera.pan({ x: -2, y: -1, duration: DURATION }); }, []);`,
            `  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });`,
            `  return (`,
            `    <AbsoluteFill style={{ background: PALETTE[0], fontFamily: FONT }}>`,
            `      <div style={{ opacity, fontSize: 80, fontWeight: 700, color: PALETTE[3] }}>Hello</div>`,
            `    </AbsoluteFill>`,
            `  );`,
            `}`,
            `\`\`\``,
            ``,
            `### Camera motion (VARY per scene — never use the same move for every scene)`,
            `Available moves (pick different ones for different scenes):`,
            `- CenchCamera.kenBurns({ duration: DURATION, endScale: 1.04 }) — subtle slow zoom (use sparingly)`,
            `- CenchCamera.pan({ x: -2, y: -1, duration: DURATION }) — gentle drift in a direction`,
            `- CenchCamera.dollyIn({ targetSelector: '#key-element', toScale: 1.15, at: 2 }) — zoom to element`,
            `- CenchCamera.dollyOut({ startScale: 1.2, duration: DURATION }) — pull back to reveal`,
            `- CenchCamera.presetCinematicPush() — slow forward push (good for reveals)`,
            `- CenchCamera.presetReveal() — dramatic reveal with zoom + rotation`,
            `- CenchCamera.shake({ intensity: 0.5, duration: 0.3, at: 1 }) — impact shake (use once per video max)`,
            `- No camera call at all — static shots work for data-heavy or comparison scenes`,
            `DO NOT default to kenBurns on every scene. Mix pan, dolly, push, and static shots.`,
            ``,
            `### Animation rules`,
            `- Animation is a PURE FUNCTION of frame. No useState for animation state.`,
            `- Use interpolate() and spring() — NOT manual lerp or setTimeout.`,
            `- All motion derived from frame number via useCurrentFrame().`,
            `- Use <Sequence> for temporal composition — children see a local frame starting at 0.`,
            `- Use inline styles (style={{ }}) — no external CSS classes.`,
            ``,
            `### Pacing & narration alignment`,
            `- Do NOT show all content at once. Use <Sequence from={X} durationInFrames={Y}> to reveal content over time.`,
            `- Scene timing: 0-20% background appears, 20-80% content builds in staggered reveals, 80-100% hold for viewer absorption.`,
            `- If narration is added, time visual reveals to match the narration — each point appears as it's spoken.`,
            `- Maximum 5 text blocks per scene. If you have more content, split into multiple scenes.`,
            `- Every element should animate in (opacity, position) — nothing should just "be there" from frame 0.`,
          ].join('\n')
        : ''

      // Design principles are now injected via getAgentPrompt() in prompts.ts
      // (applies to both in-app and CLI agents for code-writing agent types)

      const systemPrompt = [
        agentBasePrompt,
        ``,
        `## Current World State`,
        ``,
        cliWorldSerialized,
        ``,
        roleBlock,
        ``,
        sceneCodeReference,
        ``,
        permissionWarnings,
        memoriesBlock,
        ``,
        `## Context Refresh`,
        `Your initial world state (above) is a snapshot. After creating or editing multiple scenes,`,
        `call get_world_state to refresh your view of the project. This is especially important`,
        `when building 3+ scenes — later scenes may need to reference earlier ones.`,
        ``,
        `## Reading Existing Scenes`,
        `Before editing an existing scene, call read_scene or read_scene_code to see its full code.`,
        `This gives you the complete layer code — essential for patch_layer_code or rewriting.`,
        ``,
        `## Critical Rules`,
        `1. The project is pre-selected. Use MCP tools directly — no need to select_project.`,
        `2. Do NOT create new projects. Add scenes to "${projectName}" (${opts.projectId}).`,
        `3. Keep chat responses concise — the user sees previews in the editor.`,
        `4. After creating scenes, call verify_scene to validate.`,
        `5. NEVER use require() or import statements in scene code. All APIs are globals.`,
        `6. Use PALETTE, FONT, STROKE_COLOR globals from the active style — do not hardcode colors unless overriding.`,
        `7. Match scene types to content: React for layouts/text, Canvas2DLayer for hand-drawn, D3Layer for data, ThreeJSLayer for 3D.`,
      ].join('\n')
      // Build per-agent MCP tool allow list (mirrors native agent's AGENT_TOOLS filtering).
      // Always include utility tools (select_project, refresh_state, list_scenes, read_scene,
      // read_scene_code, write_scene_code, get_world_state) plus the agent's specific tools.
      const cliUtilityTools = [
        'select_project',
        'refresh_state',
        'list_scenes',
        'read_scene',
        'read_scene_code',
        'write_scene_code',
        'get_world_state',
      ]
      const agentToolDefs = AGENT_TOOLS[cliAgentType] ?? ALL_TOOLS
      const agentToolNames = agentToolDefs.map((t) => t.name)
      const allAllowed = [...new Set([...cliUtilityTools, ...agentToolNames])]
      const allowedToolsFlag = allAllowed.map((t) => `mcp__cench-studio__${t}`).join(',')

      // Extract images from message content for CLI providers
      const cliImages =
        typeof message !== 'string'
          ? message
              .filter(
                (b): b is { type: 'image'; image: { dataUri: string; mimeType: string; fileName?: string } } =>
                  b.type === 'image',
              )
              .map((b) => ({ dataUri: b.image.dataUri, mimeType: b.image.mimeType, fileName: b.image.fileName }))
          : []

      // Process conversation history for CLI context (same trimming as API path)
      const cliHistory = history?.length
        ? trimHistory(history.map((m) => ({ role: m.role, content: m.content }))).map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : messageContentToText(m.content),
          }))
        : undefined

      const cliResult = await runCli({
        message: typeof message === 'string' ? message : messageContentToText(message),
        images: cliImages.length > 0 ? cliImages : undefined,
        systemPrompt,
        projectId: opts.projectId ?? '',
        agentType: cliAgentType,
        allowedTools: allowedToolsFlag,
        history: cliHistory,
        model: isClaudeCode
          ? opts.modelTier === 'premium'
            ? 'opus'
            : opts.modelTier === 'budget'
              ? 'haiku'
              : 'sonnet'
          : undefined,
        emit,
        abortSignal: opts.abortSignal,
      })

      // Read updated state from DB — Claude Code wrote scenes via MCP → REST API → DB,
      // so the input scenes/globalStyle/sceneGraph are stale.
      logger.log('run', `CLI run complete. ${cliResult.toolCalls.length} tool calls, reading updated state from DB`)
      let updatedScenes = scenes
      let updatedGlobalStyle = globalStyle
      let updatedSceneGraph = sceneGraph ?? { nodes: [], edges: [], startSceneId: '' }

      if (opts.projectId) {
        try {
          const { readProjectScenesFromTables } = await import('@/lib/db/project-scene-table')
          const { readProjectSceneBlob } = await import('@/lib/db/project-scene-storage')
          const { db } = await import('@/lib/db')
          const { projects } = await import('@/lib/db/schema')
          const { eq } = await import('drizzle-orm')

          const projectRow = await db.select().from(projects).where(eq(projects.id, opts.projectId)).limit(1)
          if (projectRow[0]) {
            const tableBacked = await readProjectScenesFromTables(opts.projectId)
            const blob = readProjectSceneBlob(projectRow[0].description)
            updatedScenes = tableBacked?.scenes ?? blob.scenes ?? scenes
            updatedSceneGraph = blob.sceneGraph ?? updatedSceneGraph
            logger.log(
              'run',
              `DB read: ${updatedScenes.length} scenes (table=${!!tableBacked}, blob=${blob.scenes?.length ?? 0})`,
            )
            for (const s of updatedScenes) {
              const sc = s as any
              logger.log(
                'run',
                `  scene ${sc.id?.slice(0, 8)}… type=${sc.sceneType} react=${sc.reactCode?.length ?? 0} code=${sc.sceneCode?.length ?? 0} html=${sc.sceneHTML?.length ?? 0}`,
              )
            }
            if (projectRow[0].globalStyle) {
              updatedGlobalStyle = projectRow[0].globalStyle as GlobalStyle
            }

            // Regenerate sceneHTML for scenes that have code but no HTML.
            // POST /api/scene writes HTML to disk but doesn't store it in the blob,
            // so scenes read from DB have empty sceneHTML. The client needs sceneHTML
            // to write the file and render the preview.
            const { generateSceneHTML } = await import('@/lib/sceneTemplate')
            const { resolveProjectDimensions } = await import('@/lib/dimensions')
            const dims = resolveProjectDimensions(
              (projectRow[0] as any).mp4Settings?.aspectRatio,
              (projectRow[0] as any).mp4Settings?.resolution,
            )
            for (let i = 0; i < updatedScenes.length; i++) {
              const s = updatedScenes[i] as any
              const hasCode = s.reactCode || s.svgContent || s.canvasCode || s.sceneCode || s.lottieSource
              if (hasCode && !s.sceneHTML) {
                try {
                  s.sceneHTML = generateSceneHTML(s, updatedGlobalStyle, undefined, undefined, dims)
                  logger.log('run', `Regenerated sceneHTML for ${s.id.slice(0, 8)}… (${s.sceneHTML.length} chars)`)
                } catch (e) {
                  logger.error(
                    'run',
                    `Failed to regenerate sceneHTML for ${s.id.slice(0, 8)}…: ${(e as Error).message}`,
                  )
                }
              }
            }
          }
        } catch (err) {
          logger.error('run', `Failed to read updated state from DB after CLI run: ${(err as Error).message}`)
        }
      }

      // Include model tier in modelId so generation logs distinguish CLI runs
      const cliModelTier = isClaudeCode
        ? opts.modelTier === 'premium'
          ? 'opus'
          : opts.modelTier === 'budget'
            ? 'haiku'
            : 'sonnet'
        : 'default'
      return {
        agentType: 'scene-maker',
        modelId: `${modelOverride}:${cliModelTier}` as ModelId,
        fullText: cliResult.fullText,
        toolCalls: cliResult.toolCalls,
        usage: cliResult.usage,
        updatedScenes,
        updatedGlobalStyle,
        updatedSceneGraph,
        logger,
      }
    }

    // ── 1. Route to agent ────────────────────────────────────────────────────

    const messageText = messageContentToText(message)

    logger.log('start', 'Agent run started', {
      message: messageText.slice(0, 200),
      agentOverride: agentOverride ?? 'auto',
      modelOverride: modelOverride ?? 'auto',
      modelTier: opts.modelTier ?? 'auto',
      sceneCount: scenes.length,
      historyLength: (history ?? []).length,
      projectId: pid,
      hasImages: typeof message !== 'string',
    })
    emit({ type: 'thinking' })

    logger.startPhase('route')
    if (agentOverride) {
      agentType = agentOverride
      logger.log('route', `Agent override: ${agentType}`)
    } else {
      // Master Builder is the default — no routing needed
      agentType = 'scene-maker'
      logger.log('route', 'Using Master Builder (default)')
    }
    logger.endPhase('route')

    // Resolve thinking mode: Master Builder defaults to 'deep' for creative reasoning
    const isBuilder = !agentOverride
    const effectiveThinkingMode = thinkingMode ?? (isBuilder ? 'deep' : 'adaptive')

    // ── 2. Build context ─────────────────────────────────────────────────────

    const focusedSceneId = selectedSceneId ?? null
    const contextOpts = {
      agentType,
      activeTools: activeTools ?? [],
      sceneContext: sceneContext ?? (focusedSceneId ? 'selected' : 'all'),
      focusedSceneId,
      audioProviderEnabled,
      mediaGenEnabled,
      researchEnabled,
      researchProviderEnabled,
      projectAssets: opts.projectAssets,
      mp4Settings: opts.mp4Settings,
      brandKit: opts.brandKit,
    }

    logger.startPhase('context')
    let ctx
    try {
      ctx = buildAgentContext(
        agentType,
        contextOpts,
        scenes,
        globalStyle,
        projectName,
        outputMode,
        modelOverride,
        opts.modelTier,
        effectiveThinkingMode,
        opts.enabledModelIds,
        opts.initialStoryboard ?? null,
        opts.userMemories,
        opts.focusedSceneType,
        opts.directorTemplate,
      )
    } catch (err) {
      logger.error('context', `Context build failed: ${(err as Error).message}`)
      emit({ type: 'error', error: `Context build error: ${(err as Error).message}` })
      throw err
    }
    const ctxMs = logger.endPhase('context')

    modelId = ctx.modelId ?? 'claude-sonnet-4-6'
    logger.log('context', 'Context built', {
      durationMs: ctxMs,
      modelId,
      thinkingMode: ctx.thinkingMode,
      toolCount: ctx.tools.length,
      maxTokens: ctx.maxTokens,
      systemPromptLength: ctx.systemPrompt.length,
    })

    const toolDefsByName = new Map(ctx.tools.map((t) => [t.name, t]))

    // Emit agent_routed event — front-loaded before any content streams.
    // Tells the UI which agent was picked, the model, and tool count.
    emit({
      type: 'agent_routed',
      agentType: agentType as import('./types').AgentType,
      modelId: modelId as import('./types').ModelId,
      routeMethod: agentOverride ? 'override' : 'default',
      focusedSceneType: opts.focusedSceneType,
      toolCount: ctx.tools.length,
    })

    // ── 3. Build message history ─────────────────────────────────────────────

    const trimmedHistory = trimHistory(
      (history ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    )

    const messages: any[] = [...(trimmedHistory as any[]), { role: 'user', content: message }]

    // ── 4. Mutable world state for tool execution ────────────────────────────

    const world: WorldStateMutable = {
      scenes: JSON.parse(JSON.stringify(scenes)), // deep clone
      globalStyle: { ...globalStyle },
      projectName,
      projectId: opts.projectId,
      outputMode,
      activeTools: activeTools ?? [],
      sceneGraph: sceneGraph ? JSON.parse(JSON.stringify(sceneGraph)) : { nodes: [], edges: [], startSceneId: '' },
      modelId,
      modelTier: opts.modelTier ?? 'auto',
      ...(opts.initialStoryboard
        ? { storyboard: JSON.parse(JSON.stringify(opts.initialStoryboard)) as Storyboard }
        : {}),
      ...(apiPermissions ? { apiPermissions } : {}),
      ...(audioProviderEnabled ? { audioProviderEnabled } : {}),
      ...(mediaGenEnabled ? { mediaGenEnabled } : {}),
      ...(researchEnabled !== undefined ? { researchEnabled } : {}),
      ...(researchProviderEnabled ? { researchProviderEnabled } : {}),
      ...(sessionPermissions ? { sessionPermissions } : {}),
      ...(opts.generationOverrides ? { generationOverrides: opts.generationOverrides } : {}),
      ...(opts.autoChooseDefaults ? { autoChooseDefaults: opts.autoChooseDefaults } : {}),
      ...(opts.modelConfigs ? { modelConfigs: opts.modelConfigs, localMode: true } : {}),
      ...(opts.mp4Settings ? { mp4Settings: opts.mp4Settings } : {}),
      ...(opts.projectAssets ? { projectAssets: opts.projectAssets } : {}),
      ...(opts.brandKit !== undefined ? { brandKit: opts.brandKit } : {}),
    }

    // ── 4.5 Resume a blocked tool call (permission flow) ───────────────────────
    if (opts.resumeToolCall?.toolName) {
      const { toolName, toolInput } = opts.resumeToolCall
      const toolDef = toolDefsByName.get(toolName)
      if (toolDef) {
        const validation = validateToolInputAgainstSchema(toolDef.input_schema, toolInput)
        if (!validation.ok) {
          emit({ type: 'tool_start', toolName, toolInput })
          emit({ type: 'tool_complete', toolName, toolInput, toolResult: { success: false, error: validation.error } })
        } else {
          emit({ type: 'tool_start', toolName, toolInput })
          let result: ToolResult
          try {
            result = await withTimeout(
              executeTool(toolName, toolInput, world, logger),
              getToolTimeout(toolName),
              `tool:${toolName}`,
            )
          } catch (err) {
            result = { success: false, error: `Tool ${toolName} failed: ${(err as Error).message}` }
          }
          emitToolCompleteWithStoryboard(emit, toolName, toolInput, result, world)
          if (result.affectedSceneId)
            emit({ type: 'preview_update', sceneId: result.affectedSceneId, changes: result.changes })
          emitIncrementalStateChange(emit, result, world, toolName)

          // If permission is still required, stop early so UI can prompt again.
          if (result.permissionNeeded) {
            const api = result.permissionNeeded.api
            const msg = `\n\nPermission required for ${api}. Please approve/deny in the permission card to continue.`
            fullText += msg
            emit({ type: 'token', token: msg })
            emit({
              type: 'done',
              agentType,
              modelId,
              fullText,
              toolCalls: allToolCalls,
              usage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                apiCalls: totalApiCalls,
                costUsd: 0,
                totalDurationMs: Date.now() - runStartTime,
              },
            })
            return {
              agentType,
              modelId,
              fullText,
              toolCalls: allToolCalls,
              updatedScenes: world.scenes,
              updatedGlobalStyle: world.globalStyle,
              updatedSceneGraph: world.sceneGraph,
              updatedStoryboard: world.storyboard ?? null,
              updatedZdogLibrary: world.zdogLibrary,
              updatedZdogStudioLibrary: (world as any).zdogStudioLibrary,
              recordingCommand: (world as any).recordingCommand,
              recordingCommandNonce: (world as any).recordingCommandNonce,
              recordingConfig: (world as any).recordingConfig,
              recordingAttachSceneId: (world as any).recordingAttachSceneId,
              usage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                apiCalls: totalApiCalls,
                costUsd: 0,
                totalDurationMs: Date.now() - runStartTime,
              },
              logger,
            }
          }
        }
      }
    }

    // ── 5. Multi-turn tool loop ──────────────────────────────────────────────

    // ── Run progress tracking ──
    const runProgress: RunProgress = {
      phase: opts.initialStoryboard ? 'build' : 'unknown',
      storyboardScenesPlanned: opts.initialStoryboard?.scenes?.length ?? 0,
      storyboardScenesBuilt: 0,
      iterationsUsed: 0,
      iterationsMax: opts.maxIterations ?? rc.maxToolIterations,
      toolCallsTotal: 0,
      errors: [],
      scenesCreated: [],
      scenesVerified: [],
      scenesWithNarration: [],
    }

    let iteration = 0
    let toolBearingIterations = 0 // tracks iterations that executed tools (for context refresh)
    let storyboardContextInjected = !!opts.initialStoryboard
    const permissionPausesEmitted = new Set<string>()
    const emitPermissionPause = (api: string) => {
      if (permissionPausesEmitted.has(api)) return
      permissionPausesEmitted.add(api)
      const msg = `\n\nPermission required for ${api}. Please approve/deny in the permission card to continue.`
      fullText += msg
      emit({ type: 'token', token: msg })
    }

    const provider = getModelProvider(modelId, opts.modelConfigs)
    // CLI providers are handled by the early-exit at the top of this function
    if (provider === 'local') {
      const localConfig = opts.modelConfigs?.find((m) => m.id === modelId || m.modelId === modelId)
      logger.log(
        'run',
        `Local mode: provider=${provider} model=${modelId} endpoint=${localConfig?.endpoint ?? 'http://localhost:11434'} localModelName=${localConfig?.localModelName ?? modelId}`,
      )
    } else {
      logger.log('run', `Provider: ${provider} model=${modelId}`)
    }

    /** Build a world state refresh message to inject into conversation history.
     *  Called every rc.contextRefreshInterval tool-bearing iterations so the agent
     *  always has an accurate view of what it has built so far. */
    function buildContextRefreshMessage(): string {
      const ws = buildWorldState(world.scenes, world.globalStyle, projectName, outputMode, null)
      const serialized = serializeWorldState(ws)
      const progress = serializeRunProgress(runProgress)
      return `[SYSTEM: Updated project state after ${toolBearingIterations} tool iterations]\n${serialized}\n\n${progress}`
    }

    /** Update run progress based on a completed tool call */
    function updateRunProgress(toolName: string, result: ToolResult) {
      runProgress.toolCallsTotal++
      runProgress.iterationsUsed = iteration

      // Track phase transitions
      if (toolName === 'plan_scenes' && result.success) {
        runProgress.phase = 'style'
        // Reset so the context refresh check re-triggers with the new storyboard
        storyboardContextInjected = false
        if (world.storyboard) {
          runProgress.storyboardScenesPlanned = world.storyboard.scenes?.length ?? 0
        }
      } else if (toolName === 'set_global_style' || toolName === 'set_all_transitions') {
        if (runProgress.phase === 'style' || runProgress.phase === 'unknown') {
          runProgress.phase = 'style'
        }
      } else if (toolName === 'create_scene' && result.success && result.affectedSceneId) {
        runProgress.phase = 'build'
        runProgress.scenesCreated.push(result.affectedSceneId)
        runProgress.storyboardScenesBuilt = runProgress.scenesCreated.length
      } else if (toolName === 'add_layer' || toolName === 'generate_chart') {
        runProgress.phase = 'build'
      } else if (toolName === 'verify_scene' && result.affectedSceneId) {
        runProgress.scenesVerified.push(result.affectedSceneId)
      } else if (toolName === 'add_narration' && result.success && result.affectedSceneId) {
        if (!runProgress.scenesWithNarration.includes(result.affectedSceneId)) {
          runProgress.scenesWithNarration.push(result.affectedSceneId)
        }
      }

      // Track errors
      if (!result.success && result.error && !result.permissionNeeded) {
        runProgress.errors.push({ tool: toolName, error: result.error, resolved: false })
      }
      // Mark errors as resolved if a retry on the same tool succeeded
      if (result.success) {
        for (const e of runProgress.errors) {
          if (e.tool === toolName && !e.resolved) {
            e.resolved = true
            break
          }
        }
      }
    }

    const effectiveMaxIterations = opts.maxIterations ?? rc.maxToolIterations

    while (iteration < effectiveMaxIterations) {
      // Check if the client disconnected before starting another iteration
      if (abortSignal?.aborted) {
        logger.warn('abort', 'Client disconnected, checkpointing', { iteration, toolsCompleted: allToolCalls.length })

        // Persist a run checkpoint so the user can resume later
        if (opts.projectId && world.storyboard && runProgress.scenesCreated.length > 0) {
          try {
            const checkpoint: import('./types').RunCheckpoint = {
              runId: logger.runId,
              agentType,
              modelId,
              storyboard: world.storyboard,
              completedSceneIds: runProgress.scenesCreated,
              remainingSceneIndexes: world.storyboard.scenes
                .map((_, i) => i)
                .filter((i) => {
                  // A storyboard scene is "remaining" if no created scene matches its name
                  const planned = world.storyboard!.scenes[i]
                  return !world.scenes.some((s) => s.name.toLowerCase() === planned.name.toLowerCase())
                }),
              progress: { ...runProgress },
              worldSnapshot: {
                scenes: JSON.parse(JSON.stringify(world.scenes)),
                globalStyle: JSON.parse(JSON.stringify(world.globalStyle)),
                sceneGraph: JSON.parse(JSON.stringify(world.sceneGraph)),
              },
              originalMessage: messageContentToText(message),
              partialUsage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                apiCalls: totalApiCalls,
                costUsd: calculateCost(
                  modelId,
                  totalInputTokens,
                  totalOutputTokens,
                  totalCacheCreationTokens,
                  totalCacheReadTokens,
                ),
                totalDurationMs: Date.now() - runStartTime,
              },
              createdAt: new Date().toISOString(),
              reason: 'disconnect',
            }
            // Retry once on failure — losing checkpoint state is costly
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                await persistRunCheckpoint(opts.projectId, checkpoint)
                logger.log(
                  'abort',
                  `Checkpoint saved: ${runProgress.scenesCreated.length} scenes built, ${checkpoint.remainingSceneIndexes.length} remaining`,
                )
                break
              } catch (e) {
                if (attempt === 0) {
                  logger.warn('abort', `Checkpoint save failed, retrying: ${(e as Error).message}`)
                  await new Promise((r) => setTimeout(r, 500))
                } else {
                  logger.error('abort', `Checkpoint save failed after retry: ${(e as Error).message}`)
                }
              }
            }
          } catch (e) {
            logger.error('abort', `Checkpoint construction failed: ${(e as Error).message}`)
          }
        }
        break
      }
      iteration++
      totalApiCalls++

      // Cost guardrail: abort if accumulated LLM cost exceeds the per-run cap
      const runningCost = calculateCost(
        modelId,
        totalInputTokens,
        totalOutputTokens,
        totalCacheCreationTokens,
        totalCacheReadTokens,
      )
      if (runningCost > rc.maxRunCostUsd) {
        logger.warn('cost', `Run cost $${runningCost.toFixed(3)} exceeds cap $${rc.maxRunCostUsd} — stopping`, {
          iteration,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        })
        const msg = `\n\n⚠ Cost limit reached ($${runningCost.toFixed(2)} / $${rc.maxRunCostUsd.toFixed(2)} cap). Stopping to prevent overspend.`
        fullText += msg
        emit({ type: 'token', token: msg })
        break
      }

      // Tool call guardrail: abort if total tool calls exceed the per-run cap
      if (allToolCalls.length >= rc.maxToolCalls) {
        logger.warn('tools', `Tool call limit reached (${allToolCalls.length}/${rc.maxToolCalls}) — stopping`, {
          iteration,
          toolCalls: allToolCalls.length,
        })
        const msg = `\n\n⚠ Tool call limit reached (${allToolCalls.length} calls). Stopping to prevent runaway execution.`
        fullText += msg
        emit({ type: 'token', token: msg })
        break
      }

      emit({ type: 'iteration_start', iteration, maxIterations: effectiveMaxIterations })
      emit({
        type: 'run_progress',
        runProgress: {
          toolCallsUsed: allToolCalls.length,
          toolCallsMax: rc.maxToolCalls,
          costUsd: calculateCost(
            modelId,
            totalInputTokens,
            totalOutputTokens,
            totalCacheCreationTokens,
            totalCacheReadTokens,
          ),
          costMax: rc.maxRunCostUsd,
          iteration,
          iterationMax: effectiveMaxIterations,
        },
      })
      logger.log('iteration', `Start iteration ${iteration}/${rc.maxToolIterations}`, { iteration, provider, modelId })
      logger.startPhase(`iter_${iteration}`)

      // Separate text from previous iterations with line breaks
      if (fullText.length > 0 && !fullText.endsWith('\n')) {
        fullText += '\n\n'
        emit({ type: 'token', token: '\n\n' })
      }

      if (provider === 'google') {
        // ── Google Gemini execution path ─────────────────────────────────
        const google = getGoogleClient()

        // Build Gemini contents from message history
        const geminiContents: Array<{
          role: string
          parts: Array<{ text?: string; inlineData?: any; functionCall?: any; functionResponse?: any }>
        }> = []
        for (const m of messages) {
          if (typeof m.content === 'string') {
            geminiContents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })
          } else if (Array.isArray(m.content)) {
            // Check if this is a user message with image content blocks
            const hasImageBlocks = m.role === 'user' && m.content.some((c: any) => c.type === 'image')
            if (hasImageBlocks) {
              geminiContents.push({ role: 'user', parts: toGeminiParts(m.content) })
            } else {
              // Tool results from previous iterations
              const parts = m.content.map((c: any) => {
                if (c.type === 'tool_result') {
                  return { functionResponse: { name: c.tool_use_id ?? 'tool', response: { result: c.content } } }
                }
                if (c.type === 'text') return { text: c.text }
                return { text: JSON.stringify(c) }
              })
              geminiContents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts })
            }
          }
        }

        // Convert tools to Gemini function declarations
        // Cast parameters since Gemini SDK expects enum Type instead of string type
        const geminiTools =
          ctx.tools.length > 0
            ? [
                {
                  functionDeclarations: ctx.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.input_schema as any,
                  })),
                },
              ]
            : undefined

        const response = await google.models.generateContentStream({
          model: modelId,
          contents: geminiContents,
          config: {
            systemInstruction: ctx.systemPrompt,
            maxOutputTokens: ctx.maxTokens,
            tools: geminiTools,
          },
        })

        let chunkText = ''
        const toolCallBlocks: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
        // Per-iteration accumulators — Gemini reports cumulative counts per stream call
        let iterInputTokens = 0
        let iterOutputTokens = 0

        for await (const chunk of response) {
          if (chunk.text) {
            chunkText += chunk.text
            fullText += chunk.text
            emit({ type: 'token', token: chunk.text })
          }
          // Collect function calls
          if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.functionCall) {
                const fc = part.functionCall
                toolCallBlocks.push({
                  id: uuidv4(),
                  name: fc.name ?? '',
                  args: (fc.args as Record<string, unknown>) ?? {},
                })
                emit({ type: 'tool_start', toolName: fc.name ?? '', toolInput: fc.args ?? {} })
              }
            }
          }
          // Track usage — Gemini reports cumulative per-call, so use = within the stream
          if (chunk.usageMetadata) {
            iterInputTokens = chunk.usageMetadata.promptTokenCount ?? iterInputTokens
            iterOutputTokens = chunk.usageMetadata.candidatesTokenCount ?? iterOutputTokens
          }
        }

        // Accumulate across iterations with +=
        totalInputTokens += iterInputTokens
        totalOutputTokens += iterOutputTokens

        // Execute tools
        logger.log('iteration', `Gemini: ${toolCallBlocks.length} tool calls to execute`, {
          toolCallCount: toolCallBlocks.length,
        })
        const toolResultParts: Array<{ functionResponse: { name: string; response: unknown } }> = []
        let stopBecausePermission = false
        let stopBecauseInvalidToolArgs = false
        for (const block of toolCallBlocks) {
          if (abortSignal?.aborted) {
            logger.warn('tool', `Skipped ${block.name} — client disconnected`)
            break
          }

          const toolDef = toolDefsByName.get(block.name)
          const validation = toolDef
            ? validateToolInputAgainstSchema(toolDef.input_schema, block.args)
            : { ok: true as const }

          if (!validation.ok) {
            stopBecauseInvalidToolArgs = true
            const result: ToolResult = { success: false, error: validation.error }
            const durationMs = 0
            allToolCalls.push({ id: block.id, toolName: block.name, input: block.args, output: result, durationMs })
            updateRunProgress(block.name, result)
            emitToolCompleteWithStoryboard(emit, block.name, block.args, result, world)
            toolResultParts.push({
              functionResponse: {
                name: block.name,
                response: summarizeToolResult(result),
              },
            })
            break
          }

          logger.log('tool', `Start ${block.name}`, { toolName: block.name, input: block.args })
          const startTime = Date.now()
          let result: ToolResult
          try {
            result = await withRetry(
              () =>
                withTimeout(
                  executeTool(block.name, block.args, world, logger),
                  getToolTimeout(block.name),
                  `tool:${block.name}`,
                ),
              block.name,
              logger,
            )
          } catch (err) {
            logger.error('tool', `${block.name} crashed: ${(err as Error).message}`, { stack: (err as Error).stack })
            result = { success: false, error: `Tool ${block.name} failed: ${(err as Error).message}` }
          }
          const durationMs = Date.now() - startTime
          logger.log('tool', `Complete ${block.name}`, {
            toolName: block.name,
            success: result.success,
            durationMs,
            error: result.error ?? null,
          })

          allToolCalls.push({ id: block.id, toolName: block.name, input: block.args, output: result, durationMs })
          updateRunProgress(block.name, result)
          emitToolCompleteWithStoryboard(emit, block.name, block.args, result, world)
          if (result.affectedSceneId)
            emit({ type: 'preview_update', sceneId: result.affectedSceneId, changes: result.changes })
          emitIncrementalStateChange(emit, result, world, block.name)

          toolResultParts.push({
            functionResponse: {
              name: block.name,
              response: summarizeToolResult(result),
            },
          })

          if (result.permissionNeeded) {
            stopBecausePermission = true
            emitPermissionPause(result.permissionNeeded.api)
          }

          if (stopBecausePermission || stopBecauseInvalidToolArgs) break
        }

        if (stopBecausePermission || stopBecauseInvalidToolArgs) break

        // Add model response to history
        const modelParts: any[] = []
        if (chunkText) modelParts.push({ text: chunkText })
        for (const tc of toolCallBlocks) {
          modelParts.push({ functionCall: { name: tc.name, args: tc.args } })
        }
        if (modelParts.length > 0) messages.push({ role: 'assistant', content: modelParts } as any)

        if (toolResultParts.length > 0) {
          messages.push({ role: 'user', content: toolResultParts } as any)
        }

        // Refresh system prompt once after plan_scenes stores a storyboard
        if (world.storyboard && !storyboardContextInjected) {
          const refreshed = buildAgentContext(
            agentType,
            contextOpts,
            world.scenes,
            world.globalStyle,
            projectName,
            outputMode,
            modelOverride,
            opts.modelTier,
            effectiveThinkingMode,
            opts.enabledModelIds,
            world.storyboard,
            opts.userMemories,
            opts.focusedSceneType,
            opts.directorTemplate,
          )
          ctx.systemPrompt = refreshed.systemPrompt
          ctx.staticPrompt = refreshed.staticPrompt
          ctx.dynamicPrompt = refreshed.dynamicPrompt
          storyboardContextInjected = true
          logger.log('context', 'Refreshed system prompt with storyboard context')
        }

        // Progressive context refresh — keep agent aware of accumulated changes
        if (toolCallBlocks.length > 0) {
          toolBearingIterations++
          if (toolBearingIterations > 0 && toolBearingIterations % rc.contextRefreshInterval === 0) {
            const refreshMsg = buildContextRefreshMessage()
            messages.push({ role: 'user', content: [{ text: refreshMsg }] } as any)
            logger.log('context', `Progressive context refresh at iteration ${iteration}`, { toolBearingIterations })

            // Compact messages to prevent unbounded growth during long builds
            const before = messages.length
            const compacted = compactInFlightMessages(messages, {
              maxTokens: rc.compactionMaxTokens,
              preserveRecent: rc.compactionPreserveRecent,
            })
            if (compacted.length < before) {
              messages.length = 0
              messages.push(...compacted)
              logger.log('context', `Compacted messages: ${before} → ${compacted.length}`, { iteration })
            }
          }
        }

        // Orchestrator handoff (Gemini path)
        if (
          agentType === 'director' &&
          !opts.isSubAgent &&
          world.storyboard &&
          world.storyboard.scenes.length >= 3 &&
          allToolCalls.some((tc) => tc.toolName === 'set_global_style' || tc.toolName === 'set_all_transitions') &&
          !allToolCalls.some((tc) => tc.toolName === 'add_layer')
        ) {
          logger.log('orchestrator', `Handing off to orchestrator (Gemini): ${world.storyboard.scenes.length} scenes`)
          const { runOrchestrated } = await import('./orchestrator')
          const subResults = await runOrchestrated({
            storyboard: world.storyboard,
            parentWorld: world,
            parentOpts: opts,
            emit,
            logger,
            toolBudgetRemaining: rc.maxToolCalls - allToolCalls.length,
            parentCostUsd: calculateCost(
              modelId,
              totalInputTokens,
              totalOutputTokens,
              totalCacheCreationTokens,
              totalCacheReadTokens,
            ),
            maxRunCostUsd: rc.maxRunCostUsd,
          })
          for (const sr of subResults) {
            totalInputTokens += sr.usage.inputTokens
            totalOutputTokens += sr.usage.outputTokens
            totalApiCalls += sr.usage.apiCalls
            allToolCalls.push(...sr.toolCalls)
          }
          const succeeded = subResults.filter((r) => r.success).length
          fullText += `\n\nOrchestration complete: ${succeeded}/${world.storyboard.scenes.length} scenes built.`
          emit({
            type: 'token',
            token: `\n\nOrchestration complete: ${succeeded}/${world.storyboard.scenes.length} scenes built.`,
          })
          logger.endPhase(`iter_${iteration}`)
          break
        }

        const geminiIterMs = logger.endPhase(`iter_${iteration}`)
        logger.log('iteration', `End iteration ${iteration}`, {
          iteration,
          durationMs: geminiIterMs,
          toolCallCount: toolCallBlocks.length,
          textLength: chunkText.length,
          inputTokens: iterInputTokens,
          outputTokens: iterOutputTokens,
        })
        if ((agentType === 'planner' || opts.planFirstMode) && world.storyboard) {
          logger.log('plan-mode', 'Plan-first mode: storyboard saved, stopping loop')
          break
        }
        if (toolCallBlocks.length === 0) break
      } else if (provider === 'openai' || provider === 'local') {
        // ── OpenAI / Local execution path (OpenAI-compatible API) ────────
        const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: 'system', content: ctx.systemPrompt },
          ...messages.map((m) => {
            // Already in OpenAI format (from previous iterations)
            if (m.role === 'tool' || m.tool_calls || m.tool_call_id) return m
            if (m.role === 'user' && Array.isArray(m.content)) {
              // Check for image content blocks (vision input)
              const hasImageBlocks = m.content.some((c: any) => c.type === 'image')
              if (hasImageBlocks) {
                return { role: 'user' as const, content: toOpenAIContent(m.content) }
              }
              // Anthropic-format tool results from history — flatten to text
              return {
                role: 'user' as const,
                content: m.content.map((c: any) => (typeof c === 'string' ? c : JSON.stringify(c))).join('\n'),
              }
            }
            if (m.role === 'assistant' && Array.isArray(m.content)) {
              // Anthropic-format assistant content blocks from history
              const text = m.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('')
              const toolCalls = m.content
                .filter((c: any) => c.type === 'tool_use')
                .map((c: any) => ({
                  id: c.id,
                  type: 'function' as const,
                  function: { name: c.name, arguments: JSON.stringify(c.input) },
                }))
              return {
                role: 'assistant' as const,
                content: text || null,
                ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
              }
            }
            return {
              role: m.role as 'user' | 'assistant',
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            }
          }),
        ]

        const openaiTools: OpenAI.ChatCompletionTool[] = ctx.tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.input_schema as any },
        }))

        // Resolve the correct client: OpenAI SDK for cloud, or local Ollama endpoint
        let oaiClient: OpenAI
        let oaiModelId = modelId
        if (provider === 'local') {
          const localConfig = opts.modelConfigs?.find((m) => m.id === modelId || m.modelId === modelId)
          const endpoint = localConfig?.endpoint ?? process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
          logger.log('iteration', `Local LLM: endpoint=${endpoint} model=${localConfig?.localModelName ?? modelId}`)
          oaiClient = getLocalClient(endpoint)
          oaiModelId = (localConfig?.localModelName ?? modelId) as any
        } else {
          oaiClient = getOpenAIClient()
        }

        // Local models may not support tools — skip tool parameter if supportsTools is false
        const localConfig =
          provider === 'local' ? opts.modelConfigs?.find((m) => m.id === modelId || m.modelId === modelId) : null
        const supportsTools = localConfig ? localConfig.supportsTools !== false : true

        let stream: any
        try {
          stream = await oaiClient.chat.completions.create({
            model: oaiModelId as string,
            max_tokens: ctx.maxTokens,
            messages: openaiMessages,
            tools: supportsTools && openaiTools.length > 0 ? openaiTools : undefined,
            stream: true,
            // Ollama may not support stream_options — only send for OpenAI cloud
            ...(provider !== 'local' ? { stream_options: { include_usage: true } } : {}),
          })
        } catch (connectErr) {
          const errMsg = (connectErr as Error).message ?? 'Unknown error'
          logger.error('iteration', `Failed to connect to ${provider === 'local' ? 'Ollama' : 'OpenAI'}: ${errMsg}`)
          const userMsg =
            provider === 'local'
              ? `Failed to connect to Ollama at ${(oaiClient as any)?.baseURL ?? 'localhost:11434'}. Make sure Ollama is running (\`ollama serve\`) and the model is pulled.`
              : `Failed to connect to OpenAI: ${errMsg}`
          fullText += `\n\n${userMsg}`
          emit({ type: 'token', token: `\n\n${userMsg}` })
          break
        }

        let chunkText = ''
        const toolCallAccum: Record<number, { id: string; name: string; args: string }> = {}
        let finishReason: string | null = null
        let oaiIterInputTokens = 0
        let oaiIterOutputTokens = 0

        for await (const chunk of withInactivityTimeout<any>(
          stream,
          STREAM_INACTIVITY_TIMEOUT_MS,
          'OpenAI/local stream',
        )) {
          const delta = chunk.choices[0]?.delta
          if (chunk.usage) {
            const inTok = chunk.usage.prompt_tokens ?? 0
            const outTok = chunk.usage.completion_tokens ?? 0
            totalInputTokens += inTok
            totalOutputTokens += outTok
            oaiIterInputTokens += inTok
            oaiIterOutputTokens += outTok
          }
          if (!delta) continue

          if (delta.content) {
            chunkText += delta.content
            fullText += delta.content
            emit({ type: 'token', token: delta.content })
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallAccum[tc.index]) {
                toolCallAccum[tc.index] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' }
                if (tc.function?.name) emit({ type: 'tool_start', toolName: tc.function.name, toolInput: {} })
              }
              if (tc.function?.arguments) {
                toolCallAccum[tc.index].args += tc.function.arguments
              }
            }
          }

          if (chunk.choices[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason
          }
        }

        const toolUseBlocks = Object.values(toolCallAccum)

        // Execute tools
        logger.log(
          'iteration',
          `${provider === 'local' ? 'Local' : 'OpenAI'}: ${toolUseBlocks.length} tool calls to execute`,
          {
            toolCallCount: toolUseBlocks.length,
          },
        )
        const toolResultMsgs: OpenAI.ChatCompletionToolMessageParam[] = []
        let stopBecausePermission = false
        let stopBecauseInvalidToolArgs = false
        for (const block of toolUseBlocks) {
          if (abortSignal?.aborted) {
            logger.warn('tool', `Skipped ${block.name} — client disconnected`)
            break
          }
          let toolInput: Record<string, unknown> = {}
          let toolInputError: string | null = null

          const argsStr = typeof block.args === 'string' ? block.args : ''
          if (argsStr.trim().length === 0) {
            toolInput = {}
          } else {
            try {
              toolInput = JSON.parse(argsStr)
            } catch (e) {
              toolInputError = `Invalid JSON args for tool "${block.name}": ${(e as Error).message}`
            }
          }

          const toolDef = toolDefsByName.get(block.name)
          const validation = toolDef
            ? validateToolInputAgainstSchema(toolDef.input_schema, toolInput)
            : { ok: true as const }

          if (!validation.ok) toolInputError = validation.error

          if (toolInputError) {
            stopBecauseInvalidToolArgs = true
            const result: ToolResult = { success: false, error: toolInputError }
            const durationMs = 0
            allToolCalls.push({ id: block.id, toolName: block.name, input: toolInput, output: result, durationMs })
            updateRunProgress(block.name, result)
            emitToolCompleteWithStoryboard(emit, block.name, toolInput, result, world)
            toolResultMsgs.push({
              role: 'tool',
              tool_call_id: block.id,
              content: JSON.stringify(summarizeToolResult(result)),
            })
            break
          }

          logger.log('tool', `Start ${block.name}`, { toolName: block.name, input: toolInput })
          const startTime = Date.now()
          let result: ToolResult
          try {
            result = await withRetry(
              () =>
                withTimeout(
                  executeTool(block.name, toolInput, world, logger),
                  getToolTimeout(block.name),
                  `tool:${block.name}`,
                ),
              block.name,
              logger,
            )
          } catch (err) {
            logger.error('tool', `${block.name} crashed: ${(err as Error).message}`, { stack: (err as Error).stack })
            result = { success: false, error: `Tool ${block.name} failed: ${(err as Error).message}` }
          }
          const durationMs = Date.now() - startTime
          logger.log('tool', `Complete ${block.name}`, {
            toolName: block.name,
            success: result.success,
            durationMs,
            error: result.error ?? null,
          })

          allToolCalls.push({ id: block.id, toolName: block.name, input: toolInput, output: result, durationMs })
          updateRunProgress(block.name, result)
          emitToolCompleteWithStoryboard(emit, block.name, toolInput, result, world)
          if (result.affectedSceneId)
            emit({ type: 'preview_update', sceneId: result.affectedSceneId, changes: result.changes })
          emitIncrementalStateChange(emit, result, world, block.name)

          if (result.permissionNeeded) {
            stopBecausePermission = true
            emitPermissionPause(result.permissionNeeded.api)
          }

          toolResultMsgs.push({
            role: 'tool',
            tool_call_id: block.id,
            content: JSON.stringify(summarizeToolResult(result)),
          })

          if (stopBecausePermission || stopBecauseInvalidToolArgs) break
        }

        if (stopBecausePermission || stopBecauseInvalidToolArgs) {
          break
        }

        // Build assistant message for history
        const assistantMsg: any = { role: 'assistant', content: chunkText || null }
        if (toolUseBlocks.length > 0) {
          assistantMsg.tool_calls = toolUseBlocks.map((b) => ({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: b.args },
          }))
        }
        messages.push(assistantMsg)

        if (toolResultMsgs.length > 0) {
          messages.push(...(toolResultMsgs as any))
        }

        // Refresh system prompt once after plan_scenes stores a storyboard
        if (world.storyboard && !storyboardContextInjected) {
          const refreshed = buildAgentContext(
            agentType,
            contextOpts,
            world.scenes,
            world.globalStyle,
            projectName,
            outputMode,
            modelOverride,
            opts.modelTier,
            effectiveThinkingMode,
            opts.enabledModelIds,
            world.storyboard,
            opts.userMemories,
            opts.focusedSceneType,
            opts.directorTemplate,
          )
          ctx.systemPrompt = refreshed.systemPrompt
          ctx.staticPrompt = refreshed.staticPrompt
          ctx.dynamicPrompt = refreshed.dynamicPrompt
          storyboardContextInjected = true
          logger.log('context', 'Refreshed system prompt with storyboard context')
        }

        // Progressive context refresh — keep agent aware of accumulated changes
        if (toolUseBlocks.length > 0) {
          toolBearingIterations++
          if (toolBearingIterations > 0 && toolBearingIterations % rc.contextRefreshInterval === 0) {
            const refreshMsg = buildContextRefreshMessage()
            messages.push({ role: 'user' as const, content: refreshMsg } as any)
            logger.log('context', `Progressive context refresh at iteration ${iteration}`, { toolBearingIterations })

            // Compact messages to prevent unbounded growth during long builds
            const before = messages.length
            const compacted = compactInFlightMessages(messages, {
              maxTokens: rc.compactionMaxTokens,
              preserveRecent: rc.compactionPreserveRecent,
            })
            if (compacted.length < before) {
              messages.length = 0
              messages.push(...compacted)
              logger.log('context', `Compacted messages: ${before} → ${compacted.length}`, { iteration })
            }
          }
        }

        // Orchestrator handoff (OpenAI path)
        if (
          agentType === 'director' &&
          !opts.isSubAgent &&
          world.storyboard &&
          world.storyboard.scenes.length >= 3 &&
          allToolCalls.some((tc) => tc.toolName === 'set_global_style' || tc.toolName === 'set_all_transitions') &&
          !allToolCalls.some((tc) => tc.toolName === 'add_layer')
        ) {
          logger.log(
            'orchestrator',
            `Handing off to orchestrator (${provider}): ${world.storyboard.scenes.length} scenes`,
          )
          const { runOrchestrated } = await import('./orchestrator')
          const subResults = await runOrchestrated({
            storyboard: world.storyboard,
            parentWorld: world,
            parentOpts: opts,
            emit,
            logger,
            toolBudgetRemaining: rc.maxToolCalls - allToolCalls.length,
            parentCostUsd: calculateCost(
              modelId,
              totalInputTokens,
              totalOutputTokens,
              totalCacheCreationTokens,
              totalCacheReadTokens,
            ),
            maxRunCostUsd: rc.maxRunCostUsd,
          })
          for (const sr of subResults) {
            totalInputTokens += sr.usage.inputTokens
            totalOutputTokens += sr.usage.outputTokens
            totalApiCalls += sr.usage.apiCalls
            allToolCalls.push(...sr.toolCalls)
          }
          const succeeded = subResults.filter((r) => r.success).length
          fullText += `\n\nOrchestration complete: ${succeeded}/${world.storyboard.scenes.length} scenes built.`
          emit({
            type: 'token',
            token: `\n\nOrchestration complete: ${succeeded}/${world.storyboard.scenes.length} scenes built.`,
          })
          logger.endPhase(`iter_${iteration}`)
          break
        }

        const oaiIterMs = logger.endPhase(`iter_${iteration}`)
        logger.log('iteration', `End iteration ${iteration}`, {
          iteration,
          durationMs: oaiIterMs,
          toolCallCount: toolUseBlocks.length,
          stopReason: finishReason,
          textLength: chunkText.length,
          inputTokens: oaiIterInputTokens,
          outputTokens: oaiIterOutputTokens,
        })
        if ((agentType === 'planner' || opts.planFirstMode) && world.storyboard) {
          logger.log('plan-mode', 'Plan-first mode: storyboard saved, stopping loop')
          break
        }
        // ── Local model fallback: generate scene code directly ─────────
        // Many local models can't use tool calling. When the model outputs text
        // but no tool calls, make a second call with a focused code-generation
        // prompt and inject the result directly into the scene.
        if (provider === 'local' && toolUseBlocks.length === 0 && chunkText.trim().length > 10 && iteration === 1) {
          const focusedScene = world.scenes.find((s: any) => s.id === selectedSceneId) ?? world.scenes[0]
          if (focusedScene) {
            logger.log('tool', 'Local fallback: model did not use tools — generating scene code directly')
            emit({ type: 'token', token: '\n\n_Generating scene code..._\n' })
            fullText += '\n\n_Generating scene code..._\n'

            try {
              const { generateCode: genCode } = await import('../generation/generate')
              const userPrompt = messageContentToText(message)
              const genResult = await genCode('motion', userPrompt, {
                palette: world.globalStyle.palette,
                bgColor: focusedScene.bgColor,
                duration: focusedScene.duration,
                font: world.globalStyle.font,
                modelId: modelId,
                modelTier: opts.modelTier,
                modelConfigs: opts.modelConfigs,
              })

              if (genResult.code && genResult.code.length > 20) {
                // Update scene directly
                const { updateScene } = await import('./tool-handlers/_shared')
                const { generateSceneHTML } = await import('../sceneTemplate')
                const { resolveProjectDimensions } = await import('../dimensions')
                const fs = await import('fs/promises')
                const path = await import('path')

                updateScene(world, focusedScene.id, {
                  sceneType: 'motion',
                  sceneCode: genResult.code,
                  sceneStyles: genResult.styles || '',
                  prompt: userPrompt,
                })
                // Generate and write HTML
                const updatedScene = world.scenes.find((s) => s.id === focusedScene.id)!
                const html = generateSceneHTML(
                  updatedScene,
                  world.globalStyle,
                  undefined,
                  undefined,
                  resolveProjectDimensions(world.mp4Settings?.aspectRatio, world.mp4Settings?.resolution),
                )
                updateScene(world, focusedScene.id, { sceneHTML: html })
                const scenesDir = path.join(process.cwd(), 'public', 'scenes')
                await fs.mkdir(scenesDir, { recursive: true })
                await fs.writeFile(path.join(scenesDir, `${focusedScene.id}.html`), html, 'utf-8')

                emit({
                  type: 'preview_update',
                  sceneId: focusedScene.id,
                  changes: [
                    { type: 'scene_updated', sceneId: focusedScene.id, description: 'Generated scene code (local)' },
                  ],
                })
                emit({
                  type: 'state_change',
                  changes: [
                    { type: 'scene_updated', sceneId: focusedScene.id, description: 'Generated scene code (local)' },
                  ],
                })

                const doneMsg = `_Scene generated successfully._`
                fullText += doneMsg
                emit({ type: 'token', token: doneMsg })
                logger.log('tool', `Local fallback: scene code generated (${genResult.code.length} chars)`)
              } else {
                logger.warn('tool', 'Local fallback: generateCode returned empty/short code')
              }
            } catch (genErr) {
              logger.error('tool', `Local fallback code generation failed: ${(genErr as Error).message}`)
              const errMsg = `\n_Code generation failed: ${(genErr as Error).message}_`
              fullText += errMsg
              emit({ type: 'token', token: errMsg })
            }
          }
        }

        if (toolUseBlocks.length === 0 || finishReason === 'stop') break
      } else {
        // ── Anthropic execution path (default) ───────────────────────────

        // Build thinking config for this call
        const thinkingParam =
          ctx.thinkingMode !== 'off'
            ? { thinking: { type: 'enabled' as const, budget_tokens: THINKING_BUDGETS[ctx.thinkingMode] } }
            : {}

        // Convert image content blocks to Anthropic format for vision support
        const anthropicMessages = messages.map((m) => {
          if (m.role === 'user' && Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image')) {
            return { ...m, content: toAnthropicContent(m.content) }
          }
          return m
        })

        // Call Claude with streaming — split system prompt for prompt caching.
        // Static portion (agent persona + rules) gets cache_control: ephemeral → stays cache-hot.
        // Dynamic portion (world state, storyboard) is uncached → changes each turn without invalidating cache.
        const systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = []
        if (ctx.staticPrompt) {
          systemBlocks.push({
            type: 'text' as const,
            text: ctx.staticPrompt,
            cache_control: { type: 'ephemeral' as const },
          })
        }
        if (ctx.dynamicPrompt) {
          systemBlocks.push({ type: 'text' as const, text: ctx.dynamicPrompt })
        }
        // Fallback: if split isn't available, use full prompt with cache
        if (systemBlocks.length === 0) {
          systemBlocks.push({
            type: 'text' as const,
            text: ctx.systemPrompt,
            cache_control: { type: 'ephemeral' as const },
          })
        }

        const createParams = {
          model: modelId as string,
          max_tokens: ctx.maxTokens,
          system: systemBlocks,
          tools: ctx.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema,
          })),
          messages: anthropicMessages,
          stream: true as const,
          ...thinkingParam,
        }
        let stream: ReturnType<typeof anthropicClient.messages.stream>
        try {
          stream = anthropicClient.messages.stream(
            createParams as Parameters<typeof anthropicClient.messages.stream>[0],
          )
        } catch (err) {
          console.error('[Agent] Anthropic stream creation failed:', err)
          throw err // outer catch emits error event to client
        }

        // Accumulate streaming response
        let chunkText = ''
        let thinkingBuffer = ''
        let currentBlockType: 'thinking' | 'text' | 'tool_use' | null = null
        const toolUseBlocks: Array<{
          id: string
          name: string
          input: string // JSON string being built
        }> = []
        let currentToolIndex = -1
        let stopReason: string | null = null

        for await (const event of withInactivityTimeout(stream, STREAM_INACTIVITY_TIMEOUT_MS, 'Anthropic stream')) {
          switch (event.type) {
            case 'content_block_start': {
              const blockType = (event.content_block as { type: string }).type
              currentBlockType = blockType as 'thinking' | 'text' | 'tool_use'

              if (blockType === 'thinking') {
                thinkingBuffer = ''
                emit({ type: 'thinking_start' })
              } else if (blockType === 'text') {
                // text block starting
              } else if (blockType === 'tool_use') {
                const tb = event.content_block as { id: string; name: string }
                currentToolIndex = toolUseBlocks.length
                toolUseBlocks.push({
                  id: tb.id,
                  name: tb.name,
                  input: '',
                })
                emit({ type: 'tool_start', toolName: tb.name, toolInput: {} })
              } else if (blockType === 'server_tool_use') {
                // Anthropic-native server tool (e.g. web_search_20250305). Runs on
                // Anthropic's side — we don't execute it, just surface it in the UI.
                const tb = event.content_block as { id: string; name: string; input?: unknown }
                emit({ type: 'tool_start', toolName: tb.name, toolInput: (tb.input as Record<string, unknown>) ?? {} })
              } else if (blockType === 'web_search_tool_result') {
                // Results for the native web_search server tool. No handler runs;
                // emit a completion event so the chat UI can render the result pill.
                const tb = event.content_block as {
                  tool_use_id?: string
                  content?: Array<{ type: string; title?: string; url?: string }>
                }
                const count = Array.isArray(tb.content) ? tb.content.length : 0
                emit({
                  type: 'tool_complete',
                  toolName: 'web_search',
                  toolInput: {},
                  toolResult: {
                    success: true,
                    affectedSceneId: null,
                    changes: [
                      {
                        type: 'global_updated',
                        description: `web_search returned ${count} result${count === 1 ? '' : 's'}`,
                      },
                    ],
                    data: { results: tb.content ?? [] },
                  },
                })
              }
              break
            }

            case 'content_block_delta': {
              const deltaType = (event.delta as { type: string }).type
              if (deltaType === 'thinking_delta') {
                const thinking = (event.delta as { thinking: string }).thinking
                thinkingBuffer += thinking
                emit({ type: 'thinking_token', token: thinking })
              } else if (deltaType === 'text_delta') {
                const text = (event.delta as { text: string }).text
                chunkText += text
                fullText += text
                emit({ type: 'token', token: text })
              } else if (deltaType === 'input_json_delta' && currentToolIndex >= 0) {
                toolUseBlocks[currentToolIndex].input += (event.delta as { partial_json: string }).partial_json
              }
              break
            }

            case 'content_block_stop': {
              if (currentBlockType === 'thinking' && thinkingBuffer) {
                emit({ type: 'thinking_complete', fullThinking: thinkingBuffer })
              }
              currentBlockType = null
              break
            }

            case 'message_delta': {
              stopReason = event.delta.stop_reason ?? null
              if ('usage' in event && event.usage) {
                const u = event.usage as { output_tokens?: number }
                if (u.output_tokens) totalOutputTokens += u.output_tokens
              }
              break
            }

            case 'message_start': {
              if ('message' in event && event.message?.usage) {
                const u = event.message.usage as {
                  input_tokens?: number
                  cache_creation_input_tokens?: number
                  cache_read_input_tokens?: number
                }
                if (u.input_tokens) totalInputTokens += u.input_tokens
                if (u.cache_creation_input_tokens) totalCacheCreationTokens += u.cache_creation_input_tokens
                if (u.cache_read_input_tokens) totalCacheReadTokens += u.cache_read_input_tokens
              }
              break
            }
          }
        }

        console.log(`[Agent] Stream complete: ${toolUseBlocks.length} tool calls, stopReason=${stopReason}`)

        let finalMsg: Anthropic.Message
        try {
          console.log('[Agent] Awaiting finalMessage...')
          finalMsg = await withTimeout(stream.finalMessage(), rc.finalMessageTimeoutMs, 'stream.finalMessage()')
          console.log(
            `[Agent] finalMessage received: ${finalMsg.content.length} content blocks, stop_reason=${finalMsg.stop_reason}`,
          )
        } catch (err) {
          console.error('[Agent] finalMessage() failed:', err)
          // Abort the stream to release the underlying HTTP connection
          // instead of leaving it in a partially-consumed state.
          try {
            stream.abort()
          } catch {
            /* best-effort cleanup */
          }
          logger.warn('tokens', 'finalMessage() failed — using streaming token counts as fallback')
          finalMsg = {
            id: '',
            type: 'message',
            role: 'assistant',
            content: [],
            model: modelId,
            stop_reason: stopReason as any,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }
        }

        // Use finalMessage().usage as source of truth for token counts.
        // Streaming deltas can undercount by 2-5% due to cache overhead and framing.
        if (finalMsg.usage && (finalMsg.usage.input_tokens > 0 || finalMsg.usage.output_tokens > 0)) {
          const streamInput = totalInputTokens
          const streamOutput = totalOutputTokens
          totalInputTokens = finalMsg.usage.input_tokens
          totalOutputTokens = finalMsg.usage.output_tokens
          totalCacheCreationTokens = (finalMsg.usage as any).cache_creation_input_tokens ?? totalCacheCreationTokens
          totalCacheReadTokens = (finalMsg.usage as any).cache_read_input_tokens ?? totalCacheReadTokens
          const inputDelta = Math.abs(totalInputTokens - streamInput)
          const outputDelta = Math.abs(totalOutputTokens - streamOutput)
          if (
            (streamInput > 0 && inputDelta > streamInput * 0.01) ||
            (streamOutput > 0 && outputDelta > streamOutput * 0.01)
          ) {
            logger.warn(
              'tokens',
              `Token count discrepancy >1%: input Δ${inputDelta} (${streamInput}→${totalInputTokens}), output Δ${outputDelta} (${streamOutput}→${totalOutputTokens})`,
            )
          }
        }

        const assistantContent = finalMsg.content

        // Execute tools and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        // Parse all tool inputs first
        const parsedBlocks = toolUseBlocks.map((block) => {
          let toolInput: Record<string, unknown> = {}
          let inputError: string | null = null

          const inputStr = typeof block.input === 'string' ? block.input : ''
          if (inputStr.trim().length > 0) {
            try {
              toolInput = JSON.parse(inputStr)
            } catch (e) {
              inputError = `Invalid JSON args for tool "${block.name}": ${(e as Error).message}`
            }
          } else {
            toolInput = {}
          }

          if (!inputError) {
            const toolDef = toolDefsByName.get(block.name)
            if (toolDef) {
              const validation = validateToolInputAgainstSchema(toolDef.input_schema, toolInput)
              if (!validation.ok) inputError = validation.error
            }
          }

          return { ...block, parsedInput: toolInput, inputError }
        })

        // Preserve model-declared tool order. We only parallelize contiguous runs of
        // generation tools when each targets a distinct sceneId.
        function isParallelizableBlock(block: (typeof parsedBlocks)[0]): boolean {
          return !block.inputError && PARALLELIZABLE_TOOLS.has(block.name) && !!(block.parsedInput as any).sceneId
        }

        let stopBecausePermission = false
        let stopBecauseInvalidToolArgs = false

        async function executeAndEmit(
          block: (typeof parsedBlocks)[0],
          isolatedWorld?: WorldStateMutable,
        ): Promise<{ block: (typeof parsedBlocks)[0]; result: ToolResult; durationMs: number }> {
          // Abort check before expensive tool execution
          if (abortSignal?.aborted) {
            logger.warn('tool', `Skipped ${block.name} — client disconnected`)
            return { block, result: { success: false, error: 'Aborted: client disconnected' }, durationMs: 0 }
          }

          if (stopBecausePermission) {
            return { block, result: { success: false, error: 'Stopped due to permission request' }, durationMs: 0 }
          }

          if (block.inputError) {
            stopBecauseInvalidToolArgs = true
            return { block, result: { success: false, error: block.inputError }, durationMs: 0 }
          }

          // Build a preview of tool inputs (truncate large strings)
          const inputPreview: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(block.parsedInput)) {
            if (typeof v === 'string' && v.length > 150) {
              inputPreview[k] = `${v.slice(0, 150)}… [${v.length} chars]`
            } else {
              inputPreview[k] = v
            }
          }
          logger.log('tool', `Start ${block.name}`, {
            toolName: block.name,
            sceneId: block.parsedInput.sceneId ?? null,
            input: inputPreview,
          })
          const startTime = Date.now()
          let result: ToolResult
          try {
            result = await withRetry(
              () =>
                withTimeout(
                  executeTool(block.name, block.parsedInput, isolatedWorld ?? world, logger),
                  getToolTimeout(block.name),
                  `tool:${block.name}`,
                ),
              block.name,
              logger,
            )
          } catch (err) {
            logger.error('tool', `${block.name} crashed: ${(err as Error).message}`, { stack: (err as Error).stack })
            result = { success: false, error: `Tool ${block.name} failed: ${(err as Error).message}` }
          }

          if (result.permissionNeeded) {
            stopBecausePermission = true
            emitPermissionPause(result.permissionNeeded.api)
          }

          const durationMs = Date.now() - startTime
          logger.log('tool', `Complete ${block.name}`, {
            toolName: block.name,
            success: result.success,
            durationMs,
            affectedSceneId: result.affectedSceneId ?? null,
          })
          return { block, result, durationMs }
        }

        function recordToolResult({
          block,
          result,
          durationMs,
        }: {
          block: (typeof parsedBlocks)[0]
          result: ToolResult
          durationMs: number
        }) {
          allToolCalls.push({
            id: block.id,
            toolName: block.name,
            input: block.parsedInput,
            output: result,
            durationMs,
          })
          emitToolCompleteWithStoryboard(emit, block.name, block.parsedInput, result, world)
          if (result.affectedSceneId)
            emit({ type: 'preview_update', sceneId: result.affectedSceneId, changes: result.changes })
          emitIncrementalStateChange(emit, result, world, block.name)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(summarizeToolResult(result)),
          })
          updateRunProgress(block.name, result)
        }

        let i = 0
        while (i < parsedBlocks.length) {
          if (stopBecausePermission || stopBecauseInvalidToolArgs) break

          const startBlock = parsedBlocks[i]
          if (!isParallelizableBlock(startBlock)) {
            recordToolResult(await executeAndEmit(startBlock))
            i += 1
            continue
          }

          // Build a contiguous candidate batch and ensure unique scene targets.
          const batch: typeof parsedBlocks = []
          const batchSceneIds = new Set<string>()
          let j = i
          while (j < parsedBlocks.length) {
            const block = parsedBlocks[j]
            if (!isParallelizableBlock(block)) break
            const sceneId = (block.parsedInput as any).sceneId as string
            if (batchSceneIds.has(sceneId)) break
            batch.push(block)
            batchSceneIds.add(sceneId)
            j += 1
          }

          if (batch.length <= 1) {
            recordToolResult(await executeAndEmit(startBlock))
            i += 1
            continue
          }

          logger.log('tool_parallel', `Parallelizing ${batch.length} tools`, {
            count: batch.length,
            sceneIds: [...batchSceneIds],
          })

          const parallelStart = Date.now()
          const baseStyleSnapshot = JSON.parse(JSON.stringify(world.globalStyle))
          // Deep-clone the entire world for each parallel batch to prevent
          // cross-batch mutations on any property (storyboard, timeline, etc.)
          const isolatedWorlds = batch.map(() => JSON.parse(JSON.stringify(world)) as typeof world)
          const results = await Promise.all(batch.map((b, idx) => executeAndEmit(b, isolatedWorlds[idx])))

          // Serialize base style once for comparison (not per-property)
          const baseStyleStr = JSON.stringify(baseStyleSnapshot)

          for (let k = 0; k < results.length; k++) {
            const { result } = results[k]
            if (result.affectedSceneId) {
              const updatedScene = isolatedWorlds[k].scenes.find((s: Scene) => s.id === result.affectedSceneId)
              if (updatedScene) {
                const worldIdx = world.scenes.findIndex((s) => s.id === result.affectedSceneId)
                if (worldIdx !== -1) world.scenes[worldIdx] = updatedScene
                else world.scenes.push(updatedScene)
              }
            }

            // Merge style changes: only apply if the isolated world's style diverged.
            // Full replacement (clear + assign) so nested objects like palette are reverted.
            const isoStyle = isolatedWorlds[k].globalStyle
            if (JSON.stringify(isoStyle) !== baseStyleStr) {
              const cloned = JSON.parse(JSON.stringify(isoStyle))
              for (const key of Object.keys(world.globalStyle)) {
                delete (world.globalStyle as unknown as Record<string, unknown>)[key]
              }
              Object.assign(world.globalStyle, cloned)
            }

            recordToolResult(results[k])
          }

          logger.log('tool_parallel', 'Parallel batch complete', {
            count: results.length,
            totalDurationMs: Date.now() - parallelStart,
          })

          i = j
        }

        if (stopBecausePermission || stopBecauseInvalidToolArgs) {
          break
        }

        // Post-tool cost check: catch single-tool overspend that the pre-iteration
        // check at the top of the loop can't see (it only fires before the next iteration).
        const postToolCost = calculateCost(
          modelId,
          totalInputTokens,
          totalOutputTokens,
          totalCacheCreationTokens,
          totalCacheReadTokens,
        )
        if (postToolCost > rc.maxRunCostUsd) {
          logger.warn(
            'cost',
            `Post-tool cost $${postToolCost.toFixed(3)} exceeds cap — stopping after this iteration`,
            {
              iteration,
            },
          )
          const costMsg = `\n\n⚠ Cost limit reached ($${postToolCost.toFixed(2)} / $${rc.maxRunCostUsd.toFixed(2)} cap). Stopping to prevent overspend.`
          fullText += costMsg
          emit({ type: 'token', token: costMsg })
          break
        }

        if (assistantContent.length > 0) {
          messages.push({ role: 'assistant', content: assistantContent })
        }

        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults })
        }

        // Refresh system prompt if plan_scenes stored a storyboard this iteration
        if (world.storyboard && allToolCalls.some((tc) => tc.toolName === 'plan_scenes')) {
          const refreshed = buildAgentContext(
            agentType,
            contextOpts,
            world.scenes,
            world.globalStyle,
            projectName,
            outputMode,
            modelOverride,
            opts.modelTier,
            effectiveThinkingMode,
            opts.enabledModelIds,
            world.storyboard,
            opts.userMemories,
            opts.focusedSceneType,
          )
          ctx.systemPrompt = refreshed.systemPrompt
          ctx.staticPrompt = refreshed.staticPrompt
          ctx.dynamicPrompt = refreshed.dynamicPrompt
          logger.log('context', 'Refreshed system prompt with storyboard context')
        }

        // Progressive context refresh — keep agent aware of accumulated changes
        if (toolUseBlocks.length > 0) {
          toolBearingIterations++
          if (toolBearingIterations > 0 && toolBearingIterations % rc.contextRefreshInterval === 0) {
            const refreshMsg = buildContextRefreshMessage()
            messages.push({ role: 'user', content: [{ type: 'text', text: refreshMsg }] })
            logger.log('context', `Progressive context refresh at iteration ${iteration}`, { toolBearingIterations })

            // Compact messages to prevent unbounded growth during long builds
            const before = messages.length
            const compacted = compactInFlightMessages(messages, {
              maxTokens: rc.compactionMaxTokens,
              preserveRecent: rc.compactionPreserveRecent,
            })
            if (compacted.length < before) {
              messages.length = 0
              messages.push(...compacted)
              logger.log('context', `Compacted messages: ${before} → ${compacted.length}`, { iteration })
            }
          }
        }

        // ── Orchestrator handoff ──────────────────────────────────────────────
        // After the Director has set up the storyboard and style, delegate
        // per-scene building to focused SceneMaker sub-agents.
        if (
          agentType === 'director' &&
          !opts.isSubAgent &&
          world.storyboard &&
          world.storyboard.scenes.length >= 3 &&
          // Only hand off once style tools have been called (PLAN+STYLE complete)
          allToolCalls.some((tc) => tc.toolName === 'set_global_style' || tc.toolName === 'set_all_transitions') &&
          // Don't hand off if we've already created scenes (Director is in BUILD phase already)
          !allToolCalls.some((tc) => tc.toolName === 'add_layer')
        ) {
          logger.log('orchestrator', `Handing off to orchestrator: ${world.storyboard.scenes.length} scenes to build`)

          const { runOrchestrated } = await import('./orchestrator')
          const subResults = await runOrchestrated({
            storyboard: world.storyboard,
            parentWorld: world,
            parentOpts: opts,
            emit,
            logger,
            toolBudgetRemaining: rc.maxToolCalls - allToolCalls.length,
            parentCostUsd: calculateCost(
              modelId,
              totalInputTokens,
              totalOutputTokens,
              totalCacheCreationTokens,
              totalCacheReadTokens,
            ),
            maxRunCostUsd: rc.maxRunCostUsd,
          })

          // Aggregate sub-agent usage into parent totals
          for (const sr of subResults) {
            totalInputTokens += sr.usage.inputTokens
            totalOutputTokens += sr.usage.outputTokens
            totalApiCalls += sr.usage.apiCalls
            allToolCalls.push(...sr.toolCalls)
          }

          const succeeded = subResults.filter((r) => r.success).length
          const failed = subResults.filter((r) => !r.success).length
          const summaryMsg = `\n\nOrchestration complete: ${succeeded}/${world.storyboard.scenes.length} scenes built successfully.${failed > 0 ? ` ${failed} scene(s) failed.` : ''}`
          fullText += summaryMsg
          emit({ type: 'token', token: summaryMsg })

          logger.endPhase(`iter_${iteration}`)
          break // exit parent tool loop — orchestrator handled the BUILD phase
        }

        const effectiveStopReason = finalMsg.stop_reason ?? stopReason
        const iterMs = logger.endPhase(`iter_${iteration}`)
        logger.log('iteration', `End iteration ${iteration}`, {
          iteration,
          durationMs: iterMs,
          toolCallCount: toolUseBlocks.length,
          stopReason: effectiveStopReason,
          textLength: chunkText.length,
        })
        if ((agentType === 'planner' || opts.planFirstMode) && world.storyboard) {
          logger.log('plan-mode', 'Plan-first mode: storyboard saved, stopping loop')
          break
        }
        if (toolUseBlocks.length === 0 || effectiveStopReason === 'end_turn') {
          break
        }
      } // end Anthropic path
    }

    // ── 6. Calculate usage and cost ──────────────────────────────────────────

    const totalDurationMs = Date.now() - runStartTime
    const costUsd = calculateCost(
      modelId,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreationTokens,
      totalCacheReadTokens,
    )

    const usage: UsageStats = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      apiCalls: totalApiCalls,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000, // 6 decimal places
      totalDurationMs,
    }

    // Log spend to Postgres for persistent tracking
    try {
      await logSpend(
        pid,
        `agent:${agentType}`,
        costUsd,
        `Agent ${agentType} (${modelId}): ${totalInputTokens} in / ${totalOutputTokens} out, ${totalApiCalls} API call(s), ${allToolCalls.length} tool call(s)`,
      )
      await logAgentUsage(
        pid,
        agentType,
        modelId,
        totalInputTokens,
        totalOutputTokens,
        totalApiCalls,
        allToolCalls.length,
        costUsd,
        totalDurationMs,
      )
    } catch (e) {
      console.error('[Agent] Failed to log spend:', e)
    }

    // ── 7. Emit done ─────────────────────────────────────────────────────────

    logger.log('done', 'Agent run complete', {
      agentType,
      modelId,
      iterations: iteration,
      apiCalls: totalApiCalls,
      toolCalls: allToolCalls.length,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd,
      durationMs: totalDurationMs,
      scenesUpdated: world.scenes.length,
    })

    world.sceneGraph = syncSceneGraphWithScenes(world.scenes, world.sceneGraph)

    emit({
      type: 'done',
      agentType,
      modelId,
      fullText,
      toolCalls: allToolCalls,
      usage,
    })

    // Log per-tool success/failure rates for observability
    const stats = getToolStats()
    const failedTools = Object.entries(stats).filter(([, s]) => s.failure > 0)
    if (failedTools.length > 0) {
      logger.warn(
        'tool_stats',
        `Tool failures this run: ${failedTools.map(([name, s]) => `${name}=${s.failure}/${s.success + s.failure}`).join(', ')}`,
      )
    }

    return {
      agentType,
      modelId,
      fullText,
      toolCalls: allToolCalls,
      updatedScenes: world.scenes,
      updatedGlobalStyle: world.globalStyle,
      updatedSceneGraph: world.sceneGraph,
      updatedStoryboard: world.storyboard ?? null,
      updatedZdogLibrary: world.zdogLibrary,
      updatedZdogStudioLibrary: (world as any).zdogStudioLibrary,
      recordingCommand: (world as any).recordingCommand,
      recordingCommandNonce: (world as any).recordingCommandNonce,
      recordingConfig: (world as any).recordingConfig,
      recordingAttachSceneId: (world as any).recordingAttachSceneId,
      logger,
      usage,
    }
  } catch (err) {
    logger.error('error', `Unhandled error: ${(err as Error).message}`, { stack: (err as Error).stack })
    emit({ type: 'error', error: `Agent error: ${(err as Error).message}` })

    // Log partial usage even on failure — tokens were still consumed
    const totalDurationMs = Date.now() - runStartTime
    const costUsd = calculateCost(
      modelId,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreationTokens,
      totalCacheReadTokens,
    )
    const usage: UsageStats = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      apiCalls: totalApiCalls,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      totalDurationMs,
    }

    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      try {
        await logSpend(
          pid,
          `agent:${agentType}:error`,
          costUsd,
          `Failed agent ${agentType} (${modelId}): ${totalInputTokens} in / ${totalOutputTokens} out — ${(err as Error).message}`,
        )
        await logAgentUsage(
          pid,
          agentType,
          modelId,
          totalInputTokens,
          totalOutputTokens,
          totalApiCalls,
          allToolCalls.length,
          costUsd,
          totalDurationMs,
        )
      } catch (logErr) {
        console.error('[Agent] Failed to log partial usage:', logErr)
      }
    }

    // Save checkpoint on error too — not just disconnect — so progress isn't lost.
    // Note: world/runProgress are try-block scoped, so checkpoint on error is best-effort
    // via opts.scenes (which are mutated in-place during execution).
    if (opts.projectId && opts.initialStoryboard && opts.scenes.length > 0) {
      try {
        const storyboard = opts.initialStoryboard
        await persistRunCheckpoint(opts.projectId, {
          runId: logger.runId,
          agentType,
          modelId,
          storyboard,
          completedSceneIds: opts.scenes.map((s) => s.id),
          remainingSceneIndexes: storyboard.scenes
            .map((_, i) => i)
            .filter((i) => !opts.scenes.some((s) => s.name.toLowerCase() === storyboard.scenes[i].name.toLowerCase())),
          progress: {
            scenesCreated: opts.scenes.map((s) => s.id),
            toolCallsTotal: allToolCalls.length,
            iterationsUsed: 0,
            iterationsMax: rc.maxToolIterations,
            phase: 'unknown',
            storyboardScenesPlanned: storyboard.scenes.length,
            storyboardScenesBuilt: 0,
            errors: [],
            scenesVerified: [],
            scenesWithNarration: [],
          },
          worldSnapshot: {
            scenes: JSON.parse(JSON.stringify(opts.scenes)),
            globalStyle: JSON.parse(JSON.stringify(opts.globalStyle)),
            sceneGraph: JSON.parse(JSON.stringify(opts.sceneGraph ?? { nodes: [], edges: [] })),
          },
          originalMessage: messageContentToText(message),
          partialUsage: usage,
          createdAt: new Date().toISOString(),
          reason: 'error',
        })
        logger.log('checkpoint', `Error checkpoint saved: ${opts.scenes.length} scenes preserved`)
      } catch (cpErr) {
        logger.error('checkpoint', `Error checkpoint save failed: ${(cpErr as Error).message}`)
      }
    }

    // Emit done with partial usage so client can persist token counts
    emit({ type: 'done', agentType, modelId, fullText, toolCalls: allToolCalls, usage })
    // Mark as handled so route.ts .catch() doesn't emit a duplicate error event
    ;(err as any)._agentHandled = true
    throw err
  }
}

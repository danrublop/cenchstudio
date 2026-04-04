/**
 * Agent system types and interfaces for the Cench Studio AI orchestration layer.
 */

import type { Scene, GlobalStyle, SceneGraph } from '../types'

// ── Agent Types ───────────────────────────────────────────────────────────────

export type AgentType = 'router' | 'director' | 'scene-maker' | 'editor' | 'dop' | 'planner'

/** Extended thinking mode for Claude API */
export type ThinkingMode = 'off' | 'adaptive' | 'deep'

export type ModelId =
  // Anthropic
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-6'
  | 'claude-3-5-sonnet-20241022'
  // OpenAI
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'gpt-4.1-nano'
  | 'gpt-4.1-mini'
  | 'gpt-4.1'
  | 'o1'
  | 'o3-mini'
  // Google Gemini
  | 'gemini-2.5-flash-preview-05-20'
  | 'gemini-2.5-pro-preview-05-06'

/** Short display labels for model IDs */
export const MODEL_DISPLAY_NAMES: Record<ModelId, string> = {
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-opus-4-6': 'Opus 4.6',
  'claude-3-5-sonnet-20241022': 'Sonnet 3.5 v2',
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4o': 'GPT-4o',
  'gpt-4.1-nano': 'GPT-4.1 nano',
  'gpt-4.1-mini': 'GPT-4.1 mini',
  'gpt-4.1': 'GPT-4.1',
  o1: 'o1',
  'o3-mini': 'o3-mini',
  'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash',
  'gemini-2.5-pro-preview-05-06': 'Gemini 2.5 Pro',
}

/** Cost per 1M tokens (input, output) in USD */
export const MODEL_PRICING: Record<ModelId, { inputPer1M: number; outputPer1M: number }> = {
  'claude-haiku-4-5-20251001': { inputPer1M: 0.8, outputPer1M: 4.0 },
  'claude-sonnet-4-6': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-opus-4-6': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4.1-nano': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-4.1': { inputPer1M: 2.0, outputPer1M: 8.0 },
  o1: { inputPer1M: 15.0, outputPer1M: 60.0 },
  'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  'gemini-2.5-flash-preview-05-20': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gemini-2.5-pro-preview-05-06': { inputPer1M: 1.25, outputPer1M: 10.0 },
}

/** Determine provider from model ID */
export function getModelProvider(modelId: ModelId): 'anthropic' | 'openai' | 'google' {
  if (modelId.startsWith('claude-')) return 'anthropic'
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai'
  if (modelId.startsWith('gemini-')) return 'google'
  return 'anthropic'
}

/**
 * Model tier controls which models each agent gets.
 * - 'auto': balanced default — sonnet for director/scene-maker, haiku for router/editor/dop
 * - 'premium': most capable models — opus for director/scene-maker, sonnet for editor/dop
 * - 'budget': cheapest models — haiku for everything
 */
export type ModelTier = 'auto' | 'premium' | 'budget'

// ── Conversation Types ────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string
  projectId: string
  title: string
  isPinned: boolean
  isArchived: boolean
  totalCostUsd: number
  lastMessageAt: string | null
  createdAt: string
  messages?: { role: string; content: string }[]
}

// ── Message Content (vision support) ─────────────────────────────────────────

export interface ImageAttachment {
  /** data URI, e.g. "data:image/png;base64,..." */
  dataUri: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  fileName?: string
  width?: number
  height?: number
}

export type ContentBlock = { type: 'text'; text: string } | { type: 'image'; image: ImageAttachment }

/** Plain string for text-only messages, ContentBlock[] when images are included */
export type MessageContent = string | ContentBlock[]

/** Extract the text portion from a MessageContent value */
export function messageContentToText(content: MessageContent): string {
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join(' ')
}

// ── Message Types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: MessageContent
  agentType?: AgentType
  modelId?: ModelId
  /** Tool calls made during this message */
  toolCalls?: ToolCallRecord[]
  /** Token usage and cost tracking */
  usage?: UsageStats
  /** Extended thinking content (reasoning summary) */
  thinking?: string
  /** True while thinking tokens are still streaming */
  isThinkingStreaming?: boolean
  /** Generation log ID for quality signal feedback */
  generationLogId?: string
  /** User feedback rating: 1 = thumbs down, 5 = thumbs up */
  userRating?: number
  timestamp: number
  /** Permission requests that need user approval (from tool results with permissionNeeded) */
  pendingPermissions?: PendingPermission[]
}

export interface PendingPermission {
  api: string
  estimatedCost: string
  toolName: string
  resolved?: 'allow' | 'deny'
  // Rich generation context for the universal confirmation card
  generationType?: import('../types').GenerationType
  prompt?: string
  provider?: string
  availableProviders?: import('../types').GenerationProviderOption[]
  config?: Record<string, any>
  toolArgs?: Record<string, any>
  // User overrides set via the card's dropdowns
  userOverrides?: {
    provider?: string
    prompt?: string
    config?: Record<string, any>
  }
}

export interface UsageStats {
  /** Total input tokens across all iterations */
  inputTokens: number
  /** Total output tokens across all iterations */
  outputTokens: number
  /** Number of Claude API calls made (including multi-turn tool loops) */
  apiCalls: number
  /** Estimated cost in USD */
  costUsd: number
  /** Duration of entire agent run in ms */
  totalDurationMs: number
}

export interface ToolCallRecord {
  id: string
  toolName: string
  input: Record<string, unknown>
  output?: ToolResult
  /** ms elapsed */
  durationMs?: number
}

// ── Agent Request/Response ────────────────────────────────────────────────────

export interface AgentRequest {
  message: MessageContent
  /** Force a specific agent instead of auto-routing */
  agentOverride?: AgentType
  /** Force a specific model */
  modelOverride?: ModelId
  /** Extended thinking mode */
  thinkingMode?: ThinkingMode
  /** Which scene(s) the agent should focus on */
  sceneContext?: 'all' | 'selected' | string // string = specific scene ID
  /** Which tool categories are enabled */
  activeTools?: string[]
  projectId?: string
  /** Last N messages for multi-turn context */
  history?: ChatMessage[]
}

export interface AgentResponse {
  agentType: AgentType
  modelId: ModelId
  text: string
  toolCalls: ToolCallRecord[]
  /** Final world-state changes made */
  changes: StateChange[]
  error?: string
}

// ── SSE Events ────────────────────────────────────────────────────────────────

export type SSEEventType =
  | 'run_start' // first event — carries runId for correlation
  | 'agent_routed' // agent selected — front-loaded before any content streams
  | 'thinking' // agent is routing/planning (no visible text yet)
  | 'thinking_start' // extended thinking block started
  | 'thinking_token' // streamed thinking token
  | 'thinking_complete' // extended thinking block finished
  | 'token' // streamed text token
  | 'iteration_start' // new tool-loop iteration starting
  | 'tool_start' // tool call beginning
  | 'tool_complete' // tool call finished with result
  | 'storyboard_proposed' // plan_scenes succeeded; client can open review UI
  | 'preview_update' // scene HTML was regenerated
  | 'state_change' // world state mutated
  | 'sub_agent_start' // orchestrator starting a sub-agent for a scene
  | 'sub_agent_complete' // sub-agent finished building a scene
  | 'error' // error occurred
  | 'done' // stream complete

export interface SSEEvent {
  type: SSEEventType
  /** For 'run_start' events — correlation ID for the entire run */
  runId?: string
  /** For 'agent_routed' events — routing decision metadata */
  routeMethod?: 'override' | 'heuristic' | 'llm' | 'fallback'
  focusedSceneType?: string
  toolCount?: number
  /** For 'token' and 'thinking_token' events */
  token?: string
  /** For 'thinking_complete' events — full reasoning text */
  fullThinking?: string
  /** For 'iteration_start' events */
  iteration?: number
  maxIterations?: number
  /** For 'tool_start' events */
  toolName?: string
  toolInput?: Record<string, unknown>
  /** For 'tool_complete' events */
  toolResult?: ToolResult
  /** For 'storyboard_proposed' — full storyboard for review before build */
  storyboard?: Storyboard
  /** For 'preview_update' events */
  sceneId?: string
  /** For 'state_change' events */
  changes?: StateChange[]
  /** For 'error' events */
  error?: string
  /** For 'done' events */
  agentType?: AgentType
  modelId?: ModelId
  /** Full accumulated text on 'done' */
  fullText?: string
  toolCalls?: ToolCallRecord[]
  /** Token usage and cost for 'done' events */
  usage?: UsageStats
  /** Generation log ID for quality signal feedback */
  generationLogId?: string
  /** Updated scenes array (on final state_change) */
  updatedScenes?: Scene[]
  /** Updated global style (on final state_change) */
  updatedGlobalStyle?: GlobalStyle
  /** Updated scene graph (on final state_change) */
  updatedSceneGraph?: SceneGraph
  /** For 'sub_agent_start' / 'sub_agent_complete' events */
  subAgentId?: string
  subAgentSceneIndex?: number
  subAgentTotal?: number
  subAgentSceneName?: string
  subAgentSuccess?: boolean
}

// ── Tool Execution ────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  affectedSceneId?: string | null
  changes?: StateChange[]
  error?: string
  data?: unknown
  /** When a tool is blocked by permission settings, includes the API + cost so the UI can prompt */
  permissionNeeded?: {
    api: string
    estimatedCost: string
    reason?: string
    details?: {
      prompt?: string
      duration?: number
      model?: string
      resolution?: string
    }
    // Rich context for the universal generation confirmation card
    generationType?: import('../types').GenerationType
    prompt?: string
    provider?: string
    availableProviders?: import('../types').GenerationProviderOption[]
    config?: Record<string, any>
    toolArgs?: Record<string, any>
  }
}

export interface StateChange {
  type: 'scene_updated' | 'scene_created' | 'scene_deleted' | 'global_updated' | 'project_updated' | 'ui_action'
  sceneId?: string
  /** Human-readable description of what changed */
  description: string
}

// ── Context Building ──────────────────────────────────────────────────────────

export interface ContextOpts {
  agentType: AgentType
  activeTools: string[]
  sceneContext: 'all' | 'selected' | string
  focusedSceneId?: string | null
  audioProviderEnabled?: Record<string, boolean>
  mediaGenEnabled?: Record<string, boolean>
  projectAssets?: import('../types').ProjectAsset[]
}

export interface WorldState {
  projectName: string
  outputMode: 'mp4' | 'interactive'
  globalStyle: GlobalStyle
  sceneCount: number
  totalDuration: number
  scenes: SceneSummary[]
  /** Full scene data for the focused scene */
  focusedScene?: Scene | null
}

export interface SceneSummary {
  id: string
  name: string
  prompt: string
  summary: string
  sceneType: string
  duration: number
  bgColor: string
  layerCount: number
  hasAudio: boolean
  hasVideo: boolean
  transition: string
  interactionCount: number
}

export interface AgentContext {
  systemPrompt: string
  /** Static portion of the system prompt (agent persona + rules). Stable across turns → cacheable. */
  staticPrompt: string
  /** Dynamic portion (world state, storyboard, run progress). Changes per turn → not cached. */
  dynamicPrompt: string
  worldState: WorldState
  tools: ClaudeToolDefinition[]
  maxTokens: number
  modelId: ModelId
  thinkingMode: ThinkingMode
}

// ── Claude API Tool Schema ────────────────────────────────────────────────────

export interface ClaudeToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, ClaudePropertySchema>
    required?: string[]
  }
}

export interface ClaudePropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'
  description?: string
  enum?: string[]
  items?: ClaudePropertySchema
  properties?: Record<string, ClaudePropertySchema>
  required?: string[]
  /** Combined type notation for nullable fields */
  anyOf?: ClaudePropertySchema[]
}

// ── Storyboard ───────────────────────────────────────────────────────────────

/** A single scene in the Director's storyboard plan */
export interface StoryboardScene {
  /**
   * Stable identifier used to match the same storyboard scene across
   * proposals/edits for diff + per-scene revert.
   */
  id?: string
  name: string
  purpose: string
  sceneType: string
  duration: number
  transition?: string
  /** Draft narration text — used to calculate duration via word count formula */
  narrationDraft?: string
  /** Key visual elements to include in this scene */
  visualElements?: string
  /** Sound effect or music cues */
  audioNotes?: string
  /** Chart specification if this scene uses D3/CenchCharts */
  chartSpec?: { type: string; dataDescription: string }
  /** Planned media overlays: avatar PIP, background music, stock images, etc. */
  mediaLayers?: string
  /** Planned camera motion: kenBurns, cinematicPush, orbit, etc. */
  cameraMovement?: string
  /** For physics scene type: which simulation to run */
  physicsSimulation?: string
  /** For 3d_world scene type: which environment */
  worldEnvironment?: string
}

/** Complete storyboard produced by plan_scenes */
export interface Storyboard {
  title: string
  scenes: StoryboardScene[]
  totalDuration: number
  styleNotes?: string
  /** Auto-detected feature flags based on content type */
  featureFlags?: {
    narration: boolean
    music: boolean
    sfx: boolean
    interactions: boolean
  }
}

// ── Compaction Config ────────────────────────────────────────────────────────

/** Configuration for session compaction — controls how older messages are
 *  summarized and how much recent context is preserved verbatim. */
export interface CompactionConfig {
  /** Number of recent messages to keep verbatim (default: 8) */
  preserveRecent: number
  /** Token threshold that triggers compaction (default: 6000) */
  maxTokens: number
  /** Include scene state (types, completion) in summary (default: true) */
  includeSceneState: boolean
}

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  preserveRecent: 8,
  maxTokens: 6000,
  includeSceneState: true,
}

// ── Run Progress ─────────────────────────────────────────────────────────────

/** Tracks progress within an agent run — injected into context each iteration
 *  so the agent can see what it has done and what remains. */
export interface RunProgress {
  /** Current phase: plan → style → build → polish */
  phase: 'plan' | 'style' | 'build' | 'polish' | 'unknown'
  /** How many storyboard scenes have been created (if storyboard exists) */
  storyboardScenesPlanned: number
  storyboardScenesBuilt: number
  /** Tool budget tracking */
  iterationsUsed: number
  iterationsMax: number
  toolCallsTotal: number
  /** Errors encountered and whether they were resolved */
  errors: Array<{ tool: string; error: string; resolved: boolean }>
  /** Scene IDs created during this run */
  scenesCreated: string[]
  /** Scene IDs that have been verified (via verify_scene) */
  scenesVerified: string[]
}

/** Serialize run progress into a compact string for context injection */
export function serializeRunProgress(p: RunProgress): string {
  const parts: string[] = ['── RUN PROGRESS ──']
  parts.push(
    `Phase: ${p.phase.toUpperCase()} | Iterations: ${p.iterationsUsed}/${p.iterationsMax} | Tools called: ${p.toolCallsTotal}`,
  )

  if (p.storyboardScenesPlanned > 0) {
    parts.push(`Storyboard: ${p.storyboardScenesBuilt}/${p.storyboardScenesPlanned} scenes built`)
    const remaining = p.storyboardScenesPlanned - p.storyboardScenesBuilt
    if (remaining > 0) parts.push(`  → ${remaining} scenes still to build`)
  }

  if (p.scenesCreated.length > 0) {
    parts.push(`Scenes created: ${p.scenesCreated.length}`)
  }

  const unverified = p.scenesCreated.filter((id) => !p.scenesVerified.includes(id))
  if (unverified.length > 0) {
    parts.push(`⚠ Unverified scenes: ${unverified.length} — call verify_scene on these`)
  }

  const unresolvedErrors = p.errors.filter((e) => !e.resolved)
  if (unresolvedErrors.length > 0) {
    parts.push(`Errors (${unresolvedErrors.length} unresolved):`)
    for (const e of unresolvedErrors.slice(-3)) {
      parts.push(`  ⚠ ${e.tool}: ${e.error.slice(0, 100)}`)
    }
  }

  const budgetPct = Math.round((p.iterationsUsed / p.iterationsMax) * 100)
  if (budgetPct >= 70) {
    parts.push(`⚠ Budget alert: ${budgetPct}% of iterations used — prioritize remaining work`)
  }

  return parts.join('\n')
}

// ── Run Checkpoint (resume interrupted runs) ─────────────────────────────────

/** Serialized state of an interrupted agent run, persisted to DB so the user
 *  can resume where they left off after a disconnect/timeout/error. */
export interface RunCheckpoint {
  /** Unique run ID for correlation */
  runId: string
  /** Agent type that was running */
  agentType: AgentType
  /** Model used */
  modelId: ModelId
  /** Storyboard being built (if any) */
  storyboard: Storyboard | null
  /** Scene IDs already created during this run */
  completedSceneIds: string[]
  /** Storyboard scene indexes not yet built */
  remainingSceneIndexes: number[]
  /** Run progress at time of interruption */
  progress: RunProgress
  /** World state snapshot at interruption */
  worldSnapshot: {
    scenes: Scene[]
    globalStyle: GlobalStyle
    sceneGraph: SceneGraph
  }
  /** Original user message that started the run */
  originalMessage: string
  /** Token usage accumulated before interruption */
  partialUsage: UsageStats
  /** When the checkpoint was created */
  createdAt: string
  /** Why the run was interrupted */
  reason: 'disconnect' | 'timeout' | 'error'
}

// ── Snapshot / Undo ───────────────────────────────────────────────────────────

export interface StateSnapshot {
  id: string
  timestamp: number
  description: string
  scenes: Scene[]
  globalStyle: GlobalStyle
}

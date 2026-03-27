/**
 * Agent system types and interfaces for the Cench Studio AI orchestration layer.
 */

import type { Scene, GlobalStyle } from '../types'

// ── Agent Types ───────────────────────────────────────────────────────────────

export type AgentType = 'router' | 'director' | 'scene-maker' | 'editor' | 'dop'

export type ModelId =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-5-20250514'
  | 'claude-opus-4-5-20250514'

/** Short display labels for model IDs */
export const MODEL_DISPLAY_NAMES: Record<ModelId, string> = {
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-sonnet-4-5-20250514': 'Sonnet 4.5',
  'claude-opus-4-5-20250514': 'Opus 4.5',
}

/** Cost per 1M tokens (input, output) in USD */
export const MODEL_PRICING: Record<ModelId, { inputPer1M: number; outputPer1M: number }> = {
  'claude-haiku-4-5-20251001': { inputPer1M: 0.80, outputPer1M: 4.00 },
  'claude-sonnet-4-5-20250514': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-opus-4-5-20250514': { inputPer1M: 15.00, outputPer1M: 75.00 },
}

/**
 * Model tier controls which models each agent gets.
 * - 'auto': each agent uses its own default (haiku for router/editor/dop, sonnet for director/scene-maker)
 * - 'fast': all agents use haiku (cheapest, fastest)
 * - 'balanced': all agents use sonnet (good quality, moderate cost)
 * - 'performance': director+scene-maker use opus, editor uses sonnet, dop uses sonnet
 */
export type ModelTier = 'auto' | 'fast' | 'balanced' | 'performance'

// ── Message Types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentType?: AgentType
  modelId?: ModelId
  /** Tool calls made during this message */
  toolCalls?: ToolCallRecord[]
  /** Token usage and cost tracking */
  usage?: UsageStats
  timestamp: number
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
  message: string
  /** Force a specific agent instead of auto-routing */
  agentOverride?: AgentType
  /** Force a specific model */
  modelOverride?: ModelId
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
  | 'thinking'       // agent is routing/planning (no visible text yet)
  | 'token'          // streamed text token
  | 'tool_start'     // tool call beginning
  | 'tool_complete'  // tool call finished with result
  | 'preview_update' // scene HTML was regenerated
  | 'state_change'   // world state mutated
  | 'error'          // error occurred
  | 'done'           // stream complete

export interface SSEEvent {
  type: SSEEventType
  /** For 'token' events */
  token?: string
  /** For 'tool_start' events */
  toolName?: string
  toolInput?: Record<string, unknown>
  /** For 'tool_complete' events */
  toolResult?: ToolResult
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
}

// ── Tool Execution ────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  affectedSceneId?: string | null
  changes?: StateChange[]
  error?: string
  data?: unknown
}

export interface StateChange {
  type: 'scene_updated' | 'scene_created' | 'scene_deleted' | 'global_updated' | 'project_updated'
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
  worldState: WorldState
  tools: ClaudeToolDefinition[]
  maxTokens: number
  modelId: ModelId
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

// ── Snapshot / Undo ───────────────────────────────────────────────────────────

export interface StateSnapshot {
  id: string
  timestamp: number
  description: string
  scenes: Scene[]
  globalStyle: GlobalStyle
}

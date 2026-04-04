/**
 * Session export/import for the agent framework.
 *
 * Enables full session serialization for:
 *   - Sharing editing sessions with collaborators
 *   - Forking sessions to try alternative approaches
 *   - Versioning sessions alongside project files
 *   - Reproducing specific agent runs
 *
 * Sessions are exported as self-contained JSON with a version field
 * for forward migration as the schema evolves.
 */

import type { Scene, GlobalStyle, SceneGraph } from '../types'
import type { ChatMessage, Storyboard, RunProgress, UsageStats } from './types'
import type { AgentConfig } from './config-resolver'

// ── Schema Version ──────────────────────────────────────────────────────────

/** Current session export schema version. Increment when breaking changes
 *  are made to the SessionExport interface. */
const SESSION_VERSION = 1

// ── Types ───────────────────────────────────────────────────────────────────

export interface SessionExport {
  /** Schema version for forward migration */
  version: number
  /** Project this session belongs to */
  projectId: string
  /** ISO timestamp of when the session was exported */
  exportedAt: string
  /** Agent config that was active during this session */
  config: Partial<AgentConfig>
  /** Full conversation history */
  messages: ChatMessage[]
  /** World state snapshot at export time */
  worldState: {
    scenes: Scene[]
    globalStyle: GlobalStyle
    sceneGraph?: SceneGraph
    projectName: string
    outputMode: 'mp4' | 'interactive'
  }
  /** Active storyboard (if any) */
  storyboard?: Storyboard | null
  /** Compaction summaries that were generated during this session */
  compactionHistory: string[]
  /** Run progress at export time */
  runProgress?: RunProgress | null
  /** Accumulated token/cost usage */
  usage: {
    totalInputTokens: number
    totalOutputTokens: number
    totalCost: number
  }
}

export interface SessionImportResult {
  messages: ChatMessage[]
  worldState: SessionExport['worldState']
  config: Partial<AgentConfig>
  storyboard?: Storyboard | null
}

// ── Export ───────────────────────────────────────────────────────────────────

export function exportSession(opts: {
  projectId: string
  messages: ChatMessage[]
  scenes: Scene[]
  globalStyle: GlobalStyle
  sceneGraph?: SceneGraph
  projectName: string
  outputMode: 'mp4' | 'interactive'
  config?: Partial<AgentConfig>
  storyboard?: Storyboard | null
  runProgress?: RunProgress | null
  usage?: UsageStats
  compactionHistory?: string[]
}): SessionExport {
  return {
    version: SESSION_VERSION,
    projectId: opts.projectId,
    exportedAt: new Date().toISOString(),
    config: opts.config ?? {},
    messages: opts.messages,
    worldState: {
      scenes: opts.scenes,
      globalStyle: opts.globalStyle,
      sceneGraph: opts.sceneGraph,
      projectName: opts.projectName,
      outputMode: opts.outputMode,
    },
    storyboard: opts.storyboard ?? null,
    compactionHistory: opts.compactionHistory ?? [],
    runProgress: opts.runProgress ?? null,
    usage: {
      totalInputTokens: opts.usage?.inputTokens ?? 0,
      totalOutputTokens: opts.usage?.outputTokens ?? 0,
      totalCost: opts.usage?.costUsd ?? 0,
    },
  }
}

// ── Import ──────────────────────────────────────────────────────────────────

/**
 * Import a session from a previously exported JSON object.
 * Validates the version and migrates if needed.
 *
 * Returns the messages, world state, and config ready for use
 * in a new agent run.
 */
export function importSession(data: unknown): SessionImportResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid session export: expected an object')
  }

  const session = data as Record<string, unknown>

  if (typeof session.version !== 'number') {
    throw new Error('Invalid session export: missing version field')
  }

  if (session.version > SESSION_VERSION) {
    throw new Error(
      `Session version ${session.version} is newer than supported version ${SESSION_VERSION}. Please update Cench Studio.`,
    )
  }

  // Apply migrations for older versions here as needed
  // if (session.version < 2) { migrateV1toV2(session) }

  const exported = session as unknown as SessionExport

  if (!exported.messages || !Array.isArray(exported.messages)) {
    throw new Error('Invalid session export: missing messages array')
  }

  if (!exported.worldState) {
    throw new Error('Invalid session export: missing worldState')
  }

  if (!Array.isArray(exported.worldState.scenes)) {
    throw new Error('Invalid session export: worldState.scenes must be an array')
  }

  if (!exported.worldState.globalStyle || typeof exported.worldState.globalStyle !== 'object') {
    throw new Error('Invalid session export: worldState.globalStyle must be an object')
  }

  return {
    messages: exported.messages,
    worldState: exported.worldState,
    config: exported.config ?? {},
    storyboard: exported.storyboard,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract compaction summaries from a message history.
 * Used to populate the compactionHistory field on export.
 */
export function extractCompactionHistory(messages: ChatMessage[]): string[] {
  const summaries: string[] = []
  for (const msg of messages) {
    if (msg.role !== 'user') continue
    // Handle both string and block-array content formats
    let text = ''
    if (typeof msg.content === 'string') {
      text = msg.content
    } else if (Array.isArray(msg.content)) {
      const textBlocks = msg.content.filter((b: any) => b.type === 'text')
      text = textBlocks.map((b: any) => b.text).join(' ')
    }
    if (text.startsWith('[CONVERSATION SUMMARY')) {
      summaries.push(text)
    }
  }
  return summaries
}

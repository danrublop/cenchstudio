/**
 * Hierarchical agent configuration resolution.
 *
 * Merges configuration from three levels (org → project → session) using
 * a deep-merge strategy where later sources override earlier ones.
 * This centralizes the scattered config fields from RunnerOptions,
 * WorldStateMutable, and the API request body into a single typed object.
 */

import type { APIPermissions } from '../types'
import type { ModelId, ModelTier, ThinkingMode, CompactionConfig } from './types'
import type { HookConfig } from './hook-config'

// ── Agent Config ────────────────────────────────────────────────────────────

export interface AgentModelsConfig {
  /** Default model tier selection strategy */
  defaultTier: ModelTier
  /** Which model IDs are enabled for use */
  enabledModelIds?: string[]
  /** Explicit model ID override (bypasses tier logic) */
  modelOverride?: ModelId | null
  /** Thinking mode for extended reasoning */
  thinkingMode: ThinkingMode
}

export interface AgentToolsConfig {
  /** Whitelist of active tools (undefined = all available) */
  activeTools?: string[]
  /** Blacklist of disabled tools */
  disabledTools?: string[]
}

export interface AgentLimitsConfig {
  /** Max tool-loop iterations per run (default: 15) */
  maxIterations: number
  /** Max total tool calls per run including sub-agents (default: 50) */
  maxToolCalls?: number
  /** Max spend per session in USD */
  maxSessionSpend?: number
  /** Max spend per month in USD */
  maxMonthlySpend?: number
}

export interface AgentAudioConfig {
  /** Which audio providers are enabled */
  enabledProviders?: Record<string, boolean>
  /** Default provider + config for auto-selection */
  defaults?: Record<string, { provider: string; config: Record<string, any> }>
}

export interface AgentMediaConfig {
  /** Which media generation providers are enabled */
  enabledProviders?: Record<string, boolean>
  /** Default provider + config for auto-selection */
  defaults?: Record<string, { provider: string; config: Record<string, any> }>
}

export interface AgentStyleConfig {
  /** Default style preset for new projects */
  defaultPreset?: string
  /** If true, agents cannot change the preset */
  enforcePreset?: boolean
}

export interface AgentGenerationOverrides {
  [key: string]: {
    provider?: string
    prompt?: string
    config?: Record<string, any>
  }
}

/**
 * Unified agent configuration — the single source of truth for all
 * configurable agent behavior. Resolved once per request from the
 * org/project/session config hierarchy.
 */
export interface AgentConfig {
  models: AgentModelsConfig
  tools: AgentToolsConfig
  limits: AgentLimitsConfig
  permissions?: APIPermissions
  audio: AgentAudioConfig
  media: AgentMediaConfig
  style: AgentStyleConfig
  /** Per-generation-type provider/prompt overrides */
  generationOverrides?: AgentGenerationOverrides
  /** Compaction settings for session history */
  compaction: CompactionConfig
  /** Session-scoped permission grants (e.g. after user approves a tool) */
  sessionPermissions?: Record<string, string>
  /** Declarative hook configuration for pre/post tool use */
  hooks?: HookConfig
}

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  models: {
    defaultTier: 'auto',
    thinkingMode: 'adaptive',
  },
  tools: {},
  limits: {
    maxIterations: 15,
  },
  permissions: undefined,
  audio: {},
  media: {},
  style: {},
  compaction: {
    preserveRecent: 8,
    maxTokens: 6000,
    includeSceneState: true,
  },
}

// ── Deep Merge ──────────────────────────────────────────────────────────────

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return false
  const proto = Object.getPrototypeOf(val)
  return proto === Object.prototype || proto === null
}

/**
 * Deep merge two objects. Later values win for primitives and arrays.
 * Objects are recursively merged. Undefined values in `over` are skipped.
 */
function deepMerge<T extends Record<string, any>>(base: T, over: Partial<T>): T {
  const result = { ...base }
  for (const key of Object.keys(over) as Array<keyof T>) {
    const overVal = over[key]
    if (overVal === undefined) continue
    if (isPlainObject(overVal) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as any, overVal as any)
    } else {
      result[key] = overVal as T[keyof T]
    }
  }
  return result
}

// ── Resolver ────────────────────────────────────────────────────────────────

/**
 * Resolve the final agent config by merging three layers:
 *   1. Org defaults (broadest scope, lowest priority)
 *   2. Project config (project-level overrides)
 *   3. Session overrides (per-request, highest priority)
 *
 * Any layer can be omitted (pass undefined or {}).
 */
export function resolveAgentConfig(
  orgDefaults?: Partial<AgentConfig>,
  projectConfig?: Partial<AgentConfig>,
  sessionOverrides?: Partial<AgentConfig>,
): AgentConfig {
  let config = { ...DEFAULT_AGENT_CONFIG }
  if (orgDefaults) config = deepMerge(config, orgDefaults)
  if (projectConfig) config = deepMerge(config, projectConfig)
  if (sessionOverrides) config = deepMerge(config, sessionOverrides)
  return config
}

/**
 * Build a session-level AgentConfig from the legacy RunnerOptions fields.
 * This is a bridge to ease migration — callers can pass their existing
 * scattered fields and get back a proper AgentConfig.
 */
export function agentConfigFromLegacyOptions(opts: {
  modelOverride?: ModelId | null
  modelTier?: ModelTier
  thinkingMode?: ThinkingMode
  activeTools?: string[]
  enabledModelIds?: string[]
  apiPermissions?: APIPermissions
  audioProviderEnabled?: Record<string, boolean>
  mediaGenEnabled?: Record<string, boolean>
  sessionPermissions?: Record<string, string>
  generationOverrides?: AgentGenerationOverrides
  autoChooseDefaults?: Record<string, { provider: string; config: Record<string, any> }>
  maxIterations?: number
}): Partial<AgentConfig> {
  return {
    models: {
      defaultTier: opts.modelTier ?? 'auto',
      enabledModelIds: opts.enabledModelIds,
      modelOverride: opts.modelOverride,
      thinkingMode: opts.thinkingMode ?? 'adaptive',
    },
    tools: {
      activeTools: opts.activeTools,
    },
    limits: {
      maxIterations: opts.maxIterations ?? 15,
    },
    permissions: opts.apiPermissions,
    audio: {
      enabledProviders: opts.audioProviderEnabled,
      defaults: opts.autoChooseDefaults,
    },
    media: {
      enabledProviders: opts.mediaGenEnabled,
    },
    generationOverrides: opts.generationOverrides,
    sessionPermissions: opts.sessionPermissions,
  }
}

/**
 * Model registry system for the Cench Studio AI agent configuration.
 * Defines available AI models, their capabilities, costs, and provider settings.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'local' | 'heygen' | 'elevenlabs' | 'fal'
export type ModelTierName = 'budget' | 'balanced' | 'performance' | 'custom'

/**
 * Configuration for a single AI model.
 */
export interface ModelConfig {
  /** Unique identifier, e.g. 'claude-sonnet-4-5' or 'gpt-4o' */
  id: string
  provider: ModelProvider
  /** Actual API model string passed to the provider */
  modelId: string
  /** Human-readable label shown in dropdowns */
  displayName: string
  /** Quality/cost tier classification */
  tier: ModelTierName
  /** When false the model is hidden from agent dropdowns */
  enabled: boolean
  /** Built-in models cannot be deleted, only disabled */
  isDefault: boolean
  /** USD cost per 1 million input tokens */
  costPer1MInput: number
  /** USD cost per 1 million output tokens */
  costPer1MOutput: number
  /** Maximum context window in tokens */
  maxTokens: number
  supportsTools: boolean
  supportsStreaming: boolean
  // Local model fields
  /** HTTP endpoint for local models, e.g. "http://localhost:11434" */
  endpoint?: string
  /** Ollama model name, e.g. "llama3.1:8b" */
  localModelName?: string
}

/**
 * Per-provider connection settings (API keys, base URLs).
 */
export interface ProviderConfig {
  provider: ModelProvider
  /** API key — stored in env on server, client uses placeholder */
  apiKey: string
  enabled: boolean
  /** Override base URL for custom endpoints or proxies */
  baseUrl?: string
}

// ── Default Models ─────────────────────────────────────────────────────────────

export const DEFAULT_MODELS: ModelConfig[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    displayName: 'Haiku 4.5',
    tier: 'budget',
    enabled: true,
    isDefault: true,
    costPer1MInput: 0.8,
    costPer1MOutput: 4.0,
    maxTokens: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    displayName: 'Sonnet 4.6',
    tier: 'balanced',
    enabled: true,
    isDefault: true,
    costPer1MInput: 3.0,
    costPer1MOutput: 15.0,
    maxTokens: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-opus-4-6',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    displayName: 'Opus 4.6',
    tier: 'performance',
    enabled: true,
    isDefault: true,
    costPer1MInput: 15.0,
    costPer1MOutput: 75.0,
    maxTokens: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-sonnet-3-5-v2',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Sonnet 3.5 v2',
    tier: 'balanced',
    enabled: false,
    isDefault: true,
    costPer1MInput: 3.0,
    costPer1MOutput: 15.0,
    maxTokens: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    tier: 'budget',
    enabled: false,
    isDefault: true,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.6,
    maxTokens: 128000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    tier: 'balanced',
    enabled: false,
    isDefault: true,
    costPer1MInput: 2.5,
    costPer1MOutput: 10.0,
    maxTokens: 128000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4.1-nano',
    provider: 'openai',
    modelId: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 nano',
    tier: 'budget',
    enabled: false,
    isDefault: true,
    costPer1MInput: 0.1,
    costPer1MOutput: 0.4,
    maxTokens: 1047576,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 mini',
    tier: 'budget',
    enabled: false,
    isDefault: true,
    costPer1MInput: 0.4,
    costPer1MOutput: 1.6,
    maxTokens: 1047576,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
    displayName: 'GPT-4.1',
    tier: 'balanced',
    enabled: false,
    isDefault: true,
    costPer1MInput: 2.0,
    costPer1MOutput: 8.0,
    maxTokens: 1047576,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'o1',
    provider: 'openai',
    modelId: 'o1',
    displayName: 'o1',
    tier: 'performance',
    enabled: false,
    isDefault: true,
    costPer1MInput: 15.0,
    costPer1MOutput: 60.0,
    maxTokens: 200000,
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: 'o3-mini',
    provider: 'openai',
    modelId: 'o3-mini',
    displayName: 'o3-mini',
    tier: 'balanced',
    enabled: false,
    isDefault: true,
    costPer1MInput: 1.1,
    costPer1MOutput: 4.4,
    maxTokens: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },

  // ── Google Gemini ────────────────────────────────────────────────────────────
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash-preview-05-20',
    displayName: 'Gemini 2.5 Flash',
    tier: 'budget',
    enabled: false,
    isDefault: true,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.6,
    maxTokens: 1000000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro-preview-05-06',
    displayName: 'Gemini 2.5 Pro',
    tier: 'performance',
    enabled: false,
    isDefault: true,
    costPer1MInput: 1.25,
    costPer1MOutput: 10.0,
    maxTokens: 1000000,
    supportsTools: true,
    supportsStreaming: true,
  },

  // ── Local / Ollama placeholder ─────────────────────────────────────────────
  {
    id: 'ollama-llama3',
    provider: 'local',
    modelId: 'ollama/llama3.1:8b',
    displayName: 'Llama 3.1 8B (Ollama)',
    tier: 'budget',
    enabled: false,
    isDefault: true,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    maxTokens: 128000,
    supportsTools: true,
    supportsStreaming: true,
    endpoint: 'http://localhost:11434',
    localModelName: 'llama3.1:8b',
  },
]

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  { provider: 'anthropic', apiKey: '', enabled: true },
  { provider: 'openai', apiKey: '', enabled: false },
  { provider: 'google', apiKey: '', enabled: false },
  { provider: 'local', apiKey: '', enabled: false, baseUrl: 'http://localhost:11434' },
  { provider: 'heygen', apiKey: '', enabled: true },
  { provider: 'elevenlabs', apiKey: '', enabled: true },
  { provider: 'fal', apiKey: '', enabled: true },
]

// ── Query Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns all models where `enabled` is true.
 */
export function getEnabledModels(models: ModelConfig[] = DEFAULT_MODELS): ModelConfig[] {
  return models.filter((m) => m.enabled)
}

/**
 * Returns all models matching the given tier.
 */
export function getModelsByTier(tier: ModelTierName, models: ModelConfig[] = DEFAULT_MODELS): ModelConfig[] {
  return models.filter((m) => m.tier === tier)
}

/**
 * Returns the first enabled model for the given tier, or the first model
 * of that tier regardless of enabled status as a fallback.
 */
export function getDefaultModelForTier(
  tier: ModelTierName,
  models: ModelConfig[] = DEFAULT_MODELS,
): ModelConfig | undefined {
  const tiered = models.filter((m) => m.tier === tier)
  return tiered.find((m) => m.enabled) ?? tiered[0]
}

/**
 * Returns models grouped by provider.
 */
export function getModelsByProvider(models: ModelConfig[] = DEFAULT_MODELS): Record<ModelProvider, ModelConfig[]> {
  const result: Record<ModelProvider, ModelConfig[]> = {
    anthropic: [],
    openai: [],
    google: [],
    local: [],
    heygen: [],
    elevenlabs: [],
    fal: [],
  }
  for (const model of models) {
    result[model.provider].push(model)
  }
  return result
}

/**
 * Config hierarchy for Cench Studio.
 *
 * Three sources of configuration, merged in priority order (highest wins):
 *
 * 1. **Project** (DB) — per-project settings stored in Postgres
 *    (apiPermissions, audioSettings, globalStyle, etc.)
 *
 * 2. **Local** (.cench.local.json) — machine-specific overrides
 *    (API keys, default model, preferred voice, dev flags)
 *    NOT committed to git — in .gitignore
 *
 * 3. **Environment** (process.env) — highest priority, used for deployment
 *
 * Usage:
 *   const config = await loadLocalConfig()
 *   const apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY
 */

import fs from 'fs/promises'
import path from 'path'

export interface LocalConfig {
  /** Override API keys (takes precedence over .env for local dev) */
  anthropicApiKey?: string
  openaiApiKey?: string
  googleAiKey?: string
  elevenLabsApiKey?: string
  heygenApiKey?: string

  /** Default model preferences */
  defaultModelTier?: 'auto' | 'premium' | 'budget'
  defaultModelOverride?: string
  defaultThinkingMode?: 'off' | 'adaptive' | 'deep'

  /** Default style preferences */
  defaultPresetId?: string
  defaultOutputMode?: 'mp4' | 'interactive'

  /** Audio defaults */
  defaultTtsProvider?: string
  defaultVoiceId?: string

  /** Dev flags */
  enableDebugLogging?: boolean
  disablePermissionGates?: boolean
  maxToolIterations?: number

  /** Custom overrides — free-form key-value for extensions */
  custom?: Record<string, unknown>
}

const LOCAL_CONFIG_FILENAME = '.cench.local.json'

let cachedConfig: LocalConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 30_000 // Re-read every 30s

/**
 * Load local config from .cench.local.json in the project root.
 * Returns empty config if file doesn't exist. Cached for 30s.
 */
export async function loadLocalConfig(projectRoot?: string): Promise<LocalConfig> {
  const now = Date.now()
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig
  }

  const root = projectRoot ?? process.cwd()
  const configPath = path.join(root, LOCAL_CONFIG_FILENAME)

  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    cachedConfig = JSON.parse(raw) as LocalConfig
    cacheTimestamp = now
    return cachedConfig
  } catch {
    // File doesn't exist or is invalid — return empty config
    cachedConfig = {}
    cacheTimestamp = now
    return cachedConfig
  }
}

/** Clear the config cache (useful after file changes). */
export function clearConfigCache(): void {
  cachedConfig = null
  cacheTimestamp = 0
}

/**
 * Resolve a config value from the hierarchy: env > local > project > default.
 *
 * Example:
 *   resolveConfigValue('ANTHROPIC_API_KEY', localConfig.anthropicApiKey, projectApiKey, undefined)
 */
export function resolveConfigValue<T>(
  envKey: string | null,
  localValue: T | undefined,
  projectValue: T | undefined,
  defaultValue: T,
): T {
  // Env vars are highest priority (string values only)
  if (envKey) {
    const envVal = process.env[envKey]
    if (envVal !== undefined) return envVal as unknown as T
  }
  // Local config overrides project
  if (localValue !== undefined) return localValue
  // Project DB value
  if (projectValue !== undefined) return projectValue
  // Default
  return defaultValue
}

/**
 * Merge local config overrides into project-level settings.
 * Returns a new object with local values taking precedence.
 */
export function mergeWithLocalConfig<T extends Record<string, unknown>>(
  projectSettings: T,
  localOverrides: Partial<T>,
): T {
  const merged = { ...projectSettings }
  for (const [key, value] of Object.entries(localOverrides)) {
    if (value !== undefined) {
      ;(merged as Record<string, unknown>)[key] = value
    }
  }
  return merged
}

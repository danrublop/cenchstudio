import type { APIName, APIPermissions, PermissionConfig, PermissionRequest, PermissionResponse } from './types'

// ── Default permissions ─────────────────────────────────────────────────────

export function createDefaultPermissionConfig(): PermissionConfig {
  return {
    mode: 'always_ask',
    sessionLimit: null,
    monthlyLimit: null,
    sessionSpend: 0,
    monthlySpend: 0,
  }
}

export function createDefaultAPIPermissions(): APIPermissions {
  return {
    heygen: createDefaultPermissionConfig(),
    veo3: createDefaultPermissionConfig(),
    imageGen: createDefaultPermissionConfig(),
    backgroundRemoval: createDefaultPermissionConfig(),
    elevenLabs: createDefaultPermissionConfig(),
    unsplash: createDefaultPermissionConfig(),
  }
}

// ── Cost estimates ──────────────────────────────────────────────────────────

export const API_COST_ESTIMATES: Record<string, string> = {
  'heygen': '~$0.10–$1.00 per video',
  'veo3': '~$0.50–$2.00 per clip',
  'imageGen:flux-1.1-pro': '~$0.05',
  'imageGen:flux-schnell': '~$0.003',
  'imageGen:ideogram-v3': '~$0.08',
  'imageGen:recraft-v3': '~$0.04',
  'imageGen:stable-diffusion-3': '~$0.03',
  'imageGen:dall-e-3': '~$0.04',
  'backgroundRemoval': '~$0.01',
  'elevenLabs': '~$0.01–$0.10 per segment',
}

export const API_DISPLAY_NAMES: Record<APIName, string> = {
  heygen: 'HeyGen Avatars',
  veo3: 'Veo 3 Video Generation',
  imageGen: 'Image Generation',
  backgroundRemoval: 'Background Removal',
  elevenLabs: 'ElevenLabs TTS',
  unsplash: 'Unsplash Images',
}

// ── Permission check (synchronous, for auto-modes) ─────────────────────────

export type PermissionCheckResult =
  | { action: 'allow' }
  | { action: 'deny'; reason: string }
  | { action: 'ask'; request: PermissionRequest }

export function checkPermission(
  permissions: APIPermissions,
  api: APIName,
  estimatedCost: string,
  reason: string,
  details: PermissionRequest['details'],
  sessionPermissions: Map<string, string>,
): PermissionCheckResult {
  const config = permissions[api]

  // Check spend limits
  if (config.sessionLimit !== null && config.sessionSpend >= config.sessionLimit) {
    return { action: 'deny', reason: `Session spend limit reached ($${config.sessionSpend.toFixed(2)} / $${config.sessionLimit.toFixed(2)})` }
  }
  if (config.monthlyLimit !== null && config.monthlySpend >= config.monthlyLimit) {
    return { action: 'deny', reason: `Monthly spend limit reached ($${config.monthlySpend.toFixed(2)} / $${config.monthlyLimit.toFixed(2)})` }
  }

  switch (config.mode) {
    case 'always_allow':
      return { action: 'allow' }
    case 'always_deny':
      return { action: 'deny', reason: `${API_DISPLAY_NAMES[api]} is disabled in project settings.` }
    case 'ask_once': {
      const sessionDecision = sessionPermissions.get(api)
      if (sessionDecision === 'allow') return { action: 'allow' }
      if (sessionDecision === 'deny') return { action: 'deny', reason: 'Previously denied this session.' }
      // Fall through to ask
      break
    }
    case 'always_ask':
    default:
      break
  }

  // Need to ask the user
  const request: PermissionRequest = {
    id: crypto.randomUUID(),
    api,
    estimatedCost,
    reason,
    details,
  }
  return { action: 'ask', request }
}

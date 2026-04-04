// ── AI Media Generation Types ───────────────────────────────────────────────

export type APIName =
  | 'heygen'
  | 'veo3'
  | 'imageGen'
  | 'backgroundRemoval'
  | 'elevenLabs'
  | 'unsplash'
  | 'googleTts'
  | 'googleImageGen'
  | 'openaiTts'
  | 'geminiTts'
  | 'freesound'
  | 'pixabay'
  | 'falAvatar'

export type GenerationType = 'avatar' | 'image' | 'tts' | 'sfx' | 'music' | 'video'

export interface GenerationProviderOption {
  id: string
  name: string
  cost: string
  isFree: boolean
}

export type PermissionMode = 'always_ask' | 'always_allow' | 'always_deny' | 'ask_once'

export interface PermissionConfig {
  mode: PermissionMode
  sessionLimit: number | null
  monthlyLimit: number | null
  sessionSpend: number
  monthlySpend: number
}

export interface APIPermissions {
  heygen: PermissionConfig
  veo3: PermissionConfig
  imageGen: PermissionConfig
  backgroundRemoval: PermissionConfig
  elevenLabs: PermissionConfig
  unsplash: PermissionConfig
  googleTts: PermissionConfig
  googleImageGen: PermissionConfig
  openaiTts: PermissionConfig
  geminiTts: PermissionConfig
  freesound: PermissionConfig
  pixabay: PermissionConfig
  falAvatar: PermissionConfig
}

export interface PermissionRequest {
  id: string
  api: APIName
  estimatedCost: string
  reason: string
  details: {
    prompt?: string
    duration?: number
    model?: string
    resolution?: string
  }
}

export interface PermissionResponse {
  id: string
  decision: 'allow' | 'deny'
  remember: 'once' | 'session' | 'always'
}

// ── AI Media Generation Types ───────────────────────────────────────────────

export type APIName =
  | 'heygen'
  | 'veo3'
  | 'kling'
  | 'runway'
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
  /** Per-API override for the single-call cost approval threshold (USD).
   *  When the estimated cost for a single call exceeds this value, an
   *  otherwise-auto-allowed call is upgraded to `ask`. `null` means use the
   *  project-level default (currently $0.50). */
  singleCallCostThreshold?: number | null
}

export interface APIPermissions {
  heygen: PermissionConfig
  veo3: PermissionConfig
  kling: PermissionConfig
  runway: PermissionConfig
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
  /** Scalar USD estimate used to evaluate the cost-approval threshold.
   *  Populated when the gate engine could compute one; omitted for APIs
   *  whose cost model is too variable to estimate statically. */
  estimatedCostUsd?: number
  /** When set, this request was surfaced because the scalar estimate exceeded
   *  the project's single-call threshold. Helps the UI tell the difference
   *  between "always_ask" prompts and cost-triggered prompts. */
  costThresholdExceeded?: boolean
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

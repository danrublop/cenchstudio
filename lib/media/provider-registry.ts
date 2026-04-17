export interface MediaProviderDef {
  id: string
  name: string
  category: 'video' | 'image' | 'avatar' | 'utility'
  requiresKey: string | null
  defaultEnabled: boolean
}

export const MEDIA_PROVIDERS: MediaProviderDef[] = [
  { id: 'veo3', name: 'Veo3 Video', category: 'video', requiresKey: 'GOOGLE_AI_KEY', defaultEnabled: true },
  { id: 'kling', name: 'Kling 2.1', category: 'video', requiresKey: 'FAL_KEY', defaultEnabled: true },
  { id: 'runway', name: 'Runway Gen-4', category: 'video', requiresKey: 'RUNWAY_API_KEY', defaultEnabled: true },
  {
    id: 'googleImageGen',
    name: 'Google Imagen',
    category: 'image',
    requiresKey: 'GOOGLE_AI_KEY',
    defaultEnabled: true,
  },
  { id: 'imageGen', name: 'FAL Image Gen', category: 'image', requiresKey: 'FAL_KEY', defaultEnabled: true },
  { id: 'dall-e', name: 'DALL-E 3', category: 'image', requiresKey: 'OPENAI_API_KEY', defaultEnabled: true },
  { id: 'heygen', name: 'HeyGen Avatars', category: 'avatar', requiresKey: 'HEYGEN_API_KEY', defaultEnabled: true },
  { id: 'talkinghead', name: 'TalkingHead (Free)', category: 'avatar', requiresKey: null, defaultEnabled: true },
  { id: 'musetalk', name: 'MuseTalk', category: 'avatar', requiresKey: 'FAL_KEY', defaultEnabled: true },
  { id: 'fabric', name: 'Fabric 1.0', category: 'avatar', requiresKey: 'FAL_KEY', defaultEnabled: true },
  { id: 'aurora', name: 'Aurora', category: 'avatar', requiresKey: 'FAL_KEY', defaultEnabled: true },
  { id: 'backgroundRemoval', name: 'Background Removal', category: 'utility', requiresKey: null, defaultEnabled: true },
  { id: 'unsplash', name: 'Unsplash', category: 'utility', requiresKey: null, defaultEnabled: true },
]

/** Check if a media provider is configured (API key set) */
export function isMediaProviderReady(p: MediaProviderDef): boolean {
  if (p.requiresKey) return !!process.env[p.requiresKey]
  return true // no-key providers (talkinghead, bg-removal, unsplash) always available
}

export const DEFAULT_MEDIA_PROVIDER_ENABLED: Record<string, boolean> = Object.fromEntries(
  MEDIA_PROVIDERS.map((p) => [p.id, p.defaultEnabled && isMediaProviderReady(p)]),
)

/** Unique API keys needed for media providers */
export const MEDIA_API_KEYS: { provider: string; label: string; envVar: string }[] = [
  { provider: 'google', label: 'Google AI (Veo3, Imagen)', envVar: 'GOOGLE_AI_KEY' },
  { provider: 'fal', label: 'FAL (Image Gen, Kling, Avatars)', envVar: 'FAL_KEY' },
  { provider: 'heygen', label: 'HeyGen', envVar: 'HEYGEN_API_KEY' },
  { provider: 'openai', label: 'OpenAI (DALL-E)', envVar: 'OPENAI_API_KEY' },
  { provider: 'runway', label: 'Runway Gen-4', envVar: 'RUNWAY_API_KEY' },
]

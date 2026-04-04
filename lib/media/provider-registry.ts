export interface MediaProviderDef {
  id: string
  name: string
  category: 'video' | 'image' | 'avatar' | 'utility'
  requiresKey: string | null
  defaultEnabled: boolean
}

export const MEDIA_PROVIDERS: MediaProviderDef[] = [
  { id: 'veo3', name: 'Veo3 Video', category: 'video', requiresKey: 'GOOGLE_AI_KEY', defaultEnabled: true },
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

export const DEFAULT_MEDIA_PROVIDER_ENABLED: Record<string, boolean> = Object.fromEntries(
  MEDIA_PROVIDERS.map((p) => [p.id, p.defaultEnabled]),
)

/** Unique API keys needed for media providers */
export const MEDIA_API_KEYS: { provider: string; label: string; envVar: string }[] = [
  { provider: 'google', label: 'Google AI (Veo3, Imagen)', envVar: 'GOOGLE_AI_KEY' },
  { provider: 'fal', label: 'FAL (Image Gen, Avatars)', envVar: 'FAL_KEY' },
  { provider: 'heygen', label: 'HeyGen', envVar: 'HEYGEN_API_KEY' },
  { provider: 'openai', label: 'OpenAI (DALL-E)', envVar: 'OPENAI_API_KEY' },
]

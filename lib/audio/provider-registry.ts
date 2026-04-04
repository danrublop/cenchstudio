export interface AudioProviderDef {
  id: string
  name: string
  category: 'tts' | 'sfx' | 'music'
  type: 'server' | 'client' | 'local'
  requiresKey: string | null
  defaultEnabled: boolean
}

export const AUDIO_PROVIDERS: AudioProviderDef[] = [
  // TTS providers
  {
    id: 'elevenlabs',
    name: 'ElevenLabs TTS',
    category: 'tts',
    type: 'server',
    requiresKey: 'ELEVENLABS_API_KEY',
    defaultEnabled: true,
  },
  {
    id: 'openai-tts',
    name: 'OpenAI TTS',
    category: 'tts',
    type: 'server',
    requiresKey: 'OPENAI_API_KEY',
    defaultEnabled: true,
  },
  {
    id: 'gemini-tts',
    name: 'Gemini TTS',
    category: 'tts',
    type: 'server',
    requiresKey: 'GEMINI_API_KEY',
    defaultEnabled: true,
  },
  {
    id: 'google-tts',
    name: 'Google Cloud TTS',
    category: 'tts',
    type: 'server',
    requiresKey: 'GOOGLE_TTS_API_KEY',
    defaultEnabled: true,
  },
  {
    id: 'openai-edge-tts',
    name: 'Edge TTS (Local)',
    category: 'tts',
    type: 'local',
    requiresKey: null,
    defaultEnabled: true,
  },
  { id: 'puter', name: 'Puter.js (Browser)', category: 'tts', type: 'client', requiresKey: null, defaultEnabled: true },
  {
    id: 'web-speech',
    name: 'Web Speech (Browser)',
    category: 'tts',
    type: 'client',
    requiresKey: null,
    defaultEnabled: true,
  },
  // SFX providers
  {
    id: 'elevenlabs-sfx',
    name: 'ElevenLabs SFX',
    category: 'sfx',
    type: 'server',
    requiresKey: 'ELEVENLABS_API_KEY',
    defaultEnabled: true,
  },
  {
    id: 'freesound',
    name: 'Freesound',
    category: 'sfx',
    type: 'server',
    requiresKey: 'FREESOUND_API_KEY',
    defaultEnabled: true,
  },
  {
    id: 'pixabay',
    name: 'Pixabay SFX',
    category: 'sfx',
    type: 'server',
    requiresKey: 'PIXABAY_API_KEY',
    defaultEnabled: true,
  },
  // Music providers
  {
    id: 'pixabay-music',
    name: 'Pixabay Music',
    category: 'music',
    type: 'server',
    requiresKey: 'PIXABAY_API_KEY',
    defaultEnabled: true,
  },
  {
    id: 'freesound-music',
    name: 'Freesound Music',
    category: 'music',
    type: 'server',
    requiresKey: 'FREESOUND_API_KEY',
    defaultEnabled: true,
  },
]

export const DEFAULT_AUDIO_PROVIDER_ENABLED: Record<string, boolean> = Object.fromEntries(
  AUDIO_PROVIDERS.map((p) => [p.id, p.defaultEnabled]),
)

/** Unique API keys needed for audio providers */
export const AUDIO_API_KEYS: { provider: string; label: string; envVar: string }[] = [
  { provider: 'elevenlabs', label: 'ElevenLabs', envVar: 'ELEVENLABS_API_KEY' },
  { provider: 'openai-tts', label: 'OpenAI', envVar: 'OPENAI_API_KEY' },
  { provider: 'google-tts', label: 'Google Cloud TTS', envVar: 'GOOGLE_TTS_API_KEY' },
  { provider: 'gemini-tts', label: 'Gemini', envVar: 'GEMINI_API_KEY' },
  { provider: 'freesound', label: 'Freesound', envVar: 'FREESOUND_API_KEY' },
  { provider: 'pixabay', label: 'Pixabay', envVar: 'PIXABAY_API_KEY' },
]

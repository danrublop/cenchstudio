import type { IpcMain } from 'electron'

/**
 * Category: settings
 *
 * Exposes desktop-side helpers for audio + media provider availability.
 * Replaces the former Next.js route `app/api/audio-settings/route.ts`.
 *
 * Logic is inlined here (no shared `lib/services/` layer yet) to keep the
 * Week 2 pilot self-contained. When a second category needs the same
 * env-var-driven provider inspection, hoist into `lib/services/`.
 */

type TTSProvider =
  | 'elevenlabs'
  | 'openai-tts'
  | 'gemini-tts'
  | 'google-tts'
  | 'openai-edge-tts'
  | 'pocket-tts'
  | 'voxcpm'
  | 'native-tts'
  | 'puter'
  | 'web-speech'

type SFXProvider = 'elevenlabs-sfx' | 'freesound' | 'pixabay'
type MusicProvider = 'pixabay-music' | 'freesound-music'

interface ProviderAvailability<T extends string> {
  id: T
  name: string
  available: boolean
}

interface MediaProviderInfo {
  id: string
  name: string
  category: 'video' | 'image' | 'avatar' | 'utility'
  available: boolean
}

export interface ListProvidersResult {
  providers: {
    tts: ProviderAvailability<TTSProvider>[]
    sfx: ProviderAvailability<SFXProvider>[]
    music: ProviderAvailability<MusicProvider>[]
  }
  media: MediaProviderInfo[]
}

function listProviders(): ListProvidersResult {
  return {
    providers: {
      tts: [
        { id: 'elevenlabs', name: 'ElevenLabs', available: !!process.env.ELEVENLABS_API_KEY },
        { id: 'openai-tts', name: 'OpenAI TTS', available: !!process.env.OPENAI_API_KEY },
        { id: 'gemini-tts', name: 'Gemini TTS', available: !!process.env.GEMINI_API_KEY },
        { id: 'google-tts', name: 'Google Cloud TTS', available: !!process.env.GOOGLE_TTS_API_KEY },
        { id: 'openai-edge-tts', name: 'Edge TTS (local)', available: !!process.env.EDGE_TTS_URL },
        { id: 'pocket-tts', name: 'Pocket TTS (local)', available: !!process.env.POCKET_TTS_URL },
        { id: 'voxcpm', name: 'VoxCPM2 (local GPU)', available: !!process.env.VOXCPM_URL },
        {
          id: 'native-tts',
          name: 'System Voice',
          available: process.platform === 'darwin' || process.platform === 'win32',
        },
        { id: 'puter', name: 'Puter.js', available: true },
        { id: 'web-speech', name: 'Web Speech API', available: true },
      ],
      sfx: [
        { id: 'elevenlabs-sfx', name: 'ElevenLabs SFX', available: !!process.env.ELEVENLABS_API_KEY },
        { id: 'freesound', name: 'Freesound', available: !!process.env.FREESOUND_API_KEY },
        { id: 'pixabay', name: 'Pixabay', available: !!process.env.PIXABAY_API_KEY },
      ],
      music: [
        { id: 'pixabay-music', name: 'Pixabay Music', available: !!process.env.PIXABAY_API_KEY },
        { id: 'freesound-music', name: 'Freesound Music', available: !!process.env.FREESOUND_API_KEY },
      ],
    },
    media: [
      { id: 'veo3', name: 'Veo3 Video', category: 'video', available: !!process.env.GOOGLE_AI_KEY },
      { id: 'kling', name: 'Kling 2.1', category: 'video', available: !!process.env.FAL_KEY },
      { id: 'runway', name: 'Runway Gen-4', category: 'video', available: !!process.env.RUNWAY_API_KEY },
      { id: 'googleImageGen', name: 'Google Imagen', category: 'image', available: !!process.env.GOOGLE_AI_KEY },
      { id: 'imageGen', name: 'FAL Image Gen', category: 'image', available: !!process.env.FAL_KEY },
      { id: 'dall-e', name: 'DALL-E 3', category: 'image', available: !!process.env.OPENAI_API_KEY },
      { id: 'heygen', name: 'HeyGen Avatars', category: 'avatar', available: !!process.env.HEYGEN_API_KEY },
      { id: 'talkinghead', name: 'TalkingHead (Free)', category: 'avatar', available: true },
      { id: 'musetalk', name: 'MuseTalk', category: 'avatar', available: !!process.env.FAL_KEY },
      { id: 'fabric', name: 'Fabric 1.0', category: 'avatar', available: !!process.env.FAL_KEY },
      { id: 'aurora', name: 'Aurora', category: 'avatar', available: !!process.env.FAL_KEY },
      { id: 'backgroundRemoval', name: 'Background Removal', category: 'utility', available: true },
      { id: 'unsplash', name: 'Unsplash', category: 'utility', available: true },
    ],
  }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:settings.listProviders', async () => listProviders())
}

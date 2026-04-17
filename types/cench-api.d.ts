// Global type declarations for `window.cenchApi` — the Week 2 IPC namespace
// that supersedes `window.electronAPI` (see types/electron.d.ts). Keep in
// sync with the preload bridge in `electron/preload.ts`.

export {}

export type TTSProviderId =
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

export type SFXProviderId = 'elevenlabs-sfx' | 'freesound' | 'pixabay'
export type MusicProviderId = 'pixabay-music' | 'freesound-music'

export interface ListProvidersResult {
  providers: {
    tts: { id: TTSProviderId; name: string; available: boolean }[]
    sfx: { id: SFXProviderId; name: string; available: boolean }[]
    music: { id: MusicProviderId; name: string; available: boolean }[]
  }
  media: {
    id: string
    name: string
    category: 'video' | 'image' | 'avatar' | 'utility'
    available: boolean
  }[]
}

export interface CenchApi {
  settings: {
    /** List audio + media provider availability based on configured API keys. */
    listProviders(): Promise<ListProvidersResult>
  }
}

declare global {
  interface Window {
    /**
     * The desktop IPC surface. Only present in Electron (dev or packaged).
     * In a pure browser context it is `undefined`.
     */
    cenchApi?: CenchApi
  }
}

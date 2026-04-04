export interface AudioLayer {
  enabled: boolean
  src: string | null
  volume: number // 0–1
  fadeIn: boolean
  fadeOut: boolean
  startOffset: number // seconds

  // Multi-track fields (AudioLayerV2)
  tts?: TTSTrack | null
  sfx?: SFXTrack[]
  music?: MusicTrack | null
}

// ── Audio Provider Types ─────────────────────────────────────────────────────

export type TTSProvider =
  | 'web-speech'
  | 'puter'
  | 'native-tts'
  | 'openai-edge-tts'
  | 'google-tts'
  | 'elevenlabs'
  | 'openai-tts'
  | 'gemini-tts'

export type SFXProvider = 'freesound' | 'pixabay' | 'elevenlabs-sfx'
export type MusicProvider = 'pixabay-music' | 'freesound-music'

export interface TTSTrack {
  text: string
  provider: TTSProvider
  voiceId: string | null
  src: string | null
  status: 'pending' | 'generating' | 'ready' | 'error'
  duration: number | null
  instructions: string | null
}

export interface SFXTrack {
  id: string
  name: string
  provider: SFXProvider
  src: string
  triggerAt: number
  volume: number
  duration: number | null
}

export interface MusicTrack {
  name: string
  provider: MusicProvider
  src: string
  volume: number
  loop: boolean
  duckDuringTTS: boolean
  duckLevel: number
}

export interface AudioSettings {
  defaultTTSProvider: TTSProvider | 'auto'
  defaultSFXProvider: SFXProvider | 'auto'
  defaultMusicProvider: MusicProvider | 'auto'
  defaultVoiceId: string | null
  defaultVoiceName: string | null
  webSpeechVoice: string | null
  puterProvider: 'openai' | 'elevenlabs'
  openaiTTSModel: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts'
  openaiTTSVoice: string
  geminiTTSModel: 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts'
  geminiVoice: string | null
  edgeTTSUrl: string | null
  globalMusicDucking: boolean
  globalMusicDuckLevel: number
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  defaultTTSProvider: 'auto',
  defaultSFXProvider: 'auto',
  defaultMusicProvider: 'auto',
  defaultVoiceId: null,
  defaultVoiceName: null,
  webSpeechVoice: null,
  puterProvider: 'openai',
  openaiTTSModel: 'tts-1',
  openaiTTSVoice: 'alloy',
  geminiTTSModel: 'gemini-2.5-flash-preview-tts',
  geminiVoice: null,
  edgeTTSUrl: null,
  globalMusicDucking: true,
  globalMusicDuckLevel: 0.2,
}

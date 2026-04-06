import type { AudioSettings, TTSProvider } from '../types'

/**
 * Pure resolution of which TTS provider to use — safe for client and server bundles.
 * (Do not import `audio/router.ts` from client code: it references Node-only providers.)
 */
export function getBestTTSProvider(settings?: AudioSettings | null, localMode?: boolean): TTSProvider {
  if (settings?.defaultTTSProvider && settings.defaultTTSProvider !== 'auto') {
    return settings.defaultTTSProvider
  }
  // In local mode, only use free/local TTS providers
  if (localMode) {
    if (process.env.EDGE_TTS_URL || settings?.edgeTTSUrl) return 'openai-edge-tts'
    if (process.platform === 'darwin' || process.platform === 'win32') return 'native-tts'
    return 'web-speech'
  }
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs'
  if (process.env.OPENAI_API_KEY) return 'openai-tts'
  if (process.env.GEMINI_API_KEY) return 'gemini-tts'
  if (process.env.GOOGLE_TTS_API_KEY) return 'google-tts'
  if (process.env.EDGE_TTS_URL || settings?.edgeTTSUrl) return 'openai-edge-tts'
  if (process.platform === 'darwin' || process.platform === 'win32') return 'native-tts'
  return 'web-speech'
}

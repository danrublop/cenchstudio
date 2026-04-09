/**
 * Curated marketing list for the public site (names + category tags).
 */
export type HomeModelRow = { key: string; name: string; tag: string }

const HOME_MODELS: HomeModelRow[] = [
  { key: 'sonnet-46', name: 'Sonnet 4.6', tag: 'Anthropic' },
  { key: 'opus-46', name: 'Opus 4.6', tag: 'Anthropic' },
  { key: 'gpt-51', name: 'GPT-5.1', tag: 'OpenAI' },
  { key: 'gemini-31-pro', name: 'Gemini 3.1 Pro', tag: 'Google' },
  { key: 'gemini-3-flash', name: 'Gemini 3 Flash', tag: 'Google' },
  { key: 'veo3', name: 'Veo3', tag: 'Video' },
  { key: 'kling-30', name: 'Kling 3.0', tag: 'Video' },
  { key: 'midjourney', name: 'Midjourney', tag: 'Image' },
  { key: 'nano-banana', name: 'Nano Banana', tag: 'Image' },
  { key: 'trellis', name: 'Trellis', tag: '3D' },
  { key: 'samb-3d', name: 'SAMB 3D', tag: '3D' },
  { key: 'heygen', name: 'HeyGen', tag: 'Avatar' },
  { key: 'elevenlabs', name: 'ElevenLabs', tag: 'TTS' },
  { key: 'ollama', name: 'Ollama', tag: 'Any local model' },
]

export function getHomeModelsList(): HomeModelRow[] {
  return HOME_MODELS
}

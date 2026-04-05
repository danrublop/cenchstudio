/**
 * Marketing list for the public site — built from the same registries as the app
 * (agent LLMs, media generation, audio providers).
 */
import type { ModelConfig } from '../../lib/agents/model-config'
import { DEFAULT_MODELS } from '../../lib/agents/model-config'
import { MEDIA_PROVIDERS } from '../../lib/media/provider-registry'
import { AUDIO_PROVIDERS } from '../../lib/audio/provider-registry'

export type HomeModelRow = { key: string; name: string; tag: string }

function llmProviderTag(provider: ModelConfig['provider']): string {
  switch (provider) {
    case 'anthropic':
      return 'Anthropic'
    case 'openai':
      return 'OpenAI'
    case 'google':
      return 'Google'
    case 'local':
      return 'Local'
    case 'heygen':
      return 'HeyGen'
    case 'elevenlabs':
      return 'ElevenLabs'
    case 'fal':
      return 'FAL'
    default: {
      const _x: never = provider
      return _x
    }
  }
}

const MEDIA_CATEGORY_TAG: Record<(typeof MEDIA_PROVIDERS)[number]['category'], string> = {
  video: 'Video',
  image: 'Image',
  avatar: 'Avatar',
  utility: 'Media',
}

const AUDIO_CATEGORY_TAG: Record<(typeof AUDIO_PROVIDERS)[number]['category'], string> = {
  tts: 'TTS',
  sfx: 'SFX',
  music: 'Music',
}

export function getHomeModelsList(): HomeModelRow[] {
  const llm: HomeModelRow[] = DEFAULT_MODELS.map((m) => ({
    key: `llm:${m.id}`,
    name: m.displayName,
    tag: llmProviderTag(m.provider),
  }))

  const media: HomeModelRow[] = MEDIA_PROVIDERS.map((p) => ({
    key: `media:${p.id}`,
    name: p.name,
    tag: MEDIA_CATEGORY_TAG[p.category],
  }))

  const audio: HomeModelRow[] = AUDIO_PROVIDERS.map((p) => ({
    key: `audio:${p.id}`,
    name: p.name,
    tag: AUDIO_CATEGORY_TAG[p.category],
  }))

  return [...llm, ...media, ...audio]
}

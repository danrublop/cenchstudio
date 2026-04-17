import { klingProvider } from './kling'
import { runwayProvider } from './runway'
import { veo3Provider } from './veo3'
import type { VideoProviderClient } from './types'

export const VIDEO_PROVIDERS: Record<string, VideoProviderClient> = {
  veo3: veo3Provider,
  kling: klingProvider,
  runway: runwayProvider,
}

/** Default order used when no explicit provider is requested. Veo 3 stays
 *  first because it's the original Cench provider and has the most coverage.
 *  The selector module (`lib/providers/selector.ts`) should be preferred over
 *  this fallback for any new caller. */
export const VIDEO_PROVIDER_FALLBACK_ORDER = ['veo3', 'kling', 'runway'] as const

export type VideoProviderId = keyof typeof VIDEO_PROVIDERS

export function getVideoProvider(id: string): VideoProviderClient | null {
  return VIDEO_PROVIDERS[id] ?? null
}

/** First provider whose env var is set. Returns null if none configured. */
export function firstConfiguredVideoProvider(): VideoProviderClient | null {
  for (const id of VIDEO_PROVIDER_FALLBACK_ORDER) {
    const p = VIDEO_PROVIDERS[id]
    if (p && process.env[p.envKey]) return p
  }
  return null
}

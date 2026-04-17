import { RESEARCH_PROVIDERS, isResearchProviderReady } from './provider-registry'
import type {
  SearchResponse,
  WebSearchOptions,
  FetchedURLContent,
  FetchURLOptions,
  StockVideoSearchOptions,
  StockVideoSearchResponse,
} from './types'

/**
 * Picks the first configured + enabled search provider and runs the query.
 * No silent fallback between providers — if the picked one fails, the error propagates.
 */
export async function runWebSearch(
  opts: WebSearchOptions,
  researchProviderEnabled?: Record<string, boolean>,
): Promise<SearchResponse> {
  const pick = pickSearchProvider(researchProviderEnabled)
  if (!pick) {
    throw new Error(
      'No web search provider is configured and enabled. Set BRAVE_SEARCH_API_KEY (or TAVILY_API_KEY / EXA_API_KEY) and enable the provider in Settings.',
    )
  }
  switch (pick) {
    case 'brave': {
      const { braveSearch } = await import('./providers/brave-search')
      return braveSearch(opts)
    }
    default:
      throw new Error(`Unknown search provider: ${pick}`)
  }
}

export function pickSearchProvider(researchProviderEnabled?: Record<string, boolean>): string | null {
  const searchProviders = RESEARCH_PROVIDERS.filter((p) => p.category === 'search')
  for (const p of searchProviders) {
    const enabled = researchProviderEnabled?.[p.id] ?? p.defaultEnabled
    if (enabled && isResearchProviderReady(p)) return p.id
  }
  return null
}

export async function runUrlFetch(opts: FetchURLOptions): Promise<FetchedURLContent> {
  const { fetchUrlContent } = await import('./providers/url-fetch')
  return fetchUrlContent(opts)
}

/**
 * Picks the first enabled + configured + implemented stock-video provider and runs the query.
 * No silent fallback — if the picked provider fails, the error propagates to the caller.
 * Preference order: explicit `source` option → Pexels → Pixabay.
 */
export async function runStockVideoSearch(
  opts: StockVideoSearchOptions & { source?: 'pexels' | 'pixabay' },
  researchProviderEnabled?: Record<string, boolean>,
): Promise<StockVideoSearchResponse> {
  const pick = opts.source
    ? opts.source === 'pexels'
      ? 'pexels-video'
      : opts.source === 'pixabay'
        ? 'pixabay-video'
        : null
    : pickStockVideoProvider(researchProviderEnabled)

  if (!pick) {
    throw new Error(
      'No stock-video provider is configured and enabled. Set PEXELS_API_KEY or PIXABAY_API_KEY and enable the provider in Settings.',
    )
  }

  if (pick === 'pexels-video') {
    const { pexelsVideoSearch } = await import('./providers/pexels')
    return pexelsVideoSearch(opts)
  }
  if (pick === 'pixabay-video') {
    const { pixabayVideoSearch } = await import('./providers/pixabay')
    return pixabayVideoSearch(opts)
  }
  throw new Error(`Unknown stock-video provider: ${pick}`)
}

export function pickStockVideoProvider(researchProviderEnabled?: Record<string, boolean>): string | null {
  const stockProviders = RESEARCH_PROVIDERS.filter((p) => p.category === 'stock-video')
  for (const p of stockProviders) {
    const enabled = researchProviderEnabled?.[p.id] ?? p.defaultEnabled
    if (enabled && isResearchProviderReady(p)) return p.id
  }
  return null
}

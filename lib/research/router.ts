import { RESEARCH_PROVIDERS, isResearchProviderReady } from './provider-registry'
import type {
  SearchResponse,
  WebSearchOptions,
  FetchedURLContent,
  FetchURLOptions,
  StockVideoSearchOptions,
  StockVideoSearchResponse,
  StockImageSearchOptions,
  StockImageSearchResponse,
  ArchivalSearchOptions,
  ArchivalSearchResponse,
  ArchivalItem,
} from './types'

/**
 * Third-party web search fallback path. Native search on Anthropic / OpenAI / Gemini
 * models is handled by the runner directly and never calls this function. This is
 * only reached for local or claude-code routing, or when the user has explicitly
 * configured a third-party provider. No silent cascade between providers.
 */
export async function runWebSearch(
  opts: WebSearchOptions,
  researchProviderEnabled?: Record<string, boolean>,
): Promise<SearchResponse> {
  const pick = pickSearchProvider(researchProviderEnabled)
  if (!pick) {
    throw new Error(
      'No web search provider is configured for this model. Pick a model with native web search (Claude, GPT, or Gemini), or set BRAVE_SEARCH_API_KEY / TAVILY_API_KEY / EXA_API_KEY and enable it in Settings.',
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

/**
 * Stock image search. Currently one provider (Unsplash); Pexels Images and
 * Pixabay Images can slot in later. No silent fallback.
 */
export async function runStockImageSearch(
  opts: StockImageSearchOptions & { source?: 'unsplash' },
  researchProviderEnabled?: Record<string, boolean>,
): Promise<StockImageSearchResponse> {
  const pick = opts.source ?? pickStockImageProvider(researchProviderEnabled)
  if (!pick) {
    throw new Error(
      'No stock-image provider is configured and enabled. Set UNSPLASH_ACCESS_KEY and enable the provider in Settings.',
    )
  }
  if (pick === 'unsplash') {
    const { unsplashImageSearch } = await import('./providers/unsplash')
    return unsplashImageSearch(opts)
  }
  throw new Error(`Unknown stock-image provider: ${pick}`)
}

export function pickStockImageProvider(researchProviderEnabled?: Record<string, boolean>): string | null {
  const stockImages = RESEARCH_PROVIDERS.filter((p) => p.category === 'stock-image')
  for (const p of stockImages) {
    const enabled = researchProviderEnabled?.[p.id] ?? p.defaultEnabled
    if (enabled && isResearchProviderReady(p)) return p.id
  }
  return null
}

/**
 * Archival media search — fans out across Archive.org, NASA, and Wikimedia in
 * parallel, merges results. This is the one router entry that DOES merge
 * across providers, because archival sources are complementary (not alternate
 * options for the same corpus) and the agent benefits from hitting all three
 * at once. Individual provider failures are silenced so one bad day doesn't
 * nuke the whole query.
 */
export async function runArchivalSearch(
  opts: ArchivalSearchOptions & { sources?: Array<'archive-org' | 'nasa' | 'wikimedia'> },
  researchProviderEnabled?: Record<string, boolean>,
): Promise<ArchivalSearchResponse> {
  const enabledProviders = (['archive-org', 'nasa', 'wikimedia'] as const).filter((id) => {
    if (opts.sources && !opts.sources.includes(id)) return false
    const p = RESEARCH_PROVIDERS.find((x) => x.id === id)
    if (!p) return false
    if (!isResearchProviderReady(p)) return false
    const enabled = researchProviderEnabled?.[id] ?? p.defaultEnabled
    return enabled
  })

  if (enabledProviders.length === 0) {
    throw new Error('No archival provider is enabled. Enable Archive.org, NASA, or Wikimedia in Settings.')
  }

  // Split count across providers, floor 3 per provider.
  const perProvider = Math.max(3, Math.floor((opts.count ?? 12) / enabledProviders.length))
  const perOpts = { ...opts, count: perProvider }

  const hits = await Promise.allSettled(
    enabledProviders.map(async (id) => {
      if (id === 'archive-org') {
        const { archiveOrgSearch } = await import('./providers/archive-org')
        return archiveOrgSearch(perOpts)
      }
      if (id === 'nasa') {
        const { nasaSearch } = await import('./providers/nasa')
        return nasaSearch(perOpts)
      }
      const { wikimediaCommonsSearch } = await import('./providers/wikimedia-commons')
      return wikimediaCommonsSearch(perOpts)
    }),
  )

  const all: ArchivalItem[] = []
  let totalFound = 0
  for (const h of hits) {
    if (h.status === 'fulfilled') {
      all.push(...h.value.results)
      totalFound += h.value.totalFound ?? h.value.results.length
    }
  }

  // Interleave by source so top-K isn't dominated by one provider.
  const merged = interleaveBySource(all)

  return {
    results: merged.slice(0, opts.count ?? 12),
    query: opts.query,
    provider: enabledProviders.join('+'),
    totalFound,
  }
}

function interleaveBySource(items: ArchivalItem[]): ArchivalItem[] {
  const buckets = new Map<string, ArchivalItem[]>()
  for (const i of items) {
    const arr = buckets.get(i.source) ?? []
    arr.push(i)
    buckets.set(i.source, arr)
  }
  const out: ArchivalItem[] = []
  let added = true
  while (added) {
    added = false
    for (const arr of buckets.values()) {
      const next = arr.shift()
      if (next) {
        out.push(next)
        added = true
      }
    }
  }
  return out
}

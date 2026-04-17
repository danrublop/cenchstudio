export interface ResearchProviderDef {
  id: string
  name: string
  category: 'search' | 'url-fetch' | 'stock-video'
  requiresKey: string | null
  defaultEnabled: boolean
  /** When false, router skips this provider (registered for UI / future, no code path yet). */
  implemented: boolean
}

export const RESEARCH_PROVIDERS: ResearchProviderDef[] = [
  {
    id: 'brave',
    name: 'Brave Search',
    category: 'search',
    requiresKey: 'BRAVE_SEARCH_API_KEY',
    defaultEnabled: true,
    implemented: true,
  },
  {
    id: 'tavily',
    name: 'Tavily',
    category: 'search',
    requiresKey: 'TAVILY_API_KEY',
    defaultEnabled: true,
    implemented: false,
  },
  { id: 'exa', name: 'Exa', category: 'search', requiresKey: 'EXA_API_KEY', defaultEnabled: false, implemented: false },
  {
    id: 'url-fetch',
    name: 'URL Reader',
    category: 'url-fetch',
    requiresKey: null,
    defaultEnabled: true,
    implemented: true,
  },
  {
    id: 'pexels-video',
    name: 'Pexels Video',
    category: 'stock-video',
    requiresKey: 'PEXELS_API_KEY',
    defaultEnabled: true,
    implemented: true,
  },
  {
    id: 'pixabay-video',
    name: 'Pixabay Video',
    category: 'stock-video',
    requiresKey: 'PIXABAY_API_KEY',
    defaultEnabled: true,
    implemented: true,
  },
]

/** Check if a research provider is configured (API key set or no key needed) AND implemented. */
export function isResearchProviderReady(p: ResearchProviderDef): boolean {
  if (!p.implemented) return false
  if (p.requiresKey) return !!process.env[p.requiresKey]
  return true
}

export const DEFAULT_RESEARCH_PROVIDER_ENABLED: Record<string, boolean> = Object.fromEntries(
  RESEARCH_PROVIDERS.map((p) => [p.id, p.defaultEnabled && isResearchProviderReady(p)]),
)

/** Unique API keys needed for research providers */
export const RESEARCH_API_KEYS: { provider: string; label: string; envVar: string }[] = [
  { provider: 'brave', label: 'Brave Search', envVar: 'BRAVE_SEARCH_API_KEY' },
  { provider: 'pexels', label: 'Pexels (Video + Images)', envVar: 'PEXELS_API_KEY' },
  { provider: 'pixabay', label: 'Pixabay (Video + Images + SFX)', envVar: 'PIXABAY_API_KEY' },
]

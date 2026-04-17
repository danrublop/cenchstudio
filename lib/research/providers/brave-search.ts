import type { SearchResponse, SearchResult, WebSearchOptions } from '../types'

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'

const FRESHNESS_MAP: Record<string, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
  year: 'py',
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function braveSearch(opts: WebSearchOptions): Promise<SearchResponse> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is not set')

  const count = Math.min(Math.max(opts.count ?? 5, 1), 10)
  const query = opts.site ? `${opts.query} site:${opts.site}` : opts.query
  const params = new URLSearchParams({ q: query, count: String(count) })
  if (opts.recency && opts.recency !== 'any') {
    const f = FRESHNESS_MAP[opts.recency]
    if (f) params.set('freshness', f)
  }

  const response = await fetch(`${BRAVE_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Brave Search failed: ${response.status} ${text.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string
        url?: string
        description?: string
        age?: string
        profile?: { img?: string }
        meta_url?: { favicon?: string; hostname?: string }
      }>
    }
  }

  const results: SearchResult[] = (data.web?.results ?? []).map((r) => ({
    title: stripTags(r.title ?? ''),
    url: r.url ?? '',
    snippet: stripTags(r.description ?? ''),
    publishedAt: r.age,
    sourceDomain: r.meta_url?.hostname ?? domainFromUrl(r.url ?? ''),
    favicon: r.meta_url?.favicon ?? r.profile?.img,
  }))

  return {
    results,
    query: opts.query,
    provider: 'brave',
    totalFound: results.length,
  }
}

import { ok, err, type ToolResult, type WorldStateMutable } from './_shared'

export const RESEARCH_TOOL_NAMES = ['web_search', 'fetch_url_content', 'find_stock_videos'] as const

export function createResearchToolHandler() {
  return async function handleResearchTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
  ): Promise<ToolResult> {
    if (!world.researchEnabled) {
      return err(
        'Research mode is off. The user must enable it via the Research toggle in the chat input before this tool can run.',
      )
    }

    switch (toolName) {
      case 'web_search': {
        const { query, count, recency, site } = args as {
          query?: string
          count?: number
          recency?: 'day' | 'week' | 'month' | 'year' | 'any'
          site?: string
        }
        if (!query || typeof query !== 'string') return err('query is required')
        try {
          const { runWebSearch } = await import('@/lib/research/router')
          const response = await runWebSearch({ query, count, recency, site }, world.researchProviderEnabled)
          return ok(null, `Searched "${query}" — ${response.results.length} results`, response)
        } catch (e: any) {
          return err(`Web search failed: ${e?.message ?? String(e)}`)
        }
      }

      case 'fetch_url_content': {
        const { url, extract } = args as {
          url?: string
          extract?: 'article' | 'full' | 'metadata'
        }
        if (!url || typeof url !== 'string') return err('url is required')
        try {
          new URL(url)
        } catch {
          return err(`Invalid URL: ${url}`)
        }
        try {
          const { runUrlFetch } = await import('@/lib/research/router')
          const result = await runUrlFetch({ url, extract })
          const summary = `Fetched ${result.siteName || new URL(url).hostname} — ${result.wordCount} words`
          return ok(null, summary, result)
        } catch (e: any) {
          return err(`URL fetch failed: ${e?.message ?? String(e)}`)
        }
      }

      case 'find_stock_videos': {
        const { query, count, orientation, minDurationSec, maxDurationSec, minWidth, source } = args as {
          query?: string
          count?: number
          orientation?: 'landscape' | 'portrait' | 'square'
          minDurationSec?: number
          maxDurationSec?: number
          minWidth?: number
          source?: 'pexels' | 'pixabay'
        }
        if (!query || typeof query !== 'string') return err('query is required')
        try {
          const { runStockVideoSearch } = await import('@/lib/research/router')
          const response = await runStockVideoSearch(
            { query, count, orientation, minDurationSec, maxDurationSec, minWidth, source },
            world.researchProviderEnabled,
          )
          const summary = `Found ${response.results.length} video${response.results.length === 1 ? '' : 's'} for "${query}" via ${response.provider}`
          return ok(null, summary, response)
        } catch (e: any) {
          return err(`Stock video search failed: ${e?.message ?? String(e)}`)
        }
      }

      default:
        return err(`Unknown research tool: ${toolName}`)
    }
  }
}

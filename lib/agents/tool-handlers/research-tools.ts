import { ok, err, type ToolResult, type WorldStateMutable } from './_shared'

export const RESEARCH_TOOL_NAMES = [
  'web_search',
  'fetch_url_content',
  'find_stock_videos',
  'find_stock_images',
  'find_archival_footage',
  'fetch_video_from_url',
] as const

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
        // Sanity check: if the active model advertises native web search, the
        // context-builder should have swapped this tool to a provider-native marker
        // (web_search_20250305 / openai_web_search / google_search) — we'd never land
        // in this handler. Hitting this path means the swap misfired; surface a clear
        // internal error instead of silently hitting the third-party router.
        const { modelHasNativeWebSearch } = await import('@/lib/agents/model-config')
        if (world.modelId && modelHasNativeWebSearch(world.modelId, world.modelConfigs)) {
          return err(
            `Internal: active model "${world.modelId}" has native web search but the custom web_search handler was invoked. Context-builder swap likely failed.`,
          )
        }
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

      case 'find_stock_images': {
        const { query, count, orientation, minWidth } = args as {
          query?: string
          count?: number
          orientation?: 'landscape' | 'portrait' | 'square'
          minWidth?: number
        }
        if (!query || typeof query !== 'string') return err('query is required')
        try {
          const { runStockImageSearch } = await import('@/lib/research/router')
          const response = await runStockImageSearch(
            { query, count, orientation, minWidth },
            world.researchProviderEnabled,
          )
          const summary = `Found ${response.results.length} photo${response.results.length === 1 ? '' : 's'} for "${query}" via ${response.provider}`
          return ok(null, summary, response)
        } catch (e: any) {
          return err(`Stock image search failed: ${e?.message ?? String(e)}`)
        }
      }

      case 'fetch_video_from_url': {
        const { url, projectId, formatId } = args as { url?: string; projectId?: string; formatId?: string }
        if (!url || typeof url !== 'string') return err('url is required')
        if (!projectId || typeof projectId !== 'string') return err('projectId is required')
        try {
          new URL(url)
        } catch {
          return err(`Invalid URL: ${url}`)
        }
        // Require explicit per-project consent for yt-dlp before any download proceeds.
        // Probe is allowed without consent (it doesn't download content).
        if (formatId && !world.ytDlpConsentedProjects?.has(projectId)) {
          return err(
            'yt-dlp download requires user consent. The app must show the legal disclaimer modal and persist consent before this tool can download. (Probe-only calls without formatId are OK.)',
          )
        }
        try {
          const svc = await import('@/lib/services/ingest')
          const data = await svc.ingestUrl({ url, projectId, formatId })
          if (data.mode === 'probe') {
            return ok(
              null,
              `Probed ${data.title} (${Math.round(data.durationSec)}s) — ${data.formats.length} formats available, recommended: ${data.recommendedFormatId}`,
              data,
            )
          }
          return ok(
            null,
            `Downloaded "${data.asset.name}" via yt-dlp (${Math.round(data.asset.durationSeconds ?? 0)}s, ${Math.round(data.asset.sizeBytes / 1024 / 1024)} MB) → asset ${data.asset.id}`,
            data,
          )
        } catch (e) {
          const svc = await import('@/lib/services/ingest')
          if (e instanceof svc.YtDlpMissingError) {
            return err(`yt-dlp not installed: ${e.message}`)
          }
          return err(`yt-dlp ingest failed: ${(e as Error)?.message ?? String(e)}`)
        }
      }

      case 'find_archival_footage': {
        const { query, count, mediaType, yearFrom, yearTo } = args as {
          query?: string
          count?: number
          mediaType?: 'image' | 'video' | 'audio' | 'any'
          yearFrom?: number
          yearTo?: number
        }
        if (!query || typeof query !== 'string') return err('query is required')
        try {
          const { runArchivalSearch } = await import('@/lib/research/router')
          const response = await runArchivalSearch(
            { query, count, mediaType, yearFrom, yearTo },
            world.researchProviderEnabled,
          )
          const summary = `Found ${response.results.length} archival item${response.results.length === 1 ? '' : 's'} for "${query}" across ${response.provider}`
          return ok(null, summary, response)
        } catch (e: any) {
          return err(`Archival search failed: ${e?.message ?? String(e)}`)
        }
      }

      default:
        return err(`Unknown research tool: ${toolName}`)
    }
  }
}

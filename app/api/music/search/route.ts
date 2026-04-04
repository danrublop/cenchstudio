import { NextRequest, NextResponse } from 'next/server'
import type { MusicProvider } from '@/lib/types'
import { getBestMusicProvider, getMusicProvider } from '@/lib/audio/router'
import { downloadToLocal } from '@/lib/audio/download'

export async function POST(req: NextRequest) {
  const { query, provider: requestedProvider, limit = 10, download = false } = await req.json()

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const providerId: MusicProvider = requestedProvider ?? getBestMusicProvider()

  try {
    const impl = await getMusicProvider(providerId)
    const results = await impl.search(query, limit)

    // If download=true, download remote URLs to local storage for scene HTML use
    if (download && results.length > 0) {
      const localResults = await Promise.all(
        results.map(async (r) => {
          if (r.audioUrl.startsWith('http')) {
            const localUrl = await downloadToLocal(r.audioUrl, 'music')
            return { ...r, audioUrl: localUrl, previewUrl: r.previewUrl || r.audioUrl }
          }
          return r
        }),
      )
      return NextResponse.json({ results: localResults, provider: providerId })
    }

    return NextResponse.json({ results, provider: providerId })
  } catch (err: unknown) {
    console.error('Music search error:', err)
    const message = err instanceof Error ? err.message : 'Music search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

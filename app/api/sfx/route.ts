import { NextRequest, NextResponse } from 'next/server'
import type { SFXProvider } from '@/lib/types'
import { getBestSFXProvider, getSFXProvider } from '@/lib/audio/router'
import { downloadToLocal } from '@/lib/audio/download'

export async function POST(req: NextRequest) {
  const { query, provider: requestedProvider, limit = 10, prompt, duration, download = false } = await req.json()

  if (!query && !prompt) {
    return NextResponse.json({ error: 'query or prompt is required' }, { status: 400 })
  }

  const providerId: SFXProvider = requestedProvider ?? getBestSFXProvider()

  try {
    const impl = await getSFXProvider(providerId)

    // If prompt is provided and provider supports generation, generate instead of search
    if (prompt && impl.generate) {
      const result = await impl.generate(prompt, duration)
      return NextResponse.json({ results: [result], provider: providerId, mode: 'generated' })
    }

    const results = await impl.search(query || prompt, limit)

    // If download=true, download remote URLs to local storage for scene HTML use
    if (download && results.length > 0) {
      const localResults = await Promise.all(
        results.map(async (r) => {
          if (r.audioUrl.startsWith('http')) {
            const localUrl = await downloadToLocal(r.audioUrl, 'sfx')
            return { ...r, audioUrl: localUrl, previewUrl: r.previewUrl || r.audioUrl }
          }
          return r
        }),
      )
      return NextResponse.json({ results: localResults, provider: providerId, mode: 'search' })
    }

    return NextResponse.json({ results, provider: providerId, mode: 'search' })
  } catch (err: unknown) {
    console.error('SFX error:', err)
    const message = err instanceof Error ? err.message : 'SFX search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

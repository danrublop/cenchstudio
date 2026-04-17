import { NextRequest, NextResponse } from 'next/server'
import { runArchivalSearch } from '@/lib/research/router'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, count, mediaType, yearFrom, yearTo, sources, researchProviderEnabled } = body as {
      query?: string
      count?: number
      mediaType?: 'image' | 'video' | 'audio' | 'any'
      yearFrom?: number
      yearTo?: number
      sources?: Array<'archive-org' | 'nasa' | 'wikimedia'>
      researchProviderEnabled?: Record<string, boolean>
    }
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    const result = await runArchivalSearch(
      { query, count, mediaType, yearFrom, yearTo, sources },
      researchProviderEnabled,
    )
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Archival search failed' }, { status: 500 })
  }
}

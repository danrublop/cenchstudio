import { NextRequest, NextResponse } from 'next/server'
import { runStockVideoSearch } from '@/lib/research/router'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, count, orientation, minDurationSec, maxDurationSec, minWidth, source, researchProviderEnabled } =
      body as {
        query?: string
        count?: number
        orientation?: 'landscape' | 'portrait' | 'square'
        minDurationSec?: number
        maxDurationSec?: number
        minWidth?: number
        source?: 'pexels' | 'pixabay'
        researchProviderEnabled?: Record<string, boolean>
      }
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    const result = await runStockVideoSearch(
      { query, count, orientation, minDurationSec, maxDurationSec, minWidth, source },
      researchProviderEnabled,
    )
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Stock video search failed' }, { status: 500 })
  }
}

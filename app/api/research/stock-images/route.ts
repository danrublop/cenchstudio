import { NextRequest, NextResponse } from 'next/server'
import { runStockImageSearch } from '@/lib/research/router'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, count, orientation, minWidth, source, researchProviderEnabled } = body as {
      query?: string
      count?: number
      orientation?: 'landscape' | 'portrait' | 'square'
      minWidth?: number
      source?: 'unsplash'
      researchProviderEnabled?: Record<string, boolean>
    }
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    const result = await runStockImageSearch({ query, count, orientation, minWidth, source }, researchProviderEnabled)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Stock image search failed' }, { status: 500 })
  }
}

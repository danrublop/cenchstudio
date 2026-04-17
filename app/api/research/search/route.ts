import { NextRequest, NextResponse } from 'next/server'
import { runWebSearch } from '@/lib/research/router'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, count, recency, site, researchProviderEnabled } = body as {
      query?: string
      count?: number
      recency?: 'day' | 'week' | 'month' | 'year' | 'any'
      site?: string
      researchProviderEnabled?: Record<string, boolean>
    }
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    const result = await runWebSearch({ query, count, recency, site }, researchProviderEnabled)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Web search failed' }, { status: 500 })
  }
}

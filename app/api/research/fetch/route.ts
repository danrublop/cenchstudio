import { NextRequest, NextResponse } from 'next/server'
import { runUrlFetch } from '@/lib/research/router'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, extract } = body as {
      url?: string
      extract?: 'article' | 'full' | 'metadata'
    }
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    const result = await runUrlFetch({ url, extract })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'URL fetch failed' }, { status: 500 })
  }
}

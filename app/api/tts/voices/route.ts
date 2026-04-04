import { NextRequest, NextResponse } from 'next/server'
import type { TTSProvider } from '@/lib/types'
import { getTTSProvider } from '@/lib/audio/router'

const voiceCache = new Map<string, { voices: unknown[]; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') as TTSProvider | null

  if (!provider) {
    return NextResponse.json({ error: 'provider param required' }, { status: 400 })
  }

  // Check cache
  const cached = voiceCache.get(provider)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ voices: cached.voices, provider })
  }

  try {
    const impl = await getTTSProvider(provider)
    if (!impl.listVoices) {
      return NextResponse.json({ voices: [], provider })
    }

    const voices = await impl.listVoices()
    voiceCache.set(provider, { voices, timestamp: Date.now() })

    return NextResponse.json({ voices, provider })
  } catch (err: unknown) {
    console.error('Voice list error:', err)
    const message = err instanceof Error ? err.message : 'Failed to list voices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

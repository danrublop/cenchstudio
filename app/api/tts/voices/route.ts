import { NextRequest, NextResponse } from 'next/server'
import type { TTSProvider } from '@/lib/types'
import { listVoices, AudioValidationError } from '@/lib/services/audio'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.tts-voices')

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') as TTSProvider | null

  if (!provider) {
    return NextResponse.json({ error: 'provider param required' }, { status: 400 })
  }

  try {
    const result = await listVoices(provider)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AudioValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    log.error('Voice list error:', { error: err })
    const message = err instanceof Error ? err.message : 'Failed to list voices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

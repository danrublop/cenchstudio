import { NextRequest, NextResponse } from 'next/server'
import { getOptionalUser } from '@/lib/auth-helpers'
import { searchMusic, AudioValidationError } from '@/lib/services/audio'
import { sanitizeErrorMessage } from '@/lib/audio/sanitize'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.music')

export async function POST(req: NextRequest) {
  await getOptionalUser()
  const body = await req.json()
  try {
    const result = await searchMusic(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AudioValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    log.error('Music search error:', { error: err })
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getOptionalUser } from '@/lib/auth-helpers'
import { synthesizeTTS, AudioValidationError } from '@/lib/services/audio'
import { sanitizeErrorMessage } from '@/lib/audio/sanitize'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.tts')

export async function POST(req: NextRequest) {
  await getOptionalUser()
  const body = await req.json()
  try {
    const result = await synthesizeTTS(body)
    if ('mode' in result) return NextResponse.json(result)
    return NextResponse.json({
      url: result.url,
      duration: result.duration,
      provider: result.provider,
      captions: result.captions,
    })
  } catch (err) {
    if (err instanceof AudioValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    log.error('TTS error:', { error: err })
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 })
  }
}

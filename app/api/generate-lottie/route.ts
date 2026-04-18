import { NextRequest, NextResponse } from 'next/server'
import { generateLottie, GenerationValidationError, LottieParseError } from '@/lib/services/generation'

export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    const result = await generateLottie(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof GenerationValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof LottieParseError) {
      return NextResponse.json({ error: err.message, usage: err.usage }, { status: 502 })
    }
    console.error('[generate-lottie]', err)
    const message =
      err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

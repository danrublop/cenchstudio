import { NextRequest, NextResponse } from 'next/server'
import { generateMotion, GenerationValidationError } from '@/lib/services/generation'

export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    const gen = await generateMotion({
      prompt: body.prompt,
      palette: body.palette ?? ['#1a1a2e', '#e84545', '#16a34a', '#2563eb'],
      font: body.font ?? 'Caveat',
      bgColor: body.bgColor ?? '#fffef9',
      duration: body.duration ?? 8,
      previousSummary: body.previousSummary ?? '',
      modelId: body.modelId,
      modelConfigs: body.modelConfigs,
    })
    return NextResponse.json({ result: gen.result, usage: gen.usage })
  } catch (err) {
    if (err instanceof GenerationValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[generate-motion]', err)
    const message =
      err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

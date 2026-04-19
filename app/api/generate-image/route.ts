import { NextRequest, NextResponse } from 'next/server'
import { generateImageAsset, GenerationValidationError } from '@/lib/services/generation'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.generate-image')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await generateImageAsset(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof GenerationValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    log.error('Image generation error:', { error: err })
    return NextResponse.json({ error: (err as Error)?.message ?? 'Image generation failed' }, { status: 500 })
  }
}

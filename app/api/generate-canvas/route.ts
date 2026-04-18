import { NextRequest, NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/with-handler'
import { validateBody } from '@/lib/api/validate'
import { apiError } from '@/lib/api/response'
import { generateCanvasSchema } from '@/lib/api/schemas/generate'
import { generateCanvas, GenerationValidationError } from '@/lib/services/generation'

export const POST = withHandler(async (req: NextRequest) => {
  const body = await req.json()
  const result = validateBody(generateCanvasSchema, body)
  if (!result.success) return result.error

  const { prompt, palette, bgColor, duration, previousSummary } = result.data
  const { modelId, modelConfigs } = body

  try {
    const gen = await generateCanvas({
      prompt,
      palette,
      bgColor,
      duration,
      previousSummary,
      modelId,
      modelConfigs,
    })
    if (gen.truncated) {
      // Legacy route returned 422 with this message; keep the same surface for UI toasts.
      return apiError(
        'Scene code was too long and got cut off — try a simpler prompt or break into multiple scenes',
        422,
      )
    }
    return NextResponse.json({ result: gen.result, usage: gen.usage })
  } catch (err) {
    if (err instanceof GenerationValidationError) {
      return apiError(err.message, 400)
    }
    console.error('[generate-canvas]', err)
    return apiError((err as Error).message ?? 'Canvas generation failed', 500)
  }
})

import { NextRequest, NextResponse } from 'next/server'
import {
  generateSvg,
  enhancePrompt,
  summarizeScene,
  editSvg,
  GenerationValidationError,
} from '@/lib/services/generation'

/**
 * Multi-mode generation endpoint. Body flags select the operation:
 *   `edit: true`      → rewrite existing SVG per `editInstruction`
 *   `enhance: true`   → one-sentence scene-prompt enhancement
 *   `summarize: true` → 200-token summary of prompt + svgContent
 *   (default)         → new SVG from prompt
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { enhance, summarize, edit } = body

  try {
    if (edit) {
      const result = await editSvg({
        svgContent: body.svgContent,
        editInstruction: body.editInstruction,
        modelId: body.modelId,
        modelConfigs: body.modelConfigs,
      })
      return NextResponse.json(result)
    }
    if (enhance) {
      const result = await enhancePrompt({
        prompt: body.prompt,
        modelId: body.modelId,
        modelConfigs: body.modelConfigs,
      })
      return NextResponse.json(result)
    }
    if (summarize) {
      const result = await summarizeScene({
        prompt: body.prompt,
        svgContent: body.svgContent,
        modelId: body.modelId,
        modelConfigs: body.modelConfigs,
      })
      return NextResponse.json(result)
    }
    const result = await generateSvg({
      prompt: body.prompt,
      palette: body.palette,
      strokeWidth: body.strokeWidth,
      font: body.font,
      duration: body.duration,
      previousSummary: body.previousSummary,
      modelId: body.modelId,
      modelConfigs: body.modelConfigs,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof GenerationValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('Generate error:', err)
    const message =
      err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CANVAS_SYSTEM_PROMPT } from '../../../lib/generation/prompts'
import { withHandler } from '@/lib/api/with-handler'
import { validateBody } from '@/lib/api/validate'
import { apiError } from '@/lib/api/response'
import { generateCanvasSchema } from '@/lib/api/schemas/generate'
import { env } from '@/lib/env'
import { generateCode } from '@/lib/generation/generate'
import { getModelProvider } from '@/lib/agents/types'

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || undefined })

export const POST = withHandler(async (req: NextRequest) => {
  const body = await req.json()
  const result = validateBody(generateCanvasSchema, body)
  if (!result.success) return result.error

  const { prompt, palette, bgColor, duration, previousSummary } = result.data
  const { modelId, modelConfigs } = body

  // Route through generateCode() for local/non-Anthropic models
  if (modelId && getModelProvider(modelId, modelConfigs) !== 'anthropic') {
    const gen = await generateCode('canvas2d', prompt, {
      palette, bgColor, duration, previousSummary,
      modelId, modelConfigs,
    })
    return NextResponse.json({ result: gen.code, usage: gen.usage })
  }

  if (!env.ANTHROPIC_API_KEY) {
    return apiError('ANTHROPIC_API_KEY not set', 500)
  }

  const systemPrompt = CANVAS_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)
  const msg = await client.messages.create({
    model: modelId || 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  if (msg.stop_reason === 'max_tokens') {
    console.warn(`[generate-canvas] Output truncated (${msg.usage.output_tokens} tokens)`)
    return apiError('Scene code was too long and got cut off — try a simpler prompt or break into multiple scenes', 422)
  }

  const textBlock = msg.content.find((b: Anthropic.ContentBlock) => b.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : ''
  const costUsd = (msg.usage.input_tokens / 1_000_000) * 3 + (msg.usage.output_tokens / 1_000_000) * 15

  return NextResponse.json({
    result: text,
    usage: {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cost_usd: costUsd,
    },
  })
})

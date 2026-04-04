import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { CANVAS_SYSTEM_PROMPT } from '../../../lib/generation/prompts'
import { withHandler } from '@/lib/api/with-handler'
import { validateBody } from '@/lib/api/validate'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { generateCanvasSchema } from '@/lib/api/schemas/generate'
import { env } from '@/lib/env'

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || undefined })

export const POST = withHandler(async (req: NextRequest) => {
  const body = await req.json()
  const result = validateBody(generateCanvasSchema, body)
  if (!result.success) return result.error

  const { prompt, palette, bgColor, duration, previousSummary } = result.data

  if (!env.ANTHROPIC_API_KEY) {
    return apiError('ANTHROPIC_API_KEY not set', 500)
  }

  const systemPrompt = CANVAS_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
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

  return apiSuccess({
    result: text,
    usage: {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cost_usd: costUsd,
    },
  })
})

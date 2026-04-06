import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { LOTTIE_OVERLAY_PROMPT } from '../../../lib/generation/prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    prompt,
    palette = ['#1a1a2e', '#e84545', '#16a34a', '#2563eb'],
    font = 'Caveat',
    duration = 8,
    previousSummary = '',
  } = body

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  try {
    const systemPrompt = LOTTIE_OVERLAY_PROMPT(palette, font, duration, previousSummary)
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })
    const textBlock = msg.content.find((b: any) => b.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : ''
    const costUsd = (msg.usage.input_tokens / 1_000_000) * 3 + (msg.usage.output_tokens / 1_000_000) * 15
    const usage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: costUsd }

    // Validate that the result is valid JSON (Lottie format)
    try {
      const cleaned = text
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim()
      JSON.parse(cleaned)
    } catch {
      console.error('[generate-lottie] Model returned invalid JSON:', text.slice(0, 200))
      return NextResponse.json(
        { error: 'Model returned invalid Lottie JSON. Please try again.', usage },
        { status: 502 },
      )
    }

    return NextResponse.json({ result: text, usage })
  } catch (err: unknown) {
    console.error('Lottie overlay generate error:', err)
    const message = err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

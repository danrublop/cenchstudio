import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CANVAS_SYSTEM_PROMPT } from '../../../lib/generation/prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    prompt,
    palette = ['#181818', '#121212', '#e84545', '#151515', '#f0ece0'],
    bgColor = '#fffef9',
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
    const systemPrompt = CANVAS_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const costUsd = (msg.usage.input_tokens / 1_000_000) * 3 + (msg.usage.output_tokens / 1_000_000) * 15
    return NextResponse.json({ result: text, usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: costUsd } })
  } catch (err: unknown) {
    console.error('Canvas generate error:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

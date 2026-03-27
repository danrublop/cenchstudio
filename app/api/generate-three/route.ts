import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { THREE_SYSTEM_PROMPT } from '../../../lib/generation/prompts'

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
    const systemPrompt = THREE_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)

    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = result.content[0].type === 'text' ? result.content[0].text : ''
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse generated JSON', raw }, { status: 500 })
    }

    const usage = result.usage
    const costUsd = (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15

    return NextResponse.json({
      result: parsed,
      usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cost_usd: costUsd },
    })
  } catch (err: unknown) {
    console.error('Three.js generate error:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { ZDOG_SYSTEM_PROMPT } from '../../../lib/generation/prompts'
import { composeDeterministicZdogScene } from '../../../lib/zdog'
import type { ZdogComposedSceneSpec } from '../../../lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    prompt,
    palette = ['#1a1a2e', '#e84545', '#16a34a', '#2563eb'],
    bgColor = '#fffef9',
    duration = 8,
    previousSummary = '',
    mode = 'llm',
    composedSpec,
  } = body

  if (mode === 'composed') {
    const spec = composedSpec as ZdogComposedSceneSpec | undefined
    if (!spec || !Array.isArray(spec.people) || !Array.isArray(spec.modules) || !Array.isArray(spec.beats)) {
      return NextResponse.json(
        { error: 'composedSpec with people/modules/beats is required for composed mode' },
        { status: 400 },
      )
    }
    const result = composeDeterministicZdogScene(spec, { duration })
    return NextResponse.json({
      result,
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      mode: 'composed',
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  try {
    const systemPrompt = ZDOG_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)

    const result = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = result.content.find((b: any) => b.type === 'text')
    const raw = textBlock?.type === 'text' ? textBlock.text : ''
    const cleaned = raw
      .replace(/^```(?:js|javascript)\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const usage = result.usage
    const costUsd = (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15

    return NextResponse.json({
      result: cleaned,
      usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cost_usd: costUsd },
    })
  } catch (err: unknown) {
    console.error('Zdog generate error:', err)
    const message = err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

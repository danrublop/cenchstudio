import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { REACT_SYSTEM_PROMPT } from '../../../lib/generation/prompts'
import { generateCode } from '@/lib/generation/generate'
import { getModelProvider } from '@/lib/agents/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    prompt,
    palette = ['#1a1a2e', '#e84545', '#16a34a', '#2563eb'],
    font = 'Caveat',
    bgColor = '#fffef9',
    duration = 8,
    previousSummary = '',
    modelId,
    modelConfigs,
  } = body

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  // Route through generateCode() for local/non-Anthropic models
  if (modelId && getModelProvider(modelId, modelConfigs) !== 'anthropic') {
    try {
      const gen = await generateCode('react', prompt, {
        palette, font, bgColor, duration, previousSummary,
        modelId, modelConfigs,
      })
      return NextResponse.json({
        result: { sceneCode: gen.code, styles: gen.styles },
        usage: gen.usage,
      })
    } catch (err: unknown) {
      console.error('React generate error:', err)
      const message = err instanceof Error ? err.message.replace(/[a-zA-Z0-9_-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  try {
    const systemPrompt = REACT_SYSTEM_PROMPT(palette, font, bgColor, duration, previousSummary)

    const result = await client.messages.create({
      model: modelId || 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = result.content.find((b: any) => b.type === 'text')
    const raw = textBlock?.type === 'text' ? textBlock.text : ''
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const usage = result.usage
    const costUsd = (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // If JSON parse fails, treat the raw output as JSX code directly
      return NextResponse.json({
        result: { sceneCode: raw },
        usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cost_usd: costUsd },
      })
    }
    return NextResponse.json({
      result: parsed,
      usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cost_usd: costUsd },
    })
  } catch (err: unknown) {
    console.error('React generate error:', err)
    const message = err instanceof Error ? err.message.replace(/[a-zA-Z0-9_-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

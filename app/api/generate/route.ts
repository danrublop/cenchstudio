import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import {
  SVG_SYSTEM_PROMPT,
  ENHANCE_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  EDIT_SYSTEM_PROMPT,
} from '../../../lib/generation/prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function calcCost(usage: { input_tokens: number; output_tokens: number }) {
  return (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    prompt,
    palette = ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
    strokeWidth = 2,
    font = 'Caveat',
    duration = 8,
    previousSummary = '',
    enhance = false,
    summarize = false,
    edit = false,
    editInstruction = '',
    svgContent = '',
  } = body

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  try {
    if (edit) {
      if (!svgContent || !editInstruction) {
        return NextResponse.json({ error: 'svgContent and editInstruction required' }, { status: 400 })
      }
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: EDIT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `EXISTING SVG:\n${svgContent}\n\nEDIT INSTRUCTION:\n${editInstruction}` }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const costUsd = calcCost(msg.usage)
      return NextResponse.json({ result: text, usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: costUsd } })
    }

    if (enhance) {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: ENHANCE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Enhance this scene description: "${prompt}"` }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ result: text })
    }

    if (summarize) {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Original prompt: "${prompt}"\n\nSVG content (truncated): ${svgContent.slice(0, 2000)}` }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ result: text })
    }

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const systemPrompt = SVG_SYSTEM_PROMPT(palette, strokeWidth, font, duration, previousSummary)
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const costUsd = calcCost(msg.usage)
    return NextResponse.json({ result: text, usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: costUsd } })
  } catch (err: unknown) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

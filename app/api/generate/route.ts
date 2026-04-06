import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import {
  SVG_SYSTEM_PROMPT,
  ENHANCE_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  EDIT_SYSTEM_PROMPT,
} from '../../../lib/generation/prompts'
import { generateCode } from '@/lib/generation/generate'
import { getModelProvider } from '@/lib/agents/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function calcCost(usage: { input_tokens: number; output_tokens: number }) {
  return (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15
}

function extractText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

/**
 * Simple completion helper for local/non-Anthropic models.
 * Used for edit, enhance, summarize operations that don't go through generateCode().
 */
async function callLocalSimple(
  modelId: string,
  modelConfigs: any[],
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number; cost_usd: number } }> {
  const config = modelConfigs?.find((m: any) => m.id === modelId || m.modelId === modelId)
  const endpoint = config?.endpoint ?? process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  const localModelName = config?.localModelName ?? modelId
  const OpenAI = require('openai').default
  const localClient = new OpenAI({ baseURL: `${endpoint}/v1`, apiKey: 'ollama' })
  const result = await localClient.chat.completions.create({
    model: localModelName,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  }, { timeout: 120_000 })
  return {
    text: result.choices?.[0]?.message?.content ?? '',
    usage: {
      input_tokens: result.usage?.prompt_tokens ?? 0,
      output_tokens: result.usage?.completion_tokens ?? 0,
      cost_usd: 0,
    },
  }
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
    modelId,
    modelConfigs,
  } = body

  const isLocal = modelId && getModelProvider(modelId, modelConfigs) !== 'anthropic'

  if (!isLocal && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const operation = edit ? 'edit' : enhance ? 'enhance' : summarize ? 'summarize' : 'generate'
  console.log(`[Generate] ${operation}: prompt="${(prompt || editInstruction || '').slice(0, 120)}" local=${!!isLocal}`)

  try {
    if (edit) {
      if (!svgContent || !editInstruction) {
        return NextResponse.json({ error: 'svgContent and editInstruction required' }, { status: 400 })
      }
      if (isLocal) {
        const result = await callLocalSimple(modelId, modelConfigs, EDIT_SYSTEM_PROMPT,
          `EXISTING SVG:\n${svgContent}\n\nEDIT INSTRUCTION:\n${editInstruction}`, 8192)
        return NextResponse.json({ result: result.text, usage: result.usage })
      }
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: EDIT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `EXISTING SVG:\n${svgContent}\n\nEDIT INSTRUCTION:\n${editInstruction}` }],
      })
      const text = extractText(msg.content)
      const costUsd = calcCost(msg.usage)
      console.log(
        `[Generate] edit complete: tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out cost=$${costUsd.toFixed(4)}`,
      )
      return NextResponse.json({
        result: text,
        usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: costUsd },
      })
    }

    if (enhance) {
      if (isLocal) {
        const result = await callLocalSimple(modelId, modelConfigs, ENHANCE_SYSTEM_PROMPT,
          `Enhance this scene description: "${prompt}"`, 512)
        return NextResponse.json({ result: result.text, usage: result.usage })
      }
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: ENHANCE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Enhance this scene description: "${prompt}"` }],
      })
      const text = extractText(msg.content)
      const costUsd = calcCost(msg.usage)
      console.log(
        `[Generate] enhance complete: tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out cost=$${costUsd.toFixed(4)}`,
      )
      return NextResponse.json({
        result: text,
        usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: costUsd },
      })
    }

    if (summarize) {
      if (isLocal) {
        const result = await callLocalSimple(modelId, modelConfigs, SUMMARY_SYSTEM_PROMPT,
          `Original prompt: "${prompt}"\n\nSVG content (truncated): ${svgContent.slice(0, 2000)}`, 200)
        return NextResponse.json({ result: result.text })
      }
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Original prompt: "${prompt}"\n\nSVG content (truncated): ${svgContent.slice(0, 2000)}`,
          },
        ],
      })
      const text = extractText(msg.content)
      return NextResponse.json({ result: text })
    }

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    // SVG generation — route through generateCode() for local models
    if (isLocal) {
      const gen = await generateCode('svg', prompt, {
        palette, strokeWidth, font, duration, previousSummary,
        modelId, modelConfigs,
      })
      return NextResponse.json({ result: gen.code, usage: gen.usage })
    }

    const systemPrompt = SVG_SYSTEM_PROMPT(palette, strokeWidth, font, duration, previousSummary)
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = extractText(msg.content)
    const costUsd = calcCost(msg.usage)
    console.log(
      `[Generate] generate complete: tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out cost=$${costUsd.toFixed(4)} resultLen=${text.length}`,
    )
    return NextResponse.json({
      result: text,
      usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: costUsd },
    })
  } catch (err: unknown) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

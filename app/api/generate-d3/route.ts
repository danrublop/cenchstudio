import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { D3_SYSTEM_PROMPT } from '../../../lib/generation/prompts'
import { runStructuredD3Generation } from '../../../lib/generation/d3-structured-run'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function validateD3SceneCode(sceneCode: string): string[] {
  const issues: string[] = []
  if (!sceneCode.includes('window.__tl')) {
    issues.push('Missing window.__tl timeline usage')
  }
  if (!sceneCode.includes('renderAtTime')) {
    issues.push('Missing deterministic renderAtTime(t) function')
  }
  if (!sceneCode.includes('window.__updateScene')) {
    issues.push('Missing window.__updateScene(t) seek hook')
  }
  if (/setTimeout\s*\(/.test(sceneCode) || /setInterval\s*\(/.test(sceneCode)) {
    issues.push('Uses setTimeout/setInterval, which breaks playback sync')
  }
  return issues
}

async function generateOnceLegacy(systemPrompt: string, userContent: string) {
  const result = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })

  const textBlock = result.content.find((b: any) => b.type === 'text')
  const raw = textBlock?.type === 'text' ? textBlock.text : ''
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned)
  return { result, parsed, raw }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    prompt,
    palette = ['#1a1a2e', '#e84545', '#16a34a', '#2563eb'],
    font = 'Caveat',
    bgColor = '#fffef9',
    duration = 8,
    d3Data = null,
    previousSummary = '',
    mode = 'cench_charts',
  } = body

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  try {
    if (mode === 'legacy') {
      let usageInput = 0
      let usageOutput = 0
      const systemPrompt = D3_SYSTEM_PROMPT(palette, font, bgColor, duration, previousSummary)
      const userContent = d3Data
        ? `${prompt}\n\nExisting data to visualize:\n${JSON.stringify(d3Data, null, 2)}`
        : prompt

      let parsed: any
      let raw = ''
      try {
        const first = await generateOnceLegacy(systemPrompt, userContent)
        parsed = first.parsed
        raw = first.raw
        usageInput += first.result.usage.input_tokens
        usageOutput += first.result.usage.output_tokens

        const sceneCode = typeof parsed?.sceneCode === 'string' ? parsed.sceneCode : ''
        const issues = validateD3SceneCode(sceneCode)
        if (issues.length > 0) {
          const repairPrompt = `${userContent}

Your previous JSON failed playback/seek validation:
- ${issues.join('\n- ')}

Regenerate the full JSON and fix those issues. Keep the same chart intent and style.`
          const second = await generateOnceLegacy(systemPrompt, repairPrompt)
          parsed = second.parsed
          raw = second.raw
          usageInput += second.result.usage.input_tokens
          usageOutput += second.result.usage.output_tokens
        }
      } catch {
        console.error('[D3 generate legacy] JSON parse failed, raw length:', raw.length)
        return NextResponse.json(
          {
            error: 'Failed to parse generated code — the model returned invalid JSON. Please try again.',
            usage: {
              input_tokens: usageInput,
              output_tokens: usageOutput,
              cost_usd: (usageInput / 1_000_000) * 3 + (usageOutput / 1_000_000) * 15,
            },
          },
          { status: 500 },
        )
      }

      const finalSceneCode = typeof parsed?.sceneCode === 'string' ? parsed.sceneCode : ''
      const finalIssues = validateD3SceneCode(finalSceneCode)
      if (finalIssues.length > 0) {
        return NextResponse.json(
          {
            error: `Generated D3 scene is not playback-safe: ${finalIssues.join('; ')}`,
          },
          { status: 500 },
        )
      }

      const costUsd = (usageInput / 1_000_000) * 3 + (usageOutput / 1_000_000) * 15
      return NextResponse.json({
        result: { ...parsed, chartLayers: [] },
        usage: { input_tokens: usageInput, output_tokens: usageOutput, cost_usd: costUsd },
        mode: 'legacy',
      })
    }

    try {
      const out = await runStructuredD3Generation({
        prompt,
        palette,
        font,
        bgColor,
        duration,
        previousSummary,
        d3Data,
      })
      const costUsd = (out.usage.input_tokens / 1_000_000) * 3 + (out.usage.output_tokens / 1_000_000) * 15
      return NextResponse.json({
        result: {
          chartLayers: out.chartLayers,
          sceneCode: out.sceneCode,
          d3Data: out.d3Data,
          styles: out.styles,
          suggestedData: out.d3Data,
        },
        usage: { input_tokens: out.usage.input_tokens, output_tokens: out.usage.output_tokens, cost_usd: costUsd },
        mode: 'cench_charts',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Structured D3 generation failed'
      console.error('[D3 generate structured]', e)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (err: unknown) {
    console.error('D3 generate error:', err)
    const message = err instanceof Error ? err.message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

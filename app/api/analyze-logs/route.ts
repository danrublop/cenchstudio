import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getLogsForAnalysis } from '@/lib/db/queries/generation-logs'

const client = new Anthropic()

/**
 * POST /api/analyze-logs
 * AI-powered analysis of generation logs using extended thinking.
 */
export async function POST(req: NextRequest) {
  try {
    const { question, limit = 50 } = await req.json()

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 })
    }

    const logs = await getLogsForAnalysis(limit)

    if (logs.length === 0) {
      return NextResponse.json({
        analysis:
          'No generation logs with quality scores found yet. Generate some scenes, interact with them (keep, edit, or regenerate), and then try again.',
        thinking: '',
        logsAnalyzed: 0,
      })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 12000,
      thinking: { type: 'enabled', budget_tokens: 8000 },
      system: `You are a prompt engineering analyst for Cench Studio, an AI-powered animated explainer video creator. You analyze generation logs to find patterns that explain why some AI-generated scenes are good and others aren't.

Your goal is to suggest concrete improvements to system prompts, rule files, and model selection.

Be specific. Quote actual prompts and thinking content. Suggest exact wording changes to rule files. Focus on actionable insights, not general observations.

Quality score interpretation: 0 = terrible (immediately regenerated), 0.5 = neutral, 1.0 = excellent (kept without edits).
User actions: "kept" = accepted as-is, "edited" = accepted but modified, "regenerated" = rejected and re-generated, "deleted" = removed entirely.`,
      messages: [
        {
          role: 'user',
          content: `Question: ${question}

Generation logs (${logs.length} samples):
${JSON.stringify(logs, null, 2)}`,
        },
      ],
    })

    const analysis = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const thinking = response.content
      .filter((b): b is Anthropic.ThinkingBlock => b.type === 'thinking')
      .map((b) => b.thinking)
      .join('')

    return NextResponse.json({
      analysis,
      thinking,
      logsAnalyzed: logs.length,
    })
  } catch (error) {
    console.error('[analyze-logs] Error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

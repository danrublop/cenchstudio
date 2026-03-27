/**
 * Direct Anthropic SDK generation function for use in server-side contexts
 * (e.g., agent tool executor) where relative fetch() URLs are not valid.
 *
 * This module selects the correct system prompt and parsing strategy for
 * each SceneType, mirroring the logic in the individual API route handlers.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SceneType } from '../types'
import { logSpend } from '../db'
import {
  SVG_SYSTEM_PROMPT,
  CANVAS_SYSTEM_PROMPT,
  D3_SYSTEM_PROMPT,
  THREE_SYSTEM_PROMPT,
  MOTION_SYSTEM_PROMPT,
  LOTTIE_OVERLAY_PROMPT,
  ZDOG_SYSTEM_PROMPT,
} from './prompts'

const client = new Anthropic()

export interface GenerateCodeOptions {
  palette?: string[]
  bgColor?: string
  duration?: number
  font?: string
  strokeWidth?: number
  previousSummary?: string
  d3Data?: unknown
}

export interface GenerateCodeResult {
  code: string
  /** For D3/Motion types that include a CSS styles block */
  styles?: string
  /** For Motion types that include HTML body content */
  htmlContent?: string
  /** For D3 types that return suggested data */
  suggestedData?: unknown
  usage: { input_tokens: number; output_tokens: number; cost_usd: number }
}

/**
 * Generate code for a scene layer using the Anthropic SDK directly.
 * Selects the correct system prompt and response-parsing strategy per layerType.
 *
 * @param layerType - The SceneType determining which prompt and parser to use
 * @param prompt    - The user-facing prompt describing what to generate
 * @param options   - Style/composition options forwarded to the system prompt
 * @param projectId - Optional project ID for spend logging
 */
export async function generateCode(
  layerType: SceneType,
  prompt: string,
  options: GenerateCodeOptions,
  projectId?: string,
): Promise<GenerateCodeResult> {
  const {
    palette = ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
    bgColor = '#181818',
    duration = 8,
    font = 'Caveat',
    strokeWidth = 2,
    previousSummary = '',
    d3Data,
  } = options

  // ── Build system prompt and user content per layer type ───────────────────

  let systemPrompt: string
  let userContent: string = prompt

  switch (layerType) {
    case 'svg':
      systemPrompt = SVG_SYSTEM_PROMPT(palette, strokeWidth, font, duration, previousSummary)
      break
    case 'canvas2d':
      systemPrompt = CANVAS_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)
      break
    case 'd3':
      systemPrompt = D3_SYSTEM_PROMPT(palette, font, bgColor, duration, previousSummary)
      if (d3Data) {
        userContent = `${prompt}\n\nExisting data to visualize:\n${JSON.stringify(d3Data, null, 2)}`
      }
      break
    case 'three':
      systemPrompt = THREE_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)
      break
    case 'motion':
      systemPrompt = MOTION_SYSTEM_PROMPT(palette, font, bgColor, duration, previousSummary)
      break
    case 'lottie':
      systemPrompt = LOTTIE_OVERLAY_PROMPT(palette, font, duration, previousSummary)
      break
    case 'zdog' as SceneType:
      systemPrompt = ZDOG_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)
      break
    default:
      throw new Error(`Unknown layer type: ${layerType}`)
  }

  // ── Call Anthropic with one retry ─────────────────────────────────────────

  let result: Anthropic.Message
  try {
    result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
  } catch (firstErr) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
  }

  const raw = result.content[0].type === 'text' ? result.content[0].text : ''
  const usage = result.usage
  const costUsd = (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15

  // Log spend if projectId provided
  if (projectId) {
    await logSpend(projectId, `generation:${layerType}`, costUsd, prompt.slice(0, 200))
  }

  const usageResult = {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: costUsd,
  }

  // ── Parse response per layer type ─────────────────────────────────────────

  switch (layerType) {
    case 'svg':
    case 'canvas2d':
      // Raw text is the code
      return { code: raw, usage: usageResult }

    case 'lottie':
    case 'zdog' as SceneType:
      // Raw text is the code
      return { code: raw, usage: usageResult }

    case 'd3': {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      return {
        code: parsed.sceneCode ?? '',
        styles: parsed.styles,
        suggestedData: parsed.suggestedData,
        usage: usageResult,
      }
    }

    case 'three': {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      return {
        code: parsed.sceneCode ?? '',
        usage: usageResult,
      }
    }

    case 'motion': {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      return {
        code: parsed.sceneCode ?? '',
        styles: parsed.styles,
        htmlContent: parsed.htmlContent,
        usage: usageResult,
      }
    }

    default:
      return { code: raw, usage: usageResult }
  }
}

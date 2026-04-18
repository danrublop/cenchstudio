/**
 * Scene-code generation service.
 *
 * Thin wrappers over `lib/generation/generate.ts` `generateCode()` that
 * normalize the response shape per scene type. Every HTTP route for
 * scene-type generators + the Electron IPC handlers + (eventually) agent
 * tool handlers all call these functions rather than fetching each other.
 *
 * The underlying `generateCode()` already supports Anthropic, OpenAI,
 * Google, and local (Ollama) providers — routing happens in there based
 * on `modelId` + `modelConfigs`.
 *
 * Only the canvas variant is exposed today; motion/three/react/lottie/zdog
 * extract in follow-up commits.
 */

import Anthropic from '@anthropic-ai/sdk'
import { generateCode, type GenerateCodeOptions } from '@/lib/generation/generate'
import { LOTTIE_OVERLAY_PROMPT } from '@/lib/generation/prompts'
import { validateLottieJSON } from '@/lib/motion/lottie-validator'
import { scoreLottieQuality } from '@/lib/motion/quality-score'
import type { MotionPersonality } from '@/lib/motion/easing'

export type UsageShape = {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface GenerateCanvasInput {
  prompt: string
  palette?: string[]
  bgColor?: string
  duration?: number
  previousSummary?: string
  modelId?: GenerateCodeOptions['modelId']
  modelConfigs?: GenerateCodeOptions['modelConfigs']
}

export interface GenerateCanvasResult {
  result: string
  usage: UsageShape
  truncated?: boolean
}

/**
 * Canvas2D scene code. Returns raw JS code as a string — no JSON parsing,
 * no structured fields. Matches the HTTP route contract (`{ result: string, usage }`).
 */
export async function generateCanvas(input: GenerateCanvasInput): Promise<GenerateCanvasResult> {
  if (!input.prompt) {
    throw new GenerationValidationError('prompt is required')
  }
  const gen = await generateCode('canvas2d', input.prompt, {
    palette: input.palette,
    bgColor: input.bgColor,
    duration: input.duration,
    previousSummary: input.previousSummary,
    modelId: input.modelId,
    modelConfigs: input.modelConfigs,
  })
  return { result: gen.code, usage: gen.usage, truncated: gen.truncated }
}

// ── Motion ─────────────────────────────────────────────────────────────────

export interface GenerateMotionInput extends GenerateCanvasInput {
  font?: string
}

export interface GenerateMotionResult {
  result: { sceneCode: string; styles?: unknown; htmlContent?: unknown }
  usage: UsageShape
  truncated?: boolean
}

export async function generateMotion(input: GenerateMotionInput): Promise<GenerateMotionResult> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')
  const gen = await generateCode('motion', input.prompt, {
    palette: input.palette,
    bgColor: input.bgColor,
    duration: input.duration,
    previousSummary: input.previousSummary,
    font: input.font,
    modelId: input.modelId,
    modelConfigs: input.modelConfigs,
  })
  return {
    result: { sceneCode: gen.code, styles: gen.styles, htmlContent: gen.htmlContent },
    usage: gen.usage,
    truncated: gen.truncated,
  }
}

// ── Three ──────────────────────────────────────────────────────────────────

export interface GenerateThreeInput extends GenerateCanvasInput {}

export interface GenerateThreeResult {
  result: { sceneCode: string }
  usage: UsageShape
  truncated?: boolean
}

export async function generateThree(input: GenerateThreeInput): Promise<GenerateThreeResult> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')
  const gen = await generateCode('three', input.prompt, {
    palette: input.palette,
    bgColor: input.bgColor,
    duration: input.duration,
    previousSummary: input.previousSummary,
    modelId: input.modelId,
    modelConfigs: input.modelConfigs,
  })
  return { result: { sceneCode: gen.code }, usage: gen.usage, truncated: gen.truncated }
}

// ── React ──────────────────────────────────────────────────────────────────

export interface GenerateReactInput extends GenerateMotionInput {}

export interface GenerateReactResult {
  result: { sceneCode: string; styles?: unknown }
  usage: UsageShape
  truncated?: boolean
}

export async function generateReact(input: GenerateReactInput): Promise<GenerateReactResult> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')
  const gen = await generateCode('react', input.prompt, {
    palette: input.palette,
    bgColor: input.bgColor,
    duration: input.duration,
    previousSummary: input.previousSummary,
    font: input.font,
    modelId: input.modelId,
    modelConfigs: input.modelConfigs,
  })
  return { result: { sceneCode: gen.code, styles: gen.styles }, usage: gen.usage, truncated: gen.truncated }
}

// ── D3 data visualization ──────────────────────────────────────────────────

export interface GenerateD3Input {
  prompt: string
  palette?: string[]
  font?: string
  bgColor?: string
  duration?: number
  previousSummary?: string
  d3Data?: unknown
  /** Default `'cench_charts'` (structured pipeline). `'legacy'` uses the old raw-JSON path. */
  mode?: 'cench_charts' | 'legacy'
}

export interface GenerateD3Result {
  result: {
    chartLayers: unknown[]
    sceneCode: string
    d3Data: unknown
    styles: unknown
    suggestedData: unknown
  }
  usage: UsageShape
  mode: 'cench_charts' | 'legacy'
}

export async function generateD3(input: GenerateD3Input): Promise<GenerateD3Result> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const { runStructuredD3Generation } = await import('@/lib/generation/d3-structured-run')

  // Only the default structured path runs here. Legacy mode (raw JSON +
  // playback-safety validation + single-shot repair) is exposed only via
  // the HTTP route to keep this service lean; zero renderer callers use it.
  if (input.mode === 'legacy') {
    throw new GenerationValidationError(
      'Legacy D3 mode is HTTP-only. Use the cench_charts structured pipeline instead.',
    )
  }

  const out = await runStructuredD3Generation({
    prompt: input.prompt,
    palette: input.palette ?? ['#1a1a2e', '#e84545', '#16a34a', '#2563eb'],
    font: input.font ?? 'Caveat',
    bgColor: input.bgColor ?? '#fffef9',
    duration: input.duration ?? 8,
    previousSummary: input.previousSummary ?? '',
    d3Data: input.d3Data,
  })
  const costUsd = (out.usage.input_tokens / 1_000_000) * 3 + (out.usage.output_tokens / 1_000_000) * 15
  return {
    result: {
      chartLayers: out.chartLayers,
      sceneCode: out.sceneCode,
      d3Data: out.d3Data,
      styles: out.styles,
      suggestedData: out.d3Data,
    },
    usage: { input_tokens: out.usage.input_tokens, output_tokens: out.usage.output_tokens, cost_usd: costUsd },
    mode: 'cench_charts',
  }
}

// ── Lottie overlay ─────────────────────────────────────────────────────────
// Different shape from canvas/motion/three/react — goes straight to
// Anthropic (no `generateCode` wrapper) because it needs motionPersonality
// in the system prompt + post-generation validation + quality scoring.

export interface GenerateLottieInput {
  prompt: string
  palette?: string[]
  font?: string
  duration?: number
  previousSummary?: string
  motionPersonality?: MotionPersonality
}

export interface GenerateLottieResult {
  result: string
  usage: UsageShape
  quality: { score: number; dimensions: unknown; suggestions: unknown }
  fixCount?: number
}

export class LottieParseError extends Error {
  readonly code = 'LOTTIE_PARSE' as const
  constructor(
    message: string,
    public readonly usage: UsageShape,
  ) {
    super(message)
    this.name = 'LottieParseError'
  }
}

let anthropicClient: Anthropic | null = null

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

export async function generateLottie(input: GenerateLottieInput): Promise<GenerateLottieResult> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const palette = input.palette ?? ['#1a1a2e', '#e84545', '#16a34a', '#2563eb']
  const font = input.font ?? 'Caveat'
  const duration = input.duration ?? 8
  const motionPersonality = input.motionPersonality ?? 'corporate'

  const systemPrompt = LOTTIE_OVERLAY_PROMPT(
    palette,
    font,
    duration,
    input.previousSummary ?? '',
    true,
    undefined,
    motionPersonality,
  )

  const msg = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: input.prompt }],
  })

  const textBlock = msg.content.find((b) => b.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : ''
  const usage: UsageShape = {
    input_tokens: msg.usage.input_tokens,
    output_tokens: msg.usage.output_tokens,
    cost_usd: (msg.usage.input_tokens / 1_000_000) * 3 + (msg.usage.output_tokens / 1_000_000) * 15,
  }

  let cleaned: string
  let parsed: Record<string, unknown>
  try {
    cleaned = text
      .replace(/^```json\s*/, '')
      .replace(/```\s*$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[generate-lottie] Model returned invalid JSON:', text.slice(0, 200))
    throw new LottieParseError('Model returned invalid Lottie JSON. Please try again.', usage)
  }

  const validation = validateLottieJSON(parsed, { fix: true })
  if (validation.warnings.length > 0) {
    console.warn(`[generate-lottie] ${validation.warnings.length} warnings:`, validation.warnings)
  }
  if (!validation.valid) {
    console.error('[generate-lottie] Validation errors after auto-fix:', validation.errors)
  }

  const finalJson = validation.fixCount > 0 ? validation.fixed! : parsed
  const resultJson = validation.fixCount > 0 ? JSON.stringify(finalJson) : cleaned

  const quality = scoreLottieQuality(finalJson, {
    personality: motionPersonality,
    expectedDuration: duration,
  })
  if (quality.total < 40) {
    console.warn(`[generate-lottie] Low quality score: ${quality.total}/100`, quality.suggestions)
  }

  return {
    result: resultJson,
    usage,
    quality: { score: quality.total, dimensions: quality.dimensions, suggestions: quality.suggestions },
    ...(validation.fixCount > 0 && { fixCount: validation.fixCount }),
  }
}

export class GenerationValidationError extends Error {
  readonly code = 'VALIDATION' as const
  constructor(message: string) {
    super(message)
    this.name = 'GenerationValidationError'
  }
}

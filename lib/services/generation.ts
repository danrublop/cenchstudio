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
import { createLogger } from '@/lib/logger'

const log = createLogger('generation')
import type { MotionPersonality } from '@/lib/motion/easing'
import { getModelProvider } from '@/lib/agents/types'

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
    log.error('generate-lottie: model returned invalid JSON', { extra: { sample: text.slice(0, 200) } })
    throw new LottieParseError('Model returned invalid Lottie JSON. Please try again.', usage)
  }

  const validation = validateLottieJSON(parsed, { fix: true })
  if (validation.warnings.length > 0) {
    log.warn('generate-lottie: validation warnings', {
      extra: { count: validation.warnings.length, warnings: validation.warnings },
    })
  }
  if (!validation.valid) {
    log.error('generate-lottie: validation errors after auto-fix', { extra: { errors: validation.errors } })
  }

  const finalJson = validation.fixCount > 0 ? validation.fixed! : parsed
  const resultJson = validation.fixCount > 0 ? JSON.stringify(finalJson) : cleaned

  const quality = scoreLottieQuality(finalJson, {
    personality: motionPersonality,
    expectedDuration: duration,
  })
  if (quality.total < 40) {
    log.warn('generate-lottie: low quality score', {
      extra: { score: quality.total, suggestions: quality.suggestions },
    })
  }

  return {
    result: resultJson,
    usage,
    quality: { score: quality.total, dimensions: quality.dimensions, suggestions: quality.suggestions },
    ...(validation.fixCount > 0 && { fixCount: validation.fixCount }),
  }
}

// ── SVG main + enhance + summarize + edit ──────────────────────────────────
// The default `/api/generate` route has four modes on one POST handler.
// Each is its own service function so callers don't have to juggle body
// flags. Local models route through `callLocalSimple()`; Anthropic gets
// the scene-type SDK call.

type ModelConfigLike = { id?: string; modelId?: string; endpoint?: string; localModelName?: string }

/** OpenAI-compat shim for any configured local (Ollama-style) model. */
async function callLocalSimple(
  modelId: string,
  modelConfigs: ModelConfigLike[] | undefined,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<{ text: string; usage: UsageShape }> {
  const config = modelConfigs?.find((m) => m.id === modelId || m.modelId === modelId)
  const endpoint = config?.endpoint ?? process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  const localModelName = config?.localModelName ?? modelId
  const OpenAI = (await import('openai')).default
  const localClient = new OpenAI({ baseURL: `${endpoint}/v1`, apiKey: 'ollama' })
  const result = await localClient.chat.completions.create(
    {
      model: localModelName,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    },
    { timeout: 120_000 },
  )
  return {
    text: result.choices?.[0]?.message?.content ?? '',
    usage: {
      input_tokens: result.usage?.prompt_tokens ?? 0,
      output_tokens: result.usage?.completion_tokens ?? 0,
      cost_usd: 0,
    },
  }
}

function isLocalModel(modelId: string | undefined, modelConfigs: ModelConfigLike[] | undefined): boolean {
  if (!modelId) return false
  // Match the Anthropic-check used by the original routes — any non-Anthropic
  // provider (OpenAI/Google/local) routes through the local/provider-specific
  // helper. `getModelProvider` is the source of truth.
  return (
    getModelProvider(
      modelId as Parameters<typeof getModelProvider>[0],
      modelConfigs as Parameters<typeof getModelProvider>[1],
    ) !== 'anthropic'
  )
}

function calcAnthropicCost(usage: { input_tokens: number; output_tokens: number }): number {
  return (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15
}

function extractAnthropicText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

export interface GenerateSvgInput {
  prompt: string
  palette?: string[]
  strokeWidth?: number
  font?: string
  duration?: number
  previousSummary?: string
  modelId?: string
  modelConfigs?: ModelConfigLike[]
}

export async function generateSvg(input: GenerateSvgInput): Promise<{ result: string; usage: UsageShape }> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')

  if (isLocalModel(input.modelId, input.modelConfigs)) {
    const gen = await generateCode('svg', input.prompt, {
      palette: input.palette,
      strokeWidth: input.strokeWidth,
      font: input.font,
      duration: input.duration,
      previousSummary: input.previousSummary,
      modelId: input.modelId as GenerateCodeOptions['modelId'],
      modelConfigs: input.modelConfigs as GenerateCodeOptions['modelConfigs'],
    })
    return { result: gen.code, usage: gen.usage }
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const { SVG_SYSTEM_PROMPT } = await import('@/lib/generation/prompts')
  const systemPrompt = SVG_SYSTEM_PROMPT(
    input.palette ?? ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
    input.strokeWidth ?? 2,
    input.font ?? 'Caveat',
    input.duration ?? 8,
    input.previousSummary ?? '',
  )
  const msg = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: input.prompt }],
  })
  const text = extractAnthropicText(msg.content)
  return {
    result: text,
    usage: {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cost_usd: calcAnthropicCost(msg.usage),
    },
  }
}

export interface EnhancePromptInput {
  prompt: string
  modelId?: string
  modelConfigs?: ModelConfigLike[]
}

export async function enhancePrompt(input: EnhancePromptInput): Promise<{ result: string; usage: UsageShape }> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')
  const { ENHANCE_SYSTEM_PROMPT } = await import('@/lib/generation/prompts')
  const userContent = `Enhance this scene description: "${input.prompt}"`

  if (isLocalModel(input.modelId, input.modelConfigs)) {
    const r = await callLocalSimple(input.modelId!, input.modelConfigs, ENHANCE_SYSTEM_PROMPT, userContent, 512)
    return { result: r.text, usage: r.usage }
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const msg = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: ENHANCE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })
  return {
    result: extractAnthropicText(msg.content),
    usage: {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cost_usd: calcAnthropicCost(msg.usage),
    },
  }
}

export interface SummarizeSceneInput {
  prompt: string
  svgContent?: string
  modelId?: string
  modelConfigs?: ModelConfigLike[]
}

export async function summarizeScene(input: SummarizeSceneInput): Promise<{ result: string }> {
  const { SUMMARY_SYSTEM_PROMPT } = await import('@/lib/generation/prompts')
  const svgSnippet = (input.svgContent ?? '').slice(0, 2000)
  const userContent = `Original prompt: "${input.prompt ?? ''}"\n\nSVG content (truncated): ${svgSnippet}`

  if (isLocalModel(input.modelId, input.modelConfigs)) {
    const r = await callLocalSimple(input.modelId!, input.modelConfigs, SUMMARY_SYSTEM_PROMPT, userContent, 200)
    return { result: r.text }
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const msg = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })
  return { result: extractAnthropicText(msg.content) }
}

export interface EditSvgInput {
  svgContent: string
  editInstruction: string
  modelId?: string
  modelConfigs?: ModelConfigLike[]
}

export async function editSvg(input: EditSvgInput): Promise<{ result: string; usage: UsageShape }> {
  if (!input.svgContent || !input.editInstruction) {
    throw new GenerationValidationError('svgContent and editInstruction required')
  }
  const { EDIT_SYSTEM_PROMPT } = await import('@/lib/generation/prompts')
  const userContent = `EXISTING SVG:\n${input.svgContent}\n\nEDIT INSTRUCTION:\n${input.editInstruction}`

  if (isLocalModel(input.modelId, input.modelConfigs)) {
    const r = await callLocalSimple(input.modelId!, input.modelConfigs, EDIT_SYSTEM_PROMPT, userContent, 8192)
    return { result: r.text, usage: r.usage }
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const msg = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: EDIT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })
  return {
    result: extractAnthropicText(msg.content),
    usage: {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cost_usd: calcAnthropicCost(msg.usage),
    },
  }
}

// ── Avatar / video status polling ──────────────────────────────────────────
// These are GET endpoints today. The renderer polls every 15s until the
// underlying async job completes; moving them to IPC keeps packaged Electron
// from hitting localhost for polling.

export interface PollHeygenStatusResult {
  status: 'completed' | 'processing' | 'failed' | string
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}

/**
 * Poll HeyGen for an in-flight avatar video. When complete, downloads
 * the video to the media cache and returns the public path. Mirrors
 * `GET /api/generate-avatar?videoId=...`.
 */
export async function pollHeygenStatus(videoId: string): Promise<PollHeygenStatusResult> {
  if (!videoId) throw new GenerationValidationError('videoId is required')
  const { getVideoStatus, downloadVideo } = await import('@/lib/apis/heygen')
  const { saveToCache } = await import('@/lib/apis/media-cache')

  const status = await getVideoStatus(videoId)
  if (status.status === 'completed' && status.videoUrl) {
    const buffer = await downloadVideo(status.videoUrl)
    const publicPath = await saveToCache('heygen', { videoId }, buffer, 'mp4')
    return { status: 'completed', videoUrl: publicPath, thumbnailUrl: status.thumbnailUrl }
  }
  return { status: status.status, error: status.error }
}

export interface PollVideoStatusInput {
  operationName: string
  projectId?: string
  prompt?: string
  providerId?: string
  reservationId?: string
}

export interface PollVideoStatusResult {
  done: boolean
  videoUrl?: string
  provider?: string
  error?: string
}

/**
 * Poll Veo3/Kling/Runway for an in-flight text-to-video job. On completion,
 * downloads the video, saves to cache, and calls `logSpend` to commit the
 * reserved cost. Mirrors `GET /api/generate-video?operationName=...`.
 */
export async function pollVideoStatus(input: PollVideoStatusInput): Promise<PollVideoStatusResult> {
  if (!input.operationName) throw new GenerationValidationError('operationName is required')
  const { firstConfiguredVideoProvider, getVideoProvider } = await import('@/lib/apis/video/registry')
  const { saveToCache } = await import('@/lib/apis/media-cache')
  const { logSpend } = await import('@/lib/db')

  // Provider resolution: explicit id → registry lookup; otherwise first configured.
  const provider =
    input.providerId && input.providerId !== 'auto'
      ? getVideoProvider(input.providerId)
      : firstConfiguredVideoProvider()
  if (!provider) {
    throw new GenerationValidationError('No video provider configured. Add GOOGLE_AI_KEY, FAL_KEY, or RUNWAY_API_KEY.')
  }

  const result = await provider.pollStatus(input.operationName)
  if (result.done && result.videoUri) {
    const buffer = await provider.download(result.videoUri)
    const publicPath = await saveToCache(provider.id, { operationName: input.operationName }, buffer, 'mp4')

    if (input.projectId) {
      // Log spend against `provider.id` directly. The HTTP route had a
      // `providerToApiName` helper that returned the APIName for the three
      // known video APIs (veo3/kling/runway) or null → caller then did
      // `api ?? provider.id`. Both branches collapse to `provider.id`, so
      // drop the helper. For unknown providers, `logSpend` just keys against
      // the raw id string, matching pre-existing behavior.
      await logSpend(
        input.projectId,
        provider.id,
        provider.costPerCallUsd,
        `${provider.name}: ${(input.prompt ?? '').slice(0, 100)}`,
        input.reservationId,
      )
    }
    return { done: true, videoUrl: publicPath, provider: provider.id }
  }

  if (result.done && result.error) {
    return { done: true, error: result.error, provider: provider.id }
  }
  return { done: false, provider: provider.id }
}

// ── Image generation ───────────────────────────────────────────────────────

export interface GenerateImageInput {
  prompt: string
  negativePrompt?: string
  model?: string
  aspectRatio?: string
  style?: string | null
  removeBackground?: boolean
  /** When set, spend is logged against this project. */
  projectId?: string
  /** Unused by the service but preserved for route parity. */
  sceneId?: string
}

export interface GenerateImageResult {
  imageUrl: string
  stickerUrl: string | null
  width: number
  height: number
  cost: number
}

export async function generateImageAsset(input: GenerateImageInput): Promise<GenerateImageResult> {
  if (!input.prompt) throw new GenerationValidationError('prompt is required')

  // Lazy-imported — provider SDKs are heavy and only needed when this runs.
  const { generateImage } = await import('@/lib/apis/image-gen')
  const { removeImageBackground, BG_REMOVAL_COST } = await import('@/lib/apis/background-removal')
  const { logSpend } = await import('@/lib/db')

  const result = await generateImage({
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    model: (input.model ?? 'flux-schnell') as Parameters<typeof generateImage>[0]['model'],
    aspectRatio: (input.aspectRatio ?? '1:1') as Parameters<typeof generateImage>[0]['aspectRatio'],
    style: (input.style ?? null) as Parameters<typeof generateImage>[0]['style'],
  })

  if (result.cost > 0 && input.projectId) {
    await logSpend(
      input.projectId,
      'imageGen',
      result.cost,
      `${input.model ?? 'flux-schnell'}: ${input.prompt.slice(0, 100)}`,
    )
  }

  let stickerUrl: string | null = null
  if (input.removeBackground) {
    const bgResult = await removeImageBackground(result.imageUrl)
    stickerUrl = bgResult.resultUrl
    if (bgResult.cost > 0 && input.projectId) {
      await logSpend(
        input.projectId,
        'backgroundRemoval',
        bgResult.cost,
        `BG removal for: ${input.prompt.slice(0, 80)}`,
      )
    }
  }

  return {
    imageUrl: result.imageUrl,
    stickerUrl,
    width: result.width,
    height: result.height,
    cost: result.cost + (stickerUrl ? BG_REMOVAL_COST : 0),
  }
}

export class GenerationValidationError extends Error {
  readonly code = 'VALIDATION' as const
  constructor(message: string) {
    super(message)
    this.name = 'GenerationValidationError'
  }
}

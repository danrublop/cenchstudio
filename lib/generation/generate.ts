/**
 * Multi-provider code generation for scene layers.
 * Supports Anthropic (default), OpenAI, and Google Gemini.
 * Selects the correct system prompt and parsing strategy per SceneType.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SceneType } from '../types'
import type { ZdogComposedSceneSpec } from '../types'
import { logSpend } from '../db'
import { getModelPricing, getModelProvider } from '../agents/types'
import type { ModelId, ModelTier } from '../agents/types'
import type { ModelConfig } from '../agents/model-config'
import {
  SVG_SYSTEM_PROMPT,
  CANVAS_SYSTEM_PROMPT,
  D3_SYSTEM_PROMPT,
  THREE_SYSTEM_PROMPT,
  MOTION_SYSTEM_PROMPT,
  LOTTIE_OVERLAY_PROMPT,
  ZDOG_SYSTEM_PROMPT,
} from './prompts'
import { composeDeterministicZdogScene } from '../zdog'

const anthropicClient = new Anthropic()

// Lazy-initialized providers
let openaiClient: any = null
let googleClient: any = null
const localClients = new Map<string, any>()

function getOpenAIClient() {
  if (!openaiClient) {
    const OpenAI = require('openai').default
    openaiClient = new OpenAI()
  }
  return openaiClient
}

function getGoogleClient() {
  if (!googleClient) {
    const { GoogleGenAI } = require('@google/genai')
    googleClient = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? '' })
  }
  return googleClient
}

function getLocalClient(endpoint: string) {
  if (!localClients.has(endpoint)) {
    const OpenAI = require('openai').default
    localClients.set(endpoint, new OpenAI({ baseURL: `${endpoint}/v1`, apiKey: 'ollama' }))
  }
  return localClients.get(endpoint)!
}

/** Max output tokens per scene type — prevents runaway output */
const MAX_TOKENS_BY_TYPE: Record<string, number> = {
  svg: 12288,
  canvas2d: 16384,
  d3: 5120,
  three: 5120,
  motion: 5120,
  lottie: 4096,
  zdog: 4096,
}

/** Default model per tier for code generation */
const TIER_GEN_MODELS: Record<ModelTier, ModelId> = {
  budget: 'claude-haiku-4-5-20251001',
  auto: 'claude-sonnet-4-6',
  premium: 'claude-opus-4-6',
}

export interface GenerateCodeOptions {
  palette?: string[]
  bgColor?: string
  duration?: number
  font?: string
  strokeWidth?: number
  previousSummary?: string
  d3Data?: unknown
  /** Model ID to use for generation — defaults based on tier */
  modelId?: string
  /** Model tier — determines default model when modelId not specified */
  modelTier?: ModelTier
  /** Deterministic no-LLM Zdog composition spec */
  zdogComposedSpec?: ZdogComposedSceneSpec
  /** Model configs for resolving local model endpoints */
  modelConfigs?: ModelConfig[]
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
  /** True if the LLM output was cut off by hitting max_tokens */
  truncated?: boolean
}

/**
 * Generate code for a scene layer.
 * Routes to Anthropic, OpenAI, or Google based on the resolved model.
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
    modelId: requestedModel,
    modelTier = 'auto',
  } = options

  if (layerType === 'zdog' && options.zdogComposedSpec) {
    const composedCode = composeDeterministicZdogScene(options.zdogComposedSpec, { duration })
    return {
      code: composedCode,
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      truncated: false,
    }
  }

  // Resolve model: explicit override → tier default → Sonnet fallback
  const model = requestedModel ?? TIER_GEN_MODELS[modelTier] ?? 'claude-sonnet-4-6'
  const maxTokens = MAX_TOKENS_BY_TYPE[layerType] ?? 6144

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
    case 'zdog':
      systemPrompt = ZDOG_SYSTEM_PROMPT(palette, bgColor, duration, previousSummary)
      break
    default:
      throw new Error(`Unknown layer type: ${layerType}`)
  }

  // ── Route to provider ──────────────────────────────────────────────────────

  const provider = getModelProvider(model as ModelId, options.modelConfigs)
  console.log(
    `[generateCode] Start: type=${layerType} model=${model} provider=${provider} prompt="${prompt.slice(0, 120)}"`,
  )

  let raw: string
  let inputTokens: number
  let outputTokens: number
  let truncated: boolean

  if (provider === 'local') {
    const localConfig = options.modelConfigs?.find((m) => m.id === model || m.modelId === model)
    const endpoint = localConfig?.endpoint ?? process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
    const localModelName = localConfig?.localModelName ?? model
    ;({ raw, inputTokens, outputTokens, truncated } = await callLocal(endpoint, localModelName, systemPrompt, userContent, maxTokens))
  } else if (provider === 'openai') {
    ;({ raw, inputTokens, outputTokens, truncated } = await callOpenAI(model, systemPrompt, userContent, maxTokens))
  } else if (provider === 'google') {
    ;({ raw, inputTokens, outputTokens, truncated } = await callGoogle(model, systemPrompt, userContent, maxTokens))
  } else {
    ;({ raw, inputTokens, outputTokens, truncated } = await callAnthropic(model, systemPrompt, userContent, maxTokens))
  }

  // ── Calculate cost ──────────────────────────────────────────────────────────

  const pricing = getModelPricing(model as ModelId)
  const costUsd = (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M

  console.log(
    `[generateCode] Complete: type=${layerType} model=${model} tokens=${inputTokens}in/${outputTokens}out cost=$${costUsd.toFixed(4)} codeLen=${raw.length}${truncated ? ' TRUNCATED' : ''}`,
  )

  if (projectId) {
    await logSpend(projectId, `generation:${layerType}`, costUsd, prompt.slice(0, 200))
  }

  const usageResult = { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd }

  // ── Parse response per layer type ─────────────────────────────────────────

  switch (layerType) {
    case 'svg':
    case 'canvas2d':
      return { code: raw, usage: usageResult, truncated }

    case 'lottie': {
      // Strip markdown fences and validate JSON
      const lottieRaw = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      try {
        JSON.parse(lottieRaw) // validate
      } catch {
        console.error(`[generateCode] Lottie JSON parse failed, raw length: ${raw.length}`)
        throw new Error(
          truncated
            ? 'Lottie JSON was truncated — try a simpler animation'
            : 'Generated Lottie output is not valid JSON',
        )
      }
      return { code: lottieRaw, usage: usageResult, truncated }
    }

    case 'zdog':
      return { code: raw, usage: usageResult, truncated }

    case 'd3': {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      let parsed: any
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        console.error(`[generateCode] D3 JSON parse failed, raw length: ${raw.length}`)
        throw new Error(
          truncated
            ? 'D3 scene code was too long and got cut off — try a simpler prompt'
            : 'Model returned invalid JSON for D3 scene — please retry',
        )
      }
      return {
        code: parsed.sceneCode ?? '',
        styles: parsed.styles,
        suggestedData: parsed.suggestedData,
        usage: usageResult,
        truncated,
      }
    }

    case 'three': {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      let parsed: any
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        console.error(`[generateCode] Three.js JSON parse failed, raw length: ${raw.length}`)
        throw new Error(
          truncated
            ? 'Three.js scene code was too long and got cut off — try a simpler prompt'
            : 'Model returned invalid JSON for Three.js scene — please retry',
        )
      }
      return { code: parsed.sceneCode ?? '', usage: usageResult, truncated }
    }

    case 'motion': {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      let parsed: any
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        console.error(`[generateCode] Motion JSON parse failed, raw length: ${raw.length}`)
        throw new Error(
          truncated
            ? 'Motion scene code was too long and got cut off — try a simpler prompt'
            : 'Model returned invalid JSON for Motion scene — please retry',
        )
      }
      return {
        code: parsed.sceneCode ?? '',
        styles: parsed.styles,
        htmlContent: parsed.htmlContent,
        usage: usageResult,
        truncated,
      }
    }

    default:
      return { code: raw, usage: usageResult, truncated }
  }
}

// ── Provider call implementations ─────────────────────────────────────────────

interface ProviderResult {
  raw: string
  inputTokens: number
  outputTokens: number
  truncated: boolean
}

async function callAnthropic(
  model: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<ProviderResult> {
  const params = {
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user' as const, content: userContent }],
  }

  let result: Anthropic.Message
  try {
    result = await anthropicClient.messages.create(params, { timeout: 60_000 })
  } catch (firstErr) {
    console.warn('[generateCode] First attempt failed, retrying in 1s:', (firstErr as Error).message)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    result = await anthropicClient.messages.create(params, { timeout: 60_000 })
  }

  const truncated = result.stop_reason === 'max_tokens'
  if (truncated) {
    console.warn(
      `[generateCode] Anthropic output truncated (hit max_tokens=${maxTokens}, used ${result.usage.output_tokens})`,
    )
  }

  const textBlock = result.content.find((b) => b.type === 'text')
  return {
    raw: textBlock?.type === 'text' ? textBlock.text : '',
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
    truncated,
  }
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<ProviderResult> {
  const client = getOpenAIClient()

  let result: any
  try {
    result = await client.chat.completions.create(
      {
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      },
      { timeout: 60_000 },
    )
  } catch (firstErr) {
    console.warn('[generateCode] OpenAI first attempt failed, retrying in 1s:', (firstErr as Error).message)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    result = await client.chat.completions.create(
      {
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      },
      { timeout: 60_000 },
    )
  }

  const finishReason = result.choices?.[0]?.finish_reason
  const truncated = finishReason === 'length'
  if (truncated) {
    console.warn(`[generateCode] OpenAI output truncated (hit max_tokens=${maxTokens})`)
  }

  return {
    raw: result.choices?.[0]?.message?.content ?? '',
    inputTokens: result.usage?.prompt_tokens ?? 0,
    outputTokens: result.usage?.completion_tokens ?? 0,
    truncated,
  }
}

async function callGoogle(
  model: string,
  systemPrompt: string,
  userContent: string,
  _maxTokens: number,
): Promise<ProviderResult> {
  const client = getGoogleClient()

  let result: any
  try {
    result = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      config: {
        systemInstruction: systemPrompt,
      },
    })
  } catch (firstErr) {
    console.warn('[generateCode] Google first attempt failed, retrying in 1s:', (firstErr as Error).message)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    result = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      config: {
        systemInstruction: systemPrompt,
      },
    })
  }

  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const usageMetadata = result?.usageMetadata ?? {}
  const finishReason = result?.candidates?.[0]?.finishReason
  const truncated = finishReason === 'MAX_TOKENS'
  if (truncated) {
    console.warn(`[generateCode] Google output truncated (hit max_tokens)`)
  }

  return {
    raw: text,
    inputTokens: usageMetadata.promptTokenCount ?? 0,
    outputTokens: usageMetadata.candidatesTokenCount ?? 0,
    truncated,
  }
}

async function callLocal(
  endpoint: string,
  localModelName: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<ProviderResult> {
  const client = getLocalClient(endpoint)

  let result: any
  try {
    result = await client.chat.completions.create(
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
  } catch (firstErr) {
    console.warn('[generateCode] Local LLM first attempt failed, retrying in 1s:', (firstErr as Error).message)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    result = await client.chat.completions.create(
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
  }

  const finishReason = result.choices?.[0]?.finish_reason
  const truncated = finishReason === 'length'
  if (truncated) {
    console.warn(`[generateCode] Local LLM output truncated (hit max_tokens=${maxTokens})`)
  }

  return {
    raw: result.choices?.[0]?.message?.content ?? '',
    inputTokens: result.usage?.prompt_tokens ?? 0,
    outputTokens: result.usage?.completion_tokens ?? 0,
    truncated,
  }
}

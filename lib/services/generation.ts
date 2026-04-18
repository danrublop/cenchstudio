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

import { generateCode, type GenerateCodeOptions } from '@/lib/generation/generate'

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

export class GenerationValidationError extends Error {
  readonly code = 'VALIDATION' as const
  constructor(message: string) {
    super(message)
    this.name = 'GenerationValidationError'
  }
}

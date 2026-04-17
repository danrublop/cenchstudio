import * as fal from '@fal-ai/serverless-client'
import type { ImageModel, ImageStyle } from '@/lib/types'
import { checkCache, saveToCache, downloadToBuffer } from './media-cache'

const FAL_KEY = () => process.env.FAL_KEY
const OPENAI_API_KEY = () => process.env.OPENAI_API_KEY

function configureFal() {
  const key = FAL_KEY()
  if (key) {
    fal.config({ credentials: key })
  }
}

const MODEL_IDS: Record<ImageModel, string | null> = {
  'flux-1.1-pro': 'fal-ai/flux-pro/v1.1',
  'flux-schnell': 'fal-ai/flux/schnell',
  'ideogram-v3': 'fal-ai/ideogram/v3',
  'recraft-v3': 'fal-ai/recraft-v3',
  'stable-diffusion-3': 'fal-ai/stable-diffusion-v3-medium',
  'dall-e-3': null, // uses OpenAI SDK
}

const STYLE_PROMPTS: Record<string, string> = {
  illustration: ', vector illustration style, clean lines',
  flat: ', flat design, simple shapes, minimal',
  sketch: ', pencil sketch, hand-drawn, whiteboard style',
  '3d': ', 3D render, octane render, soft lighting',
  watercolor: ', watercolor illustration, painted',
  photorealistic: ', photorealistic, 4K, detailed',
  pixel: ', pixel art style, retro',
}

export const MODEL_COSTS: Record<ImageModel, number> = {
  'flux-1.1-pro': 0.05,
  'flux-schnell': 0.003,
  'ideogram-v3': 0.08,
  'recraft-v3': 0.04,
  'stable-diffusion-3': 0.03,
  'dall-e-3': 0.04,
}

function aspectRatioToSize(ar: string): '1024x1024' | '1792x1024' | '1024x1792' {
  if (ar === '16:9' || ar === '4:3') return '1792x1024'
  if (ar === '9:16' || ar === '3:4') return '1024x1792'
  return '1024x1024'
}

// FAL uses "portrait_16_9" to mean "portrait orientation of the 16:9 ratio" (i.e. 9:16)
function aspectRatioToFal(ar: string): string {
  if (ar === '16:9') return 'landscape_16_9'
  if (ar === '9:16') return 'portrait_16_9'
  if (ar === '4:3') return 'landscape_4_3'
  if (ar === '3:4') return 'portrait_4_3'
  return 'square_hd'
}

export async function generateImage(opts: {
  prompt: string
  negativePrompt?: string
  model: ImageModel
  aspectRatio: string
  style?: ImageStyle | null
  skipCache?: boolean
  /**
   * Optional reference image URL for image-to-image workflows. Recorded in
   * provenance by callers. Today we only use it as a prompt hint; true image-
   * conditioning (passing `image_url` to a FAL i2i endpoint) will land with the
   * dedicated i2i router path.
   */
  referenceImageUrl?: string | null
}): Promise<{ imageUrl: string; width: number; height: number; cost: number }> {
  // Check cache — reference URL is part of the cache key so variations aren't collapsed.
  const cacheParams = {
    prompt: opts.prompt,
    model: opts.model,
    aspectRatio: opts.aspectRatio,
    style: opts.style,
    referenceImageUrl: opts.referenceImageUrl ?? null,
  }
  if (!opts.skipCache) {
    const cached = await checkCache('imageGen', cacheParams)
    if (cached) {
      return {
        imageUrl: cached.filePath,
        width: (cached.metadata.width ?? 1024) as number,
        height: (cached.metadata.height ?? 1024) as number,
        cost: 0,
      }
    }
  }

  const fullPrompt = opts.prompt + (opts.style ? (STYLE_PROMPTS[opts.style] ?? '') : '')
  const cost = MODEL_COSTS[opts.model]

  if (opts.model === 'dall-e-3') {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: fullPrompt,
        size: aspectRatioToSize(opts.aspectRatio),
        quality: 'standard',
        n: 1,
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message ?? 'DALL-E 3 generation failed')

    const imageUrl = data.data[0].url
    const size = aspectRatioToSize(opts.aspectRatio)
    const [w, h] = size.split('x').map(Number)
    const buffer = await downloadToBuffer(imageUrl)
    const publicPath = await saveToCache('imageGen', cacheParams, buffer, 'png', { width: w, height: h })
    return { imageUrl: publicPath, width: w, height: h, cost }
  }

  // fal.ai path — use SDK
  const falModelId = MODEL_IDS[opts.model]
  if (!falModelId) throw new Error(`Unknown model: ${opts.model}`)

  configureFal()

  const result = (await fal.subscribe(falModelId, {
    input: {
      prompt: fullPrompt,
      negative_prompt: opts.negativePrompt,
      image_size: aspectRatioToFal(opts.aspectRatio),
      num_inference_steps: opts.model === 'flux-schnell' ? 4 : 28,
      guidance_scale: 3.5,
    },
  })) as any

  const imageUrl = result.images?.[0]?.url
  if (!imageUrl) throw new Error('No image returned from fal.ai')

  const w = result.images[0].width ?? 1024
  const h = result.images[0].height ?? 1024
  const buffer = await downloadToBuffer(imageUrl)
  const publicPath = await saveToCache('imageGen', cacheParams, buffer, 'png', { width: w, height: h })

  return {
    imageUrl: publicPath,
    width: w,
    height: h,
    cost,
  }
}

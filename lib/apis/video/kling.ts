// Kling 2.1 text-to-video via fal.ai. Uses the same FAL_KEY already wired up
// for image generation.
//
// fal.ai endpoints return a request ID that can be polled at
// `/requests/{id}/status` and downloaded from `/requests/{id}`. The exact
// model slug is kept configurable via `KLING_FAL_MODEL` so upgrades don't
// require a code change.

import type { VideoProviderClient, VideoStatus } from './types'

const FAL_BASE = 'https://queue.fal.run'
const DEFAULT_MODEL = 'fal-ai/kling-video/v2.1/standard/text-to-video'

function getKey(): string {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('FAL_KEY not configured — add it to use Kling')
  return key
}

function getModel(): string {
  return process.env.KLING_FAL_MODEL || DEFAULT_MODEL
}

export const klingProvider: VideoProviderClient = {
  id: 'kling',
  name: 'Kling 2.1',
  envKey: 'FAL_KEY',
  costPerCallUsd: 0.45,

  async generate(opts) {
    const key = getKey()
    const model = getModel()
    const body: Record<string, unknown> = {
      prompt: opts.prompt,
      duration: String(Math.max(5, Math.min(10, opts.durationSeconds))),
      aspect_ratio: opts.aspectRatio,
    }
    if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt
    if (typeof opts.seed === 'number') body.seed = opts.seed

    const res = await fetch(`${FAL_BASE}/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.detail ?? data?.error ?? `Kling error: ${res.status}`)
    const operationId = data.request_id as string | undefined
    if (!operationId) throw new Error('Kling response missing request_id')
    return { operationId }
  },

  async pollStatus(operationId): Promise<VideoStatus> {
    const key = getKey()
    const model = getModel()
    const res = await fetch(`${FAL_BASE}/${model}/requests/${operationId}/status`, {
      headers: { Authorization: `Key ${key}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.detail ?? `Kling status error: ${res.status}`)
    if (data.status === 'COMPLETED') {
      // Pull the final result to get the video URL
      const out = await fetch(`${FAL_BASE}/${model}/requests/${operationId}`, {
        headers: { Authorization: `Key ${key}` },
      })
      const final = await out.json()
      const videoUri = final?.video?.url ?? final?.output?.video?.url
      if (!videoUri) {
        return { done: true, error: 'Kling completed without a video URL' }
      }
      return { done: true, videoUri }
    }
    if (data.status === 'FAILED') {
      return { done: true, error: data.logs?.[0]?.message ?? 'Kling generation failed' }
    }
    return { done: false }
  },

  async download(uri) {
    const res = await fetch(uri)
    if (!res.ok) throw new Error(`Kling download failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  },
}

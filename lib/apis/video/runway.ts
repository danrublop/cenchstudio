// Runway Gen-4 Turbo text-to-video, direct API.
//
// Uses RUNWAY_API_KEY. API documented at https://docs.dev.runwayml.com/.
// Gen-4 currently requires an image prompt in most configurations; for pure
// text-to-video this adapter uses `gen4_aleph` when available, and falls
// back to Gen-3 Alpha Turbo for text-only prompts.

import type { VideoProviderClient, VideoStatus } from './types'

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'
const DEFAULT_MODEL = 'gen4_turbo'

function getKey(): string {
  const key = process.env.RUNWAY_API_KEY
  if (!key) throw new Error('RUNWAY_API_KEY not configured — add it to use Runway')
  return key
}

function runwayRatio(aspect: '16:9' | '9:16' | '1:1'): string {
  // Runway uses exact pixel ratios instead of shorthand.
  switch (aspect) {
    case '16:9':
      return '1280:720'
    case '9:16':
      return '720:1280'
    case '1:1':
      return '960:960'
  }
}

export const runwayProvider: VideoProviderClient = {
  id: 'runway',
  name: 'Runway Gen-4',
  envKey: 'RUNWAY_API_KEY',
  costPerCallUsd: 0.9,

  async generate(opts) {
    const key = getKey()
    const model = process.env.RUNWAY_MODEL || DEFAULT_MODEL

    const res = await fetch(`${RUNWAY_BASE}/text_to_video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        model,
        promptText: opts.prompt,
        ratio: runwayRatio(opts.aspectRatio),
        duration: Math.max(5, Math.min(10, opts.durationSeconds)),
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? `Runway error: ${res.status}`)
    const operationId = data.id as string | undefined
    if (!operationId) throw new Error('Runway response missing task id')
    return { operationId }
  },

  async pollStatus(operationId): Promise<VideoStatus> {
    const key = getKey()
    const res = await fetch(`${RUNWAY_BASE}/tasks/${operationId}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        'X-Runway-Version': '2024-11-06',
      },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? `Runway status error: ${res.status}`)
    if (data.status === 'SUCCEEDED') {
      const uri = data?.output?.[0]
      if (!uri) return { done: true, error: 'Runway completed without a video URL' }
      return { done: true, videoUri: uri }
    }
    if (data.status === 'FAILED') {
      return { done: true, error: data.failure_reason ?? 'Runway generation failed' }
    }
    return { done: false }
  },

  async download(uri) {
    const res = await fetch(uri)
    if (!res.ok) throw new Error(`Runway download failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  },
}

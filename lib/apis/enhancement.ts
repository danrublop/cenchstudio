// ── Image enhancement (upscale + face restore) ──────────────────────────────
//
// Mirrors the background-removal pattern: calls fal.ai, caches the result,
// returns a public path + cost. Designed so the agent can chain enhancements
// in any order (rmbg → upscale → face-restore) with each step cached.

import * as fal from '@fal-ai/serverless-client'
import fs from 'fs/promises'
import path from 'path'
import { checkCache, downloadToBuffer, saveToCache } from './media-cache'

const FAL_KEY = () => process.env.FAL_KEY

function configureFal() {
  const key = FAL_KEY()
  if (key) fal.config({ credentials: key })
}

async function imageAsFalInput(imageUrl: string): Promise<Record<string, unknown>> {
  if (!imageUrl.startsWith('/')) return { image_url: imageUrl }
  // Localhost paths — inline as data URI so fal.ai doesn't have to reach our server.
  const absPath = path.join(process.cwd(), 'public', imageUrl)
  const fileBuffer = await fs.readFile(absPath)
  if (fileBuffer.length > 10 * 1024 * 1024) {
    throw new Error('Image too large for enhancement (max 10MB)')
  }
  const base64 = fileBuffer.toString('base64')
  const mime = imageUrl.endsWith('.png') ? 'image/png' : imageUrl.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  return { image_url: `data:${mime};base64,${base64}` }
}

// ── Upscale (Real-ESRGAN via fal.ai) ────────────────────────────────────────

export const UPSCALE_COST = 0.02

export type UpscaleScale = 2 | 4

export async function upscaleImage(
  imageUrl: string,
  scale: UpscaleScale = 2,
  skipCache = false,
): Promise<{ resultUrl: string; cost: number }> {
  const cacheParams = { imageUrl, op: 'upscale', scale }
  if (!skipCache) {
    const cached = await checkCache('enhancement', cacheParams)
    if (cached) return { resultUrl: cached.filePath, cost: 0 }
  }
  configureFal()
  const input = { ...(await imageAsFalInput(imageUrl)), scale }
  const result = (await fal.subscribe('fal-ai/real-esrgan', { input })) as any
  const url = result.image?.url
  if (!url) throw new Error('No result from upscale')
  const buffer = await downloadToBuffer(url)
  const publicPath = await saveToCache('enhancement', cacheParams, buffer, 'png')
  return { resultUrl: publicPath, cost: UPSCALE_COST }
}

// ── Face restoration (CodeFormer via fal.ai) ────────────────────────────────

export const FACE_RESTORE_COST = 0.03

/** `fidelity` trades identity preservation (low) vs sharpening (high).
 *  0.5 is the common default, 0.7 leans toward crisper output. */
export async function restoreFace(
  imageUrl: string,
  fidelity = 0.5,
  skipCache = false,
): Promise<{ resultUrl: string; cost: number }> {
  const cacheParams = { imageUrl, op: 'face-restore', fidelity }
  if (!skipCache) {
    const cached = await checkCache('enhancement', cacheParams)
    if (cached) return { resultUrl: cached.filePath, cost: 0 }
  }
  configureFal()
  const input = {
    ...(await imageAsFalInput(imageUrl)),
    fidelity: Math.max(0, Math.min(1, fidelity)),
  }
  const result = (await fal.subscribe('fal-ai/codeformer', { input })) as any
  const url = result.image?.url
  if (!url) throw new Error('No result from face restore')
  const buffer = await downloadToBuffer(url)
  const publicPath = await saveToCache('enhancement', cacheParams, buffer, 'png')
  return { resultUrl: publicPath, cost: FACE_RESTORE_COST }
}

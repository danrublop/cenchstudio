import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { getCachedMedia, setCachedMedia } from '@/lib/db'

const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated')

export function computeCacheHash(params: Record<string, unknown>): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort())
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export async function checkCache(api: string, params: Record<string, unknown>): Promise<string | null> {
  const hash = computeCacheHash(params)
  const cachedPath = await getCachedMedia(hash)
  if (cachedPath && fs.existsSync(path.join(process.cwd(), 'public', cachedPath))) {
    return cachedPath
  }
  return null
}

export async function saveToCache(
  api: string,
  params: Record<string, unknown>,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const hash = computeCacheHash(params)
  const subdir = api === 'heygen' ? 'avatars'
    : api === 'veo3' ? 'videos'
    : api === 'backgroundRemoval' ? 'stickers'
    : 'images'

  const dir = path.join(GENERATED_DIR, subdir)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const filename = `${hash}.${ext}`
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, buffer)

  const publicPath = `/generated/${subdir}/${filename}`
  await setCachedMedia(hash, api, publicPath, params.prompt as string ?? '', params.model as string ?? '', JSON.stringify(params))
  return publicPath
}

export async function downloadToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

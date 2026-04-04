import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { getCachedMedia, setCachedMedia } from '@/lib/db'

const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated')

export interface CacheMetadata {
  width?: number
  height?: number
  [key: string]: unknown
}

export function computeCacheHash(params: Record<string, unknown>): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort())
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export async function checkCache(
  api: string,
  params: Record<string, unknown>,
): Promise<{ filePath: string; metadata: CacheMetadata } | null> {
  const hash = computeCacheHash(params)
  const cached = await getCachedMedia(hash)
  if (!cached) return null

  const absPath = path.join(process.cwd(), 'public', cached.filePath)
  try {
    await fs.access(absPath)
  } catch {
    return null
  }

  let metadata: CacheMetadata = {}
  if (cached.config) {
    try {
      metadata = JSON.parse(cached.config)?._metadata ?? {}
    } catch {
      /* ok */
    }
  }

  return { filePath: cached.filePath, metadata }
}

export async function saveToCache(
  api: string,
  params: Record<string, unknown>,
  buffer: Buffer,
  ext: string,
  metadata?: CacheMetadata,
): Promise<string> {
  const hash = computeCacheHash(params)
  const subdir =
    api === 'heygen' ? 'avatars' : api === 'veo3' ? 'videos' : api === 'backgroundRemoval' ? 'stickers' : 'images'

  const dir = path.join(GENERATED_DIR, subdir)
  await fs.mkdir(dir, { recursive: true })

  const filename = `${hash}.${ext}`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, buffer)

  const publicPath = `/generated/${subdir}/${filename}`
  const configObj = { ...params, _metadata: metadata ?? {} }
  await setCachedMedia(
    hash,
    api,
    publicPath,
    (params.prompt as string) ?? '',
    (params.model as string) ?? '',
    JSON.stringify(configObj),
  )
  return publicPath
}

export async function downloadToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

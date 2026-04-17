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

/** SHA256 of file bytes, sliced to 16 hex chars. Used to dedupe identical files regardless of source URL. */
export function computeContentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}

/**
 * Check if a buffer's content hash already exists in media_cache.
 * Returns the existing publicPath if found (and the underlying file still exists on disk).
 * Use this to dedupe research downloads — e.g. two search queries return the same Pexels
 * MP4, we only want to store it once.
 */
export async function checkContentCache(buffer: Buffer): Promise<{ filePath: string; contentHash: string } | null> {
  const contentHash = computeContentHash(buffer)
  const cached = await getCachedMedia(contentHash)
  if (!cached) return null
  const absPath = path.join(process.cwd(), 'public', cached.filePath)
  try {
    await fs.access(absPath)
  } catch {
    return null
  }
  return { filePath: cached.filePath, contentHash }
}

/**
 * Save a download-from-web buffer into the media cache, keyed on content hash.
 * Returns existing path if the same bytes were already cached.
 *
 * subdir layout: `public/generated/research/{api}/{contentHash}.{ext}` so
 * different providers (unsplash, archive-org, yt-dlp, etc.) are separated on disk.
 */
export async function saveDownloadedMedia(opts: {
  api: string
  sourceUrl: string
  buffer: Buffer
  ext: string
  subdir?: string
  metadata?: CacheMetadata
}): Promise<{ publicPath: string; contentHash: string; alreadyCached: boolean }> {
  const { api, sourceUrl, buffer, ext, subdir, metadata } = opts
  const contentHash = computeContentHash(buffer)
  const cached = await getCachedMedia(contentHash)
  if (cached) {
    const absPath = path.join(process.cwd(), 'public', cached.filePath)
    try {
      await fs.access(absPath)
      return { publicPath: cached.filePath, contentHash, alreadyCached: true }
    } catch {
      /* fall through and re-save */
    }
  }

  const subPath = subdir ? `research/${subdir}` : `research/${api}`
  const dir = path.join(GENERATED_DIR, subPath)
  await fs.mkdir(dir, { recursive: true })
  const filename = `${contentHash}.${ext}`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, buffer)

  const publicPath = `/generated/${subPath}/${filename}`
  const configObj = { sourceUrl, _metadata: metadata ?? {} }
  await setCachedMedia(contentHash, api, publicPath, '', '', JSON.stringify(configObj))
  return { publicPath, contentHash, alreadyCached: false }
}

/**
 * Asset provenance — persist every AI-generated result as a ProjectAsset so the
 * Media Library Gallery can show it, the agent can `query_media_library` /
 * `reuse_asset` it, and `regenerate_asset` can seed a retry.
 *
 * Why server-only: writes to disk (thumbnail) and the DB. Never import from
 * client code — use the /api/projects/:id/assets/search endpoint instead.
 */

import 'server-only'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import type { AssetGenerationMetadata, AssetSource, AssetType } from '@/lib/types'

export interface PersistGeneratedAssetInput {
  projectId: string
  /** Public URL returned by the provider (may be a third-party CDN). */
  sourceUrl: string
  /** Intent-appropriate asset type. */
  type: AssetType
  /** Display name; falls back to a short prompt slug. */
  name?: string
  tags?: string[]
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  mimeType?: string
  /** Full provenance block — copied verbatim into the row. */
  metadata: AssetGenerationMetadata
  /** 'generated' by default; some flows (e.g. background-removal of an upload) pass 'upload'. */
  source?: AssetSource
}

export interface PersistedAsset {
  id: string
  projectId: string
  publicUrl: string
  thumbnailUrl: string | null
  type: AssetType
}

/**
 * Download the remote media into /public/uploads/projects/:projectId, generate
 * a thumbnail if it's an image, and insert a projectAssets row with full
 * provenance. Returns the new asset id + stable public URL.
 */
export async function persistGeneratedAsset(input: PersistGeneratedAssetInput): Promise<PersistedAsset> {
  const assetId = uuidv4()
  const ext = guessExt(input.type, input.mimeType, input.sourceUrl)
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'projects', input.projectId)
  await fs.mkdir(uploadsDir, { recursive: true })

  const storedFilename = `${assetId}.${ext}`
  const storagePath = path.join(uploadsDir, storedFilename)
  const publicUrl = `/uploads/projects/${input.projectId}/${storedFilename}`

  const buffer = await fetchAsBuffer(input.sourceUrl)
  await fs.writeFile(storagePath, buffer)

  let width = input.width ?? null
  let height = input.height ?? null
  let thumbnailUrl: string | null = null

  if (input.type === 'image') {
    try {
      if (width == null || height == null) {
        const meta = await sharp(buffer).metadata()
        width = meta.width ?? width
        height = meta.height ?? height
      }
      const thumbFilename = `${assetId}_thumb.jpg`
      const thumbPath = path.join(uploadsDir, thumbFilename)
      await sharp(buffer, { animated: false })
        .resize(300, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbPath)
      thumbnailUrl = `/uploads/projects/${input.projectId}/${thumbFilename}`
    } catch (e) {
      console.warn('[provenance] image meta/thumbnail failed:', e)
    }
  }

  const displayName = input.name?.trim() || deriveName(input.metadata.prompt) || `generated-${assetId.slice(0, 6)}`

  const [row] = await db
    .insert(projectAssets)
    .values({
      id: assetId,
      projectId: input.projectId,
      filename: storedFilename,
      storagePath,
      publicUrl,
      type: input.type,
      mimeType: input.mimeType ?? inferMime(input.type, ext),
      sizeBytes: buffer.byteLength,
      width,
      height,
      durationSeconds: input.durationSeconds ?? null,
      name: displayName,
      tags: input.tags ?? [],
      thumbnailUrl,
      extractedColors: [],
      source: input.source ?? 'generated',
      prompt: input.metadata.prompt,
      provider: input.metadata.provider,
      model: input.metadata.model,
      costCents: input.metadata.costCents,
      parentAssetId: input.metadata.parentAssetId,
      referenceAssetIds: input.metadata.referenceAssetIds,
      enhanceTags: input.metadata.enhanceTags,
    })
    .returning()

  return {
    id: row.id,
    projectId: row.projectId,
    publicUrl: row.publicUrl,
    thumbnailUrl: row.thumbnailUrl,
    type: row.type as AssetType,
  }
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  // Local public-path URLs can be read from disk directly to avoid a needless HTTP roundtrip.
  if (url.startsWith('/')) {
    const p = path.join(process.cwd(), 'public', url)
    return await fs.readFile(p)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

function guessExt(type: AssetType, mime: string | undefined, url: string): string {
  if (type === 'video') {
    if (mime?.includes('webm')) return 'webm'
    if (mime?.includes('quicktime')) return 'mov'
    return 'mp4'
  }
  if (type === 'svg') return 'svg'
  if (mime?.includes('png')) return 'png'
  if (mime?.includes('webp')) return 'webp'
  const urlExt = url.split('?')[0].split('.').pop()?.toLowerCase()
  if (urlExt && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(urlExt)) {
    return urlExt === 'jpeg' ? 'jpg' : urlExt
  }
  return 'png'
}

function inferMime(type: AssetType, ext: string): string {
  if (type === 'video') return ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4'
  if (type === 'svg') return 'image/svg+xml'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

function deriveName(prompt: string | null): string | null {
  if (!prompt) return null
  return prompt.replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** Build a blank provenance block — call sites fill what they know. */
export function emptyMetadata(): AssetGenerationMetadata {
  return {
    prompt: null,
    provider: null,
    model: null,
    costCents: null,
    parentAssetId: null,
    referenceAssetIds: null,
    enhanceTags: null,
  }
}

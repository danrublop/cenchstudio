/**
 * Direct-URL media ingest.
 *
 * Unlike /api/ingest-url which uses yt-dlp to extract video from pages (YouTube, TikTok),
 * this route expects a DIRECT media URL (https://.../foo.mp4, https://.../bar.jpg).
 * Downloads the file, content-hash-dedupes against projectAssets, inserts a row,
 * and generates a thumbnail for video.
 *
 * Used by the agent (via upload_media_from_url) when a research tool like
 * find_stock_videos or find_archival_footage returns URLs the agent wants to
 * persist into the library.
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { execFile } from 'child_process'
import { promisify } from 'util'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { computeContentHash } from '@/lib/apis/media-cache'

const execFileAsync = promisify(execFile)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024

const MIME_TO_TYPE: Record<string, { type: 'image' | 'video' | 'svg'; ext: string }> = {
  'image/jpeg': { type: 'image', ext: 'jpg' },
  'image/png': { type: 'image', ext: 'png' },
  'image/webp': { type: 'image', ext: 'webp' },
  'image/gif': { type: 'image', ext: 'gif' },
  'image/svg+xml': { type: 'svg', ext: 'svg' },
  'video/mp4': { type: 'video', ext: 'mp4' },
  'video/webm': { type: 'video', ext: 'webm' },
  'video/quicktime': { type: 'video', ext: 'mov' },
  'video/ogg': { type: 'video', ext: 'ogv' },
  'application/ogg': { type: 'video', ext: 'ogv' },
}

function extFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const ext = path.extname(u.pathname).toLowerCase().slice(1)
    return ext || null
  } catch {
    return null
  }
}

function typeFromExt(ext: string): { type: 'image' | 'video' | 'svg'; ext: string } | null {
  const e = ext.toLowerCase()
  if (['jpg', 'jpeg'].includes(e)) return { type: 'image', ext: 'jpg' }
  if (['png', 'webp', 'gif'].includes(e)) return { type: 'image', ext: e }
  if (e === 'svg') return { type: 'svg', ext: 'svg' }
  if (['mp4', 'webm', 'mov', 'ogv', 'm4v'].includes(e)) return { type: 'video', ext: e === 'm4v' ? 'mp4' : e }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      url,
      projectId,
      name: userName,
      tags: userTags,
    } = body as {
      url?: string
      projectId?: string
      name?: string
      tags?: string[]
    }

    if (!url || typeof url !== 'string') return NextResponse.json({ error: 'url is required' }, { status: 400 })
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    if (!projectId || !UUID_RE.test(projectId)) {
      return NextResponse.json({ error: 'projectId (uuid) is required' }, { status: 400 })
    }

    const access = await assertProjectAccess(projectId)
    if (access.error) return access.error

    // Fetch
    const head = await fetch(url, { method: 'HEAD' }).catch(() => null)
    const contentType = head?.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    const contentLength = head?.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File is ${Math.round(Number(contentLength) / 1024 / 1024)} MB, exceeds 200 MB cap.` },
        { status: 413 },
      )
    }

    const response = await fetch(url)
    if (!response.ok) return NextResponse.json({ error: `Download failed: ${response.status}` }, { status: 502 })

    // Enforce size cap by reading with a limit
    const reader = response.body?.getReader()
    if (!reader) return NextResponse.json({ error: 'No response body' }, { status: 502 })
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < MAX_FILE_SIZE_BYTES) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      chunks.push(value)
      total += value.length
    }
    if (total >= MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (over 200 MB)' }, { status: 413 })
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))

    // Resolve type+ext from content-type first, then URL extension
    let typeInfo = contentType ? MIME_TO_TYPE[contentType] : undefined
    if (!typeInfo) {
      const urlExt = extFromUrl(url)
      if (urlExt) typeInfo = typeFromExt(urlExt) ?? undefined
    }
    if (!typeInfo) {
      return NextResponse.json(
        { error: `Cannot determine media type from URL or content-type (${contentType ?? 'unknown'}).` },
        { status: 400 },
      )
    }

    const contentHash = computeContentHash(buffer)

    // Dedup by (projectId, contentHash) — don't re-ingest an identical file
    const existing = await db
      .select()
      .from(projectAssets)
      .where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.contentHash, contentHash)))
      .limit(1)
    if (existing.length > 0) {
      return NextResponse.json({ asset: existing[0], contentHash, deduped: true, sourceUrl: url })
    }

    const assetId = uuidv4()
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId, 'ingested')
    await fs.mkdir(uploadsDir, { recursive: true })

    // Chrome and Electron dropped Theora (.ogv) support. Any video that isn't already
    // in a widely-supported container (mp4/webm) gets transcoded to H.264 mp4 so it
    // plays in both the editor iframe AND the Puppeteer export renderer.
    let effectiveExt = typeInfo.ext
    const needsTranscode = typeInfo.type === 'video' && (typeInfo.ext === 'ogv' || typeInfo.ext === 'mov')
    const rawFilename = `${assetId}.${typeInfo.ext}`
    const rawPath = path.join(uploadsDir, rawFilename)
    await fs.writeFile(rawPath, buffer)

    let storedFilename = rawFilename
    let storagePath = rawPath
    if (needsTranscode) {
      const mp4Filename = `${assetId}.mp4`
      const mp4Path = path.join(uploadsDir, mp4Filename)
      try {
        await execFileAsync(
          'ffmpeg',
          [
            '-i',
            rawPath,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            '-y',
            mp4Path,
          ],
          { timeout: 180_000 },
        )
        await fs.unlink(rawPath).catch(() => {})
        storedFilename = mp4Filename
        storagePath = mp4Path
        effectiveExt = 'mp4'
      } catch (e) {
        console.warn('[ingest-direct] transcode failed, keeping original:', (e as Error).message)
        // fall through — the original file is still usable if the browser happens to support it
      }
    }

    const publicUrl = `/uploads/projects/${projectId}/ingested/${storedFilename}`
    let width: number | null = null
    let height: number | null = null
    let durationSeconds: number | null = null
    let thumbnailUrl: string | null = null

    if (typeInfo.type === 'image') {
      try {
        const meta = await sharp(buffer).metadata()
        width = meta.width ?? null
        height = meta.height ?? null
        const thumbFilename = `${assetId}_thumb.jpg`
        const thumbPath = path.join(uploadsDir, thumbFilename)
        await sharp(buffer, { animated: false })
          .resize(300, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPath)
        thumbnailUrl = `/uploads/projects/${projectId}/ingested/${thumbFilename}`
      } catch {
        /* non-fatal */
      }
    } else if (typeInfo.type === 'video') {
      try {
        const { stdout } = await execFileAsync(
          'ffprobe',
          ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', storagePath],
          { timeout: 15_000 },
        )
        const info = JSON.parse(stdout)
        const v = info.streams?.find((s: any) => s.codec_type === 'video')
        if (v) {
          width = v.width ?? null
          height = v.height ?? null
        }
        durationSeconds = info.format?.duration ? parseFloat(info.format.duration) : null
      } catch {
        /* non-fatal */
      }
      try {
        const thumbPath = path.join(uploadsDir, `${assetId}_thumb.jpg`)
        await execFileAsync('ffmpeg', ['-i', storagePath, '-vframes', '1', '-vf', 'scale=300:-1', '-y', thumbPath], {
          timeout: 30_000,
        })
        thumbnailUrl = `/uploads/projects/${projectId}/ingested/${assetId}_thumb.jpg`
      } catch {
        /* non-fatal */
      }
    } else if (typeInfo.type === 'svg') {
      thumbnailUrl = publicUrl
    }

    const displayName = userName || deriveNameFromUrl(url)
    // After potential transcode, the on-disk file may have a different extension than
    // what came over the wire. mimeType tracks the on-disk format so <video> tags
    // and export-time Puppeteer both see the right container.
    const storedMime =
      typeInfo.type === 'video'
        ? `video/${effectiveExt === 'ogv' ? 'ogg' : effectiveExt}`
        : typeInfo.type === 'svg'
          ? 'image/svg+xml'
          : `image/${effectiveExt === 'jpg' ? 'jpeg' : effectiveExt}`
    const [asset] = await db
      .insert(projectAssets)
      .values({
        id: assetId,
        projectId,
        filename: storedFilename,
        storagePath,
        publicUrl,
        type: typeInfo.type,
        mimeType: storedMime,
        sizeBytes: (await fs.stat(storagePath)).size,
        width,
        height,
        durationSeconds,
        name: displayName,
        tags: Array.isArray(userTags) ? userTags.slice(0, 30) : [],
        thumbnailUrl,
        extractedColors: [],
        source: 'research',
        contentHash,
        sourceUrl: url,
      })
      .returning()

    return NextResponse.json({ asset, contentHash, sourceUrl: url, deduped: false })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ingest failed' }, { status: 500 })
  }
}

function deriveNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const name = path
      .basename(u.pathname)
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
    return name || u.hostname
  } catch {
    return 'Imported media'
  }
}

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { probe, download, YtDlpNotInstalledError } from '@/lib/ingest/yt-dlp'
import { computeContentHash } from '@/lib/apis/media-cache'

const execFileAsync = promisify(execFile)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DURATION_SEC = 600 // 10 min hard cap
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB
const INGESTED_SUBDIR = 'ingested'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, formatId, projectId } = body as { url?: string; formatId?: string; projectId?: string }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
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

    // Probe-only if no formatId
    if (!formatId) {
      try {
        const info = await probe(url)
        return NextResponse.json({
          mode: 'probe',
          title: info.title,
          durationSec: info.durationSec,
          thumbnail: info.thumbnail,
          uploader: info.uploader,
          extractor: info.extractor,
          webpageUrl: info.webpageUrl,
          recommendedFormatId: info.recommendedFormatId,
          // Trim formats list to reasonable size (top 12 by score)
          formats: info.formats.slice(0, 12),
          ytDlpTooLong:
            info.durationSec > MAX_DURATION_SEC
              ? `Video is ${Math.round(info.durationSec)}s; hard cap is ${MAX_DURATION_SEC}s. Refuse or try a shorter clip.`
              : null,
        })
      } catch (e: any) {
        if (e instanceof YtDlpNotInstalledError) {
          return NextResponse.json({ error: e.message, ytDlpMissing: true }, { status: 503 })
        }
        return NextResponse.json({ error: `yt-dlp probe failed: ${e?.message ?? String(e)}` }, { status: 500 })
      }
    }

    // Download
    const assetId = uuidv4()
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId, INGESTED_SUBDIR)
    await fs.mkdir(uploadsDir, { recursive: true })
    const storagePath = path.join(uploadsDir, `${assetId}.mp4`)

    let result
    try {
      result = await download({ url, destPath: storagePath, formatId, maxDurationSec: MAX_DURATION_SEC })
    } catch (e: any) {
      if (e instanceof YtDlpNotInstalledError) {
        return NextResponse.json({ error: e.message, ytDlpMissing: true }, { status: 503 })
      }
      return NextResponse.json({ error: `yt-dlp download failed: ${e?.message ?? String(e)}` }, { status: 500 })
    }

    // Validate file size + compute content hash
    const stat = await fs.stat(storagePath)
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      await fs.unlink(storagePath).catch(() => {})
      return NextResponse.json(
        {
          error: `Downloaded file is ${Math.round(stat.size / 1024 / 1024)} MB, exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB cap.`,
        },
        { status: 413 },
      )
    }
    const fileBuffer = await fs.readFile(storagePath)
    const contentHash = computeContentHash(fileBuffer)

    // Dedupe: if this project already has an asset with the same content hash, return it
    // and discard the re-downloaded copy. Keeps the library tidy when the agent
    // accidentally fetches the same URL twice.
    const existing = await db
      .select()
      .from(projectAssets)
      .where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.contentHash, contentHash)))
      .limit(1)
    if (existing.length > 0) {
      await fs.unlink(storagePath).catch(() => {})
      return NextResponse.json({
        mode: 'download',
        asset: existing[0],
        contentHash,
        sourceUrl: result.sourceUrl,
        deduped: true,
      })
    }

    // Generate thumbnail from first frame (best-effort)
    let thumbnailUrl: string | null = null
    try {
      const thumbPath = path.join(uploadsDir, `${assetId}_thumb.jpg`)
      await execFileAsync('ffmpeg', ['-i', storagePath, '-vframes', '1', '-vf', 'scale=300:-1', '-y', thumbPath], {
        timeout: 30_000,
      })
      thumbnailUrl = `/uploads/projects/${projectId}/${INGESTED_SUBDIR}/${assetId}_thumb.jpg`
    } catch {
      /* non-fatal */
    }

    const publicUrl = `/uploads/projects/${projectId}/${INGESTED_SUBDIR}/${assetId}.mp4`
    const [asset] = await db
      .insert(projectAssets)
      .values({
        id: assetId,
        projectId,
        filename: `${result.title.slice(0, 200).replace(/[^\w -]/g, '_')}.mp4`,
        storagePath,
        publicUrl,
        type: 'video',
        mimeType: 'video/mp4',
        sizeBytes: stat.size,
        width: result.width ?? null,
        height: result.height ?? null,
        durationSeconds: result.durationSec,
        name: result.title.slice(0, 200),
        tags: [],
        thumbnailUrl,
        extractedColors: [],
        source: 'yt-dlp',
        contentHash,
        sourceUrl: result.sourceUrl,
      })
      .returning()

    return NextResponse.json({
      mode: 'download',
      asset,
      contentHash,
      sourceUrl: result.sourceUrl,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'yt-dlp ingest failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { db } from '@/lib/db'
import { projectAssets, projects } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { sanitizeSvg } from '@/lib/api/sanitize-svg'
import { extractColorsFromSvg, extractColorsFromImage } from '@/lib/brand/extract-colors'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.assets')

const execFileAsync = promisify(execFile)

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

function classifyType(mime: string): 'image' | 'video' | 'svg' {
  if (mime === 'image/svg+xml') return 'svg'
  if (mime.startsWith('video/')) return 'video'
  return 'image'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params

  // Prevent path traversal via malicious projectId
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 })
  }

  try {
    const access = await assertProjectAccess(projectId)
    if (access.error) return access.error

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userName = (formData.get('name') as string) || null
    const tagsStr = (formData.get('tags') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allAllowed = { ...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES }
    const ext = allAllowed[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, SVG, MP4, MOV, WebM` },
        { status: 400 },
      )
    }

    const isVideo = file.type in ALLOWED_VIDEO_TYPES
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Max ${isVideo ? '100MB' : '10MB'} for ${isVideo ? 'video' : 'images'}` },
        { status: 400 },
      )
    }

    const assetId = uuidv4()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    const storedFilename = `${assetId}_${safeFilename}`
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId)
    await fs.mkdir(uploadsDir, { recursive: true })

    const storagePath = path.join(uploadsDir, storedFilename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(storagePath, buffer)

    const publicUrl = `/uploads/projects/${projectId}/${storedFilename}`
    const assetType = classifyType(file.type)
    const tags = tagsStr
      ? tagsStr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []
    const displayName = userName || file.name.replace(/\.[^.]+$/, '')

    let width: number | null = null
    let height: number | null = null
    let durationSeconds: number | null = null
    let thumbnailUrl: string | null = null
    let extractedColors: string[] = []

    // Extract metadata and generate thumbnails
    if (assetType === 'image') {
      try {
        const meta = await sharp(buffer).metadata()
        width = meta.width ?? null
        height = meta.height ?? null

        // Generate thumbnail (animated: false extracts first frame for GIF/WebP)
        const thumbFilename = `${assetId}_thumb.jpg`
        const thumbPath = path.join(uploadsDir, thumbFilename)
        await sharp(buffer, { animated: false })
          .resize(300, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPath)
        thumbnailUrl = `/uploads/projects/${projectId}/${thumbFilename}`
      } catch (e) {
        log.warn('upload: sharp metadata/thumbnail failed', { error: e })
      }
      try {
        extractedColors = await extractColorsFromImage(buffer)
      } catch (e) {
        log.warn('upload: color extraction failed', { error: e })
      }
    } else if (assetType === 'svg') {
      // Sanitize SVG to strip XSS vectors (script tags, event handlers, javascript: URIs)
      const rawSvg = buffer.toString('utf-8')
      const cleanSvg = sanitizeSvg(rawSvg)
      if (cleanSvg !== rawSvg) {
        await fs.writeFile(storagePath, cleanSvg, 'utf-8')
      }
      // SVG is its own thumbnail
      thumbnailUrl = publicUrl
      // Try to extract viewBox dimensions
      const svgText = cleanSvg
      const vbMatch = svgText.match(/viewBox=["']\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*["']/)
      if (vbMatch) {
        width = Math.round(parseFloat(vbMatch[3]))
        height = Math.round(parseFloat(vbMatch[4]))
      } else {
        const wMatch = svgText.match(/width=["']([\d.]+)/)
        const hMatch = svgText.match(/height=["']([\d.]+)/)
        if (wMatch) width = Math.round(parseFloat(wMatch[1]))
        if (hMatch) height = Math.round(parseFloat(hMatch[1]))
      }
      try {
        extractedColors = extractColorsFromSvg(cleanSvg)
      } catch (e) {
        log.warn('upload: SVG color extraction failed', { error: e })
      }
    } else if (assetType === 'video') {
      // Extract duration and first frame via ffprobe/ffmpeg
      try {
        const { stdout } = await execFileAsync(
          'ffprobe',
          ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', storagePath],
          { timeout: 15_000 },
        )
        const info = JSON.parse(stdout)
        const videoStream = info.streams?.find((s: any) => s.codec_type === 'video')
        if (videoStream) {
          width = videoStream.width ?? null
          height = videoStream.height ?? null
        }
        durationSeconds = info.format?.duration ? parseFloat(info.format.duration) : null
      } catch (e) {
        log.warn('upload: ffprobe failed', { error: e })
      }

      // Generate thumbnail from first frame
      try {
        const thumbFilename = `${assetId}_thumb.jpg`
        const thumbPath = path.join(uploadsDir, thumbFilename)
        await execFileAsync('ffmpeg', ['-i', storagePath, '-vframes', '1', '-vf', 'scale=300:-1', '-y', thumbPath], {
          timeout: 30_000,
        })
        thumbnailUrl = `/uploads/projects/${projectId}/${thumbFilename}`
      } catch (e) {
        log.warn('upload: ffmpeg thumbnail failed', { error: e })
      }
    }

    const [asset] = await db
      .insert(projectAssets)
      .values({
        id: assetId,
        projectId,
        filename: file.name.slice(0, 255),
        storagePath,
        publicUrl,
        type: assetType,
        mimeType: file.type,
        sizeBytes: file.size,
        width,
        height,
        durationSeconds,
        name: displayName,
        tags,
        thumbnailUrl,
        extractedColors,
      })
      .returning()

    return NextResponse.json({ asset })
  } catch (err: unknown) {
    log.error('upload error', { error: err })
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 })
  }
  try {
    const access = await assertProjectAccess(projectId)
    if (access.error) return access.error

    const typeFilter = req.nextUrl.searchParams.get('type')
    const sourceFilter = req.nextUrl.searchParams.get('source')
    const conditions = [eq(projectAssets.projectId, projectId)]
    if (typeFilter && ['image', 'video', 'svg'].includes(typeFilter)) {
      conditions.push(eq(projectAssets.type, typeFilter))
    }
    if (sourceFilter === 'upload' || sourceFilter === 'generated') {
      conditions.push(eq(projectAssets.source, sourceFilter))
    }

    const assets = await db
      .select()
      .from(projectAssets)
      .where(and(...conditions))
      .orderBy(desc(projectAssets.createdAt))

    return NextResponse.json({ assets })
  } catch (err: unknown) {
    log.error('list error', { error: err })
    return NextResponse.json({ error: 'Failed to list assets' }, { status: 500 })
  }
}

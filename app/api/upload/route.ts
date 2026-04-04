import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const ALLOWED_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'application/json': 'json',
}

const MAX_SIZE = 100 * 1024 * 1024 // 100MB

export async function POST(req: NextRequest) {
  console.warn('[upload] Legacy /api/upload endpoint used — prefer /api/projects/[projectId]/assets')

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const filename = `${uuidv4()}.${ext}`
    const filePath = path.join(uploadsDir, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Validate Lottie JSON files
    if (ext === 'json') {
      try {
        const json = JSON.parse(buffer.toString('utf-8'))
        if (!json.v || !json.w || !json.h || !json.layers) {
          await fs.unlink(filePath).catch(() => {})
          return NextResponse.json({ error: 'File does not appear to be a valid Lottie animation' }, { status: 400 })
        }
      } catch {
        await fs.unlink(filePath).catch(() => {})
        return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 })
      }
    }

    return NextResponse.json({ url: `/uploads/${filename}`, filename })
  } catch (err: unknown) {
    console.error('Upload error:', err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

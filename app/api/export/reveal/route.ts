import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }

    // URL is like "http://localhost:3001/renders/filename.mp4" or "/renders/filename.mp4"
    const match = url.match(/\/renders\/([^/?#]+)/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid render URL' }, { status: 400 })
    }

    const filename = match[1]
    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const filePath = path.resolve(process.cwd(), 'renders', filename)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Open in system file manager, selecting the file
    const platform = process.platform

    if (platform === 'darwin') {
      execFile('open', ['-R', filePath])
    } else if (platform === 'win32') {
      execFile('explorer', ['/select,', filePath])
    } else {
      // Linux - open the containing folder
      execFile('xdg-open', [path.dirname(filePath)])
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Reveal error:', err)
    const message = err instanceof Error ? err.message : 'Failed to reveal file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

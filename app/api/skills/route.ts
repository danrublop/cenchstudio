import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SKILL_ROOTS: Record<string, string> = {
  cench: path.join(process.cwd(), '.claude/skills/cench'),
  library: path.join(process.cwd(), 'lib/skills/library'),
}

// GET /api/skills?source=cench&file=SKILL.md
// GET /api/skills?source=library&file=svg-animation.md
export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get('source')
  const file = req.nextUrl.searchParams.get('file')

  if (!source || !file) {
    return NextResponse.json({ error: 'source and file params required' }, { status: 400 })
  }

  const root = SKILL_ROOTS[source]
  if (!root) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 })
  }

  // Prevent path traversal
  const resolved = path.resolve(root, file)
  if (!resolved.startsWith(root)) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8')
    return NextResponse.json({ content, file, source })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

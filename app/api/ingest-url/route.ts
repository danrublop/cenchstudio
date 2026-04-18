import { NextRequest, NextResponse } from 'next/server'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { ingestUrl, IngestValidationError, YtDlpMissingError } from '@/lib/services/ingest'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    const access = await assertProjectAccess(body.projectId)
    if (access.error) return access.error
    const result = await ingestUrl(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof IngestValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof YtDlpMissingError) {
      return NextResponse.json({ error: err.message, ytDlpMissing: true }, { status: 503 })
    }
    console.error('[ingest-url]', err)
    return NextResponse.json({ error: (err as Error)?.message ?? 'yt-dlp ingest failed' }, { status: 500 })
  }
}

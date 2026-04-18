/**
 * Direct-URL media ingest. Thin HTTP wrapper over `lib/services/ingest.ts`.
 * See the service for yt-dlp vs direct-fetch semantics.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { ingestDirect, IngestValidationError } from '@/lib/services/ingest'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    const access = await assertProjectAccess(body.projectId)
    if (access.error) return access.error
    const result = await ingestDirect(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof IngestValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[ingest-direct]', err)
    return NextResponse.json({ error: (err as Error)?.message ?? 'Ingest failed' }, { status: 500 })
  }
}

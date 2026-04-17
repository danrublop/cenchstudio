import { NextRequest, NextResponse } from 'next/server'
import { resolvePendingCapture, rejectPendingCapture } from '@/lib/agents/pending-captures'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { captureId?: string; dataUri?: string; mimeType?: string; error?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { captureId, dataUri, mimeType, error } = body
  if (!captureId || typeof captureId !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing captureId' }, { status: 400 })
  }

  if (error) {
    const ok = rejectPendingCapture(captureId, error)
    return NextResponse.json({ ok })
  }

  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid dataUri' }, { status: 400 })
  }

  const resolved = resolvePendingCapture(captureId, dataUri, mimeType ?? 'image/jpeg')
  return NextResponse.json({ ok: resolved })
}

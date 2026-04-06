import { NextRequest, NextResponse } from 'next/server'
import { getSessionPermission, setSessionPermission, getSessionSpend, getMonthlySpend, logSpend } from '@/lib/db'
import { getOptionalUser, assertProjectAccess } from '@/lib/auth-helpers'
import { validateBody } from '@/lib/api/validate'
import { permissionsBodySchema } from '@/lib/api/schemas/permissions'

// GET: fetch current spend data for all APIs
export async function GET() {
  await getOptionalUser()
  const apis = ['heygen', 'veo3', 'imageGen', 'backgroundRemoval', 'elevenLabs', 'unsplash']
  const spendData: Record<string, { sessionSpend: number; monthlySpend: number }> = {}

  for (const api of apis) {
    spendData[api] = {
      sessionSpend: await getSessionSpend(api),
      monthlySpend: await getMonthlySpend(api),
    }
  }

  return NextResponse.json(spendData)
}

// POST: log a spend event or record a session permission
export async function POST(req: NextRequest) {
  await getOptionalUser()

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = validateBody(permissionsBodySchema, rawBody)
  if (!result.success) return result.error
  const body = result.data

  if (body.action === 'log_spend') {
    // Validate project ownership before logging spend
    if (body.projectId) {
      const access = await assertProjectAccess(body.projectId)
      if (access.error) return access.error
    }
    await logSpend(body.projectId ?? '', body.api, body.costUsd, body.description ?? '')
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'set_session_permission') {
    await setSessionPermission(body.api, body.decision)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'get_session_permission') {
    const decision = await getSessionPermission(body.api)
    return NextResponse.json({ decision })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

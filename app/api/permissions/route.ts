import { NextRequest, NextResponse } from 'next/server'
import { getSessionPermission, setSessionPermission, getSessionSpend, getMonthlySpend, logSpend } from '@/lib/db'

// GET: fetch current spend data for all APIs
export async function GET() {
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
  const body = await req.json()

  if (body.action === 'log_spend') {
    await logSpend(body.projectId, body.api, body.costUsd, body.description)
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

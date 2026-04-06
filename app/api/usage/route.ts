import { NextRequest, NextResponse } from 'next/server'
import { getAgentUsageSummary } from '@/lib/db'
import { assertProjectAccess, getOptionalUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined

  // If a projectId is specified, verify ownership
  if (projectId) {
    const access = await assertProjectAccess(projectId)
    if (access.error) return access.error
  } else {
    // Global usage — just require some form of authentication
    await getOptionalUser()
  }

  try {
    const summary = await getAgentUsageSummary(projectId)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Usage API] Failed to fetch usage summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 },
    )
  }
}

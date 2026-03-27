import { NextResponse } from 'next/server'
import { getAgentUsageSummary } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const summary = await getAgentUsageSummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Usage API] Failed to fetch usage summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 },
    )
  }
}

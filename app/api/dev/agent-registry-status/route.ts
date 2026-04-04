import { NextResponse } from 'next/server'
import { getToolRegistryStatus } from '@/lib/agents/tool-executor'

export const runtime = 'nodejs'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const status = getToolRegistryStatus()
  return NextResponse.json(status)
}

import { NextRequest, NextResponse } from 'next/server'
import { getAvailableProviders } from '@/lib/audio/router'

export async function GET() {
  const providers = getAvailableProviders()
  return NextResponse.json({ providers })
}

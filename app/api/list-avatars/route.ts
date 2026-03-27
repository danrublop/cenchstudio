import { NextResponse } from 'next/server'
import { listAvatars } from '@/lib/apis/heygen'

export async function GET() {
  try {
    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HEYGEN_API_KEY not configured' },
        { status: 503 }
      )
    }

    const avatars = await listAvatars()
    return NextResponse.json({ avatars })
  } catch (error: any) {
    console.error('List avatars error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Failed to list avatars' },
      { status: 500 }
    )
  }
}

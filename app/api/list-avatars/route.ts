import { NextResponse } from 'next/server'
import { listAvatars } from '@/lib/apis/heygen'
import { getOptionalUser } from '@/lib/auth-helpers'

// In-memory cache to avoid hammering HeyGen API on repeated calls
let avatarCache: { data: unknown; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    await getOptionalUser() // enforce session check (guest mode still allowed)
    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HEYGEN_API_KEY not configured' },
        { status: 503 }
      )
    }

    if (avatarCache && Date.now() - avatarCache.ts < CACHE_TTL) {
      return NextResponse.json({ avatars: avatarCache.data })
    }

    const avatars = await listAvatars()
    avatarCache = { data: avatars, ts: Date.now() }
    return NextResponse.json({ avatars })
  } catch (error: any) {
    console.error('List avatars error:', error)
    return NextResponse.json(
      { error: 'Failed to list avatars' },
      { status: 500 }
    )
  }
}

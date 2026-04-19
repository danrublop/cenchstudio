import { NextRequest, NextResponse } from 'next/server'
import { generateAvatarVideo } from '@/lib/apis/heygen'
import { logSpend } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.generate-avatar')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, sceneId, layerId, avatarId, voiceId, script, width, height, bgColor } = body

    if (!avatarId || !voiceId || !script) {
      return NextResponse.json({ error: 'avatarId, voiceId, and script are required' }, { status: 400 })
    }

    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HEYGEN_API_KEY not configured' }, { status: 503 })
    }

    // Start generation
    const { videoId, estimatedSeconds } = await generateAvatarVideo({
      avatarId,
      voiceId,
      script,
      width,
      height,
      bgColor,
    })

    // Log estimated cost (~$0.01 per second of video)
    const estimatedCost = estimatedSeconds * 0.01
    if (projectId) {
      await logSpend(projectId, 'heygen', estimatedCost, `Avatar ${avatarId}: ${script.slice(0, 80)}`)
    }

    // Return immediately — caller will poll for completion
    return NextResponse.json({
      videoId,
      estimatedSeconds,
      estimatedCost,
      sceneId,
      layerId,
    })
  } catch (error: any) {
    log.error('Avatar generation error:', { error: error })
    return NextResponse.json({ error: error.message ?? 'Avatar generation failed' }, { status: 500 })
  }
}

// GET: poll for avatar generation status — thin wrapper around
// `pollHeygenStatus` in `lib/services/generation.ts`.
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId')
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }
  try {
    const { pollHeygenStatus } = await import('@/lib/services/generation')
    const result = await pollHeygenStatus(videoId)
    return NextResponse.json(result)
  } catch (err) {
    log.error('Avatar status poll error:', { error: err })
    return NextResponse.json({ error: (err as Error)?.message ?? 'Failed to check avatar status' }, { status: 500 })
  }
}

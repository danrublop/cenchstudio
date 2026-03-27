import { NextRequest, NextResponse } from 'next/server'
import { generateAvatarVideo, getVideoStatus, downloadVideo } from '@/lib/apis/heygen'
import { saveToCache } from '@/lib/apis/media-cache'
import { logSpend } from '@/lib/db'

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
    console.error('Avatar generation error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Avatar generation failed' },
      { status: 500 }
    )
  }
}

// GET: poll for avatar generation status
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId')
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  try {
    const status = await getVideoStatus(videoId)

    if (status.status === 'completed' && status.videoUrl) {
      // Download and cache
      const buffer = await downloadVideo(status.videoUrl)
      const publicPath = await saveToCache(
        'heygen',
        { videoId },
        buffer,
        'mp4'
      )

      return NextResponse.json({
        status: 'completed',
        videoUrl: publicPath,
        thumbnailUrl: status.thumbnailUrl,
      })
    }

    return NextResponse.json({
      status: status.status,
      error: status.error,
    })
  } catch (error: any) {
    console.error('Avatar status poll error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Failed to check avatar status' },
      { status: 500 }
    )
  }
}

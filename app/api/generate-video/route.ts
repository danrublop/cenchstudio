import { NextRequest, NextResponse } from 'next/server'
import { generateVeo3Video, getVeo3Status, downloadVeo3Video, enhanceVeo3Prompt, VEO3_COST_ESTIMATE } from '@/lib/apis/veo3'
import { saveToCache } from '@/lib/apis/media-cache'
import { logSpend } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      projectId,
      sceneId,
      layerId,
      prompt,
      negativePrompt,
      aspectRatio = '16:9',
      duration = 5,
      enhancePrompt = true,
    } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!process.env.GOOGLE_AI_KEY) {
      return NextResponse.json({ error: 'GOOGLE_AI_KEY not configured' }, { status: 503 })
    }

    // Enhance prompt with cinematic language
    const finalPrompt = enhancePrompt
      ? await enhanceVeo3Prompt(prompt).catch(() => prompt)
      : prompt

    // Start generation
    const { operationName } = await generateVeo3Video({
      prompt: finalPrompt,
      negativePrompt,
      aspectRatio,
      durationSeconds: duration,
    })

    // Log cost
    if (projectId) {
      await logSpend(projectId, 'veo3', VEO3_COST_ESTIMATE, `Veo3: ${prompt.slice(0, 100)}`)
    }

    return NextResponse.json({
      operationName,
      enhancedPrompt: finalPrompt,
      estimatedCost: VEO3_COST_ESTIMATE,
      sceneId,
      layerId,
    })
  } catch (error: any) {
    console.error('Veo 3 generation error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Veo 3 generation failed' },
      { status: 500 }
    )
  }
}

// GET: poll for Veo 3 generation status
export async function GET(req: NextRequest) {
  const operationName = req.nextUrl.searchParams.get('operationName')
  if (!operationName) {
    return NextResponse.json({ error: 'operationName is required' }, { status: 400 })
  }

  try {
    const result = await getVeo3Status(operationName)

    if (result.done && result.videoUri) {
      // Download and cache
      const buffer = await downloadVeo3Video(result.videoUri)
      const publicPath = await saveToCache(
        'veo3',
        { operationName },
        buffer,
        'mp4'
      )

      return NextResponse.json({
        done: true,
        videoUrl: publicPath,
      })
    }

    if (result.done && result.error) {
      return NextResponse.json({
        done: true,
        error: result.error,
      })
    }

    return NextResponse.json({ done: false })
  } catch (error: any) {
    console.error('Veo 3 status poll error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Failed to check Veo 3 status' },
      { status: 500 }
    )
  }
}

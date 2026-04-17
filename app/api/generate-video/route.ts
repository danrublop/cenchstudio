import { NextRequest, NextResponse } from 'next/server'
import { saveToCache } from '@/lib/apis/media-cache'
import { logSpend } from '@/lib/db'
import { firstConfiguredVideoProvider, getVideoProvider } from '@/lib/apis/video/registry'

function requireProvider(id: string | undefined | null) {
  if (!id || id === 'auto') {
    const p = firstConfiguredVideoProvider()
    if (!p) {
      return { error: 'No video provider configured. Add GOOGLE_AI_KEY, FAL_KEY, or RUNWAY_API_KEY.', provider: null }
    }
    return { error: null, provider: p }
  }
  const p = getVideoProvider(id)
  if (!p) return { error: `Unknown video provider: ${id}`, provider: null }
  if (!process.env[p.envKey]) {
    return {
      error: `${p.name} not configured — set ${p.envKey} or pick a different provider.`,
      provider: null,
    }
  }
  return { error: null, provider: p }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      projectId,
      sceneId,
      layerId,
      provider: providerId,
      prompt,
      negativePrompt,
      aspectRatio = '16:9',
      duration = 5,
      seed,
    } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const { error, provider } = requireProvider(providerId)
    if (error || !provider) {
      return NextResponse.json({ error: error ?? 'Provider not available' }, { status: 503 })
    }

    const { operationId, enhancedPrompt } = await provider.generate({
      prompt,
      negativePrompt,
      aspectRatio,
      durationSeconds: Number(duration) || 5,
      seed,
    })

    return NextResponse.json({
      operationName: operationId,
      enhancedPrompt: enhancedPrompt ?? prompt,
      estimatedCost: provider.costPerCallUsd,
      provider: provider.id,
      projectId,
      sceneId,
      layerId,
    })
  } catch (error: any) {
    console.error('Video generation error:', error)
    return NextResponse.json({ error: error?.message ?? 'Video generation failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const operationName = req.nextUrl.searchParams.get('operationName')
  const projectId = req.nextUrl.searchParams.get('projectId')
  const prompt = req.nextUrl.searchParams.get('prompt')
  const providerId = req.nextUrl.searchParams.get('provider')
  if (!operationName) {
    return NextResponse.json({ error: 'operationName is required' }, { status: 400 })
  }

  const { error, provider } = requireProvider(providerId)
  if (error || !provider) {
    return NextResponse.json({ error: error ?? 'Provider not available' }, { status: 503 })
  }

  try {
    const result = await provider.pollStatus(operationName)

    if (result.done && result.videoUri) {
      const buffer = await provider.download(result.videoUri)
      const publicPath = await saveToCache(provider.id, { operationName }, buffer, 'mp4')

      if (projectId) {
        await logSpend(
          projectId,
          provider.id as any,
          provider.costPerCallUsd,
          `${provider.name}: ${(prompt || '').slice(0, 100)}`,
        )
      }

      return NextResponse.json({
        done: true,
        videoUrl: publicPath,
        provider: provider.id,
      })
    }

    if (result.done && result.error) {
      return NextResponse.json({ done: true, error: result.error, provider: provider.id })
    }

    return NextResponse.json({ done: false, provider: provider.id })
  } catch (error: any) {
    console.error(`${provider.name} status poll error:`, error)
    return NextResponse.json({ error: error?.message ?? 'Failed to check status' }, { status: 500 })
  }
}

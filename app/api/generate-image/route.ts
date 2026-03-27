import { NextRequest, NextResponse } from 'next/server'
import { generateImage, MODEL_COSTS } from '@/lib/apis/image-gen'
import { removeImageBackground, BG_REMOVAL_COST } from '@/lib/apis/background-removal'
import { logSpend } from '@/lib/db'
import type { ImageModel, ImageStyle } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      projectId,
      sceneId,
      prompt,
      negativePrompt,
      model = 'flux-schnell' as ImageModel,
      aspectRatio = '1:1',
      style = null as ImageStyle | null,
      removeBackground = false,
    } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Generate the image
    const result = await generateImage({
      prompt,
      negativePrompt,
      model,
      aspectRatio,
      style,
    })

    // Log spend
    if (result.cost > 0 && projectId) {
      await logSpend(projectId, 'imageGen', result.cost, `${model}: ${prompt.slice(0, 100)}`)
    }

    // Optionally remove background (for stickers)
    let stickerUrl: string | null = null
    if (removeBackground) {
      const bgResult = await removeImageBackground(result.imageUrl)
      stickerUrl = bgResult.resultUrl
      if (bgResult.cost > 0 && projectId) {
        await logSpend(projectId, 'backgroundRemoval', bgResult.cost, `BG removal for: ${prompt.slice(0, 80)}`)
      }
    }

    return NextResponse.json({
      imageUrl: result.imageUrl,
      stickerUrl,
      width: result.width,
      height: result.height,
      cost: result.cost + (stickerUrl ? BG_REMOVAL_COST : 0),
    })
  } catch (error: any) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Image generation failed' },
      { status: 500 }
    )
  }
}

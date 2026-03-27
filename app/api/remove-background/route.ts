import { NextRequest, NextResponse } from 'next/server'
import { removeImageBackground } from '@/lib/apis/background-removal'
import { logSpend } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, projectId } = body

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }

    const result = await removeImageBackground(imageUrl)

    if (result.cost > 0 && projectId) {
      await logSpend(projectId, 'backgroundRemoval', result.cost, `BG removal: ${imageUrl.slice(0, 80)}`)
    }

    return NextResponse.json({ resultUrl: result.resultUrl, cost: result.cost })
  } catch (error: any) {
    console.error('Background removal error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Background removal failed' },
      { status: 500 }
    )
  }
}

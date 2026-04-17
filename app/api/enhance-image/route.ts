import { NextRequest, NextResponse } from 'next/server'
import { logSpend } from '@/lib/db'
import { restoreFace, upscaleImage } from '@/lib/apis/enhancement'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, imageUrl, kind, scale, fidelity } = body

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }
    if (kind !== 'upscale' && kind !== 'face-restore') {
      return NextResponse.json({ error: 'kind must be "upscale" or "face-restore"' }, { status: 400 })
    }
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 503 })
    }

    if (kind === 'upscale') {
      const parsedScale = (scale === 4 ? 4 : 2) as 2 | 4
      const { resultUrl, cost } = await upscaleImage(imageUrl, parsedScale)
      if (projectId && cost > 0) {
        await logSpend(projectId, 'imageGen', cost, `Upscale x${parsedScale}: ${imageUrl.slice(0, 100)}`)
      }
      return NextResponse.json({ resultUrl, cost, kind })
    }

    const parsedFidelity = typeof fidelity === 'number' ? fidelity : 0.5
    const { resultUrl, cost } = await restoreFace(imageUrl, parsedFidelity)
    if (projectId && cost > 0) {
      await logSpend(projectId, 'imageGen', cost, `Face restore: ${imageUrl.slice(0, 100)}`)
    }
    return NextResponse.json({ resultUrl, cost, kind })
  } catch (error: any) {
    console.error('Enhance image error:', error)
    return NextResponse.json({ error: error?.message ?? 'Enhancement failed' }, { status: 500 })
  }
}

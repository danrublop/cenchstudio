import { NextRequest, NextResponse } from 'next/server'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { generateAsset, AssetValidationError, AssetNotFoundError } from '@/lib/services/assets'

// POST /api/projects/:projectId/assets/generate
// Body: { prompt, model?, aspectRatio?, enhanceTags?, referenceAssetId? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  try {
    const body = await req.json().catch(() => ({}))
    const result = await generateAsset({
      projectId,
      prompt: body.prompt,
      model: body.model,
      aspectRatio: body.aspectRatio,
      enhanceTags: body.enhanceTags,
      referenceAssetId: body.referenceAssetId,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AssetValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof AssetNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
    console.error('[assets-generate] error:', err)
    return NextResponse.json({ error: (err as Error)?.message ?? 'Generation failed' }, { status: 500 })
  }
}

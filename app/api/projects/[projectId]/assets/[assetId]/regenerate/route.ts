import { NextRequest, NextResponse } from 'next/server'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { regenerateAsset, AssetValidationError, AssetNotFoundError } from '@/lib/services/assets'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.asset-regenerate')

// POST /api/projects/:projectId/assets/:assetId/regenerate
// Body (all optional): { promptOverride, model, aspectRatio, enhanceTags }
// Produces a sibling asset with parentAssetId pointing at the original.
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // Empty body → pure "same-prompt, different seed" regeneration
  }

  try {
    const result = await regenerateAsset({
      projectId,
      assetId,
      promptOverride: body.promptOverride as string | undefined,
      model: body.model as string | undefined,
      aspectRatio: body.aspectRatio as string | undefined,
      enhanceTags: Array.isArray(body.enhanceTags) ? (body.enhanceTags as string[]) : undefined,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AssetValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof AssetNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
    log.error('error:', { error: err })
    return NextResponse.json({ error: (err as Error)?.message ?? 'Regeneration failed' }, { status: 500 })
  }
}

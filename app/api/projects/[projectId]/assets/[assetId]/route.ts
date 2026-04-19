import { NextRequest, NextResponse } from 'next/server'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { patchAsset, deleteAsset, AssetValidationError, AssetNotFoundError } from '@/lib/services/assets'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.asset-item')

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  try {
    const body = await req.json()
    const result = await patchAsset({ projectId, assetId, name: body.name, tags: body.tags })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AssetValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof AssetNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
    log.error('error:', { error: err })
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> },
) {
  const { projectId, assetId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  try {
    const result = await deleteAsset({ projectId, assetId })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AssetValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof AssetNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 })
    log.error('error:', { error: err })
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

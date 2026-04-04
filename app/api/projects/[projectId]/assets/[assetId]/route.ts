import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params

  try {
    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim()
    }
    if (Array.isArray(body.tags)) {
      updates.tags = body.tags.filter((t: unknown) => typeof t === 'string' && t.trim()).map((t: string) => t.trim())
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const [updated] = await db
      .update(projectAssets)
      .set(updates)
      .where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, projectId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    return NextResponse.json({ asset: updated })
  } catch (err: unknown) {
    console.error('[asset-patch] error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> },
) {
  const { projectId, assetId } = await params

  try {
    // Fetch asset first to get file paths
    const [asset] = await db
      .select()
      .from(projectAssets)
      .where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, projectId)))

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Delete files from disk first, so if this fails the DB record still exists
    try {
      await fs.unlink(asset.storagePath)
    } catch (e: any) {
      if (e?.code !== 'ENOENT') console.warn('[asset-delete] failed to delete file:', e)
    }

    if (asset.thumbnailUrl && asset.thumbnailUrl !== asset.publicUrl) {
      const thumbPath = path.join(process.cwd(), 'public', asset.thumbnailUrl)
      try {
        await fs.unlink(thumbPath)
      } catch (e: any) {
        if (e?.code !== 'ENOENT') console.warn('[asset-delete] failed to delete thumbnail:', e)
      }
    }

    // Delete from DB after files are removed
    await db.delete(projectAssets).where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, projectId)))

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[asset-delete] error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { avatarConfigs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { assertProjectAccess } from '@/lib/auth-helpers'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; configId: string }> },
) {
  const { projectId, configId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { provider, name, config, isDefault, thumbnailUrl } = body

  // If setting as default, clear existing defaults first
  if (isDefault) {
    await db.update(avatarConfigs).set({ isDefault: false }).where(eq(avatarConfigs.projectId, projectId))
  }

  const updates: Record<string, any> = {}
  if (provider !== undefined) updates.provider = provider
  if (name !== undefined) updates.name = name
  if (config !== undefined) updates.config = config
  if (isDefault !== undefined) updates.isDefault = isDefault
  if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl

  const [updated] = await db
    .update(avatarConfigs)
    .set(updates)
    .where(and(eq(avatarConfigs.id, configId), eq(avatarConfigs.projectId, projectId)))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; configId: string }> },
) {
  const { projectId, configId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  const [deleted] = await db
    .delete(avatarConfigs)
    .where(and(eq(avatarConfigs.id, configId), eq(avatarConfigs.projectId, projectId)))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

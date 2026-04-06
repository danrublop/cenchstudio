import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { avatarConfigs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { AvatarService } from '@/lib/avatar'
import { assertProjectAccess } from '@/lib/auth-helpers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  const configs = await db
    .select()
    .from(avatarConfigs)
    .where(eq(avatarConfigs.projectId, projectId))
    .orderBy(avatarConfigs.createdAt)

  return NextResponse.json({
    configs,
    providers: AvatarService.getAllProviders(),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { provider, name, config, isDefault } = body

  if (!provider || !name) {
    return NextResponse.json({ error: 'provider and name are required' }, { status: 400 })
  }

  // If setting as default, clear existing defaults first
  if (isDefault) {
    await db.update(avatarConfigs).set({ isDefault: false }).where(eq(avatarConfigs.projectId, projectId))
  }

  const [created] = await db
    .insert(avatarConfigs)
    .values({
      projectId,
      provider,
      name,
      config: config ?? {},
      isDefault: isDefault ?? false,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}

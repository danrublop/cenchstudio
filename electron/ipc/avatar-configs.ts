import type { IpcMain } from 'electron'
import { db } from '@/lib/db'
import { avatarConfigs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { AvatarService } from '@/lib/avatar'
import { assertValidUuid, loadProjectOrThrow, IpcValidationError, IpcNotFoundError } from './_helpers'

/**
 * Category: avatarConfigs
 *
 * Replaces:
 *   GET    /api/projects/[projectId]/avatar-configs           → list
 *   POST   /api/projects/[projectId]/avatar-configs           → create
 *   PATCH  /api/projects/[projectId]/avatar-configs/[configId] → update
 *   DELETE /api/projects/[projectId]/avatar-configs/[configId] → delete
 *
 * Called only from `components/settings/AvatarSettingsTab.tsx`. No agent
 * or MCP caller, so this is a complete surface for the avatar configs table.
 *
 * isDefault semantics: setting a config as default clears other defaults
 * on the same project first, then writes. Same non-atomic pattern the
 * HTTP routes used — acceptable since only one user edits at a time.
 */

type AvatarConfigRow = typeof avatarConfigs.$inferSelect

async function list(args: { projectId: string }): Promise<{
  configs: AvatarConfigRow[]
  providers: ReturnType<typeof AvatarService.getAllProviders>
}> {
  assertValidUuid(args.projectId, 'projectId')
  await loadProjectOrThrow(args.projectId)

  const configs = await db
    .select()
    .from(avatarConfigs)
    .where(eq(avatarConfigs.projectId, args.projectId))
    .orderBy(avatarConfigs.createdAt)

  return { configs, providers: AvatarService.getAllProviders() }
}

type CreateArgs = {
  projectId: string
  provider: string
  name: string
  config?: Record<string, unknown>
  isDefault?: boolean
}

async function create(args: CreateArgs): Promise<AvatarConfigRow> {
  assertValidUuid(args.projectId, 'projectId')
  await loadProjectOrThrow(args.projectId)

  if (!args.provider || typeof args.provider !== 'string') {
    throw new IpcValidationError('provider is required')
  }
  if (!args.name || typeof args.name !== 'string') {
    throw new IpcValidationError('name is required')
  }

  if (args.isDefault) {
    await db.update(avatarConfigs).set({ isDefault: false }).where(eq(avatarConfigs.projectId, args.projectId))
  }

  const [created] = await db
    .insert(avatarConfigs)
    .values({
      projectId: args.projectId,
      provider: args.provider,
      name: args.name,
      config: args.config ?? {},
      isDefault: args.isDefault ?? false,
    })
    .returning()

  return created
}

type UpdateArgs = {
  projectId: string
  configId: string
  provider?: string
  name?: string
  config?: Record<string, unknown>
  isDefault?: boolean
  thumbnailUrl?: string
}

async function update(args: UpdateArgs): Promise<AvatarConfigRow> {
  assertValidUuid(args.projectId, 'projectId')
  assertValidUuid(args.configId, 'configId')
  await loadProjectOrThrow(args.projectId)

  if (args.isDefault) {
    await db.update(avatarConfigs).set({ isDefault: false }).where(eq(avatarConfigs.projectId, args.projectId))
  }

  const updates: Partial<typeof avatarConfigs.$inferInsert> = {}
  if (args.provider !== undefined) updates.provider = args.provider
  if (args.name !== undefined) updates.name = args.name
  if (args.config !== undefined) updates.config = args.config
  if (args.isDefault !== undefined) updates.isDefault = args.isDefault
  if (args.thumbnailUrl !== undefined) updates.thumbnailUrl = args.thumbnailUrl

  const [updated] = await db
    .update(avatarConfigs)
    .set(updates)
    .where(and(eq(avatarConfigs.id, args.configId), eq(avatarConfigs.projectId, args.projectId)))
    .returning()

  if (!updated) throw new IpcNotFoundError(`Config ${args.configId} not found`)
  return updated
}

type DeleteArgs = { projectId: string; configId: string }

async function remove(args: DeleteArgs): Promise<{ success: true }> {
  assertValidUuid(args.projectId, 'projectId')
  assertValidUuid(args.configId, 'configId')
  await loadProjectOrThrow(args.projectId)

  const [deleted] = await db
    .delete(avatarConfigs)
    .where(and(eq(avatarConfigs.id, args.configId), eq(avatarConfigs.projectId, args.projectId)))
    .returning()

  if (!deleted) throw new IpcNotFoundError(`Config ${args.configId} not found`)
  return { success: true }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:avatarConfigs.list', (_e, args: { projectId: string }) => list(args))
  ipcMain.handle('cench:avatarConfigs.create', (_e, args: CreateArgs) => create(args))
  ipcMain.handle('cench:avatarConfigs.update', (_e, args: UpdateArgs) => update(args))
  ipcMain.handle('cench:avatarConfigs.delete', (_e, args: DeleteArgs) => remove(args))
}

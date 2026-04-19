import type { IpcMain } from 'electron'
import {
  getUserWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  assignProjectsToWorkspace,
  removeProjectsFromWorkspace,
} from '@/lib/db/queries/workspaces'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { assertValidUuid, loadWorkspaceOrThrow, IpcValidationError } from './_helpers'

/**
 * Category: workspaces
 *
 * Replaces:
 *   GET    /api/workspaces
 *   POST   /api/workspaces
 *   GET    /api/workspaces/[workspaceId]
 *   PATCH  /api/workspaces/[workspaceId]
 *   DELETE /api/workspaces/[workspaceId]
 *   POST   /api/workspaces/[workspaceId]/projects   (assign)
 *   DELETE /api/workspaces/[workspaceId]/projects   (unassign)
 *
 * Auth-less for now (single-user desktop). When Week 5+ OAuth lands,
 * thread the real `user.id` through `getUserWorkspaces` / `createWorkspace`
 * so workspaces re-partition per account.
 */

const MAX_NAME = 255
const MAX_PROJECTS_PER_ASSIGN = 100

async function list() {
  return getUserWorkspaces(null)
}

async function get(workspaceId: string) {
  assertValidUuid(workspaceId, 'workspaceId')
  const row = await getWorkspace(workspaceId)
  if (!row) throw new IpcValidationError(`Workspace ${workspaceId} not found`)
  return row
}

type CreateArgs = {
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  isDefault?: boolean
}

async function create(args: CreateArgs) {
  if (!args.name || typeof args.name !== 'string' || args.name.trim().length === 0) {
    throw new IpcValidationError('name is required')
  }
  return createWorkspace({
    userId: null,
    name: args.name.trim().slice(0, MAX_NAME),
    description: args.description ?? null,
    color: args.color ?? null,
    icon: args.icon ?? null,
    isDefault: args.isDefault ?? false,
  })
}

type UpdateArgs = {
  workspaceId: string
  updates: {
    name?: string
    description?: string | null
    color?: string | null
    icon?: string | null
    brandKit?: unknown
    globalStyle?: unknown
    settings?: unknown
    isDefault?: boolean
  }
}

async function update({ workspaceId, updates }: UpdateArgs) {
  await loadWorkspaceOrThrow(workspaceId)
  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = String(updates.name).trim().slice(0, MAX_NAME)
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.color !== undefined) patch.color = updates.color
  if (updates.icon !== undefined) patch.icon = updates.icon
  if (updates.brandKit !== undefined) patch.brandKit = updates.brandKit
  if (updates.globalStyle !== undefined) patch.globalStyle = updates.globalStyle
  if (updates.settings !== undefined) patch.settings = updates.settings
  if (updates.isDefault !== undefined) patch.isDefault = updates.isDefault
  return updateWorkspace(workspaceId, patch)
}

async function remove(workspaceId: string) {
  await loadWorkspaceOrThrow(workspaceId)
  await deleteWorkspace(workspaceId)
  return { success: true as const }
}

// Shared validation for project-bulk operations. Verifies every id is a
// well-formed UUID, caps the batch size, AND confirms all ids resolve
// to real rows in `projects`. Without the existence check, a compromised
// renderer (scene iframe with XSS reaching `window.cenchApi`) could
// create phantom workspace→project links for projects it doesn't own
// (or that don't exist), polluting the UI's workspace sidebar counts.
async function validateProjectIds(projectIds: unknown, label = 'projectIds'): Promise<string[]> {
  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    throw new IpcValidationError(`${label} must be a non-empty array`)
  }
  if (projectIds.length > MAX_PROJECTS_PER_ASSIGN) {
    throw new IpcValidationError(`Maximum ${MAX_PROJECTS_PER_ASSIGN} projects per request`)
  }
  const ids = projectIds.map((id) => assertValidUuid(id, 'projectId'))
  const found = await db.select({ id: projects.id }).from(projects).where(inArray(projects.id, ids))
  if (found.length !== ids.length) {
    const foundSet = new Set(found.map((r) => r.id))
    const missing = ids.filter((id) => !foundSet.has(id))
    throw new IpcValidationError(`Unknown projectIds: ${missing.slice(0, 3).join(', ')}`)
  }
  return ids
}

async function assignProjects(args: { workspaceId: string; projectIds: string[] }) {
  await loadWorkspaceOrThrow(args.workspaceId)
  const ids = await validateProjectIds(args.projectIds)
  await assignProjectsToWorkspace(args.workspaceId, ids)
  return { success: true as const }
}

async function unassignProjects(args: { projectIds: string[] }) {
  const ids = await validateProjectIds(args.projectIds)
  await removeProjectsFromWorkspace(ids)
  return { success: true as const }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:workspaces.list', () => list())
  ipcMain.handle('cench:workspaces.get', (_e, workspaceId: string) => get(workspaceId))
  ipcMain.handle('cench:workspaces.create', (_e, args: CreateArgs) => create(args))
  ipcMain.handle('cench:workspaces.update', (_e, args: UpdateArgs) => update(args))
  ipcMain.handle('cench:workspaces.delete', (_e, workspaceId: string) => remove(workspaceId))
  ipcMain.handle('cench:workspaces.assignProjects', (_e, args: { workspaceId: string; projectIds: string[] }) =>
    assignProjects(args),
  )
  ipcMain.handle('cench:workspaces.unassignProjects', (_e, args: { projectIds: string[] }) => unassignProjects(args))
}

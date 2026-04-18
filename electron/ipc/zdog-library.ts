import type { IpcMain } from 'electron'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { ZdogPersonAsset, ZdogPersonFormula } from '@/lib/types'
import type { ZdogStudioAsset, ZdogStudioShape } from '@/lib/types/zdog-studio'
import { assertValidUuid, loadProjectOrThrow, IpcValidationError, IpcNotFoundError, IpcConflictError } from './_helpers'

/**
 * Category: zdogLibrary
 *
 * Replaces `/api/projects/[projectId]/zdog-library` (GET/POST/DELETE).
 * The library lives inside the project's JSONB `description` blob under
 * `zdogLibrary` (legacy person formulas) and `zdogStudioLibrary` (studio
 * shape trees). Same optimistic-locking pattern the HTTP route used
 * (`version` column).
 *
 * Callers: `components/zdog-studio/ZdogOutliner.tsx` only uses the
 * studio variant. The person path stays for parity with the HTTP route
 * so we don't silently lose that surface.
 */

type ProjectBlob = {
  scenes?: unknown[]
  sceneGraph?: unknown
  zdogLibrary?: ZdogPersonAsset[]
  zdogStudioLibrary?: ZdogStudioAsset[]
  [key: string]: unknown
}

function parseBlob(description: string | null): ProjectBlob {
  if (!description) return {}
  try {
    return JSON.parse(description) as ProjectBlob
  } catch {
    return {}
  }
}

async function list(args: { projectId: string }): Promise<{
  assets: Array<ZdogStudioAsset | (ZdogPersonAsset & { assetType: 'person' })>
}> {
  assertValidUuid(args.projectId, 'projectId')
  await loadProjectOrThrow(args.projectId)

  const [project] = await db
    .select({ description: projects.description })
    .from(projects)
    .where(eq(projects.id, args.projectId))
    .limit(1)
  if (!project) throw new IpcNotFoundError('Project not found')

  const blob = parseBlob(project.description)
  return {
    assets: [
      ...(blob.zdogStudioLibrary ?? []),
      ...(blob.zdogLibrary ?? []).map((a) => ({ ...a, assetType: 'person' as const })),
    ],
  }
}

type SaveArgs = {
  projectId: string
  name: string
  assetType?: 'studio' | 'person'
  tags?: string[]
  // studio
  shapes?: ZdogStudioShape[]
  // person
  formula?: ZdogPersonFormula
}

async function save(args: SaveArgs): Promise<{
  success: true
  asset: ZdogStudioAsset | ZdogPersonAsset
}> {
  assertValidUuid(args.projectId, 'projectId')
  await loadProjectOrThrow(args.projectId)
  if (!args.name || typeof args.name !== 'string') throw new IpcValidationError('name is required')
  const tags = args.tags ?? []

  const [existing] = await db
    .select({ description: projects.description, version: projects.version })
    .from(projects)
    .where(eq(projects.id, args.projectId))
    .limit(1)
  if (!existing) throw new IpcNotFoundError('Project not found')

  const currentVersion = existing.version ?? 1
  const blob = parseBlob(existing.description)
  const now = new Date().toISOString()

  let updatedBlob: ProjectBlob
  let asset: ZdogStudioAsset | ZdogPersonAsset

  if (args.assetType === 'studio') {
    if (!args.shapes?.length) throw new IpcValidationError('shapes are required for studio assets')
    asset = {
      id: uuidv4(),
      name: args.name.slice(0, 120),
      shapes: args.shapes,
      tags,
      createdAt: now,
      updatedAt: now,
    }
    updatedBlob = { ...blob, zdogStudioLibrary: [...(blob.zdogStudioLibrary ?? []), asset] }
  } else {
    if (!args.formula) throw new IpcValidationError('formula is required for person assets')
    asset = {
      id: uuidv4(),
      name: args.name.slice(0, 120),
      formula: args.formula,
      tags,
      createdAt: now,
      updatedAt: now,
    }
    updatedBlob = { ...blob, zdogLibrary: [...(blob.zdogLibrary ?? []), asset] }
  }

  const [updated] = await db
    .update(projects)
    .set({
      description: JSON.stringify(updatedBlob),
      version: currentVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, args.projectId), eq(projects.version, currentVersion)))
    .returning({ id: projects.id })
  if (!updated) throw new IpcConflictError('Project was modified concurrently. Please retry.')

  return { success: true, asset }
}

async function remove(args: { projectId: string; id: string }): Promise<{ success: true }> {
  assertValidUuid(args.projectId, 'projectId')
  if (!args.id || typeof args.id !== 'string') throw new IpcValidationError('id is required')
  await loadProjectOrThrow(args.projectId)

  const [existing] = await db
    .select({ description: projects.description, version: projects.version })
    .from(projects)
    .where(eq(projects.id, args.projectId))
    .limit(1)
  if (!existing) throw new IpcNotFoundError('Project not found')

  const currentVersion = existing.version ?? 1
  const blob = parseBlob(existing.description)

  const prevStudio = blob.zdogStudioLibrary ?? []
  const newStudio = prevStudio.filter((a) => a.id !== args.id)
  const prevPerson = blob.zdogLibrary ?? []
  const newPerson = prevPerson.filter((a) => a.id !== args.id)

  if (newStudio.length === prevStudio.length && newPerson.length === prevPerson.length) {
    throw new IpcNotFoundError('Asset not found')
  }

  const [updated] = await db
    .update(projects)
    .set({
      description: JSON.stringify({ ...blob, zdogLibrary: newPerson, zdogStudioLibrary: newStudio }),
      version: currentVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, args.projectId), eq(projects.version, currentVersion)))
    .returning({ id: projects.id })
  if (!updated) throw new IpcConflictError('Project was modified concurrently. Please retry.')

  return { success: true }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:zdogLibrary.list', (_e, args: { projectId: string }) => list(args))
  ipcMain.handle('cench:zdogLibrary.save', (_e, args: SaveArgs) => save(args))
  ipcMain.handle('cench:zdogLibrary.delete', (_e, args: { projectId: string; id: string }) => remove(args))
}

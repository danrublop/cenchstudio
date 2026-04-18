import type { IpcMain } from 'electron'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { db } from '@/lib/db'
import { projects, projectAssets } from '@/lib/db/schema'
import { desc, eq, isNull, lt, and, or, inArray, SQL } from 'drizzle-orm'
import type { BrandKit } from '@/lib/types/media'
import { normalizeScenesForPersistence } from '@/lib/charts/normalize-scenes'
import { readProjectSceneBlob, writeProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { readProjectScenesFromTables, writeProjectScenesToTables } from '@/lib/db/project-scene-table'
import { assertValidUuid, loadProjectOrThrow, IpcValidationError, IpcNotFoundError, IpcConflictError } from './_helpers'
import {
  patchAsset as svcPatchAsset,
  deleteAsset as svcDeleteAsset,
  regenerateAsset as svcRegenerateAsset,
  AssetValidationError,
  AssetNotFoundError,
} from '@/lib/services/assets'

/**
 * Category: projects
 *
 * Replaces:
 *   GET    /api/projects[?workspaceId=X&limit=N&cursor=...]
 *   POST   /api/projects
 *   GET    /api/projects/[projectId]
 *   PATCH  /api/projects/[projectId]
 *   DELETE /api/projects/[projectId]
 *   GET    /api/projects/[projectId]/assets
 *   GET    /api/projects/[projectId]/brand-kit
 *   PUT    /api/projects/[projectId]/brand-kit
 *
 * Asset upload (POST /api/projects/[projectId]/assets) is deferred until
 * the file-transfer IPC pattern is established — File/FormData don't
 * serialize through Electron IPC, so the renderer will need to hand us
 * `ArrayBuffer + filename + mime` instead of a `File` object. See Week 3
 * backlog. Avatar / generate / regenerate / claim / zdog-library routes
 * similarly deferred — no live renderer callers yet.
 */

const MAX_PROJECTS_PER_PAGE = 100
const MAX_SCENES = 200
const MAX_LOGO_ASSET_IDS = 32
const MAX_GLOBAL_STYLE_SIZE = 16 * 1024
const MAX_SETTINGS_SIZE = 16 * 1024
const SCRYPT_HASH_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/i

const DEFAULT_BRAND_KIT: BrandKit = {
  brandName: null,
  logoAssetIds: [],
  palette: [],
  fontPrimary: null,
  fontSecondary: null,
  guidelines: null,
}

type ListArgs = { limit?: number; cursor?: string; workspaceId?: string | 'none' }

async function list(args: ListArgs = {}) {
  const paginated = args.limit !== undefined || args.cursor !== undefined
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_PROJECTS_PER_PAGE)

  // Electron single-user mode: no userId filter yet (auth deferred to
  // Week 5+). List everything; Next.js' guest/owned split collapses.
  const conditions: (SQL | undefined)[] = []
  if (args.workspaceId === 'none') {
    conditions.push(isNull(projects.workspaceId))
  } else if (args.workspaceId) {
    assertValidUuid(args.workspaceId, 'workspaceId')
    conditions.push(eq(projects.workspaceId, args.workspaceId))
  }
  if (args.cursor) {
    const cursorDate = new Date(args.cursor)
    if (!isNaN(cursorDate.getTime())) {
      conditions.push(lt(projects.updatedAt, cursorDate))
    }
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      outputMode: projects.outputMode,
      thumbnailUrl: projects.thumbnailUrl,
      workspaceId: projects.workspaceId,
      updatedAt: projects.updatedAt,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(projects.updatedAt))
    .limit(paginated ? limit + 1 : limit)

  if (!paginated) return rows

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? (items[items.length - 1].updatedAt?.toISOString() ?? null) : null
  return { items, nextCursor }
}

type CreateArgs = {
  id?: string
  name?: string
  outputMode?: 'mp4' | 'interactive'
  globalStyle?: unknown
  mp4Settings?: unknown
  interactiveSettings?: unknown
  scenes?: unknown[]
  sceneGraph?: { nodes?: unknown[]; edges?: unknown[]; startSceneId?: string | null }
  apiPermissions?: unknown
  audioSettings?: unknown
  audioProviderEnabled?: unknown
  mediaGenEnabled?: unknown
  timeline?: unknown
  workspaceId?: string | null
}

async function create(args: CreateArgs) {
  if (args.id) assertValidUuid(args.id, 'id')
  if (args.workspaceId) assertValidUuid(args.workspaceId, 'workspaceId')
  if (args.outputMode && !['mp4', 'interactive'].includes(args.outputMode)) {
    throw new IpcValidationError(`Invalid outputMode: ${args.outputMode}`)
  }
  if (args.scenes && !Array.isArray(args.scenes)) {
    throw new IpcValidationError('scenes must be an array')
  }
  if (args.scenes && args.scenes.length > MAX_SCENES) {
    throw new IpcValidationError(`scenes array exceeds ${MAX_SCENES} item limit`)
  }
  if (Array.isArray(args.sceneGraph?.nodes) && args.sceneGraph.nodes.length > MAX_SCENES) {
    throw new IpcValidationError(`sceneGraph.nodes exceeds ${MAX_SCENES} item limit`)
  }
  // Mirror the size caps applied in `update`. Without these, a renderer
  // can ship 1 GB of junk here and OOM the main process before Postgres
  // ever sees the payload.
  if (args.globalStyle !== undefined && JSON.stringify(args.globalStyle).length > MAX_GLOBAL_STYLE_SIZE) {
    throw new IpcValidationError('globalStyle exceeds size limit')
  }
  if (args.mp4Settings !== undefined && JSON.stringify(args.mp4Settings).length > MAX_SETTINGS_SIZE) {
    throw new IpcValidationError('mp4Settings exceeds size limit')
  }
  if (args.interactiveSettings !== undefined && JSON.stringify(args.interactiveSettings).length > MAX_SETTINGS_SIZE) {
    throw new IpcValidationError('interactiveSettings exceeds size limit')
  }

  const [project] = await db
    .insert(projects)
    .values({
      ...(args.id ? { id: args.id } : {}),
      userId: null,
      workspaceId: args.workspaceId || null,
      name: (args.name || 'Untitled Project').slice(0, 255),
      outputMode: args.outputMode || 'mp4',
      globalStyle: (args.globalStyle as never) || {
        presetId: null,
        paletteOverride: null,
        bgColorOverride: null,
        fontOverride: null,
        bodyFontOverride: null,
        strokeColorOverride: null,
      },
      mp4Settings: (args.mp4Settings as never) || undefined,
      interactiveSettings: (args.interactiveSettings as never) || undefined,
      apiPermissions: (args.apiPermissions as never) || {},
      audioSettings: (args.audioSettings as never) || undefined,
      audioProviderEnabled: (args.audioProviderEnabled as never) || {},
      mediaGenEnabled: (args.mediaGenEnabled as never) || {},
      description: JSON.stringify({
        scenes: args.scenes || [],
        sceneGraph: args.sceneGraph || null,
        timeline: args.timeline || null,
      }),
    })
    .returning()
  return project
}

async function get(projectId: string) {
  const project = await loadProjectOrThrow(projectId)
  const tableBacked = await readProjectScenesFromTables(projectId)
  const blobBacked = readProjectSceneBlob(project.description)
  if (!tableBacked && blobBacked.scenes.length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await writeProjectScenesToTables(projectId, blobBacked.scenes as any, blobBacked.sceneGraph as any)
    } catch (e) {
      console.error('[projects.get] lazy table backfill failed:', e)
    }
  }
  return {
    ...project,
    scenes: tableBacked?.scenes ?? blobBacked.scenes,
    sceneGraph: tableBacked?.sceneGraph ?? blobBacked.sceneGraph,
    zdogLibrary: blobBacked.zdogLibrary,
    timeline: blobBacked.timeline,
  }
}

type UpdateArgs = { projectId: string; updates: Record<string, unknown> }

async function update({ projectId, updates }: UpdateArgs) {
  assertValidUuid(projectId, 'projectId')

  // Cap scenes/sceneGraph BEFORE any normalization runs — otherwise a
  // malicious caller can OOM the main process with a 10k-entry array
  // just by virtue of `normalizeScenesForPersistence` iterating it.
  if (updates.scenes !== undefined) {
    if (!Array.isArray(updates.scenes)) {
      throw new IpcValidationError('scenes must be an array')
    }
    if (updates.scenes.length > MAX_SCENES) {
      throw new IpcValidationError(`scenes array exceeds ${MAX_SCENES} item limit`)
    }
  }
  if (
    updates.sceneGraph !== undefined &&
    Array.isArray((updates.sceneGraph as { nodes?: unknown[] })?.nodes) &&
    ((updates.sceneGraph as { nodes: unknown[] }).nodes.length ?? 0) > MAX_SCENES
  ) {
    throw new IpcValidationError(`sceneGraph.nodes exceeds ${MAX_SCENES} item limit`)
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (updates.workspaceId !== undefined) updateData.workspaceId = updates.workspaceId || null
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.outputMode !== undefined) {
    if (!['mp4', 'interactive'].includes(String(updates.outputMode))) {
      throw new IpcValidationError(`Invalid outputMode: ${updates.outputMode}`)
    }
    updateData.outputMode = updates.outputMode
  }
  if (updates.globalStyle !== undefined) {
    if (JSON.stringify(updates.globalStyle).length > MAX_GLOBAL_STYLE_SIZE) {
      throw new IpcValidationError('globalStyle exceeds size limit')
    }
    updateData.globalStyle = updates.globalStyle
  }
  if (updates.mp4Settings !== undefined) {
    if (JSON.stringify(updates.mp4Settings).length > MAX_SETTINGS_SIZE) {
      throw new IpcValidationError('mp4Settings exceeds size limit')
    }
    updateData.mp4Settings = updates.mp4Settings
  }
  if (updates.interactiveSettings !== undefined) {
    const settings = updates.interactiveSettings as { password?: string }
    if (settings?.password && !SCRYPT_HASH_RE.test(settings.password)) {
      const { hashPassword } = await import('@/lib/crypto')
      settings.password = hashPassword(settings.password)
    }
    updateData.interactiveSettings = settings
  }
  for (const key of [
    'apiPermissions',
    'audioSettings',
    'audioProviderEnabled',
    'mediaGenEnabled',
    'thumbnailUrl',
    'watermark',
    'brandKit',
    'storyboardProposed',
    'storyboardEdited',
    'storyboardApplied',
    'pausedAgentRun',
    'runCheckpoint',
  ] as const) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  // Optimistic locking
  const [existing] = await db
    .select({ description: projects.description, version: projects.version })
    .from(projects)
    .where(eq(projects.id, projectId))
  if (!existing) throw new IpcNotFoundError(`Project ${projectId} not found`)

  const currentVersion = existing.version ?? 1

  // Normalize scenes ONCE and reuse for both the blob write and the
  // downstream table sync. The previous implementation walked the array
  // twice, doubling CPU cost on 200-scene saves.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let normalizedScenes: any[] | null = null
  if (updates.scenes !== undefined || updates.sceneGraph !== undefined || updates.timeline !== undefined) {
    normalizedScenes =
      updates.scenes !== undefined
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (normalizeScenesForPersistence(updates.scenes as any) as any[])
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (readProjectSceneBlob(existing.description).scenes as any[])
    updateData.description = writeProjectSceneBlob(existing.description, {
      scenes: normalizedScenes as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sceneGraph: updates.sceneGraph !== undefined ? (updates.sceneGraph as any) : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      timeline: updates.timeline !== undefined ? (updates.timeline as any) : undefined,
    })
  }

  updateData.version = currentVersion + 1

  const [project] = await db
    .update(projects)
    .set(updateData)
    .where(and(eq(projects.id, projectId), eq(projects.version, currentVersion)))
    .returning()

  if (!project) {
    // Dedicated error class so the caller's retry loop can `instanceof`
    // check instead of string-matching "conflict" in arbitrary messages
    // (which would catch unrelated SQL errors containing "ON CONFLICT").
    throw new IpcConflictError('Project was modified concurrently. Please retry.')
  }

  if ((updates.scenes !== undefined || updates.sceneGraph !== undefined) && normalizedScenes) {
    try {
      const graphToWrite =
        updates.sceneGraph !== undefined ? updates.sceneGraph : readProjectSceneBlob(existing.description).sceneGraph
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await writeProjectScenesToTables(projectId, normalizedScenes as any, graphToWrite as any)
    } catch (e) {
      console.error('[projects.update] table sync failed — blob is source of truth:', e)
    }
  }

  return project
}

// In dev, scenes live under `<repo>/public/scenes/*.html` (served by Next.js).
// In packaged Electron, they live under `<userData>/scenes/` (the writable
// mount used by the `cench://scenes/*` protocol handler). Branch here so
// cleanup removes the right files regardless of mode.
function resolveScenesDir(): string {
  return app.isPackaged ? path.join(app.getPath('userData'), 'scenes') : path.join(process.cwd(), 'public', 'scenes')
}

function resolvePublishedDir(projectId: string): string {
  const base = app.isPackaged
    ? path.join(app.getPath('userData'), 'published')
    : path.join(process.cwd(), 'public', 'published')
  return path.join(base, projectId)
}

async function remove(projectId: string) {
  const project = await loadProjectOrThrow(projectId)
  await db.delete(projects).where(eq(projects.id, projectId))

  // Best-effort file cleanup, in the background.
  const cleanup = async () => {
    const scenesDir = resolveScenesDir()
    const publishedDir = resolvePublishedDir(projectId)
    if (project.description) {
      try {
        const parsed = readProjectSceneBlob(project.description)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sceneIds: string[] = (parsed.scenes || []).map((s: any) => s.id)
        await Promise.allSettled(sceneIds.map((sid) => fs.unlink(path.join(scenesDir, `${sid}.html`)).catch(() => {})))
      } catch {}
    }
    await fs.rm(publishedDir, { recursive: true, force: true }).catch(() => {})
  }
  cleanup().catch((err) => console.error(`[projects.remove] Cleanup failed for ${projectId}:`, err))

  return { ok: true as const }
}

async function listAssets(args: {
  projectId: string
  type?: 'image' | 'video' | 'svg'
  source?: 'upload' | 'generated'
}) {
  await loadProjectOrThrow(args.projectId)
  const conditions: SQL[] = [eq(projectAssets.projectId, args.projectId)]
  if (args.type && ['image', 'video', 'svg'].includes(args.type)) {
    conditions.push(eq(projectAssets.type, args.type))
  }
  if (args.source === 'upload' || args.source === 'generated') {
    conditions.push(eq(projectAssets.source, args.source))
  }
  const assets = await db
    .select()
    .from(projectAssets)
    .where(and(...conditions))
    .orderBy(desc(projectAssets.createdAt))
  return { assets }
}

async function getBrandKit(projectId: string) {
  assertValidUuid(projectId, 'projectId')
  const [project] = await db.select({ brandKit: projects.brandKit }).from(projects).where(eq(projects.id, projectId))
  if (!project) throw new IpcNotFoundError(`Project ${projectId} not found`)
  return { brandKit: (project.brandKit as BrandKit) ?? DEFAULT_BRAND_KIT }
}

async function updateBrandKit(args: { projectId: string; updates: Partial<BrandKit> }) {
  assertValidUuid(args.projectId, 'projectId')
  const [project] = await db
    .select({ brandKit: projects.brandKit })
    .from(projects)
    .where(eq(projects.id, args.projectId))
  if (!project) throw new IpcNotFoundError(`Project ${args.projectId} not found`)

  const current: BrandKit = (project.brandKit as BrandKit) ?? { ...DEFAULT_BRAND_KIT }
  const updated: BrandKit = { ...current }
  const { updates } = args

  if (typeof updates.brandName === 'string' || updates.brandName === null) {
    updated.brandName = updates.brandName as string | null
  }
  if (Array.isArray(updates.logoAssetIds)) {
    if (updates.logoAssetIds.length > MAX_LOGO_ASSET_IDS) {
      throw new IpcValidationError(`logoAssetIds exceeds ${MAX_LOGO_ASSET_IDS} item limit`)
    }
    // Must be UUIDs — otherwise `inArray` could silently match nothing
    // on coerced numeric values, and the DB parameter stream is cheaper
    // with a known shape.
    for (const id of updates.logoAssetIds) {
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new IpcValidationError('logoAssetIds entries must be valid UUIDs')
      }
    }
    if (updates.logoAssetIds.length > 0) {
      const existing = await db
        .select({ id: projectAssets.id })
        .from(projectAssets)
        .where(and(eq(projectAssets.projectId, args.projectId), inArray(projectAssets.id, updates.logoAssetIds)))
      const existingIds = new Set(existing.map((a) => a.id))
      updated.logoAssetIds = updates.logoAssetIds.filter((id) => existingIds.has(id))
    } else {
      updated.logoAssetIds = []
    }
  }
  if (Array.isArray(updates.palette)) {
    updated.palette = updates.palette.filter((c) => typeof c === 'string').slice(0, 8)
  }
  if (typeof updates.fontPrimary === 'string' || updates.fontPrimary === null) {
    updated.fontPrimary = updates.fontPrimary as string | null
  }
  if (typeof updates.fontSecondary === 'string' || updates.fontSecondary === null) {
    updated.fontSecondary = updates.fontSecondary as string | null
  }
  if (typeof updates.guidelines === 'string' || updates.guidelines === null) {
    updated.guidelines = updates.guidelines as string | null
  }

  await db.update(projects).set({ brandKit: updated }).where(eq(projects.id, args.projectId))
  return { brandKit: updated }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:projects.list', (_e, args?: ListArgs) => list(args ?? {}))
  ipcMain.handle('cench:projects.create', (_e, args: CreateArgs) => create(args))
  ipcMain.handle('cench:projects.get', (_e, projectId: string) => get(projectId))
  ipcMain.handle('cench:projects.update', (_e, args: UpdateArgs) => update(args))
  ipcMain.handle('cench:projects.delete', (_e, projectId: string) => remove(projectId))
  ipcMain.handle(
    'cench:projects.listAssets',
    (_e, args: { projectId: string; type?: 'image' | 'video' | 'svg'; source?: 'upload' | 'generated' }) =>
      listAssets(args),
  )
  ipcMain.handle('cench:projects.getBrandKit', (_e, projectId: string) => getBrandKit(projectId))
  ipcMain.handle('cench:projects.updateBrandKit', (_e, args: { projectId: string; updates: Partial<BrandKit> }) =>
    updateBrandKit(args),
  )
  // Single-asset CRUD. Route the service's validation/not-found errors
  // through the existing IPC-side error classes so the renderer sees a
  // consistent shape across all categories.
  const mapAssetError = (err: unknown) => {
    if (err instanceof AssetValidationError) throw new IpcValidationError(err.message)
    if (err instanceof AssetNotFoundError) throw new IpcNotFoundError(err.message)
    throw err
  }
  ipcMain.handle(
    'cench:projects.patchAsset',
    async (_e, args: { projectId: string; assetId: string; name?: string; tags?: string[] }) => {
      try {
        return await svcPatchAsset(args)
      } catch (err) {
        mapAssetError(err)
      }
    },
  )
  ipcMain.handle('cench:projects.deleteAsset', async (_e, args: { projectId: string; assetId: string }) => {
    try {
      return await svcDeleteAsset(args)
    } catch (err) {
      mapAssetError(err)
    }
  })
  ipcMain.handle(
    'cench:projects.regenerateAsset',
    async (
      _e,
      args: {
        projectId: string
        assetId: string
        promptOverride?: string
        model?: string
        aspectRatio?: string
        enhanceTags?: string[]
      },
    ) => {
      try {
        return await svcRegenerateAsset(args)
      } catch (err) {
        mapAssetError(err)
      }
    },
  )
}

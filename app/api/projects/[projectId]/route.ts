import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import fs from 'fs/promises'
import path from 'path'
import { normalizeScenesForPersistence } from '@/lib/charts/normalize-scenes'
import { readProjectSceneBlob, writeProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { readProjectScenesFromTables, writeProjectScenesToTables } from '@/lib/db/project-scene-table'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { SCRYPT_HASH_RE, LIMITS } from '@/lib/api/constants'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.projects')

// GET: load a single project with full data
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const { error, project } = await assertProjectAccess(projectId)
    if (error || !project) return error!

    const tableBacked = await readProjectScenesFromTables(projectId)
    const blobBacked = readProjectSceneBlob(project.description)
    if (!tableBacked && blobBacked.scenes.length > 0) {
      try {
        await writeProjectScenesToTables(projectId, blobBacked.scenes as any, blobBacked.sceneGraph as any)
      } catch (e) {
        log.error('GET: lazy table backfill failed', { error: e })
      }
    }
    const scenes = tableBacked?.scenes ?? blobBacked.scenes
    const sceneGraph = tableBacked?.sceneGraph ?? blobBacked.sceneGraph
    const zdogLibrary = blobBacked.zdogLibrary
    const timeline = blobBacked.timeline

    return NextResponse.json({
      ...project,
      scenes,
      sceneGraph,
      zdogLibrary,
      timeline,
    })
  } catch (error: any) {
    log.error('failed to load project', { error })
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  }
}

// PATCH: save/update a project
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const { error: accessError } = await assertProjectAccess(projectId)
    if (accessError) return accessError
    const body = await req.json()
    const {
      name,
      outputMode,
      globalStyle,
      mp4Settings,
      interactiveSettings,
      scenes,
      sceneGraph,
      apiPermissions,
      audioSettings,
      audioProviderEnabled,
      mediaGenEnabled,
      thumbnailUrl,
      watermark,
      brandKit,
      storyboardProposed,
      storyboardEdited,
      storyboardApplied,
      pausedAgentRun,
      runCheckpoint,
      timeline,
      workspaceId,
    } = body

    const updateData: Record<string, any> = { updatedAt: new Date() }
    if (workspaceId !== undefined) updateData.workspaceId = workspaceId || null
    if (name !== undefined) updateData.name = name
    if (outputMode !== undefined) {
      if (!['mp4', 'interactive'].includes(outputMode)) {
        return NextResponse.json({ error: `Invalid outputMode: ${outputMode}` }, { status: 400 })
      }
      updateData.outputMode = outputMode
    }
    if (globalStyle !== undefined) {
      // Cap globalStyle JSON size to prevent DB bloat
      if (JSON.stringify(globalStyle).length > LIMITS.MAX_GLOBAL_STYLE_SIZE) {
        return NextResponse.json({ error: 'globalStyle exceeds size limit' }, { status: 413 })
      }
      updateData.globalStyle = globalStyle
    }
    if (mp4Settings !== undefined) {
      if (JSON.stringify(mp4Settings).length > LIMITS.MAX_SETTINGS_SIZE) {
        return NextResponse.json({ error: 'mp4Settings exceeds size limit' }, { status: 413 })
      }
      updateData.mp4Settings = mp4Settings
    }
    if (interactiveSettings !== undefined) {
      // Hash the password if it's being set (don't re-hash an already-hashed value)
      // Use exact format match: 32-char hex salt + ":" + 128-char hex hash
      if (interactiveSettings.password && !SCRYPT_HASH_RE.test(interactiveSettings.password)) {
        const { hashPassword } = await import('@/lib/crypto')
        interactiveSettings.password = hashPassword(interactiveSettings.password)
      }
      updateData.interactiveSettings = interactiveSettings
    }
    if (apiPermissions !== undefined) updateData.apiPermissions = apiPermissions
    if (audioSettings !== undefined) updateData.audioSettings = audioSettings
    if (audioProviderEnabled !== undefined) updateData.audioProviderEnabled = audioProviderEnabled
    if (mediaGenEnabled !== undefined) updateData.mediaGenEnabled = mediaGenEnabled
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
    if (watermark !== undefined) updateData.watermark = watermark
    if (brandKit !== undefined) updateData.brandKit = brandKit
    if (storyboardProposed !== undefined) updateData.storyboardProposed = storyboardProposed
    if (storyboardEdited !== undefined) updateData.storyboardEdited = storyboardEdited
    if (storyboardApplied !== undefined) updateData.storyboardApplied = storyboardApplied
    if (pausedAgentRun !== undefined) updateData.pausedAgentRun = pausedAgentRun
    if (runCheckpoint !== undefined) updateData.runCheckpoint = runCheckpoint

    // Optimistic locking: read current version, write with version check
    const [existing] = await db
      .select({ description: projects.description, version: projects.version })
      .from(projects)
      .where(eq(projects.id, projectId))

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const currentVersion = existing.version ?? 1

    if (scenes !== undefined || sceneGraph !== undefined || timeline !== undefined) {
      const normalizedScenes =
        scenes !== undefined ? normalizeScenesForPersistence(scenes) : readProjectSceneBlob(existing.description).scenes
      updateData.description = writeProjectSceneBlob(existing.description, {
        scenes: normalizedScenes,
        sceneGraph: sceneGraph !== undefined ? sceneGraph : undefined,
        timeline: timeline !== undefined ? timeline : undefined,
      })
    }

    updateData.version = currentVersion + 1

    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, projectId), eq(projects.version, currentVersion)))
      .returning()

    if (!project) {
      return NextResponse.json({ error: 'Conflict: project was modified concurrently. Please retry.' }, { status: 409 })
    }

    if (scenes !== undefined || sceneGraph !== undefined) {
      try {
        const normalizedScenes =
          scenes !== undefined
            ? normalizeScenesForPersistence(scenes)
            : readProjectSceneBlob(existing.description).scenes
        const graphToWrite =
          sceneGraph !== undefined ? sceneGraph : readProjectSceneBlob(existing.description).sceneGraph
        await writeProjectScenesToTables(projectId, normalizedScenes as any, graphToWrite as any)
      } catch (e) {
        log.error('PATCH: table sync failed (blob is source of truth)', { error: e })
        // Don't rethrow — blob write already succeeded, client will load from blob on next GET
        // The GET's lazy backfill will repopulate tables from blob next time
      }
    }

    return NextResponse.json(project)
  } catch (error: any) {
    log.error('failed to update project', { error })
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// DELETE: delete a project and clean up associated files
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const { error: accessError, project } = await assertProjectAccess(projectId)
    if (accessError) return accessError

    // Delete from DB first (cascades to related tables via FK constraints)
    await db.delete(projects).where(eq(projects.id, projectId))

    // Clean up files in background (best-effort, don't block response)
    const cleanup = async () => {
      const scenesDir = path.join(process.cwd(), 'public', 'scenes')
      const publishedDir = path.join(process.cwd(), 'public', 'published', projectId)

      // Remove scene HTML files
      if (project?.description) {
        try {
          const parsed = readProjectSceneBlob(project.description)
          const sceneIds: string[] = (parsed.scenes || []).map((s: any) => s.id)
          await Promise.allSettled(
            sceneIds.map((sid) => fs.unlink(path.join(scenesDir, `${sid}.html`)).catch(() => {})),
          )
        } catch {}
      }

      // Remove published directory
      await fs.rm(publishedDir, { recursive: true, force: true }).catch(() => {})
    }

    cleanup().catch((err) => log.error('DELETE: cleanup failed', { extra: { projectId }, error: err }))

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    log.error('failed to delete project', { error })
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

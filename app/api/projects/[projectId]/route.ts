import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import fs from 'fs/promises'
import path from 'path'
import { normalizeScenesForPersistence } from '@/lib/charts/normalize-scenes'
import { readProjectSceneBlob, writeProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { readProjectScenesFromTables, writeProjectScenesToTables } from '@/lib/db/project-scene-table'

// GET: load a single project with full data
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const tableBacked = await readProjectScenesFromTables(projectId)
    const blobBacked = readProjectSceneBlob(project.description)
    if (!tableBacked && blobBacked.scenes.length > 0) {
      try {
        await writeProjectScenesToTables(projectId, blobBacked.scenes as any, blobBacked.sceneGraph as any)
      } catch (e) {
        console.error('[projects GET] lazy table backfill failed:', e)
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
    console.error('Failed to load project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH: save/update a project
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
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
      storyboardProposed,
      storyboardEdited,
      storyboardApplied,
      pausedAgentRun,
      runCheckpoint,
      timeline,
    } = body

    const updateData: Record<string, any> = { updatedAt: new Date() }
    if (name !== undefined) updateData.name = name
    if (outputMode !== undefined) {
      if (!['mp4', 'interactive'].includes(outputMode)) {
        return NextResponse.json({ error: `Invalid outputMode: ${outputMode}` }, { status: 400 })
      }
      updateData.outputMode = outputMode
    }
    if (globalStyle !== undefined) updateData.globalStyle = globalStyle
    if (mp4Settings !== undefined) updateData.mp4Settings = mp4Settings
    if (interactiveSettings !== undefined) updateData.interactiveSettings = interactiveSettings
    if (apiPermissions !== undefined) updateData.apiPermissions = apiPermissions
    if (audioSettings !== undefined) updateData.audioSettings = audioSettings
    if (audioProviderEnabled !== undefined) updateData.audioProviderEnabled = audioProviderEnabled
    if (mediaGenEnabled !== undefined) updateData.mediaGenEnabled = mediaGenEnabled
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
    if (watermark !== undefined) updateData.watermark = watermark
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
        console.error('[projects PATCH] table sync failed:', e)
      }
    }

    return NextResponse.json(project)
  } catch (error: any) {
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: delete a project and clean up associated files
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params

    // Load project to find scene IDs for cleanup
    const [project] = await db
      .select({ description: projects.description })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

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

    cleanup().catch((err) => console.error(`[DELETE project] Cleanup failed for ${projectId}:`, err))

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

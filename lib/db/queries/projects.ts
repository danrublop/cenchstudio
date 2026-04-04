import { db } from '../index'
import { projects, scenes } from '../schema'
import { eq, desc, isNull, and } from 'drizzle-orm'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { Scene, SceneGraph, GlobalStyle } from '@/lib/types'
import { normalizeScenesForPersistence } from '@/lib/charts/normalize-scenes'
import { writeProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { writeProjectScenesToTablesTx } from '@/lib/db/project-scene-table'

export type Project = InferSelectModel<typeof projects>
export type NewProject = InferInsertModel<typeof projects>

export async function getUserProjects(userId: string | null) {
  return db.query.projects.findMany({
    where: userId ? eq(projects.userId, userId) : isNull(projects.userId),
    orderBy: desc(projects.updatedAt),
    columns: {
      id: true,
      name: true,
      description: true,
      outputMode: true,
      storageMode: true,
      thumbnailUrl: true,
      isArchived: true,
      lastOpenedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      scenes: {
        columns: { id: true, name: true, position: true, thumbnailUrl: true },
        orderBy: (s) => s.position,
        limit: 5,
      },
    },
  })
}

export async function getFullProject(projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      scenes: {
        orderBy: (s) => s.position,
        with: {
          layers: {
            orderBy: (l) => l.zIndex,
            with: { media: true },
          },
          interactions: true,
        },
      },
      sceneEdges: true,
    },
  })
}

export async function createProject(data: NewProject) {
  const [project] = await db.insert(projects).values(data).returning()
  return project
}

export async function updateProject(projectId: string, data: Partial<NewProject>) {
  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning()
  return project
}

export async function deleteProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId))
}

export async function archiveProject(projectId: string) {
  return updateProject(projectId, { isArchived: true })
}

export async function touchProject(projectId: string) {
  await db.update(projects).set({ lastOpenedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, projectId))
}

/** Write agent run output to Postgres so the editor can recover if SSE disconnects before state_change. */
export async function persistScenesFromAgentRun(
  projectId: string,
  payload: {
    scenes: Scene[]
    sceneGraph: SceneGraph
    globalStyle: GlobalStyle
    storyboard?: any | null
    zdogLibrary?: any[]
    zdogStudioLibrary?: any[]
  },
  maxRetries = 4,
): Promise<boolean> {
  const normalizedScenes = normalizeScenesForPersistence(payload.scenes)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const txResult = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ version: projects.version, description: projects.description })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)

      if (!row) return { found: false, updated: false }

      const currentVersion = row.version ?? 1
      const newDescription = writeProjectSceneBlob(row.description, {
        scenes: normalizedScenes,
        sceneGraph: payload.sceneGraph,
        zdogLibrary: payload.zdogLibrary,
        zdogStudioLibrary: payload.zdogStudioLibrary,
      })

      const columnUpdates: Record<string, any> = {
        description: newDescription,
        globalStyle: payload.globalStyle,
        version: currentVersion + 1,
        updatedAt: new Date(),
      }
      // Persist storyboard proposal if the planner produced one
      if (payload.storyboard !== undefined) {
        columnUpdates.storyboardProposed = payload.storyboard
      }

      const [updated] = await tx
        .update(projects)
        .set(columnUpdates)
        .where(and(eq(projects.id, projectId), eq(projects.version, currentVersion)))
        .returning({ id: projects.id })

      if (!updated) return { found: true, updated: false }

      await writeProjectScenesToTablesTx(tx, projectId, normalizedScenes as any, payload.sceneGraph)
      return { found: true, updated: true }
    })

    if (!txResult.found) return false
    if (txResult.updated) return true
  }

  console.warn('[persistScenesFromAgentRun] optimistic lock failed after retries', projectId)
  return false
}

// ── Run Checkpoint (resume interrupted runs) ──────────────────────────────────

import type { RunCheckpoint } from '@/lib/agents/types'

/** Persist a run checkpoint so the user can resume after disconnect/timeout */
export async function persistRunCheckpoint(projectId: string, checkpoint: RunCheckpoint): Promise<void> {
  await db
    .update(projects)
    .set({ runCheckpoint: checkpoint as any, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
}

/** Fetch the run checkpoint for a project (null if none) */
export async function getRunCheckpoint(projectId: string): Promise<RunCheckpoint | null> {
  const [row] = await db
    .select({ runCheckpoint: projects.runCheckpoint })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  return (row?.runCheckpoint as RunCheckpoint | null) ?? null
}

/** Clear the run checkpoint after successful resume or user discard */
export async function clearRunCheckpoint(projectId: string): Promise<void> {
  await db.update(projects).set({ runCheckpoint: null, updatedAt: new Date() }).where(eq(projects.id, projectId))
}

// ── Agent Config ──────────────────────────────────────────────────────────────

import type { AgentConfig } from '@/lib/agents/config-resolver'

/** Get the project-level agent config (null if none set) */
export async function getProjectAgentConfig(projectId: string): Promise<Partial<AgentConfig> | null> {
  const [row] = await db
    .select({ agentConfig: projects.agentConfig })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  return (row?.agentConfig as Partial<AgentConfig> | null) ?? null
}

/** Set or update the project-level agent config */
export async function setProjectAgentConfig(projectId: string, config: Partial<AgentConfig>): Promise<void> {
  await db
    .update(projects)
    .set({ agentConfig: config as any, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
}

import { and, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from './index'
import { projects, sceneEdges, sceneNodes, scenes } from './schema'
import { normalizeTransition } from '@/lib/transitions'
import type { EdgeCondition, Scene, SceneGraph } from '@/lib/types'

function buildFallbackSceneFromRow(row: any): Scene {
  return {
    id: row.id,
    name: row.name ?? '',
    prompt: '',
    summary: '',
    svgContent: '',
    duration: row.duration ?? 8,
    bgColor: row.bgColor ?? '#ffffff',
    thumbnail: row.thumbnailUrl ?? null,
    videoLayer: row.videoLayer ?? { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
    audioLayer: row.audioLayer ?? {
      enabled: false,
      src: null,
      volume: 1,
      fadeIn: false,
      fadeOut: false,
      startOffset: 0,
    },
    textOverlays: [],
    svgObjects: [],
    primaryObjectId: null,
    svgBranches: [],
    activeBranchId: null,
    transition: normalizeTransition((row.transition?.type as string | undefined) ?? 'none'),
    usage: null,
    sceneType: 'svg',
    canvasCode: '',
    canvasBackgroundCode: '',
    sceneCode: '',
    sceneHTML: '',
    sceneStyles: '',
    lottieSource: '',
    d3Data: null,
    chartLayers: [],
    physicsLayers: [],
    interactions: [],
    variables: [],
    aiLayers: [],
    messages: [],
    styleOverride: row.styleOverride ?? {},
    cameraMotion: row.cameraMotion ?? null,
    worldConfig: row.worldConfig ?? null,
  }
}

function isUuid(value: string | undefined | null): value is string {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeEdgeCondition(cond: unknown): EdgeCondition {
  const c = cond && typeof cond === 'object' ? (cond as Record<string, unknown>) : {}
  return {
    type: ((c.type as string) ?? 'auto') as EdgeCondition['type'],
    interactionId: (c.interactionId as string | null) ?? null,
    variableName: (c.variableName as string | null) ?? null,
    variableValue: (c.variableValue as string | null) ?? null,
  }
}

function edgeSemanticKey(edge: { fromSceneId: string; toSceneId: string; condition: EdgeCondition }): string {
  return `${edge.fromSceneId}::${edge.toSceneId}::${JSON.stringify(edge.condition)}`
}

export async function writeProjectScenesToTables(
  projectId: string,
  projectScenes: Scene[],
  sceneGraph: SceneGraph | null | undefined,
): Promise<void> {
  await db.transaction(async (tx) => {
    await writeProjectScenesToTablesTx(tx, projectId, projectScenes, sceneGraph)
  })
}

export async function writeProjectScenesToTablesTx(
  tx: any,
  projectId: string,
  projectScenes: Scene[],
  sceneGraph: SceneGraph | null | undefined,
): Promise<void> {
  // Safety invariant: never allow scene id collisions across projects to be
  // silently rewritten. We fail fast so callers can regenerate IDs instead.
  const incomingSceneIds = projectScenes.map((s) => s.id)
  if (incomingSceneIds.length > 0) {
    const crossProjectRows = await tx
      .select({ id: scenes.id })
      .from(scenes)
      .where(and(ne(scenes.projectId, projectId), inArray(scenes.id, incomingSceneIds)))
      .limit(1)
    if (crossProjectRows.length > 0) {
      throw new Error(`scene id collision across projects for id ${crossProjectRows[0].id}`)
    }
  }

  await tx
    .update(projects)
    .set({ sceneGraphStartSceneId: sceneGraph?.startSceneId ?? null, updatedAt: new Date() })
    .where(eq(projects.id, projectId))

  if (incomingSceneIds.length > 0) {
    await tx.delete(scenes).where(and(eq(scenes.projectId, projectId), notInArray(scenes.id, incomingSceneIds)))
  } else {
    await tx.delete(scenes).where(eq(scenes.projectId, projectId))
  }

  if (projectScenes.length > 0) {
    await tx
      .insert(scenes)
      .values(
        projectScenes.map((s, idx) => ({
          id: s.id,
          projectId,
          name: s.name ?? '',
          position: idx,
          duration: s.duration ?? 8,
          bgColor: s.bgColor ?? '#ffffff',
          styleOverride: s.styleOverride ?? {},
          transition: { type: normalizeTransition(s.transition), duration: 0.5 },
          audioLayer: s.audioLayer ?? null,
          videoLayer: s.videoLayer ?? null,
          thumbnailUrl: s.thumbnail ?? null,
          cameraMotion: s.cameraMotion ?? null,
          worldConfig: s.worldConfig ?? null,
          sceneBlob: s as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: scenes.id,
        set: {
          // Keep projectId immutable on conflicts to avoid cross-project reassignment.
          name: sql`excluded.name`,
          position: sql`excluded.position`,
          duration: sql`excluded.duration`,
          bgColor: sql`excluded.bg_color`,
          styleOverride: sql`excluded.style_override`,
          transition: sql`excluded.transition`,
          audioLayer: sql`excluded.audio_layer`,
          videoLayer: sql`excluded.video_layer`,
          thumbnailUrl: sql`excluded.thumbnail_url`,
          cameraMotion: sql`excluded.camera_motion`,
          worldConfig: sql`excluded.world_config`,
          sceneBlob: sql`excluded.scene_blob`,
          updatedAt: new Date(),
        },
      })
  }

  const nodes = sceneGraph?.nodes ?? []
  const incomingNodeSceneIds = nodes.map((n) => n.id)
  if (incomingNodeSceneIds.length > 0) {
    await tx
      .delete(sceneNodes)
      .where(and(eq(sceneNodes.projectId, projectId), notInArray(sceneNodes.sceneId, incomingNodeSceneIds)))
    await tx
      .insert(sceneNodes)
      .values(
        nodes.map((n) => ({
          projectId,
          sceneId: n.id,
          position: n.position ?? { x: 0, y: 0 },
        })),
      )
      .onConflictDoUpdate({
        target: [sceneNodes.projectId, sceneNodes.sceneId],
        set: { position: sql`excluded.position` },
      })
  } else {
    await tx.delete(sceneNodes).where(eq(sceneNodes.projectId, projectId))
  }

  const existingEdges = await tx
    .select({
      id: sceneEdges.id,
      fromSceneId: sceneEdges.fromSceneId,
      toSceneId: sceneEdges.toSceneId,
      condition: sceneEdges.condition,
    })
    .from(sceneEdges)
    .where(eq(sceneEdges.projectId, projectId))

  const existingBySemantic = new Map<string, string[]>()
  for (const ee of existingEdges) {
    const key = edgeSemanticKey({
      fromSceneId: ee.fromSceneId ?? '',
      toSceneId: ee.toSceneId ?? '',
      condition: normalizeEdgeCondition(ee.condition),
    })
    const list = existingBySemantic.get(key) ?? []
    list.push(ee.id)
    existingBySemantic.set(key, list)
  }

  const edges = sceneGraph?.edges ?? []
  const edgeRows = edges.map((e) => {
    const normalizedCondition = normalizeEdgeCondition(e.condition)
    let edgeId = isUuid(e.id) ? e.id : null
    if (!edgeId) {
      const key = edgeSemanticKey({
        fromSceneId: e.fromSceneId,
        toSceneId: e.toSceneId,
        condition: normalizedCondition,
      })
      const existing = existingBySemantic.get(key)
      edgeId = existing?.shift() ?? null
    }
    return {
      id: edgeId ?? randomUUID(),
      projectId,
      fromSceneId: e.fromSceneId,
      toSceneId: e.toSceneId,
      condition: normalizedCondition,
    }
  })

  const incomingEdgeIds = edgeRows.map((e) => e.id)
  if (incomingEdgeIds.length > 0) {
    await tx
      .delete(sceneEdges)
      .where(and(eq(sceneEdges.projectId, projectId), notInArray(sceneEdges.id, incomingEdgeIds)))
    await tx
      .insert(sceneEdges)
      .values(edgeRows)
      .onConflictDoUpdate({
        target: sceneEdges.id,
        set: {
          fromSceneId: sql`excluded.from_scene_id`,
          toSceneId: sql`excluded.to_scene_id`,
          condition: sql`excluded.condition`,
        },
      })
  } else {
    await tx.delete(sceneEdges).where(eq(sceneEdges.projectId, projectId))
  }
}

export async function readProjectScenesFromTables(
  projectId: string,
): Promise<{ scenes: Scene[]; sceneGraph: SceneGraph } | null> {
  const rows = await db.query.scenes.findMany({
    where: eq(scenes.projectId, projectId),
    orderBy: (s, { asc }) => [asc(s.position)],
  })
  if (!rows || rows.length === 0) return null

  const edgeRows = await db.query.sceneEdges.findMany({
    where: eq(sceneEdges.projectId, projectId),
  })
  const nodeRows = await db.query.sceneNodes.findMany({
    where: eq(sceneNodes.projectId, projectId),
  })
  const [projectRow] = await db
    .select({ startSceneId: projects.sceneGraphStartSceneId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  const outScenes: Scene[] = rows.map((r: any) => {
    const blob = r.sceneBlob as Record<string, unknown> | null
    if (blob && typeof blob === 'object') return blob as unknown as Scene
    return buildFallbackSceneFromRow(r)
  })

  const outGraph: SceneGraph = {
    nodes:
      nodeRows.length > 0
        ? nodeRows.map((n: any) => ({
            id: n.sceneId,
            position: n.position ?? { x: 0, y: 0 },
          }))
        : outScenes.map((s, i) => ({ id: s.id, position: { x: i * 300, y: 100 } })),
    edges: edgeRows.map((e: any) => ({
      id: e.id,
      fromSceneId: e.fromSceneId,
      toSceneId: e.toSceneId,
      condition: e.condition ?? { type: 'auto', interactionId: null, variableName: null, variableValue: null },
    })),
    startSceneId: projectRow?.startSceneId ?? outScenes[0]?.id ?? '',
  }

  return { scenes: outScenes, sceneGraph: outGraph }
}

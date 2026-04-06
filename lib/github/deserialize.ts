/**
 * Bundle deserializer — parses a CenchBundle and creates a new project in Postgres.
 *
 * v1 strategy: "Import always creates a new project" — safest, no data loss.
 * IDs are regenerated to avoid collisions with existing projects.
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { projects, projectAssets } from '@/lib/db/schema'
import { writeProjectScenesToTables } from '@/lib/db/project-scene-table'
import type { Scene, SceneGraph } from '@/lib/types'
import type { CenchBundle, BundleAsset } from './bundle-types'
import { BUNDLE_FORMAT_VERSION } from './bundle-types'

interface ImportResult {
  projectId: string
  projectName: string
  sceneCount: number
  assetCount: number
  warnings: string[]
}

export async function importBundle(bundle: CenchBundle, nameOverride?: string): Promise<ImportResult> {
  const warnings: string[] = []

  // 1. Validate format version
  if (bundle.formatVersion !== BUNDLE_FORMAT_VERSION) {
    throw new Error(
      `Unsupported bundle format version: ${bundle.formatVersion}. Expected: ${BUNDLE_FORMAT_VERSION}`,
    )
  }

  // 2. Generate new IDs — scenes and assets
  const newProjectId = uuidv4()
  const sceneIdMap = new Map<string, string>()
  const assetIdMap = new Map<string, string>()

  for (const bs of bundle.scenes) {
    sceneIdMap.set(bs.scene.id, uuidv4())
  }
  for (const asset of bundle.assets) {
    assetIdMap.set(asset.id, uuidv4())
  }

  // 3. Remap scene IDs throughout scenes
  const remappedScenes: Scene[] = bundle.scenes
    .sort((a, b) => a.position - b.position)
    .map((bs) => remapSceneIds(bs.scene, sceneIdMap))

  // 4. Remap scene graph
  const remappedGraph = remapSceneGraphIds(bundle.sceneGraph, sceneIdMap)

  // 5. Remap timeline clip sourceIds that reference scenes
  let timeline = bundle.timeline
  if (timeline) {
    timeline = remapTimelineIds(timeline, sceneIdMap)
  }

  // 6. Remap watermark assetId if present
  let watermark = bundle.project.watermark
  if (watermark && assetIdMap.has(watermark.assetId)) {
    watermark = { ...watermark, assetId: assetIdMap.get(watermark.assetId)! }
  }

  // 7. Warn about unavailable assets
  const unavailableAssets = bundle.assets.filter((a) => !a.embedded && !a.publicUrl)
  if (unavailableAssets.length > 0) {
    warnings.push(
      `${unavailableAssets.length} asset(s) have no public URL and are not embedded — they will be unavailable.`,
    )
  }

  // 8. Create project in Postgres
  const projectName = nameOverride || `${bundle.project.name} (imported)`
  const description = JSON.stringify({
    scenes: remappedScenes,
    sceneGraph: remappedGraph,
    zdogLibrary: bundle.zdogLibrary ?? [],
    zdogStudioLibrary: bundle.zdogStudioLibrary ?? [],
    timeline: timeline ?? null,
  })

  await db.insert(projects).values({
    id: newProjectId,
    name: projectName.slice(0, 255),
    outputMode: bundle.project.outputMode,
    globalStyle: bundle.project.globalStyle,
    mp4Settings: bundle.project.mp4Settings,
    interactiveSettings: bundle.project.interactiveSettings,
    audioSettings: bundle.project.audioSettings,
    audioProviderEnabled: bundle.project.audioProviderEnabled,
    mediaGenEnabled: bundle.project.mediaGenEnabled,
    watermark,
    description,
    sceneGraphStartSceneId: remappedGraph.startSceneId || null,
  })

  // 9. Write assets to projectAssets table
  const importedAssetCount = await importAssets(newProjectId, bundle.assets, assetIdMap, warnings)

  // 10. Write to normalized scene tables for query performance
  try {
    await writeProjectScenesToTables(newProjectId, remappedScenes, remappedGraph)
  } catch (err) {
    // Non-fatal — blob is the primary store
    warnings.push(`Failed to write normalized scene tables: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  return {
    projectId: newProjectId,
    projectName,
    sceneCount: remappedScenes.length,
    assetCount: importedAssetCount,
    warnings,
  }
}

// ── Asset import ────────────────────────────────────────────────────────────

async function importAssets(
  projectId: string,
  assets: BundleAsset[],
  assetIdMap: Map<string, string>,
  warnings: string[],
): Promise<number> {
  if (assets.length === 0) return 0

  let imported = 0
  for (const asset of assets) {
    // Skip assets with no URL and not embedded (nothing to reference)
    if (!asset.publicUrl && !asset.embedded) continue

    const newId = assetIdMap.get(asset.id) ?? asset.id
    try {
      await db.insert(projectAssets).values({
        id: newId,
        projectId,
        filename: asset.filename,
        // For v1: use publicUrl as both storagePath and publicUrl
        // Embedded files would need a separate download/upload step
        storagePath: asset.publicUrl ?? '',
        publicUrl: asset.publicUrl ?? '',
        type: asset.type,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds,
        name: asset.name,
        tags: asset.tags,
      })
      imported++
    } catch (err) {
      warnings.push(`Failed to import asset "${asset.name}": ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
  return imported
}

// ── ID remapping helpers ────────────────────────────────────────────────────

function remapSceneIds(scene: Scene, idMap: Map<string, string>): Scene {
  const newId = idMap.get(scene.id) ?? scene.id
  return {
    ...scene,
    id: newId,
    // Remap interaction jump targets
    interactions: scene.interactions.map((ix) => remapInteractionIds(ix, idMap)),
  }
}

function remapInteractionIds(ix: any, idMap: Map<string, string>): any {
  const remapped = { ...ix }

  // Hotspot: jumpsToSceneId
  if (remapped.jumpsToSceneId && idMap.has(remapped.jumpsToSceneId)) {
    remapped.jumpsToSceneId = idMap.get(remapped.jumpsToSceneId)
  }

  // Choice: options[].jumpsToSceneId
  if (remapped.options && Array.isArray(remapped.options)) {
    remapped.options = remapped.options.map((opt: any) => ({
      ...opt,
      jumpsToSceneId: opt.jumpsToSceneId && idMap.has(opt.jumpsToSceneId)
        ? idMap.get(opt.jumpsToSceneId)
        : opt.jumpsToSceneId,
    }))
  }

  // Quiz: onCorrectSceneId, onWrongSceneId
  if (remapped.onCorrectSceneId && idMap.has(remapped.onCorrectSceneId)) {
    remapped.onCorrectSceneId = idMap.get(remapped.onCorrectSceneId)
  }
  if (remapped.onWrongSceneId && idMap.has(remapped.onWrongSceneId)) {
    remapped.onWrongSceneId = idMap.get(remapped.onWrongSceneId)
  }

  // Form: jumpsToSceneId
  if (remapped.type === 'form' && remapped.jumpsToSceneId && idMap.has(remapped.jumpsToSceneId)) {
    remapped.jumpsToSceneId = idMap.get(remapped.jumpsToSceneId)
  }

  return remapped
}

function remapSceneGraphIds(graph: SceneGraph, idMap: Map<string, string>): SceneGraph {
  return {
    nodes: graph.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id) ?? n.id,
    })),
    edges: graph.edges.map((e) => ({
      ...e,
      id: uuidv4(), // New edge IDs
      fromSceneId: idMap.get(e.fromSceneId) ?? e.fromSceneId,
      toSceneId: idMap.get(e.toSceneId) ?? e.toSceneId,
    })),
    startSceneId: idMap.get(graph.startSceneId) ?? graph.startSceneId,
  }
}

function remapTimelineIds(timeline: any, idMap: Map<string, string>): any {
  if (!timeline || !timeline.tracks) return timeline
  return {
    ...timeline,
    tracks: timeline.tracks.map((track: any) => ({
      ...track,
      clips: (track.clips ?? []).map((clip: any) => ({
        ...clip,
        sourceId: clip.sourceType === 'scene' && idMap.has(clip.sourceId)
          ? idMap.get(clip.sourceId)
          : clip.sourceId,
      })),
    })),
  }
}

// Re-export file layout helpers from the pure module (no DB deps)
export { filesToBundle } from './file-layout'

/**
 * Bundle serializer — reads a project from Postgres and produces a CenchBundle.
 */

import { db } from '@/lib/db'
import { projects, projectAssets } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { readProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { readProjectScenesFromTables } from '@/lib/db/project-scene-table'
import type { Scene, SceneGraph } from '@/lib/types'
import type { CenchBundle, BundleScene, BundleAsset, BundleProject } from './bundle-types'
import { BUNDLE_FORMAT_VERSION } from './bundle-types'

/** Maximum file size to embed in the bundle (5 MB). */
const MAX_EMBED_BYTES = 5 * 1024 * 1024

export async function serializeProject(projectId: string): Promise<CenchBundle> {
  // 1. Load project row
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)

  if (!row) {
    throw new Error(`Project not found: ${projectId}`)
  }

  // 2. Read blob once (zdogLibrary/timeline are only stored here)
  const blob = readProjectSceneBlob(row.description)
  const zdogLibrary: unknown[] = blob.zdogLibrary ?? []
  const zdogStudioLibrary: unknown[] = (blob as any).zdogStudioLibrary ?? []
  const timeline: unknown = blob.timeline ?? null

  // 3. Load scenes — prefer normalized tables, fall back to blob
  let loadedScenes: Scene[] = []
  let sceneGraph: SceneGraph | null = null

  const tableResult = await readProjectScenesFromTables(projectId)
  if (tableResult && tableResult.scenes.length > 0) {
    loadedScenes = tableResult.scenes
    sceneGraph = tableResult.sceneGraph
  } else {
    loadedScenes = blob.scenes ?? []
    sceneGraph = blob.sceneGraph ?? null
  }

  // 4. Build default scene graph if missing
  if (!sceneGraph) {
    sceneGraph = {
      nodes: loadedScenes.map((s, i) => ({ id: s.id, position: { x: i * 220, y: 100 } })),
      edges: loadedScenes.slice(0, -1).map((s, i) => ({
        id: `edge-${i}`,
        fromSceneId: s.id,
        toSceneId: loadedScenes[i + 1].id,
        condition: { type: 'auto' as const, interactionId: null, variableName: null, variableValue: null },
      })),
      startSceneId: loadedScenes[0]?.id ?? '',
    }
  }

  // 5. Load project assets
  const assetRows = await db
    .select()
    .from(projectAssets)
    .where(eq(projectAssets.projectId, projectId))
    .orderBy(asc(projectAssets.createdAt))

  const bundleAssets: BundleAsset[] = assetRows.map((a) => ({
    id: a.id,
    filename: a.filename,
    type: a.type as 'image' | 'video' | 'svg',
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    width: a.width,
    height: a.height,
    durationSeconds: a.durationSeconds,
    name: a.name,
    tags: a.tags ?? [],
    // Embed small files, reference large ones by URL
    embedded: a.sizeBytes <= MAX_EMBED_BYTES,
    publicUrl: a.publicUrl,
    bundlePath: a.sizeBytes <= MAX_EMBED_BYTES ? `assets/${a.id}/${a.filename}` : null,
  }))

  // 6. Build scene list with position
  const bundleScenes: BundleScene[] = loadedScenes.map((scene, i) => ({
    scene: stripEphemeralFields(scene),
    position: i,
  }))

  // 7. Build project metadata (exclude sensitive/ephemeral fields)
  const bundleProject: BundleProject = {
    originId: row.id,
    name: row.name,
    outputMode: row.outputMode as 'mp4' | 'interactive',
    globalStyle: (row.globalStyle as BundleProject['globalStyle']) ?? {
      presetId: null,
      paletteOverride: null,
      bgColorOverride: null,
      fontOverride: null,
      bodyFontOverride: null,
      strokeColorOverride: null,
    },
    mp4Settings: (row.mp4Settings as BundleProject['mp4Settings']) ?? {
      resolution: '1080p',
      fps: 30,
      format: 'mp4',
    },
    interactiveSettings: (row.interactiveSettings as BundleProject['interactiveSettings']) ?? {
      playerTheme: 'dark',
      showProgressBar: true,
      showSceneNav: true,
      allowFullscreen: true,
      brandColor: '#e84545',
      customDomain: null,
      password: null,
    },
    audioSettings: (row.audioSettings as BundleProject['audioSettings']) ?? {
      defaultTTSProvider: 'auto',
      defaultSFXProvider: 'auto',
      defaultMusicProvider: 'auto',
      defaultVoiceId: null,
      defaultVoiceName: null,
      webSpeechVoice: null,
      puterProvider: 'openai',
      openaiTTSModel: 'tts-1',
      openaiTTSVoice: 'alloy',
      geminiTTSModel: 'gemini-2.5-flash-preview-tts',
      geminiVoice: null,
      edgeTTSUrl: null,
      pocketTTSUrl: null,
      voxcpmUrl: null,
      globalMusicDucking: true,
      globalMusicDuckLevel: 0.2,
    },
    audioProviderEnabled: (row.audioProviderEnabled as Record<string, boolean>) ?? {},
    mediaGenEnabled: (row.mediaGenEnabled as Record<string, boolean>) ?? {},
    watermark: (row.watermark as BundleProject['watermark']) ?? null,
  }

  // 8. Assemble bundle
  const bundle: CenchBundle = {
    formatVersion: BUNDLE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    project: bundleProject,
    scenes: bundleScenes,
    sceneGraph,
    assets: bundleAssets,
    timeline: timeline as CenchBundle['timeline'],
    ...(zdogLibrary.length > 0 && { zdogLibrary }),
    ...(zdogStudioLibrary.length > 0 && { zdogStudioLibrary }),
  }

  return bundle
}

/**
 * Strip fields that are ephemeral or shouldn't be in the bundle:
 * - messages (chat history is per-session)
 * - usage (billing/token tracking)
 * - thumbnail (data URL, regenerated on open)
 */
function stripEphemeralFields(scene: Scene): Scene {
  return {
    ...scene,
    messages: [],
    usage: null,
    thumbnail: null,
  }
}

// Re-export file layout helpers from the pure module (no DB deps)
export { bundleToFiles } from './file-layout'

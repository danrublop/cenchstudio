// ── Canonical stage artifacts ────────────────────────────────────────────────
//
// Intermediate JSON documents produced during a multi-stage agent run. Each
// has a Zod schema so they can be validated before being handed to the next
// stage or persisted on the project. Mirrors the pattern used by Storyboard +
// RunCheckpoint but extends it to the full pipeline:
//
//   research → script → scene_plan → asset_manifest → render_report
//
// Today the runner doesn't formally checkpoint between these; the schemas
// exist so tools can produce/consume them with type safety, and the project
// can hold the latest version on `projects.stageArtifacts` (JSONB) for
// inspection and mid-stage resumption later.

import { z } from 'zod'

// ── Script ───────────────────────────────────────────────────────────────────

export const ScriptBeatSchema = z.object({
  id: z.string(),
  sceneStoryboardId: z.string().nullable().optional(),
  purpose: z.string(),
  narration: z.string(),
  /** Target spoken duration in seconds, estimated from word count. */
  estimatedDurationSeconds: z.number().nonnegative(),
  voiceTone: z.string().optional(),
  notes: z.string().optional(),
})

export const ScriptArtifactSchema = z.object({
  kind: z.literal('script'),
  version: z.literal(1),
  title: z.string(),
  beats: z.array(ScriptBeatSchema),
  totalEstimatedDurationSeconds: z.number().nonnegative(),
  createdAt: z.string(),
})

export type ScriptBeat = z.infer<typeof ScriptBeatSchema>
export type ScriptArtifact = z.infer<typeof ScriptArtifactSchema>

// ── Scene plan (post-script, pre-build) ──────────────────────────────────────

export const ScenePlanEntrySchema = z.object({
  id: z.string(),
  /** Matches a ScriptBeat.id when the plan was derived from a script. */
  scriptBeatId: z.string().nullable().optional(),
  sceneType: z.string(),
  durationSeconds: z.number().nonnegative(),
  renderer: z
    .enum([
      'react',
      'motion',
      'canvas2d',
      'd3',
      'three',
      'svg',
      'lottie',
      'zdog',
      'physics',
      '3d_world',
      'avatar_scene',
    ])
    .optional(),
  narration: z.string().optional(),
  visualNotes: z.string().optional(),
  /** Caps we promised to the user (platform profile max, user override). */
  maxCostUsd: z.number().positive().nullable().optional(),
})

export const ScenePlanArtifactSchema = z.object({
  kind: z.literal('scene_plan'),
  version: z.literal(1),
  scenes: z.array(ScenePlanEntrySchema),
  totalEstimatedDurationSeconds: z.number().nonnegative(),
  styleSummary: z.string().optional(),
  createdAt: z.string(),
})

export type ScenePlanEntry = z.infer<typeof ScenePlanEntrySchema>
export type ScenePlanArtifact = z.infer<typeof ScenePlanArtifactSchema>

// ── Asset manifest ───────────────────────────────────────────────────────────

export const AssetManifestEntrySchema = z.object({
  id: z.string(),
  /** sceneId it's attached to, or null for project-global assets. */
  sceneId: z.string().nullable(),
  kind: z.enum(['image', 'video', 'audio', 'lottie', 'font', 'svg', 'caption']),
  source: z.enum(['generated', 'stock', 'upload', 'url']),
  provider: z.string().optional(),
  prompt: z.string().optional(),
  /** Where the asset lives — usually `/audio/...`, `/public/assets/...`, or an external URL. */
  url: z.string(),
  mime: z.string().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  bytes: z.number().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  createdAt: z.string(),
})

export const AssetManifestArtifactSchema = z.object({
  kind: z.literal('asset_manifest'),
  version: z.literal(1),
  entries: z.array(AssetManifestEntrySchema),
  totalCostUsd: z.number().nonnegative(),
  createdAt: z.string(),
})

export type AssetManifestEntry = z.infer<typeof AssetManifestEntrySchema>
export type AssetManifestArtifact = z.infer<typeof AssetManifestArtifactSchema>

// ── Render report (post-export) ──────────────────────────────────────────────

export const RenderReportSceneSchema = z.object({
  sceneId: z.string(),
  name: z.string().optional(),
  durationSeconds: z.number().nonnegative(),
  renderedFrames: z.number().nonnegative().optional(),
  status: z.enum(['ok', 'warning', 'error']),
  warnings: z.array(z.string()).optional(),
})

export const RenderReportArtifactSchema = z.object({
  kind: z.literal('render_report'),
  version: z.literal(1),
  outputMp4Path: z.string().nullable(),
  captionsSrtPath: z.string().nullable().optional(),
  captionsVttPath: z.string().nullable().optional(),
  resolution: z.string(),
  fps: z.number().positive(),
  totalDurationSeconds: z.number().nonnegative(),
  platformProfileId: z.string().nullable().optional(),
  scenes: z.array(RenderReportSceneSchema),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  /** Wall-clock seconds the export took. */
  elapsedSeconds: z.number().nonnegative(),
  /** Cumulative media-generation + render cost for this export, in USD. */
  costUsd: z.number().nonnegative(),
  createdAt: z.string(),
})

export type RenderReportScene = z.infer<typeof RenderReportSceneSchema>
export type RenderReportArtifact = z.infer<typeof RenderReportArtifactSchema>

// ── Union + validator ────────────────────────────────────────────────────────

export const StageArtifactSchema = z.discriminatedUnion('kind', [
  ScriptArtifactSchema,
  ScenePlanArtifactSchema,
  AssetManifestArtifactSchema,
  RenderReportArtifactSchema,
])

export type StageArtifact = z.infer<typeof StageArtifactSchema>
export type StageArtifactKind = StageArtifact['kind']

export interface StageArtifactBundle {
  script?: ScriptArtifact | null
  scenePlan?: ScenePlanArtifact | null
  assetManifest?: AssetManifestArtifact | null
  renderReport?: RenderReportArtifact | null
}

/** Validate a raw JSON object as a stage artifact. Returns the parsed, typed
 *  value on success, or throws a ZodError with readable field paths on
 *  failure — callers should surface the message back to the agent. */
export function parseStageArtifact(input: unknown): StageArtifact {
  return StageArtifactSchema.parse(input)
}

/** Safe variant — returns a discriminated result instead of throwing. */
export function safeParseStageArtifact(
  input: unknown,
): { success: true; value: StageArtifact } | { success: false; error: string } {
  const r = StageArtifactSchema.safeParse(input)
  if (r.success) return { success: true, value: r.data }
  const issue = r.error.issues[0]
  const path = issue?.path.join('.') || '(root)'
  return { success: false, error: `${path}: ${issue?.message ?? 'invalid'}` }
}

/** Validate a single artifact kind. Useful when you know the shape up front. */
export function parseStageArtifactByKind<K extends StageArtifactKind>(
  kind: K,
  input: unknown,
): Extract<StageArtifact, { kind: K }> {
  const schemas: Record<StageArtifactKind, z.ZodType> = {
    script: ScriptArtifactSchema,
    scene_plan: ScenePlanArtifactSchema,
    asset_manifest: AssetManifestArtifactSchema,
    render_report: RenderReportArtifactSchema,
  }
  return schemas[kind].parse(input) as Extract<StageArtifact, { kind: K }>
}

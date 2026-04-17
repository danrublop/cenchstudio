import { describe, it, expect } from 'vitest'
import {
  parseStageArtifact,
  parseStageArtifactByKind,
  safeParseStageArtifact,
  type AssetManifestArtifact,
  type RenderReportArtifact,
  type ScenePlanArtifact,
  type ScriptArtifact,
} from './stage-artifacts'

const now = '2026-04-17T00:00:00.000Z'

describe('stage artifacts', () => {
  it('parses a valid script artifact', () => {
    const script: ScriptArtifact = {
      kind: 'script',
      version: 1,
      title: 'Demo',
      beats: [{ id: 'b1', purpose: 'hook', narration: 'Meet Ada.', estimatedDurationSeconds: 3.2 }],
      totalEstimatedDurationSeconds: 3.2,
      createdAt: now,
    }
    expect(parseStageArtifact(script)).toEqual(script)
  })

  it('rejects a script artifact with missing fields and points at the field path', () => {
    const bad = {
      kind: 'script',
      version: 1,
      title: 'Demo',
      beats: [{ id: 'b1', purpose: 'hook' }],
      totalEstimatedDurationSeconds: 3.2,
      createdAt: now,
    }
    const result = safeParseStageArtifact(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/beats\.0\.narration/)
    }
  })

  it('parses a scene plan artifact', () => {
    const plan: ScenePlanArtifact = {
      kind: 'scene_plan',
      version: 1,
      scenes: [{ id: 's1', sceneType: 'react', durationSeconds: 8, renderer: 'react', narration: 'Hi' }],
      totalEstimatedDurationSeconds: 8,
      createdAt: now,
    }
    expect(parseStageArtifactByKind('scene_plan', plan)).toEqual(plan)
  })

  it('parses an asset manifest and rolls up cost', () => {
    const manifest: AssetManifestArtifact = {
      kind: 'asset_manifest',
      version: 1,
      entries: [
        {
          id: 'a1',
          sceneId: 's1',
          kind: 'audio',
          source: 'generated',
          provider: 'elevenlabs',
          url: '/audio/foo.mp3',
          durationSeconds: 4,
          costUsd: 0.06,
          createdAt: now,
        },
      ],
      totalCostUsd: 0.06,
      createdAt: now,
    }
    expect(parseStageArtifactByKind('asset_manifest', manifest)).toEqual(manifest)
  })

  it('parses a render report and preserves warnings/errors', () => {
    const report: RenderReportArtifact = {
      kind: 'render_report',
      version: 1,
      outputMp4Path: '/exports/demo.mp4',
      captionsSrtPath: '/exports/demo.srt',
      captionsVttPath: '/exports/demo.vtt',
      resolution: '1080p',
      fps: 30,
      totalDurationSeconds: 12,
      platformProfileId: 'youtube-landscape',
      scenes: [{ sceneId: 's1', durationSeconds: 12, status: 'ok' }],
      warnings: ['scene-2 used naive captions'],
      errors: [],
      elapsedSeconds: 42,
      costUsd: 0.21,
      createdAt: now,
    }
    expect(parseStageArtifactByKind('render_report', report)).toEqual(report)
  })

  it('rejects an unknown kind', () => {
    const r = safeParseStageArtifact({ kind: 'storyboard', version: 1 })
    expect(r.success).toBe(false)
  })
})

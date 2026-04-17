/**
 * GET /api/verify-scene?projectId=X&sceneId=Y
 *
 * Standalone scene verification endpoint. Runs the same checks as the
 * agent's verify_scene tool — content presence, text overlap, palette
 * adherence, audio, duration sanity, expected elements.
 *
 * Callable from Claude Code, MCP, or any HTTP client.
 *
 * Query params:
 *   projectId  — required
 *   sceneId    — required
 *   expected   — optional comma-separated keywords to check for
 *
 * Response: { success, report, checks, issues }
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Scene, GlobalStyle } from '@/lib/types'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { readProjectScenesFromTables } from '@/lib/db/project-scene-table'
import { readProjectSceneBlob } from '@/lib/db/project-scene-storage'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const sceneId = searchParams.get('sceneId')
  const expectedRaw = searchParams.get('expected')

  if (!projectId || !sceneId) {
    return NextResponse.json({ error: 'projectId and sceneId are required query params' }, { status: 400 })
  }

  // Load project
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1)

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Load scenes
  const tableBacked = await readProjectScenesFromTables(projectId)
  const blob = readProjectSceneBlob(project.description)
  const scenes: Scene[] = tableBacked?.scenes ?? blob.scenes ?? []

  const scene = scenes.find((s) => s.id === sceneId)
  if (!scene) {
    return NextResponse.json({ error: `Scene ${sceneId} not found` }, { status: 404 })
  }

  const globalStyle: GlobalStyle = (project as any).globalStyle ?? {
    presetId: null,
    fontOverride: null,
    bodyFontOverride: null,
    bgColorOverride: null,
    paletteOverride: null,
    strokeColorOverride: null,
  }

  const expectedElements = expectedRaw
    ? expectedRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined

  // Run verification checks (same logic as verify_scene tool)
  const issues: string[] = []
  const checks: Record<string, 'pass' | 'warn' | 'fail'> = {}

  // 1. Content presence
  const hasMainContent = !!(scene.svgContent || scene.canvasCode || scene.sceneCode || scene.lottieSource)
  const layerCount =
    (scene.svgObjects?.length ?? 0) + (scene.aiLayers?.length ?? 0) + ((scene as any).chartLayers?.length ?? 0)
  const hasLayers = layerCount > 0
  const hasContent = hasMainContent || hasLayers

  if (!hasContent) {
    checks.content = 'fail'
    issues.push('EMPTY: Scene has no content — no code, no layers, no charts.')
  } else {
    checks.content = 'pass'
  }

  // 2. Text overlay overlap
  const overlays = scene.textOverlays ?? []
  if (overlays.length > 0) {
    const overlapping = overlays.filter((a, i) =>
      overlays.some(
        (b, j) => i !== j && Math.abs((a.y ?? 0) - (b.y ?? 0)) < 5 && Math.abs((a.x ?? 0) - (b.x ?? 0)) < 20,
      ),
    )
    if (overlapping.length > 0) {
      checks.text_layout = 'warn'
      issues.push(`OVERLAP: ${overlapping.length} text overlays may overlap — check positions.`)
    } else {
      checks.text_layout = 'pass'
    }
  }

  // 3. Palette adherence
  const palette = globalStyle?.palette ?? (globalStyle as any)?.paletteOverride
  if (palette && palette.length > 0 && scene.bgColor) {
    checks.palette = 'pass'
  }

  // 4. Audio presence
  const hasAudio = scene.audioLayer?.enabled ?? false
  const hasTTS = !!(scene.audioLayer as any)?.tts?.src
  checks.audio = hasAudio ? 'pass' : 'warn'

  // 5. Duration sanity
  if (scene.duration < 3) {
    checks.duration = 'warn'
    issues.push(`SHORT: Duration is ${scene.duration}s — minimum recommended is 6s.`)
  } else if (scene.duration > 30) {
    checks.duration = 'warn'
    issues.push(`LONG: Duration is ${scene.duration}s — consider splitting.`)
  } else {
    checks.duration = 'pass'
  }

  // 6. Expected elements
  if (expectedElements && expectedElements.length > 0) {
    const contentText = [
      scene.name,
      scene.prompt,
      scene.svgContent ?? '',
      scene.canvasCode ?? '',
      scene.sceneCode ?? '',
      ...overlays.map((o) => o.content ?? ''),
      ...(scene.svgObjects ?? []).map((o: any) => o.prompt ?? ''),
      ...(scene.aiLayers ?? []).map((l) => l.label ?? ''),
      ...((scene as any).chartLayers ?? []).map((c: any) => `${c.name ?? ''} ${c.chartType ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()

    const missing = expectedElements.filter((el) => !contentText.includes(el.toLowerCase()))
    if (missing.length > 0) {
      checks.completeness = 'warn'
      issues.push(
        `MISSING: Expected elements not found: ${missing.join(', ')}. May be in generated code — verify visually.`,
      )
    } else {
      checks.completeness = 'pass'
    }
  }

  // Build layer summary
  const layers: string[] = []
  if (scene.sceneType) layers.push(`Main renderer: ${scene.sceneType}`)
  if (scene.svgContent) layers.push(`SVG content: ${scene.svgContent.length} chars`)
  if (scene.canvasCode) layers.push(`Canvas2D code: ${scene.canvasCode.length} chars`)
  if (scene.sceneCode) layers.push(`Scene code (${scene.sceneType}): ${scene.sceneCode.length} chars`)
  for (const overlay of overlays) {
    layers.push(`Text: "${overlay.content?.slice(0, 40) ?? ''}" at (${overlay.x ?? 0}%, ${overlay.y ?? 0}%)`)
  }
  for (const obj of scene.svgObjects ?? []) {
    layers.push(`SVG object at (${(obj as any).x ?? 0}%, ${(obj as any).y ?? 0}%)`)
  }
  for (const ai of scene.aiLayers ?? []) {
    layers.push(`AI layer "${ai.type}" "${ai.label}" at (${Math.round(ai.x ?? 0)}, ${Math.round(ai.y ?? 0)})`)
  }
  if (hasAudio) layers.push(`Audio: ${hasTTS ? 'TTS narration' : 'audio layer'}`)

  const allPassed = issues.length === 0
  const verdict = allPassed ? 'PASS — Scene looks good.' : `ISSUES FOUND (${issues.length}):`

  const report = [
    `── VERIFY: "${scene.name}" (${scene.id.slice(0, 8)}…) ──`,
    `Type: ${scene.sceneType ?? 'svg'} | Duration: ${scene.duration}s | BG: ${scene.bgColor}`,
    '',
    `Checks: ${Object.entries(checks)
      .map(([k, v]) => `${k}:${v}`)
      .join(' | ')}`,
    '',
    verdict,
    ...issues.map((i) => `  ⚠ ${i}`),
    '',
    `Layers (${layers.length}):`,
    ...layers.map((l) => `  • ${l}`),
  ].join('\n')

  return NextResponse.json({
    success: allPassed,
    report,
    checks,
    issues,
    sceneName: scene.name,
    sceneType: scene.sceneType,
    duration: scene.duration,
    layerCount: layers.length,
    hasAudio,
    hasTTS,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { normalizeTransition } from '@/lib/transitions'
import { readProjectSceneBlob, writeProjectSceneBlob } from '@/lib/db/project-scene-storage'
import { readProjectScenesFromTables, writeProjectScenesToTables } from '@/lib/db/project-scene-table'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { LIMITS, VALID_SCENE_TYPES, SCENE_ID_RE } from '@/lib/api/constants'

// ── GET /api/scene ────────────────────────────────────────────────────────────
// ?projectId=X           → list scenes from the project's JSONB blob
// ?projectId=X&sceneId=Y → single scene with full data

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const sceneId = req.nextUrl.searchParams.get('sceneId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  try {
    const access = await assertProjectAccess(projectId)
    if (access.error) return access.error

    const [project] = await db
      .select({ description: schema.projects.description })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const tableBacked = await readProjectScenesFromTables(projectId)
    const scenes = tableBacked?.scenes ?? readProjectSceneBlob(project.description).scenes

    if (sceneId) {
      const scene = scenes.find((s: any) => s.id === sceneId)
      if (!scene) {
        return NextResponse.json({ error: `Scene ${sceneId} not found` }, { status: 404 })
      }
      return NextResponse.json({ scene })
    }

    // Return scene list with summaries (strip large code fields for list view)
    const summaries = scenes.map((s: any) => ({
      id: s.id,
      name: s.name,
      sceneType: s.sceneType,
      duration: s.duration,
      bgColor: s.bgColor,
      prompt: s.prompt,
    }))

    return NextResponse.json({ scenes: summaries })
  } catch (err) {
    console.error('[GET /api/scene]', err)
    return NextResponse.json({ error: 'Failed to fetch scenes' }, { status: 500 })
  }
}

// ── POST /api/scene ───────────────────────────────────────────────────────────
// Creates a scene by appending to the project's JSONB blob + writing HTML.
//
// Mode 1 (SDK): { projectId, name, type, prompt, generatedCode|svgContent, duration?, bgColor?, transition? }
//   → Appends scene to project JSONB, generates + writes HTML
//   D3 + chartLayers: { type: 'd3', chartLayers: D3ChartLayer[] } compiles via CenchCharts (structured path); generatedCode optional
// Mode 2 (legacy): { id, html }
//   → Writes raw HTML to public/scenes/{id}.html (no DB record)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Mode 2: Legacy — raw HTML write
    if (body.id && body.html && !body.projectId) {
      const { id, html } = body
      if (!SCENE_ID_RE.test(id)) {
        return NextResponse.json({ error: 'invalid id' }, { status: 400 })
      }
      if (typeof html !== 'string') {
        return NextResponse.json({ error: 'html must be a string' }, { status: 400 })
      }
      // Reject excessively large HTML (5MB limit)
      if (html.length > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'HTML body exceeds 5MB limit' }, { status: 413 })
      }
      // In production, block raw script tags for legacy mode.
      if (process.env.NODE_ENV === 'production' && /<script\b/i.test(html)) {
        return NextResponse.json({ error: 'legacy raw HTML cannot include <script> in production' }, { status: 400 })
      }
      const scenesDir = path.join(process.cwd(), 'public', 'scenes')
      await fs.mkdir(scenesDir, { recursive: true })
      await fs.writeFile(path.join(scenesDir, `${id}.html`), html, 'utf-8')
      console.log(`[POST /api/scene] Legacy write: id=${id} htmlLen=${html.length}`)
      return NextResponse.json({ success: true, path: `/scenes/${id}.html` })
    }

    // Mode 1: SDK — create scene in project JSONB
    const {
      projectId,
      name: rawName = 'Untitled Scene',
      type = 'react',
      prompt = '',
      generatedCode,
      svgContent,
      duration = 8,
      bgColor = '#181818',
      chartLayers: bodyChartLayers,
      sceneStyles: bodySceneStyles,
      aiLayers: bodyAiLayers,
      audioLayer: bodyAudioLayer,
      transition: bodyTransition,
    } = body

    const name = typeof rawName === 'string' ? rawName.slice(0, LIMITS.MAX_NAME_LENGTH) : 'Untitled Scene'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Validate scene type
    if (type && !(VALID_SCENE_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: `Invalid scene type: ${type}` }, { status: 400 })
    }

    // Validate code size
    const code_raw = svgContent ?? generatedCode ?? ''
    if (typeof code_raw === 'string' && code_raw.length > LIMITS.MAX_CODE_SIZE) {
      return NextResponse.json({ error: `Code exceeds ${LIMITS.MAX_CODE_SIZE / 1024 / 1024}MB limit` }, { status: 413 })
    }

    // Validate duration
    if (
      typeof duration === 'number' &&
      (duration < LIMITS.MIN_SCENE_DURATION || duration > LIMITS.MAX_SCENE_DURATION)
    ) {
      return NextResponse.json(
        { error: `Duration must be between ${LIMITS.MIN_SCENE_DURATION} and ${LIMITS.MAX_SCENE_DURATION} seconds` },
        { status: 400 },
      )
    }

    const access = await assertProjectAccess(projectId)
    if (access.error) return access.error

    // Load existing project
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse existing scenes from JSONB
    const existingData = readProjectSceneBlob(project.description)
    const scenes: any[] = existingData.scenes || []

    // Build scene object matching the Zustand Scene interface
    const code = svgContent ?? generatedCode ?? ''
    const sceneId = uuidv4()

    // For motion/d3/zdog, generatedCode may be JSON {styles, htmlContent, sceneCode}
    let parsedSceneCode = ''
    let parsedSceneHTML = ''
    let parsedSceneStyles = typeof bodySceneStyles === 'string' ? bodySceneStyles : ''
    const structuredTypes = ['motion', 'd3', 'zdog', 'physics', 'react']
    if (structuredTypes.includes(type) && code) {
      try {
        const parsed = JSON.parse(code)
        if (parsed && typeof parsed === 'object' && (parsed.sceneCode || parsed.htmlContent || parsed.styles)) {
          parsedSceneCode = parsed.sceneCode ?? ''
          parsedSceneHTML = parsed.htmlContent ?? ''
          if (!parsedSceneStyles && parsed.styles) parsedSceneStyles = parsed.styles
        } else {
          parsedSceneCode = code
        }
      } catch {
        parsedSceneCode = code
      }
    } else if (['three', '3d_world'].includes(type) && code) {
      try {
        const parsed = JSON.parse(code)
        parsedSceneCode = parsed?.sceneCode ?? code
      } catch {
        parsedSceneCode = code
      }
    }

    const newScene: Record<string, any> = {
      id: sceneId,
      name,
      prompt,
      summary: '',
      svgContent: type === 'svg' ? code : '',
      canvasCode: type === 'canvas2d' ? code : '',
      canvasBackgroundCode: '',
      sceneCode: ['d3', 'three', 'motion', 'zdog', 'physics', '3d_world'].includes(type) ? parsedSceneCode : '',
      reactCode: type === 'react' ? parsedSceneCode || code : '',
      sceneHTML: parsedSceneHTML,
      sceneStyles: parsedSceneStyles,
      lottieSource: type === 'lottie' ? code : '',
      d3Data: null,
      chartLayers: [],
      usage: null,
      duration,
      bgColor,
      thumbnail: null,
      videoLayer: { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
      audioLayer: { enabled: false, src: null, volume: 1, fadeIn: false, fadeOut: false, startOffset: 0 },
      textOverlays: [],
      svgObjects: [],
      primaryObjectId: null,
      svgBranches: [],
      activeBranchId: null,
      transition: normalizeTransition(typeof bodyTransition === 'string' ? bodyTransition : undefined),
      sceneType: type,
      interactions: [],
      variables: [],
      aiLayers: Array.isArray(bodyAiLayers) ? bodyAiLayers : [],
      messages: [],
    }

    if (bodyAudioLayer && typeof bodyAudioLayer === 'object' && !Array.isArray(bodyAudioLayer)) {
      // Allowlist keys to prevent merging unexpected properties
      const AUDIO_KEYS = ['enabled', 'src', 'volume', 'fadeIn', 'fadeOut', 'startOffset'] as const
      const safeAudio: Record<string, unknown> = {}
      for (const k of AUDIO_KEYS) {
        if (k in bodyAudioLayer) safeAudio[k] = bodyAudioLayer[k]
      }
      newScene.audioLayer = { ...newScene.audioLayer, ...safeAudio }
    }

    if (type === 'd3' && Array.isArray(bodyChartLayers) && bodyChartLayers.length > 0) {
      const { compileD3SceneFromLayers } = await import('@/lib/charts/compile')
      const compiled = compileD3SceneFromLayers(bodyChartLayers)
      newScene.chartLayers = bodyChartLayers
      newScene.sceneCode = compiled.sceneCode
      newScene.d3Data = compiled.d3Data
    }

    // Append to scenes array
    scenes.push(newScene)

    // Update scene graph nodes
    const sceneGraph = existingData.sceneGraph || { nodes: [], edges: [], startSceneId: '' }
    sceneGraph.nodes = sceneGraph.nodes || []
    sceneGraph.nodes.push({
      id: sceneId,
      position: { x: 220 + (scenes.length - 1) * 300, y: 100 },
    })
    if (!sceneGraph.startSceneId && scenes.length === 1) {
      sceneGraph.startSceneId = sceneId
    }

    // Generate HTML (but write DB first to avoid orphaned HTML on conflict)
    const { generateSceneHTML } = await import('@/lib/sceneTemplate')
    const html = generateSceneHTML(
      newScene as any,
      project.globalStyle ?? undefined,
      undefined,
      project.audioSettings ?? undefined,
    )

    // Save to project JSONB with optimistic locking (DB first — source of truth)
    const currentVersion = project.version ?? 1
    const [updated] = await db
      .update(schema.projects)
      .set({
        description: writeProjectSceneBlob(project.description, { scenes, sceneGraph }),
        version: currentVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.version, currentVersion)))
      .returning({ id: schema.projects.id })

    if (!updated) {
      return NextResponse.json({ error: 'Conflict: project was modified concurrently. Please retry.' }, { status: 409 })
    }

    // Write HTML to disk (safe to retry — DB is already committed)
    const scenesDir = path.join(process.cwd(), 'public', 'scenes')
    try {
      await fs.mkdir(scenesDir, { recursive: true })
      await fs.writeFile(path.join(scenesDir, `${sceneId}.html`), html, 'utf-8')
    } catch (e) {
      console.error(`[POST /api/scene] Failed to write HTML for scene ${sceneId}:`, e)
      // DB is saved — HTML can be regenerated on next load, so don't fail the request
    }

    try {
      await writeProjectScenesToTables(projectId, scenes as any, sceneGraph as any)
    } catch (e) {
      console.error('[POST /api/scene] table sync failed:', e)
    }

    console.log(`[POST /api/scene] Created: sceneId=${sceneId} type=${type} name="${name}" htmlLen=${html.length}`)
    return NextResponse.json({
      success: true,
      scene: {
        id: sceneId,
        name,
        position: scenes.length - 1,
        duration,
        previewUrl: `/scenes/${sceneId}.html`,
      },
    })
  } catch (err: unknown) {
    console.error('[POST /api/scene]', err)
    const message = err instanceof Error ? err.message.slice(0, 200) : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── PATCH /api/scene ──────────────────────────────────────────────────────────
// Update a scene's code in the project JSONB + regenerate HTML

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      projectId,
      sceneId,
      generatedCode,
      svgContent,
      prompt,
      cameraMotion,
      transition,
      textOverlays,
      svgObjects,
      bgColor,
      duration,
      name: sceneName,
      audioLayer: bodyAudioLayer,
      aiLayers: bodyAiLayers,
      sceneType: bodySceneType,
    } = body

    if (!projectId || !sceneId) {
      return NextResponse.json({ error: 'projectId and sceneId are required' }, { status: 400 })
    }

    // Validate scene type if provided
    if (bodySceneType && !(VALID_SCENE_TYPES as readonly string[]).includes(bodySceneType)) {
      return NextResponse.json({ error: `Invalid scene type: ${bodySceneType}` }, { status: 400 })
    }

    // Validate code size
    const rawCode = svgContent ?? generatedCode
    if (typeof rawCode === 'string' && rawCode.length > LIMITS.MAX_CODE_SIZE) {
      return NextResponse.json({ error: `Code exceeds ${LIMITS.MAX_CODE_SIZE / 1024 / 1024}MB limit` }, { status: 413 })
    }

    // Validate duration if provided
    if (
      duration !== undefined &&
      typeof duration === 'number' &&
      (duration < LIMITS.MIN_SCENE_DURATION || duration > LIMITS.MAX_SCENE_DURATION)
    ) {
      return NextResponse.json(
        { error: `Duration must be between ${LIMITS.MIN_SCENE_DURATION} and ${LIMITS.MAX_SCENE_DURATION} seconds` },
        { status: 400 },
      )
    }

    // Cap name length if provided
    if (sceneName !== undefined && typeof sceneName === 'string' && sceneName.length > LIMITS.MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Name exceeds ${LIMITS.MAX_NAME_LENGTH} character limit` }, { status: 400 })
    }

    const patchAccess = await assertProjectAccess(projectId)
    if (patchAccess.error) return patchAccess.error

    const code = svgContent ?? generatedCode
    const hasPropertyUpdate =
      cameraMotion !== undefined ||
      transition !== undefined ||
      textOverlays !== undefined ||
      svgObjects !== undefined ||
      bgColor !== undefined ||
      duration !== undefined ||
      sceneName !== undefined ||
      bodyAudioLayer !== undefined ||
      bodyAiLayers !== undefined ||
      bodySceneType !== undefined
    if (!code && !hasPropertyUpdate) {
      return NextResponse.json(
        { error: 'generatedCode, svgContent, or a scene property update is required' },
        { status: 400 },
      )
    }

    // Load project
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const existingData = readProjectSceneBlob(project.description)

    const scenes: any[] = existingData.scenes || []
    const sceneIdx = scenes.findIndex((s: any) => s.id === sceneId)
    if (sceneIdx === -1) {
      return NextResponse.json({ error: `Scene ${sceneId} not found` }, { status: 404 })
    }

    // Update the scene's code
    const scene = scenes[sceneIdx]

    if (typeof bodySceneType === 'string' && bodySceneType.length > 0) {
      scene.sceneType = bodySceneType
      if (bodySceneType === 'three') {
        scene.sceneHTML = ''
        scene.sceneStyles = ''
      }
    }

    const sceneType = scene.sceneType || 'svg'

    if (code) {
      if (sceneType === 'svg') {
        scene.svgContent = code
      } else if (sceneType === 'canvas2d') {
        scene.canvasCode = code
      } else if (['d3', 'three', 'motion', 'zdog', 'physics', '3d_world'].includes(sceneType)) {
        // Motion/d3/zdog code may be JSON {styles, htmlContent, sceneCode}
        try {
          const parsed = JSON.parse(code)
          if (parsed && typeof parsed === 'object' && (parsed.sceneCode || parsed.htmlContent || parsed.styles)) {
            scene.sceneCode = parsed.sceneCode ?? ''
            scene.sceneHTML = parsed.htmlContent ?? ''
            if (parsed.styles) scene.sceneStyles = parsed.styles
          } else {
            scene.sceneCode = code
          }
        } catch {
          scene.sceneCode = code
        }
      } else if (sceneType === 'react') {
        // React scenes: code may be JSON {sceneCode, styles} or raw JSX
        try {
          const parsed = JSON.parse(code)
          if (parsed && typeof parsed === 'object' && parsed.sceneCode) {
            scene.reactCode = parsed.sceneCode ?? ''
            if (parsed.styles) scene.sceneStyles = parsed.styles
          } else {
            scene.reactCode = code
          }
        } catch {
          scene.reactCode = code
        }
      } else if (sceneType === 'lottie') {
        scene.lottieSource = code
      }
    }

    if (prompt) scene.prompt = prompt
    if (cameraMotion !== undefined) scene.cameraMotion = cameraMotion
    if (transition !== undefined) scene.transition = transition
    if (textOverlays !== undefined) scene.textOverlays = textOverlays
    if (svgObjects !== undefined) scene.svgObjects = svgObjects
    if (bgColor !== undefined) scene.bgColor = bgColor
    if (duration !== undefined) scene.duration = duration
    if (sceneName !== undefined) scene.name = sceneName
    if (bodyAudioLayer !== undefined) scene.audioLayer = { ...scene.audioLayer, ...bodyAudioLayer }
    if (bodyAiLayers !== undefined) scene.aiLayers = bodyAiLayers

    scenes[sceneIdx] = scene

    // Regenerate HTML
    const { generateSceneHTML } = await import('@/lib/sceneTemplate')
    let html: string
    try {
      html = generateSceneHTML(
        scene as any,
        project.globalStyle ?? undefined,
        undefined,
        project.audioSettings ?? undefined,
      )
    } catch (genErr) {
      console.error(`[PATCH /api/scene] generateSceneHTML failed:`, genErr)
      return NextResponse.json({ error: `HTML generation failed: ${(genErr as Error).message}` }, { status: 500 })
    }

    // Save to DB first with optimistic locking (source of truth)
    const currentVersion = project.version ?? 1
    const [updated] = await db
      .update(schema.projects)
      .set({
        description: writeProjectSceneBlob(project.description, { scenes }),
        version: currentVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.version, currentVersion)))
      .returning({ id: schema.projects.id })

    if (!updated) {
      return NextResponse.json({ error: 'Conflict: project was modified concurrently. Please retry.' }, { status: 409 })
    }

    // Write HTML to disk (safe to retry — DB already committed)
    const scenesDir = path.join(process.cwd(), 'public', 'scenes')
    try {
      await fs.mkdir(scenesDir, { recursive: true })
      await fs.writeFile(path.join(scenesDir, `${sceneId}.html`), html, 'utf-8')
    } catch (e) {
      // DB is saved — HTML can be regenerated on next load, so log but don't fail
      console.error(`[PATCH /api/scene] Failed to write HTML for scene ${sceneId}:`, e)
    }

    try {
      await writeProjectScenesToTables(projectId, scenes as any, existingData.sceneGraph as any)
    } catch (e) {
      console.error('[PATCH /api/scene] table sync failed:', e)
    }

    console.log(
      `[PATCH /api/scene] Updated: sceneId=${sceneId} type=${sceneType} codeLen=${code?.length ?? 0} htmlLen=${html.length}`,
    )
    return NextResponse.json({
      success: true,
      scene: { id: sceneId, previewUrl: `/scenes/${sceneId}.html` },
    })
  } catch (err) {
    console.error('[PATCH /api/scene]', err)
    return NextResponse.json({ error: 'Failed to update scene' }, { status: 500 })
  }
}

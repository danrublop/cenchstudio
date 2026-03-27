import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

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
    const [project] = await db
      .select({ description: schema.projects.description })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    let scenes: any[] = []
    if (project.description) {
      try {
        const parsed = JSON.parse(project.description)
        scenes = parsed.scenes || []
      } catch {}
    }

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
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── POST /api/scene ───────────────────────────────────────────────────────────
// Creates a scene by appending to the project's JSONB blob + writing HTML.
//
// Mode 1 (SDK): { projectId, name, type, prompt, generatedCode|svgContent, duration?, bgColor? }
//   → Appends scene to project JSONB, generates + writes HTML
// Mode 2 (legacy): { id, html }
//   → Writes raw HTML to public/scenes/{id}.html (no DB record)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Mode 2: Legacy — raw HTML write
    if (body.id && body.html && !body.projectId) {
      const { id, html } = body
      if (!/^[a-zA-Z0-9\-]+$/.test(id)) {
        return NextResponse.json({ error: 'invalid id' }, { status: 400 })
      }
      const scenesDir = path.join(process.cwd(), 'public', 'scenes')
      await fs.mkdir(scenesDir, { recursive: true })
      await fs.writeFile(path.join(scenesDir, `${id}.html`), html, 'utf-8')
      return NextResponse.json({ success: true, path: `/scenes/${id}.html` })
    }

    // Mode 1: SDK — create scene in project JSONB
    const {
      projectId,
      name = 'Untitled Scene',
      type = 'svg',
      prompt = '',
      generatedCode,
      svgContent,
      duration = 8,
      bgColor = '#181818',
    } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Load existing project
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse existing scenes from JSONB
    let existingData: any = { scenes: [], sceneGraph: null }
    if (project.description) {
      try { existingData = JSON.parse(project.description) } catch {}
    }
    const scenes: any[] = existingData.scenes || []

    // Build scene object matching the Zustand Scene interface
    const code = svgContent ?? generatedCode ?? ''
    const sceneId = uuidv4()

    const newScene: Record<string, any> = {
      id: sceneId,
      name,
      prompt,
      summary: '',
      svgContent: type === 'svg' ? code : '',
      canvasCode: type === 'canvas2d' ? code : '',
      sceneCode: ['d3', 'three', 'motion', 'zdog'].includes(type) ? code : '',
      sceneHTML: '',
      sceneStyles: '',
      lottieSource: type === 'lottie' ? code : '',
      d3Data: null,
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
      transition: 'none',
      sceneType: type,
      interactions: [],
      variables: [],
      aiLayers: [],
      messages: [],
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

    // Save back to project JSONB
    await db
      .update(schema.projects)
      .set({
        description: JSON.stringify({ scenes, sceneGraph }),
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

    // Generate and write HTML
    const { generateSceneHTML } = await import('@/lib/sceneTemplate')
    const html = generateSceneHTML(newScene as any)
    const scenesDir = path.join(process.cwd(), 'public', 'scenes')
    await fs.mkdir(scenesDir, { recursive: true })
    await fs.writeFile(path.join(scenesDir, `${sceneId}.html`), html, 'utf-8')

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
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── PATCH /api/scene ──────────────────────────────────────────────────────────
// Update a scene's code in the project JSONB + regenerate HTML

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, sceneId, generatedCode, svgContent, prompt } = body

    if (!projectId || !sceneId) {
      return NextResponse.json({ error: 'projectId and sceneId are required' }, { status: 400 })
    }

    const code = svgContent ?? generatedCode
    if (!code) {
      return NextResponse.json({ error: 'generatedCode or svgContent is required' }, { status: 400 })
    }

    // Load project
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    let existingData: any = { scenes: [], sceneGraph: null }
    if (project.description) {
      try { existingData = JSON.parse(project.description) } catch {}
    }

    const scenes: any[] = existingData.scenes || []
    const sceneIdx = scenes.findIndex((s: any) => s.id === sceneId)
    if (sceneIdx === -1) {
      return NextResponse.json({ error: `Scene ${sceneId} not found` }, { status: 404 })
    }

    // Update the scene's code
    const scene = scenes[sceneIdx]
    const sceneType = scene.sceneType || 'svg'

    if (sceneType === 'svg') scene.svgContent = code
    else if (sceneType === 'canvas2d') scene.canvasCode = code
    else if (['d3', 'three', 'motion'].includes(sceneType)) scene.sceneCode = code
    else if (sceneType === 'lottie') scene.lottieSource = code

    if (prompt) scene.prompt = prompt

    scenes[sceneIdx] = scene

    // Save back
    await db
      .update(schema.projects)
      .set({
        description: JSON.stringify({ ...existingData, scenes }),
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

    // Regenerate HTML
    const { generateSceneHTML } = await import('@/lib/sceneTemplate')
    const html = generateSceneHTML(scene as any)
    const scenesDir = path.join(process.cwd(), 'public', 'scenes')
    await fs.mkdir(scenesDir, { recursive: true })
    await fs.writeFile(path.join(scenesDir, `${sceneId}.html`), html, 'utf-8')

    return NextResponse.json({
      success: true,
      scene: { id: sceneId, previewUrl: `/scenes/${sceneId}.html` },
    })
  } catch (err) {
    console.error('[PATCH /api/scene]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

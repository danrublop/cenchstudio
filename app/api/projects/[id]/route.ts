import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET: load a single project with full data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse scene data from description field
    let scenes: any[] = []
    let sceneGraph: any = null
    if (project.description) {
      try {
        const parsed = JSON.parse(project.description)
        scenes = parsed.scenes || []
        sceneGraph = parsed.sceneGraph || null
      } catch {
        // description is just a plain string, not JSON
      }
    }

    return NextResponse.json({
      ...project,
      scenes,
      sceneGraph,
    })
  } catch (error: any) {
    console.error('Failed to load project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH: save/update a project
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, outputMode, globalStyle, mp4Settings, interactiveSettings, scenes, sceneGraph, apiPermissions, thumbnailUrl } = body

    const updateData: Record<string, any> = { updatedAt: new Date() }
    if (name !== undefined) updateData.name = name
    if (outputMode !== undefined) updateData.outputMode = outputMode
    if (globalStyle !== undefined) updateData.globalStyle = globalStyle
    if (mp4Settings !== undefined) updateData.mp4Settings = mp4Settings
    if (interactiveSettings !== undefined) updateData.interactiveSettings = interactiveSettings
    if (apiPermissions !== undefined) updateData.apiPermissions = apiPermissions
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
    if (scenes !== undefined || sceneGraph !== undefined) {
      // Load existing scene data to merge
      const [existing] = await db.select({ description: projects.description }).from(projects).where(eq(projects.id, id))
      let existingData: any = {}
      if (existing?.description) {
        try { existingData = JSON.parse(existing.description) } catch {}
      }
      updateData.description = JSON.stringify({
        scenes: scenes !== undefined ? scenes : (existingData.scenes || []),
        sceneGraph: sceneGraph !== undefined ? sceneGraph : (existingData.sceneGraph || null),
      })
    }

    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error: any) {
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: delete a project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(projects).where(eq(projects.id, id))
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

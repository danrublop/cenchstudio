import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { desc, isNull } from 'drizzle-orm'

// GET: list all projects (local mode = no userId)
export async function GET() {
  try {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        outputMode: projects.outputMode,
        thumbnailUrl: projects.thumbnailUrl,
        updatedAt: projects.updatedAt,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(isNull(projects.userId))
      .orderBy(desc(projects.updatedAt))
      .limit(50)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to list projects:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name, outputMode, globalStyle, mp4Settings, interactiveSettings, scenes, sceneGraph, apiPermissions } = body

    const [project] = await db
      .insert(projects)
      .values({
        ...(id ? { id } : {}),
        name: name || 'Untitled Project',
        outputMode: outputMode || 'mp4',
        globalStyle: globalStyle || undefined,
        mp4Settings: mp4Settings || undefined,
        interactiveSettings: interactiveSettings || undefined,
        apiPermissions: apiPermissions || {},
        // Store full scene data as JSONB for easy round-trip with Zustand
        description: JSON.stringify({ scenes: scenes || [], sceneGraph: sceneGraph || null }),
      })
      .returning()

    return NextResponse.json(project)
  } catch (error: any) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

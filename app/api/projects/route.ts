import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { desc, isNull, lt, and, sql } from 'drizzle-orm'

// GET: list projects with optional cursor-based pagination
// Without params: returns flat array (backward-compatible)
// ?limit=N&cursor=<ISO timestamp>: returns { items, nextCursor }
export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit')
    const cursor = req.nextUrl.searchParams.get('cursor')
    const paginated = limitParam !== null || cursor !== null
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100)

    const conditions = [isNull(projects.userId)]
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(projects.updatedAt, cursorDate))
      }
    }

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
      .where(and(...conditions))
      .orderBy(desc(projects.updatedAt))
      .limit(paginated ? limit + 1 : limit)

    if (!paginated) {
      return NextResponse.json(result)
    }

    const hasMore = result.length > limit
    const items = hasMore ? result.slice(0, limit) : result
    const nextCursor = hasMore ? items[items.length - 1].updatedAt?.toISOString() : null
    return NextResponse.json({ items, nextCursor })
  } catch (error: any) {
    console.error('Failed to list projects:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      name,
      outputMode,
      globalStyle,
      mp4Settings,
      interactiveSettings,
      scenes,
      sceneGraph,
      apiPermissions,
      audioSettings,
      audioProviderEnabled,
      mediaGenEnabled,
      timeline,
    } = body

    // Validate outputMode if provided
    if (outputMode && !['mp4', 'interactive'].includes(outputMode)) {
      return NextResponse.json(
        { error: `Invalid outputMode: ${outputMode}. Must be 'mp4' or 'interactive'.` },
        { status: 400 },
      )
    }

    // Validate scenes is an array if provided
    if (scenes && !Array.isArray(scenes)) {
      return NextResponse.json({ error: 'scenes must be an array' }, { status: 400 })
    }

    const [project] = await db
      .insert(projects)
      .values({
        ...(id ? { id } : {}),
        name: (name || 'Untitled Project').slice(0, 255),
        outputMode: outputMode || 'mp4',
        globalStyle: globalStyle || undefined,
        mp4Settings: mp4Settings || undefined,
        interactiveSettings: interactiveSettings || undefined,
        apiPermissions: apiPermissions || {},
        audioSettings: audioSettings || undefined,
        audioProviderEnabled: audioProviderEnabled || {},
        mediaGenEnabled: mediaGenEnabled || {},
        // Store full scene data as JSONB for easy round-trip with Zustand
        description: JSON.stringify({
          scenes: scenes || [],
          sceneGraph: sceneGraph || null,
          timeline: timeline || null,
        }),
      })
      .returning()

    return NextResponse.json(project)
  } catch (error: any) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

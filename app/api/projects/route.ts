import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { desc, eq, isNull, lt, and, or, SQL } from 'drizzle-orm'
import { getOptionalUser } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.projects-list')

/**
 * Guest projects (userId NULL) are hidden from logged-in users by default so lists stay per-user.
 * In development, also list unowned projects so scenes added via unauthenticated API calls still appear.
 * Production override: AUTH_LIST_INCLUDES_GUEST_PROJECTS=true (single-tenant / support).
 * Opt out in dev: AUTH_LIST_INCLUDES_GUEST_PROJECTS=false
 */
function includeGuestProjectsAlongsideOwned(): boolean {
  if (process.env.AUTH_LIST_INCLUDES_GUEST_PROJECTS === 'true') return true
  if (process.env.AUTH_LIST_INCLUDES_GUEST_PROJECTS === 'false') return false
  return process.env.NODE_ENV === 'development'
}

// GET: list projects with optional cursor-based pagination
// Without params: returns flat array (backward-compatible)
// ?limit=N&cursor=<ISO timestamp>: returns { items, nextCursor }
export async function GET(req: NextRequest) {
  try {
    const user = await getOptionalUser()
    const limitParam = req.nextUrl.searchParams.get('limit')
    const cursor = req.nextUrl.searchParams.get('cursor')
    const workspaceIdParam = req.nextUrl.searchParams.get('workspaceId')
    const paginated = limitParam !== null || cursor !== null
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100)

    const ownerFilter = !user
      ? isNull(projects.userId)
      : includeGuestProjectsAlongsideOwned()
        ? or(eq(projects.userId, user.id), isNull(projects.userId))
        : eq(projects.userId, user.id)

    const conditions: (SQL | undefined)[] = [ownerFilter]

    // Workspace filtering: ?workspaceId=<uuid> or ?workspaceId=none
    if (workspaceIdParam === 'none') {
      conditions.push(isNull(projects.workspaceId))
    } else if (workspaceIdParam) {
      conditions.push(eq(projects.workspaceId, workspaceIdParam))
    }

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
        workspaceId: projects.workspaceId,
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
    log.error('Failed to list projects:', { error: error })
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 })
  }
}

// POST: create a new project
export async function POST(req: NextRequest) {
  try {
    const user = await getOptionalUser()
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
      workspaceId,
    } = body

    // Validate outputMode if provided
    if (outputMode && !['mp4', 'interactive'].includes(outputMode)) {
      return NextResponse.json(
        { error: `Invalid outputMode: ${outputMode}. Must be 'mp4' or 'interactive'.` },
        { status: 400 },
      )
    }

    // Validate scenes is an array if provided, with size bounds
    if (scenes && !Array.isArray(scenes)) {
      return NextResponse.json({ error: 'scenes must be an array' }, { status: 400 })
    }
    if (scenes && scenes.length > 200) {
      return NextResponse.json({ error: 'scenes array exceeds 200 item limit' }, { status: 413 })
    }
    // Cap sceneGraph nodes
    if (sceneGraph?.nodes && Array.isArray(sceneGraph.nodes) && sceneGraph.nodes.length > 200) {
      return NextResponse.json({ error: 'sceneGraph.nodes exceeds 200 item limit' }, { status: 413 })
    }

    const [project] = await db
      .insert(projects)
      .values({
        ...(id ? { id } : {}),
        userId: user?.id ?? null,
        workspaceId: workspaceId || null,
        name: (name || 'Untitled Project').slice(0, 255),
        outputMode: outputMode || 'mp4',
        globalStyle: globalStyle || {
          presetId: null,
          paletteOverride: null,
          bgColorOverride: null,
          fontOverride: null,
          bodyFontOverride: null,
          strokeColorOverride: null,
        },
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
    log.error('Failed to create project:', { error: error })
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

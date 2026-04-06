import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq, isNull, inArray, and } from 'drizzle-orm'
import { getRequiredUser, AuthError } from '@/lib/auth-helpers'

/**
 * POST /api/projects/claim
 * Transfers guest projects (userId=NULL) to the authenticated user.
 * Used after first login to claim projects created in guest mode.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequiredUser()
    const { projectIds } = await req.json()

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'projectIds must be a non-empty array' }, { status: 400 })
    }

    if (projectIds.length > 50) {
      return NextResponse.json({ error: 'Cannot claim more than 50 projects at once' }, { status: 400 })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!projectIds.every((id: unknown) => typeof id === 'string' && uuidRegex.test(id))) {
      return NextResponse.json({ error: 'All projectIds must be valid UUIDs' }, { status: 400 })
    }

    // Only claim projects that have no owner (guest projects)
    const result = await db
      .update(projects)
      .set({ userId: user.id, updatedAt: new Date() })
      .where(and(inArray(projects.id, projectIds), isNull(projects.userId)))
      .returning({ id: projects.id })

    return NextResponse.json({ claimed: result.map((r) => r.id) })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to claim projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

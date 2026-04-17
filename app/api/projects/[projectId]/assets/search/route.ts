import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import { and, eq, desc, sql } from 'drizzle-orm'
import { assertProjectAccess } from '@/lib/auth-helpers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/projects/:projectId/assets/search
//   ?type=image|video|svg
//   &source=upload|generated
//   &promptContains=substring
//   &tag=logo
//   &limit=1..50
//
// Powers both the Media tab's Gallery filter UI and the agent's
// `query_media_library` tool when world.projectAssets isn't hydrated.
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 })
  }

  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  const url = req.nextUrl.searchParams
  const type = url.get('type')
  const source = url.get('source')
  const promptContains = (url.get('promptContains') ?? '').trim()
  const tag = (url.get('tag') ?? '').trim()
  const limitRaw = parseInt(url.get('limit') ?? '25', 10)
  const limit = Math.min(50, Math.max(1, Number.isNaN(limitRaw) ? 25 : limitRaw))

  const conds = [eq(projectAssets.projectId, projectId)]
  if (type && ['image', 'video', 'svg'].includes(type)) conds.push(eq(projectAssets.type, type))
  if (source === 'upload' || source === 'generated') conds.push(eq(projectAssets.source, source))
  if (promptContains) conds.push(sql`LOWER(${projectAssets.prompt}) LIKE ${'%' + promptContains.toLowerCase() + '%'}`)
  if (tag) conds.push(sql`${tag} = ANY(${projectAssets.tags})`)

  try {
    const rows = await db
      .select()
      .from(projectAssets)
      .where(and(...conds))
      .orderBy(desc(projectAssets.createdAt))
      .limit(limit)
    return NextResponse.json({ assets: rows, count: rows.length })
  } catch (err) {
    console.error('[assets-search] error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getProjectConversations, createConversation } from '@/lib/db/queries/conversations'
import { assertProjectAccess } from '@/lib/auth-helpers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TITLE_LENGTH = 500

// GET /api/conversations?projectId=X — list conversations with previews
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId || !UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 })
  }

  const access = await assertProjectAccess(projectId)
  if (access.error) return access.error

  try {
    const convs = await getProjectConversations(projectId)
    return NextResponse.json({ conversations: convs })
  } catch (err) {
    console.error('[conversations] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

// POST /api/conversations — create new conversation
export async function POST(req: NextRequest) {
  try {
    const { projectId, title } = await req.json()
    if (!projectId || !UUID_RE.test(projectId)) {
      return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 })
    }

    const access = await assertProjectAccess(projectId)
    if (access.error) return access.error

    if (title !== undefined) {
      if (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json({ error: `title must be a string under ${MAX_TITLE_LENGTH} chars` }, { status: 400 })
      }
    }
    const conv = await createConversation({ projectId, title })
    return NextResponse.json({ conversation: conv })
  } catch (err) {
    console.error('[conversations] POST error:', err)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

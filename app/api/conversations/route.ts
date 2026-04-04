import { NextRequest, NextResponse } from 'next/server'
import { getProjectConversations, createConversation } from '@/lib/db/queries/conversations'

// GET /api/conversations?projectId=X — list conversations with previews
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

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
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    const conv = await createConversation({ projectId, title })
    return NextResponse.json({ conversation: conv })
  } catch (err) {
    console.error('[conversations] POST error:', err)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

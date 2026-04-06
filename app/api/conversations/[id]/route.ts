import { NextRequest, NextResponse } from 'next/server'
import { updateConversation, deleteConversation, getConversationMessages } from '@/lib/db/queries/conversations'
import { assertConversationAccess } from '@/lib/auth-helpers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TITLE_LENGTH = 500

// GET /api/conversations/[id] — conversation details + messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }
  try {
    const access = await assertConversationAccess(id)
    if (access.error) return access.error

    const msgs = await getConversationMessages(id)
    return NextResponse.json({ conversation: access.conversation, messages: msgs })
  } catch (err) {
    console.error('[conversations/id] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
  }
}

// PATCH /api/conversations/[id] — update title, pin, archive
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }
  try {
    const convAccess = await assertConversationAccess(id)
    if (convAccess.error) return convAccess.error

    const body = await req.json()
    const updates: { title?: string; isPinned?: boolean; isArchived?: boolean } = {}

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json({ error: `title must be a string under ${MAX_TITLE_LENGTH} chars` }, { status: 400 })
      }
      updates.title = body.title
    }
    if (body.isPinned !== undefined) {
      if (typeof body.isPinned !== 'boolean') {
        return NextResponse.json({ error: 'isPinned must be a boolean' }, { status: 400 })
      }
      updates.isPinned = body.isPinned
    }
    if (body.isArchived !== undefined) {
      if (typeof body.isArchived !== 'boolean') {
        return NextResponse.json({ error: 'isArchived must be a boolean' }, { status: 400 })
      }
      updates.isArchived = body.isArchived
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const conv = await updateConversation(id, updates)
    if (!conv) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ conversation: conv })
  } catch (err) {
    console.error('[conversations/id] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}

// DELETE /api/conversations/[id] — delete conversation + messages
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }
  try {
    const delAccess = await assertConversationAccess(id)
    if (delAccess.error) return delAccess.error

    await deleteConversation(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[conversations/id] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}

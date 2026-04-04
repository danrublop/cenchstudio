import { NextRequest, NextResponse } from 'next/server'
import { updateConversation, deleteConversation, getConversationMessages } from '@/lib/db/queries/conversations'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/conversations/[id] — conversation details + messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
    if (!conv) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const msgs = await getConversationMessages(id)
    return NextResponse.json({ conversation: conv, messages: msgs })
  } catch (err) {
    console.error('[conversations/id] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
  }
}

// PATCH /api/conversations/[id] — update title, pin, archive
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const updates: { title?: string; isPinned?: boolean; isArchived?: boolean } = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.isPinned !== undefined) updates.isPinned = body.isPinned
    if (body.isArchived !== undefined) updates.isArchived = body.isArchived

    const conv = await updateConversation(id, updates)
    return NextResponse.json({ conversation: conv })
  } catch (err) {
    console.error('[conversations/id] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}

// DELETE /api/conversations/[id] — delete conversation + messages
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteConversation(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[conversations/id] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}

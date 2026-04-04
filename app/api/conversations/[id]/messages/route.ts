import { NextRequest, NextResponse } from 'next/server'
import {
  getConversationMessages,
  addMessage,
  updateMessageRating,
  clearConversationMessages,
} from '@/lib/db/queries/conversations'

// GET /api/conversations/[id]/messages — load messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const msgs = await getConversationMessages(id)
    return NextResponse.json({ messages: msgs })
  } catch (err) {
    console.error('[messages] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST /api/conversations/[id]/messages — add a message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const msg = await addMessage({
      conversationId: id,
      projectId: body.projectId,
      role: body.role,
      content: body.content,
      agentType: body.agentType,
      modelUsed: body.modelUsed,
      thinkingContent: body.thinkingContent,
      toolCalls: body.toolCalls,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      costUsd: body.costUsd,
      durationMs: body.durationMs,
      apiCalls: body.apiCalls,
      userRating: body.userRating,
      generationLogId: body.generationLogId,
    })
    return NextResponse.json({ message: msg })
  } catch (err) {
    console.error('[messages] POST error:', err)
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 })
  }
}

// PATCH /api/conversations/[id]/messages — update a message (e.g. rating)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const { messageId, userRating } = body
    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }
    await updateMessageRating(id, messageId, userRating ?? null)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[messages] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
  }
}

// DELETE /api/conversations/[id]/messages — clear all messages
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await clearConversationMessages(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[messages] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to clear messages' }, { status: 500 })
  }
}

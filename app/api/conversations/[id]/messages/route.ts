import { NextRequest, NextResponse } from 'next/server'
import {
  getConversationMessages,
  addMessage,
  updateMessage,
  updateMessageRating,
  upsertMessage,
  clearConversationMessages,
} from '@/lib/db/queries/conversations'
import { assertConversationAccess } from '@/lib/auth-helpers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_ROLES = ['user', 'assistant']
const MAX_CONTENT_LENGTH = 500_000 // 500KB text limit

// GET /api/conversations/[id]/messages — load messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }
  try {
    const access = await assertConversationAccess(id)
    if (access.error) return access.error

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
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }
  try {
    const access = await assertConversationAccess(id)
    if (access.error) return access.error

    const body = await req.json()

    // Validate required fields
    if (!body.projectId || !UUID_RE.test(body.projectId)) {
      return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 })
    }

    // Cross-validate: projectId in body must match conversation's project
    if (body.projectId !== access.conversation!.projectId) {
      return NextResponse.json({ error: 'projectId does not match conversation' }, { status: 400 })
    }
    if (!body.role || !VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'role must be "user" or "assistant"' }, { status: 400 })
    }
    if (typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
    }
    if (body.content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: `content exceeds ${MAX_CONTENT_LENGTH} character limit` }, { status: 400 })
    }
    if (body.userRating !== undefined && body.userRating !== null) {
      const r = Number(body.userRating)
      if (!Number.isInteger(r) || r < -1 || r > 1) {
        return NextResponse.json({ error: 'userRating must be -1, 0, or 1' }, { status: 400 })
      }
    }

    // sendBeacon upsert path — _method:'PUT' routes to upsert (beacon can only POST)
    if (body._method === 'PUT' && body.messageId) {
      await upsertMessage({
        id: body.messageId,
        conversationId: id,
        projectId: body.projectId,
        role: body.role ?? 'assistant',
        content: body.content ?? '',
        status: body.status ?? 'aborted',
        agentType: body.agentType,
        modelUsed: body.modelUsed,
        thinkingContent: body.thinkingContent,
        toolCalls: body.toolCalls,
        contentSegments: body.contentSegments,
      })
      return NextResponse.json({ success: true })
    }

    const msg = await addMessage({
      id: body.id, // optional client-generated UUID
      conversationId: id,
      projectId: body.projectId,
      role: body.role,
      content: body.content,
      status: body.status,
      agentType: body.agentType,
      modelUsed: body.modelUsed,
      thinkingContent: body.thinkingContent,
      toolCalls: body.toolCalls,
      contentSegments: body.contentSegments,
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
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[messages] POST error:', errMsg, err)
    return NextResponse.json({ error: `Failed to add message: ${errMsg}` }, { status: 500 })
  }
}

// PATCH /api/conversations/[id]/messages — update a message (e.g. rating)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }
  try {
    const patchAccess = await assertConversationAccess(id)
    if (patchAccess.error) return patchAccess.error

    const body = await req.json()
    const { messageId } = body
    if (!messageId || !UUID_RE.test(messageId)) {
      return NextResponse.json({ error: 'Valid messageId is required' }, { status: 400 })
    }

    // Rating-only update (existing path)
    if ('userRating' in body && Object.keys(body).filter((k) => k !== 'messageId' && k !== 'userRating').length === 0) {
      if (body.userRating !== undefined && body.userRating !== null) {
        const r = Number(body.userRating)
        if (!Number.isInteger(r) || r < -1 || r > 1) {
          return NextResponse.json({ error: 'userRating must be -1, 0, or 1' }, { status: 400 })
        }
      }
      await updateMessageRating(id, messageId, body.userRating ?? null)
      return NextResponse.json({ success: true })
    }

    // General message update (streaming persist, final persist)
    await updateMessage(messageId, {
      content: body.content,
      status: body.status,
      agentType: body.agentType,
      modelUsed: body.modelUsed,
      thinkingContent: body.thinkingContent,
      toolCalls: body.toolCalls,
      contentSegments: body.contentSegments,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      costUsd: body.costUsd,
      durationMs: body.durationMs,
      apiCalls: body.apiCalls,
      generationLogId: body.generationLogId,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[messages] PATCH error:', errMsg, err)
    return NextResponse.json({ error: `Failed to update message: ${errMsg}` }, { status: 500 })
  }
}

// DELETE /api/conversations/[id]/messages — clear all messages
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }
  try {
    const delAccess = await assertConversationAccess(id)
    if (delAccess.error) return delAccess.error

    await clearConversationMessages(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[messages] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to clear messages' }, { status: 500 })
  }
}

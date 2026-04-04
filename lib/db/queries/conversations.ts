import { db } from '../index'
import { conversations, messages } from '../schema'
import { eq, desc, asc, sql } from 'drizzle-orm'

// ── Conversations ────────────────────────────────────────────────────────────

export async function getProjectConversations(projectId: string) {
  const convs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.projectId, projectId))
    .orderBy(desc(conversations.lastMessageAt))

  if (convs.length === 0) return []

  // Single query: DISTINCT ON returns exactly 1 row per conversation (the latest message)
  const convIds = convs.map((c) => c.id)
  const inClause = sql.join(
    convIds.map((id) => sql`${id}`),
    sql`, `,
  )
  const lastMessages = (await db.execute(sql`
    SELECT DISTINCT ON (conversation_id)
      conversation_id, role, content
    FROM messages
    WHERE conversation_id IN (${inClause})
    ORDER BY conversation_id, position DESC
  `)) as any

  const msgMap = new Map<string, { role: string; content: string }>()
  for (const row of lastMessages?.rows ?? lastMessages ?? []) {
    msgMap.set(row.conversation_id, { role: row.role, content: row.content })
  }

  return convs.map((conv) => {
    const lastMsg = msgMap.get(conv.id)
    return { ...conv, messages: lastMsg ? [lastMsg] : [] }
  })
}

export async function createConversation(data: { projectId: string; title?: string }) {
  const [conv] = await db
    .insert(conversations)
    .values({
      projectId: data.projectId,
      title: data.title ?? 'New chat',
    })
    .returning()
  return conv
}

export async function updateConversation(
  id: string,
  updates: { title?: string; isPinned?: boolean; isArchived?: boolean },
) {
  const [conv] = await db
    .update(conversations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning()
  return conv
}

export async function deleteConversation(id: string) {
  await db.delete(conversations).where(eq(conversations.id, id))
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getConversationMessages(conversationId: string, limit = 200) {
  return db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: asc(messages.position),
    limit,
  })
}

export async function getRecentMessages(conversationId: string, limit = 20) {
  const rows = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: desc(messages.position),
    limit,
  })
  return rows.reverse()
}

export async function addMessage(data: {
  conversationId: string
  projectId: string
  role: string
  content: string
  agentType?: string | null
  modelUsed?: string | null
  thinkingContent?: string | null
  toolCalls?: unknown[]
  inputTokens?: number | null
  outputTokens?: number | null
  costUsd?: number | null
  durationMs?: number | null
  apiCalls?: number | null
  userRating?: number | null
  generationLogId?: string | null
}) {
  // Atomic position assignment via subquery — no race condition possible
  return db.transaction(async (tx) => {
    const [message] = (await tx.execute(sql`
      INSERT INTO messages (
        conversation_id, project_id, role, content, agent_type, model_used,
        thinking_content, tool_calls, input_tokens, output_tokens, cost_usd,
        duration_ms, api_calls, user_rating, generation_log_id, position
      ) VALUES (
        ${data.conversationId}, ${data.projectId}, ${data.role}, ${data.content},
        ${data.agentType ?? null}::agent_type, ${data.modelUsed ?? null},
        ${data.thinkingContent ?? null}, ${JSON.stringify(data.toolCalls ?? [])}::jsonb,
        ${data.inputTokens ?? null}, ${data.outputTokens ?? null}, ${data.costUsd ?? null},
        ${data.durationMs ?? null}, ${data.apiCalls ?? null}, ${data.userRating ?? null},
        ${data.generationLogId ?? null},
        (SELECT coalesce(max(position), -1) + 1 FROM messages WHERE conversation_id = ${data.conversationId})
      ) RETURNING *
    `)) as any

    // Update conversation stats
    await tx
      .update(conversations)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        totalCostUsd: sql`total_cost_usd + ${data.costUsd ?? 0}`,
        totalInputTokens: sql`total_input_tokens + ${data.inputTokens ?? 0}`,
        totalOutputTokens: sql`total_output_tokens + ${data.outputTokens ?? 0}`,
      })
      .where(eq(conversations.id, data.conversationId))

    const row = message?.rows?.[0] ?? message?.[0] ?? message
    return row
  })
}

export async function updateMessageRating(conversationId: string, messageId: string, userRating: number | null) {
  await db.update(messages).set({ userRating }).where(eq(messages.id, messageId))
}

export async function clearConversationMessages(conversationId: string) {
  await db.delete(messages).where(eq(messages.conversationId, conversationId))
  await db
    .update(conversations)
    .set({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId))
}

export async function deleteProjectConversations(projectId: string) {
  await db.delete(conversations).where(eq(conversations.projectId, projectId))
}

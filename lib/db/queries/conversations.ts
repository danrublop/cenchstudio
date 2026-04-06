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
  /** Optional client-generated UUID — if omitted, DB generates one */
  id?: string
  conversationId: string
  projectId: string
  role: string
  content: string
  status?: string
  agentType?: string | null
  modelUsed?: string | null
  thinkingContent?: string | null
  toolCalls?: unknown[]
  contentSegments?: unknown[]
  inputTokens?: number | null
  outputTokens?: number | null
  costUsd?: number | null
  durationMs?: number | null
  apiCalls?: number | null
  userRating?: number | null
  generationLogId?: string | null
}) {
  const status = data.status ?? 'complete'
  // Atomic position assignment via subquery — no race condition possible
  return db.transaction(async (tx) => {
    const idFragment = data.id ? sql`${data.id}::uuid` : sql`gen_random_uuid()`
    const insertResult = await tx.execute(sql`
      INSERT INTO messages (
        id, conversation_id, project_id, role, content, status, agent_type, model_used,
        thinking_content, tool_calls, content_segments, input_tokens, output_tokens, cost_usd,
        duration_ms, api_calls, user_rating, generation_log_id, position
      ) VALUES (
        ${idFragment},
        ${data.conversationId}, ${data.projectId}, ${data.role}, ${data.content},
        ${status},
        ${data.agentType ?? null}::agent_type, ${data.modelUsed ?? null},
        ${data.thinkingContent ?? null}, ${JSON.stringify(data.toolCalls ?? [])}::jsonb,
        ${data.contentSegments ? sql`${JSON.stringify(data.contentSegments)}::jsonb` : sql`null`},
        ${data.inputTokens ?? null}, ${data.outputTokens ?? null}, ${data.costUsd ?? null},
        ${data.durationMs ?? null}, ${data.apiCalls ?? null}, ${data.userRating ?? null},
        ${data.generationLogId ?? null},
        (SELECT coalesce(max(position), -1) + 1 FROM messages WHERE conversation_id = ${data.conversationId})
      ) RETURNING *
    `)
    const message = (insertResult as any).rows?.[0] ?? (insertResult as any)[0]

    // Only update conversation stats for non-placeholder messages
    if (status !== 'streaming') {
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
    } else {
      // Still touch lastMessageAt so the conversation sorts correctly
      await tx
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, data.conversationId))
    }

    const row = message?.rows?.[0] ?? message?.[0] ?? message
    return row
  })
}

/** Update an existing message in-place. Only updates fields that are explicitly passed. */
export async function updateMessage(
  messageId: string,
  updates: {
    content?: string
    status?: string
    agentType?: string | null
    modelUsed?: string | null
    thinkingContent?: string | null
    toolCalls?: unknown[]
    contentSegments?: unknown[]
    inputTokens?: number | null
    outputTokens?: number | null
    costUsd?: number | null
    durationMs?: number | null
    apiCalls?: number | null
    generationLogId?: string | null
  },
) {
  // Build SET clauses dynamically from non-undefined fields
  const setClauses: ReturnType<typeof sql>[] = []
  if (updates.content !== undefined) setClauses.push(sql`content = ${updates.content}`)
  if (updates.status !== undefined) setClauses.push(sql`status = ${updates.status}`)
  if (updates.agentType !== undefined) setClauses.push(sql`agent_type = ${updates.agentType}::agent_type`)
  if (updates.modelUsed !== undefined) setClauses.push(sql`model_used = ${updates.modelUsed}`)
  if (updates.thinkingContent !== undefined) setClauses.push(sql`thinking_content = ${updates.thinkingContent}`)
  if (updates.toolCalls !== undefined) setClauses.push(sql`tool_calls = ${JSON.stringify(updates.toolCalls)}::jsonb`)
  if (updates.contentSegments !== undefined) setClauses.push(sql`content_segments = ${JSON.stringify(updates.contentSegments)}::jsonb`)
  if (updates.inputTokens !== undefined) setClauses.push(sql`input_tokens = ${updates.inputTokens}`)
  if (updates.outputTokens !== undefined) setClauses.push(sql`output_tokens = ${updates.outputTokens}`)
  if (updates.costUsd !== undefined) setClauses.push(sql`cost_usd = ${updates.costUsd}`)
  if (updates.durationMs !== undefined) setClauses.push(sql`duration_ms = ${updates.durationMs}`)
  if (updates.apiCalls !== undefined) setClauses.push(sql`api_calls = ${updates.apiCalls}`)
  if (updates.generationLogId !== undefined) setClauses.push(sql`generation_log_id = ${updates.generationLogId}`)

  if (setClauses.length === 0) return

  const setFragment = sql.join(setClauses, sql`, `)

  return db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE messages SET ${setFragment} WHERE id = ${messageId}::uuid`)

    // When completing a message, update conversation cost/token stats
    if (updates.status === 'complete' && (updates.costUsd || updates.inputTokens || updates.outputTokens)) {
      // Look up the conversation_id from the message
      const rowResult = await tx.execute(sql`SELECT conversation_id FROM messages WHERE id = ${messageId}::uuid`)
      const row = (rowResult as any).rows?.[0] ?? (rowResult as any)[0]
      const convId = row?.conversation_id
      if (convId) {
        await tx
          .update(conversations)
          .set({
            updatedAt: new Date(),
            totalCostUsd: sql`total_cost_usd + ${updates.costUsd ?? 0}`,
            totalInputTokens: sql`total_input_tokens + ${updates.inputTokens ?? 0}`,
            totalOutputTokens: sql`total_output_tokens + ${updates.outputTokens ?? 0}`,
          })
          .where(eq(conversations.id, convId))
      }
    }
  })
}

/** Upsert a message — INSERT if not exists, UPDATE only if still streaming. Used by sendBeacon. */
export async function upsertMessage(data: {
  id: string
  conversationId: string
  projectId: string
  role: string
  content: string
  status?: string
  agentType?: string | null
  modelUsed?: string | null
  thinkingContent?: string | null
  toolCalls?: unknown[]
  contentSegments?: unknown[]
}) {
  const status = data.status ?? 'aborted'
  await db.execute(sql`
    INSERT INTO messages (
      id, conversation_id, project_id, role, content, status,
      agent_type, model_used, thinking_content, tool_calls, content_segments,
      position
    ) VALUES (
      ${data.id}::uuid, ${data.conversationId}, ${data.projectId}, ${data.role}, ${data.content},
      ${status},
      ${data.agentType ?? null}::agent_type, ${data.modelUsed ?? null},
      ${data.thinkingContent ?? null},
      ${JSON.stringify(data.toolCalls ?? [])}::jsonb,
      ${data.contentSegments ? sql`${JSON.stringify(data.contentSegments)}::jsonb` : sql`null`},
      (SELECT coalesce(max(position), -1) + 1 FROM messages WHERE conversation_id = ${data.conversationId})
    )
    ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      status = EXCLUDED.status,
      tool_calls = EXCLUDED.tool_calls,
      content_segments = EXCLUDED.content_segments,
      thinking_content = EXCLUDED.thinking_content,
      agent_type = EXCLUDED.agent_type,
      model_used = EXCLUDED.model_used
    WHERE messages.status = 'streaming'
  `)
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

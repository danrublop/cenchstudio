import type { IpcMain } from 'electron'
import {
  getProjectConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  getConversationMessages,
  addMessage,
  updateMessage,
  updateMessageRating,
  upsertMessage,
  clearConversationMessages,
} from '@/lib/db/queries/conversations'
import { assertValidUuid, loadConversationOrThrow, loadProjectOrThrow, IpcValidationError } from './_helpers'

/**
 * Category: conversations
 *
 * Replaces:
 *   GET    /api/conversations?projectId=X
 *   POST   /api/conversations
 *   GET    /api/conversations/[id]
 *   PATCH  /api/conversations/[id]
 *   DELETE /api/conversations/[id]
 *   GET    /api/conversations/[id]/messages
 *   POST   /api/conversations/[id]/messages
 *   PATCH  /api/conversations/[id]/messages
 *   DELETE /api/conversations/[id]/messages
 *
 * Business logic comes from `lib/db/queries/conversations.ts` (unchanged).
 */

const MAX_TITLE_LENGTH = 500
const MAX_CONTENT_LENGTH = 500_000

async function list(projectId: string) {
  await loadProjectOrThrow(projectId)
  return { conversations: await getProjectConversations(projectId) }
}

async function create(args: { projectId: string; title?: string }) {
  await loadProjectOrThrow(args.projectId)
  if (args.title !== undefined) {
    if (typeof args.title !== 'string' || args.title.length > MAX_TITLE_LENGTH) {
      throw new IpcValidationError(`title must be a string under ${MAX_TITLE_LENGTH} chars`)
    }
  }
  return { conversation: await createConversation({ projectId: args.projectId, title: args.title }) }
}

async function get(id: string) {
  const conv = await loadConversationOrThrow(id)
  const messages = await getConversationMessages(id)
  return { conversation: conv, messages }
}

async function update(id: string, updates: { title?: string; isPinned?: boolean; isArchived?: boolean }) {
  await loadConversationOrThrow(id)
  const patch: { title?: string; isPinned?: boolean; isArchived?: boolean } = {}

  if (updates.title !== undefined) {
    if (typeof updates.title !== 'string' || updates.title.length > MAX_TITLE_LENGTH) {
      throw new IpcValidationError(`title must be a string under ${MAX_TITLE_LENGTH} chars`)
    }
    patch.title = updates.title
  }
  if (updates.isPinned !== undefined) {
    if (typeof updates.isPinned !== 'boolean') {
      throw new IpcValidationError('isPinned must be a boolean')
    }
    patch.isPinned = updates.isPinned
  }
  if (updates.isArchived !== undefined) {
    if (typeof updates.isArchived !== 'boolean') {
      throw new IpcValidationError('isArchived must be a boolean')
    }
    patch.isArchived = updates.isArchived
  }
  if (Object.keys(patch).length === 0) {
    throw new IpcValidationError('No valid fields to update')
  }

  const conversation = await updateConversation(id, patch)
  return { conversation }
}

async function remove(id: string) {
  await loadConversationOrThrow(id)
  await deleteConversation(id)
  return { success: true as const }
}

async function listMessages(id: string) {
  await loadConversationOrThrow(id)
  return { messages: await getConversationMessages(id) }
}

type AddMessageArgs = {
  id?: string
  messageId?: string
  conversationId: string
  projectId: string
  role: 'user' | 'assistant'
  content: string
  status?: string
  agentType?: string
  modelUsed?: string
  thinkingContent?: string
  toolCalls?: unknown
  contentSegments?: unknown
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
  apiCalls?: number
  userRating?: number | null
  generationLogId?: string
  /** sendBeacon-compatible upsert path. Beacons can only POST, so the web
   *  fallback threaded `_method: 'PUT'` through. Kept for parity. */
  _method?: 'PUT'
}

async function addMessageIpc(args: AddMessageArgs) {
  const conv = await loadConversationOrThrow(args.conversationId)
  assertValidUuid(args.projectId, 'projectId')
  if (args.projectId !== conv.projectId) {
    throw new IpcValidationError('projectId does not match conversation')
  }
  if (args.role !== 'user' && args.role !== 'assistant') {
    throw new IpcValidationError('role must be "user" or "assistant"')
  }
  if (typeof args.content !== 'string') {
    throw new IpcValidationError('content must be a string')
  }
  if (args.content.length > MAX_CONTENT_LENGTH) {
    throw new IpcValidationError(`content exceeds ${MAX_CONTENT_LENGTH} character limit`)
  }
  if (args.userRating !== undefined && args.userRating !== null) {
    const r = Number(args.userRating)
    if (!Number.isInteger(r) || r < -1 || r > 1) {
      throw new IpcValidationError('userRating must be -1, 0, or 1')
    }
  }

  if (args._method === 'PUT' && args.messageId) {
    await upsertMessage({
      id: args.messageId,
      conversationId: args.conversationId,
      projectId: args.projectId,
      role: args.role ?? 'assistant',
      content: args.content ?? '',
      status: (args.status ?? 'aborted') as 'aborted' | 'streaming' | 'complete',
      agentType: args.agentType,
      modelUsed: args.modelUsed,
      thinkingContent: args.thinkingContent,
      toolCalls: args.toolCalls as never,
      contentSegments: args.contentSegments as never,
    })
    return { success: true as const }
  }

  const message = await addMessage({
    id: args.id,
    conversationId: args.conversationId,
    projectId: args.projectId,
    role: args.role,
    content: args.content,
    status: args.status as never,
    agentType: args.agentType,
    modelUsed: args.modelUsed,
    thinkingContent: args.thinkingContent,
    toolCalls: args.toolCalls as never,
    contentSegments: args.contentSegments as never,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    costUsd: args.costUsd,
    durationMs: args.durationMs,
    apiCalls: args.apiCalls,
    userRating: args.userRating ?? undefined,
    generationLogId: args.generationLogId,
  })
  return { message }
}

type UpdateMessageArgs = {
  conversationId: string
  messageId: string
  userRating?: number | null
  content?: string
  status?: string
  agentType?: string
  modelUsed?: string
  thinkingContent?: string
  toolCalls?: unknown
  contentSegments?: unknown
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
  apiCalls?: number
  generationLogId?: string
}

async function updateMessageIpc(args: UpdateMessageArgs) {
  await loadConversationOrThrow(args.conversationId)
  assertValidUuid(args.messageId, 'messageId')

  const ratingOnly =
    'userRating' in args &&
    Object.keys(args).filter((k) => k !== 'conversationId' && k !== 'messageId' && k !== 'userRating').length === 0

  if (ratingOnly) {
    if (args.userRating !== undefined && args.userRating !== null) {
      const r = Number(args.userRating)
      if (!Number.isInteger(r) || r < -1 || r > 1) {
        throw new IpcValidationError('userRating must be -1, 0, or 1')
      }
    }
    await updateMessageRating(args.conversationId, args.messageId, args.userRating ?? null)
    return { success: true as const }
  }

  await updateMessage(args.messageId, {
    content: args.content,
    status: args.status as never,
    agentType: args.agentType,
    modelUsed: args.modelUsed,
    thinkingContent: args.thinkingContent,
    toolCalls: args.toolCalls as never,
    contentSegments: args.contentSegments as never,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    costUsd: args.costUsd,
    durationMs: args.durationMs,
    apiCalls: args.apiCalls,
    generationLogId: args.generationLogId,
  })
  return { success: true as const }
}

async function clearMessages(id: string) {
  await loadConversationOrThrow(id)
  await clearConversationMessages(id)
  return { success: true as const }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:conversations.list', (_e, projectId: string) => list(projectId))
  ipcMain.handle('cench:conversations.create', (_e, args: { projectId: string; title?: string }) => create(args))
  ipcMain.handle('cench:conversations.get', (_e, id: string) => get(id))
  ipcMain.handle('cench:conversations.update', (_e, args: { id: string; updates: Parameters<typeof update>[1] }) =>
    update(args.id, args.updates),
  )
  ipcMain.handle('cench:conversations.delete', (_e, id: string) => remove(id))
  ipcMain.handle('cench:conversations.listMessages', (_e, id: string) => listMessages(id))
  ipcMain.handle('cench:conversations.addMessage', (_e, args: AddMessageArgs) => addMessageIpc(args))
  ipcMain.handle('cench:conversations.updateMessage', (_e, args: UpdateMessageArgs) => updateMessageIpc(args))
  ipcMain.handle('cench:conversations.clearMessages', (_e, id: string) => clearMessages(id))
}

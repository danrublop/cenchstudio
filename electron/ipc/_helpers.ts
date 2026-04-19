import { db } from '@/lib/db'
import { projects, conversations, workspaces } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Desktop-mode access helpers. These replace the Next.js-era
 * `lib/auth-helpers.ts`, which returned `NextResponse` error objects and
 * relied on `auth()` from NextAuth. In the Electron process we throw
 * plain errors instead, and until Week 5+ (when OAuth ships) every
 * project/workspace is treated as single-user-accessible.
 *
 * When auth is added, gate inside each helper on a session check; the
 * IPC handler surface above them does not change.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertValidUuid(id: unknown, label = 'id'): string {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new IpcValidationError(`${label} must be a valid UUID`)
  }
  return id
}

export class IpcValidationError extends Error {
  readonly code = 'VALIDATION'
}

export class IpcNotFoundError extends Error {
  readonly code = 'NOT_FOUND'
}

/**
 * Thrown by optimistic-lock'd updates (projects.update) when the row's
 * `version` column changed between our SELECT and UPDATE. The renderer's
 * `saveProjectToDb` retry loop uses `instanceof IpcConflictError` to
 * decide whether to back off and retry, instead of substring-matching
 * "conflict" in arbitrary error messages (which would swallow unrelated
 * SQL errors that happen to mention `ON CONFLICT`).
 */
export class IpcConflictError extends Error {
  readonly code = 'CONFLICT'
}

export async function loadProjectOrThrow(projectId: string) {
  assertValidUuid(projectId, 'projectId')
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })
  if (!project) {
    throw new IpcNotFoundError(`Project ${projectId} not found`)
  }
  return project
}

export async function loadConversationOrThrow(conversationId: string) {
  assertValidUuid(conversationId, 'conversationId')
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  })
  if (!conv) {
    throw new IpcNotFoundError(`Conversation ${conversationId} not found`)
  }
  return conv
}

export async function loadWorkspaceOrThrow(workspaceId: string) {
  assertValidUuid(workspaceId, 'workspaceId')
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  })
  if (!ws) {
    throw new IpcNotFoundError(`Workspace ${workspaceId} not found`)
  }
  return ws
}

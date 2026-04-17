import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, conversations, workspaces } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type SessionUser = { id: string; email: string; name: string | null; image: string | null }

const isGuestMode = () => process.env.ALLOW_GUEST_MODE === 'true'

/** Get the authenticated user or throw a 401 AuthError. */
export async function getRequiredUser(): Promise<SessionUser> {
  if (isGuestMode()) {
    throw new AuthError('Authentication not available in guest mode', 401)
  }
  const session = await auth()
  if (!session?.user?.id) {
    throw new AuthError('Unauthorized', 401)
  }
  return session.user as SessionUser
}

/** Get the authenticated user, or null if in guest mode. */
export async function getOptionalUser(): Promise<SessionUser | null> {
  if (isGuestMode()) return null
  const session = await auth()
  return (session?.user as SessionUser | undefined) ?? null
}

/**
 * Load a project and verify the current user has access.
 * - Guest projects (userId=NULL) are accessible to everyone.
 * - Owned projects require the session user to match.
 * Returns the project row or a 403/404 NextResponse.
 */
export async function assertProjectAccess(projectId: string) {
  const user = await getOptionalUser()

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })

  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }), project: null }
  }

  // Guest projects (no owner) are accessible to everyone
  if (project.userId === null) {
    return { error: null, project, user }
  }

  // Owned projects require matching user
  if (!user || project.userId !== user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), project: null }
  }

  return { error: null, project, user }
}

/**
 * Load a conversation, verify its project exists and the user has access.
 * Returns the conversation + project or a 403/404 NextResponse.
 */
export async function assertConversationAccess(conversationId: string) {
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1)

  if (!conv) {
    return {
      error: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }),
      conversation: null,
      project: null,
    }
  }

  const access = await assertProjectAccess(conv.projectId)
  if (access.error) {
    return { error: access.error, conversation: null, project: null }
  }

  return { error: null, conversation: conv, project: access.project, user: access.user }
}

/**
 * Load a workspace and verify the current user has access.
 * - Guest workspaces (userId=NULL) are accessible to everyone.
 * - Owned workspaces require the session user to match.
 */
export async function assertWorkspaceAccess(workspaceId: string) {
  const user = await getOptionalUser()

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  })

  if (!workspace) {
    return { error: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }), workspace: null }
  }

  if (workspace.userId === null) {
    return { error: null, workspace, user }
  }

  if (!user || workspace.userId !== user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), workspace: null }
  }

  return { error: null, workspace, user }
}

/** Helper to return a JSON 401 response. */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

import { db } from '../index'
import { workspaces, projects } from '../schema'
import { eq, and, sql, isNull, desc } from 'drizzle-orm'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

export type WorkspaceRow = InferSelectModel<typeof workspaces>
export type NewWorkspace = InferInsertModel<typeof workspaces>

/** List workspaces for a user, with project count per workspace. */
export async function getUserWorkspaces(userId: string | null) {
  const ownerFilter = userId ? eq(workspaces.userId, userId) : isNull(workspaces.userId)
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      color: workspaces.color,
      icon: workspaces.icon,
      isDefault: workspaces.isDefault,
      isArchived: workspaces.isArchived,
      updatedAt: workspaces.updatedAt,
      projectCount: sql<number>`count(${projects.id})::int`,
    })
    .from(workspaces)
    .leftJoin(projects, eq(projects.workspaceId, workspaces.id))
    .where(ownerFilter)
    .groupBy(workspaces.id)
    .orderBy(desc(workspaces.updatedAt))

  return rows
}

/** Get a single workspace by ID. */
export async function getWorkspace(workspaceId: string) {
  return db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  })
}

/** Create a workspace. If isDefault is true, clears default from others first. */
export async function createWorkspace(data: NewWorkspace) {
  if (data.isDefault && data.userId) {
    await db
      .update(workspaces)
      .set({ isDefault: false })
      .where(and(eq(workspaces.userId, data.userId), eq(workspaces.isDefault, true)))
  }
  const [workspace] = await db.insert(workspaces).values(data).returning()
  return workspace
}

/** Update a workspace. */
export async function updateWorkspace(workspaceId: string, data: Partial<NewWorkspace>) {
  // If setting as default, clear others first
  if (data.isDefault) {
    const existing = await getWorkspace(workspaceId)
    if (existing?.userId) {
      await db
        .update(workspaces)
        .set({ isDefault: false })
        .where(and(eq(workspaces.userId, existing.userId), eq(workspaces.isDefault, true)))
    }
  }

  const [workspace] = await db
    .update(workspaces)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning()
  return workspace
}

/** Delete a workspace. Projects get workspace_id = NULL (ON DELETE SET NULL). */
export async function deleteWorkspace(workspaceId: string) {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId))
}

/** Assign projects to a workspace. */
export async function assignProjectsToWorkspace(workspaceId: string, projectIds: string[]) {
  if (projectIds.length === 0) return
  await db
    .update(projects)
    .set({ workspaceId, updatedAt: new Date() })
    .where(sql`${projects.id} = ANY(${projectIds})`)
}

/** Remove projects from any workspace (set workspace_id to NULL). */
export async function removeProjectsFromWorkspace(projectIds: string[]) {
  if (projectIds.length === 0) return
  await db
    .update(projects)
    .set({ workspaceId: null, updatedAt: new Date() })
    .where(sql`${projects.id} = ANY(${projectIds})`)
}

/** Count unassigned projects for a user (no workspace). */
export async function countUnassignedProjects(userId: string | null) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(and(isNull(projects.workspaceId), userId ? eq(projects.userId, userId) : isNull(projects.userId)))
  return result?.count ?? 0
}

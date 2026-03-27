import { db } from '../index';
import { projects, scenes } from '../schema';
import { eq, desc, isNull } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export async function getUserProjects(userId: string | null) {
  return db.query.projects.findMany({
    where: userId
      ? eq(projects.userId, userId)
      : isNull(projects.userId),
    orderBy: desc(projects.updatedAt),
    columns: {
      id: true, name: true, description: true,
      outputMode: true, storageMode: true,
      thumbnailUrl: true, isArchived: true,
      lastOpenedAt: true, createdAt: true, updatedAt: true,
    },
    with: {
      scenes: {
        columns: { id: true, name: true, position: true, thumbnailUrl: true },
        orderBy: (s) => s.position,
        limit: 5,
      },
    },
  });
}

export async function getFullProject(projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      scenes: {
        orderBy: (s) => s.position,
        with: {
          layers: {
            orderBy: (l) => l.zIndex,
            with: { media: true },
          },
          interactions: true,
        },
      },
      sceneEdges: true,
    },
  });
}

export async function createProject(data: NewProject) {
  const [project] = await db.insert(projects).values(data).returning();
  return project;
}

export async function updateProject(
  projectId: string,
  data: Partial<NewProject>
) {
  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return project;
}

export async function deleteProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function archiveProject(projectId: string) {
  return updateProject(projectId, { isArchived: true });
}

export async function touchProject(projectId: string) {
  await db
    .update(projects)
    .set({ lastOpenedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

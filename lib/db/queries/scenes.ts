import { db } from '../index';
import { scenes, layers } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getProjectScenes(projectId: string) {
  return db.query.scenes.findMany({
    where: eq(scenes.projectId, projectId),
    orderBy: asc(scenes.position),
    with: {
      layers: {
        orderBy: (l) => l.zIndex,
      },
      interactions: true,
    },
  });
}

export async function createScene(data: typeof scenes.$inferInsert) {
  const [scene] = await db.insert(scenes).values(data).returning();
  return scene;
}

export async function updateScene(
  sceneId: string,
  data: Partial<typeof scenes.$inferInsert>
) {
  const [scene] = await db
    .update(scenes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(scenes.id, sceneId))
    .returning();
  return scene;
}

export async function deleteScene(sceneId: string) {
  await db.delete(scenes).where(eq(scenes.id, sceneId));
}

export async function reorderScenes(
  projectId: string,
  orderedIds: string[]
) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(scenes)
        .set({ position: i })
        .where(eq(scenes.id, orderedIds[i]));
    }
  });
}

export async function duplicateScene(sceneId: string) {
  return db.transaction(async (tx) => {
    const original = await tx.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
      with: { layers: true, interactions: true },
    });
    if (!original) throw new Error(`Scene ${sceneId} not found`);

    const { id: _, layers: origLayers,
            interactions: origInteractions,
            ...sceneData } = original;

    const [newScene] = await tx
      .insert(scenes)
      .values({
        ...sceneData,
        position: original.position + 1,
        name: `${original.name} (copy)`,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (origLayers.length > 0) {
      await tx.insert(layers).values(
        origLayers.map(({ id: _, sceneId: __, ...l }) => ({
          ...l,
          sceneId: newScene.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );
    }

    return newScene;
  });
}

import { db } from '../index';
import { layers } from '../schema';
import { eq } from 'drizzle-orm';

export async function createLayer(data: typeof layers.$inferInsert) {
  const [layer] = await db.insert(layers).values(data).returning();
  return layer;
}

export async function updateLayer(
  layerId: string,
  data: Partial<typeof layers.$inferInsert>
) {
  const [layer] = await db
    .update(layers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(layers.id, layerId))
    .returning();
  return layer;
}

export async function deleteLayer(layerId: string) {
  await db.delete(layers).where(eq(layers.id, layerId));
}

export async function patchLayerCode(
  layerId: string,
  oldCode: string,
  newCode: string
) {
  const layer = await db.query.layers.findFirst({
    where: eq(layers.id, layerId),
  });
  if (!layer) throw new Error(`Layer ${layerId} not found`);
  if (!layer.generatedCode?.includes(oldCode)) {
    throw new Error('Old code not found in layer — cannot patch');
  }
  const patched = layer.generatedCode.replace(oldCode, newCode);
  return updateLayer(layerId, { generatedCode: patched });
}

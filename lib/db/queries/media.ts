import { db } from '../index';
import { generatedMedia } from '../schema';
import { eq } from 'drizzle-orm';

export async function getMediaByHash(promptHash: string) {
  return db.query.generatedMedia.findFirst({
    where: eq(generatedMedia.promptHash, promptHash),
  });
}

export async function createMedia(data: typeof generatedMedia.$inferInsert) {
  const [media] = await db.insert(generatedMedia).values(data).returning();
  return media;
}

export async function updateMediaStatus(
  mediaId: string,
  status: 'pending' | 'generating' | 'processing' | 'ready' | 'error',
  url?: string
) {
  const [media] = await db
    .update(generatedMedia)
    .set({ status, ...(url ? { url } : {}) })
    .where(eq(generatedMedia.id, mediaId))
    .returning();
  return media;
}

export async function getMediaById(mediaId: string) {
  return db.query.generatedMedia.findFirst({
    where: eq(generatedMedia.id, mediaId),
  });
}

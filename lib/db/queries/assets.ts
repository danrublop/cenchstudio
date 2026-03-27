import { db } from '../index';
import { assets } from '../schema';
import { eq, ilike, or, sql, and } from 'drizzle-orm';

export async function searchAssets(query: string, category?: string) {
  const conditions = [
    or(
      ilike(assets.name, `%${query}%`),
      ilike(assets.description, `%${query}%`),
      sql`${assets.tags} @> ${JSON.stringify([query])}::jsonb`,
      sql`to_tsvector('english', ${assets.name} || ' ' ||
          coalesce(${assets.description}, '')) @@
          plainto_tsquery('english', ${query})`
    ),
  ];

  if (category && category !== 'all') {
    conditions.push(eq(assets.category, category));
  }

  return db.select().from(assets).where(and(...conditions)).limit(24);
}

export async function getAssetsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(assets).where(
    sql`${assets.id} = ANY(${ids})`
  );
}

export async function incrementAssetUseCount(assetId: string) {
  await db
    .update(assets)
    .set({ useCount: sql`${assets.useCount} + 1` })
    .where(eq(assets.id, assetId));
}

import { db } from '../index';
import { assets } from '../schema';
import { sql } from 'drizzle-orm';

export async function seedBuiltInAssets() {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(assets);

  if (Number(existing[0].count) > 0) {
    console.log('  Assets already seeded, skipping');
    return;
  }

  // Built-in assets will be added here as the library grows
  // For now, seed with a placeholder to verify the pipeline works
  console.log('  No built-in assets to seed yet');
}

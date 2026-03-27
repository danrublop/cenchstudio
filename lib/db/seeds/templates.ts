import { db } from '../index';
import { sceneTemplates } from '../schema';
import { sql } from 'drizzle-orm';

export async function seedTemplates() {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(sceneTemplates);

  if (Number(existing[0].count) > 0) {
    console.log('  Templates already seeded, skipping');
    return;
  }

  console.log('  No built-in templates to seed yet');
}

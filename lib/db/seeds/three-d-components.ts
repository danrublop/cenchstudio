import { db } from '../index';
import { threeDComponents } from '../schema';
import { sql } from 'drizzle-orm';

export async function seedThreeDComponents() {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(threeDComponents);

  if (Number(existing[0].count) > 0) {
    console.log('  3D components already seeded, skipping');
    return;
  }

  console.log('  No built-in 3D components to seed yet');
}

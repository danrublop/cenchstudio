import { db } from '../index';
import { snapshots } from '../schema';
import { eq, desc, sql } from 'drizzle-orm';

interface SnapshotDiff {
  table: string;
  id: string;
  before: unknown;
  after: unknown;
}

export async function createSnapshot(
  projectId: string,
  operation: string,
  diff: SnapshotDiff | SnapshotDiff[],
  agentMessage?: string,
  agentType?: string
) {
  const [{ maxIndex }] = await db
    .select({ maxIndex: sql<number>`coalesce(max(stack_index), -1)` })
    .from(snapshots)
    .where(eq(snapshots.projectId, projectId));

  const [snapshot] = await db
    .insert(snapshots)
    .values({
      projectId,
      operation,
      diff: Array.isArray(diff) ? diff : [diff],
      agentMessage,
      agentType: agentType as any,
      stackIndex: maxIndex + 1,
    })
    .returning();

  await db.execute(sql`
    DELETE FROM snapshots
    WHERE project_id = ${projectId}
    AND stack_index < (
      SELECT max(stack_index) - 50
      FROM snapshots
      WHERE project_id = ${projectId}
    )
  `);

  return snapshot;
}

export async function getUndoStack(projectId: string, limit = 20) {
  return db.query.snapshots.findMany({
    where: eq(snapshots.projectId, projectId),
    orderBy: desc(snapshots.stackIndex),
    limit,
    columns: {
      id: true, operation: true,
      agentMessage: true, stackIndex: true, createdAt: true,
    },
  });
}

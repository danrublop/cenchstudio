import { db } from '../index'
import { userMemory } from '../schema'
import { eq, and, desc, gte, sql } from 'drizzle-orm'

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserMemoryRow {
  id: string
  userId: string
  category: string
  key: string
  value: string
  confidence: number
  sourceRunId: string | null
  createdAt: Date
  updatedAt: Date
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch user memories sorted by confidence, filtering out low-confidence entries.
 * Returns at most `maxItems` memories (default 20).
 */
export async function getMemoriesForUser(userId: string, maxItems = 20): Promise<UserMemoryRow[]> {
  return db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.userId, userId), gte(userMemory.confidence, 0.1)))
    .orderBy(desc(userMemory.confidence))
    .limit(maxItems) as Promise<UserMemoryRow[]>
}

/**
 * Insert or update a memory. Uses ON CONFLICT on (userId, category, key)
 * to update value and confidence if the memory already exists.
 */
export async function upsertMemory(
  userId: string,
  category: string,
  key: string,
  value: string,
  confidence: number,
  sourceRunId?: string,
): Promise<void> {
  await db
    .insert(userMemory)
    .values({
      userId,
      category,
      key,
      value,
      confidence,
      sourceRunId: sourceRunId ?? null,
    })
    .onConflictDoUpdate({
      target: [userMemory.userId, userMemory.category, userMemory.key],
      set: {
        value,
        confidence,
        sourceRunId: sourceRunId ?? null,
        updatedAt: new Date(),
      },
    })
}

/**
 * Decay all memories for a user by multiplying confidence by a factor.
 * Memories below 0.05 are deleted entirely.
 * Call periodically (e.g., on login or weekly).
 */
export async function decayMemories(userId: string, decayFactor = 0.95): Promise<void> {
  // Multiply confidence by decay factor
  await db
    .update(userMemory)
    .set({ confidence: sql`${userMemory.confidence} * ${decayFactor}` })
    .where(eq(userMemory.userId, userId))

  // Clean up memories that have decayed below threshold
  await db.delete(userMemory).where(and(eq(userMemory.userId, userId), sql`${userMemory.confidence} < 0.05`))
}

/**
 * Boost or reduce confidence for all memories from a specific run.
 * Used when the user rates a generation (thumbs up/down).
 */
export async function adjustRunConfidence(
  userId: string,
  runId: string,
  delta: number, // positive = boost, negative = reduce
): Promise<void> {
  // Clamp confidence to [0, 1] after adjustment
  await db
    .update(userMemory)
    .set({
      confidence: sql`LEAST(1.0, GREATEST(0.0, ${userMemory.confidence} + ${delta}))`,
      updatedAt: new Date(),
    })
    .where(and(eq(userMemory.userId, userId), eq(userMemory.sourceRunId, runId)))
}

/**
 * Delete a specific memory by key.
 */
export async function deleteMemory(userId: string, category: string, key: string): Promise<void> {
  await db
    .delete(userMemory)
    .where(and(eq(userMemory.userId, userId), eq(userMemory.category, category), eq(userMemory.key, key)))
}

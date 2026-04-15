/**
 * Zod schema for RunCheckpoint validation.
 *
 * Kept in a separate file from types.ts to avoid pulling Zod into client bundles.
 * Used by getRunCheckpoint() to validate checkpoint data loaded from the DB.
 */

import { z } from 'zod'

export const RunCheckpointSchema = z.object({
  runId: z.string(),
  agentType: z.string(),
  modelId: z.string(),
  storyboard: z.any().nullable(),
  completedSceneIds: z.array(z.string()),
  remainingSceneIndexes: z.array(z.number()),
  // RunProgress shape can evolve — validate structurally but allow extra fields
  progress: z.record(z.string(), z.unknown()),
  worldSnapshot: z.object({
    scenes: z.array(z.any()),
    globalStyle: z.any(),
    sceneGraph: z.any(),
  }),
  originalMessage: z.string(),
  partialUsage: z.any(),
  createdAt: z.string(),
  reason: z.enum(['disconnect', 'timeout', 'error']),
})

import type { IpcMain } from 'electron'
import { updateGenerationLog, getGenerationLogs, getQualityByDimension } from '@/lib/db/queries/generation-logs'
import { computeQualityScore } from '@/lib/generation-logs/score'
import { assertValidUuid, IpcValidationError } from './_helpers'

/**
 * Category: generationLog
 *
 * Replaces:
 *   PATCH /api/generation-log     → update quality signals
 *   GET   /api/generation-log     → list logs or aggregated quality by dimension
 */

const VALID_USER_ACTIONS = [
  'kept',
  'regenerated',
  'edited',
  'deleted',
  'rated-positive',
  'rated-negative',
  'exported',
  'published',
] as const

const VALID_DIMENSIONS = ['scene_type', 'model_used', 'thinking_mode', 'style_preset_id', 'agent_type'] as const

type Dimension = (typeof VALID_DIMENSIONS)[number]

const MAX_QUERY_RESULTS = 500

type UpdateArgs = {
  logId: string
  userAction?: string
  timeToActionMs?: number
  editDistance?: number
  userRating?: number
  exportSucceeded?: boolean
  exportErrorMessage?: string
  generatedCodeLength?: number
}

async function update(args: UpdateArgs) {
  assertValidUuid(args.logId, 'logId')

  if (args.userAction && !(VALID_USER_ACTIONS as readonly string[]).includes(args.userAction)) {
    throw new IpcValidationError(`userAction must be one of: ${VALID_USER_ACTIONS.join(', ')}`)
  }
  if (
    args.timeToActionMs != null &&
    (typeof args.timeToActionMs !== 'number' || args.timeToActionMs < 0 || !Number.isFinite(args.timeToActionMs))
  ) {
    throw new IpcValidationError('timeToActionMs must be a non-negative number')
  }
  if (
    args.editDistance != null &&
    (typeof args.editDistance !== 'number' || args.editDistance < 0 || !Number.isInteger(args.editDistance))
  ) {
    throw new IpcValidationError('editDistance must be a non-negative integer')
  }
  if (args.userRating != null && (typeof args.userRating !== 'number' || args.userRating < 0 || args.userRating > 5)) {
    throw new IpcValidationError('userRating must be between 0 and 5')
  }

  const updates: Record<string, unknown> = {}
  if (args.userAction) updates.userAction = args.userAction
  if (args.timeToActionMs != null) updates.timeToActionMs = args.timeToActionMs
  if (args.editDistance != null) updates.editDistance = args.editDistance
  if (args.userRating != null) updates.userRating = args.userRating
  if (args.exportSucceeded != null) updates.exportSucceeded = args.exportSucceeded
  if (args.exportErrorMessage) updates.exportErrorMessage = args.exportErrorMessage

  if (args.userAction) {
    const score = computeQualityScore({
      userAction: args.userAction,
      timeToActionMs: args.timeToActionMs,
      editDistance: args.editDistance,
      generatedCodeLength: args.generatedCodeLength,
      userRating: args.userRating,
      exportSucceeded: args.exportSucceeded,
    })
    if (score >= 0) updates.qualityScore = score
  }

  await updateGenerationLog(args.logId, updates)
  return { success: true as const }
}

type ListArgs = {
  projectId?: string
  sceneId?: string
  limit?: number
  offset?: number
}

async function list(args: ListArgs) {
  if (args.projectId) assertValidUuid(args.projectId, 'projectId')
  if (args.sceneId) assertValidUuid(args.sceneId, 'sceneId')
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_QUERY_RESULTS)
  const offset = Math.max(args.offset ?? 0, 0)
  const logs = await getGenerationLogs({
    projectId: args.projectId,
    sceneId: args.sceneId,
    limit,
    offset,
  })
  return { logs }
}

async function listByDimension(args: { dimension: Dimension; projectId?: string }) {
  if (!(VALID_DIMENSIONS as readonly string[]).includes(args.dimension)) {
    throw new IpcValidationError(`dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`)
  }
  if (args.projectId) assertValidUuid(args.projectId, 'projectId')
  const data = await getQualityByDimension(args.dimension, args.projectId)
  return { data }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:generationLog.update', (_e, args: UpdateArgs) => update(args))
  ipcMain.handle('cench:generationLog.list', (_e, args: ListArgs) => list(args))
  ipcMain.handle('cench:generationLog.listByDimension', (_e, args: { dimension: Dimension; projectId?: string }) =>
    listByDimension(args),
  )
}

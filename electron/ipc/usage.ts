import type { IpcMain } from 'electron'
import { getAgentUsageSummary } from '@/lib/db'
import { assertValidUuid } from './_helpers'

/**
 * Category: usage
 *
 * Replaces: GET /api/usage[?projectId=X]
 *
 * Returns per-agent + total token / cost / call counts. Project-scoped when
 * `projectId` is provided; global otherwise.
 */
async function getSummary(projectId?: string) {
  if (projectId) assertValidUuid(projectId, 'projectId')
  return getAgentUsageSummary(projectId)
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:usage.getSummary', (_e, projectId?: string) => getSummary(projectId))
}

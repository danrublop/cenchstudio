import type { IpcMain } from 'electron'
import { getSessionPermission, setSessionPermission, getSessionSpend, getMonthlySpend, logSpend } from '@/lib/db'
import { assertValidUuid, IpcValidationError } from './_helpers'

/**
 * Category: permissions
 *
 * Replaces:
 *   GET  /api/permissions           → current session + monthly spend per API
 *   POST /api/permissions           → { action: 'log_spend'|'set_session_permission'|'get_session_permission' }
 *
 * The `permissions/rules` endpoint (auth-gated per-user rules) is
 * deliberately deferred to Week 5+ alongside real OAuth, because the
 * `permissionRules.userId` column is a hard FK to `users.id` and we
 * don't yet have a desktop user row to hang rules off of.
 */

const TRACKED_APIS = ['heygen', 'veo3', 'imageGen', 'backgroundRemoval', 'elevenLabs', 'unsplash'] as const

async function getSpend(): Promise<Record<string, { sessionSpend: number; monthlySpend: number }>> {
  const result: Record<string, { sessionSpend: number; monthlySpend: number }> = {}
  for (const api of TRACKED_APIS) {
    result[api] = {
      sessionSpend: await getSessionSpend(api),
      monthlySpend: await getMonthlySpend(api),
    }
  }
  return result
}

type LogSpendArgs = {
  action: 'log_spend'
  api: string
  costUsd: number
  description?: string
  projectId?: string
}

type SetSessionPermissionArgs = {
  action: 'set_session_permission'
  api: string
  decision: string
}

type GetSessionPermissionArgs = {
  action: 'get_session_permission'
  api: string
}

type PermissionAction = LogSpendArgs | SetSessionPermissionArgs | GetSessionPermissionArgs

async function perform(args: PermissionAction) {
  if (args.action === 'log_spend') {
    if (!args.api) throw new IpcValidationError('api is required')
    if (typeof args.costUsd !== 'number' || !Number.isFinite(args.costUsd)) {
      throw new IpcValidationError('costUsd must be a finite number')
    }
    if (args.projectId) assertValidUuid(args.projectId, 'projectId')
    await logSpend(args.projectId ?? '', args.api, args.costUsd, args.description ?? '')
    return { ok: true as const }
  }
  if (args.action === 'set_session_permission') {
    if (!args.api || !args.decision) throw new IpcValidationError('api and decision required')
    await setSessionPermission(args.api, args.decision)
    return { ok: true as const }
  }
  if (args.action === 'get_session_permission') {
    if (!args.api) throw new IpcValidationError('api required')
    const decision = await getSessionPermission(args.api)
    return { decision }
  }
  throw new IpcValidationError(`Unknown permissions action: ${(args as { action?: string }).action}`)
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:permissions.getSpend', () => getSpend())
  ipcMain.handle('cench:permissions.perform', (_e, args: PermissionAction) => perform(args))
}

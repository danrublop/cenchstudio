import { z } from 'zod'
import { LIMITS } from '../constants'

const logSpendSchema = z.object({
  action: z.literal('log_spend'),
  projectId: z.string().uuid().optional(),
  api: z.string().min(1).max(LIMITS.MAX_API_NAME_LENGTH),
  costUsd: z.number().nonnegative().max(LIMITS.MAX_COST_USD),
  description: z.string().max(LIMITS.MAX_DESCRIPTION_LENGTH).optional(),
})

const setPermissionSchema = z.object({
  action: z.literal('set_session_permission'),
  api: z.string().min(1).max(LIMITS.MAX_API_NAME_LENGTH),
  decision: z.enum(['allow', 'deny', 'ask']),
})

const getPermissionSchema = z.object({
  action: z.literal('get_session_permission'),
  api: z.string().min(1).max(LIMITS.MAX_API_NAME_LENGTH),
})

export const permissionsBodySchema = z.discriminatedUnion('action', [
  logSpendSchema,
  setPermissionSchema,
  getPermissionSchema,
])

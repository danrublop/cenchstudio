import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { eq, sql } from 'drizzle-orm'
import { createLogger } from '../logger'

const log = createLogger('db')

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

let _pool: Pool | null = null
let _db: DrizzleDB | null = null

// Single-flight guard: `initDb()` is called from every property access on
// the exported `db` Proxy. Without this, two concurrent IPC calls in the
// Electron main process can both enter before `_db` is assigned, each
// construct a Pool, and the losing one leaks its 5 open connections
// forever (never `.end()`ed). Memoizing the synchronous path is enough —
// `new Pool()` returns immediately; the lazy initialization races are
// all on the tick that creates the first connection, not the Pool object
// itself.
function initDb(): DrizzleDB {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set.\n' +
        'For local mode: copy .env.example to .env.local and run npm run db:start\n' +
        'For cloud mode: add your Neon/Supabase connection string to .env.local',
    )
  }
  const pool = new Pool({
    connectionString: url,
    max: process.env.STORAGE_MODE === 'cloud' ? 10 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : { rejectUnauthorized: true },
  })
  pool.on('error', (err) => {
    log.error('unexpected Postgres pool error', { error: err })
  })
  const database = drizzle(pool, {
    schema,
    logger: process.env.NODE_ENV === 'development',
  })
  // Another tick's initDb() may have won. If so, drop ours to avoid the leak.
  if (_db) {
    void pool.end()
    return _db
  }
  _pool = pool
  _db = database
  return _db
}

/**
 * Drizzle database handle. The pool and client are created lazily on first
 * property access so importing modules that reference `db` does not require
 * DATABASE_URL at startup (matters for tests and for CI tooling that parses
 * types without connecting).
 */
export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    return Reflect.get(initDb() as object, prop, receiver)
  },
  // Required so Auth.js Drizzle adapter's `is(db, PgDatabase)` check — which
  // walks the prototype chain via Object.getPrototypeOf — sees the real
  // PgDatabase prototype instead of the empty Proxy target's Object.prototype.
  getPrototypeOf() {
    return Reflect.getPrototypeOf(initDb() as object)
  },
  has(_target, prop) {
    return Reflect.has(initDb() as object, prop)
  },
})

export type DB = DrizzleDB

export async function checkDbConnection(): Promise<boolean> {
  try {
    initDb()
    await _pool!.query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
    _db = null
  }
}

// ── Spend tracking (async replacements for old SQLite functions) ─────────────

export async function logSpend(
  projectId: string,
  api: string,
  costUsd: number,
  description: string,
  reservationId?: string,
): Promise<void> {
  await db.insert(schema.apiSpend).values({
    projectId,
    api,
    costUsd,
    description,
  })
  // Mirror into the in-memory budget tracker so live budget queries see the
  // cost even before the DB row is read back. When a reservation exists,
  // reconcile it (replacing the estimate with the actual); otherwise just
  // record the raw spend.
  try {
    const tracker = await import('../agents/budget-tracker')
    if (reservationId) {
      const reconciled = tracker.reconcileSpend(projectId, reservationId, costUsd)
      if (!reconciled) tracker.recordActualSpend(projectId, costUsd)
    } else {
      tracker.recordActualSpend(projectId, costUsd)
    }
  } catch (trackerErr) {
    // Tracker is best-effort — never block the DB write on it, but do log so
    // we don't silently diverge from the in-memory snapshot in production.
    log.warn('logSpend: budget tracker update failed', { extra: { projectId, api }, error: trackerErr })
  }
}

export async function getSessionSpend(api: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.apiSpend.costUsd}), 0)` })
    .from(schema.apiSpend)
    .where(sql`${schema.apiSpend.api} = ${api} AND ${schema.apiSpend.createdAt} > now() - interval '1 day'`)
  return row.total
}

export async function getMonthlySpend(api: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.apiSpend.costUsd}), 0)` })
    .from(schema.apiSpend)
    .where(sql`${schema.apiSpend.api} = ${api} AND ${schema.apiSpend.createdAt} > date_trunc('month', now())`)
  return row.total
}

// ── Media cache ─────────────────────────────────────────────────────────────

export async function getCachedMedia(hash: string): Promise<{ filePath: string; config: string | null } | null> {
  const row = await db.query.mediaCache.findFirst({
    where: eq(schema.mediaCache.hash, hash),
    columns: { filePath: true, config: true },
  })
  if (!row) return null
  return { filePath: row.filePath, config: row.config }
}

export async function setCachedMedia(
  hash: string,
  api: string,
  filePath: string,
  prompt: string,
  model: string,
  config: string,
): Promise<void> {
  await db.insert(schema.mediaCache).values({ hash, api, filePath, prompt, model, config }).onConflictDoUpdate({
    target: schema.mediaCache.hash,
    set: { api, filePath, prompt, model, config },
  })
}

// ── Session permissions ─────────────────────────────────────────────────────

export async function getSessionPermission(api: string): Promise<string | null> {
  const row = await db.query.permissionSessions.findFirst({
    where: eq(schema.permissionSessions.api, api),
    columns: { decision: true },
  })
  return row?.decision ?? null
}

export async function setSessionPermission(api: string, decision: string): Promise<void> {
  await db.insert(schema.permissionSessions).values({ api, decision }).onConflictDoUpdate({
    target: schema.permissionSessions.api,
    set: { decision },
  })
}

export async function clearSessionPermissions(): Promise<void> {
  await db.delete(schema.permissionSessions)
}

// ── Agent usage tracking ──────────────────────────────────────────────────

export async function logAgentUsage(
  projectId: string,
  agentType: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  apiCalls: number,
  toolCalls: number,
  costUsd: number,
  durationMs: number,
): Promise<void> {
  await db.insert(schema.agentUsage).values({
    projectId,
    agentType,
    modelId,
    inputTokens,
    outputTokens,
    apiCalls,
    toolCalls,
    costUsd,
    durationMs,
  })
}

export async function getAgentUsageSummary(projectId?: string): Promise<{
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  totalApiCalls: number
  totalToolCalls: number
  byAgent: Record<string, { inputTokens: number; outputTokens: number; costUsd: number; count: number }>
}> {
  const empty = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    totalApiCalls: 0,
    totalToolCalls: 0,
    byAgent: {} as Record<string, { inputTokens: number; outputTokens: number; costUsd: number; count: number }>,
  }

  try {
    const whereClause = projectId ? sql`WHERE ${schema.agentUsage.projectId} = ${projectId}` : sql``

    const totalsResult = (await db.execute(sql`
      SELECT
        coalesce(sum(input_tokens), 0) as "totalInputTokens",
        coalesce(sum(output_tokens), 0) as "totalOutputTokens",
        coalesce(sum(cost_usd), 0) as "totalCostUsd",
        coalesce(sum(api_calls), 0) as "totalApiCalls",
        coalesce(sum(tool_calls), 0) as "totalToolCalls"
      FROM agent_usage ${whereClause}
    `)) as any
    const totals = totalsResult?.rows?.[0] ?? totalsResult?.[0] ?? {}

    const byAgentRows = (await db.execute(sql`
      SELECT
        agent_type,
        sum(input_tokens) as "inputTokens",
        sum(output_tokens) as "outputTokens",
        sum(cost_usd) as "costUsd",
        count(*) as count
      FROM agent_usage ${whereClause}
      GROUP BY agent_type
    `)) as any

    const byAgent: Record<string, { inputTokens: number; outputTokens: number; costUsd: number; count: number }> = {}
    for (const row of byAgentRows?.rows ?? byAgentRows ?? []) {
      byAgent[row.agent_type] = {
        inputTokens: Number(row.inputTokens),
        outputTokens: Number(row.outputTokens),
        costUsd: Number(row.costUsd),
        count: Number(row.count),
      }
    }

    const t = totals?.rows?.[0] ?? totals ?? {}
    return {
      totalInputTokens: Number(t.totalInputTokens ?? 0),
      totalOutputTokens: Number(t.totalOutputTokens ?? 0),
      totalCostUsd: Number(t.totalCostUsd ?? 0),
      totalApiCalls: Number(t.totalApiCalls ?? 0),
      totalToolCalls: Number(t.totalToolCalls ?? 0),
      byAgent,
    }
  } catch (e) {
    log.error('getAgentUsageSummary failed (table may not exist)', { error: e })
    return empty
  }
}

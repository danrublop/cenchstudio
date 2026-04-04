import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { eq, sql } from 'drizzle-orm'

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set.\n' +
      'For local mode: copy .env.example to .env.local and run npm run db:start\n' +
      'For cloud mode: add your Neon/Supabase connection string to .env.local',
  )
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.STORAGE_MODE === 'cloud' ? 10 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl:
    process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err)
})

export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === 'development',
})

export type DB = typeof db

export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export async function closeDb(): Promise<void> {
  await pool.end()
}

// ── Spend tracking (async replacements for old SQLite functions) ─────────────

export async function logSpend(projectId: string, api: string, costUsd: number, description: string): Promise<void> {
  await db.insert(schema.apiSpend).values({
    projectId,
    api,
    costUsd,
    description,
  })
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
    console.error('[DB] getAgentUsageSummary failed (table may not exist):', e)
    return empty
  }
}

import { db } from '../index'
import { generationLogs } from '../schema'
import { eq, desc, sql, isNotNull, and } from 'drizzle-orm'

export interface CreateGenerationLogInput {
  projectId?: string
  sceneId?: string
  layerId?: string
  userPrompt: string
  systemPromptHash?: string
  systemPromptSnapshot?: string
  injectedRules?: string[]
  stylePresetId?: string
  agentType?: string
  modelUsed?: string
  thinkingMode?: string
}

export interface UpdateGenerationLogInput {
  agentType?: string
  modelUsed?: string
  sceneId?: string
  layerId?: string
  sceneType?: string
  generatedCodeLength?: number
  thinkingContent?: string
  generationTimeMs?: number
  inputTokens?: number
  outputTokens?: number
  thinkingTokens?: number
  costUsd?: number
  userAction?: string
  timeToActionMs?: number
  editDistance?: number
  userRating?: number
  exportSucceeded?: boolean
  exportErrorMessage?: string
  qualityScore?: number
  analysisNotes?: string
  runId?: string
  runTrace?: unknown
}

export async function createGenerationLog(input: CreateGenerationLogInput): Promise<string> {
  const [row] = await db
    .insert(generationLogs)
    .values({
      projectId: input.projectId,
      sceneId: input.sceneId,
      layerId: input.layerId,
      userPrompt: input.userPrompt,
      systemPromptHash: input.systemPromptHash,
      systemPromptSnapshot: input.systemPromptSnapshot,
      injectedRules: input.injectedRules,
      stylePresetId: input.stylePresetId,
      agentType: input.agentType,
      modelUsed: input.modelUsed,
      thinkingMode: input.thinkingMode,
    })
    .returning({ id: generationLogs.id })
  return row.id
}

export async function updateGenerationLog(id: string, updates: UpdateGenerationLogInput): Promise<void> {
  await db
    .update(generationLogs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(generationLogs.id, id))
}

export async function getGenerationLogs(
  opts: {
    projectId?: string
    sceneId?: string
    limit?: number
    offset?: number
    hasQualityScore?: boolean
  } = {},
) {
  const conditions = []
  if (opts.projectId) conditions.push(eq(generationLogs.projectId, opts.projectId))
  if (opts.sceneId) conditions.push(eq(generationLogs.sceneId, opts.sceneId))
  if (opts.hasQualityScore) conditions.push(isNotNull(generationLogs.qualityScore))

  return db
    .select()
    .from(generationLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(generationLogs.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0)
}

const ALLOWED_DIMENSIONS = new Set([
  'scene_type',
  'model_used',
  'thinking_mode',
  'style_preset_id',
  'agent_type',
] as const)

export async function getQualityByDimension(
  dimension: 'scene_type' | 'model_used' | 'thinking_mode' | 'style_preset_id' | 'agent_type',
  projectId?: string,
) {
  // Validate dimension against allowlist to prevent SQL injection via sql.raw()
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    throw new Error(`Invalid dimension: ${dimension}`)
  }

  const whereClause = projectId
    ? sql`WHERE quality_score >= 0 AND project_id = ${projectId}`
    : sql`WHERE quality_score >= 0`

  const rows = await db.execute(sql`
    SELECT
      ${sql.raw(dimension)} as dimension_value,
      AVG(quality_score) as avg_quality,
      COUNT(*) as total_count,
      SUM(CASE WHEN user_action = 'regenerated' THEN 1 ELSE 0 END) as regen_count,
      SUM(CASE WHEN user_action = 'kept' THEN 1 ELSE 0 END) as kept_count,
      SUM(CASE WHEN user_action = 'edited' THEN 1 ELSE 0 END) as edited_count,
      AVG(cost_usd) as avg_cost
    FROM generation_logs
    ${whereClause}
    GROUP BY ${sql.raw(dimension)}
    ORDER BY AVG(quality_score) DESC
  `)

  return rows as unknown as Array<{
    dimension_value: string
    avg_quality: number
    total_count: number
    regen_count: number
    kept_count: number
    edited_count: number
    avg_cost: number
  }>
}

export async function getLowQualityLogs(projectId?: string, limit = 20) {
  const whereClause = projectId
    ? sql`WHERE quality_score < 0.3 AND quality_score >= 0 AND project_id = ${projectId}`
    : sql`WHERE quality_score < 0.3 AND quality_score >= 0`

  return db.execute(sql`
    SELECT user_prompt, thinking_content, scene_type, quality_score,
           model_used, thinking_mode, style_preset_id, user_action
    FROM generation_logs
    ${whereClause}
    ORDER BY quality_score ASC
    LIMIT ${limit}
  `)
}

export async function getHighQualityLogs(projectId?: string, limit = 20) {
  const whereClause = projectId
    ? sql`WHERE quality_score > 0.8 AND project_id = ${projectId}`
    : sql`WHERE quality_score > 0.8`

  return db.execute(sql`
    SELECT user_prompt, thinking_content, scene_type, quality_score,
           model_used, thinking_mode, style_preset_id, user_action
    FROM generation_logs
    ${whereClause}
    ORDER BY quality_score DESC
    LIMIT ${limit}
  `)
}

export async function getLogsForAnalysis(limit = 50) {
  return db
    .select({
      userPrompt: generationLogs.userPrompt,
      systemPromptSnapshot: generationLogs.systemPromptSnapshot,
      injectedRules: generationLogs.injectedRules,
      stylePresetId: generationLogs.stylePresetId,
      agentType: generationLogs.agentType,
      modelUsed: generationLogs.modelUsed,
      thinkingMode: generationLogs.thinkingMode,
      sceneType: generationLogs.sceneType,
      thinkingContent: generationLogs.thinkingContent,
      userAction: generationLogs.userAction,
      timeToActionMs: generationLogs.timeToActionMs,
      editDistance: generationLogs.editDistance,
      qualityScore: generationLogs.qualityScore,
    })
    .from(generationLogs)
    .where(isNotNull(generationLogs.qualityScore))
    .orderBy(desc(generationLogs.createdAt))
    .limit(limit)
}

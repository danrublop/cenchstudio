import { NextRequest, NextResponse } from 'next/server'
import { updateGenerationLog, getGenerationLogs, getQualityByDimension } from '@/lib/db/queries/generation-logs'
import { computeQualityScore } from '@/lib/generation-logs/score'
import { getOptionalUser } from '@/lib/auth-helpers'
import { UUID_RE, VALID_USER_ACTIONS, LIMITS } from '@/lib/api/constants'

/**
 * PATCH /api/generation-log
 * Update a generation log with quality signals from the frontend.
 */
export async function PATCH(req: NextRequest) {
  try {
    await getOptionalUser()
    const body = await req.json()
    const { logId, userAction, timeToActionMs, editDistance, userRating, exportSucceeded, exportErrorMessage } = body

    if (!logId || typeof logId !== 'string' || !UUID_RE.test(logId)) {
      return NextResponse.json({ error: 'Valid logId (UUID) is required' }, { status: 400 })
    }

    // Validate userAction against allowed enum
    if (userAction && !(VALID_USER_ACTIONS as readonly string[]).includes(userAction)) {
      return NextResponse.json({ error: `userAction must be one of: ${VALID_USER_ACTIONS.join(', ')}` }, { status: 400 })
    }

    // Validate numeric fields
    if (timeToActionMs != null && (typeof timeToActionMs !== 'number' || timeToActionMs < 0 || !Number.isFinite(timeToActionMs))) {
      return NextResponse.json({ error: 'timeToActionMs must be a non-negative number' }, { status: 400 })
    }
    if (editDistance != null && (typeof editDistance !== 'number' || editDistance < 0 || !Number.isInteger(editDistance))) {
      return NextResponse.json({ error: 'editDistance must be a non-negative integer' }, { status: 400 })
    }
    if (userRating != null && (typeof userRating !== 'number' || userRating < 0 || userRating > 5)) {
      return NextResponse.json({ error: 'userRating must be between 0 and 5' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (userAction) updates.userAction = userAction
    if (timeToActionMs != null) updates.timeToActionMs = timeToActionMs
    if (editDistance != null) updates.editDistance = editDistance
    if (userRating != null) updates.userRating = userRating
    if (exportSucceeded != null) updates.exportSucceeded = exportSucceeded
    if (exportErrorMessage) updates.exportErrorMessage = exportErrorMessage

    // Compute quality score if we have enough signals
    if (userAction) {
      const score = computeQualityScore({
        userAction,
        timeToActionMs,
        editDistance,
        generatedCodeLength: body.generatedCodeLength,
        userRating,
        exportSucceeded,
      })
      if (score >= 0) updates.qualityScore = score
    }

    await updateGenerationLog(logId, updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[generation-log] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update generation log' }, { status: 500 })
  }
}

/**
 * GET /api/generation-log?projectId=X&dimension=scene_type
 * Retrieve generation logs or aggregated quality metrics.
 */
export async function GET(req: NextRequest) {
  try {
    await getOptionalUser()
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') ?? undefined
    const sceneId = searchParams.get('sceneId') ?? undefined
    const dimensionRaw = searchParams.get('dimension')
    const validDimensions = ['scene_type', 'model_used', 'thinking_mode', 'style_preset_id', 'agent_type'] as const
    const dimension = validDimensions.find((d) => d === dimensionRaw) ?? null

    if (dimension) {
      const data = await getQualityByDimension(dimension, projectId)
      return NextResponse.json({ data })
    }

    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), LIMITS.MAX_QUERY_RESULTS)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)
    const logs = await getGenerationLogs({ projectId, sceneId, limit, offset })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[generation-log] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch generation logs' }, { status: 500 })
  }
}

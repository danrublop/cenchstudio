import { NextRequest, NextResponse } from 'next/server'
import { updateGenerationLog, getGenerationLogs, getQualityByDimension } from '@/lib/db/queries/generation-logs'
import { computeQualityScore } from '@/lib/generation-logs/score'

/**
 * PATCH /api/generation-log
 * Update a generation log with quality signals from the frontend.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { logId, userAction, timeToActionMs, editDistance, userRating, exportSucceeded, exportErrorMessage } = body

    if (!logId || typeof logId !== 'string') {
      return NextResponse.json({ error: 'Missing logId' }, { status: 400 })
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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

/**
 * GET /api/generation-log?projectId=X&dimension=scene_type
 * Retrieve generation logs or aggregated quality metrics.
 */
export async function GET(req: NextRequest) {
  try {
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

    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)
    const logs = await getGenerationLogs({ projectId, sceneId, limit, offset })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[generation-log] GET error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

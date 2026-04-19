import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { analyticsEvents } from '@/lib/db/schema'
import { eq, sql, count, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.analytics-project')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params

    // Total unique session views
    const [{ views }] = await db
      .select({ views: sql<number>`count(distinct session_id)` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.publishedProjectId, projectId), eq(analyticsEvents.eventType, 'project_started')))

    // Completions
    const [{ completions }] = await db
      .select({ completions: sql<number>`count(distinct session_id)` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.publishedProjectId, projectId), eq(analyticsEvents.eventType, 'project_completed')))

    // Scene views with avg duration
    const sceneViews = await db
      .select({
        sceneId: analyticsEvents.sceneId,
        views: count(),
        uniqueSessions: sql<number>`count(distinct session_id)`,
        avgDuration: sql<number>`avg((data->>'duration')::float)`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.publishedProjectId, projectId), eq(analyticsEvents.eventType, 'scene_viewed')))
      .groupBy(analyticsEvents.sceneId)

    // Interaction stats — fires and unique sessions
    const interactionStats = await db
      .select({
        interactionId: analyticsEvents.interactionId,
        fires: count(),
        uniqueSessions: sql<number>`count(distinct session_id)`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.publishedProjectId, projectId), eq(analyticsEvents.eventType, 'interaction_fired')))
      .groupBy(analyticsEvents.interactionId)

    // Choice distribution
    const choiceStats = await db
      .select({
        interactionId: sql<string>`data->>'interactionId'`,
        selectedOption: sql<string>`data->>'selectedOption'`,
        count: count(),
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.publishedProjectId, projectId), eq(analyticsEvents.eventType, 'choice_selected')))
      .groupBy(sql`data->>'interactionId'`, sql`data->>'selectedOption'`)

    // Quiz pass/fail
    const quizStats = await db
      .select({
        interactionId: sql<string>`data->>'interactionId'`,
        correct: sql<number>`count(*) filter (where (data->>'correct')::boolean = true)`,
        wrong: sql<number>`count(*) filter (where (data->>'correct')::boolean = false)`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.publishedProjectId, projectId), eq(analyticsEvents.eventType, 'quiz_answered')))
      .groupBy(sql`data->>'interactionId'`)

    // Path flows
    const paths = await db
      .select({
        from: sql<string>`data->>'fromSceneId'`,
        to: sql<string>`data->>'toSceneId'`,
        count: count(),
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.publishedProjectId, projectId), eq(analyticsEvents.eventType, 'path_taken')))
      .groupBy(sql`data->>'fromSceneId'`, sql`data->>'toSceneId'`)

    // Build response
    const interactions: Record<string, unknown> = {}
    for (const s of interactionStats) {
      if (s.interactionId) {
        interactions[s.interactionId] = {
          fires: Number(s.fires),
          uniqueSessions: Number(s.uniqueSessions),
        }
      }
    }
    for (const c of choiceStats) {
      if (c.interactionId) {
        const entry = (interactions[c.interactionId] ?? { fires: 0, uniqueSessions: 0 }) as Record<string, unknown>
        if (!entry.options) entry.options = {} as Record<string, number>
        ;(entry.options as Record<string, number>)[c.selectedOption] = Number(c.count)
        interactions[c.interactionId] = entry
      }
    }
    for (const q of quizStats) {
      if (q.interactionId) {
        const entry = (interactions[q.interactionId] ?? { fires: 0, uniqueSessions: 0 }) as Record<string, unknown>
        entry.correct = Number(q.correct)
        entry.wrong = Number(q.wrong)
        interactions[q.interactionId] = entry
      }
    }

    return NextResponse.json(
      {
        views: Number(views),
        completions: Number(completions),
        completionRate: Number(views) > 0 ? Number(completions) / Number(views) : 0,
        sceneViews: sceneViews.map((s) => ({
          sceneId: s.sceneId,
          views: Number(s.views),
          uniqueSessions: Number(s.uniqueSessions),
          avgDuration: s.avgDuration ? Math.round(Number(s.avgDuration) * 10) / 10 : null,
        })),
        interactions,
        paths: paths.map((p) => ({
          from: p.from,
          to: p.to,
          count: Number(p.count),
        })),
      },
      { headers: CORS_HEADERS },
    )
  } catch (err) {
    log.error('Error:', { error: err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS })
  }
}

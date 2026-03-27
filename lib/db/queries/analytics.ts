import { db } from '../index';
import { analyticsEvents, publishedProjects } from '../schema';
import { eq, sql, count, and } from 'drizzle-orm';

export async function logAnalyticsEvent(data: {
  publishedProjectId: string;
  sessionId: string;
  eventType: string;
  sceneId?: string;
  interactionId?: string;
  data?: Record<string, unknown>;
  userAgent?: string;
  country?: string;
}) {
  await db.insert(analyticsEvents).values(data);
}

export async function getProjectAnalytics(publishedProjectId: string) {
  const [{ views }] = await db
    .select({ views: sql<number>`count(distinct session_id)` })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.publishedProjectId, publishedProjectId),
        eq(analyticsEvents.eventType, 'project_started')
      )
    );

  const [{ completions }] = await db
    .select({ completions: sql<number>`count(distinct session_id)` })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.publishedProjectId, publishedProjectId),
        eq(analyticsEvents.eventType, 'project_completed')
      )
    );

  const sceneViews = await db
    .select({
      sceneId: analyticsEvents.sceneId,
      views: count(),
      avgDuration: sql<number>`avg((data->>'duration')::float)`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.publishedProjectId, publishedProjectId),
        eq(analyticsEvents.eventType, 'scene_viewed')
      )
    )
    .groupBy(analyticsEvents.sceneId);

  const interactionStats = await db
    .select({
      interactionId: analyticsEvents.interactionId,
      eventType: analyticsEvents.eventType,
      count: count(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.publishedProjectId, publishedProjectId),
        eq(analyticsEvents.eventType, 'interaction_fired')
      )
    )
    .groupBy(analyticsEvents.interactionId, analyticsEvents.eventType);

  const paths = await db
    .select({
      fromScene: sql<string>`data->>'fromSceneId'`,
      toScene: sql<string>`data->>'toSceneId'`,
      count: count(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.publishedProjectId, publishedProjectId),
        eq(analyticsEvents.eventType, 'path_taken')
      )
    )
    .groupBy(
      sql`data->>'fromSceneId'`,
      sql`data->>'toSceneId'`
    );

  return {
    views: Number(views),
    completions: Number(completions),
    completionRate: views > 0 ? Number(completions) / Number(views) : 0,
    sceneViews,
    interactionStats,
    paths,
  };
}

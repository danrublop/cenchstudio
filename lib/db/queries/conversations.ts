import { db } from '../index';
import { conversations } from '../schema';
import { eq, asc, desc } from 'drizzle-orm';

export async function addConversationMessage(data: typeof conversations.$inferInsert) {
  const [msg] = await db.insert(conversations).values(data).returning();
  return msg;
}

export async function getConversationHistory(projectId: string, limit = 50) {
  return db.query.conversations.findMany({
    where: eq(conversations.projectId, projectId),
    orderBy: asc(conversations.createdAt),
    limit,
  });
}

export async function getRecentConversations(projectId: string, limit = 10) {
  return db.query.conversations.findMany({
    where: eq(conversations.projectId, projectId),
    orderBy: desc(conversations.createdAt),
    limit,
  });
}

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredUser, AuthError } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { workspaces, projects, conversations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  createRule,
  deleteRule,
  listRulesForUser,
  purgeExpiredRules,
  type CreateRuleInput,
} from '@/lib/db/queries/permission-rules'
import type { APIName, PermissionDecision, PermissionScope, RuleSpecifier } from '@/lib/types/permissions'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.permissions')

export const runtime = 'nodejs'

// ── GET: list all rules owned by the authenticated user ────────────────────
export async function GET() {
  try {
    const user = await getRequiredUser()
    // Opportunistic cleanup (5% of listing calls) so expired session rules
    // don't pile up indefinitely without a cron.
    if (Math.random() < 0.05) {
      purgeExpiredRules().catch((e) => log.warn('purge failed', { error: e }))
    }
    const rules = await listRulesForUser(user.id)
    return NextResponse.json({ rules: rules.map(serializeRule) })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

/** Dates → ISO strings so clients don't need to guess the wire shape. */
function serializeRule(rule: import('@/lib/types/permissions').PermissionRule) {
  return {
    ...rule,
    createdAt: rule.createdAt.toISOString(),
    expiresAt: rule.expiresAt ? rule.expiresAt.toISOString() : null,
  }
}

// ── POST: create a rule ────────────────────────────────────────────────────
interface CreateBody {
  scope: PermissionScope
  workspaceId?: string | null
  projectId?: string | null
  conversationId?: string | null
  decision: PermissionDecision
  api: APIName | '*'
  specifier?: RuleSpecifier | null
  costCapUsd?: number | null
  expiresAt?: string | null
  notes?: string | null
}

export async function POST(req: NextRequest) {
  let user
  try {
    user = await getRequiredUser()
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.scope || !body.decision || !body.api) {
    return NextResponse.json({ error: 'scope, decision, and api are required' }, { status: 400 })
  }

  // Verify the user owns every referenced scope target before the DB write.
  if (body.workspaceId) {
    const ok = await ownsWorkspace(user.id, body.workspaceId)
    if (!ok) return NextResponse.json({ error: 'Unknown or unauthorized workspace' }, { status: 403 })
  }
  if (body.projectId) {
    const ok = await ownsProject(user.id, body.projectId)
    if (!ok) return NextResponse.json({ error: 'Unknown or unauthorized project' }, { status: 403 })
  }
  if (body.conversationId) {
    const ok = await ownsConversation(user.id, body.conversationId)
    if (!ok) return NextResponse.json({ error: 'Unknown or unauthorized conversation' }, { status: 403 })
  }

  const input: CreateRuleInput = {
    userId: user.id,
    scope: body.scope,
    workspaceId: body.workspaceId ?? null,
    projectId: body.projectId ?? null,
    conversationId: body.conversationId ?? null,
    decision: body.decision,
    api: body.api,
    specifier: body.specifier ?? null,
    costCapUsd: body.costCapUsd ?? null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    createdBy: 'user-settings',
    notes: body.notes ?? null,
  }

  try {
    const rule = await createRule(input)
    return NextResponse.json({ rule: serializeRule(rule) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create rule'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

// ── DELETE: delete a rule by id ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  let user
  try {
    user = await getRequiredUser()
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const removed = await deleteRule(id, user.id)
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// ── Scope ownership checks ─────────────────────────────────────────────────

async function ownsWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  return !!row && row.userId === userId
}

async function ownsProject(userId: string, projectId: string): Promise<boolean> {
  const [row] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, projectId)).limit(1)
  return !!row && row.userId === userId
}

async function ownsConversation(userId: string, conversationId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: projects.userId })
    .from(conversations)
    .innerJoin(projects, eq(conversations.projectId, projects.id))
    .where(eq(conversations.id, conversationId))
    .limit(1)
  return !!row && row.userId === userId
}

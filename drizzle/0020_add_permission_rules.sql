-- Permission rules — Claude-Code-style layered scopes.
-- Rows here supersede the enum modes in projects.api_permissions for the
-- allow/deny/ask decision. Spend caps + cost threshold columns on
-- projects.api_permissions remain the source of truth for cost gating.
CREATE TABLE "permission_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" text NOT NULL,
  "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE CASCADE,
  "decision" text NOT NULL,
  "api" text NOT NULL,
  "specifier" jsonb DEFAULT null,
  "cost_cap_usd" real,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL DEFAULT 'user-settings',
  "notes" text,
  CONSTRAINT "permission_rules_scope_chk"
    CHECK ("scope" IN ('user', 'workspace', 'project', 'session')),
  CONSTRAINT "permission_rules_decision_chk"
    CHECK ("decision" IN ('allow', 'deny', 'ask')),
  CONSTRAINT "permission_rules_scope_ids_chk" CHECK (
    ("scope" = 'user' AND "workspace_id" IS NULL AND "project_id" IS NULL AND "conversation_id" IS NULL)
    OR ("scope" = 'workspace' AND "workspace_id" IS NOT NULL AND "project_id" IS NULL AND "conversation_id" IS NULL)
    OR ("scope" = 'project' AND "project_id" IS NOT NULL AND "conversation_id" IS NULL)
    OR ("scope" = 'session' AND "conversation_id" IS NOT NULL)
  )
);

CREATE INDEX "permission_rules_user_scope_idx" ON "permission_rules" ("user_id", "scope");
CREATE INDEX "permission_rules_project_idx" ON "permission_rules" ("project_id");
CREATE INDEX "permission_rules_workspace_idx" ON "permission_rules" ("workspace_id");
CREATE INDEX "permission_rules_conversation_idx" ON "permission_rules" ("conversation_id", "expires_at");
-- Partial index for the common case of permanent (non-expiring) rules.
-- NOW() cannot appear in a partial index predicate (non-immutable), so we cover
-- only IS NULL here; findMatchingRules still filters expires_at > NOW() at query time.
CREATE INDEX "permission_rules_permanent_idx"
  ON "permission_rules" ("user_id", "scope")
  WHERE "expires_at" IS NULL;

-- Backfill: convert project.api_permissions enum modes into project-scope rules.
-- 'always_allow' → allow row, 'always_deny' → deny row.
-- 'always_ask' / 'ask_once' / missing / unknown modes → no row (default is ask).
INSERT INTO "permission_rules" (
  "user_id", "scope", "project_id", "decision", "api", "created_by", "notes"
)
SELECT
  p.user_id,
  'project',
  p.id,
  CASE (entry.value ->> 'mode')
    WHEN 'always_allow' THEN 'allow'
    WHEN 'always_deny'  THEN 'deny'
  END,
  entry.key,
  'migration',
  'Migrated from legacy api_permissions enum'
FROM "projects" p,
     jsonb_each(COALESCE(p.api_permissions, '{}'::jsonb)) AS entry
WHERE
  p.user_id IS NOT NULL
  AND (entry.value ->> 'mode') IN ('always_allow', 'always_deny');

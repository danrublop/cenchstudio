-- Workspaces: container for grouping multiple projects
CREATE TABLE "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "icon" text,
  "brand_kit" jsonb DEFAULT null,
  "global_style" jsonb DEFAULT null,
  "settings" jsonb DEFAULT '{}',
  "is_default" boolean DEFAULT false,
  "is_archived" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "workspaces_user_idx" ON "workspaces" ("user_id");
CREATE INDEX "workspaces_default_idx" ON "workspaces" ("user_id", "is_default");

-- Add workspace FK to projects (nullable, existing projects stay unassigned)
ALTER TABLE "projects" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL;
CREATE INDEX "projects_workspace_idx" ON "projects" ("workspace_id");

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "agent_config" jsonb DEFAULT NULL;

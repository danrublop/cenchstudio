ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "run_checkpoint" jsonb DEFAULT NULL;

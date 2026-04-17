-- Add missing columns to messages table that the schema expects
-- These were added to lib/db/schema.ts after migration 0015 created the table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'complete';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "content_segments" jsonb;

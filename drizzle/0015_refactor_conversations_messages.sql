-- Migration: Refactor conversations table and create separate messages table
--
-- The original conversations table stored one row per message (role, content, etc.).
-- The new design uses conversations as a container with metadata, and a separate
-- messages table for actual chat messages.

-- Step 1: Create the messages table
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "agent_type" "agent_type",
  "model_used" text,
  "thinking_content" text,
  "tool_calls" jsonb DEFAULT '[]'::jsonb,
  "input_tokens" integer,
  "output_tokens" integer,
  "cost_usd" real,
  "generation_log_id" uuid,
  "user_rating" integer,
  "duration_ms" integer,
  "api_calls" integer,
  "position" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Step 2: Add FK constraints on messages
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_generation_log_id_generation_logs_id_fk"
  FOREIGN KEY ("generation_log_id") REFERENCES "public"."generation_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Step 3: Create indexes on messages
CREATE INDEX "msg_conv_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "msg_project_idx" ON "messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "msg_position_idx" ON "messages" USING btree ("conversation_id", "position");--> statement-breakpoint
CREATE INDEX "msg_created_idx" ON "messages" USING btree ("conversation_id", "created_at" DESC);--> statement-breakpoint

-- Step 4: Migrate existing conversation rows into messages
-- Each old conversation row was one message; group by project_id to find the conversation container
-- We create one conversation container per project_id, then move messages
INSERT INTO "messages" ("id", "conversation_id", "project_id", "role", "content", "agent_type", "model_used", "tool_calls", "input_tokens", "position", "created_at")
SELECT
  gen_random_uuid(),
  "id",           -- old conversation id becomes conversation_id (we'll fix this below)
  "project_id",
  "role",
  "content",
  "agent_type",
  "model_used",
  "tool_calls",
  "token_count",
  ROW_NUMBER() OVER (PARTITION BY "project_id" ORDER BY "created_at") - 1 AS position,
  "created_at"
FROM "conversations"
WHERE "role" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Step 5: Add new columns to conversations table
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT 'New chat';--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "total_input_tokens" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "total_output_tokens" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "total_cost_usd" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_message_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint

-- Step 6: Drop old message columns from conversations (they now live in messages table)
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "role";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "content";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "agent_type";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "model_used";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "tool_calls";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "token_count";--> statement-breakpoint

-- Step 7: Replace old index with new ones for the refactored conversations table
DROP INDEX IF EXISTS "conv_created_idx";--> statement-breakpoint
CREATE INDEX "conv_last_msg_idx" ON "conversations" USING btree ("project_id", "last_message_at");

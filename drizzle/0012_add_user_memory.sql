CREATE TABLE IF NOT EXISTS "user_memory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "confidence" real NOT NULL DEFAULT 0.5,
  "source_run_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_memory_user_idx" ON "user_memory" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_memory_user_key_idx" ON "user_memory" ("user_id", "category", "key");

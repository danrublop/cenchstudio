-- Add provenance columns to project_assets so every AI-generated asset records
-- prompt, provider, model, cost, references, and lineage. Powers the Media tab's
-- Generate/Gallery panels and enables query_media_library / reuse_asset / regenerate_asset
-- agent tools.

ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "prompt" text;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "model" text;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "cost_cents" integer;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "parent_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "reference_asset_ids" jsonb;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "enhance_tags" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_assets_source_idx" ON "project_assets" ("project_id","source");

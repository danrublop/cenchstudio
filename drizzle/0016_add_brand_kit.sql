ALTER TABLE "projects" ADD COLUMN "brand_kit" jsonb DEFAULT null;
ALTER TABLE "project_assets" ADD COLUMN "extracted_colors" text[] DEFAULT '{}' NOT NULL;

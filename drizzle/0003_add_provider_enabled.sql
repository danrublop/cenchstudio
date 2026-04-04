ALTER TABLE "projects" ADD COLUMN "audio_provider_enabled" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "projects" ADD COLUMN "media_gen_enabled" jsonb DEFAULT '{}'::jsonb;

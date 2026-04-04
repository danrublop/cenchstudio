-- Avatar configs table
CREATE TABLE IF NOT EXISTS "avatar_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" text DEFAULT 'talkinghead' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name" text DEFAULT 'Default Avatar' NOT NULL,
	"thumbnail_url" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Avatar videos table
CREATE TABLE IF NOT EXISTS "avatar_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_id" uuid,
	"avatar_config_id" uuid,
	"provider" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"text" text NOT NULL,
	"audio_url" text,
	"source_image_url" text,
	"video_url" text,
	"duration_seconds" real,
	"error_message" text,
	"cost_usd" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add avatar config reference to scenes
ALTER TABLE "scenes" ADD COLUMN IF NOT EXISTS "avatar_config_id" uuid;

-- Foreign key for scenes → avatar_configs
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_avatar_config_id_avatar_configs_id_fk" FOREIGN KEY ("avatar_config_id") REFERENCES "public"."avatar_configs"("id") ON DELETE set null ON UPDATE no action;

-- Foreign keys
ALTER TABLE "avatar_configs" ADD CONSTRAINT "avatar_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "avatar_videos" ADD CONSTRAINT "avatar_videos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "avatar_videos" ADD CONSTRAINT "avatar_videos_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "avatar_videos" ADD CONSTRAINT "avatar_videos_avatar_config_id_avatar_configs_id_fk" FOREIGN KEY ("avatar_config_id") REFERENCES "public"."avatar_configs"("id") ON DELETE set null ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "avatar_configs_project_idx" ON "avatar_configs" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "avatar_configs_default_idx" ON "avatar_configs" USING btree ("project_id","is_default");
CREATE INDEX IF NOT EXISTS "avatar_videos_project_idx" ON "avatar_videos" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "avatar_videos_scene_idx" ON "avatar_videos" USING btree ("scene_id");
CREATE INDEX IF NOT EXISTS "avatar_videos_status_idx" ON "avatar_videos" USING btree ("status");

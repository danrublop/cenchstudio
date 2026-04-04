CREATE TYPE "public"."agent_type" AS ENUM('router', 'director', 'scene-maker', 'editor', 'dop');--> statement-breakpoint
CREATE TYPE "public"."layer_type" AS ENUM('canvas2d', 'svg', 'd3', 'three', 'zdog', 'lottie', 'html', 'assets', 'group', 'avatar', 'veo3', 'image', 'sticker');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'generating', 'processing', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."output_mode" AS ENUM('mp4', 'interactive');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'team');--> statement-breakpoint
CREATE TYPE "public"."storage_mode" AS ENUM('local', 'cloud');--> statement-breakpoint
CREATE TABLE "agent_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"agent_type" text NOT NULL,
	"model_id" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"api_calls" integer DEFAULT 1 NOT NULL,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"published_project_id" text,
	"session_id" text NOT NULL,
	"event_type" text NOT NULL,
	"scene_id" text,
	"interaction_id" text,
	"data" jsonb DEFAULT '{}'::jsonb,
	"user_agent" text,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"project_id" text,
	"api" text NOT NULL,
	"cost_usd" real NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"description" text,
	"type" text DEFAULT 'canvas',
	"canvas_draw_fn" text,
	"svg_data" text,
	"default_width" integer DEFAULT 200,
	"default_height" integer DEFAULT 200,
	"bounds" jsonb,
	"thumbnail_url" text,
	"is_built_in" boolean DEFAULT true,
	"is_public" boolean DEFAULT false,
	"user_id" uuid,
	"use_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"agent_type" "agent_type",
	"model_used" text,
	"tool_calls" jsonb DEFAULT '[]'::jsonb,
	"token_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"prompt" text,
	"model" text,
	"url" text,
	"status" "media_status" DEFAULT 'pending',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"cost_usd" real,
	"external_job_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"scene_id" uuid,
	"layer_id" uuid,
	"user_prompt" text NOT NULL,
	"system_prompt_hash" text,
	"system_prompt_snapshot" text,
	"injected_rules" jsonb,
	"style_preset_id" text,
	"agent_type" text,
	"model_used" text,
	"thinking_mode" text,
	"scene_type" text,
	"generated_code_length" integer,
	"thinking_content" text,
	"generation_time_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"thinking_tokens" integer,
	"cost_usd" real,
	"user_action" text,
	"time_to_action_ms" integer,
	"edit_distance" integer,
	"user_rating" integer,
	"export_succeeded" boolean,
	"export_error_message" text,
	"quality_score" real,
	"analysis_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"type" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"parent_layer_id" uuid,
	"type" "layer_type" NOT NULL,
	"label" text,
	"z_index" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"opacity" real DEFAULT 1 NOT NULL,
	"blend_mode" text DEFAULT 'normal',
	"start_at" real DEFAULT 0 NOT NULL,
	"duration" real,
	"generated_code" text,
	"elements" jsonb DEFAULT '[]'::jsonb,
	"asset_placements" jsonb DEFAULT '[]'::jsonb,
	"prompt" text,
	"model_used" text,
	"generated_at" timestamp,
	"layer_config" jsonb,
	"media_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_cache" (
	"hash" text PRIMARY KEY NOT NULL,
	"api" text NOT NULL,
	"file_path" text NOT NULL,
	"prompt" text,
	"model" text,
	"config" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_sessions" (
	"api" text PRIMARY KEY NOT NULL,
	"decision" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"output_mode" "output_mode" DEFAULT 'mp4',
	"storage_mode" "storage_mode" DEFAULT 'local',
	"global_style" jsonb DEFAULT '{"presetId":"whiteboard","paletteOverride":null,"bgColorOverride":null,"fontOverride":null,"strokeColorOverride":null}'::jsonb,
	"mp4_settings" jsonb DEFAULT '{"resolution":"1080p","fps":30,"format":"mp4"}'::jsonb,
	"interactive_settings" jsonb DEFAULT '{"playerTheme":"dark","showProgressBar":true,"showSceneNav":false,"allowFullscreen":true,"brandColor":"#e84545","customDomain":null,"password":null}'::jsonb,
	"api_permissions" jsonb DEFAULT '{}'::jsonb,
	"thumbnail_url" text,
	"is_archived" boolean DEFAULT false,
	"last_opened_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"manifest" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_password_protected" boolean DEFAULT false,
	"password_hash" text,
	"is_active" boolean DEFAULT true,
	"view_count" integer DEFAULT 0,
	"custom_domain" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"from_scene_id" uuid,
	"to_scene_id" uuid,
	"condition" jsonb DEFAULT '{"type":"auto","interactionId":null,"variableName":null,"variableValue":null}'::jsonb,
	"position" jsonb
);
--> statement-breakpoint
CREATE TABLE "scene_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"layers" jsonb DEFAULT '[]'::jsonb,
	"duration" real DEFAULT 8,
	"style_override" jsonb DEFAULT '{}'::jsonb,
	"placeholders" jsonb DEFAULT '[]'::jsonb,
	"thumbnail_url" text,
	"is_built_in" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"user_id" uuid,
	"use_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text,
	"position" integer NOT NULL,
	"duration" real DEFAULT 8 NOT NULL,
	"bg_color" text DEFAULT '#fffef9',
	"style_override" jsonb DEFAULT '{}'::jsonb,
	"transition" jsonb DEFAULT '{"type":"none","duration":0.5}'::jsonb,
	"audio_layer" jsonb,
	"video_layer" jsonb,
	"thumbnail_url" text,
	"grid_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"diff" jsonb NOT NULL,
	"agent_message" text,
	"agent_type" "agent_type",
	"stack_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "three_d_components" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"description" text,
	"build_fn" text,
	"thumbnail_url" text,
	"animates" boolean DEFAULT true,
	"is_built_in" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"plan" "plan" DEFAULT 'free',
	"default_storage_mode" "storage_mode" DEFAULT 'local',
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_published_project_id_published_projects_id_fk" FOREIGN KEY ("published_project_id") REFERENCES "public"."published_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_spend" ADD CONSTRAINT "api_spend_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_media" ADD CONSTRAINT "generated_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_media_id_generated_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."generated_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_projects" ADD CONSTRAINT "published_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_projects" ADD CONSTRAINT "published_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_edges" ADD CONSTRAINT "scene_edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_edges" ADD CONSTRAINT "scene_edges_from_scene_id_scenes_id_fk" FOREIGN KEY ("from_scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_edges" ADD CONSTRAINT "scene_edges_to_scene_id_scenes_id_fk" FOREIGN KEY ("to_scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_templates" ADD CONSTRAINT "scene_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_usage_project_idx" ON "agent_usage" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_usage_agent_idx" ON "agent_usage" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "agent_usage_month_idx" ON "agent_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_project_idx" ON "analytics_events" USING btree ("published_project_id");--> statement-breakpoint
CREATE INDEX "analytics_event_type_idx" ON "analytics_events" USING btree ("published_project_id","event_type");--> statement-breakpoint
CREATE INDEX "analytics_session_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "analytics_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "spend_user_idx" ON "api_spend" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "spend_month_idx" ON "api_spend" USING btree ("user_id",date_trunc('month', "created_at"));--> statement-breakpoint
CREATE INDEX "assets_category_idx" ON "assets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "assets_public_idx" ON "assets" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "assets_search_idx" ON "assets" USING gin (to_tsvector('english', "name" || ' ' || coalesce("description", '')));--> statement-breakpoint
CREATE INDEX "conv_project_idx" ON "conversations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "conv_created_idx" ON "conversations" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_hash_idx" ON "generated_media" USING btree ("prompt_hash");--> statement-breakpoint
CREATE INDEX "media_user_idx" ON "generated_media" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_status_idx" ON "generated_media" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gen_log_project_idx" ON "generation_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "gen_log_model_idx" ON "generation_logs" USING btree ("model_used");--> statement-breakpoint
CREATE INDEX "gen_log_preset_idx" ON "generation_logs" USING btree ("style_preset_id");--> statement-breakpoint
CREATE INDEX "gen_log_action_idx" ON "generation_logs" USING btree ("user_action");--> statement-breakpoint
CREATE INDEX "gen_log_created_idx" ON "generation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "interactions_scene_idx" ON "interactions" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "layers_scene_idx" ON "layers" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "layers_type_idx" ON "layers" USING btree ("scene_id","type");--> statement-breakpoint
CREATE INDEX "layers_zindex_idx" ON "layers" USING btree ("scene_id","z_index");--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_archived_idx" ON "projects" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "projects_updated_idx" ON "projects" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "published_project_idx" ON "published_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "published_active_idx" ON "published_projects" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "edges_project_idx" ON "scene_edges" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "templates_category_idx" ON "scene_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "templates_public_idx" ON "scene_templates" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "scenes_project_idx" ON "scenes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "scenes_position_idx" ON "scenes" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "snapshots_project_idx" ON "snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "snapshots_stack_idx" ON "snapshots" USING btree ("project_id","stack_index");
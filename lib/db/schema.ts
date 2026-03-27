import {
  pgTable, text, uuid, timestamp, jsonb,
  integer, real, boolean, index, uniqueIndex,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type {
  GlobalStyle, SceneStyleOverride, TransitionConfig,
  AudioLayer, VideoLayer, SceneLayer, SceneElement,
  InteractionElement, EdgeCondition, PublishedProject,
  MP4Settings, InteractiveSettings, AssetPlacement,
} from '../types';

// ── Enums ──────────────────────────────────────────────
export const outputModeEnum = pgEnum('output_mode', ['mp4', 'interactive']);
export const storageModeEnum = pgEnum('storage_mode', ['local', 'cloud']);
export const layerTypeEnum = pgEnum('layer_type', [
  'canvas2d', 'svg', 'd3', 'three', 'zdog',
  'lottie', 'html', 'assets', 'group',
  'avatar', 'veo3', 'image', 'sticker'
]);
export const agentTypeEnum = pgEnum('agent_type', [
  'router', 'director', 'scene-maker', 'editor', 'dop'
]);
export const mediaStatusEnum = pgEnum('media_status', [
  'pending', 'generating', 'processing', 'ready', 'error'
]);
export const planEnum = pgEnum('plan', ['free', 'pro', 'team']);

// ── Users ──────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  plan: planEnum('plan').default('free'),
  defaultStorageMode: storageModeEnum('default_storage_mode').default('local'),
  preferences: jsonb('preferences').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Projects ───────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  outputMode: outputModeEnum('output_mode').default('mp4'),
  storageMode: storageModeEnum('storage_mode').default('local'),
  globalStyle: jsonb('global_style').$type<GlobalStyle>().default({
    palette: ['#1a1a2e', '#e84545', '#16a34a', '#2563eb', '#fffef9'],
    strokeWidth: 2.5,
    font: 'Caveat',
    duration: 8,
    theme: 'light',
  }),
  mp4Settings: jsonb('mp4_settings').$type<MP4Settings>().default({
    resolution: '1080p',
    fps: 30,
    format: 'mp4',
  }),
  interactiveSettings: jsonb('interactive_settings')
    .$type<InteractiveSettings>()
    .default({
      playerTheme: 'dark',
      showProgressBar: true,
      showSceneNav: false,
      allowFullscreen: true,
      brandColor: '#e84545',
      customDomain: null,
      password: null,
    }),
  apiPermissions: jsonb('api_permissions').default({}),
  thumbnailUrl: text('thumbnail_url'),
  isArchived: boolean('is_archived').default(false),
  lastOpenedAt: timestamp('last_opened_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('projects_user_idx').on(t.userId),
  archivedIdx: index('projects_archived_idx').on(t.userId, t.isArchived),
  updatedIdx: index('projects_updated_idx').on(t.userId, t.updatedAt),
}));

// ── Scenes ─────────────────────────────────────────────
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name'),
  position: integer('position').notNull(),
  duration: real('duration').default(8).notNull(),
  bgColor: text('bg_color').default('#fffef9'),
  styleOverride: jsonb('style_override')
    .$type<SceneStyleOverride>()
    .default({}),
  transition: jsonb('transition').$type<TransitionConfig>().default({
    type: 'none',
    duration: 0.5,
  }),
  audioLayer: jsonb('audio_layer').$type<AudioLayer>(),
  videoLayer: jsonb('video_layer').$type<VideoLayer>(),
  thumbnailUrl: text('thumbnail_url'),
  gridConfig: jsonb('grid_config'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  projectIdx: index('scenes_project_idx').on(t.projectId),
  positionIdx: index('scenes_position_idx').on(t.projectId, t.position),
}));

// ── Generated Media Cache ───────────────────────────────
export const generatedMedia = pgTable('generated_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  type: text('type').notNull(),
  promptHash: text('prompt_hash').notNull(),
  prompt: text('prompt'),
  model: text('model'),
  url: text('url'),
  status: mediaStatusEnum('status').default('pending'),
  metadata: jsonb('metadata').default({}),
  costUsd: real('cost_usd'),
  externalJobId: text('external_job_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  hashIdx: uniqueIndex('media_hash_idx').on(t.promptHash),
  userIdx: index('media_user_idx').on(t.userId),
  statusIdx: index('media_status_idx').on(t.status),
}));

// ── Layers ─────────────────────────────────────────────
export const layers = pgTable('layers', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id')
    .notNull()
    .references(() => scenes.id, { onDelete: 'cascade' }),
  parentLayerId: uuid('parent_layer_id'),
  type: layerTypeEnum('type').notNull(),
  label: text('label'),
  zIndex: integer('z_index').default(0).notNull(),
  visible: boolean('visible').default(true).notNull(),
  opacity: real('opacity').default(1).notNull(),
  blendMode: text('blend_mode').default('normal'),
  startAt: real('start_at').default(0).notNull(),
  duration: real('duration'),
  generatedCode: text('generated_code'),
  elements: jsonb('elements').$type<SceneElement[]>().default([]),
  assetPlacements: jsonb('asset_placements')
    .$type<AssetPlacement[]>()
    .default([]),
  prompt: text('prompt'),
  modelUsed: text('model_used'),
  generatedAt: timestamp('generated_at'),
  layerConfig: jsonb('layer_config'),
  mediaId: uuid('media_id').references(() => generatedMedia.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  sceneIdx: index('layers_scene_idx').on(t.sceneId),
  typeIdx: index('layers_type_idx').on(t.sceneId, t.type),
  zIndexIdx: index('layers_zindex_idx').on(t.sceneId, t.zIndex),
}));

// ── Scene Graph ─────────────────────────────────────────
export const sceneEdges = pgTable('scene_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  fromSceneId: uuid('from_scene_id')
    .references(() => scenes.id, { onDelete: 'cascade' }),
  toSceneId: uuid('to_scene_id')
    .references(() => scenes.id, { onDelete: 'cascade' }),
  condition: jsonb('condition').$type<EdgeCondition>().default({
    type: 'auto',
    interactionId: null,
    variableName: null,
    variableValue: null,
  }),
  position: jsonb('position'),
}, (t) => ({
  projectIdx: index('edges_project_idx').on(t.projectId),
}));

// ── Interactions ────────────────────────────────────────
export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id')
    .notNull()
    .references(() => scenes.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  config: jsonb('config').$type<InteractionElement>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  sceneIdx: index('interactions_scene_idx').on(t.sceneId),
}));

// ── Assets ──────────────────────────────────────────────
export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  tags: jsonb('tags').$type<string[]>().default([]),
  description: text('description'),
  type: text('type').default('canvas'),
  canvasDrawFn: text('canvas_draw_fn'),
  svgData: text('svg_data'),
  defaultWidth: integer('default_width').default(200),
  defaultHeight: integer('default_height').default(200),
  bounds: jsonb('bounds'),
  thumbnailUrl: text('thumbnail_url'),
  isBuiltIn: boolean('is_built_in').default(true),
  isPublic: boolean('is_public').default(false),
  userId: uuid('user_id').references(() => users.id),
  useCount: integer('use_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  categoryIdx: index('assets_category_idx').on(t.category),
  publicIdx: index('assets_public_idx').on(t.isPublic),
  searchIdx: index('assets_search_idx').using(
    'gin',
    sql`to_tsvector('english', ${t.name} || ' ' || coalesce(${t.description}, ''))`
  ),
}));

// ── 3D Components ───────────────────────────────────────
export const threeDComponents = pgTable('three_d_components', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  tags: jsonb('tags').$type<string[]>().default([]),
  description: text('description'),
  buildFn: text('build_fn'),
  thumbnailUrl: text('thumbnail_url'),
  animates: boolean('animates').default(true),
  isBuiltIn: boolean('is_built_in').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Scene Templates ─────────────────────────────────────
export const sceneTemplates = pgTable('scene_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  tags: jsonb('tags').$type<string[]>().default([]),
  layers: jsonb('layers').$type<Omit<SceneLayer, 'id'>[]>().default([]),
  duration: real('duration').default(8),
  styleOverride: jsonb('style_override').$type<SceneStyleOverride>().default({}),
  placeholders: jsonb('placeholders').$type<string[]>().default([]),
  thumbnailUrl: text('thumbnail_url'),
  isBuiltIn: boolean('is_built_in').default(false),
  isPublic: boolean('is_public').default(false),
  userId: uuid('user_id').references(() => users.id),
  useCount: integer('use_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  categoryIdx: index('templates_category_idx').on(t.category),
  publicIdx: index('templates_public_idx').on(t.isPublic),
}));

// ── Snapshots (undo/redo) ───────────────────────────────
export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  operation: text('operation').notNull(),
  diff: jsonb('diff').notNull(),
  agentMessage: text('agent_message'),
  agentType: agentTypeEnum('agent_type'),
  stackIndex: integer('stack_index').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  projectIdx: index('snapshots_project_idx').on(t.projectId),
  stackIdx: index('snapshots_stack_idx').on(t.projectId, t.stackIndex),
}));

// ── API Spend ───────────────────────────────────────────
export const apiSpend = pgTable('api_spend', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  projectId: text('project_id'),
  api: text('api').notNull(),
  costUsd: real('cost_usd').notNull(),
  description: text('description'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('spend_user_idx').on(t.userId),
  monthIdx: index('spend_month_idx').on(
    t.userId,
    sql`date_trunc('month', ${t.createdAt})`
  ),
}));

// ── Published Projects ──────────────────────────────────
export const publishedProjects = pgTable('published_projects', {
  id: text('id').primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  manifest: jsonb('manifest').$type<PublishedProject>(),
  version: integer('version').default(1).notNull(),
  isPasswordProtected: boolean('is_password_protected').default(false),
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').default(true),
  viewCount: integer('view_count').default(0),
  customDomain: text('custom_domain'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  projectIdx: index('published_project_idx').on(t.projectId),
  activeIdx: index('published_active_idx').on(t.isActive),
}));

// ── Analytics Events ────────────────────────────────────
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  publishedProjectId: text('published_project_id')
    .references(() => publishedProjects.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  eventType: text('event_type').notNull(),
  sceneId: text('scene_id'),
  interactionId: text('interaction_id'),
  data: jsonb('data').default({}),
  userAgent: text('user_agent'),
  country: text('country'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  projectIdx: index('analytics_project_idx').on(t.publishedProjectId),
  eventTypeIdx: index('analytics_event_type_idx').on(
    t.publishedProjectId, t.eventType
  ),
  sessionIdx: index('analytics_session_idx').on(t.sessionId),
  createdIdx: index('analytics_created_idx').on(t.createdAt),
}));

// ── Conversation History ────────────────────────────────
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  agentType: agentTypeEnum('agent_type'),
  modelUsed: text('model_used'),
  toolCalls: jsonb('tool_calls').default([]),
  tokenCount: integer('token_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  projectIdx: index('conv_project_idx').on(t.projectId),
  createdIdx: index('conv_created_idx').on(t.projectId, t.createdAt),
}));

// ── Media Cache (replaces SQLite media_cache) ───────────
export const mediaCache = pgTable('media_cache', {
  hash: text('hash').primaryKey(),
  api: text('api').notNull(),
  filePath: text('file_path').notNull(),
  prompt: text('prompt'),
  model: text('model'),
  config: text('config'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Permission Sessions (replaces SQLite) ───────────────
export const permissionSessions = pgTable('permission_sessions', {
  api: text('api').primaryKey(),
  decision: text('decision').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Agent Usage (replaces SQLite) ───────────────────────
export const agentUsage = pgTable('agent_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: text('project_id').notNull(),
  agentType: text('agent_type').notNull(),
  modelId: text('model_id').notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  apiCalls: integer('api_calls').default(1).notNull(),
  toolCalls: integer('tool_calls').default(0).notNull(),
  costUsd: real('cost_usd').default(0).notNull(),
  durationMs: integer('duration_ms').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  projectIdx: index('agent_usage_project_idx').on(t.projectId),
  agentIdx: index('agent_usage_agent_idx').on(t.agentType),
  monthIdx: index('agent_usage_month_idx').on(t.createdAt),
}));

// ── Relations ───────────────────────────────────────────
export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  scenes: many(scenes),
  sceneEdges: many(sceneEdges),
  snapshots: many(snapshots),
  conversations: many(conversations),
  publishedProjects: many(publishedProjects),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
  layers: many(layers),
  interactions: many(interactions),
}));

export const layersRelations = relations(layers, ({ one, many }) => ({
  scene: one(scenes, { fields: [layers.sceneId], references: [scenes.id] }),
  parent: one(layers, {
    fields: [layers.parentLayerId],
    references: [layers.id],
    relationName: 'layer_parent',
  }),
  children: many(layers, { relationName: 'layer_parent' }),
  media: one(generatedMedia, {
    fields: [layers.mediaId],
    references: [generatedMedia.id],
  }),
}));

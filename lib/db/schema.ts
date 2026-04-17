import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  real,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'
import { relations, sql } from 'drizzle-orm'
import type {
  GlobalStyle,
  SceneStyleOverride,
  TransitionConfig,
  AudioLayer,
  VideoLayer,
  SceneLayer,
  SceneElement,
  InteractionElement,
  EdgeCondition,
  PublishedProject,
  MP4Settings,
  InteractiveSettings,
  AssetPlacement,
  AudioSettings,
  BrandKit,
} from '../types'
import type { Storyboard } from '../agents/types'

// ── Enums ──────────────────────────────────────────────
export const outputModeEnum = pgEnum('output_mode', ['mp4', 'interactive'])
export const storageModeEnum = pgEnum('storage_mode', ['local', 'cloud'])
export const layerTypeEnum = pgEnum('layer_type', [
  'canvas2d',
  'svg',
  'd3',
  'three',
  'zdog',
  'lottie',
  'html',
  'assets',
  'group',
  'avatar',
  'veo3',
  'image',
  'sticker',
])
export const agentTypeEnum = pgEnum('agent_type', ['router', 'director', 'scene-maker', 'editor', 'dop', 'planner'])
export const mediaStatusEnum = pgEnum('media_status', ['pending', 'generating', 'processing', 'ready', 'error'])
export const planEnum = pgEnum('plan', ['free', 'pro', 'team'])

// ── Users ──────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  avatarUrl: text('avatar_url'),
  plan: planEnum('plan').default('free'),
  defaultStorageMode: storageModeEnum('default_storage_mode').default('local'),
  preferences: jsonb('preferences').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Auth (Auth.js / NextAuth) ─────────────────────────
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    compoundKey: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => ({
    compoundKey: primaryKey({ columns: [t.identifier, t.token] }),
  }),
)

// ── User Memory (cross-session agent learnings) ───────
export const userMemory = pgTable(
  'user_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    confidence: real('confidence').default(0.5).notNull(),
    sourceRunId: text('source_run_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_memory_user_idx').on(t.userId),
    userKeyIdx: uniqueIndex('user_memory_user_key_idx').on(t.userId, t.category, t.key),
  }),
)

// ── Workspaces ────────────────────────────────────────
export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color'),
    icon: text('icon'),
    brandKit: jsonb('brand_kit').$type<BrandKit | null>().default(null),
    globalStyle: jsonb('global_style').$type<GlobalStyle | null>().default(null),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}),
    isDefault: boolean('is_default').default(false),
    isArchived: boolean('is_archived').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('workspaces_user_idx').on(t.userId),
    defaultIdx: index('workspaces_default_idx').on(t.userId, t.isDefault),
  }),
)

// ── Projects ───────────────────────────────────────────
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    sceneGraphStartSceneId: uuid('scene_graph_start_scene_id'),
    outputMode: outputModeEnum('output_mode').default('mp4'),
    storageMode: storageModeEnum('storage_mode').default('local'),
    globalStyle: jsonb('global_style').$type<GlobalStyle>().default({
      presetId: null,
      paletteOverride: null,
      bgColorOverride: null,
      fontOverride: null,
      bodyFontOverride: null,
      strokeColorOverride: null,
    }),
    // Planner / storyboard review durability (Cursor-like plan review)
    storyboardProposed: jsonb('storyboard_proposed').$type<Storyboard | null>().default(null),
    storyboardEdited: jsonb('storyboard_edited').$type<Storyboard | null>().default(null),
    storyboardApplied: jsonb('storyboard_applied').$type<Storyboard | null>().default(null),
    pausedAgentRun: jsonb('paused_agent_run')
      .$type<{
        toolName: string
        toolInput: Record<string, unknown>
        agentType?: string | null
        reason?: string | null
        createdAt: string
      } | null>()
      .default(null),
    /** Full run checkpoint for resuming interrupted multi-scene builds */
    runCheckpoint: jsonb('run_checkpoint').$type<import('../agents/types').RunCheckpoint | null>().default(null),
    /** Per-project agent configuration (model, tools, hooks, permissions overrides) */
    agentConfig: jsonb('agent_config').$type<import('../agents/config-resolver').AgentConfig | null>().default(null),
    mp4Settings: jsonb('mp4_settings').$type<MP4Settings>().default({
      resolution: '1080p',
      fps: 30,
      format: 'mp4',
      aspectRatio: '16:9',
    }),
    interactiveSettings: jsonb('interactive_settings').$type<InteractiveSettings>().default({
      playerTheme: 'dark',
      showProgressBar: true,
      showSceneNav: false,
      allowFullscreen: true,
      brandColor: '#e84545',
      customDomain: null,
      password: null,
    }),
    apiPermissions: jsonb('api_permissions').default({}),
    audioSettings: jsonb('audio_settings').$type<AudioSettings>().default({
      defaultTTSProvider: 'auto',
      defaultSFXProvider: 'auto',
      defaultMusicProvider: 'auto',
      defaultVoiceId: null,
      defaultVoiceName: null,
      webSpeechVoice: null,
      puterProvider: 'openai',
      openaiTTSModel: 'tts-1',
      openaiTTSVoice: 'alloy',
      geminiTTSModel: 'gemini-2.5-flash-preview-tts',
      geminiVoice: null,
      edgeTTSUrl: null,
      pocketTTSUrl: null,
      voxcpmUrl: null,
      globalMusicDucking: true,
      globalMusicDuckLevel: 0.2,
    }),
    audioProviderEnabled: jsonb('audio_provider_enabled').$type<Record<string, boolean>>().default({}),
    mediaGenEnabled: jsonb('media_gen_enabled').$type<Record<string, boolean>>().default({}),
    watermark: jsonb('watermark')
      .$type<{
        assetId: string
        position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
        opacity: number
        sizePercent: number
      } | null>()
      .default(null),
    brandKit: jsonb('brand_kit')
      .$type<{
        brandName: string | null
        logoAssetIds: string[]
        palette: string[]
        fontPrimary: string | null
        fontSecondary: string | null
        guidelines: string | null
      } | null>()
      .default(null),
    version: integer('version').default(1).notNull(),
    thumbnailUrl: text('thumbnail_url'),
    isArchived: boolean('is_archived').default(false),
    lastOpenedAt: timestamp('last_opened_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('projects_user_idx').on(t.userId),
    archivedIdx: index('projects_archived_idx').on(t.userId, t.isArchived),
    updatedIdx: index('projects_updated_idx').on(t.userId, t.updatedAt),
    workspaceIdx: index('projects_workspace_idx').on(t.workspaceId),
  }),
)

// ── Project Assets (Media Library) ─────────────────────
export const projectAssets = pgTable(
  'project_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    storagePath: text('storage_path').notNull(),
    publicUrl: text('public_url').notNull(),
    type: text('type').notNull(), // 'image' | 'video' | 'svg'
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: real('duration_seconds'),
    name: text('name').notNull(),
    tags: text('tags').array().notNull().default([]),
    thumbnailUrl: text('thumbnail_url'),
    extractedColors: text('extracted_colors').array().notNull().default([]),
    // Generation provenance — nullable; only populated for AI-generated assets.
    // Why: enables query_media_library / reuse_asset / regenerate_asset and powers
    // the Gallery "generated" filter with prompt + cost tooltips.
    source: text('source').default('upload').notNull(), // 'upload' | 'generated'
    prompt: text('prompt'),
    provider: text('provider'),
    model: text('model'),
    costCents: integer('cost_cents'),
    parentAssetId: uuid('parent_asset_id'),
    referenceAssetIds: jsonb('reference_asset_ids').$type<string[]>(),
    enhanceTags: jsonb('enhance_tags').$type<string[]>(),
    // Content-hash dedup + provenance for ingested / research-sourced media.
    /** SHA256(file bytes), first 16 hex chars. Lets us dedupe repeat uploads and research-downloaded assets. */
    contentHash: text('content_hash'),
    /** Original URL when the asset was pulled from the web (Pexels, yt-dlp, Archive.org, etc). */
    sourceUrl: text('source_url'),
    /** Timestamp of last CLIP classification pass (Phase B). Null = not yet indexed. */
    classificationTimestamp: timestamp('classification_timestamp'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('project_assets_project_idx').on(t.projectId),
    typeIdx: index('project_assets_type_idx').on(t.projectId, t.type),
    sourceIdx: index('project_assets_source_idx').on(t.projectId, t.source),
    contentHashIdx: index('project_assets_content_hash_idx').on(t.contentHash),
  }),
)

// ── Scenes ─────────────────────────────────────────────
export const scenes = pgTable(
  'scenes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name'),
    position: integer('position').notNull(),
    duration: real('duration').default(8).notNull(),
    bgColor: text('bg_color').default('#fffef9'),
    styleOverride: jsonb('style_override').$type<SceneStyleOverride>().default({}),
    transition: jsonb('transition').$type<TransitionConfig>().default({
      type: 'none',
      duration: 0.5,
    }),
    audioLayer: jsonb('audio_layer').$type<AudioLayer>(),
    videoLayer: jsonb('video_layer').$type<VideoLayer>(),
    thumbnailUrl: text('thumbnail_url'),
    gridConfig: jsonb('grid_config'),
    cameraMotion: jsonb('camera_motion'),
    worldConfig: jsonb('world_config'),
    sceneBlob: jsonb('scene_blob').$type<Record<string, unknown> | null>().default(null),
    avatarConfigId: uuid('avatar_config_id').references(() => avatarConfigs.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('scenes_project_idx').on(t.projectId),
    positionIdx: index('scenes_position_idx').on(t.projectId, t.position),
  }),
)

// ── Generated Media Cache ───────────────────────────────
export const generatedMedia = pgTable(
  'generated_media',
  {
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
  },
  (t) => ({
    hashIdx: uniqueIndex('media_hash_idx').on(t.promptHash),
    userIdx: index('media_user_idx').on(t.userId),
    statusIdx: index('media_status_idx').on(t.status),
  }),
)

// ── Layers ─────────────────────────────────────────────
export const layers = pgTable(
  'layers',
  {
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
    assetPlacements: jsonb('asset_placements').$type<AssetPlacement[]>().default([]),
    prompt: text('prompt'),
    modelUsed: text('model_used'),
    generatedAt: timestamp('generated_at'),
    layerConfig: jsonb('layer_config'),
    mediaId: uuid('media_id').references(() => generatedMedia.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    sceneIdx: index('layers_scene_idx').on(t.sceneId),
    typeIdx: index('layers_type_idx').on(t.sceneId, t.type),
    zIndexIdx: index('layers_zindex_idx').on(t.sceneId, t.zIndex),
  }),
)

// ── Scene Graph ─────────────────────────────────────────
export const sceneEdges = pgTable(
  'scene_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fromSceneId: uuid('from_scene_id').references(() => scenes.id, { onDelete: 'cascade' }),
    toSceneId: uuid('to_scene_id').references(() => scenes.id, { onDelete: 'cascade' }),
    condition: jsonb('condition').$type<EdgeCondition>().default({
      type: 'auto',
      interactionId: null,
      variableName: null,
      variableValue: null,
    }),
    position: jsonb('position'),
  },
  (t) => ({
    projectIdx: index('edges_project_idx').on(t.projectId),
  }),
)

export const sceneNodes = pgTable(
  'scene_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sceneId: uuid('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    position: jsonb('position').notNull(),
  },
  (t) => ({
    projectIdx: index('nodes_project_idx').on(t.projectId),
    sceneUniqueIdx: uniqueIndex('nodes_project_scene_unique_idx').on(t.projectId, t.sceneId),
  }),
)

// ── Interactions ────────────────────────────────────────
export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sceneId: uuid('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    config: jsonb('config').$type<InteractionElement>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    sceneIdx: index('interactions_scene_idx').on(t.sceneId),
  }),
)

// ── Assets ──────────────────────────────────────────────
export const assets = pgTable(
  'assets',
  {
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
  },
  (t) => ({
    categoryIdx: index('assets_category_idx').on(t.category),
    publicIdx: index('assets_public_idx').on(t.isPublic),
    searchIdx: index('assets_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${t.name} || ' ' || coalesce(${t.description}, ''))`,
    ),
  }),
)

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
})

// ── Scene Templates ─────────────────────────────────────
export const sceneTemplates = pgTable(
  'scene_templates',
  {
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
  },
  (t) => ({
    categoryIdx: index('templates_category_idx').on(t.category),
    publicIdx: index('templates_public_idx').on(t.isPublic),
  }),
)

// ── Snapshots (undo/redo) ───────────────────────────────
export const snapshots = pgTable(
  'snapshots',
  {
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
  },
  (t) => ({
    projectIdx: index('snapshots_project_idx').on(t.projectId),
    stackIdx: index('snapshots_stack_idx').on(t.projectId, t.stackIndex),
  }),
)

// ── API Spend ───────────────────────────────────────────
export const apiSpend = pgTable(
  'api_spend',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    projectId: text('project_id'),
    api: text('api').notNull(),
    costUsd: real('cost_usd').notNull(),
    description: text('description'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('spend_user_idx').on(t.userId),
    monthIdx: index('spend_month_idx').on(t.userId, sql`date_trunc('month', ${t.createdAt})`),
    apiCreatedIdx: index('spend_api_created_idx').on(t.api, t.createdAt),
  }),
)

// ── Published Projects ──────────────────────────────────
export const publishedProjects = pgTable(
  'published_projects',
  {
    id: text('id').primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
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
  },
  (t) => ({
    projectIdx: index('published_project_idx').on(t.projectId),
    activeIdx: index('published_active_idx').on(t.isActive),
  }),
)

// ── Analytics Events ────────────────────────────────────
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publishedProjectId: text('published_project_id').references(() => publishedProjects.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    eventType: text('event_type').notNull(),
    sceneId: text('scene_id'),
    interactionId: text('interaction_id'),
    data: jsonb('data').default({}),
    userAgent: text('user_agent'),
    country: text('country'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('analytics_project_idx').on(t.publishedProjectId),
    eventTypeIdx: index('analytics_event_type_idx').on(t.publishedProjectId, t.eventType),
    sessionIdx: index('analytics_session_idx').on(t.sessionId),
    createdIdx: index('analytics_created_idx').on(t.createdAt),
  }),
)

// ── Conversations ──────────────────────────────────────
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    isPinned: boolean('is_pinned').default(false),
    isArchived: boolean('is_archived').default(false),
    totalInputTokens: integer('total_input_tokens').default(0),
    totalOutputTokens: integer('total_output_tokens').default(0),
    totalCostUsd: real('total_cost_usd').default(0),
    lastMessageAt: timestamp('last_message_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('conv_project_idx').on(t.projectId),
    lastMsgIdx: index('conv_last_msg_idx').on(t.projectId, t.lastMessageAt),
  }),
)

// ── Messages ───────────────────────────────────────────
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    agentType: agentTypeEnum('agent_type'),
    modelUsed: text('model_used'),
    thinkingContent: text('thinking_content'),
    toolCalls: jsonb('tool_calls').default([]),
    /** Chronologically ordered segments (text + tool call refs) for interleaved display */
    contentSegments: jsonb('content_segments'),
    /** Message status: 'streaming' while agent is running, 'complete' when done, 'aborted' if interrupted */
    status: text('status').notNull().default('complete'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costUsd: real('cost_usd'),
    generationLogId: uuid('generation_log_id').references(() => generationLogs.id, { onDelete: 'set null' }),
    userRating: integer('user_rating'),
    durationMs: integer('duration_ms'),
    apiCalls: integer('api_calls'),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    convIdx: index('msg_conv_idx').on(t.conversationId),
    projectIdx: index('msg_project_idx').on(t.projectId),
    positionIdx: index('msg_position_idx').on(t.conversationId, t.position),
    createdIdx: index('msg_created_idx').on(t.conversationId, t.createdAt),
  }),
)

// ── Media Cache (replaces SQLite media_cache) ───────────
export const mediaCache = pgTable(
  'media_cache',
  {
    hash: text('hash').primaryKey(),
    api: text('api').notNull(),
    filePath: text('file_path').notNull(),
    prompt: text('prompt'),
    model: text('model'),
    config: text('config'),
    /** SHA256 of file bytes (16 chars). Different from the primary `hash` which is a hash of
     *  request params — this hashes the actual file so we can dedupe identical media fetched from
     *  different queries or different providers. Null for legacy rows. */
    contentHash: text('content_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    contentHashIdx: index('media_cache_content_hash_idx').on(t.contentHash),
  }),
)

// ── Permission Sessions (replaces SQLite) ───────────────
export const permissionSessions = pgTable('permission_sessions', {
  api: text('api').primaryKey(),
  decision: text('decision').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Agent Usage (replaces SQLite) ───────────────────────
export const agentUsage = pgTable(
  'agent_usage',
  {
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
  },
  (t) => ({
    projectIdx: index('agent_usage_project_idx').on(t.projectId),
    agentIdx: index('agent_usage_agent_idx').on(t.agentType),
    monthIdx: index('agent_usage_month_idx').on(t.createdAt),
  }),
)

// ── Generation Logs ────────────────────────────────────
export const generationLogs = pgTable(
  'generation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    sceneId: uuid('scene_id').references(() => scenes.id, { onDelete: 'set null' }),
    layerId: uuid('layer_id').references(() => layers.id, { onDelete: 'set null' }),

    // Generation context
    userPrompt: text('user_prompt').notNull(),
    systemPromptHash: text('system_prompt_hash'),
    systemPromptSnapshot: text('system_prompt_snapshot'),
    injectedRules: jsonb('injected_rules').$type<string[]>(),

    stylePresetId: text('style_preset_id'),
    agentType: text('agent_type'),
    modelUsed: text('model_used'),
    thinkingMode: text('thinking_mode'),

    // Output
    sceneType: text('scene_type'),
    generatedCodeLength: integer('generated_code_length'),

    // Thinking
    thinkingContent: text('thinking_content'),

    // Performance
    generationTimeMs: integer('generation_time_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    thinkingTokens: integer('thinking_tokens'),
    costUsd: real('cost_usd'),

    // Quality signals (updated after generation)
    userAction: text('user_action'),
    timeToActionMs: integer('time_to_action_ms'),
    editDistance: integer('edit_distance'),
    userRating: integer('user_rating'),
    exportSucceeded: boolean('export_succeeded'),
    exportErrorMessage: text('export_error_message'),

    // Analysis
    qualityScore: real('quality_score'),
    analysisNotes: text('analysis_notes'),

    // Run tracing — full structured timeline for debugging
    runId: text('run_id'),
    runTrace: jsonb('run_trace'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('gen_log_project_idx').on(t.projectId),
    modelIdx: index('gen_log_model_idx').on(t.modelUsed),
    presetIdx: index('gen_log_preset_idx').on(t.stylePresetId),
    actionIdx: index('gen_log_action_idx').on(t.userAction),
    createdIdx: index('gen_log_created_idx').on(t.createdAt),
    runIdIdx: index('gen_log_run_id_idx').on(t.runId),
  }),
)

// ── Avatar Configs ─────────────────────────────────────
export const avatarConfigs = pgTable(
  'avatar_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Which provider to use
    // 'talkinghead' | 'musetalk' | 'fabric' | 'aurora' | 'heygen'
    provider: text('provider').notNull().default('talkinghead'),

    // Provider-specific config stored as JSON
    config: jsonb('config').notNull().default({}),

    // Display
    name: text('name').notNull().default('Default Avatar'),
    thumbnailUrl: text('thumbnail_url'),

    // Whether this is the project default
    isDefault: boolean('is_default').notNull().default(false),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('avatar_configs_project_idx').on(t.projectId),
    defaultIdx: index('avatar_configs_default_idx').on(t.projectId, t.isDefault),
  }),
)

// ── Avatar Videos ──────────────────────────────────────
export const avatarVideos = pgTable(
  'avatar_videos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sceneId: uuid('scene_id').references(() => scenes.id, { onDelete: 'set null' }),
    avatarConfigId: uuid('avatar_config_id').references(() => avatarConfigs.id, { onDelete: 'set null' }),

    provider: text('provider').notNull(),
    status: text('status').notNull().default('pending'),
    // 'pending' | 'generating' | 'ready' | 'error'

    // Input
    text: text('text').notNull(),
    audioUrl: text('audio_url'),
    sourceImageUrl: text('source_image_url'),

    // Output
    videoUrl: text('video_url'),
    durationSeconds: real('duration_seconds'),

    errorMessage: text('error_message'),

    // Cost tracking
    costUsd: real('cost_usd'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('avatar_videos_project_idx').on(t.projectId),
    sceneIdx: index('avatar_videos_scene_idx').on(t.sceneId),
    statusIdx: index('avatar_videos_status_idx').on(t.status),
  }),
)

// ── Permission Rules (Claude-Code-style layered rules) ────────────────────
// Scope hierarchy: user → workspace → project → session (conversation).
// Deny-wins; cost caps orthogonal to allow/deny. See lib/permissions/evaluator.ts
export const permissionRules = pgTable(
  'permission_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').$type<'user' | 'workspace' | 'project' | 'session'>().notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
    decision: text('decision').$type<'allow' | 'deny' | 'ask'>().notNull(),
    api: text('api').notNull(),
    specifier: jsonb('specifier').$type<import('../types/permissions').RuleSpecifier | null>().default(null),
    costCapUsd: real('cost_cap_usd'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    createdBy: text('created_by')
      .$type<'user-settings' | 'dialog' | 'migration' | 'admin'>()
      .notNull()
      .default('user-settings'),
    notes: text('notes'),
  },
  (t) => ({
    userScopeIdx: index('permission_rules_user_scope_idx').on(t.userId, t.scope),
    projectIdx: index('permission_rules_project_idx').on(t.projectId),
    workspaceIdx: index('permission_rules_workspace_idx').on(t.workspaceId),
    conversationIdx: index('permission_rules_conversation_idx').on(t.conversationId, t.expiresAt),
  }),
)

// ── Relations ───────────────────────────────────────────
export const userMemoryRelations = relations(userMemory, ({ one }) => ({
  user: one(users, { fields: [userMemory.userId], references: [users.id] }),
}))

export const permissionRulesRelations = relations(permissionRules, ({ one }) => ({
  user: one(users, { fields: [permissionRules.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [permissionRules.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [permissionRules.projectId], references: [projects.id] }),
  conversation: one(conversations, {
    fields: [permissionRules.conversationId],
    references: [conversations.id],
  }),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  user: one(users, { fields: [workspaces.userId], references: [users.id] }),
  projects: many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  scenes: many(scenes),
  sceneEdges: many(sceneEdges),
  sceneNodes: many(sceneNodes),
  snapshots: many(snapshots),
  conversations: many(conversations),
  messages: many(messages),
  publishedProjects: many(publishedProjects),
  assets: many(projectAssets),
  avatarConfigs: many(avatarConfigs),
  avatarVideos: many(avatarVideos),
}))

export const projectAssetsRelations = relations(projectAssets, ({ one }) => ({
  project: one(projects, { fields: [projectAssets.projectId], references: [projects.id] }),
}))

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
  layers: many(layers),
  interactions: many(interactions),
  avatarConfig: one(avatarConfigs, { fields: [scenes.avatarConfigId], references: [avatarConfigs.id] }),
}))

export const sceneNodesRelations = relations(sceneNodes, ({ one }) => ({
  project: one(projects, { fields: [sceneNodes.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [sceneNodes.sceneId], references: [scenes.id] }),
}))

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
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  project: one(projects, { fields: [conversations.projectId], references: [projects.id] }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  project: one(projects, { fields: [messages.projectId], references: [projects.id] }),
}))

export const avatarConfigsRelations = relations(avatarConfigs, ({ one, many }) => ({
  project: one(projects, { fields: [avatarConfigs.projectId], references: [projects.id] }),
  videos: many(avatarVideos),
}))

export const avatarVideosRelations = relations(avatarVideos, ({ one }) => ({
  project: one(projects, { fields: [avatarVideos.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [avatarVideos.sceneId], references: [scenes.id] }),
  avatarConfig: one(avatarConfigs, { fields: [avatarVideos.avatarConfigId], references: [avatarConfigs.id] }),
}))

// ── NLE Timeline / Track / Clip ────────────────────────────────────────────

export const clipSourceTypeEnum = pgEnum('clip_source_type', ['scene', 'video', 'image', 'audio', 'title'])

export const trackTypeEnum = pgEnum('track_type', ['video', 'audio', 'overlay'])

export const timelineTracks = pgTable(
  'timeline_tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: trackTypeEnum('type').notNull(),
    position: integer('position').notNull().default(0),
    muted: boolean('muted').default(false).notNull(),
    locked: boolean('locked').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('timeline_tracks_project_idx').on(t.projectId),
    positionIdx: index('timeline_tracks_position_idx').on(t.projectId, t.position),
  }),
)

export const timelineClips = pgTable(
  'timeline_clips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackId: uuid('track_id')
      .notNull()
      .references(() => timelineTracks.id, { onDelete: 'cascade' }),
    sourceType: clipSourceTypeEnum('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    label: text('label').default('').notNull(),
    startTime: real('start_time').notNull(),
    duration: real('duration').notNull(),
    trimStart: real('trim_start').default(0).notNull(),
    trimEnd: real('trim_end'),
    speed: real('speed').default(1).notNull(),
    opacity: real('opacity').default(1).notNull(),
    position: jsonb('position').$type<{ x: number; y: number }>().default({ x: 0, y: 0 }).notNull(),
    scale: jsonb('scale').$type<{ x: number; y: number }>().default({ x: 1, y: 1 }).notNull(),
    rotation: real('rotation').default(0).notNull(),
    filters: jsonb('filters').$type<{ type: string; value: number }[]>().default([]).notNull(),
    keyframes: jsonb('keyframes')
      .$type<{ time: number; property: string; value: number; easing: string }[]>()
      .default([])
      .notNull(),
    transition: jsonb('transition').$type<{ type: string; duration: number } | null>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    trackIdx: index('timeline_clips_track_idx').on(t.trackId),
    sourceIdx: index('timeline_clips_source_idx').on(t.sourceType, t.sourceId),
    startIdx: index('timeline_clips_start_idx').on(t.trackId, t.startTime),
  }),
)

export const timelineTracksRelations = relations(timelineTracks, ({ one, many }) => ({
  project: one(projects, { fields: [timelineTracks.projectId], references: [projects.id] }),
  clips: many(timelineClips),
}))

export const timelineClipsRelations = relations(timelineClips, ({ one }) => ({
  track: one(timelineTracks, { fields: [timelineClips.trackId], references: [timelineTracks.id] }),
}))

// ── GitHub Integration ──────────────────────────────────────────────────────

export const githubLinks = pgTable(
  'github_links',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repoFullName: text('repo_full_name').notNull(), // e.g. "user/repo"
    defaultBranch: text('default_branch').notNull().default('main'),
    accessToken: text('access_token').notNull(), // AES-256-GCM encrypted via lib/crypto.ts
    refreshToken: text('refresh_token'), // AES-256-GCM encrypted via lib/crypto.ts
    tokenExpiresAt: timestamp('token_expires_at'),
    lastPushedSha: text('last_pushed_sha'),
    lastPulledSha: text('last_pulled_sha'),
    linkedAt: timestamp('linked_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: uniqueIndex('github_links_project_idx').on(t.projectId),
    repoIdx: index('github_links_repo_idx').on(t.repoFullName),
  }),
)

export const githubLinksRelations = relations(githubLinks, ({ one }) => ({
  project: one(projects, { fields: [githubLinks.projectId], references: [projects.id] }),
}))

// ── Auth Relations ──────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  workspaces: many(workspaces),
  projects: many(projects),
  userMemory: many(userMemory),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc3) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc3 = __getOwnPropDesc(from, key)) || desc3.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// lib/agents/budget-tracker.ts
var budget_tracker_exports = {};
__export(budget_tracker_exports, {
  __resetBudgets: () => __resetBudgets,
  getBudgetSnapshot: () => getBudgetSnapshot,
  reconcileSpend: () => reconcileSpend,
  recordActualSpend: () => recordActualSpend,
  releaseSpend: () => releaseSpend,
  reserveSpend: () => reserveSpend,
  sweepStaleReservations: () => sweepStaleReservations
});
function getOrCreate(projectId) {
  let p = projects2.get(projectId);
  if (!p) {
    p = new ProjectBudget();
    projects2.set(projectId, p);
  }
  return p;
}
function reserveSpend(projectId, api, estimateUsd) {
  return getOrCreate(projectId).reserve(api, estimateUsd);
}
function reconcileSpend(projectId, reservationId, actualUsd) {
  const p = projects2.get(projectId);
  if (!p) return null;
  return p.reconcile(reservationId, actualUsd);
}
function releaseSpend(projectId, reservationId) {
  const p = projects2.get(projectId);
  if (!p) return null;
  return p.release(reservationId);
}
function recordActualSpend(projectId, costUsd) {
  getOrCreate(projectId).addActual(costUsd);
}
function getBudgetSnapshot(projectId) {
  const p = projects2.get(projectId);
  if (!p) {
    return { actualUsd: 0, reservedUsd: 0, committedUsd: 0, reservationCount: 0 };
  }
  return p.snapshot();
}
function sweepStaleReservations(maxAgeMs = 10 * 60 * 1e3) {
  let swept = 0;
  for (const p of projects2.values()) swept += p.sweepStale(maxAgeMs);
  return swept;
}
function __resetBudgets() {
  projects2.clear();
}
var ProjectBudget, projects2;
var init_budget_tracker = __esm({
  "lib/agents/budget-tracker.ts"() {
    "use strict";
    ProjectBudget = class {
      actual = 0;
      reservations = /* @__PURE__ */ new Map();
      counter = 0;
      reserve(api, estimateUsd) {
        const id = `${Date.now().toString(36)}-${(++this.counter).toString(36)}`;
        const r = { id, api, estimateUsd: Math.max(0, estimateUsd), createdAt: Date.now() };
        this.reservations.set(id, r);
        return r;
      }
      reconcile(reservationId, actualUsd) {
        const r = this.reservations.get(reservationId);
        if (!r) return null;
        this.reservations.delete(reservationId);
        this.actual += Math.max(0, actualUsd);
        return r;
      }
      release(reservationId) {
        const r = this.reservations.get(reservationId);
        if (!r) return null;
        this.reservations.delete(reservationId);
        return r;
      }
      addActual(costUsd) {
        this.actual += Math.max(0, costUsd);
      }
      snapshot() {
        let reserved = 0;
        for (const r of this.reservations.values()) reserved += r.estimateUsd;
        return {
          actualUsd: this.actual,
          reservedUsd: reserved,
          committedUsd: this.actual + reserved,
          reservationCount: this.reservations.size
        };
      }
      /** Remove reservations older than `maxAgeMs` — guards against leaks when
       *  a tool handler forgets to reconcile/release. */
      sweepStale(maxAgeMs) {
        const cutoff = Date.now() - maxAgeMs;
        let swept = 0;
        for (const [id, r] of this.reservations.entries()) {
          if (r.createdAt < cutoff) {
            this.reservations.delete(id);
            swept += 1;
          }
        }
        return swept;
      }
    };
    projects2 = /* @__PURE__ */ new Map();
  }
});

// electron/main.ts
var import_path = __toESM(require("path"));
var import_child_process = require("child_process");
var import_util = require("util");
var import_electron2 = require("electron");
var import_promises2 = __toESM(require("fs/promises"));
var import_url = require("url");

// electron/ipc/settings.ts
function listProviders() {
  return {
    providers: {
      tts: [
        { id: "elevenlabs", name: "ElevenLabs", available: !!process.env.ELEVENLABS_API_KEY },
        { id: "openai-tts", name: "OpenAI TTS", available: !!process.env.OPENAI_API_KEY },
        { id: "gemini-tts", name: "Gemini TTS", available: !!process.env.GEMINI_API_KEY },
        { id: "google-tts", name: "Google Cloud TTS", available: !!process.env.GOOGLE_TTS_API_KEY },
        { id: "openai-edge-tts", name: "Edge TTS (local)", available: !!process.env.EDGE_TTS_URL },
        { id: "pocket-tts", name: "Pocket TTS (local)", available: !!process.env.POCKET_TTS_URL },
        { id: "voxcpm", name: "VoxCPM2 (local GPU)", available: !!process.env.VOXCPM_URL },
        {
          id: "native-tts",
          name: "System Voice",
          available: process.platform === "darwin" || process.platform === "win32"
        },
        { id: "puter", name: "Puter.js", available: true },
        { id: "web-speech", name: "Web Speech API", available: true }
      ],
      sfx: [
        { id: "elevenlabs-sfx", name: "ElevenLabs SFX", available: !!process.env.ELEVENLABS_API_KEY },
        { id: "freesound", name: "Freesound", available: !!process.env.FREESOUND_API_KEY },
        { id: "pixabay", name: "Pixabay", available: !!process.env.PIXABAY_API_KEY }
      ],
      music: [
        { id: "pixabay-music", name: "Pixabay Music", available: !!process.env.PIXABAY_API_KEY },
        { id: "freesound-music", name: "Freesound Music", available: !!process.env.FREESOUND_API_KEY }
      ]
    },
    media: [
      { id: "veo3", name: "Veo3 Video", category: "video", available: !!process.env.GOOGLE_AI_KEY },
      { id: "kling", name: "Kling 2.1", category: "video", available: !!process.env.FAL_KEY },
      { id: "runway", name: "Runway Gen-4", category: "video", available: !!process.env.RUNWAY_API_KEY },
      { id: "googleImageGen", name: "Google Imagen", category: "image", available: !!process.env.GOOGLE_AI_KEY },
      { id: "imageGen", name: "FAL Image Gen", category: "image", available: !!process.env.FAL_KEY },
      { id: "dall-e", name: "DALL-E 3", category: "image", available: !!process.env.OPENAI_API_KEY },
      { id: "heygen", name: "HeyGen Avatars", category: "avatar", available: !!process.env.HEYGEN_API_KEY },
      { id: "talkinghead", name: "TalkingHead (Free)", category: "avatar", available: true },
      { id: "musetalk", name: "MuseTalk", category: "avatar", available: !!process.env.FAL_KEY },
      { id: "fabric", name: "Fabric 1.0", category: "avatar", available: !!process.env.FAL_KEY },
      { id: "aurora", name: "Aurora", category: "avatar", available: !!process.env.FAL_KEY },
      { id: "backgroundRemoval", name: "Background Removal", category: "utility", available: true },
      { id: "unsplash", name: "Unsplash", category: "utility", available: true }
    ]
  };
}
function register(ipcMain2) {
  ipcMain2.handle("cench:settings.listProviders", async () => listProviders());
}

// lib/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// lib/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accounts: () => accounts,
  accountsRelations: () => accountsRelations,
  agentTypeEnum: () => agentTypeEnum,
  agentUsage: () => agentUsage,
  analyticsEvents: () => analyticsEvents,
  apiSpend: () => apiSpend,
  assets: () => assets,
  avatarConfigs: () => avatarConfigs,
  avatarConfigsRelations: () => avatarConfigsRelations,
  avatarVideos: () => avatarVideos,
  avatarVideosRelations: () => avatarVideosRelations,
  clipSourceTypeEnum: () => clipSourceTypeEnum,
  conversations: () => conversations,
  conversationsRelations: () => conversationsRelations,
  generatedMedia: () => generatedMedia,
  generationLogs: () => generationLogs,
  githubLinks: () => githubLinks,
  githubLinksRelations: () => githubLinksRelations,
  interactions: () => interactions,
  layerTypeEnum: () => layerTypeEnum,
  layers: () => layers,
  layersRelations: () => layersRelations,
  mediaCache: () => mediaCache,
  mediaStatusEnum: () => mediaStatusEnum,
  messages: () => messages,
  messagesRelations: () => messagesRelations,
  outputModeEnum: () => outputModeEnum,
  permissionRules: () => permissionRules,
  permissionRulesRelations: () => permissionRulesRelations,
  permissionSessions: () => permissionSessions,
  planEnum: () => planEnum,
  projectAssets: () => projectAssets,
  projectAssetsRelations: () => projectAssetsRelations,
  projects: () => projects,
  projectsRelations: () => projectsRelations,
  publishedProjects: () => publishedProjects,
  sceneEdges: () => sceneEdges,
  sceneNodes: () => sceneNodes,
  sceneNodesRelations: () => sceneNodesRelations,
  sceneTemplates: () => sceneTemplates,
  scenes: () => scenes,
  scenesRelations: () => scenesRelations,
  sessions: () => sessions,
  sessionsRelations: () => sessionsRelations,
  snapshots: () => snapshots,
  storageModeEnum: () => storageModeEnum,
  threeDComponents: () => threeDComponents,
  timelineClips: () => timelineClips,
  timelineClipsRelations: () => timelineClipsRelations,
  timelineTracks: () => timelineTracks,
  timelineTracksRelations: () => timelineTracksRelations,
  trackTypeEnum: () => trackTypeEnum,
  userMemory: () => userMemory,
  userMemoryRelations: () => userMemoryRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  verificationTokens: () => verificationTokens,
  workspaces: () => workspaces,
  workspacesRelations: () => workspacesRelations
});
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_orm = require("drizzle-orm");
var outputModeEnum = (0, import_pg_core.pgEnum)("output_mode", ["mp4", "interactive"]);
var storageModeEnum = (0, import_pg_core.pgEnum)("storage_mode", ["local", "cloud"]);
var layerTypeEnum = (0, import_pg_core.pgEnum)("layer_type", [
  "canvas2d",
  "svg",
  "d3",
  "three",
  "zdog",
  "lottie",
  "html",
  "assets",
  "group",
  "avatar",
  "veo3",
  "image",
  "sticker"
]);
var agentTypeEnum = (0, import_pg_core.pgEnum)("agent_type", ["router", "director", "scene-maker", "editor", "dop", "planner"]);
var mediaStatusEnum = (0, import_pg_core.pgEnum)("media_status", ["pending", "generating", "processing", "ready", "error"]);
var planEnum = (0, import_pg_core.pgEnum)("plan", ["free", "pro", "team"]);
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  name: (0, import_pg_core.text)("name"),
  emailVerified: (0, import_pg_core.timestamp)("email_verified", { mode: "date" }),
  image: (0, import_pg_core.text)("image"),
  avatarUrl: (0, import_pg_core.text)("avatar_url"),
  plan: planEnum("plan").default("free"),
  defaultStorageMode: storageModeEnum("default_storage_mode").default("local"),
  preferences: (0, import_pg_core.jsonb)("preferences").default({}),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
});
var accounts = (0, import_pg_core.pgTable)(
  "accounts",
  {
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: (0, import_pg_core.text)("type").$type().notNull(),
    provider: (0, import_pg_core.text)("provider").notNull(),
    providerAccountId: (0, import_pg_core.text)("provider_account_id").notNull(),
    refresh_token: (0, import_pg_core.text)("refresh_token"),
    access_token: (0, import_pg_core.text)("access_token"),
    expires_at: (0, import_pg_core.integer)("expires_at"),
    token_type: (0, import_pg_core.text)("token_type"),
    scope: (0, import_pg_core.text)("scope"),
    id_token: (0, import_pg_core.text)("id_token"),
    session_state: (0, import_pg_core.text)("session_state")
  },
  (t) => ({
    compoundKey: (0, import_pg_core.primaryKey)({ columns: [t.provider, t.providerAccountId] })
  })
);
var sessions = (0, import_pg_core.pgTable)("sessions", {
  sessionToken: (0, import_pg_core.text)("session_token").primaryKey(),
  userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: (0, import_pg_core.timestamp)("expires", { mode: "date" }).notNull()
});
var verificationTokens = (0, import_pg_core.pgTable)(
  "verification_tokens",
  {
    identifier: (0, import_pg_core.text)("identifier").notNull(),
    token: (0, import_pg_core.text)("token").notNull(),
    expires: (0, import_pg_core.timestamp)("expires", { mode: "date" }).notNull()
  },
  (t) => ({
    compoundKey: (0, import_pg_core.primaryKey)({ columns: [t.identifier, t.token] })
  })
);
var userMemory = (0, import_pg_core.pgTable)(
  "user_memory",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: (0, import_pg_core.text)("category").notNull(),
    key: (0, import_pg_core.text)("key").notNull(),
    value: (0, import_pg_core.text)("value").notNull(),
    confidence: (0, import_pg_core.real)("confidence").default(0.5).notNull(),
    sourceRunId: (0, import_pg_core.text)("source_run_id"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("user_memory_user_idx").on(t.userId),
    userKeyIdx: (0, import_pg_core.uniqueIndex)("user_memory_user_key_idx").on(t.userId, t.category, t.key)
  })
);
var workspaces = (0, import_pg_core.pgTable)(
  "workspaces",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: (0, import_pg_core.text)("name").notNull(),
    description: (0, import_pg_core.text)("description"),
    color: (0, import_pg_core.text)("color"),
    icon: (0, import_pg_core.text)("icon"),
    brandKit: (0, import_pg_core.jsonb)("brand_kit").$type().default(null),
    globalStyle: (0, import_pg_core.jsonb)("global_style").$type().default(null),
    settings: (0, import_pg_core.jsonb)("settings").$type().default({}),
    isDefault: (0, import_pg_core.boolean)("is_default").default(false),
    isArchived: (0, import_pg_core.boolean)("is_archived").default(false),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("workspaces_user_idx").on(t.userId),
    defaultIdx: (0, import_pg_core.index)("workspaces_default_idx").on(t.userId, t.isDefault)
  })
);
var projects = (0, import_pg_core.pgTable)(
  "projects",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id, { onDelete: "cascade" }),
    workspaceId: (0, import_pg_core.uuid)("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    name: (0, import_pg_core.text)("name").notNull(),
    description: (0, import_pg_core.text)("description"),
    sceneGraphStartSceneId: (0, import_pg_core.uuid)("scene_graph_start_scene_id"),
    outputMode: outputModeEnum("output_mode").default("mp4"),
    storageMode: storageModeEnum("storage_mode").default("local"),
    globalStyle: (0, import_pg_core.jsonb)("global_style").$type().default({
      presetId: null,
      paletteOverride: null,
      bgColorOverride: null,
      fontOverride: null,
      bodyFontOverride: null,
      strokeColorOverride: null
    }),
    // Planner / storyboard review durability (Cursor-like plan review)
    storyboardProposed: (0, import_pg_core.jsonb)("storyboard_proposed").$type().default(null),
    storyboardEdited: (0, import_pg_core.jsonb)("storyboard_edited").$type().default(null),
    storyboardApplied: (0, import_pg_core.jsonb)("storyboard_applied").$type().default(null),
    pausedAgentRun: (0, import_pg_core.jsonb)("paused_agent_run").$type().default(null),
    /** Full run checkpoint for resuming interrupted multi-scene builds */
    runCheckpoint: (0, import_pg_core.jsonb)("run_checkpoint").$type().default(null),
    /** Per-project agent configuration (model, tools, hooks, permissions overrides) */
    agentConfig: (0, import_pg_core.jsonb)("agent_config").$type().default(null),
    mp4Settings: (0, import_pg_core.jsonb)("mp4_settings").$type().default({
      resolution: "1080p",
      fps: 30,
      format: "mp4",
      aspectRatio: "16:9"
    }),
    interactiveSettings: (0, import_pg_core.jsonb)("interactive_settings").$type().default({
      playerTheme: "dark",
      showProgressBar: true,
      showSceneNav: false,
      allowFullscreen: true,
      brandColor: "#e84545",
      customDomain: null,
      password: null
    }),
    apiPermissions: (0, import_pg_core.jsonb)("api_permissions").default({}),
    audioSettings: (0, import_pg_core.jsonb)("audio_settings").$type().default({
      defaultTTSProvider: "auto",
      defaultSFXProvider: "auto",
      defaultMusicProvider: "auto",
      defaultVoiceId: null,
      defaultVoiceName: null,
      webSpeechVoice: null,
      puterProvider: "openai",
      openaiTTSModel: "tts-1",
      openaiTTSVoice: "alloy",
      geminiTTSModel: "gemini-2.5-flash-preview-tts",
      geminiVoice: null,
      edgeTTSUrl: null,
      pocketTTSUrl: null,
      voxcpmUrl: null,
      globalMusicDucking: true,
      globalMusicDuckLevel: 0.2
    }),
    audioProviderEnabled: (0, import_pg_core.jsonb)("audio_provider_enabled").$type().default({}),
    mediaGenEnabled: (0, import_pg_core.jsonb)("media_gen_enabled").$type().default({}),
    watermark: (0, import_pg_core.jsonb)("watermark").$type().default(null),
    brandKit: (0, import_pg_core.jsonb)("brand_kit").$type().default(null),
    version: (0, import_pg_core.integer)("version").default(1).notNull(),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    isArchived: (0, import_pg_core.boolean)("is_archived").default(false),
    lastOpenedAt: (0, import_pg_core.timestamp)("last_opened_at").defaultNow(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("projects_user_idx").on(t.userId),
    archivedIdx: (0, import_pg_core.index)("projects_archived_idx").on(t.userId, t.isArchived),
    updatedIdx: (0, import_pg_core.index)("projects_updated_idx").on(t.userId, t.updatedAt),
    workspaceIdx: (0, import_pg_core.index)("projects_workspace_idx").on(t.workspaceId)
  })
);
var projectAssets = (0, import_pg_core.pgTable)(
  "project_assets",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    filename: (0, import_pg_core.text)("filename").notNull(),
    storagePath: (0, import_pg_core.text)("storage_path").notNull(),
    publicUrl: (0, import_pg_core.text)("public_url").notNull(),
    type: (0, import_pg_core.text)("type").notNull(),
    // 'image' | 'video' | 'svg'
    mimeType: (0, import_pg_core.text)("mime_type").notNull(),
    sizeBytes: (0, import_pg_core.integer)("size_bytes").notNull(),
    width: (0, import_pg_core.integer)("width"),
    height: (0, import_pg_core.integer)("height"),
    durationSeconds: (0, import_pg_core.real)("duration_seconds"),
    name: (0, import_pg_core.text)("name").notNull(),
    tags: (0, import_pg_core.text)("tags").array().notNull().default([]),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    extractedColors: (0, import_pg_core.text)("extracted_colors").array().notNull().default([]),
    // Generation provenance — nullable; only populated for AI-generated assets.
    // Why: enables query_media_library / reuse_asset / regenerate_asset and powers
    // the Gallery "generated" filter with prompt + cost tooltips.
    source: (0, import_pg_core.text)("source").default("upload").notNull(),
    // 'upload' | 'generated'
    prompt: (0, import_pg_core.text)("prompt"),
    provider: (0, import_pg_core.text)("provider"),
    model: (0, import_pg_core.text)("model"),
    costCents: (0, import_pg_core.integer)("cost_cents"),
    parentAssetId: (0, import_pg_core.uuid)("parent_asset_id"),
    referenceAssetIds: (0, import_pg_core.jsonb)("reference_asset_ids").$type(),
    enhanceTags: (0, import_pg_core.jsonb)("enhance_tags").$type(),
    // Content-hash dedup + provenance for ingested / research-sourced media.
    /** SHA256(file bytes), first 16 hex chars. Lets us dedupe repeat uploads and research-downloaded assets. */
    contentHash: (0, import_pg_core.text)("content_hash"),
    /** Original URL when the asset was pulled from the web (Pexels, yt-dlp, Archive.org, etc). */
    sourceUrl: (0, import_pg_core.text)("source_url"),
    /** Timestamp of last CLIP classification pass (Phase B). Null = not yet indexed. */
    classificationTimestamp: (0, import_pg_core.timestamp)("classification_timestamp"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("project_assets_project_idx").on(t.projectId),
    typeIdx: (0, import_pg_core.index)("project_assets_type_idx").on(t.projectId, t.type),
    sourceIdx: (0, import_pg_core.index)("project_assets_source_idx").on(t.projectId, t.source),
    contentHashIdx: (0, import_pg_core.index)("project_assets_content_hash_idx").on(t.contentHash)
  })
);
var scenes = (0, import_pg_core.pgTable)(
  "scenes",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: (0, import_pg_core.text)("name"),
    position: (0, import_pg_core.integer)("position").notNull(),
    duration: (0, import_pg_core.real)("duration").default(8).notNull(),
    bgColor: (0, import_pg_core.text)("bg_color").default("#fffef9"),
    styleOverride: (0, import_pg_core.jsonb)("style_override").$type().default({}),
    transition: (0, import_pg_core.jsonb)("transition").$type().default({
      type: "none",
      duration: 0.5
    }),
    audioLayer: (0, import_pg_core.jsonb)("audio_layer").$type(),
    videoLayer: (0, import_pg_core.jsonb)("video_layer").$type(),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    gridConfig: (0, import_pg_core.jsonb)("grid_config"),
    cameraMotion: (0, import_pg_core.jsonb)("camera_motion"),
    worldConfig: (0, import_pg_core.jsonb)("world_config"),
    sceneBlob: (0, import_pg_core.jsonb)("scene_blob").$type().default(null),
    avatarConfigId: (0, import_pg_core.uuid)("avatar_config_id").references(() => avatarConfigs.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("scenes_project_idx").on(t.projectId),
    positionIdx: (0, import_pg_core.index)("scenes_position_idx").on(t.projectId, t.position)
  })
);
var generatedMedia = (0, import_pg_core.pgTable)(
  "generated_media",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    type: (0, import_pg_core.text)("type").notNull(),
    promptHash: (0, import_pg_core.text)("prompt_hash").notNull(),
    prompt: (0, import_pg_core.text)("prompt"),
    model: (0, import_pg_core.text)("model"),
    url: (0, import_pg_core.text)("url"),
    status: mediaStatusEnum("status").default("pending"),
    metadata: (0, import_pg_core.jsonb)("metadata").default({}),
    costUsd: (0, import_pg_core.real)("cost_usd"),
    externalJobId: (0, import_pg_core.text)("external_job_id"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    hashIdx: (0, import_pg_core.uniqueIndex)("media_hash_idx").on(t.promptHash),
    userIdx: (0, import_pg_core.index)("media_user_idx").on(t.userId),
    statusIdx: (0, import_pg_core.index)("media_status_idx").on(t.status)
  })
);
var layers = (0, import_pg_core.pgTable)(
  "layers",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    sceneId: (0, import_pg_core.uuid)("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    parentLayerId: (0, import_pg_core.uuid)("parent_layer_id"),
    type: layerTypeEnum("type").notNull(),
    label: (0, import_pg_core.text)("label"),
    zIndex: (0, import_pg_core.integer)("z_index").default(0).notNull(),
    visible: (0, import_pg_core.boolean)("visible").default(true).notNull(),
    opacity: (0, import_pg_core.real)("opacity").default(1).notNull(),
    blendMode: (0, import_pg_core.text)("blend_mode").default("normal"),
    startAt: (0, import_pg_core.real)("start_at").default(0).notNull(),
    duration: (0, import_pg_core.real)("duration"),
    generatedCode: (0, import_pg_core.text)("generated_code"),
    elements: (0, import_pg_core.jsonb)("elements").$type().default([]),
    assetPlacements: (0, import_pg_core.jsonb)("asset_placements").$type().default([]),
    prompt: (0, import_pg_core.text)("prompt"),
    modelUsed: (0, import_pg_core.text)("model_used"),
    generatedAt: (0, import_pg_core.timestamp)("generated_at"),
    layerConfig: (0, import_pg_core.jsonb)("layer_config"),
    mediaId: (0, import_pg_core.uuid)("media_id").references(() => generatedMedia.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    sceneIdx: (0, import_pg_core.index)("layers_scene_idx").on(t.sceneId),
    typeIdx: (0, import_pg_core.index)("layers_type_idx").on(t.sceneId, t.type),
    zIndexIdx: (0, import_pg_core.index)("layers_zindex_idx").on(t.sceneId, t.zIndex)
  })
);
var sceneEdges = (0, import_pg_core.pgTable)(
  "scene_edges",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    fromSceneId: (0, import_pg_core.uuid)("from_scene_id").references(() => scenes.id, { onDelete: "cascade" }),
    toSceneId: (0, import_pg_core.uuid)("to_scene_id").references(() => scenes.id, { onDelete: "cascade" }),
    condition: (0, import_pg_core.jsonb)("condition").$type().default({
      type: "auto",
      interactionId: null,
      variableName: null,
      variableValue: null
    }),
    position: (0, import_pg_core.jsonb)("position")
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("edges_project_idx").on(t.projectId)
  })
);
var sceneNodes = (0, import_pg_core.pgTable)(
  "scene_nodes",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sceneId: (0, import_pg_core.uuid)("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    position: (0, import_pg_core.jsonb)("position").notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("nodes_project_idx").on(t.projectId),
    sceneUniqueIdx: (0, import_pg_core.uniqueIndex)("nodes_project_scene_unique_idx").on(t.projectId, t.sceneId)
  })
);
var interactions = (0, import_pg_core.pgTable)(
  "interactions",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    sceneId: (0, import_pg_core.uuid)("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    type: (0, import_pg_core.text)("type").notNull(),
    config: (0, import_pg_core.jsonb)("config").$type().notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    sceneIdx: (0, import_pg_core.index)("interactions_scene_idx").on(t.sceneId)
  })
);
var assets = (0, import_pg_core.pgTable)(
  "assets",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    name: (0, import_pg_core.text)("name").notNull(),
    category: (0, import_pg_core.text)("category"),
    tags: (0, import_pg_core.jsonb)("tags").$type().default([]),
    description: (0, import_pg_core.text)("description"),
    type: (0, import_pg_core.text)("type").default("canvas"),
    canvasDrawFn: (0, import_pg_core.text)("canvas_draw_fn"),
    svgData: (0, import_pg_core.text)("svg_data"),
    defaultWidth: (0, import_pg_core.integer)("default_width").default(200),
    defaultHeight: (0, import_pg_core.integer)("default_height").default(200),
    bounds: (0, import_pg_core.jsonb)("bounds"),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    isBuiltIn: (0, import_pg_core.boolean)("is_built_in").default(true),
    isPublic: (0, import_pg_core.boolean)("is_public").default(false),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    useCount: (0, import_pg_core.integer)("use_count").default(0),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    categoryIdx: (0, import_pg_core.index)("assets_category_idx").on(t.category),
    publicIdx: (0, import_pg_core.index)("assets_public_idx").on(t.isPublic),
    searchIdx: (0, import_pg_core.index)("assets_search_idx").using(
      "gin",
      import_drizzle_orm.sql`to_tsvector('english', ${t.name} || ' ' || coalesce(${t.description}, ''))`
    )
  })
);
var threeDComponents = (0, import_pg_core.pgTable)("three_d_components", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  category: (0, import_pg_core.text)("category"),
  tags: (0, import_pg_core.jsonb)("tags").$type().default([]),
  description: (0, import_pg_core.text)("description"),
  buildFn: (0, import_pg_core.text)("build_fn"),
  thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
  animates: (0, import_pg_core.boolean)("animates").default(true),
  isBuiltIn: (0, import_pg_core.boolean)("is_built_in").default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
});
var sceneTemplates = (0, import_pg_core.pgTable)(
  "scene_templates",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    name: (0, import_pg_core.text)("name").notNull(),
    description: (0, import_pg_core.text)("description"),
    category: (0, import_pg_core.text)("category"),
    tags: (0, import_pg_core.jsonb)("tags").$type().default([]),
    layers: (0, import_pg_core.jsonb)("layers").$type().default([]),
    duration: (0, import_pg_core.real)("duration").default(8),
    styleOverride: (0, import_pg_core.jsonb)("style_override").$type().default({}),
    placeholders: (0, import_pg_core.jsonb)("placeholders").$type().default([]),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    isBuiltIn: (0, import_pg_core.boolean)("is_built_in").default(false),
    isPublic: (0, import_pg_core.boolean)("is_public").default(false),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    useCount: (0, import_pg_core.integer)("use_count").default(0),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    categoryIdx: (0, import_pg_core.index)("templates_category_idx").on(t.category),
    publicIdx: (0, import_pg_core.index)("templates_public_idx").on(t.isPublic)
  })
);
var snapshots = (0, import_pg_core.pgTable)(
  "snapshots",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    operation: (0, import_pg_core.text)("operation").notNull(),
    diff: (0, import_pg_core.jsonb)("diff").notNull(),
    agentMessage: (0, import_pg_core.text)("agent_message"),
    agentType: agentTypeEnum("agent_type"),
    stackIndex: (0, import_pg_core.integer)("stack_index").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("snapshots_project_idx").on(t.projectId),
    stackIdx: (0, import_pg_core.index)("snapshots_stack_idx").on(t.projectId, t.stackIndex)
  })
);
var apiSpend = (0, import_pg_core.pgTable)(
  "api_spend",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    projectId: (0, import_pg_core.text)("project_id"),
    api: (0, import_pg_core.text)("api").notNull(),
    costUsd: (0, import_pg_core.real)("cost_usd").notNull(),
    description: (0, import_pg_core.text)("description"),
    metadata: (0, import_pg_core.jsonb)("metadata").default({}),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("spend_user_idx").on(t.userId),
    monthIdx: (0, import_pg_core.index)("spend_month_idx").on(t.userId, import_drizzle_orm.sql`date_trunc('month', ${t.createdAt})`),
    apiCreatedIdx: (0, import_pg_core.index)("spend_api_created_idx").on(t.api, t.createdAt)
  })
);
var publishedProjects = (0, import_pg_core.pgTable)(
  "published_projects",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.uuid)("project_id").references(() => projects.id, { onDelete: "cascade" }),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    manifest: (0, import_pg_core.jsonb)("manifest").$type(),
    version: (0, import_pg_core.integer)("version").default(1).notNull(),
    isPasswordProtected: (0, import_pg_core.boolean)("is_password_protected").default(false),
    passwordHash: (0, import_pg_core.text)("password_hash"),
    isActive: (0, import_pg_core.boolean)("is_active").default(true),
    viewCount: (0, import_pg_core.integer)("view_count").default(0),
    customDomain: (0, import_pg_core.text)("custom_domain"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("published_project_idx").on(t.projectId),
    activeIdx: (0, import_pg_core.index)("published_active_idx").on(t.isActive)
  })
);
var analyticsEvents = (0, import_pg_core.pgTable)(
  "analytics_events",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    publishedProjectId: (0, import_pg_core.text)("published_project_id").references(() => publishedProjects.id, { onDelete: "cascade" }),
    sessionId: (0, import_pg_core.text)("session_id").notNull(),
    eventType: (0, import_pg_core.text)("event_type").notNull(),
    sceneId: (0, import_pg_core.text)("scene_id"),
    interactionId: (0, import_pg_core.text)("interaction_id"),
    data: (0, import_pg_core.jsonb)("data").default({}),
    userAgent: (0, import_pg_core.text)("user_agent"),
    country: (0, import_pg_core.text)("country"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("analytics_project_idx").on(t.publishedProjectId),
    eventTypeIdx: (0, import_pg_core.index)("analytics_event_type_idx").on(t.publishedProjectId, t.eventType),
    sessionIdx: (0, import_pg_core.index)("analytics_session_idx").on(t.sessionId),
    createdIdx: (0, import_pg_core.index)("analytics_created_idx").on(t.createdAt)
  })
);
var conversations = (0, import_pg_core.pgTable)(
  "conversations",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: (0, import_pg_core.text)("title").notNull().default("New chat"),
    isPinned: (0, import_pg_core.boolean)("is_pinned").default(false),
    isArchived: (0, import_pg_core.boolean)("is_archived").default(false),
    totalInputTokens: (0, import_pg_core.integer)("total_input_tokens").default(0),
    totalOutputTokens: (0, import_pg_core.integer)("total_output_tokens").default(0),
    totalCostUsd: (0, import_pg_core.real)("total_cost_usd").default(0),
    lastMessageAt: (0, import_pg_core.timestamp)("last_message_at").defaultNow(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("conv_project_idx").on(t.projectId),
    lastMsgIdx: (0, import_pg_core.index)("conv_last_msg_idx").on(t.projectId, t.lastMessageAt)
  })
);
var messages = (0, import_pg_core.pgTable)(
  "messages",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    conversationId: (0, import_pg_core.uuid)("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    role: (0, import_pg_core.text)("role").notNull(),
    content: (0, import_pg_core.text)("content").notNull(),
    agentType: agentTypeEnum("agent_type"),
    modelUsed: (0, import_pg_core.text)("model_used"),
    thinkingContent: (0, import_pg_core.text)("thinking_content"),
    toolCalls: (0, import_pg_core.jsonb)("tool_calls").default([]),
    /** Chronologically ordered segments (text + tool call refs) for interleaved display */
    contentSegments: (0, import_pg_core.jsonb)("content_segments"),
    /** Message status: 'streaming' while agent is running, 'complete' when done, 'aborted' if interrupted */
    status: (0, import_pg_core.text)("status").notNull().default("complete"),
    inputTokens: (0, import_pg_core.integer)("input_tokens"),
    outputTokens: (0, import_pg_core.integer)("output_tokens"),
    costUsd: (0, import_pg_core.real)("cost_usd"),
    generationLogId: (0, import_pg_core.uuid)("generation_log_id").references(() => generationLogs.id, { onDelete: "set null" }),
    userRating: (0, import_pg_core.integer)("user_rating"),
    durationMs: (0, import_pg_core.integer)("duration_ms"),
    apiCalls: (0, import_pg_core.integer)("api_calls"),
    position: (0, import_pg_core.integer)("position").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    convIdx: (0, import_pg_core.index)("msg_conv_idx").on(t.conversationId),
    projectIdx: (0, import_pg_core.index)("msg_project_idx").on(t.projectId),
    positionIdx: (0, import_pg_core.index)("msg_position_idx").on(t.conversationId, t.position),
    createdIdx: (0, import_pg_core.index)("msg_created_idx").on(t.conversationId, t.createdAt)
  })
);
var mediaCache = (0, import_pg_core.pgTable)(
  "media_cache",
  {
    hash: (0, import_pg_core.text)("hash").primaryKey(),
    api: (0, import_pg_core.text)("api").notNull(),
    filePath: (0, import_pg_core.text)("file_path").notNull(),
    prompt: (0, import_pg_core.text)("prompt"),
    model: (0, import_pg_core.text)("model"),
    config: (0, import_pg_core.text)("config"),
    /** SHA256 of file bytes (16 chars). Different from the primary `hash` which is a hash of
     *  request params — this hashes the actual file so we can dedupe identical media fetched from
     *  different queries or different providers. Null for legacy rows. */
    contentHash: (0, import_pg_core.text)("content_hash"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    contentHashIdx: (0, import_pg_core.index)("media_cache_content_hash_idx").on(t.contentHash)
  })
);
var permissionSessions = (0, import_pg_core.pgTable)("permission_sessions", {
  api: (0, import_pg_core.text)("api").primaryKey(),
  decision: (0, import_pg_core.text)("decision").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
});
var agentUsage = (0, import_pg_core.pgTable)(
  "agent_usage",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.text)("project_id").notNull(),
    agentType: (0, import_pg_core.text)("agent_type").notNull(),
    modelId: (0, import_pg_core.text)("model_id").notNull(),
    inputTokens: (0, import_pg_core.integer)("input_tokens").default(0).notNull(),
    outputTokens: (0, import_pg_core.integer)("output_tokens").default(0).notNull(),
    apiCalls: (0, import_pg_core.integer)("api_calls").default(1).notNull(),
    toolCalls: (0, import_pg_core.integer)("tool_calls").default(0).notNull(),
    costUsd: (0, import_pg_core.real)("cost_usd").default(0).notNull(),
    durationMs: (0, import_pg_core.integer)("duration_ms").default(0).notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("agent_usage_project_idx").on(t.projectId),
    agentIdx: (0, import_pg_core.index)("agent_usage_agent_idx").on(t.agentType),
    monthIdx: (0, import_pg_core.index)("agent_usage_month_idx").on(t.createdAt)
  })
);
var generationLogs = (0, import_pg_core.pgTable)(
  "generation_logs",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").references(() => projects.id, { onDelete: "cascade" }),
    sceneId: (0, import_pg_core.uuid)("scene_id").references(() => scenes.id, { onDelete: "set null" }),
    layerId: (0, import_pg_core.uuid)("layer_id").references(() => layers.id, { onDelete: "set null" }),
    // Generation context
    userPrompt: (0, import_pg_core.text)("user_prompt").notNull(),
    systemPromptHash: (0, import_pg_core.text)("system_prompt_hash"),
    systemPromptSnapshot: (0, import_pg_core.text)("system_prompt_snapshot"),
    injectedRules: (0, import_pg_core.jsonb)("injected_rules").$type(),
    stylePresetId: (0, import_pg_core.text)("style_preset_id"),
    agentType: (0, import_pg_core.text)("agent_type"),
    modelUsed: (0, import_pg_core.text)("model_used"),
    thinkingMode: (0, import_pg_core.text)("thinking_mode"),
    // Output
    sceneType: (0, import_pg_core.text)("scene_type"),
    generatedCodeLength: (0, import_pg_core.integer)("generated_code_length"),
    // Thinking
    thinkingContent: (0, import_pg_core.text)("thinking_content"),
    // Performance
    generationTimeMs: (0, import_pg_core.integer)("generation_time_ms"),
    inputTokens: (0, import_pg_core.integer)("input_tokens"),
    outputTokens: (0, import_pg_core.integer)("output_tokens"),
    thinkingTokens: (0, import_pg_core.integer)("thinking_tokens"),
    costUsd: (0, import_pg_core.real)("cost_usd"),
    // Quality signals (updated after generation)
    userAction: (0, import_pg_core.text)("user_action"),
    timeToActionMs: (0, import_pg_core.integer)("time_to_action_ms"),
    editDistance: (0, import_pg_core.integer)("edit_distance"),
    userRating: (0, import_pg_core.integer)("user_rating"),
    exportSucceeded: (0, import_pg_core.boolean)("export_succeeded"),
    exportErrorMessage: (0, import_pg_core.text)("export_error_message"),
    // Analysis
    qualityScore: (0, import_pg_core.real)("quality_score"),
    analysisNotes: (0, import_pg_core.text)("analysis_notes"),
    // Run tracing — full structured timeline for debugging
    runId: (0, import_pg_core.text)("run_id"),
    runTrace: (0, import_pg_core.jsonb)("run_trace"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("gen_log_project_idx").on(t.projectId),
    modelIdx: (0, import_pg_core.index)("gen_log_model_idx").on(t.modelUsed),
    presetIdx: (0, import_pg_core.index)("gen_log_preset_idx").on(t.stylePresetId),
    actionIdx: (0, import_pg_core.index)("gen_log_action_idx").on(t.userAction),
    createdIdx: (0, import_pg_core.index)("gen_log_created_idx").on(t.createdAt),
    runIdIdx: (0, import_pg_core.index)("gen_log_run_id_idx").on(t.runId)
  })
);
var avatarConfigs = (0, import_pg_core.pgTable)(
  "avatar_configs",
  {
    id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    // Which provider to use
    // 'talkinghead' | 'musetalk' | 'fabric' | 'aurora' | 'heygen'
    provider: (0, import_pg_core.text)("provider").notNull().default("talkinghead"),
    // Provider-specific config stored as JSON
    config: (0, import_pg_core.jsonb)("config").notNull().default({}),
    // Display
    name: (0, import_pg_core.text)("name").notNull().default("Default Avatar"),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    // Whether this is the project default
    isDefault: (0, import_pg_core.boolean)("is_default").notNull().default(false),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("avatar_configs_project_idx").on(t.projectId),
    defaultIdx: (0, import_pg_core.index)("avatar_configs_default_idx").on(t.projectId, t.isDefault)
  })
);
var avatarVideos = (0, import_pg_core.pgTable)(
  "avatar_videos",
  {
    id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sceneId: (0, import_pg_core.uuid)("scene_id").references(() => scenes.id, { onDelete: "set null" }),
    avatarConfigId: (0, import_pg_core.uuid)("avatar_config_id").references(() => avatarConfigs.id, { onDelete: "set null" }),
    provider: (0, import_pg_core.text)("provider").notNull(),
    status: (0, import_pg_core.text)("status").notNull().default("pending"),
    // 'pending' | 'generating' | 'ready' | 'error'
    // Input
    text: (0, import_pg_core.text)("text").notNull(),
    audioUrl: (0, import_pg_core.text)("audio_url"),
    sourceImageUrl: (0, import_pg_core.text)("source_image_url"),
    // Output
    videoUrl: (0, import_pg_core.text)("video_url"),
    durationSeconds: (0, import_pg_core.real)("duration_seconds"),
    errorMessage: (0, import_pg_core.text)("error_message"),
    // Cost tracking
    costUsd: (0, import_pg_core.real)("cost_usd"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("avatar_videos_project_idx").on(t.projectId),
    sceneIdx: (0, import_pg_core.index)("avatar_videos_scene_idx").on(t.sceneId),
    statusIdx: (0, import_pg_core.index)("avatar_videos_status_idx").on(t.status)
  })
);
var permissionRules = (0, import_pg_core.pgTable)(
  "permission_rules",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scope: (0, import_pg_core.text)("scope").$type().notNull(),
    workspaceId: (0, import_pg_core.uuid)("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: (0, import_pg_core.uuid)("project_id").references(() => projects.id, { onDelete: "cascade" }),
    conversationId: (0, import_pg_core.uuid)("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
    decision: (0, import_pg_core.text)("decision").$type().notNull(),
    api: (0, import_pg_core.text)("api").notNull(),
    specifier: (0, import_pg_core.jsonb)("specifier").$type().default(null),
    costCapUsd: (0, import_pg_core.real)("cost_cap_usd"),
    expiresAt: (0, import_pg_core.timestamp)("expires_at"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    createdBy: (0, import_pg_core.text)("created_by").$type().notNull().default("user-settings"),
    notes: (0, import_pg_core.text)("notes")
  },
  (t) => ({
    userScopeIdx: (0, import_pg_core.index)("permission_rules_user_scope_idx").on(t.userId, t.scope),
    projectIdx: (0, import_pg_core.index)("permission_rules_project_idx").on(t.projectId),
    workspaceIdx: (0, import_pg_core.index)("permission_rules_workspace_idx").on(t.workspaceId),
    conversationIdx: (0, import_pg_core.index)("permission_rules_conversation_idx").on(t.conversationId, t.expiresAt)
  })
);
var userMemoryRelations = (0, import_drizzle_orm.relations)(userMemory, ({ one }) => ({
  user: one(users, { fields: [userMemory.userId], references: [users.id] })
}));
var permissionRulesRelations = (0, import_drizzle_orm.relations)(permissionRules, ({ one }) => ({
  user: one(users, { fields: [permissionRules.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [permissionRules.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [permissionRules.projectId], references: [projects.id] }),
  conversation: one(conversations, {
    fields: [permissionRules.conversationId],
    references: [conversations.id]
  })
}));
var workspacesRelations = (0, import_drizzle_orm.relations)(workspaces, ({ one, many }) => ({
  user: one(users, { fields: [workspaces.userId], references: [users.id] }),
  projects: many(projects)
}));
var projectsRelations = (0, import_drizzle_orm.relations)(projects, ({ one, many }) => ({
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
  avatarVideos: many(avatarVideos)
}));
var projectAssetsRelations = (0, import_drizzle_orm.relations)(projectAssets, ({ one }) => ({
  project: one(projects, { fields: [projectAssets.projectId], references: [projects.id] })
}));
var scenesRelations = (0, import_drizzle_orm.relations)(scenes, ({ one, many }) => ({
  project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
  layers: many(layers),
  interactions: many(interactions),
  avatarConfig: one(avatarConfigs, { fields: [scenes.avatarConfigId], references: [avatarConfigs.id] })
}));
var sceneNodesRelations = (0, import_drizzle_orm.relations)(sceneNodes, ({ one }) => ({
  project: one(projects, { fields: [sceneNodes.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [sceneNodes.sceneId], references: [scenes.id] })
}));
var layersRelations = (0, import_drizzle_orm.relations)(layers, ({ one, many }) => ({
  scene: one(scenes, { fields: [layers.sceneId], references: [scenes.id] }),
  parent: one(layers, {
    fields: [layers.parentLayerId],
    references: [layers.id],
    relationName: "layer_parent"
  }),
  children: many(layers, { relationName: "layer_parent" }),
  media: one(generatedMedia, {
    fields: [layers.mediaId],
    references: [generatedMedia.id]
  })
}));
var conversationsRelations = (0, import_drizzle_orm.relations)(conversations, ({ one, many }) => ({
  project: one(projects, { fields: [conversations.projectId], references: [projects.id] }),
  messages: many(messages)
}));
var messagesRelations = (0, import_drizzle_orm.relations)(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  project: one(projects, { fields: [messages.projectId], references: [projects.id] })
}));
var avatarConfigsRelations = (0, import_drizzle_orm.relations)(avatarConfigs, ({ one, many }) => ({
  project: one(projects, { fields: [avatarConfigs.projectId], references: [projects.id] }),
  videos: many(avatarVideos)
}));
var avatarVideosRelations = (0, import_drizzle_orm.relations)(avatarVideos, ({ one }) => ({
  project: one(projects, { fields: [avatarVideos.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [avatarVideos.sceneId], references: [scenes.id] }),
  avatarConfig: one(avatarConfigs, { fields: [avatarVideos.avatarConfigId], references: [avatarConfigs.id] })
}));
var clipSourceTypeEnum = (0, import_pg_core.pgEnum)("clip_source_type", ["scene", "video", "image", "audio", "title"]);
var trackTypeEnum = (0, import_pg_core.pgEnum)("track_type", ["video", "audio", "overlay"]);
var timelineTracks = (0, import_pg_core.pgTable)(
  "timeline_tracks",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: (0, import_pg_core.text)("name").notNull(),
    type: trackTypeEnum("type").notNull(),
    position: (0, import_pg_core.integer)("position").notNull().default(0),
    muted: (0, import_pg_core.boolean)("muted").default(false).notNull(),
    locked: (0, import_pg_core.boolean)("locked").default(false).notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("timeline_tracks_project_idx").on(t.projectId),
    positionIdx: (0, import_pg_core.index)("timeline_tracks_position_idx").on(t.projectId, t.position)
  })
);
var timelineClips = (0, import_pg_core.pgTable)(
  "timeline_clips",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    trackId: (0, import_pg_core.uuid)("track_id").notNull().references(() => timelineTracks.id, { onDelete: "cascade" }),
    sourceType: clipSourceTypeEnum("source_type").notNull(),
    sourceId: (0, import_pg_core.text)("source_id").notNull(),
    label: (0, import_pg_core.text)("label").default("").notNull(),
    startTime: (0, import_pg_core.real)("start_time").notNull(),
    duration: (0, import_pg_core.real)("duration").notNull(),
    trimStart: (0, import_pg_core.real)("trim_start").default(0).notNull(),
    trimEnd: (0, import_pg_core.real)("trim_end"),
    speed: (0, import_pg_core.real)("speed").default(1).notNull(),
    opacity: (0, import_pg_core.real)("opacity").default(1).notNull(),
    position: (0, import_pg_core.jsonb)("position").$type().default({ x: 0, y: 0 }).notNull(),
    scale: (0, import_pg_core.jsonb)("scale").$type().default({ x: 1, y: 1 }).notNull(),
    rotation: (0, import_pg_core.real)("rotation").default(0).notNull(),
    filters: (0, import_pg_core.jsonb)("filters").$type().default([]).notNull(),
    keyframes: (0, import_pg_core.jsonb)("keyframes").$type().default([]).notNull(),
    transition: (0, import_pg_core.jsonb)("transition").$type(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    trackIdx: (0, import_pg_core.index)("timeline_clips_track_idx").on(t.trackId),
    sourceIdx: (0, import_pg_core.index)("timeline_clips_source_idx").on(t.sourceType, t.sourceId),
    startIdx: (0, import_pg_core.index)("timeline_clips_start_idx").on(t.trackId, t.startTime)
  })
);
var timelineTracksRelations = (0, import_drizzle_orm.relations)(timelineTracks, ({ one, many }) => ({
  project: one(projects, { fields: [timelineTracks.projectId], references: [projects.id] }),
  clips: many(timelineClips)
}));
var timelineClipsRelations = (0, import_drizzle_orm.relations)(timelineClips, ({ one }) => ({
  track: one(timelineTracks, { fields: [timelineClips.trackId], references: [timelineTracks.id] })
}));
var githubLinks = (0, import_pg_core.pgTable)(
  "github_links",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    repoFullName: (0, import_pg_core.text)("repo_full_name").notNull(),
    // e.g. "user/repo"
    defaultBranch: (0, import_pg_core.text)("default_branch").notNull().default("main"),
    accessToken: (0, import_pg_core.text)("access_token").notNull(),
    // AES-256-GCM encrypted via lib/crypto.ts
    refreshToken: (0, import_pg_core.text)("refresh_token"),
    // AES-256-GCM encrypted via lib/crypto.ts
    tokenExpiresAt: (0, import_pg_core.timestamp)("token_expires_at"),
    lastPushedSha: (0, import_pg_core.text)("last_pushed_sha"),
    lastPulledSha: (0, import_pg_core.text)("last_pulled_sha"),
    linkedAt: (0, import_pg_core.timestamp)("linked_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.uniqueIndex)("github_links_project_idx").on(t.projectId),
    repoIdx: (0, import_pg_core.index)("github_links_repo_idx").on(t.repoFullName)
  })
);
var githubLinksRelations = (0, import_drizzle_orm.relations)(githubLinks, ({ one }) => ({
  project: one(projects, { fields: [githubLinks.projectId], references: [projects.id] })
}));
var usersRelations = (0, import_drizzle_orm.relations)(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  workspaces: many(workspaces),
  projects: many(projects),
  userMemory: many(userMemory)
}));
var accountsRelations = (0, import_drizzle_orm.relations)(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}));
var sessionsRelations = (0, import_drizzle_orm.relations)(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

// lib/db/index.ts
var import_drizzle_orm2 = require("drizzle-orm");
var _pool = null;
var _db = null;
function initDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set.\nFor local mode: copy .env.example to .env.local and run npm run db:start\nFor cloud mode: add your Neon/Supabase connection string to .env.local"
    );
  }
  _pool = new import_pg.Pool({
    connectionString: url,
    max: process.env.STORAGE_MODE === "cloud" ? 10 : 5,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 5e3,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: true }
  });
  _pool.on("error", (err) => {
    console.error("Unexpected Postgres pool error:", err);
  });
  _db = (0, import_node_postgres.drizzle)(_pool, {
    schema: schema_exports,
    logger: process.env.NODE_ENV === "development"
  });
  return _db;
}
var db = new Proxy({}, {
  get(_target, prop, receiver) {
    return Reflect.get(initDb(), prop, receiver);
  },
  // Required so Auth.js Drizzle adapter's `is(db, PgDatabase)` check — which
  // walks the prototype chain via Object.getPrototypeOf — sees the real
  // PgDatabase prototype instead of the empty Proxy target's Object.prototype.
  getPrototypeOf() {
    return Reflect.getPrototypeOf(initDb());
  },
  has(_target, prop) {
    return Reflect.has(initDb(), prop);
  }
});
async function logSpend(projectId, api, costUsd, description, reservationId) {
  await db.insert(apiSpend).values({
    projectId,
    api,
    costUsd,
    description
  });
  try {
    const tracker = await Promise.resolve().then(() => (init_budget_tracker(), budget_tracker_exports));
    if (reservationId) {
      const reconciled = tracker.reconcileSpend(projectId, reservationId, costUsd);
      if (!reconciled) tracker.recordActualSpend(projectId, costUsd);
    } else {
      tracker.recordActualSpend(projectId, costUsd);
    }
  } catch (trackerErr) {
    console.warn(`[logSpend] budget tracker update failed for project=${projectId} api=${api}`, trackerErr);
  }
}
async function getSessionSpend(api) {
  const [row] = await db.select({ total: import_drizzle_orm2.sql`coalesce(sum(${apiSpend.costUsd}), 0)` }).from(apiSpend).where(import_drizzle_orm2.sql`${apiSpend.api} = ${api} AND ${apiSpend.createdAt} > now() - interval '1 day'`);
  return row.total;
}
async function getMonthlySpend(api) {
  const [row] = await db.select({ total: import_drizzle_orm2.sql`coalesce(sum(${apiSpend.costUsd}), 0)` }).from(apiSpend).where(import_drizzle_orm2.sql`${apiSpend.api} = ${api} AND ${apiSpend.createdAt} > date_trunc('month', now())`);
  return row.total;
}
async function getSessionPermission(api) {
  const row = await db.query.permissionSessions.findFirst({
    where: (0, import_drizzle_orm2.eq)(permissionSessions.api, api),
    columns: { decision: true }
  });
  return row?.decision ?? null;
}
async function setSessionPermission(api, decision) {
  await db.insert(permissionSessions).values({ api, decision }).onConflictDoUpdate({
    target: permissionSessions.api,
    set: { decision }
  });
}
async function getAgentUsageSummary(projectId) {
  const empty = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    totalApiCalls: 0,
    totalToolCalls: 0,
    byAgent: {}
  };
  try {
    const whereClause = projectId ? import_drizzle_orm2.sql`WHERE ${agentUsage.projectId} = ${projectId}` : import_drizzle_orm2.sql``;
    const totalsResult = await db.execute(import_drizzle_orm2.sql`
      SELECT
        coalesce(sum(input_tokens), 0) as "totalInputTokens",
        coalesce(sum(output_tokens), 0) as "totalOutputTokens",
        coalesce(sum(cost_usd), 0) as "totalCostUsd",
        coalesce(sum(api_calls), 0) as "totalApiCalls",
        coalesce(sum(tool_calls), 0) as "totalToolCalls"
      FROM agent_usage ${whereClause}
    `);
    const totals = totalsResult?.rows?.[0] ?? totalsResult?.[0] ?? {};
    const byAgentRows = await db.execute(import_drizzle_orm2.sql`
      SELECT
        agent_type,
        sum(input_tokens) as "inputTokens",
        sum(output_tokens) as "outputTokens",
        sum(cost_usd) as "costUsd",
        count(*) as count
      FROM agent_usage ${whereClause}
      GROUP BY agent_type
    `);
    const byAgent = {};
    for (const row of byAgentRows?.rows ?? byAgentRows ?? []) {
      byAgent[row.agent_type] = {
        inputTokens: Number(row.inputTokens),
        outputTokens: Number(row.outputTokens),
        costUsd: Number(row.costUsd),
        count: Number(row.count)
      };
    }
    const t = totals?.rows?.[0] ?? totals ?? {};
    return {
      totalInputTokens: Number(t.totalInputTokens ?? 0),
      totalOutputTokens: Number(t.totalOutputTokens ?? 0),
      totalCostUsd: Number(t.totalCostUsd ?? 0),
      totalApiCalls: Number(t.totalApiCalls ?? 0),
      totalToolCalls: Number(t.totalToolCalls ?? 0),
      byAgent
    };
  } catch (e) {
    console.error("[DB] getAgentUsageSummary failed (table may not exist):", e);
    return empty;
  }
}

// lib/db/queries/conversations.ts
var import_drizzle_orm3 = require("drizzle-orm");
async function getProjectConversations(projectId) {
  const convs = await db.select().from(conversations).where((0, import_drizzle_orm3.eq)(conversations.projectId, projectId)).orderBy((0, import_drizzle_orm3.desc)(conversations.lastMessageAt));
  if (convs.length === 0) return [];
  const convIds = convs.map((c) => c.id);
  const inClause = import_drizzle_orm3.sql.join(
    convIds.map((id) => import_drizzle_orm3.sql`${id}`),
    import_drizzle_orm3.sql`, `
  );
  const lastMessages = await db.execute(import_drizzle_orm3.sql`
    SELECT DISTINCT ON (conversation_id)
      conversation_id, role, content
    FROM messages
    WHERE conversation_id IN (${inClause})
    ORDER BY conversation_id, position DESC
  `);
  const msgMap = /* @__PURE__ */ new Map();
  for (const row of lastMessages?.rows ?? lastMessages ?? []) {
    msgMap.set(row.conversation_id, { role: row.role, content: row.content });
  }
  return convs.map((conv) => {
    const lastMsg = msgMap.get(conv.id);
    return { ...conv, messages: lastMsg ? [lastMsg] : [] };
  });
}
async function createConversation(data) {
  const [conv] = await db.insert(conversations).values({
    projectId: data.projectId,
    title: data.title ?? "New chat"
  }).returning();
  return conv;
}
async function updateConversation(id, updates) {
  const [conv] = await db.update(conversations).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(conversations.id, id)).returning();
  return conv;
}
async function deleteConversation(id) {
  await db.delete(conversations).where((0, import_drizzle_orm3.eq)(conversations.id, id));
}
async function getConversationMessages(conversationId, limit = 200) {
  return db.query.messages.findMany({
    where: (0, import_drizzle_orm3.eq)(messages.conversationId, conversationId),
    orderBy: (0, import_drizzle_orm3.asc)(messages.position),
    limit
  });
}
async function addMessage(data) {
  const status = data.status ?? "complete";
  return db.transaction(async (tx) => {
    const idFragment = data.id ? import_drizzle_orm3.sql`${data.id}::uuid` : import_drizzle_orm3.sql`gen_random_uuid()`;
    const insertResult = await tx.execute(import_drizzle_orm3.sql`
      INSERT INTO messages (
        id, conversation_id, project_id, role, content, status, agent_type, model_used,
        thinking_content, tool_calls, content_segments, input_tokens, output_tokens, cost_usd,
        duration_ms, api_calls, user_rating, generation_log_id, position
      ) VALUES (
        ${idFragment},
        ${data.conversationId}, ${data.projectId}, ${data.role}, ${data.content},
        ${status},
        ${data.agentType ?? null}::agent_type, ${data.modelUsed ?? null},
        ${data.thinkingContent ?? null}, ${JSON.stringify(data.toolCalls ?? [])}::jsonb,
        ${data.contentSegments ? import_drizzle_orm3.sql`${JSON.stringify(data.contentSegments)}::jsonb` : import_drizzle_orm3.sql`null`},
        ${data.inputTokens ?? null}, ${data.outputTokens ?? null}, ${data.costUsd ?? null},
        ${data.durationMs ?? null}, ${data.apiCalls ?? null}, ${data.userRating ?? null},
        ${data.generationLogId ?? null},
        (SELECT coalesce(max(position), -1) + 1 FROM messages WHERE conversation_id = ${data.conversationId})
      ) RETURNING *
    `);
    const message = insertResult.rows?.[0] ?? insertResult[0];
    if (status !== "streaming") {
      await tx.update(conversations).set({
        lastMessageAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
        totalCostUsd: import_drizzle_orm3.sql`total_cost_usd + ${data.costUsd ?? 0}`,
        totalInputTokens: import_drizzle_orm3.sql`total_input_tokens + ${data.inputTokens ?? 0}`,
        totalOutputTokens: import_drizzle_orm3.sql`total_output_tokens + ${data.outputTokens ?? 0}`
      }).where((0, import_drizzle_orm3.eq)(conversations.id, data.conversationId));
    } else {
      await tx.update(conversations).set({ lastMessageAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(conversations.id, data.conversationId));
    }
    const row = message?.rows?.[0] ?? message?.[0] ?? message;
    return row;
  });
}
async function updateMessage(messageId, updates) {
  const setClauses = [];
  if (updates.content !== void 0) setClauses.push(import_drizzle_orm3.sql`content = ${updates.content}`);
  if (updates.status !== void 0) setClauses.push(import_drizzle_orm3.sql`status = ${updates.status}`);
  if (updates.agentType !== void 0) setClauses.push(import_drizzle_orm3.sql`agent_type = ${updates.agentType}::agent_type`);
  if (updates.modelUsed !== void 0) setClauses.push(import_drizzle_orm3.sql`model_used = ${updates.modelUsed}`);
  if (updates.thinkingContent !== void 0) setClauses.push(import_drizzle_orm3.sql`thinking_content = ${updates.thinkingContent}`);
  if (updates.toolCalls !== void 0) setClauses.push(import_drizzle_orm3.sql`tool_calls = ${JSON.stringify(updates.toolCalls)}::jsonb`);
  if (updates.contentSegments !== void 0) setClauses.push(import_drizzle_orm3.sql`content_segments = ${JSON.stringify(updates.contentSegments)}::jsonb`);
  if (updates.inputTokens !== void 0) setClauses.push(import_drizzle_orm3.sql`input_tokens = ${updates.inputTokens}`);
  if (updates.outputTokens !== void 0) setClauses.push(import_drizzle_orm3.sql`output_tokens = ${updates.outputTokens}`);
  if (updates.costUsd !== void 0) setClauses.push(import_drizzle_orm3.sql`cost_usd = ${updates.costUsd}`);
  if (updates.durationMs !== void 0) setClauses.push(import_drizzle_orm3.sql`duration_ms = ${updates.durationMs}`);
  if (updates.apiCalls !== void 0) setClauses.push(import_drizzle_orm3.sql`api_calls = ${updates.apiCalls}`);
  if (updates.generationLogId !== void 0) setClauses.push(import_drizzle_orm3.sql`generation_log_id = ${updates.generationLogId}`);
  if (setClauses.length === 0) return;
  const setFragment = import_drizzle_orm3.sql.join(setClauses, import_drizzle_orm3.sql`, `);
  return db.transaction(async (tx) => {
    await tx.execute(import_drizzle_orm3.sql`UPDATE messages SET ${setFragment} WHERE id = ${messageId}::uuid`);
    if (updates.status === "complete" && (updates.costUsd || updates.inputTokens || updates.outputTokens)) {
      const rowResult = await tx.execute(import_drizzle_orm3.sql`SELECT conversation_id FROM messages WHERE id = ${messageId}::uuid`);
      const row = rowResult.rows?.[0] ?? rowResult[0];
      const convId = row?.conversation_id;
      if (convId) {
        await tx.update(conversations).set({
          updatedAt: /* @__PURE__ */ new Date(),
          totalCostUsd: import_drizzle_orm3.sql`total_cost_usd + ${updates.costUsd ?? 0}`,
          totalInputTokens: import_drizzle_orm3.sql`total_input_tokens + ${updates.inputTokens ?? 0}`,
          totalOutputTokens: import_drizzle_orm3.sql`total_output_tokens + ${updates.outputTokens ?? 0}`
        }).where((0, import_drizzle_orm3.eq)(conversations.id, convId));
      }
    }
  });
}
async function upsertMessage(data) {
  const status = data.status ?? "aborted";
  await db.execute(import_drizzle_orm3.sql`
    INSERT INTO messages (
      id, conversation_id, project_id, role, content, status,
      agent_type, model_used, thinking_content, tool_calls, content_segments,
      position
    ) VALUES (
      ${data.id}::uuid, ${data.conversationId}, ${data.projectId}, ${data.role}, ${data.content},
      ${status},
      ${data.agentType ?? null}::agent_type, ${data.modelUsed ?? null},
      ${data.thinkingContent ?? null},
      ${JSON.stringify(data.toolCalls ?? [])}::jsonb,
      ${data.contentSegments ? import_drizzle_orm3.sql`${JSON.stringify(data.contentSegments)}::jsonb` : import_drizzle_orm3.sql`null`},
      (SELECT coalesce(max(position), -1) + 1 FROM messages WHERE conversation_id = ${data.conversationId})
    )
    ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      status = EXCLUDED.status,
      tool_calls = EXCLUDED.tool_calls,
      content_segments = EXCLUDED.content_segments,
      thinking_content = EXCLUDED.thinking_content,
      agent_type = EXCLUDED.agent_type,
      model_used = EXCLUDED.model_used
    WHERE messages.status = 'streaming'
  `);
}
async function updateMessageRating(conversationId, messageId, userRating) {
  await db.update(messages).set({ userRating }).where((0, import_drizzle_orm3.eq)(messages.id, messageId));
}
async function clearConversationMessages(conversationId) {
  await db.delete(messages).where((0, import_drizzle_orm3.eq)(messages.conversationId, conversationId));
  await db.update(conversations).set({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm3.eq)(conversations.id, conversationId));
}

// electron/ipc/_helpers.ts
var import_drizzle_orm4 = require("drizzle-orm");
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertValidUuid(id, label = "id") {
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    throw new IpcValidationError(`${label} must be a valid UUID`);
  }
  return id;
}
var IpcValidationError = class extends Error {
  code = "VALIDATION";
};
var IpcNotFoundError = class extends Error {
  code = "NOT_FOUND";
};
async function loadProjectOrThrow(projectId) {
  assertValidUuid(projectId, "projectId");
  const project = await db.query.projects.findFirst({
    where: (0, import_drizzle_orm4.eq)(projects.id, projectId)
  });
  if (!project) {
    throw new IpcNotFoundError(`Project ${projectId} not found`);
  }
  return project;
}
async function loadConversationOrThrow(conversationId) {
  assertValidUuid(conversationId, "conversationId");
  const conv = await db.query.conversations.findFirst({
    where: (0, import_drizzle_orm4.eq)(conversations.id, conversationId)
  });
  if (!conv) {
    throw new IpcNotFoundError(`Conversation ${conversationId} not found`);
  }
  return conv;
}

// electron/ipc/conversations.ts
var MAX_TITLE_LENGTH = 500;
var MAX_CONTENT_LENGTH = 5e5;
async function list(projectId) {
  await loadProjectOrThrow(projectId);
  return { conversations: await getProjectConversations(projectId) };
}
async function create(args) {
  await loadProjectOrThrow(args.projectId);
  if (args.title !== void 0) {
    if (typeof args.title !== "string" || args.title.length > MAX_TITLE_LENGTH) {
      throw new IpcValidationError(`title must be a string under ${MAX_TITLE_LENGTH} chars`);
    }
  }
  return { conversation: await createConversation({ projectId: args.projectId, title: args.title }) };
}
async function get(id) {
  const conv = await loadConversationOrThrow(id);
  const messages2 = await getConversationMessages(id);
  return { conversation: conv, messages: messages2 };
}
async function update(id, updates) {
  await loadConversationOrThrow(id);
  const patch = {};
  if (updates.title !== void 0) {
    if (typeof updates.title !== "string" || updates.title.length > MAX_TITLE_LENGTH) {
      throw new IpcValidationError(`title must be a string under ${MAX_TITLE_LENGTH} chars`);
    }
    patch.title = updates.title;
  }
  if (updates.isPinned !== void 0) {
    if (typeof updates.isPinned !== "boolean") {
      throw new IpcValidationError("isPinned must be a boolean");
    }
    patch.isPinned = updates.isPinned;
  }
  if (updates.isArchived !== void 0) {
    if (typeof updates.isArchived !== "boolean") {
      throw new IpcValidationError("isArchived must be a boolean");
    }
    patch.isArchived = updates.isArchived;
  }
  if (Object.keys(patch).length === 0) {
    throw new IpcValidationError("No valid fields to update");
  }
  const conversation = await updateConversation(id, patch);
  return { conversation };
}
async function remove(id) {
  await loadConversationOrThrow(id);
  await deleteConversation(id);
  return { success: true };
}
async function listMessages(id) {
  await loadConversationOrThrow(id);
  return { messages: await getConversationMessages(id) };
}
async function addMessageIpc(args) {
  const conv = await loadConversationOrThrow(args.conversationId);
  assertValidUuid(args.projectId, "projectId");
  if (args.projectId !== conv.projectId) {
    throw new IpcValidationError("projectId does not match conversation");
  }
  if (args.role !== "user" && args.role !== "assistant") {
    throw new IpcValidationError('role must be "user" or "assistant"');
  }
  if (typeof args.content !== "string") {
    throw new IpcValidationError("content must be a string");
  }
  if (args.content.length > MAX_CONTENT_LENGTH) {
    throw new IpcValidationError(`content exceeds ${MAX_CONTENT_LENGTH} character limit`);
  }
  if (args.userRating !== void 0 && args.userRating !== null) {
    const r = Number(args.userRating);
    if (!Number.isInteger(r) || r < -1 || r > 1) {
      throw new IpcValidationError("userRating must be -1, 0, or 1");
    }
  }
  if (args._method === "PUT" && args.messageId) {
    await upsertMessage({
      id: args.messageId,
      conversationId: args.conversationId,
      projectId: args.projectId,
      role: args.role ?? "assistant",
      content: args.content ?? "",
      status: args.status ?? "aborted",
      agentType: args.agentType,
      modelUsed: args.modelUsed,
      thinkingContent: args.thinkingContent,
      toolCalls: args.toolCalls,
      contentSegments: args.contentSegments
    });
    return { success: true };
  }
  const message = await addMessage({
    id: args.id,
    conversationId: args.conversationId,
    projectId: args.projectId,
    role: args.role,
    content: args.content,
    status: args.status,
    agentType: args.agentType,
    modelUsed: args.modelUsed,
    thinkingContent: args.thinkingContent,
    toolCalls: args.toolCalls,
    contentSegments: args.contentSegments,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    costUsd: args.costUsd,
    durationMs: args.durationMs,
    apiCalls: args.apiCalls,
    userRating: args.userRating ?? void 0,
    generationLogId: args.generationLogId
  });
  return { message };
}
async function updateMessageIpc(args) {
  await loadConversationOrThrow(args.conversationId);
  assertValidUuid(args.messageId, "messageId");
  const ratingOnly = "userRating" in args && Object.keys(args).filter((k) => k !== "conversationId" && k !== "messageId" && k !== "userRating").length === 0;
  if (ratingOnly) {
    if (args.userRating !== void 0 && args.userRating !== null) {
      const r = Number(args.userRating);
      if (!Number.isInteger(r) || r < -1 || r > 1) {
        throw new IpcValidationError("userRating must be -1, 0, or 1");
      }
    }
    await updateMessageRating(args.conversationId, args.messageId, args.userRating ?? null);
    return { success: true };
  }
  await updateMessage(args.messageId, {
    content: args.content,
    status: args.status,
    agentType: args.agentType,
    modelUsed: args.modelUsed,
    thinkingContent: args.thinkingContent,
    toolCalls: args.toolCalls,
    contentSegments: args.contentSegments,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    costUsd: args.costUsd,
    durationMs: args.durationMs,
    apiCalls: args.apiCalls,
    generationLogId: args.generationLogId
  });
  return { success: true };
}
async function clearMessages(id) {
  await loadConversationOrThrow(id);
  await clearConversationMessages(id);
  return { success: true };
}
function register2(ipcMain2) {
  ipcMain2.handle("cench:conversations.list", (_e, projectId) => list(projectId));
  ipcMain2.handle("cench:conversations.create", (_e, args) => create(args));
  ipcMain2.handle("cench:conversations.get", (_e, id) => get(id));
  ipcMain2.handle(
    "cench:conversations.update",
    (_e, args) => update(args.id, args.updates)
  );
  ipcMain2.handle("cench:conversations.delete", (_e, id) => remove(id));
  ipcMain2.handle("cench:conversations.listMessages", (_e, id) => listMessages(id));
  ipcMain2.handle("cench:conversations.addMessage", (_e, args) => addMessageIpc(args));
  ipcMain2.handle("cench:conversations.updateMessage", (_e, args) => updateMessageIpc(args));
  ipcMain2.handle("cench:conversations.clearMessages", (_e, id) => clearMessages(id));
}

// electron/ipc/usage.ts
async function getSummary(projectId) {
  if (projectId) assertValidUuid(projectId, "projectId");
  return getAgentUsageSummary(projectId);
}
function register3(ipcMain2) {
  ipcMain2.handle("cench:usage.getSummary", (_e, projectId) => getSummary(projectId));
}

// lib/db/queries/generation-logs.ts
var import_drizzle_orm5 = require("drizzle-orm");
function truncateForDB(text2, maxBytes) {
  if (!text2 || text2.length <= maxBytes) return text2;
  return text2.slice(0, maxBytes);
}
var MAX_THINKING_CONTENT = 500 * 1024;
var MAX_USER_PROMPT = 100 * 1024;
var MAX_ANALYSIS_NOTES = 100 * 1024;
async function updateGenerationLog(id, updates) {
  const truncated = {
    ...updates,
    thinkingContent: truncateForDB(updates.thinkingContent, MAX_THINKING_CONTENT),
    analysisNotes: truncateForDB(updates.analysisNotes, MAX_ANALYSIS_NOTES),
    updatedAt: /* @__PURE__ */ new Date()
  };
  await db.update(generationLogs).set(truncated).where((0, import_drizzle_orm5.eq)(generationLogs.id, id));
}
async function getGenerationLogs(opts = {}) {
  const conditions = [];
  if (opts.projectId) conditions.push((0, import_drizzle_orm5.eq)(generationLogs.projectId, opts.projectId));
  if (opts.sceneId) conditions.push((0, import_drizzle_orm5.eq)(generationLogs.sceneId, opts.sceneId));
  if (opts.hasQualityScore) conditions.push((0, import_drizzle_orm5.isNotNull)(generationLogs.qualityScore));
  return db.select().from(generationLogs).where(conditions.length > 0 ? (0, import_drizzle_orm5.and)(...conditions) : void 0).orderBy((0, import_drizzle_orm5.desc)(generationLogs.createdAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0);
}
var ALLOWED_DIMENSIONS = /* @__PURE__ */ new Set([
  "scene_type",
  "model_used",
  "thinking_mode",
  "style_preset_id",
  "agent_type"
]);
async function getQualityByDimension(dimension, projectId) {
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    throw new Error(`Invalid dimension: ${dimension}`);
  }
  const whereClause = projectId ? import_drizzle_orm5.sql`WHERE quality_score >= 0 AND project_id = ${projectId}` : import_drizzle_orm5.sql`WHERE quality_score >= 0`;
  const rows = await db.execute(import_drizzle_orm5.sql`
    SELECT
      ${import_drizzle_orm5.sql.raw(dimension)} as dimension_value,
      AVG(quality_score) as avg_quality,
      COUNT(*) as total_count,
      SUM(CASE WHEN user_action = 'regenerated' THEN 1 ELSE 0 END) as regen_count,
      SUM(CASE WHEN user_action = 'kept' THEN 1 ELSE 0 END) as kept_count,
      SUM(CASE WHEN user_action = 'edited' THEN 1 ELSE 0 END) as edited_count,
      AVG(cost_usd) as avg_cost
    FROM generation_logs
    ${whereClause}
    GROUP BY ${import_drizzle_orm5.sql.raw(dimension)}
    ORDER BY AVG(quality_score) DESC
  `);
  return rows;
}

// lib/generation-logs/score.ts
function computeQualityScore(log) {
  if (!log.userAction) return -1;
  let score = 0.5;
  switch (log.userAction) {
    case "kept":
      score += 0.3;
      break;
    case "edited":
      score += 0.1;
      break;
    case "regenerated":
      score -= 0.4;
      break;
    case "deleted":
      score -= 0.5;
      break;
  }
  if (log.timeToActionMs != null) {
    if (log.userAction === "regenerated" && log.timeToActionMs < 5e3) {
      score -= 0.2;
    }
    if (log.userAction === "kept" && log.timeToActionMs > 3e4) {
      score += 0.1;
    }
  }
  if (log.editDistance != null && log.generatedCodeLength) {
    const relativeEdit = log.editDistance / log.generatedCodeLength;
    if (relativeEdit > 0.6)
      score -= 0.4;
    else if (relativeEdit > 0.3)
      score -= 0.2;
    else if (relativeEdit < 0.05) score += 0.1;
  }
  if (log.userRating != null) {
    score += (log.userRating - 3) * 0.1;
  }
  if (log.exportSucceeded === false) score -= 0.3;
  if (log.exportSucceeded === true) score += 0.1;
  return Math.max(0, Math.min(1, score));
}

// electron/ipc/generation-log.ts
var VALID_USER_ACTIONS = [
  "kept",
  "regenerated",
  "edited",
  "deleted",
  "rated-positive",
  "rated-negative",
  "exported",
  "published"
];
var VALID_DIMENSIONS = ["scene_type", "model_used", "thinking_mode", "style_preset_id", "agent_type"];
var MAX_QUERY_RESULTS = 500;
async function update2(args) {
  assertValidUuid(args.logId, "logId");
  if (args.userAction && !VALID_USER_ACTIONS.includes(args.userAction)) {
    throw new IpcValidationError(`userAction must be one of: ${VALID_USER_ACTIONS.join(", ")}`);
  }
  if (args.timeToActionMs != null && (typeof args.timeToActionMs !== "number" || args.timeToActionMs < 0 || !Number.isFinite(args.timeToActionMs))) {
    throw new IpcValidationError("timeToActionMs must be a non-negative number");
  }
  if (args.editDistance != null && (typeof args.editDistance !== "number" || args.editDistance < 0 || !Number.isInteger(args.editDistance))) {
    throw new IpcValidationError("editDistance must be a non-negative integer");
  }
  if (args.userRating != null && (typeof args.userRating !== "number" || args.userRating < 0 || args.userRating > 5)) {
    throw new IpcValidationError("userRating must be between 0 and 5");
  }
  const updates = {};
  if (args.userAction) updates.userAction = args.userAction;
  if (args.timeToActionMs != null) updates.timeToActionMs = args.timeToActionMs;
  if (args.editDistance != null) updates.editDistance = args.editDistance;
  if (args.userRating != null) updates.userRating = args.userRating;
  if (args.exportSucceeded != null) updates.exportSucceeded = args.exportSucceeded;
  if (args.exportErrorMessage) updates.exportErrorMessage = args.exportErrorMessage;
  if (args.userAction) {
    const score = computeQualityScore({
      userAction: args.userAction,
      timeToActionMs: args.timeToActionMs,
      editDistance: args.editDistance,
      generatedCodeLength: args.generatedCodeLength,
      userRating: args.userRating,
      exportSucceeded: args.exportSucceeded
    });
    if (score >= 0) updates.qualityScore = score;
  }
  await updateGenerationLog(args.logId, updates);
  return { success: true };
}
async function list2(args) {
  if (args.projectId) assertValidUuid(args.projectId, "projectId");
  if (args.sceneId) assertValidUuid(args.sceneId, "sceneId");
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_QUERY_RESULTS);
  const offset = Math.max(args.offset ?? 0, 0);
  const logs = await getGenerationLogs({
    projectId: args.projectId,
    sceneId: args.sceneId,
    limit,
    offset
  });
  return { logs };
}
async function listByDimension(args) {
  if (!VALID_DIMENSIONS.includes(args.dimension)) {
    throw new IpcValidationError(`dimension must be one of: ${VALID_DIMENSIONS.join(", ")}`);
  }
  if (args.projectId) assertValidUuid(args.projectId, "projectId");
  const data = await getQualityByDimension(args.dimension, args.projectId);
  return { data };
}
function register4(ipcMain2) {
  ipcMain2.handle("cench:generationLog.update", (_e, args) => update2(args));
  ipcMain2.handle("cench:generationLog.list", (_e, args) => list2(args));
  ipcMain2.handle(
    "cench:generationLog.listByDimension",
    (_e, args) => listByDimension(args)
  );
}

// electron/ipc/permissions.ts
var TRACKED_APIS = ["heygen", "veo3", "imageGen", "backgroundRemoval", "elevenLabs", "unsplash"];
async function getSpend() {
  const result = {};
  for (const api of TRACKED_APIS) {
    result[api] = {
      sessionSpend: await getSessionSpend(api),
      monthlySpend: await getMonthlySpend(api)
    };
  }
  return result;
}
async function perform(args) {
  if (args.action === "log_spend") {
    if (!args.api) throw new IpcValidationError("api is required");
    if (typeof args.costUsd !== "number" || !Number.isFinite(args.costUsd)) {
      throw new IpcValidationError("costUsd must be a finite number");
    }
    if (args.projectId) assertValidUuid(args.projectId, "projectId");
    await logSpend(args.projectId ?? "", args.api, args.costUsd, args.description ?? "");
    return { ok: true };
  }
  if (args.action === "set_session_permission") {
    if (!args.api || !args.decision) throw new IpcValidationError("api and decision required");
    await setSessionPermission(args.api, args.decision);
    return { ok: true };
  }
  if (args.action === "get_session_permission") {
    if (!args.api) throw new IpcValidationError("api required");
    const decision = await getSessionPermission(args.api);
    return { decision };
  }
  throw new IpcValidationError(`Unknown permissions action: ${args.action}`);
}
function register5(ipcMain2) {
  ipcMain2.handle("cench:permissions.getSpend", () => getSpend());
  ipcMain2.handle("cench:permissions.perform", (_e, args) => perform(args));
}

// electron/ipc/skills.ts
var import_electron = require("electron");
var import_node_path = __toESM(require("node:path"));
var import_promises = __toESM(require("node:fs/promises"));
function getSkillRoots() {
  if (import_electron.app.isPackaged) {
    const base = import_node_path.default.join(process.resourcesPath, "skill-data");
    return {
      cench: import_node_path.default.join(base, "cench"),
      library: import_node_path.default.join(base, "library")
    };
  }
  const repoRoot = import_node_path.default.resolve(__dirname, "..");
  return {
    cench: import_node_path.default.join(repoRoot, ".claude/skills/cench"),
    library: import_node_path.default.join(repoRoot, "lib/skills/library")
  };
}
async function readSkillFile(args) {
  if (!args.source || !args.file) {
    throw new IpcValidationError("source and file are required");
  }
  const roots = getSkillRoots();
  const root = roots[args.source];
  if (!root) {
    throw new IpcValidationError(`Unknown source: ${args.source}`);
  }
  const resolved = import_node_path.default.resolve(root, args.file);
  if (!resolved.startsWith(root + import_node_path.default.sep) && resolved !== root) {
    throw new IpcValidationError("Invalid file path (path traversal)");
  }
  try {
    const content = await import_promises.default.readFile(resolved, "utf-8");
    return { content, file: args.file, source: args.source };
  } catch {
    throw new IpcNotFoundError(`Skill file not found: ${args.source}/${args.file}`);
  }
}
function register6(ipcMain2) {
  ipcMain2.handle(
    "cench:skills.readFile",
    (_e, args) => readSkillFile(args)
  );
}

// electron/ipc/index.ts
function registerAllIpc(ipcMain2) {
  register(ipcMain2);
  register2(ipcMain2);
  register3(ipcMain2);
  register4(ipcMain2);
  register5(ipcMain2);
  register6(ipcMain2);
}

// electron/main.ts
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
function webZoomTargetWindow() {
  return import_electron2.BrowserWindow.getFocusedWindow() ?? import_electron2.BrowserWindow.getAllWindows()[0] ?? null;
}
var DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";
function getUserScenesDir() {
  return import_path.default.join(import_electron2.app.getPath("userData"), "scenes");
}
function getStaticAppDir() {
  return import_path.default.join(__dirname, "..", "out");
}
import_electron2.protocol.registerSchemesAsPrivileged([
  {
    scheme: "cench",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);
async function registerCenchProtocol() {
  const staticDir = import_path.default.resolve(getStaticAppDir());
  const scenesDir = import_path.default.resolve(getUserScenesDir());
  await import_promises2.default.mkdir(scenesDir, { recursive: true });
  import_electron2.protocol.handle("cench", async (request) => {
    try {
      const url = new URL(request.url);
      const host = url.hostname;
      const rawPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      let baseDir;
      if (host === "scenes") {
        baseDir = scenesDir;
      } else if (host === "app" || host === "") {
        baseDir = staticDir;
      } else {
        return new Response(`Unknown cench:// host "${host}"`, { status: 404 });
      }
      let filePath = import_path.default.resolve(baseDir, rawPath || "index.html");
      if (!filePath.startsWith(baseDir + import_path.default.sep) && filePath !== baseDir) {
        return new Response("Forbidden", { status: 403 });
      }
      try {
        const stat = await import_promises2.default.stat(filePath);
        if (stat.isDirectory()) filePath = import_path.default.join(filePath, "index.html");
      } catch {
        if (!filePath.endsWith(".html")) {
          const htmlVariant = `${filePath}.html`;
          try {
            await import_promises2.default.access(htmlVariant);
            filePath = htmlVariant;
          } catch {
          }
        }
      }
      try {
        const realPath = await import_promises2.default.realpath(filePath);
        if (!realPath.startsWith(baseDir + import_path.default.sep) && realPath !== baseDir) {
          return new Response("Forbidden (symlink escape)", { status: 403 });
        }
        filePath = realPath;
      } catch {
      }
      return import_electron2.net.fetch((0, import_url.pathToFileURL)(filePath).toString());
    } catch (err) {
      console.error("[cench-protocol] failed to serve", request.url, err);
      return new Response("Internal error", { status: 500 });
    }
  });
}
function sanitizeFilename(hint, fallback = "recording") {
  return (hint || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || fallback;
}
import_electron2.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
function createWindow() {
  const win = new import_electron2.BrowserWindow({
    width: 1600,
    height: 960,
    backgroundColor: "#0b0b0f",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 16 },
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  });
  const appUrl = import_electron2.app.isPackaged ? "cench://app/index.html" : DEV_URL;
  win.loadURL(appUrl);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const template = [
    ...process.platform === "darwin" ? [
      {
        label: import_electron2.app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" }
        ]
      }
    ] : [],
    {
      label: "File",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+Shift+H",
          click: () => {
            const w = import_electron2.BrowserWindow.getFocusedWindow() ?? import_electron2.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const store = window.__cenchStore;
                if (store) { store.setState({ project: { ...store.getState().project, id: '' } }); window.location.href = '/'; }
              })()
            `);
          }
        },
        { type: "separator" },
        { role: "close" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => {
            const w = import_electron2.BrowserWindow.getFocusedWindow() ?? import_electron2.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                  document.execCommand('undo');
                } else {
                  window.__cenchStore?.getState()?.undo?.();
                }
              })()
            `);
          }
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => {
            const w = import_electron2.BrowserWindow.getFocusedWindow() ?? import_electron2.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                  document.execCommand('redo');
                } else {
                  window.__cenchStore?.getState()?.redo?.();
                }
              })()
            `);
          }
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...process.platform === "darwin" ? [{ role: "pasteAndMatchStyle" }, { role: "delete" }, { role: "selectAll" }] : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Preview Fullscreen",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => {
            const w = import_electron2.BrowserWindow.getFocusedWindow() ?? import_electron2.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const s = window.__cenchStore?.getState();
                if (s) s.setPreviewFullscreen(!s.isPreviewFullscreen);
              })()
            `);
          }
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Documentation",
      click: () => {
        import_electron2.shell.openExternal(`${DEV_URL.replace(/\/$/, "")}/docs`);
      }
    },
    {
      role: "window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...process.platform === "darwin" ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]
      ]
    }
  ];
  import_electron2.Menu.setApplicationMenu(import_electron2.Menu.buildFromTemplate(template));
}
import_electron2.app.whenReady().then(async () => {
  import_electron2.ipcMain.handle("cench:gitStatus", async () => {
    if (import_electron2.app.isPackaged) {
      return { ok: false, branch: null, dirty: false };
    }
    const cwd = process.cwd();
    try {
      const { stdout: branchOut } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd,
        timeout: 8e3,
        maxBuffer: 1024 * 1024
      });
      const { stdout: por } = await execFileAsync("git", ["status", "--porcelain"], {
        cwd,
        timeout: 8e3,
        maxBuffer: 1024 * 1024
      });
      const branch = branchOut.trim();
      if (!branch) return { ok: false, branch: null, dirty: false };
      return { ok: true, branch, dirty: por.trim().length > 0 };
    } catch {
      return { ok: false, branch: null, dirty: false };
    }
  });
  import_electron2.ipcMain.handle("cench:webZoomIn", () => {
    const win = webZoomTargetWindow();
    if (!win) return { ok: false, factor: 1 };
    const z = win.webContents.getZoomFactor();
    const next = Math.min(3, Math.round((z + 0.1) * 100) / 100);
    win.webContents.setZoomFactor(next);
    return { ok: true, factor: win.webContents.getZoomFactor() };
  });
  import_electron2.ipcMain.handle("cench:webZoomOut", () => {
    const win = webZoomTargetWindow();
    if (!win) return { ok: false, factor: 1 };
    const z = win.webContents.getZoomFactor();
    const next = Math.max(0.5, Math.round((z - 0.1) * 100) / 100);
    win.webContents.setZoomFactor(next);
    return { ok: true, factor: win.webContents.getZoomFactor() };
  });
  import_electron2.ipcMain.handle("cench:webZoomReset", () => {
    const win = webZoomTargetWindow();
    if (!win) return { ok: false, factor: 1 };
    win.webContents.setZoomFactor(1);
    return { ok: true, factor: 1 };
  });
  import_electron2.ipcMain.handle(
    "cench:capturePage",
    async (_evt, args) => {
      const win = webZoomTargetWindow();
      if (!win) return { ok: false, error: "no window" };
      try {
        const image = args?.rect ? await win.webContents.capturePage(args.rect) : await win.webContents.capturePage();
        const dataUri = image.toDataURL();
        return { ok: true, dataUri, mimeType: "image/png" };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }
  );
  import_electron2.ipcMain.handle("cench:saveDialog", async (_evt, suggestedName) => {
    const res = await import_electron2.dialog.showSaveDialog({
      title: "Save exported video",
      defaultPath: suggestedName || `export-${Date.now()}.mp4`,
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
    });
    return { canceled: res.canceled, filePath: res.filePath ?? null };
  });
  import_electron2.ipcMain.handle("cench:writeFile", async (_evt, args) => {
    await import_promises2.default.mkdir(import_path.default.dirname(args.filePath), { recursive: true });
    await import_promises2.default.writeFile(args.filePath, Buffer.from(args.bytes));
    return { ok: true };
  });
  import_electron2.ipcMain.handle(
    "cench:saveRecording",
    async (_evt, args) => {
      const extRaw = (args.extension || "webm").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = extRaw || "webm";
      const dir = import_path.default.join(import_electron2.app.getPath("userData"), "recordings");
      await import_promises2.default.mkdir(dir, { recursive: true });
      const safeBase = sanitizeFilename(args.nameHint || "");
      const filePath = import_path.default.join(dir, `${safeBase}-${Date.now()}.${ext}`);
      await import_promises2.default.writeFile(filePath, Buffer.from(args.bytes));
      const fileUrl = (0, import_url.pathToFileURL)(filePath).href;
      return { ok: true, filePath, fileUrl };
    }
  );
  import_electron2.ipcMain.handle(
    "cench:concatMp4",
    async (_evt, args) => {
      const inputs = (args.inputs ?? []).filter(Boolean);
      if (inputs.length === 0) throw new Error("concatMp4: no input files");
      if (inputs.length === 1) {
        await import_promises2.default.copyFile(inputs[0], args.output);
        if (args.cleanup) {
          await import_promises2.default.unlink(inputs[0]).catch(() => {
          });
        }
        return { ok: true };
      }
      const transitions = args.transitions ?? [];
      try {
        const stitcherPath = import_electron2.app.isPackaged ? import_path.default.join(process.resourcesPath, "render-server", "stitcher.js") : import_path.default.join(process.cwd(), "render-server", "stitcher.js");
        const mod = await import((0, import_url.pathToFileURL)(stitcherPath).href);
        const stitchScenes = mod?.stitchScenes;
        if (typeof stitchScenes !== "function") {
          throw new Error("stitchScenes() not found in render-server/stitcher.js");
        }
        const stitchedTransitions = Array.from({ length: Math.max(0, inputs.length - 1) }, (_v, i) => ({
          type: transitions[i]?.type ?? "none",
          duration: transitions[i]?.duration ?? 0.5
        }));
        await stitchScenes(inputs, stitchedTransitions, args.output);
      } finally {
        if (args.cleanup) {
          await Promise.all(inputs.map((p) => import_promises2.default.unlink(p).catch(() => {
          })));
        }
      }
      return { ok: true };
    }
  );
  const MAX_CURSOR_SAMPLES = 36e3;
  let cursorInterval = null;
  let cursorSamples = [];
  let cursorStartTime = 0;
  let cursorSourceDisplay = null;
  import_electron2.ipcMain.handle("cench:startCursorTelemetry", (_evt, args) => {
    cursorSamples = [];
    cursorStartTime = Date.now();
    cursorSourceDisplay = null;
    if (args?.displayId) {
      const numId = Number(args.displayId);
      const all = import_electron2.screen.getAllDisplays();
      cursorSourceDisplay = all.find((d) => d.id === numId || String(d.id) === args.displayId) ?? null;
    }
    cursorInterval = setInterval(() => {
      const point = import_electron2.screen.getCursorScreenPoint();
      const display = cursorSourceDisplay ?? import_electron2.screen.getDisplayNearestPoint(point);
      const { x, y, width, height } = display.bounds;
      const nx = Math.max(0, Math.min(1, (point.x - x) / width));
      const ny = Math.max(0, Math.min(1, (point.y - y) / height));
      if (cursorSamples.length >= MAX_CURSOR_SAMPLES) {
        cursorSamples.shift();
      }
      cursorSamples.push({ t: Date.now() - cursorStartTime, x: nx, y: ny });
    }, 100);
    return { ok: true };
  });
  import_electron2.ipcMain.handle("cench:stopCursorTelemetry", () => {
    if (cursorInterval) {
      clearInterval(cursorInterval);
      cursorInterval = null;
    }
    cursorSourceDisplay = null;
    const samples = cursorSamples;
    cursorSamples = [];
    return { samples };
  });
  import_electron2.ipcMain.handle(
    "cench:saveRecordingSession",
    async (_evt, args) => {
      if (!args.screenBytes || args.screenBytes.byteLength === 0) {
        throw new Error("Screen recording is empty \u2014 nothing to save");
      }
      const dir = import_path.default.join(import_electron2.app.getPath("userData"), "recordings");
      await import_promises2.default.mkdir(dir, { recursive: true });
      const ts = Date.now();
      const safeBase = sanitizeFilename(args.nameHint || "");
      const writtenFiles = [];
      try {
        const screenPath = import_path.default.join(dir, `${safeBase}-${ts}.webm`);
        await import_promises2.default.writeFile(screenPath, Buffer.from(args.screenBytes));
        writtenFiles.push(screenPath);
        const result = {
          screenVideoPath: screenPath,
          screenVideoUrl: (0, import_url.pathToFileURL)(screenPath).href,
          createdAt: ts
        };
        if (args.webcamBytes && args.webcamBytes.byteLength > 0) {
          const webcamPath = import_path.default.join(dir, `${safeBase}-${ts}-webcam.webm`);
          await import_promises2.default.writeFile(webcamPath, Buffer.from(args.webcamBytes));
          writtenFiles.push(webcamPath);
          result.webcamVideoPath = webcamPath;
          result.webcamVideoUrl = (0, import_url.pathToFileURL)(webcamPath).href;
        }
        const manifestPath = import_path.default.join(dir, `${safeBase}-${ts}.session.json`);
        await import_promises2.default.writeFile(manifestPath, JSON.stringify(result, null, 2));
        return result;
      } catch (err) {
        await Promise.all(writtenFiles.map((f) => import_promises2.default.unlink(f).catch(() => {
        })));
        throw err;
      }
    }
  );
  import_electron2.session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ["media", "audioCapture", "microphone", "videoCapture", "camera"];
    return allowed.includes(permission);
  });
  import_electron2.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ["media", "audioCapture", "microphone", "videoCapture", "camera"];
    callback(allowed.includes(permission));
  });
  await registerCenchProtocol();
  registerAllIpc(import_electron2.ipcMain);
  createWindow();
  import_electron2.session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    console.log("[Electron] setDisplayMediaRequestHandler called");
    console.log("[Electron]   videoRequested:", !!request.videoRequested);
    console.log("[Electron]   audioRequested:", !!request.audioRequested);
    console.log("[Electron]   frame:", request.frame?.url?.slice(0, 80));
    try {
      ;
      callback({}, { useSystemPicker: true });
      console.log("[Electron]   callback invoked with useSystemPicker: true");
    } catch (err) {
      console.error("[Electron]   callback error:", err.message);
      callback(null);
    }
  });
  import_electron2.app.on("activate", () => {
    if (import_electron2.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron2.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron2.app.quit();
});
//# sourceMappingURL=main.js.map

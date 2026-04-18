'use client'

import type {
  Scene,
  SceneUsage,
  GlobalStyle,
  ExportProgress,
  ExportSettings,
  TextOverlay,
  SvgObject,
  SvgBranch,
  SceneType,
  Project,
  SceneGraph,
  SceneNode,
  SceneEdge,
  InteractionElement,
  SceneVariable,
  AILayer,
  AvatarLayer,
  APIPermissions,
  PermissionRequest,
  PermissionResponse,
  APIName,
  SceneStyleOverride,
  AudioSettings,
  TTSTrack,
  SFXTrack,
  MusicTrack,
  Timeline,
  Track,
  TrackType,
  Clip,
  Keyframe,
} from '../types'
import type { GridConfig } from '../grid'
import type {
  ChatMessage,
  AgentType,
  ModelId,
  ModelTier,
  ThinkingMode,
  ConversationSummary,
  Storyboard,
} from '../agents/types'
import type { ModelConfig, ProviderConfig } from '../agents/model-config'
import type { AgentConfig } from '../agents/agent-config'
import type { LayersTabSectionId } from '../layers-tab-header'
import type { LayersStripTabId } from '../layers-strip-dock'

// ── Undo/Redo ─────────────────────────────────────────────────────────────────

export interface UndoableState {
  scenes: Scene[]
  globalStyle: GlobalStyle
  project: Project
}

// ── Set / Get type aliases ───────────────────────────────────────────────────

export type Set = (partial: Partial<VideoStore> | ((state: VideoStore) => Partial<VideoStore>)) => void
export type Get = () => VideoStore

// ── VideoStore interface ─────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

/** Built-in center tabs (Electron). */
export type CoreCenterTabId = 'preview' | 'settings' | 'workspace' | 'customize'

/** Layers strip sub-tab opened as its own center tab (drag from left Layers). */
export type LayersDockCenterTabId = `layers:${LayersStripTabId}`

/** Ephemeral tabs that only appear when explicitly opened (not in always-available core set). */
export type ExportCenterTabId = 'export'

export type CenterTabId = CoreCenterTabId | LayersDockCenterTabId | ExportCenterTabId

export interface ExportFormDraft {
  platformId: import('../export/platform-profiles').PlatformProfileId
  resolution: import('../types').ExportResolution
  fps: import('../types').ExportFPS
  profile: 'fast' | 'quality'
  os: 'mac' | 'windows' | 'linux' | 'unknown'
  filename: string
  /** Absolute filesystem path (Electron) or empty string (web fallback). */
  saveDirPath: string
  /** Display name for the save folder (basename of saveDirPath). */
  saveDirName: string
}

export type LastExportStatus = 'idle' | 'success' | 'error'

export interface VideoStore {
  scenes: Scene[]
  selectedSceneId: string | null
  globalStyle: GlobalStyle

  // Auth
  currentUser: AuthUser | null
  setCurrentUser: (user: AuthUser | null) => void

  // Undo/Redo
  _undoStack: UndoableState[]
  _redoStack: UndoableState[]
  _pushUndo: () => void
  _pushUndoDebounced: () => void
  undo: () => void
  redo: () => void
  isGenerating: boolean
  generatingSceneId: string | null
  lastGenerationError: string | null
  isExporting: boolean
  isExportModalOpen: boolean
  isNewProjectModalOpen: boolean
  openNewProjectModal: () => void
  closeNewProjectModal: () => void
  exportProgress: ExportProgress | null
  exportFormDraft: ExportFormDraft | null
  setExportFormDraft: (patch: Partial<ExportFormDraft>) => void
  clearExportFormDraft: () => void
  lastExportStatus: LastExportStatus
  markExportStatusSeen: () => void

  // Recording (agent/API-driven)
  recordingState: import('@/types/electron').RecordingStoreState
  recordingConfig: import('@/types/electron').RecordingConfig
  recordingCommand: import('@/types/electron').RecordingCommand
  recordingCommandNonce: number
  recordingResult: import('@/types/electron').RecordingSessionManifest | null
  recordingError: string | null
  recordingElapsed: number
  recordingAttachSceneId: string | null
  setRecordingCommand: (cmd: import('@/types/electron').RecordingCommand) => void
  setRecordingConfig: (config: Partial<import('@/types/electron').RecordingConfig>) => void
  setRecordingState: (state: import('@/types/electron').RecordingStoreState) => void
  setRecordingResult: (result: import('@/types/electron').RecordingSessionManifest | null) => void
  setRecordingError: (error: string | null) => void
  setRecordingElapsed: (ms: number) => void
  setRecordingAttachSceneId: (sceneId: string | null) => void
  timelineHeight: number
  graphExpandedScenes: string[]
  timelineView: 'track' | 'graph'
  timelineTransport: { globalTime: number; totalDuration: number; isPlaying: boolean }
  isPreviewFullscreen: boolean
  /** When true, preview uses the Pixi compositor instead of per-scene iframes (Electron continuous mode) */
  compositorPreview: boolean
  setCompositorPreview: (active: boolean) => void
  /** When true, the center area shows the Zdog Studio viewport + controls instead of preview + timeline */
  zdogStudioMode: boolean
  setZdogStudioMode: (active: boolean) => void
  /** When true, editor is in recording studio mode with live capture preview */
  studioRecordMode: boolean
  setStudioRecordMode: (active: boolean) => void
  /** Live getDisplayMedia stream for studio record preview (not serializable) */
  studioRecordStream: MediaStream | null
  setStudioRecordStream: (stream: MediaStream | null) => void
  /** Preview canvas scale (1 = 100%); synced from PreviewPlayer for header display */
  previewZoom: number
  setPreviewZoom: (z: number) => void
  timelineZoom: number // pixels per second (0 = fit-to-width)
  timelineScrollX: number
  timelineAutoScroll: boolean
  /** Transient: set true when user manually scrolls the timeline during playback, suppresses auto-follow until next play-start */
  timelineFollowPaused: boolean
  sceneHtmlVersion: number
  /** Per-scene HTML write errors — shown in preview when a scene file failed to save */
  sceneWriteErrors: Record<string, string>
  /** True when the initial project load failed after all retries */
  projectLoadFailed: boolean
  gridConfig: GridConfig
  project: Project
  isPublishing: boolean
  publishError: string | null
  publishedUrl: string | null
  showPublishPanel: boolean
  showTemplatePicker: boolean
  setShowTemplatePicker: (show: boolean) => void

  // Conversation state
  conversations: ConversationSummary[]
  activeConversationId: string | null
  conversationsLoading: boolean

  // Conversation actions
  loadConversations: (projectId: string) => Promise<void>
  newConversation: (projectId: string) => Promise<string>
  switchConversation: (conversationId: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  pinConversation: (id: string, pinned: boolean) => Promise<void>
  deleteConversation: (id: string) => Promise<void>

  // Chat / Agent state
  chatMessages: ChatMessage[]
  isChatOpen: boolean
  isAgentRunning: boolean
  /** Monotonically increasing nonce — increment to signal abort to AgentChat SSE stream */
  _abortNonce: number
  /** Abort any in-flight agent SSE stream (increments _abortNonce) */
  abortAgentRun: () => void
  /** True when another browser tab has an agent run in progress (via BroadcastChannel) */
  isAgentRunningRemote: boolean
  /** Timestamp when the current agent run started — used to detect user edits during a run */
  _agentRunStartedAt: number
  agentType: AgentType | null
  agentModelId: ModelId | null
  agentOverride: AgentType | null
  /** Director template (explainer, onboarding, product-demo) when using a Director agent */
  directorTemplate: string | null
  modelOverride: ModelId | null
  modelTier: ModelTier
  thinkingMode: ThinkingMode
  /** When true, all LLM calls route through Ollama and TTS uses free providers */
  localMode: boolean
  /** When true, agent uses mock SSE stream (no API credits spent) */
  mockMode: boolean
  /** Selected local model ID (e.g. Ollama model) when localMode is on */
  localModelId: string | null
  sceneContext: 'all' | 'selected' | 'auto' | string
  activeTools: string[]
  chatInputValue: string
  settingsTab: 'models' | 'agents' | 'general' | null
  setSettingsTab: (tab: 'models' | 'agents' | 'general' | null) => void
  /** Which center tabs are open (Electron center strip). */
  centerOpenTabs: CenterTabId[]
  /** Active center tab content; null when all tabs are closed. */
  centerTab: CenterTabId | null
  setCenterTab: (tab: CenterTabId | null) => void
  closeCenterTab: (tab: CenterTabId) => void
  /** Set while dragging a Layers strip tab — center UI shows a drop catcher above the preview iframe. */
  layersStripDragTabId: LayersStripTabId | null
  setLayersStripDragTabId: (id: LayersStripTabId | null) => void
  rightPanelTab: 'prompt' | 'layers' | 'media' | null
  setRightPanelTab: (tab: 'prompt' | 'layers' | 'media' | null) => void
  /** Unified text editor: slot key from lib/text-slots (overlay:…, svg:…, ix:…, phys:…) */
  textEditorSlotKey: string | null
  setTextEditorSlotKey: (key: string | null) => void
  /** When set, Layers tab switches to this sub-section once (e.g. Text after double-click in layer stack). */
  layersTabSectionPending: LayersTabSectionId | null
  /** With {@link layersTabSectionPending} `avatar`: select this AI avatar layer id in the Avatar tab. */
  layersTabAvatarLayerIdPending: string | null
  clearLayersTabSectionPending: () => void
  openTextTabForSlot: (slotKey: string) => void
  /** Open Layers panel and activate a sub-tab once (e.g. Elements after clicking physics card). */
  openLayersSection: (section: LayersTabSectionId, opts?: { avatarLayerId?: string }) => void
  /** Layer stack row key (e.g. `bg:stage`, `scene:motion`) for the Properties sub-tab. */
  layerStackPropertiesKey: string | null
  setLayerStackPropertiesKey: (key: string | null) => void
  /** Opens Layers → Properties for a stack row (double-click in layer stack). */
  openLayerStackProperties: (stackKey: string) => void

  // Media library
  projectAssets: import('../types').ProjectAsset[]
  assetsLoading: boolean
  loadProjectAssets: (projectId: string) => Promise<void>
  addProjectAsset: (asset: import('../types').ProjectAsset) => void
  updateProjectAsset: (assetId: string, updates: Partial<import('../types').ProjectAsset>) => void
  removeProjectAsset: (assetId: string) => void
  setWatermark: (watermark: import('../types').WatermarkConfig | null) => void

  // Brand Kit
  brandKit: import('../types/media').BrandKit | null
  updateBrandKit: (updates: Partial<import('../types/media').BrandKit>) => Promise<void>
  applyBrandToStyle: () => void

  // Chat Actions
  setChatOpen: (open: boolean) => void
  addChatMessage: (msg: ChatMessage) => void
  /** Persist a user message to the DB. Awaitable — call before starting the agent stream. */
  persistUserMessage: (msg: ChatMessage) => Promise<void>
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void
  /** Persist a chat message to DB. INSERT on first call, UPDATE on subsequent. Awaitable. */
  persistChatMessage: (id: string, opts?: { status?: string }) => Promise<void>
  /** Track which message IDs have been persisted to DB (INSERT vs UPDATE discrimination) */
  _persistedMessageIds: globalThis.Set<string>
  removeChatMessage: (id: string) => void
  clearChat: () => void
  setAgentRunning: (running: boolean) => void
  setAgentType: (type: AgentType | null) => void
  setAgentModelId: (id: ModelId | null) => void
  setAgentOverride: (type: AgentType | null) => void
  /** Storyboard from Planner awaiting review / edit before Director build */
  pendingStoryboard: Storyboard | null
  setPendingStoryboard: (sb: Storyboard | null) => void
  /** Original planner storyboard snapshot (base for diffs + per-scene revert) */
  storyboardProposed: Storyboard | null
  setStoryboardProposed: (sb: Storyboard | null) => void
  pausedAgentRun: {
    toolName: string
    toolInput: Record<string, unknown>
    agentType?: string | null
    reason?: string | null
    createdAt: string
  } | null
  setPausedAgentRun: (
    v: {
      toolName: string
      toolInput: Record<string, unknown>
      agentType?: string | null
      reason?: string | null
      createdAt: string
    } | null,
  ) => void
  /** Run checkpoint for resuming interrupted multi-scene builds */
  runCheckpoint: import('../agents/types').RunCheckpoint | null
  setRunCheckpoint: (v: import('../agents/types').RunCheckpoint | null) => void
  /** When true, the next chat send uses Planner (plan-only) until a storyboard is proposed */
  planFirstMode: boolean
  setPlanFirstMode: (v: boolean) => void
  setModelOverride: (id: ModelId | null) => void
  setModelTier: (tier: ModelTier) => void
  setThinkingMode: (mode: ThinkingMode) => void
  setLocalMode: (enabled: boolean) => void
  setLocalModelId: (id: string | null) => void
  setSceneContext: (ctx: 'all' | 'selected' | 'auto' | string) => void
  setActiveTools: (tools: string[]) => void
  toggleActiveTool: (toolId: string) => void
  setChatInputValue: (v: string) => void
  // Sync scenes from agent tool execution
  syncScenesFromAgent: (updatedScenes: Scene[], updatedGlobalStyle: GlobalStyle) => Promise<void>

  // Actions
  setTimelineHeight: (height: number) => void
  toggleGraphSceneExpanded: (sceneId: string) => void
  setTimelineView: (view: 'track' | 'graph') => void
  setTimelineTransport: (transport: Partial<{ globalTime: number; totalDuration: number; isPlaying: boolean }>) => void
  setPreviewFullscreen: (full: boolean) => void
  setTimelineZoom: (zoom: number) => void
  setTimelineScrollX: (x: number) => void
  setTimelineAutoScroll: (v: boolean) => void
  setTimelineFollowPaused: (v: boolean) => void
  addScene: (prompt?: string) => string
  updateScene: (id: string, updates: Partial<Scene>) => void
  deleteScene: (id: string) => void
  duplicateScene: (id: string) => void
  reorderScenes: (fromIndex: number, toIndex: number) => void
  moveScene: (id: string, direction: 'up' | 'down') => void
  selectScene: (id: string) => void
  updateGlobalStyle: (updates: Partial<GlobalStyle>) => void
  updateGridConfig: (updates: Partial<GridConfig>) => void

  // Project actions
  setOutputMode: (mode: 'mp4' | 'interactive') => void
  updateProject: (updates: Partial<Project>) => void
  updateSceneGraph: (graph: SceneGraph) => void
  publishProject: () => Promise<void>
  setShowPublishPanel: (show: boolean) => void

  // Timeline / Track / Clip (NLE model)
  selectedClipIds: string[]
  setSelectedClipIds: (ids: string[]) => void
  toggleClipSelection: (clipId: string, multi?: boolean) => void
  getTimeline: () => Timeline | null
  initTimeline: (force?: boolean) => void
  syncTimelineFromScenes: () => void
  addTrack: (type: TrackType, name?: string) => string
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, updates: Partial<Pick<Track, 'name' | 'muted' | 'locked' | 'position'>>) => void
  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => string
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  splitClip: (clipId: string, atTime: number) => { leftId: string; rightId: string } | null
  moveClip: (clipId: string, toTrackId: string, startTime: number) => void

  // Variable actions
  addSceneVariable: (sceneId: string, variable: SceneVariable) => void
  removeSceneVariable: (sceneId: string, variableName: string) => void
  /** Runtime variable values for preview (not persisted to DB — used by PreviewPlayer) */
  runtimeVariables: Record<string, Record<string, unknown>> // sceneId => name => value
  setRuntimeVariable: (sceneId: string, name: string, value: unknown) => void
  getRuntimeVariables: (sceneId: string) => Record<string, unknown>

  // Interaction actions
  addInteraction: (sceneId: string, element: InteractionElement) => void
  updateInteraction: (sceneId: string, elementId: string, updates: Partial<InteractionElement>) => void
  /** Replace whole element (e.g. when switching interaction type). */
  replaceInteraction: (sceneId: string, elementId: string, next: InteractionElement) => void
  removeInteraction: (sceneId: string, elementId: string) => void

  // Overlay actions
  addTextOverlay: (sceneId: string) => void
  updateTextOverlay: (sceneId: string, overlayId: string, updates: Partial<TextOverlay>) => void
  removeTextOverlay: (sceneId: string, overlayId: string) => void

  // SVG Object actions
  addSvgObject: (sceneId: string) => void
  updateSvgObject: (sceneId: string, objectId: string, updates: Partial<SvgObject>) => void
  removeSvgObject: (sceneId: string, objectId: string) => void
  generateSvgObject: (
    sceneId: string,
    objectId: string,
    prompt: string,
    onToken?: (svg: string) => void,
  ) => Promise<void>

  // Branch navigation
  switchBranch: (sceneId: string, branchId: string) => void

  // Generation
  generateSVG: (sceneId: string, onToken?: (svg: string) => void) => Promise<void>
  generateCanvas: (sceneId: string, onToken?: (code: string) => void) => Promise<void>
  generateMotion: (sceneId: string) => Promise<void>
  generateD3: (sceneId: string) => Promise<void>
  generateThree: (sceneId: string) => Promise<void>
  generateLottie: (sceneId: string, onToken?: (svg: string) => void) => Promise<void>
  generateReact: (sceneId: string) => Promise<void>
  editSVG: (sceneId: string, instruction: string, onToken?: (svg: string) => void) => Promise<void>
  enhancePrompt: (sceneId: string) => Promise<void>
  saveSceneHTML: (sceneId: string, quiet?: boolean) => Promise<void>

  // Export
  openExportModal: () => void
  closeExportModal: () => void
  exportVideo: (settings: ExportSettings) => Promise<void>
  setExportProgress: (progress: ExportProgress | null) => void

  // Thumbnail
  captureSceneThumbnail: (sceneId: string, dataUrl: string) => void

  // Agent visual feedback — capture a frame from the preview iframe
  registerFrameCapturer: (capturer: ((sceneId: string, time: number) => Promise<string | null>) | null) => void
  captureSceneFrame: (sceneId: string, time: number) => Promise<string | null>

  // AI Layer actions
  addAILayer: (sceneId: string, layer: AILayer) => void
  updateAILayer: (sceneId: string, layerId: string, updates: Partial<AILayer>) => void
  removeAILayer: (sceneId: string, layerId: string) => void

  // Permission actions
  updateAPIPermissions: (updates: Partial<APIPermissions>) => void
  pendingPermissionRequest: PermissionRequest | null
  setPendingPermissionRequest: (req: PermissionRequest | null) => void
  sessionPermissions: Map<string, string>
  setSessionPermission: (api: string, decision: string) => void
  /** Layered permission rules (user/workspace/project/session) — DB-backed
   *  source of truth for allow/deny evaluation. `sessionPermissions` above is
   *  kept as a compat read-through for callers that still consult the Map. */
  permissionRules: import('../types/permissions').PermissionRule[]
  /** Fetch rules from /api/permissions/rules into the store. Call on login,
   *  project switch, and after the dialog writes a new rule. */
  refreshPermissionRules: () => Promise<void>
  /** Persist a new rule via the API and splice it into the store. Used by
   *  the permission dialog (Session/Always) and Settings → Permissions. */
  createPermissionRule: (
    input: Omit<import('../types/permissions').PermissionRule, 'id' | 'userId' | 'createdAt'>,
  ) => Promise<import('../types/permissions').PermissionRule | null>
  /** Delete a rule by id through the API. */
  deletePermissionRule: (id: string) => Promise<boolean>

  // Generation overrides — set from the universal confirmation card
  generationOverrides: Record<string, { provider?: string; prompt?: string; config?: Record<string, any> }>
  setGenerationOverride: (
    api: string,
    overrides: { provider?: string; prompt?: string; config?: Record<string, any> },
  ) => void
  clearGenerationOverride: (api: string) => void
  autoChooseDefaults: Record<string, { provider: string; config: Record<string, any> }>
  setAutoChooseDefault: (genType: string, defaults: { provider: string; config: Record<string, any> }) => void

  // Media generation
  generateAIImage: (
    sceneId: string,
    opts: {
      prompt: string
      model?: string
      style?: string | null
      aspectRatio?: string
      removeBackground?: boolean
      x?: number
      y?: number
      width?: number
      height?: number
      label?: string
    },
  ) => Promise<void>
  pollAvatarStatus: (sceneId: string, layerId: string, videoId: string) => void
  pollVeo3Status: (sceneId: string, layerId: string, operationName: string, projectId?: string, prompt?: string) => void

  // Audio
  audioSettings: AudioSettings
  updateAudioSettings: (updates: Partial<AudioSettings>) => void
  audioProviderEnabled: Record<string, boolean>
  toggleAudioProvider: (id: string) => void

  // Media Gen
  mediaGenEnabled: Record<string, boolean>
  toggleMediaGen: (id: string) => void

  // Research (web search + URL reader)
  /** Master switch — when on, agent gets web_search / fetch_url_content tools. Model-agnostic. */
  researchEnabled: boolean
  setResearchEnabled: (enabled: boolean) => void
  /** Per-provider enabled map for research providers (brave, tavily, exa). */
  researchProviderEnabled: Record<string, boolean>
  toggleResearchProvider: (id: string) => void
  /** Per-project consent for yt-dlp downloads. Persisted to localStorage so the one-time
   *  legal disclaimer modal doesn't keep reappearing. */
  ytDlpConsentedProjectIds: string[]
  grantYtDlpConsent: (projectId: string) => void
  revokeYtDlpConsent: (projectId: string) => void
  generateNarration: (
    sceneId: string,
    text: string,
    provider?: string,
    voiceId?: string,
    instructions?: string,
  ) => Promise<void>
  addSFXToScene: (sceneId: string, sfx: SFXTrack) => void
  removeSFXFromScene: (sceneId: string, sfxId: string) => void
  setSceneMusic: (sceneId: string, music: MusicTrack | null) => void

  // Workspace management
  workspaces: import('../types').WorkspaceListItem[]
  activeWorkspaceId: string | null
  isLoadingWorkspaces: boolean
  fetchWorkspaces: () => Promise<void>
  createWorkspace: (name: string, opts?: { color?: string; icon?: string }) => Promise<string>
  updateWorkspace: (id: string, updates: Partial<import('../types').Workspace>) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  setActiveWorkspace: (id: string | null) => void
  moveProjectToWorkspace: (projectId: string, workspaceId: string | null) => Promise<void>

  // Project management
  projectList: {
    id: string
    name: string
    updatedAt: string
    thumbnailUrl?: string
    outputMode?: string
    createdAt?: string
    workspaceId?: string | null
  }[]
  isLoadingProjects: boolean
  fetchProjectList: () => Promise<void>
  createNewProject: (name?: string, aspectRatio?: import('../dimensions').AspectRatio) => Promise<void>
  /** Reload project row + scenes from API (e.g. after agent run when SSE may have dropped). */
  refreshProjectFromServer: () => Promise<void>
  loadProject: (projectId: string) => Promise<void>
  saveProjectToDb: () => Promise<void>
  deleteProjectFromDb: (projectId: string) => Promise<void>
  _dbLoadComplete: boolean
  _setDbLoadComplete: (v: boolean) => void
  _isDirty: boolean
  _lastDbLoadTimestamp: number

  // Font favorites (user preference, persisted to localStorage)
  favoriteFonts: string[]
  toggleFavoriteFont: (family: string) => void

  // Dev
  seedTestScenes: () => Promise<void>
  seedReactShowcaseScenes: () => Promise<void>
  seedCapabilityShowcaseScenes: () => Promise<void>
  seedThreeEnvironmentShowcaseScenes: () => Promise<void>
  seedInteractiveTestScenes: () => Promise<void>
  seedInteractiveStyleShowcaseScenes: () => Promise<void>
  seedInteractiveProfessionalTourScenes: () => Promise<void>
  seedProfessionalTooltipTestScenes: () => Promise<void>
  seedWorldTestScenes: () => Promise<void>
  seedMedicalTestScenes: () => Promise<void>
  seedTextEditingHarnessScenes: () => Promise<void>
  seedAvatarShowcaseScenes: () => Promise<void>
  seedTalkingHeadLipSyncTestScene: () => Promise<void>

  // ── Model configuration ────────────────────────────────────────────────────
  modelConfigs: ModelConfig[]
  providerConfigs: ProviderConfig[]
  setModelConfigs: (configs: ModelConfig[]) => void
  toggleModelEnabled: (modelId: string) => void
  updateProviderConfig: (provider: string, updates: Partial<ProviderConfig>) => void
  addCustomModel: (config: ModelConfig) => void
  removeCustomModel: (modelId: string) => void

  // ── Agent configuration ────────────────────────────────────────────────────
  agentConfigs: AgentConfig[]
  setAgentConfigs: (configs: AgentConfig[]) => void
  toggleAgentEnabled: (agentId: string) => void
  updateAgentPrompt: (agentId: string, prompt: string) => void
  addCustomAgent: (config: AgentConfig) => void
  removeCustomAgent: (agentId: string) => void

  // Agents
  editingAgentId: string | null
  setEditingAgentId: (id: string | null) => void
  isCreatingAgent: boolean
  setIsCreatingAgent: (active: boolean) => void

  // ── Inspector ──────────────────────────────────────────────────────────────
  inspectorSelectedElement: import('../types/elements').SceneElement | null
  inspectorSelectedLayerId: string | null
  inspectorElements: Record<string, import('../types/elements').SceneElement>
  inspectorPendingChanges: Record<string, Record<string, unknown>>
  selectInspectorElement: (element: import('../types/elements').SceneElement | null, layerId?: string | null) => void
  selectInspectorLayer: (layerId: string | null) => void
  setInspectorElements: (elements: Record<string, import('../types/elements').SceneElement>) => void
  patchInspectorElement: (elementId: string, property: string, value: unknown) => void
  clearInspector: () => void
  applyInspectorChanges: (sceneId: string) => Promise<void>
  agentEditContext: {
    type: 'element' | 'layer'
    elementId?: string
    elementType?: string
    layerId?: string
    sceneId?: string
    prompt?: string
    code?: string | null
    elementDefinition?: unknown
  } | null
  openAgentWithContext: (context: NonNullable<VideoStore['agentEditContext']>) => void
}

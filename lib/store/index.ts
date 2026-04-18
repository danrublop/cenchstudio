'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_AUDIO_SETTINGS } from '../types'
import { DEFAULT_AUDIO_PROVIDER_ENABLED } from '../audio/provider-registry'
import { DEFAULT_MEDIA_PROVIDER_ENABLED } from '../media/provider-registry'
import { DEFAULT_RESEARCH_PROVIDER_ENABLED } from '../research/provider-registry'
import { DEFAULT_GRID_CONFIG } from '../grid'
import type { ModelTier, ThinkingMode } from '../agents/types'
import { DEFAULT_MODELS, DEFAULT_PROVIDER_CONFIGS } from '../agents/model-config'
import { DEFAULT_AGENTS } from '../agents/agent-config'
import { createDefaultAPIPermissions } from '../permissions'
import type { LayersTabSectionId } from '../layers-tab-header'

import type { VideoStore, CenterTabId } from './types'
import type { LayersStripTabId } from '../layers-strip-dock'
import {
  createDefaultProject,
  createDefaultScene,
  DEFAULT_GLOBAL_STYLE,
  sceneHasRenderableContent,
  setPersistedTheme,
} from './helpers'

import { createUndoActions, restoreUndoStacks } from './undo-actions'
import { createSceneActions } from './scene-actions'
import { createGenerationActions } from './generation-actions'
import { createProjectActions } from './project-actions'
import { createAgentActions } from './agent-actions'
import { createTimelineActions } from './timeline-actions'
import { createAudioActions } from './audio-actions'
import { createExportActions } from './export-actions'
import { createInspectorActions } from './inspector-actions'
import { createWorkspaceActions } from './workspace-actions'
import { createDevActions } from './dev-actions'

export type { VideoStore, CenterTabId } from './types'
export type { UndoableState, Set, Get } from './types'

export const useVideoStore = create<VideoStore>()(
  persist(
    (set, get) => ({
      scenes: (() => {
        const s = createDefaultScene()
        s.name = 'Scene 1'
        return [s]
      })(),
      selectedSceneId: null,
      globalStyle: DEFAULT_GLOBAL_STYLE,
      _dbLoadComplete: false,
      _setDbLoadComplete: (v: boolean) => set({ _dbLoadComplete: v }),
      _isDirty: false,
      _lastDbLoadTimestamp: 0,

      // Auth
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),

      // Undo/Redo (restored from sessionStorage if available)
      _undoStack: typeof sessionStorage !== 'undefined' ? restoreUndoStacks().undoStack : [],
      _redoStack: typeof sessionStorage !== 'undefined' ? restoreUndoStacks().redoStack : [],

      // Agent abort + multi-tab
      _abortNonce: 0,
      abortAgentRun: () => set({ _abortNonce: get()._abortNonce + 1 }),
      isAgentRunningRemote: false,

      ...createUndoActions(set, get),

      isGenerating: false,
      generatingSceneId: null,
      lastGenerationError: null,
      isExporting: false,
      isExportModalOpen: false,
      exportProgress: null,

      // Recording
      recordingState: 'idle' as const,
      recordingConfig: {
        micEnabled: true,
        micDeviceId: null,
        systemAudioEnabled: true,
        webcamEnabled: false,
        webcamDeviceId: null,
        fps: 30,
        resolution: '1080p' as const,
      },
      recordingCommand: null,
      recordingCommandNonce: 0,
      recordingResult: null,
      recordingError: null,
      recordingElapsed: 0,
      recordingAttachSceneId: null,
      setRecordingCommand: (cmd) =>
        set((s) => ({
          recordingCommand: cmd,
          // Only increment nonce for real commands, not for null (consuming)
          recordingCommandNonce: cmd ? s.recordingCommandNonce + 1 : s.recordingCommandNonce,
        })),
      setRecordingConfig: (config) => set((s) => ({ recordingConfig: { ...s.recordingConfig, ...config } })),
      setRecordingState: (state) => set({ recordingState: state }),
      setRecordingResult: (result) => set({ recordingResult: result }),
      setRecordingError: (error) => set({ recordingError: error }),
      setRecordingElapsed: (ms) => set({ recordingElapsed: ms }),
      setRecordingAttachSceneId: (sceneId) => set({ recordingAttachSceneId: sceneId }),
      timelineHeight: 200,
      graphExpandedScenes: [] as string[],
      timelineView: 'track' as 'track' | 'graph',
      timelineTransport: { globalTime: 0, totalDuration: 30, isPlaying: false },
      isPreviewFullscreen: false,
      compositorPreview: false,
      setCompositorPreview: (active) => set({ compositorPreview: active }),
      zdogStudioMode: false,
      setZdogStudioMode: (active) => set({ zdogStudioMode: active }),
      studioRecordMode: false,
      setStudioRecordMode: (active) => set({ studioRecordMode: active }),
      studioRecordStream: null,
      setStudioRecordStream: (stream) => set({ studioRecordStream: stream }),
      previewZoom: 1,
      setPreviewZoom: (z) => set({ previewZoom: z }),
      timelineZoom: 0,
      timelineScrollX: 0,
      timelineAutoScroll: true,
      selectedClipIds: [],
      sceneHtmlVersion: 0,
      sceneWriteErrors: {},
      projectLoadFailed: false,
      gridConfig: DEFAULT_GRID_CONFIG,
      project: createDefaultProject(),
      isPublishing: false,
      publishError: null,
      publishedUrl: null,
      showPublishPanel: false,
      showTemplatePicker: false,
      setShowTemplatePicker: (show) => set({ showTemplatePicker: show }),

      // Audio
      audioSettings: DEFAULT_AUDIO_SETTINGS,
      audioProviderEnabled: { ...DEFAULT_AUDIO_PROVIDER_ENABLED },
      mediaGenEnabled: { ...DEFAULT_MEDIA_PROVIDER_ENABLED },

      // Research — master switch defaults OFF so agent doesn't browse without user opt-in.
      researchEnabled: false,
      researchProviderEnabled: { ...DEFAULT_RESEARCH_PROVIDER_ENABLED },

      // yt-dlp consent — populated as the user acknowledges the legal disclaimer per project.
      ytDlpConsentedProjectIds: [],

      // Conversation initial state
      conversations: [],
      activeConversationId: null,
      conversationsLoading: false,

      // Chat / Agent initial state
      chatMessages: [],
      _persistedMessageIds: new Set<string>(),
      isChatOpen: false,
      isAgentRunning: false,
      _agentRunStartedAt: 0,
      agentType: null,
      agentModelId: null,
      agentOverride: null,
      directorTemplate: null,
      pendingStoryboard: null,
      storyboardProposed: null,
      pausedAgentRun: null,
      runCheckpoint: null,
      planFirstMode: false,
      modelOverride: null,
      modelTier: 'auto' as ModelTier,
      thinkingMode: 'adaptive' as ThinkingMode,
      localMode: false,
      mockMode: false,
      localModelId: null,
      sceneContext: 'auto',
      activeTools: ['react', 'svg', 'canvas2d', 'd3', 'three', 'lottie', 'zdog', 'assets', 'audio', 'video'],
      chatInputValue: '',
      settingsTab: null,
      setSettingsTab: (tab) => set({ settingsTab: tab }),
      centerOpenTabs: ['preview'] as CenterTabId[],
      centerTab: 'preview' as CenterTabId | null,
      setCenterTab: (tab) => {
        if (tab === null) {
          set({ centerTab: null, centerOpenTabs: [] })
          return
        }
        set((s) => ({
          centerOpenTabs: s.centerOpenTabs.includes(tab) ? s.centerOpenTabs : [...s.centerOpenTabs, tab],
          centerTab: tab,
        }))
      },
      closeCenterTab: (tab) =>
        set((s) => {
          const prevOpen = s.centerOpenTabs
          const open = prevOpen.filter((t) => t !== tab)
          if (open.length === 0) {
            return { centerOpenTabs: [], centerTab: null }
          }
          let nextActive: CenterTabId | null = s.centerTab
          if (s.centerTab === tab) {
            const idx = prevOpen.indexOf(tab)
            const neighbor = prevOpen[idx - 1] ?? prevOpen[idx + 1]
            nextActive = neighbor && open.includes(neighbor) ? neighbor : (open[open.length - 1] ?? open[0] ?? null)
          }
          if (nextActive == null || !open.includes(nextActive)) {
            nextActive = open[open.length - 1] ?? open[0] ?? null
          }
          return { centerOpenTabs: open, centerTab: nextActive }
        }),
      layersStripDragTabId: null as LayersStripTabId | null,
      setLayersStripDragTabId: (id) => set({ layersStripDragTabId: id }),
      rightPanelTab: 'prompt' as const,
      setRightPanelTab: (tab: 'prompt' | 'layers' | 'media' | null) => set({ rightPanelTab: tab }),
      textEditorSlotKey: null as string | null,
      setTextEditorSlotKey: (key) => set({ textEditorSlotKey: key }),
      layersTabSectionPending: null as LayersTabSectionId | null,
      layersTabAvatarLayerIdPending: null as string | null,
      clearLayersTabSectionPending: () => set({ layersTabSectionPending: null, layersTabAvatarLayerIdPending: null }),
      openTextTabForSlot: (slotKey) =>
        set({
          rightPanelTab: 'layers',
          layersTabSectionPending: 'text',
          textEditorSlotKey: slotKey,
          layersTabAvatarLayerIdPending: null,
        }),

      openLayersSection: (section, opts) =>
        set({
          rightPanelTab: 'layers',
          layersTabSectionPending: section,
          layersTabAvatarLayerIdPending: section === 'avatar' ? (opts?.avatarLayerId ?? null) : null,
        }),

      layerStackPropertiesKey: null as string | null,
      setLayerStackPropertiesKey: (key) => set({ layerStackPropertiesKey: key }),
      openLayerStackProperties: (stackKey) =>
        set({
          rightPanelTab: 'layers',
          layersTabSectionPending: 'properties',
          layerStackPropertiesKey: stackKey,
          layersTabAvatarLayerIdPending: null,
        }),

      // Media library
      projectAssets: [],
      assetsLoading: false,
      loadProjectAssets: async (projectId: string) => {
        set({ assetsLoading: true })
        try {
          const ipc = typeof window !== 'undefined' ? window.cenchApi?.projects : undefined
          const data = ipc
            ? await ipc.listAssets({ projectId })
            : await fetch(`/api/projects/${projectId}/assets`).then((r) => (r.ok ? r.json() : null))
          if (data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            set({ projectAssets: ((data as { assets?: unknown[] }).assets ?? []) as any })
          }
        } catch (e) {
          console.error('[loadProjectAssets]', e)
        } finally {
          set({ assetsLoading: false })
        }
      },
      addProjectAsset: (asset) => set((s) => ({ projectAssets: [asset, ...s.projectAssets] })),
      updateProjectAsset: (assetId, updates) =>
        set((s) => ({
          projectAssets: s.projectAssets.map((a) => (a.id === assetId ? { ...a, ...updates } : a)),
        })),
      removeProjectAsset: (assetId) =>
        set((s) => ({
          projectAssets: s.projectAssets.filter((a) => a.id !== assetId),
        })),
      setWatermark: (watermark) => {
        set((s) => ({
          project: { ...s.project, watermark },
        }))
        // Regenerate all scene HTML to include/remove watermark
        const { scenes } = get()
        scenes.forEach((s) => get().saveSceneHTML(s.id, true))
      },

      // Brand Kit
      brandKit: null,
      updateBrandKit: async (updates) => {
        const { project, brandKit: current } = get()
        const merged = {
          ...(current ?? {
            brandName: null,
            logoAssetIds: [],
            palette: [],
            fontPrimary: null,
            fontSecondary: null,
            guidelines: null,
          }),
          ...updates,
        }
        set({ brandKit: merged })
        set((s) => ({ project: { ...s.project, brandKit: merged } }))
        try {
          const ipc = typeof window !== 'undefined' ? window.cenchApi?.projects : undefined
          if (ipc) {
            await ipc.updateBrandKit({ projectId: project.id, updates: updates as Record<string, unknown> })
          } else {
            await fetch(`/api/projects/${project.id}/brand-kit`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            })
          }
        } catch (e) {
          console.error('[store] updateBrandKit failed:', e)
        }
      },
      applyBrandToStyle: () => {
        const { brandKit, updateGlobalStyle } = get()
        if (!brandKit) return
        const updates: Record<string, unknown> = {}
        if (brandKit.palette.length >= 4) {
          updates.paletteOverride = brandKit.palette.slice(0, 4) as [string, string, string, string]
        }
        if (brandKit.fontPrimary) {
          updates.fontOverride = brandKit.fontPrimary
        }
        updateGlobalStyle(updates as any)
      },

      // Agent editing state
      editingAgentId: null,
      setEditingAgentId: (id) => set({ editingAgentId: id }),
      isCreatingAgent: false,
      setIsCreatingAgent: (active) => set({ isCreatingAgent: active }),

      // ── Inspector ──────────────────────────────────────────────────────────
      inspectorSelectedElement: null,
      inspectorSelectedLayerId: null,
      inspectorElements: {},
      inspectorPendingChanges: {},
      agentEditContext: null,

      ...createInspectorActions(set, get),

      // Workspace management
      workspaces: [],
      activeWorkspaceId: null,
      isLoadingWorkspaces: false,
      ...createWorkspaceActions(set, get),

      // Project management
      projectList: [],
      isLoadingProjects: false,

      // ── Model configuration ────────────────────────────────────────────────
      modelConfigs: DEFAULT_MODELS,
      providerConfigs: DEFAULT_PROVIDER_CONFIGS,

      // ── Agent configuration ────────────────────────────────────────────────
      agentConfigs: DEFAULT_AGENTS,

      setTimelineHeight: (height: number) => set({ timelineHeight: height }),
      toggleGraphSceneExpanded: (sceneId: string) =>
        set((state) => ({
          graphExpandedScenes: state.graphExpandedScenes.includes(sceneId)
            ? state.graphExpandedScenes.filter((id) => id !== sceneId)
            : [...state.graphExpandedScenes, sceneId],
        })),
      setTimelineView: (view: 'track' | 'graph') => set({ timelineView: view }),
      setTimelineTransport: (transport) =>
        set((state) => ({
          timelineTransport: { ...state.timelineTransport, ...transport },
        })),
      setPreviewFullscreen: (full: boolean) => set({ isPreviewFullscreen: full }),
      setTimelineZoom: (zoom: number) => set({ timelineZoom: zoom }),
      setTimelineScrollX: (x: number) => set({ timelineScrollX: x }),
      setTimelineAutoScroll: (v: boolean) => set({ timelineAutoScroll: v }),

      setSelectedClipIds: (ids: string[]) => set({ selectedClipIds: ids }),
      toggleClipSelection: (clipId: string, multi?: boolean) => {
        set((s) => {
          if (multi) {
            const idx = s.selectedClipIds.indexOf(clipId)
            if (idx >= 0) return { selectedClipIds: s.selectedClipIds.filter((id) => id !== clipId) }
            return { selectedClipIds: [...s.selectedClipIds, clipId] }
          }
          return { selectedClipIds: [clipId] }
        })
      },

      updateGlobalStyle: (updates) => {
        get()._pushUndoDebounced()
        if (updates.theme) setPersistedTheme(updates.theme)
        set((state) => {
          const merged = { ...state.globalStyle, ...updates }
          const typ = merged.uiTypography ?? 'app'
          if (typ !== 'custom') {
            merged.uiFontFamily = null
          } else if (!merged.uiFontFamily) {
            merged.uiFontFamily = 'Inter'
          }
          return { globalStyle: merged, _isDirty: true }
        })
      },

      updateGridConfig: (updates) => {
        set((state) => ({
          gridConfig: { ...state.gridConfig, ...updates },
        }))
      },

      // ── Permission state ────────────────────────────────────────────────────
      pendingPermissionRequest: null,
      sessionPermissions: new Map<string, string>(),
      permissionRules: [],
      generationOverrides: {},
      autoChooseDefaults: {},

      // ── Font favorites ──────────────────────────────────────────────────────
      favoriteFonts: [],
      toggleFavoriteFont: (family) => {
        set((state) => ({
          favoriteFonts: state.favoriteFonts.includes(family)
            ? state.favoriteFonts.filter((f) => f !== family)
            : [...state.favoriteFonts, family],
        }))
      },

      // Spread in actions from each domain
      ...createSceneActions(set, get),
      ...createGenerationActions(set, get),
      ...createProjectActions(set, get),
      ...createAgentActions(set, get),
      ...createTimelineActions(set, get),
      ...createAudioActions(set, get),
      ...createExportActions(set, get),
      ...createDevActions(set, get),
    }),
    {
      name: 'cench-studio-storage',
      version: 15,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          persistedState.scenes = (persistedState.scenes ?? []).map((s: any) => ({
            ...s,
            sceneType: s.sceneType ?? 'svg',
            canvasCode: s.canvasCode ?? '',
          }))
        }
        if (version < 3) {
          persistedState.scenes = (persistedState.scenes ?? []).map((s: any) => ({
            ...s,
            sceneCode: s.sceneCode ?? '',
            sceneHTML: s.sceneHTML ?? '',
            sceneStyles: s.sceneStyles ?? '',
            lottieSource: s.lottieSource ?? '',
            d3Data: s.d3Data ?? null,
          }))
        }
        if (version < 4) {
          // Add interactions/variables to scenes
          persistedState.scenes = (persistedState.scenes ?? []).map((s: any) => ({
            ...s,
            interactions: s.interactions ?? [],
            variables: s.variables ?? [],
          }))
          // Create project wrapper if missing
          if (!persistedState.project) {
            persistedState.project = createDefaultProject(persistedState.scenes ?? [])
          }
        }
        if (version < 5) {
          // Add aiLayers to scenes
          persistedState.scenes = (persistedState.scenes ?? []).map((s: any) => ({
            ...s,
            aiLayers: s.aiLayers ?? [],
          }))
          // Add apiPermissions to project
          if (persistedState.project && !persistedState.project.apiPermissions) {
            persistedState.project.apiPermissions = createDefaultAPIPermissions()
          }
        }
        if (version < 6) {
          // Seed model/agent configs with defaults if absent
          if (!persistedState.modelConfigs) {
            persistedState.modelConfigs = DEFAULT_MODELS
          }
          if (!persistedState.providerConfigs) {
            persistedState.providerConfigs = DEFAULT_PROVIDER_CONFIGS
          }
          if (!persistedState.agentConfigs) {
            persistedState.agentConfigs = DEFAULT_AGENTS
          }
        }
        if (version < 8) {
          // Reset modelConfigs to current DEFAULT_MODELS (removes stale 2.5 models, adds 3/3.1)
          // The settings panel useEffect preserves user's enabled/disabled prefs
          persistedState.modelConfigs = DEFAULT_MODELS
        }
        if (version < 9) {
          // Add chatMessages to persisted state
          if (!persistedState.chatMessages) {
            persistedState.chatMessages = []
          }
        }
        if (version < 10) {
          // Migrate old 4-tier system to new 3-tier system (auto/premium/budget)
          const oldTier = persistedState.modelTier
          if (oldTier === 'fast') persistedState.modelTier = 'budget'
          else if (oldTier === 'balanced') persistedState.modelTier = 'auto'
          else if (oldTier === 'performance') persistedState.modelTier = 'premium'
          // Reset modelConfigs to pick up new models (Sonnet 3.5, GPT-4.1 family, Gemini 2.5)
          persistedState.modelConfigs = DEFAULT_MODELS
        }
        if (version < 11) {
          if (!persistedState.favoriteFonts) {
            persistedState.favoriteFonts = []
          }
        }
        // v12: presetId is now nullable (null = no preset, full style autonomy)
        // No data migration needed — existing projects keep their preset.
        if (version < 13) {
          persistedState.scenes = (persistedState.scenes ?? []).map((s: any) => ({
            ...s,
            canvasBackgroundCode: s.canvasBackgroundCode ?? '',
          }))
        }
        if (version < 14) {
          const gs = persistedState.globalStyle
          if (gs && gs.uiTypography == null) {
            persistedState.globalStyle = { ...gs, uiTypography: 'app' }
          }
        }
        if (version < 15) {
          const gs = persistedState.globalStyle
          if (gs && gs.uiFontFamily === undefined) {
            persistedState.globalStyle = { ...gs, uiFontFamily: null }
          }
        }
        return persistedState
      },
      // If async rehydration runs after loadProject() filled scenes from Postgres, do not let
      // stripped localStorage scenes (no code/HTML) overwrite rich in-memory state.
      merge: (persisted, current) => {
        const p = persisted as any
        const base = { ...current, ...p }
        const pcs = p?.scenes
        const ccs = (current as any)?.scenes

        // If DB loaded recently, never let localStorage overwrite it
        const dbLoadedRecently = ((current as any)?._lastDbLoadTimestamp ?? 0) > Date.now() - 5000

        if (Array.isArray(pcs) && Array.isArray(ccs)) {
          if (dbLoadedRecently || (ccs.some(sceneHasRenderableContent) && !pcs.some(sceneHasRenderableContent))) {
            base.scenes = ccs
          } else {
            // Check project match — if current scenes are from a different project, prefer current
            const sameProject =
              pcs.length > 0 && ccs.length > 0 && ccs.every((s: any) => pcs.some((ps: any) => ps.id === s.id))
            if (!sameProject && ccs.some(sceneHasRenderableContent)) {
              base.scenes = ccs
            }
          }
        }
        // Never let persisted localStorage timeline overwrite a freshly synced one
        if (dbLoadedRecently && (current as any)?.project?.timeline) {
          base.project = { ...base.project, timeline: (current as any).project.timeline }
        }
        // Never let persist rehydration clobber loaded chat messages.
        // chatMessages is not in partialize so p won't have it, but the spread
        // { ...current, ...p } can still lose it if p has undefined fields.
        const cur = current as any
        if (cur?.chatMessages?.length > 0) {
          base.chatMessages = cur.chatMessages
          base.activeConversationId = cur.activeConversationId
          base.conversations = cur.conversations
          base._persistedMessageIds = cur._persistedMessageIds
        }
        return base
      },
      partialize: (state) => ({
        // Strip large generated code fields from persisted scenes to prevent
        // localStorage overflow. Full scene data is reloaded from DB via loadProject().
        scenes: state.scenes.map((s) => ({
          ...s,
          svgContent: '',
          canvasCode: '',
          canvasBackgroundCode: '',
          sceneCode: '',
          reactCode: '',
          sceneHTML: '',
          sceneStyles: '',
          lottieSource: '',
        })),
        selectedSceneId: state.selectedSceneId,
        globalStyle: state.globalStyle,
        project: { ...state.project, timeline: undefined },
        publishedUrl: state.publishedUrl,
        showPublishPanel: state.showPublishPanel,
        modelConfigs: state.modelConfigs,
        providerConfigs: state.providerConfigs,
        agentConfigs: state.agentConfigs,
        audioProviderEnabled: state.audioProviderEnabled,
        mediaGenEnabled: state.mediaGenEnabled,
        researchEnabled: state.researchEnabled,
        researchProviderEnabled: state.researchProviderEnabled,
        ytDlpConsentedProjectIds: state.ytDlpConsentedProjectIds,
        favoriteFonts: state.favoriteFonts,
      }),
    },
  ),
)

// Expose store for headless/API export access
if (typeof window !== 'undefined') {
  ;(window as any).__cenchStore = useVideoStore
}

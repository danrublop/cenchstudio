'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type {
  Scene, SceneUsage, GlobalStyle, ExportProgress, ExportSettings,
  TextOverlay, SvgObject, SvgBranch, SceneType,
  Project, SceneGraph, SceneNode, SceneEdge,
  InteractionElement, SceneVariable,
  AILayer, APIPermissions, PermissionRequest, PermissionResponse, APIName,
} from './types'
import type { ChatMessage, AgentType, ModelId, ModelTier } from './agents/types'
import type { ModelConfig, ProviderConfig } from './agents/model-config'
import type { AgentConfig } from './agents/agent-config'
import { DEFAULT_MODELS, DEFAULT_PROVIDER_CONFIGS } from './agents/model-config'
import { DEFAULT_AGENTS } from './agents/agent-config'
import { createDefaultAPIPermissions } from './permissions'
import { generateSceneHTML } from './sceneTemplate'
import { createTestScenes, createInteractiveTestScenes } from './testScenes'

const DEFAULT_GLOBAL_STYLE: GlobalStyle = {
  palette: ['#181818', '#121212', '#e84545', '#151515', '#f0ece0'],
  strokeWidth: 2,
  font: 'Caveat',
  duration: 8,
  theme: 'dark',
}

function createDefaultProject(scenes: Scene[] = []): Project {
  const now = new Date().toISOString()
  const startSceneId = scenes[0]?.id ?? ''
  return {
    id: uuidv4(),
    name: 'Untitled Project',
    outputMode: 'mp4',
    createdAt: now,
    updatedAt: now,
    mp4Settings: { resolution: '1080p', fps: 30, format: 'mp4' },
    interactiveSettings: {
      playerTheme: 'dark',
      showProgressBar: true,
      showSceneNav: true,
      allowFullscreen: true,
      brandColor: '#e84545',
      customDomain: null,
      password: null,
    },
    sceneGraph: {
      nodes: scenes.map((s, i) => ({ id: s.id, position: { x: i * 220, y: 100 } })),
      edges: scenes.slice(0, -1).map((s, i) => ({
        id: uuidv4(),
        fromSceneId: s.id,
        toSceneId: scenes[i + 1].id,
        condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
      })),
      startSceneId,
    },
    apiPermissions: createDefaultAPIPermissions(),
  }
}

function createDefaultScene(prompt = ''): Scene {
  return {
    id: uuidv4(),
    name: '',
    prompt,
    summary: '',
    svgContent: '',
    duration: 8,
    bgColor: '#ffffff',
    thumbnail: null,
    videoLayer: {
      enabled: false,
      src: null,
      opacity: 1,
      trimStart: 0,
      trimEnd: null,
    },
    audioLayer: {
      enabled: false,
      src: null,
      volume: 1,
      fadeIn: false,
      fadeOut: false,
      startOffset: 0,
    },
    textOverlays: [],
    svgObjects: [],
    primaryObjectId: null,
    svgBranches: [],
    activeBranchId: null,
    transition: 'none',
    usage: null,
    sceneType: 'svg',
    canvasCode: '',
    sceneCode: '',
    sceneHTML: '',
    sceneStyles: '',
    lottieSource: '',
    d3Data: null,
    interactions: [],
    variables: [],
    aiLayers: [],
    messages: [],
  }
}

interface VideoStore {
  scenes: Scene[]
  selectedSceneId: string | null
  globalStyle: GlobalStyle
  isGenerating: boolean
  generatingSceneId: string | null
  isExporting: boolean
  isExportModalOpen: boolean
  exportProgress: ExportProgress | null
  timelineHeight: number
  timelineZoom: number          // pixels per second (0 = fit-to-width)
  timelineScrollX: number
  timelineAutoScroll: boolean
  sceneHtmlVersion: number
  project: Project
  isPublishing: boolean
  publishedUrl: string | null
  showPublishPanel: boolean
  showModeModal: boolean
  pendingMode: 'mp4' | 'interactive' | null

  // Chat / Agent state
  chatMessages: ChatMessage[]
  isChatOpen: boolean
  isAgentRunning: boolean
  agentType: AgentType | null
  agentModelId: ModelId | null
  agentOverride: AgentType | null
  modelOverride: ModelId | null
  modelTier: ModelTier
  sceneContext: 'all' | 'selected' | 'auto' | string
  activeTools: string[]
  chatInputValue: string
  settingsTab: 'models' | 'agents' | 'general' | null
  setSettingsTab: (tab: 'models' | 'agents' | 'general' | null) => void
  rightPanelTab: 'prompt' | 'layers' | 'interact' | 'settings'
  setRightPanelTab: (tab: 'prompt' | 'layers' | 'interact' | 'settings') => void

  // Chat Actions
  setChatOpen: (open: boolean) => void
  addChatMessage: (msg: ChatMessage) => void
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void
  clearChat: () => void
  setAgentRunning: (running: boolean) => void
  setAgentType: (type: AgentType | null) => void
  setAgentModelId: (id: ModelId | null) => void
  setAgentOverride: (type: AgentType | null) => void
  setModelOverride: (id: ModelId | null) => void
  setModelTier: (tier: ModelTier) => void
  setSceneContext: (ctx: 'all' | 'selected' | 'auto' | string) => void
  setActiveTools: (tools: string[]) => void
  toggleActiveTool: (toolId: string) => void
  setChatInputValue: (v: string) => void
  // Sync scenes from agent tool execution
  syncScenesFromAgent: (updatedScenes: Scene[], updatedGlobalStyle: GlobalStyle) => void

  // Actions
  setTimelineHeight: (height: number) => void
  setTimelineZoom: (zoom: number) => void
  setTimelineScrollX: (x: number) => void
  setTimelineAutoScroll: (v: boolean) => void
  addScene: (prompt?: string) => string
  updateScene: (id: string, updates: Partial<Scene>) => void
  deleteScene: (id: string) => void
  duplicateScene: (id: string) => void
  reorderScenes: (fromIndex: number, toIndex: number) => void
  moveScene: (id: string, direction: 'up' | 'down') => void
  selectScene: (id: string) => void
  updateGlobalStyle: (updates: Partial<GlobalStyle>) => void

  // Project actions
  setOutputMode: (mode: 'mp4' | 'interactive') => void
  updateProject: (updates: Partial<Project>) => void
  updateSceneGraph: (graph: SceneGraph) => void
  publishProject: () => Promise<void>
  setShowPublishPanel: (show: boolean) => void
  setShowModeModal: (show: boolean) => void
  setPendingMode: (mode: 'mp4' | 'interactive' | null) => void

  // Interaction actions
  addInteraction: (sceneId: string, element: InteractionElement) => void
  updateInteraction: (sceneId: string, elementId: string, updates: Partial<InteractionElement>) => void
  removeInteraction: (sceneId: string, elementId: string) => void

  // Overlay actions
  addTextOverlay: (sceneId: string) => void
  updateTextOverlay: (sceneId: string, overlayId: string, updates: Partial<TextOverlay>) => void
  removeTextOverlay: (sceneId: string, overlayId: string) => void

  // SVG Object actions
  addSvgObject: (sceneId: string) => void
  updateSvgObject: (sceneId: string, objectId: string, updates: Partial<SvgObject>) => void
  removeSvgObject: (sceneId: string, objectId: string) => void
  generateSvgObject: (sceneId: string, objectId: string, prompt: string, onToken?: (svg: string) => void) => Promise<void>

  // Branch navigation
  switchBranch: (sceneId: string, branchId: string) => void

  // Generation
  generateSVG: (sceneId: string, onToken?: (svg: string) => void) => Promise<void>
  generateCanvas: (sceneId: string, onToken?: (code: string) => void) => Promise<void>
  generateMotion: (sceneId: string) => Promise<void>
  generateD3: (sceneId: string) => Promise<void>
  generateThree: (sceneId: string) => Promise<void>
  generateLottie: (sceneId: string, onToken?: (svg: string) => void) => Promise<void>
  editSVG: (sceneId: string, instruction: string, onToken?: (svg: string) => void) => Promise<void>
  enhancePrompt: (sceneId: string) => Promise<void>
  saveSceneHTML: (sceneId: string) => Promise<void>

  // Export
  openExportModal: () => void
  closeExportModal: () => void
  exportVideo: (settings: ExportSettings) => Promise<void>
  setExportProgress: (progress: ExportProgress | null) => void

  // Thumbnail
  captureSceneThumbnail: (sceneId: string, dataUrl: string) => void

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

  // Media generation
  generateAIImage: (sceneId: string, opts: {
    prompt: string; model?: string; style?: string | null;
    aspectRatio?: string; removeBackground?: boolean;
    x?: number; y?: number; width?: number; height?: number;
    label?: string;
  }) => Promise<void>
  pollAvatarStatus: (sceneId: string, layerId: string, videoId: string) => void
  pollVeo3Status: (sceneId: string, layerId: string, operationName: string) => void

  // Project management
  projectList: { id: string; name: string; updatedAt: string }[]
  isLoadingProjects: boolean
  fetchProjectList: () => Promise<void>
  createNewProject: (name?: string) => Promise<void>
  reloadCurrentProject: () => Promise<void>
  loadProject: (projectId: string) => Promise<void>
  saveProjectToDb: () => Promise<void>
  deleteProjectFromDb: (projectId: string) => Promise<void>

  // Dev
  seedTestScenes: () => Promise<void>
  seedInteractiveTestScenes: () => Promise<void>

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
}

export const useVideoStore = create<VideoStore>()(
  persist(
    (set, get) => ({
      scenes: (() => { const s = createDefaultScene(); s.name = 'Scene 1'; return [s] })(),
      selectedSceneId: null,
      globalStyle: DEFAULT_GLOBAL_STYLE,
      isGenerating: false,
      generatingSceneId: null,
      isExporting: false,
      isExportModalOpen: false,
      exportProgress: null,
      timelineHeight: 80,
      timelineZoom: 0,
      timelineScrollX: 0,
      timelineAutoScroll: true,
      sceneHtmlVersion: 0,
      project: createDefaultProject(),
      isPublishing: false,
      publishedUrl: null,
      showPublishPanel: false,
      showModeModal: false,
      pendingMode: null,

      // Chat / Agent initial state
      chatMessages: [],
      isChatOpen: false,
      isAgentRunning: false,
      agentType: null,
      agentModelId: null,
      agentOverride: null,
      modelOverride: null,
      modelTier: 'auto' as ModelTier,
      sceneContext: 'auto',
      activeTools: ['svg', 'canvas2d', 'd3', 'three', 'lottie', 'assets', 'audio', 'video', 'interactions'],
      chatInputValue: '',
      settingsTab: null,
      setSettingsTab: (tab) => set({ settingsTab: tab }),
      rightPanelTab: 'prompt' as const,
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

      // Agent editing state
      editingAgentId: null,
      setEditingAgentId: (id) => set({ editingAgentId: id }),
      isCreatingAgent: false,
      setIsCreatingAgent: (active) => set({ isCreatingAgent: active }),

      // Project management
      projectList: [],
      isLoadingProjects: false,

      // ── Model configuration ────────────────────────────────────────────────
      modelConfigs: DEFAULT_MODELS,
      providerConfigs: DEFAULT_PROVIDER_CONFIGS,

      setModelConfigs: (configs) => set({ modelConfigs: configs }),

      toggleModelEnabled: (modelId) => {
        set((state) => ({
          modelConfigs: state.modelConfigs.map((m) =>
            m.id === modelId ? { ...m, enabled: !m.enabled } : m
          ),
        }))
      },

      updateProviderConfig: (provider, updates) => {
        set((state) => ({
          providerConfigs: state.providerConfigs.map((p) =>
            p.provider === provider ? { ...p, ...updates } : p
          ),
        }))
      },

      addCustomModel: (config) => {
        set((state) => ({
          modelConfigs: [...state.modelConfigs, { ...config, isDefault: false }],
        }))
      },

      removeCustomModel: (modelId) => {
        set((state) => ({
          modelConfigs: state.modelConfigs.filter(
            (m) => m.id !== modelId || m.isDefault
          ),
        }))
      },

      // ── Agent configuration ────────────────────────────────────────────────
      agentConfigs: DEFAULT_AGENTS,

      setAgentConfigs: (configs) => set({ agentConfigs: configs }),

      toggleAgentEnabled: (agentId) => {
        set((state) => ({
          agentConfigs: state.agentConfigs.map((a) =>
            a.id === agentId ? { ...a, isEnabled: !a.isEnabled } : a
          ),
        }))
      },

      updateAgentPrompt: (agentId, prompt) => {
        set((state) => ({
          agentConfigs: state.agentConfigs.map((a) =>
            a.id === agentId ? { ...a, systemPrompt: prompt } : a
          ),
        }))
      },

      addCustomAgent: (config) => {
        set((state) => ({
          agentConfigs: [...state.agentConfigs, { ...config, isBuiltIn: false }],
        }))
      },

      removeCustomAgent: (agentId) => {
        set((state) => ({
          agentConfigs: state.agentConfigs.filter(
            (a) => a.id !== agentId || a.isBuiltIn
          ),
        }))
      },

      setTimelineHeight: (height: number) => set({ timelineHeight: height }),
      setTimelineZoom: (zoom: number) => set({ timelineZoom: zoom }),
      setTimelineScrollX: (x: number) => set({ timelineScrollX: x }),
      setTimelineAutoScroll: (v: boolean) => set({ timelineAutoScroll: v }),

      // ── Project actions ────────────────────────────────────────────────────

      setOutputMode: (mode) => {
        set((state) => ({
          project: { ...state.project, outputMode: mode, updatedAt: new Date().toISOString() },
        }))
      },

      updateProject: (updates) => {
        set((state) => ({
          project: { ...state.project, ...updates, updatedAt: new Date().toISOString() },
        }))
      },

      updateSceneGraph: (graph) => {
        set((state) => ({
          project: { ...state.project, sceneGraph: graph, updatedAt: new Date().toISOString() },
        }))
      },

      publishProject: async () => {
        const { project, scenes } = get()
        set({ isPublishing: true })
        try {
          const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: project.id, project, scenes }),
          })
          if (!res.ok) throw new Error('Publish failed')
          const data = await res.json()
          set({ publishedUrl: data.publishedUrl, showPublishPanel: true })
        } catch (err) {
          console.error('Publish error:', err)
        } finally {
          set({ isPublishing: false })
        }
      },

      setShowPublishPanel: (show) => set({ showPublishPanel: show }),
      setShowModeModal: (show) => set({ showModeModal: show }),
      setPendingMode: (mode) => set({ pendingMode: mode }),

      // ── Chat / Agent actions ───────────────────────────────────────────────

      setChatOpen: (open) => set({ isChatOpen: open }),

      addChatMessage: (msg) => {
        set((state) => ({ chatMessages: [...state.chatMessages, msg] }))
      },

      updateChatMessage: (id, updates) => {
        set((state) => ({
          chatMessages: state.chatMessages.map((m) => m.id === id ? { ...m, ...updates } : m),
        }))
      },

      clearChat: () => set({ chatMessages: [] }),

      setAgentRunning: (running) => set({ isAgentRunning: running }),
      setAgentType: (type) => set({ agentType: type }),
      setAgentModelId: (id) => set({ agentModelId: id }),
      setAgentOverride: (type) => set({ agentOverride: type }),
      setModelOverride: (id) => set({ modelOverride: id }),
      setModelTier: (tier) => set({ modelTier: tier }),
      setSceneContext: (ctx) => set({ sceneContext: ctx }),
      setActiveTools: (tools) => set({ activeTools: tools }),

      toggleActiveTool: (toolId) => {
        set((state) => {
          const current = state.activeTools
          const next = current.includes(toolId)
            ? current.filter((t) => t !== toolId)
            : [...current, toolId]
          return { activeTools: next }
        })
      },

      setChatInputValue: (v) => set({ chatInputValue: v }),

      syncScenesFromAgent: (updatedScenes, updatedGlobalStyle) => {
        set((state) => {
          // Bump sceneHtmlVersion so PreviewPlayer re-renders
          return {
            scenes: updatedScenes,
            globalStyle: updatedGlobalStyle,
            sceneHtmlVersion: state.sceneHtmlVersion + 1,
          }
        })
        // Persist all updated scene HTMLs
        for (const scene of updatedScenes) {
          if (scene.sceneHTML) {
            fetch('/api/scene', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: scene.id, html: scene.sceneHTML }),
            }).catch(() => {})
          }
        }
      },

      // ── Interaction actions ────────────────────────────────────────────────

      addInteraction: (sceneId, element) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          interactions: [...(scene.interactions ?? []), element],
        })
      },

      updateInteraction: (sceneId, elementId, updates) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          interactions: (scene.interactions ?? []).map((el) =>
            el.id === elementId ? ({ ...el, ...updates } as InteractionElement) : el
          ),
        })
      },

      removeInteraction: (sceneId, elementId) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          interactions: (scene.interactions ?? []).filter((el) => el.id !== elementId),
        })
      },

      addScene: (prompt = '') => {
        const { globalStyle, project } = get()
        const scene = createDefaultScene(prompt)
        scene.duration = globalStyle.duration

        set((state) => {
          const newScenes = [...state.scenes, scene]
          // Sync scene graph nodes
          const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
          const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
          if (!existingNodeIds.has(scene.id)) {
            newNodes.push({ id: scene.id, position: { x: newScenes.length * 220, y: 100 } })
          }
          return {
            scenes: newScenes,
            selectedSceneId: scene.id,
            project: {
              ...state.project,
              sceneGraph: { ...state.project.sceneGraph, nodes: newNodes },
            },
          }
        })
        return scene.id
      },

      updateScene: (id, updates) => {
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }))
      },

      deleteScene: (id) => {
        set((state) => {
          const newScenes = state.scenes.filter((s) => s.id !== id)
          const newSelectedId =
            state.selectedSceneId === id
              ? newScenes[0]?.id ?? null
              : state.selectedSceneId
          // Remove from scene graph
          const newGraph = {
            ...state.project.sceneGraph,
            nodes: state.project.sceneGraph.nodes.filter((n) => n.id !== id),
            edges: state.project.sceneGraph.edges.filter(
              (e) => e.fromSceneId !== id && e.toSceneId !== id
            ),
            startSceneId:
              state.project.sceneGraph.startSceneId === id
                ? (newScenes[0]?.id ?? '')
                : state.project.sceneGraph.startSceneId,
          }
          return {
            scenes: newScenes,
            selectedSceneId: newSelectedId,
            project: { ...state.project, sceneGraph: newGraph },
          }
        })
      },

      duplicateScene: (id) => {
        const scene = get().scenes.find((s) => s.id === id)
        if (!scene) return
        const newScene: Scene = {
          ...scene,
          id: uuidv4(),
          name: scene.name ? `${scene.name} (copy)` : '',
          thumbnail: null,
          interactions: scene.interactions.map((el) => ({ ...el, id: uuidv4() })),
        }
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === id)
          const scenes = [...state.scenes]
          scenes.splice(idx + 1, 0, newScene)
          const newNodes: SceneNode[] = [
            ...state.project.sceneGraph.nodes,
            { id: newScene.id, position: { x: (idx + 2) * 220, y: 100 } },
          ]
          return {
            scenes,
            selectedSceneId: newScene.id,
            project: { ...state.project, sceneGraph: { ...state.project.sceneGraph, nodes: newNodes } },
          }
        })
        get().saveSceneHTML(newScene.id)
      },

      reorderScenes: (fromIndex, toIndex) => {
        set((state) => {
          const scenes = [...state.scenes]
          const [removed] = scenes.splice(fromIndex, 1)
          scenes.splice(toIndex, 0, removed)
          return { scenes }
        })
      },

      moveScene: (id, direction) => {
        set((state) => {
          const scenes = [...state.scenes]
          const idx = scenes.findIndex((s) => s.id === id)
          if (direction === 'up' && idx > 0) {
            ;[scenes[idx - 1], scenes[idx]] = [scenes[idx], scenes[idx - 1]]
          } else if (direction === 'down' && idx < scenes.length - 1) {
            ;[scenes[idx], scenes[idx + 1]] = [scenes[idx + 1], scenes[idx]]
          }
          return { scenes }
        })
      },

      selectScene: (id) => set({ selectedSceneId: id }),

      updateGlobalStyle: (updates) => {
        set((state) => ({
          globalStyle: { ...state.globalStyle, ...updates },
        }))
      },

      addTextOverlay: (sceneId) => {
        const overlay: TextOverlay = {
          id: uuidv4(),
          content: 'Text overlay',
          font: 'Caveat',
          size: 48,
          color: '#ffffff',
          x: 50,
          y: 50,
          animation: 'fade-in',
          duration: 1,
          delay: 0,
        }
        get().updateScene(sceneId, {
          textOverlays: [...(get().scenes.find((s) => s.id === sceneId)?.textOverlays ?? []), overlay],
        })
      },

      updateTextOverlay: (sceneId, overlayId, updates) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          textOverlays: scene.textOverlays.map((o) => (o.id === overlayId ? { ...o, ...updates } : o)),
        })
      },

      removeTextOverlay: (sceneId, overlayId) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          textOverlays: scene.textOverlays.filter((o) => o.id !== overlayId),
        })
      },

      generateSVG: async (sceneId, onToken) => {
        const { scenes, globalStyle } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.prompt.trim()) return

        const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
        const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

        set({ isGenerating: true, generatingSceneId: sceneId })
        get().updateScene(sceneId, { svgContent: '' })

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              palette: globalStyle.palette,
              strokeWidth: globalStyle.strokeWidth,
              font: globalStyle.font,
              duration: scene.duration || globalStyle.duration,
              previousSummary,
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'Generation failed')
          }

          const data = await response.json()
          const cleanedSvg: string = data.result ?? ''
          const usage: SceneUsage | null = data.usage ?? null

          const rootBranch: SvgBranch = {
            id: uuidv4(),
            parentId: null,
            label: 'Original',
            svgContent: cleanedSvg,
            usage,
          }

          const currentScene = get().scenes.find((s) => s.id === sceneId)!
          const existingPrimary = (currentScene.svgObjects ?? []).find((o) => o.id === currentScene.primaryObjectId)
          const primaryId = existingPrimary?.id ?? uuidv4()
          const primaryObj: SvgObject = {
            id: primaryId,
            prompt: currentScene.prompt,
            svgContent: cleanedSvg,
            x: existingPrimary?.x ?? 0,
            y: existingPrimary?.y ?? 0,
            width: existingPrimary?.width ?? 100,
            opacity: existingPrimary?.opacity ?? 1,
            zIndex: 2,
          }
          const updatedObjects = existingPrimary
            ? (currentScene.svgObjects ?? []).map((o) => (o.id === primaryId ? primaryObj : o))
            : [primaryObj, ...(currentScene.svgObjects ?? [])]

          get().updateScene(sceneId, {
            svgContent: cleanedSvg,
            usage,
            svgBranches: [rootBranch],
            activeBranchId: rootBranch.id,
            svgObjects: updatedObjects,
            primaryObjectId: primaryId,
          })

          await get().saveSceneHTML(sceneId)

          try {
            const summaryRes = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: scene.prompt,
                summarize: true,
                svgContent: cleanedSvg,
              }),
            })
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json()
              get().updateScene(sceneId, { summary: (summaryData.result ?? '').trim().slice(0, 200) })
            }
          } catch {
            // Summary is optional
          }
        } catch (err) {
          console.error('Generation error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      generateCanvas: async (sceneId, onToken) => {
        const { scenes, globalStyle } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.prompt.trim()) return

        const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
        const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

        set({ isGenerating: true, generatingSceneId: sceneId })
        get().updateScene(sceneId, { canvasCode: '' })

        try {
          const response = await fetch('/api/generate-canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              palette: globalStyle.palette,
              bgColor: scene.bgColor,
              duration: scene.duration || globalStyle.duration,
              previousSummary,
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'Canvas generation failed')
          }

          const data = await response.json()
          const cleanedCode: string = data.result ?? ''
          const usage: SceneUsage | null = data.usage ?? null

          get().updateScene(sceneId, { canvasCode: cleanedCode, usage })
          await get().saveSceneHTML(sceneId)

          try {
            const summaryRes = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: scene.prompt,
                summarize: true,
                svgContent: cleanedCode.slice(0, 2000),
              }),
            })
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json()
              get().updateScene(sceneId, { summary: (summaryData.result ?? '').trim().slice(0, 200) })
            }
          } catch {
            // Summary is optional
          }
        } catch (err) {
          console.error('Canvas generation error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      generateMotion: async (sceneId) => {
        const { scenes, globalStyle } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.prompt.trim()) return

        const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
        const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

        set({ isGenerating: true, generatingSceneId: sceneId })
        get().updateScene(sceneId, { sceneCode: '', sceneHTML: '', sceneStyles: '' })

        try {
          const response = await fetch('/api/generate-motion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              palette: globalStyle.palette,
              font: globalStyle.font,
              bgColor: scene.bgColor,
              duration: scene.duration || globalStyle.duration,
              previousSummary,
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'Motion generation failed')
          }

          const data = await response.json()
          const { result } = data
          get().updateScene(sceneId, {
            sceneCode: result.sceneCode ?? '',
            sceneHTML: result.htmlContent ?? '',
            sceneStyles: result.styles ?? '',
            usage: data.usage ?? null,
          })
          await get().saveSceneHTML(sceneId)
        } catch (err) {
          console.error('Motion generation error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      generateD3: async (sceneId) => {
        const { scenes, globalStyle } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.prompt.trim()) return

        const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
        const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

        set({ isGenerating: true, generatingSceneId: sceneId })
        get().updateScene(sceneId, { sceneCode: '', sceneStyles: '' })

        try {
          const response = await fetch('/api/generate-d3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              palette: globalStyle.palette,
              font: globalStyle.font,
              bgColor: scene.bgColor,
              duration: scene.duration || globalStyle.duration,
              d3Data: scene.d3Data,
              previousSummary,
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'D3 generation failed')
          }

          const data = await response.json()
          const { result } = data
          get().updateScene(sceneId, {
            sceneCode: result.sceneCode ?? '',
            sceneStyles: result.styles ?? '',
            d3Data: result.suggestedData ?? null,
            usage: data.usage ?? null,
          })
          await get().saveSceneHTML(sceneId)
        } catch (err) {
          console.error('D3 generation error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      generateThree: async (sceneId) => {
        const { scenes, globalStyle } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.prompt.trim()) return

        const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
        const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

        set({ isGenerating: true, generatingSceneId: sceneId })
        get().updateScene(sceneId, { sceneCode: '' })

        try {
          const response = await fetch('/api/generate-three', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              palette: globalStyle.palette,
              bgColor: scene.bgColor,
              duration: scene.duration || globalStyle.duration,
              previousSummary,
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'Three.js generation failed')
          }

          const data = await response.json()
          const { result } = data
          get().updateScene(sceneId, {
            sceneCode: result.sceneCode ?? '',
            usage: data.usage ?? null,
          })
          await get().saveSceneHTML(sceneId)
        } catch (err) {
          console.error('Three.js generation error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      generateLottie: async (sceneId, onToken) => {
        const { scenes, globalStyle } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.prompt.trim()) return

        const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
        const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

        set({ isGenerating: true, generatingSceneId: sceneId })
        get().updateScene(sceneId, { svgContent: '' })

        try {
          const response = await fetch('/api/generate-lottie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              palette: globalStyle.palette,
              font: globalStyle.font,
              duration: scene.duration || globalStyle.duration,
              previousSummary,
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'Lottie overlay generation failed')
          }

          const data = await response.json()
          const cleanedSvg: string = data.result ?? ''
          const usage: SceneUsage | null = data.usage ?? null

          get().updateScene(sceneId, { svgContent: cleanedSvg, usage })
          await get().saveSceneHTML(sceneId)
        } catch (err) {
          console.error('Lottie overlay generation error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      addSvgObject: (sceneId) => {
        const obj: SvgObject = {
          id: uuidv4(),
          prompt: '',
          svgContent: '',
          x: 25,
          y: 25,
          width: 50,
          opacity: 1,
          zIndex: 4,
        }
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, { svgObjects: [...scene.svgObjects, obj] })
      },

      updateSvgObject: (sceneId, objectId, updates) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          svgObjects: scene.svgObjects.map((o) => (o.id === objectId ? { ...o, ...updates } : o)),
        })
      },

      removeSvgObject: (sceneId, objectId) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          svgObjects: scene.svgObjects.filter((o) => o.id !== objectId),
        })
      },

      generateSvgObject: async (sceneId, objectId, prompt, onToken) => {
        const { globalStyle } = get()
        if (!prompt.trim()) return

        set({ isGenerating: true, generatingSceneId: sceneId })

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              palette: globalStyle.palette,
              strokeWidth: globalStyle.strokeWidth,
              font: globalStyle.font,
              duration: globalStyle.duration,
              previousSummary: '',
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'Generation failed')
          }

          const data = await response.json()
          const cleanedSvg: string = data.result ?? ''
          get().updateSvgObject(sceneId, objectId, { svgContent: cleanedSvg, prompt })

          await get().saveSceneHTML(sceneId)
        } catch (err) {
          console.error('SVG object generation error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      switchBranch: (sceneId, branchId) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        const branch = scene.svgBranches.find((b) => b.id === branchId)
        if (!branch) return
        get().updateScene(sceneId, {
          svgContent: branch.svgContent,
          usage: branch.usage,
          activeBranchId: branchId,
        })
        if (scene.primaryObjectId) {
          get().updateSvgObject(sceneId, scene.primaryObjectId, { svgContent: branch.svgContent })
        }
        get().saveSceneHTML(sceneId)
      },

      editSVG: async (sceneId, instruction, onToken) => {
        const { scenes } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.svgContent || !instruction.trim()) return

        set({ isGenerating: true, generatingSceneId: sceneId })

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              edit: true,
              svgContent: scene.svgContent,
              editInstruction: instruction,
            }),
          })

          if (!response.ok) {
            const err = await response.text()
            throw new Error(err || 'Edit failed')
          }

          const data = await response.json()
          const cleanedSvg: string = data.result ?? ''
          const usage: SceneUsage | null = data.usage ?? null

          const preSyncScene = get().scenes.find((s) => s.id === sceneId)!
          if (preSyncScene.primaryObjectId) {
            get().updateSvgObject(sceneId, preSyncScene.primaryObjectId, { svgContent: cleanedSvg })
          }

          const currentScene = get().scenes.find((s) => s.id === sceneId)!
          const newBranch: SvgBranch = {
            id: uuidv4(),
            parentId: currentScene.activeBranchId,
            label: instruction.trim().slice(0, 40),
            svgContent: cleanedSvg,
            usage,
          }
          get().updateScene(sceneId, {
            svgContent: cleanedSvg,
            usage,
            svgBranches: [...currentScene.svgBranches, newBranch],
            activeBranchId: newBranch.id,
          })

          await get().saveSceneHTML(sceneId)
        } catch (err) {
          console.error('Edit error:', err)
        } finally {
          set({ isGenerating: false, generatingSceneId: null })
        }
      },

      enhancePrompt: async (sceneId) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene || !scene.prompt.trim()) return

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              enhance: true,
            }),
          })
          if (!response.ok) return
          const data = await response.json()
          get().updateScene(sceneId, { prompt: (data.result ?? '').trim() })
        } catch (err) {
          console.error('Enhance error:', err)
        }
      },

      saveSceneHTML: async (sceneId) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) {
          console.error('[saveSceneHTML] scene not found:', sceneId)
          return
        }
        const html = generateSceneHTML(scene)
        try {
          const res = await fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sceneId, html }),
          })
          if (!res.ok) {
            const body = await res.text().catch(() => '')
            console.error('[saveSceneHTML] API error', res.status, body)
            return
          }
          console.log('[saveSceneHTML] saved', sceneId, `(${html.length} chars)`)
          set({ sceneHtmlVersion: get().sceneHtmlVersion + 1 })
        } catch (err) {
          console.error('[saveSceneHTML] network error:', err)
        }
      },

      openExportModal: () => set({ isExportModalOpen: true }),
      closeExportModal: () => set({ isExportModalOpen: false, exportProgress: null }),

      exportVideo: async (settings) => {
        const { scenes } = get()
        set({
          isExporting: true,
          exportProgress: {
            phase: 'rendering',
            currentScene: 0,
            totalScenes: scenes.length,
            sceneProgress: 0,
            downloadUrl: null,
            error: null,
          },
        })

        try {
          const response = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenes: scenes.map((s) => ({
                id: s.id,
                duration: s.duration,
                transition: s.transition,
              })),
              outputName: `cench-studio-${Date.now()}`,
              settings,
            }),
          })

          if (!response.ok) throw new Error('Export request failed')

          const reader = response.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              try {
                const data = JSON.parse(line.slice(6))
                const { type } = data
                if (type === 'scene_progress') {
                  set({
                    exportProgress: {
                      phase: 'rendering',
                      currentScene: data.scene,
                      totalScenes: scenes.length,
                      sceneProgress: data.progress,
                      downloadUrl: null,
                      error: null,
                    },
                  })
                } else if (type === 'scene_done') {
                  set((state) => ({
                    exportProgress: state.exportProgress
                      ? { ...state.exportProgress, currentScene: data.scene, sceneProgress: 100 }
                      : null,
                  }))
                } else if (type === 'stitching') {
                  set({
                    exportProgress: {
                      phase: 'stitching',
                      currentScene: scenes.length,
                      totalScenes: scenes.length,
                      sceneProgress: 100,
                      downloadUrl: null,
                      error: null,
                    },
                  })
                } else if (type === 'complete') {
                  set({
                    exportProgress: {
                      phase: 'complete',
                      currentScene: scenes.length,
                      totalScenes: scenes.length,
                      sceneProgress: 100,
                      downloadUrl: data.downloadUrl,
                      error: null,
                    },
                  })
                } else if (type === 'error') {
                  set({
                    exportProgress: {
                      phase: 'error',
                      currentScene: 0,
                      totalScenes: scenes.length,
                      sceneProgress: 0,
                      downloadUrl: null,
                      error: data.message,
                    },
                  })
                }
              } catch {
                // Ignore malformed SSE lines
              }
            }
          }
        } catch (err) {
          set({
            exportProgress: {
              phase: 'error',
              currentScene: 0,
              totalScenes: scenes.length,
              sceneProgress: 0,
              downloadUrl: null,
              error: String(err),
            },
          })
        } finally {
          set({ isExporting: false })
        }
      },

      setExportProgress: (progress) => set({ exportProgress: progress }),

      captureSceneThumbnail: (sceneId, dataUrl) => {
        get().updateScene(sceneId, { thumbnail: dataUrl })
      },

      // ── Project management ──────────────────────────────────────────────
      fetchProjectList: async () => {
        set({ isLoadingProjects: true })
        try {
          const res = await fetch('/api/projects')
          if (res.ok) {
            const list = await res.json()
            set({ projectList: list.map((p: any) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt })) })
          }
        } catch (e) {
          console.error('Failed to fetch projects:', e)
        } finally {
          set({ isLoadingProjects: false })
        }
      },

      createNewProject: async (name?: string) => {
        const state = get()
        // Don't save current project — auto-save handles it.
        // Saving here overwrites externally-added scenes.

        const firstScene = createDefaultScene()
        firstScene.name = 'Scene 1'
        const newProject = createDefaultProject([firstScene])

        // Auto-increment "Untitled Project" names
        if (!name) {
          const existing = state.projectList.map(p => p.name)
          let n = 1
          let candidate = 'Untitled Project'
          while (existing.includes(candidate)) {
            n++
            candidate = `Untitled Project ${n}`
          }
          newProject.name = candidate
        } else {
          newProject.name = name
        }
        set({
          project: newProject,
          scenes: [firstScene],
          selectedSceneId: firstScene.id,
          globalStyle: DEFAULT_GLOBAL_STYLE,
          chatMessages: [],
          publishedUrl: null,
        })
        // Save to DB
        await get().saveProjectToDb()
        await get().fetchProjectList()
      },

      reloadCurrentProject: async () => {
        const { project } = get()
        try {
          const res = await fetch(`/api/projects/${project.id}`)
          if (!res.ok) return
          const data = await res.json()
          set({
            scenes: data.scenes || [],
            selectedSceneId: data.scenes?.[0]?.id || null,
          })
        } catch (e) {
          console.error('Failed to reload project:', e)
        }
      },

      loadProject: async (projectId: string) => {
        // Don't save before loading — auto-save handles persistence.
        // Saving here overwrites externally-added scenes (from API/skill).
        try {
          const res = await fetch(`/api/projects/${projectId}`)
          if (!res.ok) throw new Error('Failed to load project')
          const data = await res.json()

          const loadedProject: Project = {
            id: data.id,
            name: data.name,
            outputMode: data.outputMode || 'mp4',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            mp4Settings: data.mp4Settings || { resolution: '1080p', fps: 30, format: 'mp4' },
            interactiveSettings: data.interactiveSettings || {
              playerTheme: 'dark', showProgressBar: true, showSceneNav: true,
              allowFullscreen: true, brandColor: '#e84545', customDomain: null, password: null,
            },
            sceneGraph: data.sceneGraph || { nodes: [], edges: [], startSceneId: '' },
            apiPermissions: data.apiPermissions || createDefaultAPIPermissions(),
          }

          set({
            project: loadedProject,
            scenes: data.scenes || [],
            selectedSceneId: data.scenes?.[0]?.id || null,
            globalStyle: data.globalStyle || DEFAULT_GLOBAL_STYLE,
            chatMessages: [],
            publishedUrl: null,
          })
        } catch (e) {
          console.error('Failed to load project:', e)
        }
      },

      saveProjectToDb: async () => {
        const { project, scenes, globalStyle } = get()
        try {
          // Check if DB has newer data (from API/skill) before overwriting
          try {
            const check = await fetch(`/api/projects/${project.id}`, { method: 'GET' })
            if (check.ok) {
              const dbProject = await check.json()
              const dbTime = new Date(dbProject.updatedAt).getTime()
              const ourTime = new Date(project.updatedAt).getTime()
              if (dbTime > ourTime) {
                // DB was updated externally (by API/skill) — don't overwrite
                return
              }
            }
          } catch {
            // Can't check — proceed with save
          }

          // PATCH the project
          const res = await fetch(`/api/projects/${project.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: project.name,
              outputMode: project.outputMode,
              globalStyle,
              mp4Settings: project.mp4Settings,
              interactiveSettings: project.interactiveSettings,
              apiPermissions: project.apiPermissions,
              scenes,
              sceneGraph: project.sceneGraph,
            }),
          })
          if (res.status === 404) {
            // Project doesn't exist in DB yet — create it
            await fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: project.id,
                name: project.name,
                outputMode: project.outputMode,
                globalStyle,
                mp4Settings: project.mp4Settings,
                interactiveSettings: project.interactiveSettings,
                apiPermissions: project.apiPermissions,
                scenes,
                sceneGraph: project.sceneGraph,
              }),
            })
          }
        } catch (e) {
          console.error('Failed to save project:', e)
        }
      },

      deleteProjectFromDb: async (projectId: string) => {
        try {
          await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
          await get().fetchProjectList()
        } catch (e) {
          console.error('Failed to delete project:', e)
        }
      },

      seedTestScenes: async () => {
        const testScenes = createTestScenes()
        for (const scene of testScenes) {
          const html = generateSceneHTML(scene)
          try {
            await fetch('/api/scene', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: scene.id, html }),
            })
          } catch {
            // non-fatal
          }
        }
        set((state) => ({
          scenes: [...state.scenes, ...testScenes],
          selectedSceneId: testScenes[0].id,
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
        }))
      },

      seedInteractiveTestScenes: async () => {
        const testScenes = createInteractiveTestScenes()
        // Write HTML files first
        for (const scene of testScenes) {
          const html = generateSceneHTML(scene)
          try {
            await fetch('/api/scene', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: scene.id, html }),
            })
          } catch {}
        }
        set((state) => {
          const allScenes = [...state.scenes, ...testScenes]
          // Build graph nodes for new scenes
          const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
          const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
          testScenes.forEach((s, i) => {
            if (!existingNodeIds.has(s.id)) {
              newNodes.push({ id: s.id, position: { x: (i % 3) * 240 + 100, y: Math.floor(i / 3) * 200 + 100 } })
            }
          })
          // Build auto edges: hotspot→choice, choice branches handled by interactions,
          // quiz→tooltip, gate→tooltip, tooltip→form, form loops back via interaction
          const newEdges: SceneEdge[] = [
            ...state.project.sceneGraph.edges,
            { id: uuidv4(), fromSceneId: testScenes[0].id, toSceneId: testScenes[1].id, condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null } },
            { id: uuidv4(), fromSceneId: testScenes[3].id, toSceneId: testScenes[4].id, condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null } },
            { id: uuidv4(), fromSceneId: testScenes[4].id, toSceneId: testScenes[5].id, condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null } },
          ]
          return {
            scenes: allScenes,
            selectedSceneId: testScenes[0].id,
            sceneHtmlVersion: state.sceneHtmlVersion + 1,
            project: {
              ...state.project,
              outputMode: 'interactive' as const,
              sceneGraph: {
                ...state.project.sceneGraph,
                nodes: newNodes,
                edges: newEdges,
                startSceneId: state.project.sceneGraph.startSceneId || testScenes[0].id,
              },
            },
          }
        })
      },

      // ── AI Layer actions ──────────────────────────────────────────────────────

      addAILayer: (sceneId, layer) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          aiLayers: [...(scene.aiLayers ?? []), layer],
        })
      },

      updateAILayer: (sceneId, layerId, updates) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          aiLayers: (scene.aiLayers ?? []).map((l) =>
            l.id === layerId ? { ...l, ...updates } as AILayer : l
          ),
        })
      },

      removeAILayer: (sceneId, layerId) => {
        const scene = get().scenes.find((s) => s.id === sceneId)
        if (!scene) return
        get().updateScene(sceneId, {
          aiLayers: (scene.aiLayers ?? []).filter((l) => l.id !== layerId),
        })
      },

      // ── Permission actions ────────────────────────────────────────────────────

      updateAPIPermissions: (updates) => {
        set((state) => ({
          project: {
            ...state.project,
            apiPermissions: { ...state.project.apiPermissions, ...updates },
            updatedAt: new Date().toISOString(),
          },
        }))
      },

      pendingPermissionRequest: null,
      setPendingPermissionRequest: (req) => set({ pendingPermissionRequest: req }),

      sessionPermissions: new Map<string, string>(),
      setSessionPermission: (api, decision) => {
        set((state) => {
          const newMap = new Map(state.sessionPermissions)
          newMap.set(api, decision)
          return { sessionPermissions: newMap }
        })
      },

      // ── Media generation ──────────────────────────────────────────────────────

      generateAIImage: async (sceneId, opts) => {
        const { project } = get()
        const layerId = uuidv4()

        // Add pending layer
        const isSticker = opts.removeBackground ?? false
        const layer: AILayer = isSticker
          ? {
              id: layerId,
              type: 'sticker' as const,
              prompt: opts.prompt,
              model: (opts.model ?? 'recraft-v3') as any,
              style: (opts.style ?? 'illustration') as any,
              imageUrl: null,
              stickerUrl: null,
              x: opts.x ?? 960,
              y: opts.y ?? 540,
              width: opts.width ?? 200,
              height: opts.height ?? 200,
              rotation: 0,
              opacity: 1,
              zIndex: 10,
              status: 'generating',
              animateIn: true,
              startAt: 0,
              label: opts.label ?? 'AI Sticker',
            }
          : {
              id: layerId,
              type: 'image' as const,
              prompt: opts.prompt,
              model: (opts.model ?? 'flux-schnell') as any,
              style: (opts.style ?? null) as any,
              imageUrl: null,
              x: opts.x ?? 960,
              y: opts.y ?? 540,
              width: opts.width ?? 400,
              height: opts.height ?? 400,
              rotation: 0,
              opacity: 1,
              zIndex: 5,
              status: 'generating',
              label: opts.label ?? 'AI Image',
            }

        get().addAILayer(sceneId, layer)

        try {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              sceneId,
              prompt: opts.prompt,
              model: opts.model ?? (isSticker ? 'recraft-v3' : 'flux-schnell'),
              style: opts.style,
              aspectRatio: opts.aspectRatio ?? '1:1',
              removeBackground: isSticker,
            }),
          })

          const data = await res.json()
          if (!res.ok) throw new Error(data.error)

          if (isSticker) {
            get().updateAILayer(sceneId, layerId, {
              status: 'ready',
              imageUrl: data.imageUrl,
              stickerUrl: data.stickerUrl,
            } as Partial<AILayer>)
          } else {
            get().updateAILayer(sceneId, layerId, {
              status: 'ready',
              imageUrl: data.imageUrl,
            } as Partial<AILayer>)
          }

          // Regenerate scene HTML
          await get().saveSceneHTML(sceneId)
        } catch (err: any) {
          console.error('AI image generation failed:', err)
          get().updateAILayer(sceneId, layerId, { status: 'error' } as Partial<AILayer>)
        }
      },

      pollAvatarStatus: (sceneId, layerId, videoId) => {
        const poll = async () => {
          try {
            const res = await fetch(`/api/generate-avatar?videoId=${encodeURIComponent(videoId)}`)
            const data = await res.json()

            if (data.status === 'completed') {
              get().updateAILayer(sceneId, layerId, {
                status: 'ready',
                videoUrl: data.videoUrl,
                thumbnailUrl: data.thumbnailUrl,
              } as Partial<AILayer>)
              await get().saveSceneHTML(sceneId)
              return // stop polling
            }

            if (data.status === 'failed') {
              get().updateAILayer(sceneId, layerId, { status: 'error' } as Partial<AILayer>)
              return
            }

            // Still processing — poll again in 15s
            setTimeout(poll, 15000)
          } catch {
            setTimeout(poll, 15000)
          }
        }
        setTimeout(poll, 5000)
      },

      pollVeo3Status: (sceneId, layerId, operationName) => {
        const poll = async () => {
          try {
            const res = await fetch(`/api/generate-video?operationName=${encodeURIComponent(operationName)}`)
            const data = await res.json()

            if (data.done && data.videoUrl) {
              get().updateAILayer(sceneId, layerId, {
                status: 'ready',
                videoUrl: data.videoUrl,
              } as Partial<AILayer>)
              await get().saveSceneHTML(sceneId)
              return
            }

            if (data.done && data.error) {
              get().updateAILayer(sceneId, layerId, { status: 'error' } as Partial<AILayer>)
              return
            }

            setTimeout(poll, 15000)
          } catch {
            setTimeout(poll, 15000)
          }
        }
        setTimeout(poll, 5000)
      },
    }),
    {
      name: 'cench-studio-storage',
      version: 6,
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
        return persistedState
      },
      partialize: (state) => ({
        scenes: state.scenes,
        selectedSceneId: state.selectedSceneId,
        globalStyle: state.globalStyle,
        project: state.project,
        publishedUrl: state.publishedUrl,
        showPublishPanel: state.showPublishPanel,
        modelConfigs: state.modelConfigs,
        providerConfigs: state.providerConfigs,
        agentConfigs: state.agentConfigs,
      }),
    }
  )
)

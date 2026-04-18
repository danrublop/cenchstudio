import { contextBridge, ipcRenderer } from 'electron'

// ── window.cenchApi — new canonical IPC namespace (Week 2 migration) ───────
// Every former `/api/<category>/route.ts` endpoint lands here as
// `cenchApi.<category>.<method>()`. Channels use `cench:<category>.<method>`.
// The older `window.electronAPI` surface below stays in place until its
// callers are migrated; both namespaces coexist throughout Week 2.
type ListProvidersResult = {
  providers: {
    tts: { id: string; name: string; available: boolean }[]
    sfx: { id: string; name: string; available: boolean }[]
    music: { id: string; name: string; available: boolean }[]
  }
  media: { id: string; name: string; category: 'video' | 'image' | 'avatar' | 'utility'; available: boolean }[]
}

export type CenchApi = {
  settings: {
    listProviders: () => Promise<ListProvidersResult>
  }
  conversations: {
    list: (projectId: string) => Promise<{ conversations: unknown[] }>
    create: (args: { projectId: string; title?: string }) => Promise<{ conversation: unknown }>
    get: (id: string) => Promise<{ conversation: unknown; messages: unknown[] }>
    update: (args: {
      id: string
      updates: { title?: string; isPinned?: boolean; isArchived?: boolean }
    }) => Promise<{ conversation: unknown }>
    delete: (id: string) => Promise<{ success: true }>
    listMessages: (id: string) => Promise<{ messages: unknown[] }>
    addMessage: (args: Record<string, unknown>) => Promise<{ message?: unknown; success?: true }>
    updateMessage: (args: Record<string, unknown>) => Promise<{ success: true }>
    clearMessages: (id: string) => Promise<{ success: true }>
  }
  usage: {
    getSummary: (projectId?: string) => Promise<Record<string, unknown>>
  }
  generationLog: {
    update: (args: Record<string, unknown>) => Promise<{ success: true }>
    list: (args: {
      projectId?: string
      sceneId?: string
      limit?: number
      offset?: number
    }) => Promise<{ logs: unknown[] }>
    listByDimension: (args: { dimension: string; projectId?: string }) => Promise<{ data: unknown }>
  }
  permissions: {
    getSpend: () => Promise<Record<string, { sessionSpend: number; monthlySpend: number }>>
    perform: (args: {
      action: 'log_spend' | 'set_session_permission' | 'get_session_permission'
      api: string
      costUsd?: number
      description?: string
      projectId?: string
      decision?: string
    }) => Promise<{ ok?: true; decision?: string | null }>
  }
  skills: {
    readFile: (args: { source: string; file: string }) => Promise<{
      content: string
      file: string
      source: string
    }>
  }
  projects: {
    list: (args?: { limit?: number; cursor?: string; workspaceId?: string | 'none' }) => Promise<unknown>
    create: (args: Record<string, unknown>) => Promise<unknown>
    get: (projectId: string) => Promise<unknown>
    update: (args: { projectId: string; updates: Record<string, unknown> }) => Promise<unknown>
    delete: (projectId: string) => Promise<{ ok: true }>
    listAssets: (args: {
      projectId: string
      type?: 'image' | 'video' | 'svg'
      source?: 'upload' | 'generated'
    }) => Promise<{ assets: unknown[] }>
    getBrandKit: (projectId: string) => Promise<{ brandKit: unknown }>
    updateBrandKit: (args: { projectId: string; updates: Record<string, unknown> }) => Promise<{
      brandKit: unknown
    }>
    patchAsset: (args: {
      projectId: string
      assetId: string
      name?: string
      tags?: string[]
    }) => Promise<{ asset: Record<string, unknown> }>
    deleteAsset: (args: { projectId: string; assetId: string }) => Promise<{ success: true }>
    regenerateAsset: (args: {
      projectId: string
      assetId: string
      promptOverride?: string
      model?: string
      aspectRatio?: string
      enhanceTags?: string[]
    }) => Promise<{ asset: Record<string, unknown>; cost: number; finalPrompt: string }>
    generateAsset: (args: {
      projectId: string
      prompt: string
      model?: string
      aspectRatio?: string
      enhanceTags?: string[]
      referenceAssetId?: string | null
    }) => Promise<{ asset: Record<string, unknown>; cost: number; finalPrompt: string }>
  }
  workspaces: {
    list: () => Promise<unknown[]>
    get: (workspaceId: string) => Promise<unknown>
    create: (args: {
      name: string
      description?: string | null
      color?: string | null
      icon?: string | null
      isDefault?: boolean
    }) => Promise<unknown>
    update: (args: { workspaceId: string; updates: Record<string, unknown> }) => Promise<unknown>
    delete: (workspaceId: string) => Promise<{ success: true }>
    assignProjects: (args: { workspaceId: string; projectIds: string[] }) => Promise<{ success: true }>
    unassignProjects: (args: { projectIds: string[] }) => Promise<{ success: true }>
  }
  publish: {
    run: (args: { project: Record<string, unknown>; scenes: unknown[]; globalStyle?: unknown }) => Promise<{
      publishedUrl: string
      version: number
    }>
  }
  scene: {
    writeHtml: (args: { id: string; html: string }) => Promise<{ success: true; path: string }>
    get: (args: { projectId: string; sceneId: string }) => Promise<{ scene: Record<string, unknown> }>
    generateWorld: (args: {
      scene: Record<string, unknown>
      aspectRatio?: string
      resolution?: string
    }) => Promise<{ success: true; path: string }>
  }
  media: {
    upload: (args: {
      data: ArrayBuffer
      mimeType: string
      originalName?: string
    }) => Promise<{ url: string; filename: string }>
  }
  avatarConfigs: {
    list: (args: { projectId: string }) => Promise<{
      configs: Array<Record<string, unknown>>
      providers: Array<Record<string, unknown>>
    }>
    create: (args: {
      projectId: string
      provider: string
      name: string
      config?: Record<string, unknown>
      isDefault?: boolean
    }) => Promise<Record<string, unknown>>
    update: (args: {
      projectId: string
      configId: string
      provider?: string
      name?: string
      config?: Record<string, unknown>
      isDefault?: boolean
      thumbnailUrl?: string
    }) => Promise<Record<string, unknown>>
    delete: (args: { projectId: string; configId: string }) => Promise<{ success: true }>
  }
  zdogLibrary: {
    list: (args: { projectId: string }) => Promise<{ assets: Array<Record<string, unknown>> }>
    save: (args: {
      projectId: string
      name: string
      assetType?: 'studio' | 'person'
      tags?: string[]
      shapes?: unknown[]
      formula?: unknown
    }) => Promise<{ success: true; asset: Record<string, unknown> }>
    delete: (args: { projectId: string; id: string }) => Promise<{ success: true }>
  }
  tts: {
    synthesize: (args: {
      text: string
      sceneId: string
      voiceId?: string
      provider?: string
      model?: string
      instructions?: string
      localMode?: boolean
    }) => Promise<Record<string, unknown>>
    listVoices: (provider: string) => Promise<{ voices: unknown[]; provider: string }>
    designVoice: (args: { description: string; sampleText?: string }) => Promise<{
      voiceId: string
      name: string
      previewUrl: string | null
      provider: 'voxcpm'
    }>
  }
  sfx: {
    search: (args: {
      query?: string
      prompt?: string
      provider?: string
      limit?: number
      duration?: number
      download?: boolean
      mode?: 'search' | 'library' | 'generated'
      categoryId?: string
      page?: number
      commercialOnly?: boolean
    }) => Promise<Record<string, unknown>>
  }
  music: {
    search: (args: {
      query: string
      provider?: string
      limit?: number
      download?: boolean
    }) => Promise<Record<string, unknown>>
  }
  ingest: {
    fromUrl: (args: { url: string; projectId: string; formatId?: string }) => Promise<Record<string, unknown>>
    fromDirectUrl: (args: {
      url: string
      projectId: string
      name?: string
      tags?: string[]
    }) => Promise<Record<string, unknown>>
  }
  generate: {
    canvas: (args: GenerateBaseArgs) => Promise<{
      result: string
      usage: UsageResult
      truncated?: boolean
    }>
    motion: (args: GenerateBaseArgs & { font?: string }) => Promise<{
      result: { sceneCode: string; styles?: unknown; htmlContent?: unknown }
      usage: UsageResult
      truncated?: boolean
    }>
    three: (args: GenerateBaseArgs) => Promise<{
      result: { sceneCode: string }
      usage: UsageResult
      truncated?: boolean
    }>
    react: (args: GenerateBaseArgs & { font?: string }) => Promise<{
      result: { sceneCode: string; styles?: unknown }
      usage: UsageResult
      truncated?: boolean
    }>
    lottie: (args: GenerateBaseArgs & { font?: string; motionPersonality?: string }) => Promise<{
      result: string
      usage: UsageResult
      quality: { score: number; dimensions: unknown; suggestions: unknown }
      fixCount?: number
    }>
    d3: (args: GenerateBaseArgs & { font?: string; d3Data?: unknown }) => Promise<{
      result: {
        chartLayers: unknown[]
        sceneCode: string
        d3Data: unknown
        styles: unknown
        suggestedData: unknown
      }
      usage: UsageResult
      mode: 'cench_charts' | 'legacy'
    }>
    image: (args: {
      prompt: string
      negativePrompt?: string
      model?: string
      aspectRatio?: string
      style?: string | null
      removeBackground?: boolean
      projectId?: string
      sceneId?: string
    }) => Promise<{
      imageUrl: string
      stickerUrl: string | null
      width: number
      height: number
      cost: number
    }>
    pollHeygen: (videoId: string) => Promise<{
      status: string
      videoUrl?: string
      thumbnailUrl?: string
      error?: string
    }>
    pollVideo: (args: {
      operationName: string
      projectId?: string
      prompt?: string
      providerId?: string
      reservationId?: string
    }) => Promise<{
      done: boolean
      videoUrl?: string
      provider?: string
      error?: string
    }>
    svg: (args: GenerateBaseArgs & { strokeWidth?: number; font?: string }) => Promise<{
      result: string
      usage: UsageResult
    }>
    enhancePrompt: (args: { prompt: string; modelId?: string; modelConfigs?: unknown[] }) => Promise<{
      result: string
      usage: UsageResult
    }>
    summarize: (args: {
      prompt: string
      svgContent?: string
      modelId?: string
      modelConfigs?: unknown[]
    }) => Promise<{ result: string }>
    editSvg: (args: {
      svgContent: string
      editInstruction: string
      modelId?: string
      modelConfigs?: unknown[]
    }) => Promise<{ result: string; usage: UsageResult }>
  }
}

type UsageResult = { input_tokens: number; output_tokens: number; cost_usd: number }

type GenerateBaseArgs = {
  prompt: string
  palette?: string[]
  bgColor?: string
  duration?: number
  previousSummary?: string
  modelId?: string
  modelConfigs?: unknown[]
}

const cenchApi: CenchApi = {
  settings: {
    listProviders: () => ipcRenderer.invoke('cench:settings.listProviders'),
  },
  conversations: {
    list: (projectId) => ipcRenderer.invoke('cench:conversations.list', projectId),
    create: (args) => ipcRenderer.invoke('cench:conversations.create', args),
    get: (id) => ipcRenderer.invoke('cench:conversations.get', id),
    update: (args) => ipcRenderer.invoke('cench:conversations.update', args),
    delete: (id) => ipcRenderer.invoke('cench:conversations.delete', id),
    listMessages: (id) => ipcRenderer.invoke('cench:conversations.listMessages', id),
    addMessage: (args) => ipcRenderer.invoke('cench:conversations.addMessage', args),
    updateMessage: (args) => ipcRenderer.invoke('cench:conversations.updateMessage', args),
    clearMessages: (id) => ipcRenderer.invoke('cench:conversations.clearMessages', id),
  },
  usage: {
    getSummary: (projectId) => ipcRenderer.invoke('cench:usage.getSummary', projectId),
  },
  generationLog: {
    update: (args) => ipcRenderer.invoke('cench:generationLog.update', args),
    list: (args) => ipcRenderer.invoke('cench:generationLog.list', args),
    listByDimension: (args) => ipcRenderer.invoke('cench:generationLog.listByDimension', args),
  },
  permissions: {
    getSpend: () => ipcRenderer.invoke('cench:permissions.getSpend'),
    perform: (args) => ipcRenderer.invoke('cench:permissions.perform', args),
  },
  skills: {
    readFile: (args) => ipcRenderer.invoke('cench:skills.readFile', args),
  },
  projects: {
    list: (args) => ipcRenderer.invoke('cench:projects.list', args),
    create: (args) => ipcRenderer.invoke('cench:projects.create', args),
    get: (projectId) => ipcRenderer.invoke('cench:projects.get', projectId),
    update: (args) => ipcRenderer.invoke('cench:projects.update', args),
    delete: (projectId) => ipcRenderer.invoke('cench:projects.delete', projectId),
    listAssets: (args) => ipcRenderer.invoke('cench:projects.listAssets', args),
    getBrandKit: (projectId) => ipcRenderer.invoke('cench:projects.getBrandKit', projectId),
    updateBrandKit: (args) => ipcRenderer.invoke('cench:projects.updateBrandKit', args),
    patchAsset: (args) => ipcRenderer.invoke('cench:projects.patchAsset', args),
    deleteAsset: (args) => ipcRenderer.invoke('cench:projects.deleteAsset', args),
    regenerateAsset: (args) => ipcRenderer.invoke('cench:projects.regenerateAsset', args),
    generateAsset: (args) => ipcRenderer.invoke('cench:projects.generateAsset', args),
  },
  workspaces: {
    list: () => ipcRenderer.invoke('cench:workspaces.list'),
    get: (workspaceId) => ipcRenderer.invoke('cench:workspaces.get', workspaceId),
    create: (args) => ipcRenderer.invoke('cench:workspaces.create', args),
    update: (args) => ipcRenderer.invoke('cench:workspaces.update', args),
    delete: (workspaceId) => ipcRenderer.invoke('cench:workspaces.delete', workspaceId),
    assignProjects: (args) => ipcRenderer.invoke('cench:workspaces.assignProjects', args),
    unassignProjects: (args) => ipcRenderer.invoke('cench:workspaces.unassignProjects', args),
  },
  publish: {
    run: (args) => ipcRenderer.invoke('cench:publish.run', args),
  },
  scene: {
    writeHtml: (args) => ipcRenderer.invoke('cench:scene.writeHtml', args),
    get: (args) => ipcRenderer.invoke('cench:scene.get', args),
    generateWorld: (args) => ipcRenderer.invoke('cench:scene.generateWorld', args),
  },
  media: {
    upload: (args) => ipcRenderer.invoke('cench:media.upload', args),
  },
  avatarConfigs: {
    list: (args) => ipcRenderer.invoke('cench:avatarConfigs.list', args),
    create: (args) => ipcRenderer.invoke('cench:avatarConfigs.create', args),
    update: (args) => ipcRenderer.invoke('cench:avatarConfigs.update', args),
    delete: (args) => ipcRenderer.invoke('cench:avatarConfigs.delete', args),
  },
  zdogLibrary: {
    list: (args) => ipcRenderer.invoke('cench:zdogLibrary.list', args),
    save: (args) => ipcRenderer.invoke('cench:zdogLibrary.save', args),
    delete: (args) => ipcRenderer.invoke('cench:zdogLibrary.delete', args),
  },
  tts: {
    synthesize: (args) => ipcRenderer.invoke('cench:tts.synthesize', args),
    listVoices: (provider) => ipcRenderer.invoke('cench:tts.listVoices', provider),
    designVoice: (args) => ipcRenderer.invoke('cench:tts.designVoice', args),
  },
  sfx: {
    search: (args) => ipcRenderer.invoke('cench:sfx.search', args),
  },
  music: {
    search: (args) => ipcRenderer.invoke('cench:music.search', args),
  },
  ingest: {
    fromUrl: (args) => ipcRenderer.invoke('cench:ingest.fromUrl', args),
    fromDirectUrl: (args) => ipcRenderer.invoke('cench:ingest.fromDirectUrl', args),
  },
  generate: {
    canvas: (args) => ipcRenderer.invoke('cench:generate.canvas', args),
    motion: (args) => ipcRenderer.invoke('cench:generate.motion', args),
    three: (args) => ipcRenderer.invoke('cench:generate.three', args),
    react: (args) => ipcRenderer.invoke('cench:generate.react', args),
    lottie: (args) => ipcRenderer.invoke('cench:generate.lottie', args),
    d3: (args) => ipcRenderer.invoke('cench:generate.d3', args),
    image: (args) => ipcRenderer.invoke('cench:generate.image', args),
    pollHeygen: (videoId) => ipcRenderer.invoke('cench:generate.pollHeygen', videoId),
    pollVideo: (args) => ipcRenderer.invoke('cench:generate.pollVideo', args),
    svg: (args) => ipcRenderer.invoke('cench:generate.svg', args),
    enhancePrompt: (args) => ipcRenderer.invoke('cench:generate.enhancePrompt', args),
    summarize: (args) => ipcRenderer.invoke('cench:generate.summarize', args),
    editSvg: (args) => ipcRenderer.invoke('cench:generate.editSvg', args),
  },
}

contextBridge.exposeInMainWorld('cenchApi', cenchApi)

// ── window.electronAPI — legacy namespace, superseded by cenchApi ──────────
export type ElectronAPI = {
  saveDialog: (suggestedName?: string) => Promise<{ canceled: boolean; filePath: string | null }>
  /** Pick a directory (no filename). Used by Export panel "Save to" field. */
  chooseDirectory: (defaultPath?: string) => Promise<{ canceled: boolean; dirPath: string | null }>
  /** Default location for saving exports (the system Downloads folder). */
  getDefaultExportDir: () => Promise<{ dirPath: string }>
  /** Reveal the file in Finder/Explorer/Files. */
  showItemInFolder: (filePath: string) => Promise<{ ok: true } | { ok: false; error: string }>
  /** Open the file with its default OS application. */
  openPath: (filePath: string) => Promise<{ ok: true } | { ok: false; error: string }>
  writeFile: (args: { filePath: string; bytes: ArrayBuffer }) => Promise<{ ok: true }>
  saveRecording: (args: {
    bytes: ArrayBuffer
    extension?: string
    nameHint?: string
  }) => Promise<{ ok: true; filePath: string; fileUrl: string }>
  concatMp4: (args: {
    inputs: string[]
    output: string
    cleanup?: boolean
    transitions?: Array<{ type: string; duration?: number }>
  }) => Promise<{ ok: true }>
  getGitStatus: () => Promise<{ ok: boolean; branch: string | null; dirty: boolean }>
  webZoomIn: () => Promise<{ ok: boolean; factor: number }>
  webZoomOut: () => Promise<{ ok: boolean; factor: number }>
  webZoomReset: () => Promise<{ ok: boolean; factor: number }>
  capturePage: (args?: {
    rect?: { x: number; y: number; width: number; height: number }
  }) => Promise<{ ok: true; dataUri: string; mimeType: string } | { ok: false; error: string }>
  saveRecordingSession: (args: { screenBytes: ArrayBuffer; webcamBytes?: ArrayBuffer; nameHint?: string }) => Promise<{
    screenVideoPath: string
    screenVideoUrl: string
    webcamVideoPath?: string
    webcamVideoUrl?: string
    createdAt: number
  }>
  startCursorTelemetry: () => Promise<{ ok: true }>
  stopCursorTelemetry: () => Promise<{ samples: Array<{ t: number; x: number; y: number }> }>
}

const api: ElectronAPI = {
  saveDialog: (suggestedName?: string) => ipcRenderer.invoke('cench:saveDialog', suggestedName),
  chooseDirectory: (defaultPath?: string) => ipcRenderer.invoke('cench:chooseDirectory', defaultPath),
  getDefaultExportDir: () => ipcRenderer.invoke('cench:getDefaultExportDir'),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('cench:showItemInFolder', filePath),
  openPath: (filePath: string) => ipcRenderer.invoke('cench:openPath', filePath),
  writeFile: (args) => ipcRenderer.invoke('cench:writeFile', args),
  saveRecording: (args) => ipcRenderer.invoke('cench:saveRecording', args),
  concatMp4: (args) => ipcRenderer.invoke('cench:concatMp4', args),
  getGitStatus: () => ipcRenderer.invoke('cench:gitStatus'),
  webZoomIn: () => ipcRenderer.invoke('cench:webZoomIn'),
  webZoomOut: () => ipcRenderer.invoke('cench:webZoomOut'),
  webZoomReset: () => ipcRenderer.invoke('cench:webZoomReset'),
  capturePage: (args) => ipcRenderer.invoke('cench:capturePage', args),
  saveRecordingSession: (args) => ipcRenderer.invoke('cench:saveRecordingSession', args),
  startCursorTelemetry: () => ipcRenderer.invoke('cench:startCursorTelemetry'),
  stopCursorTelemetry: () => ipcRenderer.invoke('cench:stopCursorTelemetry'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

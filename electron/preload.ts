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
}

contextBridge.exposeInMainWorld('cenchApi', cenchApi)

// ── window.electronAPI — legacy namespace, superseded by cenchApi ──────────
export type ElectronAPI = {
  saveDialog: (suggestedName?: string) => Promise<{ canceled: boolean; filePath: string | null }>
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

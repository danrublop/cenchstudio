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
}

const cenchApi: CenchApi = {
  settings: {
    listProviders: () => ipcRenderer.invoke('cench:settings.listProviders'),
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

export {}

export interface DesktopSource {
  id: string
  name: string
  thumbnailDataUrl: string
  appIconDataUrl: string | null
  displayId: string
}

export type RecordingCommand = 'start' | 'stop' | 'pause' | 'resume' | 'cancel' | null
export type RecordingStoreState = 'idle' | 'recording' | 'paused' | 'saving'

export interface RecordingConfig {
  micEnabled: boolean
  micDeviceId: string | null
  systemAudioEnabled: boolean
  webcamEnabled: boolean
  webcamDeviceId: string | null
  fps: number
  resolution: '720p' | '1080p' | '1440p' | '2160p' | 'source'
}

export interface RecordingSessionManifest {
  screenVideoPath: string
  screenVideoUrl: string
  webcamVideoPath?: string
  webcamVideoUrl?: string
  cursorTelemetry?: Array<{ t: number; x: number; y: number }>
  createdAt: number
}

declare global {
  interface Window {
    electronAPI?: {
      saveDialog: (suggestedName?: string) => Promise<{ canceled: boolean; filePath: string | null }>
      chooseDirectory: (defaultPath?: string) => Promise<{ canceled: boolean; dirPath: string | null }>
      getDefaultExportDir: () => Promise<{ dirPath: string }>
      showItemInFolder: (filePath: string) => Promise<{ ok: true } | { ok: false; error: string }>
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
      saveRecordingSession: (args: {
        screenBytes: ArrayBuffer
        webcamBytes?: ArrayBuffer
        nameHint?: string
      }) => Promise<RecordingSessionManifest>
      startCursorTelemetry: () => Promise<{ ok: true }>
      stopCursorTelemetry: () => Promise<{ samples: Array<{ t: number; x: number; y: number }> }>
    }
  }
}

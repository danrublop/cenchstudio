import { contextBridge, ipcRenderer } from 'electron'

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
}

const api: ElectronAPI = {
  saveDialog: (suggestedName?: string) => ipcRenderer.invoke('cench:saveDialog', suggestedName),
  writeFile: (args) => ipcRenderer.invoke('cench:writeFile', args),
  saveRecording: (args) => ipcRenderer.invoke('cench:saveRecording', args),
  concatMp4: (args) => ipcRenderer.invoke('cench:concatMp4', args),
}

contextBridge.exposeInMainWorld('electronAPI', api)

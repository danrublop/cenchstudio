export {}

declare global {
  interface Window {
    electronAPI?: {
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
  }
}

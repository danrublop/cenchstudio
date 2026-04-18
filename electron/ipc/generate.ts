import type { IpcMain } from 'electron'
import { generateCanvas, GenerationValidationError } from '@/lib/services/generation'
import { IpcValidationError } from './_helpers'

/**
 * Category: generate
 *
 * Thin IPC wrappers around `lib/services/generation.ts`. One method per
 * scene type, each returning the same response shape as the corresponding
 * HTTP route so renderer callers can swap transports without adapting
 * response parsing.
 *
 * Pilot: canvas only. motion/three/react/lottie/zdog/d3 extract in
 * follow-up commits. The main `/api/generate` (enhance/summarize/edit
 * variants) is a separate shape + separate migration.
 */

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:generate.canvas', async (_e, args: Parameters<typeof generateCanvas>[0]) => {
    try {
      return await generateCanvas(args)
    } catch (err) {
      if (err instanceof GenerationValidationError) throw new IpcValidationError(err.message)
      throw err
    }
  })
}

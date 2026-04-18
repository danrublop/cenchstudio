import type { IpcMain } from 'electron'
import {
  generateCanvas,
  generateMotion,
  generateThree,
  generateReact,
  GenerationValidationError,
} from '@/lib/services/generation'
import { IpcValidationError } from './_helpers'

/**
 * Category: generate
 *
 * Thin IPC wrappers around `lib/services/generation.ts`. One method per
 * scene type, each returning the same response shape as the corresponding
 * HTTP route so renderer callers can swap transports without adapting
 * response parsing.
 *
 * Covered: canvas, motion, three, react. Remaining:
 *   - lottie (has Lottie JSON validation + quality scoring)
 *   - d3     (has structured-generation runner)
 *   - the main `/api/generate` (enhance/summarize/edit variants)
 *   - generate-image / generate-video / generate-avatar (different APIs)
 */

function wrap<T extends (input: never) => unknown>(fn: T) {
  return async (_e: unknown, args: Parameters<T>[0]) => {
    try {
      return await fn(args)
    } catch (err) {
      if (err instanceof GenerationValidationError) throw new IpcValidationError(err.message)
      throw err
    }
  }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:generate.canvas', wrap(generateCanvas))
  ipcMain.handle('cench:generate.motion', wrap(generateMotion))
  ipcMain.handle('cench:generate.three', wrap(generateThree))
  ipcMain.handle('cench:generate.react', wrap(generateReact))
}

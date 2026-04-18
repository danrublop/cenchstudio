import type { IpcMain } from 'electron'
import {
  generateCanvas,
  generateMotion,
  generateThree,
  generateReact,
  generateLottie,
  generateD3,
  GenerationValidationError,
  LottieParseError,
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

/** Same pattern the HTTP routes use: strip long tokens + cap length so an
 *  accidental API-key leak or stack-trace noise doesn't reach the renderer. */
function sanitize(message: string): string {
  return message.replace(/[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]').slice(0, 200)
}

function wrap<T extends (input: never) => unknown>(fn: T) {
  return async (_e: unknown, args: Parameters<T>[0]) => {
    try {
      return await fn(args)
    } catch (err) {
      if (err instanceof GenerationValidationError) throw new IpcValidationError(err.message)
      // Lottie parse errors carry partial `usage` data — preserve it so the
      // renderer can still charge the user for the tokens already spent.
      if (err instanceof LottieParseError) {
        const e = new Error(err.message) as Error & { usage?: unknown }
        e.usage = err.usage
        throw e
      }
      // Scrub before rethrowing — same defense the HTTP routes apply. Without
      // this, provider SDK errors propagate raw to the renderer console.
      if (err instanceof Error) throw new Error(sanitize(err.message))
      throw err
    }
  }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:generate.canvas', wrap(generateCanvas))
  ipcMain.handle('cench:generate.motion', wrap(generateMotion))
  ipcMain.handle('cench:generate.three', wrap(generateThree))
  ipcMain.handle('cench:generate.react', wrap(generateReact))
  ipcMain.handle('cench:generate.lottie', wrap(generateLottie))
  ipcMain.handle('cench:generate.d3', wrap(generateD3))
}

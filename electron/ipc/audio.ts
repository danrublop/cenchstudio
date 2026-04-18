import type { IpcMain } from 'electron'
import { synthesizeTTS, searchSFX, searchMusic, AudioValidationError } from '@/lib/services/audio'
import { IpcValidationError } from './_helpers'

/**
 * Category: tts / sfx / music
 *
 * Thin IPC wrappers around the audio services in `lib/services/audio.ts`.
 * The same service functions power the HTTP routes (thin Next wrappers)
 * and the agent tool handlers in `lib/agents/tool-handlers/audio-tools.ts`
 * (direct calls — no fetch).
 *
 * AudioValidationError bubbles up as an IpcValidationError so the
 * renderer can distinguish input errors from server failures the
 * same way it did over HTTP 400 vs 500.
 */

function rethrowValidation<T extends (...a: never[]) => unknown>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (err) {
      if (err instanceof AudioValidationError) throw new IpcValidationError(err.message)
      throw err
    }
  }) as T
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle(
    'cench:tts.synthesize',
    rethrowValidation((_e, args: Parameters<typeof synthesizeTTS>[0]) => synthesizeTTS(args)),
  )
  ipcMain.handle(
    'cench:sfx.search',
    rethrowValidation((_e, args: Parameters<typeof searchSFX>[0]) => searchSFX(args)),
  )
  ipcMain.handle(
    'cench:music.search',
    rethrowValidation((_e, args: Parameters<typeof searchMusic>[0]) => searchMusic(args)),
  )
}

import type { IpcMain } from 'electron'
import { ingestUrl, ingestDirect, IngestValidationError, YtDlpMissingError } from '@/lib/services/ingest'
import { IpcValidationError } from './_helpers'

/**
 * Category: ingest
 *
 * Thin IPC wrappers over `lib/services/ingest.ts`:
 *   cench:ingest.fromUrl        → yt-dlp probe or download
 *   cench:ingest.fromDirectUrl  → fetch + optional transcode + DB insert
 *
 * Agent tool handlers already call the service directly (no fetch). These
 * IPC methods exist for the renderer — e.g. a future URL-paste import UI
 * that bypasses the HTTP layer in packaged builds.
 *
 * `YtDlpMissingError` is a 503-class condition (binary not installed), not
 * a caller mistake. Surface it as `IpcValidationError` anyway so the
 * renderer can show the install prompt in the same error UI.
 */

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('cench:ingest.fromUrl', async (_e, args: Parameters<typeof ingestUrl>[0]) => {
    try {
      return await ingestUrl(args)
    } catch (err) {
      if (err instanceof IngestValidationError) throw new IpcValidationError(err.message)
      if (err instanceof YtDlpMissingError) throw new IpcValidationError(`yt-dlp not installed: ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('cench:ingest.fromDirectUrl', async (_e, args: Parameters<typeof ingestDirect>[0]) => {
    try {
      return await ingestDirect(args)
    } catch (err) {
      if (err instanceof IngestValidationError) throw new IpcValidationError(err.message)
      throw err
    }
  })
}

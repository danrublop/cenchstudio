import type { IpcMain } from 'electron'
import * as settings from './settings'

/**
 * Central IPC registration. Each category module exports
 * `register(ipcMain)` and adds its own `ipcMain.handle()` entries.
 * Called once from `electron/main.ts` inside `app.whenReady()` after
 * the `cench://` protocol handler is registered.
 *
 * Channel naming convention: `cench:<category>.<method>` (dot-separated).
 * Stays under a single top-level prefix so renderer-side code is guarded
 * by one global trust boundary.
 */
export function registerAllIpc(ipcMain: IpcMain): void {
  settings.register(ipcMain)
}

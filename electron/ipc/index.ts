import type { IpcMain } from 'electron'
import * as settings from './settings'
import * as conversations from './conversations'
import * as usage from './usage'
import * as generationLog from './generation-log'
import * as permissions from './permissions'
import * as skills from './skills'
import * as projects from './projects'
import * as workspaces from './workspaces'
import * as publish from './publish'
import * as scene from './scene'
import * as media from './media'
import * as avatarConfigs from './avatar-configs'
import * as zdogLibrary from './zdog-library'
import * as audio from './audio'

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
  conversations.register(ipcMain)
  usage.register(ipcMain)
  generationLog.register(ipcMain)
  permissions.register(ipcMain)
  skills.register(ipcMain)
  projects.register(ipcMain)
  workspaces.register(ipcMain)
  publish.register(ipcMain)
  scene.register(ipcMain)
  media.register(ipcMain)
  avatarConfigs.register(ipcMain)
  zdogLibrary.register(ipcMain)
  audio.register(ipcMain)
}

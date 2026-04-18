import { app } from 'electron'
import path from 'node:path'

/**
 * Runtime-writable user data directories. Kept in one place so the
 * `cench://` protocol handler in main.ts and the IPC modules that
 * write to these dirs agree on the layout.
 */

export function getUserScenesDir(): string {
  return path.join(app.getPath('userData'), 'scenes')
}

export function getUserUploadsDir(): string {
  return path.join(app.getPath('userData'), 'uploads')
}

export function getUserAudioDir(): string {
  return path.join(app.getPath('userData'), 'audio')
}

export function getStaticAppDir(): string {
  // `__dirname` is `<Resources>/app.asar/dist-electron` in packaged builds
  // and `<repo>/dist-electron` in dev — both resolve `../out` correctly.
  return path.join(__dirname, '..', 'out')
}

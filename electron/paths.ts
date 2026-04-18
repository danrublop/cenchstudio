import { app } from 'electron'
import fsSync from 'node:fs'
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

// ── Export stitching dependencies (FFmpeg + stitcher.js) ─────────────────
// Packaged installs bundle render-server/stitcher.js and its required node
// modules into <Resources>/render-server via electron-builder's
// `extraResources`. Dev reads the same files directly from the repo. If any
// piece is missing (mispackaged build, user-deleted file), export fails deep
// inside a dynamic import() with ERR_MODULE_NOT_FOUND. Validate the whole
// chain up front so users see a clear error instead of a cryptic stack.

export function getRenderServerDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'render-server') : path.join(process.cwd(), 'render-server')
}

export function getStitcherPath(): string {
  return path.join(getRenderServerDir(), 'stitcher.js')
}

export type ExportDepsStatus = { ok: true } | { ok: false; missing: string[]; message: string }

let cachedStatus: ExportDepsStatus | null = null

export function validateExportDeps(forceRefresh = false): ExportDepsStatus {
  if (cachedStatus && !forceRefresh) return cachedStatus

  const renderServer = getRenderServerDir()
  const required: Array<{ label: string; abs: string }> = [
    { label: 'stitcher.js', abs: getStitcherPath() },
    { label: 'fluent-ffmpeg', abs: path.join(renderServer, 'node_modules', 'fluent-ffmpeg') },
    { label: 'ffmpeg-static', abs: path.join(renderServer, 'node_modules', 'ffmpeg-static') },
  ]

  const missing = required.filter((r) => !fsSync.existsSync(r.abs)).map((r) => r.label)

  if (missing.length === 0) {
    cachedStatus = { ok: true }
  } else {
    const hint = app.isPackaged
      ? 'The Cench installation appears incomplete. Reinstalling the app from the original download should restore it.'
      : `Run \`npm install\` inside \`render-server/\` to fetch the FFmpeg dependencies. (expected at ${renderServer})`
    cachedStatus = {
      ok: false,
      missing,
      message: `Export dependencies missing: ${missing.join(', ')}.\n\n${hint}`,
    }
  }
  return cachedStatus
}

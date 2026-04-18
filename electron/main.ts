import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { app, BrowserWindow, ipcMain, dialog, Menu, net, protocol, screen, session, shell } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import { pathToFileURL } from 'url'
import { config as loadDotenv } from 'dotenv'
import { registerAllIpc } from './ipc'

// ── .env loading ────────────────────────────────────────────────────────────
// The main process does not inherit the Next.js auto-dotenv behavior. Without
// this, `process.env.DATABASE_URL`, `ANTHROPIC_API_KEY`, etc. are empty in the
// packaged `.dmg` (no shell env) and `cench:settings.listProviders` /
// `cench:conversations.*` both fail immediately.
//
// Resolution order:
//   1. Dev: `<repoRoot>/.env.local`, then `<repoRoot>/.env`.
//   2. Packaged: `<userData>/cench.env` (user-provided keys), then
//      `<Resources>/.env.defaults` (bundled defaults, if any).
// `.env.local` overrides `.env` the same way Next.js orders them.
function loadEnvFiles(): void {
  const attempted: string[] = []
  const tryLoad = (p: string) => {
    attempted.push(p)
    if (fsSync.existsSync(p)) {
      loadDotenv({ path: p, override: false })
    }
  }
  if (app.isPackaged) {
    tryLoad(path.join(app.getPath('userData'), 'cench.env'))
    tryLoad(path.join(process.resourcesPath, '.env.defaults'))
  } else {
    const repoRoot = path.resolve(__dirname, '..')
    tryLoad(path.join(repoRoot, '.env.local'))
    tryLoad(path.join(repoRoot, '.env'))
  }
}
loadEnvFiles()

const execFileAsync = promisify(execFile)

function webZoomTargetWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

// Dev-mode only. In packaged builds the renderer loads `cench://app/index.html`
// via the protocol handler registered below — no HTTP server is ever reached.
const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000'

// Runtime-writable scene HTML directory. In the packaged app, scenes cannot
// be written back into the read-only `out/` bundle, so we split:
//   cench://app/...     → Next static export (read-only bundle)
//   cench://scenes/...  → user-data directory (writable at runtime)
function getUserScenesDir(): string {
  return path.join(app.getPath('userData'), 'scenes')
}

function getStaticAppDir(): string {
  // In dev this resolves to `<repo>/out`. In the packaged app, `__dirname`
  // is `<Resources>/app.asar/dist-electron`, so `../out` resolves to
  // `<Resources>/app.asar/out`. Electron's fs layer reads through the asar
  // transparently, so no separate packaged branch is needed.
  return path.join(__dirname, '..', 'out')
}

// Privileged scheme must be registered synchronously before `app.ready`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cench',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

async function registerCenchProtocol(): Promise<void> {
  const staticDir = path.resolve(getStaticAppDir())
  const scenesDir = path.resolve(getUserScenesDir())
  await fs.mkdir(scenesDir, { recursive: true })

  protocol.handle('cench', async (request) => {
    try {
      const url = new URL(request.url)
      const host = url.hostname
      const rawPath = decodeURIComponent(url.pathname).replace(/^\/+/, '')

      let baseDir: string
      if (host === 'scenes') {
        baseDir = scenesDir
      } else if (host === 'app' || host === '') {
        baseDir = staticDir
      } else {
        return new Response(`Unknown cench:// host "${host}"`, { status: 404 })
      }

      let filePath = path.resolve(baseDir, rawPath || 'index.html')
      if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) {
        return new Response('Forbidden', { status: 403 })
      }

      // Fall through to index.html for directory paths
      try {
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) filePath = path.join(filePath, 'index.html')
      } catch {
        // Next.js static export writes `foo.html` for `/foo` — try that too
        if (!filePath.endsWith('.html')) {
          const htmlVariant = `${filePath}.html`
          try {
            await fs.access(htmlVariant)
            filePath = htmlVariant
          } catch {}
        }
      }

      // Re-check after realpath so a symlink planted inside the
      // user-writable scenes directory cannot escape the mount root
      // (e.g., `cench://scenes/evil` → `/etc/passwd`). The privileged
      // `secure: true` scheme means a renderer fetch on that URL would
      // otherwise read an arbitrary file through the Chromium net stack.
      try {
        const realPath = await fs.realpath(filePath)
        if (!realPath.startsWith(baseDir + path.sep) && realPath !== baseDir) {
          return new Response('Forbidden (symlink escape)', { status: 403 })
        }
        filePath = realPath
      } catch {
        // File may not exist yet (falls through to net.fetch which returns 404).
      }

      return net.fetch(pathToFileURL(filePath).toString())
    } catch (err) {
      console.error('[cench-protocol] failed to serve', request.url, err)
      return new Response('Internal error', { status: 500 })
    }
  })
}

function sanitizeFilename(hint: string, fallback = 'recording'): string {
  return (
    (hint || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || fallback
  )
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    backgroundColor: '#0b0b0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  const appUrl = app.isPackaged ? 'cench://app/index.html' : DEV_URL
  win.loadURL(appUrl)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => {
            const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const store = window.__cenchStore;
                if (store) { store.setState({ project: { ...store.getState().project, id: '' } }); window.location.href = '/'; }
              })()
            `)
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                  document.execCommand('undo');
                } else {
                  window.__cenchStore?.getState()?.undo?.();
                }
              })()
            `)
          },
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => {
            const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                  document.execCommand('redo');
                } else {
                  window.__cenchStore?.getState()?.redo?.();
                }
              })()
            `)
          },
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(process.platform === 'darwin'
          ? [{ role: 'pasteAndMatchStyle' as const }, { role: 'delete' as const }, { role: 'selectAll' as const }]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Preview Fullscreen',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const s = window.__cenchStore?.getState();
                if (s) s.setPreviewFullscreen(!s.isPreviewFullscreen);
              })()
            `)
          },
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Documentation',
      click: () => {
        shell.openExternal(`${DEV_URL.replace(/\/$/, '')}/docs`)
      },
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  ipcMain.handle('cench:gitStatus', async () => {
    // Dev-only: `process.cwd()` in a packaged app is the launch directory
    // (usually `/`), so `git` would silently return an irrelevant status.
    // The git indicator is a dev affordance; hide it entirely in production.
    if (app.isPackaged) {
      return { ok: false as const, branch: null as string | null, dirty: false }
    }
    const cwd = process.cwd()
    try {
      const { stdout: branchOut } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd,
        timeout: 8000,
        maxBuffer: 1024 * 1024,
      })
      const { stdout: por } = await execFileAsync('git', ['status', '--porcelain'], {
        cwd,
        timeout: 8000,
        maxBuffer: 1024 * 1024,
      })
      const branch = branchOut.trim()
      if (!branch) return { ok: false as const, branch: null as string | null, dirty: false }
      return { ok: true as const, branch, dirty: por.trim().length > 0 }
    } catch {
      return { ok: false as const, branch: null as string | null, dirty: false }
    }
  })

  ipcMain.handle('cench:webZoomIn', () => {
    const win = webZoomTargetWindow()
    if (!win) return { ok: false as const, factor: 1 }
    const z = win.webContents.getZoomFactor()
    const next = Math.min(3, Math.round((z + 0.1) * 100) / 100)
    win.webContents.setZoomFactor(next)
    return { ok: true as const, factor: win.webContents.getZoomFactor() }
  })

  ipcMain.handle('cench:webZoomOut', () => {
    const win = webZoomTargetWindow()
    if (!win) return { ok: false as const, factor: 1 }
    const z = win.webContents.getZoomFactor()
    const next = Math.max(0.5, Math.round((z - 0.1) * 100) / 100)
    win.webContents.setZoomFactor(next)
    return { ok: true as const, factor: win.webContents.getZoomFactor() }
  })

  ipcMain.handle('cench:webZoomReset', () => {
    const win = webZoomTargetWindow()
    if (!win) return { ok: false as const, factor: 1 }
    win.webContents.setZoomFactor(1)
    return { ok: true as const, factor: 1 }
  })

  ipcMain.handle(
    'cench:capturePage',
    async (_evt, args?: { rect?: { x: number; y: number; width: number; height: number } }) => {
      const win = webZoomTargetWindow()
      if (!win) return { ok: false as const, error: 'no window' }
      try {
        const image = args?.rect ? await win.webContents.capturePage(args.rect) : await win.webContents.capturePage()
        const dataUri = image.toDataURL()
        return { ok: true as const, dataUri, mimeType: 'image/png' }
      } catch (err) {
        return { ok: false as const, error: (err as Error).message }
      }
    },
  )

  ipcMain.handle('cench:saveDialog', async (_evt, suggestedName?: string) => {
    const res = await dialog.showSaveDialog({
      title: 'Save exported video',
      defaultPath: suggestedName || `export-${Date.now()}.mp4`,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    })
    return { canceled: res.canceled, filePath: res.filePath ?? null }
  })

  ipcMain.handle('cench:writeFile', async (_evt, args: { filePath: string; bytes: ArrayBuffer }) => {
    await fs.mkdir(path.dirname(args.filePath), { recursive: true })
    await fs.writeFile(args.filePath, Buffer.from(args.bytes))
    return { ok: true }
  })

  ipcMain.handle(
    'cench:saveRecording',
    async (_evt, args: { bytes: ArrayBuffer; extension?: string; nameHint?: string }) => {
      const extRaw = (args.extension || 'webm').toLowerCase().replace(/[^a-z0-9]/g, '')
      const ext = extRaw || 'webm'
      const dir = path.join(app.getPath('userData'), 'recordings')
      await fs.mkdir(dir, { recursive: true })
      const safeBase = sanitizeFilename(args.nameHint || '')
      const filePath = path.join(dir, `${safeBase}-${Date.now()}.${ext}`)
      await fs.writeFile(filePath, Buffer.from(args.bytes))
      const fileUrl = pathToFileURL(filePath).href
      return { ok: true, filePath, fileUrl }
    },
  )

  ipcMain.handle(
    'cench:concatMp4',
    async (
      _evt,
      args: {
        inputs: string[]
        output: string
        cleanup?: boolean
        transitions?: Array<{ type: string; duration?: number }>
      },
    ) => {
      const inputs = (args.inputs ?? []).filter(Boolean)
      if (inputs.length === 0) throw new Error('concatMp4: no input files')
      if (inputs.length === 1) {
        await fs.copyFile(inputs[0], args.output)
        if (args.cleanup) {
          await fs.unlink(inputs[0]).catch(() => {})
        }
        return { ok: true }
      }

      const transitions = args.transitions ?? []
      try {
        // Resolve the stitcher across dev + packaged layouts. In dev the file
        // lives at <repo>/render-server/stitcher.js. In the packaged app,
        // electron-builder copies it to <Resources>/render-server/stitcher.js
        // via `extraResources`. `process.cwd()` is unreliable in the packaged
        // app (it's the launch dir, often `/`), so branch on `app.isPackaged`.
        //
        // stitcher.js is an ES module (render-server/package.json has
        // `"type": "module"`), so require() throws ERR_REQUIRE_ESM. Use
        // dynamic `import(pathToFileURL(...))` instead.
        const stitcherPath = app.isPackaged
          ? path.join(process.resourcesPath, 'render-server', 'stitcher.js')
          : path.join(process.cwd(), 'render-server', 'stitcher.js')
        const mod = (await import(pathToFileURL(stitcherPath).href)) as {
          stitchScenes?: (v: string[], t: Array<{ type: string; duration: number }>, o: string) => Promise<void>
        }
        const stitchScenes = mod?.stitchScenes
        if (typeof stitchScenes !== 'function') {
          throw new Error('stitchScenes() not found in render-server/stitcher.js')
        }
        const stitchedTransitions = Array.from({ length: Math.max(0, inputs.length - 1) }, (_v, i) => ({
          type: transitions[i]?.type ?? 'none',
          duration: transitions[i]?.duration ?? 0.5,
        }))
        await stitchScenes(inputs, stitchedTransitions, args.output)
      } finally {
        if (args.cleanup) {
          await Promise.all(inputs.map((p) => fs.unlink(p).catch(() => {})))
        }
      }
      return { ok: true }
    },
  )

  // ── Desktop source enumeration ────────────────────────────────────
  // getSources removed — using getDisplayMedia() in renderer instead

  // ── Cursor telemetry ─────────────────────────────────────────────
  const MAX_CURSOR_SAMPLES = 36_000 // ~60 hours at 10 Hz
  let cursorInterval: ReturnType<typeof setInterval> | null = null
  let cursorSamples: Array<{ t: number; x: number; y: number }> = []
  let cursorStartTime = 0
  let cursorSourceDisplay: Electron.Display | null = null

  ipcMain.handle('cench:startCursorTelemetry', (_evt, args?: { displayId?: string }) => {
    cursorSamples = []
    cursorStartTime = Date.now()
    // Resolve display once at start (avoid repeated lookups in interval)
    cursorSourceDisplay = null
    if (args?.displayId) {
      const numId = Number(args.displayId)
      const all = screen.getAllDisplays()
      cursorSourceDisplay = all.find((d) => d.id === numId || String(d.id) === args.displayId) ?? null
    }
    cursorInterval = setInterval(() => {
      const point = screen.getCursorScreenPoint()
      const display = cursorSourceDisplay ?? screen.getDisplayNearestPoint(point)
      const { x, y, width, height } = display.bounds
      // Clamp to [0, 1]
      const nx = Math.max(0, Math.min(1, (point.x - x) / width))
      const ny = Math.max(0, Math.min(1, (point.y - y) / height))
      if (cursorSamples.length >= MAX_CURSOR_SAMPLES) {
        cursorSamples.shift() // Circular buffer
      }
      cursorSamples.push({ t: Date.now() - cursorStartTime, x: nx, y: ny })
    }, 100) // 10 Hz
    return { ok: true as const }
  })

  ipcMain.handle('cench:stopCursorTelemetry', () => {
    if (cursorInterval) {
      clearInterval(cursorInterval)
      cursorInterval = null
    }
    cursorSourceDisplay = null
    const samples = cursorSamples
    cursorSamples = []
    return { samples }
  })

  // ── Save recording session (screen + optional webcam) ────────────
  ipcMain.handle(
    'cench:saveRecordingSession',
    async (_evt, args: { screenBytes: ArrayBuffer; webcamBytes?: ArrayBuffer; nameHint?: string }) => {
      // Validate screen recording is non-empty
      if (!args.screenBytes || args.screenBytes.byteLength === 0) {
        throw new Error('Screen recording is empty — nothing to save')
      }

      const dir = path.join(app.getPath('userData'), 'recordings')
      await fs.mkdir(dir, { recursive: true })
      const ts = Date.now()
      const safeBase = sanitizeFilename(args.nameHint || '')

      const writtenFiles: string[] = []
      try {
        const screenPath = path.join(dir, `${safeBase}-${ts}.webm`)
        await fs.writeFile(screenPath, Buffer.from(args.screenBytes))
        writtenFiles.push(screenPath)

        const result: any = {
          screenVideoPath: screenPath,
          screenVideoUrl: pathToFileURL(screenPath).href,
          createdAt: ts,
        }

        if (args.webcamBytes && args.webcamBytes.byteLength > 0) {
          const webcamPath = path.join(dir, `${safeBase}-${ts}-webcam.webm`)
          await fs.writeFile(webcamPath, Buffer.from(args.webcamBytes))
          writtenFiles.push(webcamPath)
          result.webcamVideoPath = webcamPath
          result.webcamVideoUrl = pathToFileURL(webcamPath).href
        }

        // Save session manifest
        const manifestPath = path.join(dir, `${safeBase}-${ts}.session.json`)
        await fs.writeFile(manifestPath, JSON.stringify(result, null, 2))

        return result
      } catch (err) {
        // Clean up partially written files on failure
        await Promise.all(writtenFiles.map((f) => fs.unlink(f).catch(() => {})))
        throw err
      }
    },
  )

  // ── Media permission handlers (required for recording sources) ────
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'audioCapture', 'microphone', 'videoCapture', 'camera']
    return allowed.includes(permission)
  })

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'audioCapture', 'microphone', 'videoCapture', 'camera']
    callback(allowed.includes(permission))
  })

  await registerCenchProtocol()
  registerAllIpc(ipcMain)

  createWindow()

  // ── Allow screen/window capture via getDisplayMedia in renderer ────
  // Use the native macOS system picker (desktopCapturer.getSources is broken in Electron 41)
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    console.log('[Electron] setDisplayMediaRequestHandler called')
    console.log('[Electron]   videoRequested:', !!request.videoRequested)
    console.log('[Electron]   audioRequested:', !!request.audioRequested)
    console.log('[Electron]   frame:', request.frame?.url?.slice(0, 80))
    try {
      ;(callback as any)({}, { useSystemPicker: true })
      console.log('[Electron]   callback invoked with useSystemPicker: true')
    } catch (err: any) {
      console.error('[Electron]   callback error:', err.message)
      ;(callback as any)(null)
    }
  })

  // Export API server (port 3002, HTTP) removed in the True Desktop migration.
  // See SHIP_READINESS.md and the Week 1 plan — operations re-expose as IPC later.

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

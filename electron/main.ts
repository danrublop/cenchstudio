import path from 'path'
import http from 'http'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { app, BrowserWindow, ipcMain, dialog, Menu, screen, session, shell } from 'electron'
import fs from 'fs/promises'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)

function webZoomTargetWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000'
const EXPORT_API_PORT = 3002

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

  win.loadURL(DEV_URL)
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
            if (w) w.webContents.executeJavaScript(`
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
            if (w) w.webContents.executeJavaScript(`
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
            if (w) w.webContents.executeJavaScript(`
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
            if (w) w.webContents.executeJavaScript(`
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

app.whenReady().then(() => {
  ipcMain.handle('cench:gitStatus', async () => {
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
        // Reuse existing transition-aware stitcher implementation.
        // Use require() since Electron main process is CommonJS.
        const stitcherPath = path.join(process.cwd(), 'render-server', 'stitcher.js')
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(stitcherPath)
        const stitchScenes = mod?.stitchScenes as
          | undefined
          | ((v: string[], t: Array<{ type: string; duration: number }>, o: string) => Promise<void>)
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
    async (
      _evt,
      args: { screenBytes: ArrayBuffer; webcamBytes?: ArrayBuffer; nameHint?: string },
    ) => {
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

  // ── Export API server ──────────────────────────────────────────────
  // Allows triggering Electron-path exports via HTTP:
  //   POST http://localhost:3002/export
  //   { projectId, outputPath?, resolution?, fps?, profile? }
  const exportServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const json = (data: any, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }

    const getWin = () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) { json({ error: 'No Electron window available' }, 503); return null }
      return win
    }

    if (req.method === 'GET' && req.url === '/health') {
      return json({ status: 'ok', type: 'electron-export' })
    }

    // ── Recording endpoints ──────────────────────────────────────────
    if (req.method === 'GET' && req.url === '/recording/sources') {
      return json({ sources: [], note: 'Source selection now uses native OS picker via getDisplayMedia()' })
    }

    if (req.method === 'GET' && req.url === '/recording/status') {
      const win = getWin(); if (!win) return
      try {
        const result = await win.webContents.executeJavaScript(`
          (() => {
            const s = window.__cenchStore.getState();
            return {
              state: s.recordingState,
              elapsed: s.recordingElapsed,
              config: s.recordingConfig,
              error: s.recordingError,
              result: s.recordingResult,
            };
          })()
        `)
        return json(result)
      } catch (err: any) {
        return json({ error: err.message }, 500)
      }
    }

    if (req.method === 'GET' && req.url === '/recording/sessions') {
      try {
        const dir = path.join(app.getPath('userData'), 'recordings')
        const files = await fs.readdir(dir).catch(() => [] as string[])
        const sessions = []
        for (const f of files) {
          if (!f.endsWith('.session.json')) continue
          try {
            const data = JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8'))
            sessions.push(data)
          } catch { /* skip corrupt manifests */ }
        }
        sessions.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
        return json({ sessions })
      } catch (err: any) {
        return json({ error: err.message }, 500)
      }
    }

    // POST recording endpoints — parse body
    if (req.method === 'POST' && req.url?.startsWith('/recording/')) {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      let body: any = {}
      try { body = JSON.parse(Buffer.concat(chunks).toString()) } catch { /* empty body OK */ }
      const win = getWin(); if (!win) return

      const action = req.url.replace('/recording/', '')
      try {
        if (action === 'start') {
          const configJson = JSON.stringify(body.config || body || {})
          const sceneId = body.sceneId ? JSON.stringify(body.sceneId) : 'null'
          const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'idle') return { error: 'Recording already active', state: s.recordingState };
              s.setRecordingConfig(${configJson});
              s.setRecordingAttachSceneId(${sceneId});
              s.setRecordingCommand('start');
              return { ok: true };
            })()
          `)
          return json(result, result.error ? 409 : 200)
        }
        if (action === 'stop') {
          const sceneId = body.sceneId ? JSON.stringify(body.sceneId) : 'null'
          const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'recording' && s.recordingState !== 'paused')
                return { error: 'No active recording', state: s.recordingState };
              if (${sceneId}) s.setRecordingAttachSceneId(${sceneId});
              s.setRecordingCommand('stop');
              return { ok: true };
            })()
          `)
          return json(result, result.error ? 409 : 200)
        }
        if (action === 'pause') {
          const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'recording') return { error: 'Not recording', state: s.recordingState };
              s.setRecordingCommand('pause');
              return { ok: true };
            })()
          `)
          return json(result, result.error ? 409 : 200)
        }
        if (action === 'resume') {
          const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'paused') return { error: 'Not paused', state: s.recordingState };
              s.setRecordingCommand('resume');
              return { ok: true };
            })()
          `)
          return json(result, result.error ? 409 : 200)
        }
        if (action === 'cancel') {
          const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              s.setRecordingCommand('cancel');
              return { ok: true };
            })()
          `)
          return json(result)
        }
        return json({ error: `Unknown recording action: ${action}` }, 404)
      } catch (err: any) {
        return json({ error: err.message || 'Recording command failed' }, 500)
      }
    }

    // ── Export endpoint ───────────────────────────────────────────────
    if (req.method !== 'POST' || !req.url?.startsWith('/export')) {
      return json({ error: 'Not found' }, 404)
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    let body: any
    try {
      body = JSON.parse(Buffer.concat(chunks).toString())
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const { projectId, outputPath, resolution = '1080p', fps = 30, profile = 'quality' } = body
    if (!projectId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'projectId is required' }))
      return
    }

    const finalOutput = outputPath || path.join(app.getPath('temp'), `cench-export-${Date.now()}.mp4`)
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'No Electron window available' }))
      return
    }

    try {
      // Navigate to the project and wait for store to load scenes
      const result = await win.webContents.executeJavaScript(`
        (async () => {
          const store = window.__cenchStore;
          if (!store) throw new Error('Store not ready');

          // Load project if not already active
          if (!store.getState().project || store.getState().project.id !== '${projectId}') {
            await store.getState().loadProject('${projectId}');
            await new Promise(r => setTimeout(r, 1000));
          }

          const scenes = store.getState().scenes;
          if (scenes.length === 0) throw new Error('No scenes loaded');

          // Ensure all scene HTML files are written to disk
          for (const s of scenes) {
            await store.getState().saveSceneHTML(s.id, true);
          }
          await new Promise(r => setTimeout(r, 300));

          // Trigger export — outputPath skips save dialog
          await store.getState().exportVideo({
            resolution: '${resolution}',
            fps: ${fps},
            format: 'mp4',
            profile: '${profile}',
            outputPath: ${JSON.stringify(finalOutput)},
          });

          const p = store.getState().exportProgress;
          return {
            success: p?.phase === 'complete',
            phase: p?.phase,
            error: p?.error,
            diagnostics: p?.diagnostics?.slice(-10),
          };
        })()
      `)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ...result, outputPath: finalOutput }))
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || String(err) }))
    }
  })

  exportServer.listen(EXPORT_API_PORT, '127.0.0.1', () => {
    console.log(`[Electron] Export API listening on http://127.0.0.1:${EXPORT_API_PORT}`)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

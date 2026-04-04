import path from 'path'
import http from 'http'
import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import fs from 'fs/promises'
import { pathToFileURL } from 'url'

const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000'
const EXPORT_API_PORT = 3002

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    backgroundColor: '#0b0b0f',
    titleBarStyle: 'hiddenInset',
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
      submenu: [{ role: 'close' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
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
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
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
      const safeBase =
        (args.nameHint || 'recording')
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 100) || 'recording'
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

  createWindow()

  // ── Export API server ──────────────────────────────────────────────
  // Allows triggering Electron-path exports via HTTP:
  //   POST http://localhost:3002/export
  //   { projectId, outputPath?, resolution?, fps?, profile? }
  const exportServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', type: 'electron-export' }))
      return
    }

    if (req.method !== 'POST' || !req.url?.startsWith('/export')) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found. Use POST /export' }))
      return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    let body: any
    try {
      body = JSON.parse(Buffer.concat(chunks).toString())
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      return
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

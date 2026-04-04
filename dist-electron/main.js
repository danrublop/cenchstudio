"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const electron_1 = require("electron");
const promises_1 = __importDefault(require("fs/promises"));
const url_1 = require("url");
const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
const EXPORT_API_PORT = 3002;
electron_1.app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1600,
        height: 960,
        backgroundColor: '#0b0b0f',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            autoplayPolicy: 'no-user-gesture-required',
        },
    });
    win.loadURL(DEV_URL);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const template = [
        ...(process.platform === 'darwin'
            ? [{
                    label: electron_1.app.name,
                    submenu: [
                        { role: 'about' },
                        { type: 'separator' },
                        { role: 'services' },
                        { type: 'separator' },
                        { role: 'hide' },
                        { role: 'hideOthers' },
                        { role: 'unhide' },
                        { type: 'separator' },
                        { role: 'quit' },
                    ],
                }]
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
                    ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }]
                    : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
            ],
        },
        {
            label: 'View',
            submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }],
        },
        {
            label: 'Documentation',
            click: () => {
                electron_1.shell.openExternal(`${DEV_URL.replace(/\/$/, '')}/docs`);
            },
        },
        {
            role: 'window',
            submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])],
        },
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
electron_1.app.whenReady().then(() => {
    electron_1.ipcMain.handle('cench:saveDialog', async (_evt, suggestedName) => {
        const res = await electron_1.dialog.showSaveDialog({
            title: 'Save exported video',
            defaultPath: suggestedName || `export-${Date.now()}.mp4`,
            filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
        });
        return { canceled: res.canceled, filePath: res.filePath ?? null };
    });
    electron_1.ipcMain.handle('cench:writeFile', async (_evt, args) => {
        await promises_1.default.mkdir(path_1.default.dirname(args.filePath), { recursive: true });
        await promises_1.default.writeFile(args.filePath, Buffer.from(args.bytes));
        return { ok: true };
    });
    electron_1.ipcMain.handle('cench:saveRecording', async (_evt, args) => {
        const extRaw = (args.extension || 'webm').toLowerCase().replace(/[^a-z0-9]/g, '');
        const ext = extRaw || 'webm';
        const dir = path_1.default.join(electron_1.app.getPath('userData'), 'recordings');
        await promises_1.default.mkdir(dir, { recursive: true });
        const safeBase = (args.nameHint || 'recording')
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 100) || 'recording';
        const filePath = path_1.default.join(dir, `${safeBase}-${Date.now()}.${ext}`);
        await promises_1.default.writeFile(filePath, Buffer.from(args.bytes));
        const fileUrl = (0, url_1.pathToFileURL)(filePath).href;
        return { ok: true, filePath, fileUrl };
    });
    electron_1.ipcMain.handle('cench:concatMp4', async (_evt, args) => {
        const inputs = (args.inputs ?? []).filter(Boolean);
        if (inputs.length === 0)
            throw new Error('concatMp4: no input files');
        if (inputs.length === 1) {
            await promises_1.default.copyFile(inputs[0], args.output);
            if (args.cleanup) {
                await promises_1.default.unlink(inputs[0]).catch(() => { });
            }
            return { ok: true };
        }
        const transitions = args.transitions ?? [];
        try {
            // Reuse existing transition-aware stitcher implementation.
            // Use require() since Electron main process is CommonJS.
            const stitcherPath = path_1.default.join(process.cwd(), 'render-server', 'stitcher.js');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require(stitcherPath);
            const stitchScenes = mod?.stitchScenes;
            if (typeof stitchScenes !== 'function') {
                throw new Error('stitchScenes() not found in render-server/stitcher.js');
            }
            const stitchedTransitions = Array.from({ length: Math.max(0, inputs.length - 1) }, (_v, i) => ({
                type: transitions[i]?.type ?? 'none',
                duration: transitions[i]?.duration ?? 0.5,
            }));
            await stitchScenes(inputs, stitchedTransitions, args.output);
        }
        finally {
            if (args.cleanup) {
                await Promise.all(inputs.map((p) => promises_1.default.unlink(p).catch(() => { })));
            }
        }
        return { ok: true };
    });
    createWindow();
    // ── Export API server ──────────────────────────────────────────────
    // Allows triggering Electron-path exports via HTTP:
    //   POST http://localhost:3002/export
    //   { projectId, outputPath?, resolution?, fps?, profile? }
    const exportServer = http_1.default.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.method === 'GET' && req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', type: 'electron-export' }));
            return;
        }
        if (req.method !== 'POST' || !req.url?.startsWith('/export')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found. Use POST /export' }));
            return;
        }
        const chunks = [];
        for await (const chunk of req)
            chunks.push(Buffer.from(chunk));
        let body;
        try {
            body = JSON.parse(Buffer.concat(chunks).toString());
        }
        catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
        }
        const { projectId, outputPath, resolution = '1080p', fps = 30, profile = 'quality' } = body;
        if (!projectId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'projectId is required' }));
            return;
        }
        const finalOutput = outputPath || path_1.default.join(electron_1.app.getPath('temp'), `cench-export-${Date.now()}.mp4`);
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (!win) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No Electron window available' }));
            return;
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
      `);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...result, outputPath: finalOutput }));
        }
        catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || String(err) }));
        }
    });
    exportServer.listen(EXPORT_API_PORT, '127.0.0.1', () => {
        console.log(`[Electron] Export API listening on http://127.0.0.1:${EXPORT_API_PORT}`);
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});

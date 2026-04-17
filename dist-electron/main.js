"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const electron_1 = require("electron");
const promises_1 = __importDefault(require("fs/promises"));
const url_1 = require("url");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function webZoomTargetWindow() {
    return electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0] ?? null;
}
const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
const EXPORT_API_PORT = 3002;
function sanitizeFilename(hint, fallback = 'recording') {
    return ((hint || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100) || fallback);
}
electron_1.app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1600,
        height: 960,
        backgroundColor: '#0b0b0f',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 12, y: 16 },
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
            ? [
                {
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
                        const w = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0];
                        if (w)
                            w.webContents.executeJavaScript(`
              (() => {
                const store = window.__cenchStore;
                if (store) { store.setState({ project: { ...store.getState().project, id: '' } }); window.location.href = '/'; }
              })()
            `);
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
                        const w = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0];
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
            `);
                    },
                },
                {
                    label: 'Redo',
                    accelerator: 'CmdOrCtrl+Shift+Z',
                    click: () => {
                        const w = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0];
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
            `);
                    },
                },
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
            submenu: [
                {
                    label: 'Toggle Preview Fullscreen',
                    accelerator: 'CmdOrCtrl+Shift+F',
                    click: () => {
                        const w = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0];
                        if (w)
                            w.webContents.executeJavaScript(`
              (() => {
                const s = window.__cenchStore?.getState();
                if (s) s.setPreviewFullscreen(!s.isPreviewFullscreen);
              })()
            `);
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
                electron_1.shell.openExternal(`${DEV_URL.replace(/\/$/, '')}/docs`);
            },
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(process.platform === 'darwin'
                    ? [{ type: 'separator' }, { role: 'front' }]
                    : [{ role: 'close' }]),
            ],
        },
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
electron_1.app.whenReady().then(() => {
    electron_1.ipcMain.handle('cench:gitStatus', async () => {
        const cwd = process.cwd();
        try {
            const { stdout: branchOut } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                cwd,
                timeout: 8000,
                maxBuffer: 1024 * 1024,
            });
            const { stdout: por } = await execFileAsync('git', ['status', '--porcelain'], {
                cwd,
                timeout: 8000,
                maxBuffer: 1024 * 1024,
            });
            const branch = branchOut.trim();
            if (!branch)
                return { ok: false, branch: null, dirty: false };
            return { ok: true, branch, dirty: por.trim().length > 0 };
        }
        catch {
            return { ok: false, branch: null, dirty: false };
        }
    });
    electron_1.ipcMain.handle('cench:webZoomIn', () => {
        const win = webZoomTargetWindow();
        if (!win)
            return { ok: false, factor: 1 };
        const z = win.webContents.getZoomFactor();
        const next = Math.min(3, Math.round((z + 0.1) * 100) / 100);
        win.webContents.setZoomFactor(next);
        return { ok: true, factor: win.webContents.getZoomFactor() };
    });
    electron_1.ipcMain.handle('cench:webZoomOut', () => {
        const win = webZoomTargetWindow();
        if (!win)
            return { ok: false, factor: 1 };
        const z = win.webContents.getZoomFactor();
        const next = Math.max(0.5, Math.round((z - 0.1) * 100) / 100);
        win.webContents.setZoomFactor(next);
        return { ok: true, factor: win.webContents.getZoomFactor() };
    });
    electron_1.ipcMain.handle('cench:webZoomReset', () => {
        const win = webZoomTargetWindow();
        if (!win)
            return { ok: false, factor: 1 };
        win.webContents.setZoomFactor(1);
        return { ok: true, factor: 1 };
    });
    electron_1.ipcMain.handle('cench:capturePage', async (_evt, args) => {
        const win = webZoomTargetWindow();
        if (!win)
            return { ok: false, error: 'no window' };
        try {
            const image = args?.rect ? await win.webContents.capturePage(args.rect) : await win.webContents.capturePage();
            const dataUri = image.toDataURL();
            return { ok: true, dataUri, mimeType: 'image/png' };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    });
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
        const safeBase = sanitizeFilename(args.nameHint || '');
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
    // ── Desktop source enumeration ────────────────────────────────────
    // getSources removed — using getDisplayMedia() in renderer instead
    // ── Cursor telemetry ─────────────────────────────────────────────
    const MAX_CURSOR_SAMPLES = 36_000; // ~60 hours at 10 Hz
    let cursorInterval = null;
    let cursorSamples = [];
    let cursorStartTime = 0;
    let cursorSourceDisplay = null;
    electron_1.ipcMain.handle('cench:startCursorTelemetry', (_evt, args) => {
        cursorSamples = [];
        cursorStartTime = Date.now();
        // Resolve display once at start (avoid repeated lookups in interval)
        cursorSourceDisplay = null;
        if (args?.displayId) {
            const numId = Number(args.displayId);
            const all = electron_1.screen.getAllDisplays();
            cursorSourceDisplay = all.find((d) => d.id === numId || String(d.id) === args.displayId) ?? null;
        }
        cursorInterval = setInterval(() => {
            const point = electron_1.screen.getCursorScreenPoint();
            const display = cursorSourceDisplay ?? electron_1.screen.getDisplayNearestPoint(point);
            const { x, y, width, height } = display.bounds;
            // Clamp to [0, 1]
            const nx = Math.max(0, Math.min(1, (point.x - x) / width));
            const ny = Math.max(0, Math.min(1, (point.y - y) / height));
            if (cursorSamples.length >= MAX_CURSOR_SAMPLES) {
                cursorSamples.shift(); // Circular buffer
            }
            cursorSamples.push({ t: Date.now() - cursorStartTime, x: nx, y: ny });
        }, 100); // 10 Hz
        return { ok: true };
    });
    electron_1.ipcMain.handle('cench:stopCursorTelemetry', () => {
        if (cursorInterval) {
            clearInterval(cursorInterval);
            cursorInterval = null;
        }
        cursorSourceDisplay = null;
        const samples = cursorSamples;
        cursorSamples = [];
        return { samples };
    });
    // ── Save recording session (screen + optional webcam) ────────────
    electron_1.ipcMain.handle('cench:saveRecordingSession', async (_evt, args) => {
        // Validate screen recording is non-empty
        if (!args.screenBytes || args.screenBytes.byteLength === 0) {
            throw new Error('Screen recording is empty — nothing to save');
        }
        const dir = path_1.default.join(electron_1.app.getPath('userData'), 'recordings');
        await promises_1.default.mkdir(dir, { recursive: true });
        const ts = Date.now();
        const safeBase = sanitizeFilename(args.nameHint || '');
        const writtenFiles = [];
        try {
            const screenPath = path_1.default.join(dir, `${safeBase}-${ts}.webm`);
            await promises_1.default.writeFile(screenPath, Buffer.from(args.screenBytes));
            writtenFiles.push(screenPath);
            const result = {
                screenVideoPath: screenPath,
                screenVideoUrl: (0, url_1.pathToFileURL)(screenPath).href,
                createdAt: ts,
            };
            if (args.webcamBytes && args.webcamBytes.byteLength > 0) {
                const webcamPath = path_1.default.join(dir, `${safeBase}-${ts}-webcam.webm`);
                await promises_1.default.writeFile(webcamPath, Buffer.from(args.webcamBytes));
                writtenFiles.push(webcamPath);
                result.webcamVideoPath = webcamPath;
                result.webcamVideoUrl = (0, url_1.pathToFileURL)(webcamPath).href;
            }
            // Save session manifest
            const manifestPath = path_1.default.join(dir, `${safeBase}-${ts}.session.json`);
            await promises_1.default.writeFile(manifestPath, JSON.stringify(result, null, 2));
            return result;
        }
        catch (err) {
            // Clean up partially written files on failure
            await Promise.all(writtenFiles.map((f) => promises_1.default.unlink(f).catch(() => { })));
            throw err;
        }
    });
    // ── Media permission handlers (required for recording sources) ────
    electron_1.session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        const allowed = ['media', 'audioCapture', 'microphone', 'videoCapture', 'camera'];
        return allowed.includes(permission);
    });
    electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowed = ['media', 'audioCapture', 'microphone', 'videoCapture', 'camera'];
        callback(allowed.includes(permission));
    });
    createWindow();
    // ── Allow screen/window capture via getDisplayMedia in renderer ────
    // Use the native macOS system picker (desktopCapturer.getSources is broken in Electron 41)
    electron_1.session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        console.log('[Electron] setDisplayMediaRequestHandler called');
        console.log('[Electron]   videoRequested:', !!request.videoRequested);
        console.log('[Electron]   audioRequested:', !!request.audioRequested);
        console.log('[Electron]   frame:', request.frame?.url?.slice(0, 80));
        try {
            ;
            callback({}, { useSystemPicker: true });
            console.log('[Electron]   callback invoked with useSystemPicker: true');
        }
        catch (err) {
            console.error('[Electron]   callback error:', err.message);
            callback(null);
        }
    });
    // ── Export API server ──────────────────────────────────────────────
    // Allows triggering Electron-path exports via HTTP:
    //   POST http://localhost:3002/export
    //   { projectId, outputPath?, resolution?, fps?, profile? }
    const exportServer = http_1.default.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        const json = (data, status = 200) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        };
        const getWin = () => {
            const win = electron_1.BrowserWindow.getAllWindows()[0];
            if (!win) {
                json({ error: 'No Electron window available' }, 503);
                return null;
            }
            return win;
        };
        if (req.method === 'GET' && req.url === '/health') {
            return json({ status: 'ok', type: 'electron-export' });
        }
        // ── Recording endpoints ──────────────────────────────────────────
        if (req.method === 'GET' && req.url === '/recording/sources') {
            return json({ sources: [], note: 'Source selection now uses native OS picker via getDisplayMedia()' });
        }
        if (req.method === 'GET' && req.url === '/recording/status') {
            const win = getWin();
            if (!win)
                return;
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
        `);
                return json(result);
            }
            catch (err) {
                return json({ error: err.message }, 500);
            }
        }
        if (req.method === 'GET' && req.url === '/recording/sessions') {
            try {
                const dir = path_1.default.join(electron_1.app.getPath('userData'), 'recordings');
                const files = await promises_1.default.readdir(dir).catch(() => []);
                const sessions = [];
                for (const f of files) {
                    if (!f.endsWith('.session.json'))
                        continue;
                    try {
                        const data = JSON.parse(await promises_1.default.readFile(path_1.default.join(dir, f), 'utf-8'));
                        sessions.push(data);
                    }
                    catch { /* skip corrupt manifests */ }
                }
                sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                return json({ sessions });
            }
            catch (err) {
                return json({ error: err.message }, 500);
            }
        }
        // POST recording endpoints — parse body
        if (req.method === 'POST' && req.url?.startsWith('/recording/')) {
            const chunks = [];
            for await (const chunk of req)
                chunks.push(Buffer.from(chunk));
            let body = {};
            try {
                body = JSON.parse(Buffer.concat(chunks).toString());
            }
            catch { /* empty body OK */ }
            const win = getWin();
            if (!win)
                return;
            const action = req.url.replace('/recording/', '');
            try {
                if (action === 'start') {
                    const configJson = JSON.stringify(body.config || body || {});
                    const sceneId = body.sceneId ? JSON.stringify(body.sceneId) : 'null';
                    const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'idle') return { error: 'Recording already active', state: s.recordingState };
              s.setRecordingConfig(${configJson});
              s.setRecordingAttachSceneId(${sceneId});
              s.setRecordingCommand('start');
              return { ok: true };
            })()
          `);
                    return json(result, result.error ? 409 : 200);
                }
                if (action === 'stop') {
                    const sceneId = body.sceneId ? JSON.stringify(body.sceneId) : 'null';
                    const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'recording' && s.recordingState !== 'paused')
                return { error: 'No active recording', state: s.recordingState };
              if (${sceneId}) s.setRecordingAttachSceneId(${sceneId});
              s.setRecordingCommand('stop');
              return { ok: true };
            })()
          `);
                    return json(result, result.error ? 409 : 200);
                }
                if (action === 'pause') {
                    const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'recording') return { error: 'Not recording', state: s.recordingState };
              s.setRecordingCommand('pause');
              return { ok: true };
            })()
          `);
                    return json(result, result.error ? 409 : 200);
                }
                if (action === 'resume') {
                    const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              if (s.recordingState !== 'paused') return { error: 'Not paused', state: s.recordingState };
              s.setRecordingCommand('resume');
              return { ok: true };
            })()
          `);
                    return json(result, result.error ? 409 : 200);
                }
                if (action === 'cancel') {
                    const result = await win.webContents.executeJavaScript(`
            (() => {
              const s = window.__cenchStore.getState();
              s.setRecordingCommand('cancel');
              return { ok: true };
            })()
          `);
                    return json(result);
                }
                return json({ error: `Unknown recording action: ${action}` }, 404);
            }
            catch (err) {
                return json({ error: err.message || 'Recording command failed' }, 500);
            }
        }
        // ── Export endpoint ───────────────────────────────────────────────
        if (req.method !== 'POST' || !req.url?.startsWith('/export')) {
            return json({ error: 'Not found' }, 404);
        }
        const chunks = [];
        for await (const chunk of req)
            chunks.push(Buffer.from(chunk));
        let body;
        try {
            body = JSON.parse(Buffer.concat(chunks).toString());
        }
        catch {
            return json({ error: 'Invalid JSON' }, 400);
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

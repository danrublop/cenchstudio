"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const electron_1 = require("electron");
const promises_1 = __importDefault(require("fs/promises"));
const url_1 = require("url");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function webZoomTargetWindow() {
    return electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0] ?? null;
}
// Dev-mode only. In packaged builds the renderer loads `cench://app/index.html`
// via the protocol handler registered below — no HTTP server is ever reached.
const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
// Runtime-writable scene HTML directory. In the packaged app, scenes cannot
// be written back into the read-only `out/` bundle, so we split:
//   cench://app/...     → Next static export (read-only bundle)
//   cench://scenes/...  → user-data directory (writable at runtime)
function getUserScenesDir() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'scenes');
}
function getStaticAppDir() {
    // In dev this resolves to `<repo>/out`. In the packaged app, `__dirname`
    // is `<Resources>/app.asar/dist-electron`, so `../out` resolves to
    // `<Resources>/app.asar/out`. Electron's fs layer reads through the asar
    // transparently, so no separate packaged branch is needed.
    return path_1.default.join(__dirname, '..', 'out');
}
// Privileged scheme must be registered synchronously before `app.ready`.
electron_1.protocol.registerSchemesAsPrivileged([
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
]);
async function registerCenchProtocol() {
    const staticDir = path_1.default.resolve(getStaticAppDir());
    const scenesDir = path_1.default.resolve(getUserScenesDir());
    await promises_1.default.mkdir(scenesDir, { recursive: true });
    electron_1.protocol.handle('cench', async (request) => {
        try {
            const url = new URL(request.url);
            const host = url.hostname;
            const rawPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            let baseDir;
            if (host === 'scenes') {
                baseDir = scenesDir;
            }
            else if (host === 'app' || host === '') {
                baseDir = staticDir;
            }
            else {
                return new Response(`Unknown cench:// host "${host}"`, { status: 404 });
            }
            let filePath = path_1.default.resolve(baseDir, rawPath || 'index.html');
            if (!filePath.startsWith(baseDir + path_1.default.sep) && filePath !== baseDir) {
                return new Response('Forbidden', { status: 403 });
            }
            // Fall through to index.html for directory paths
            try {
                const stat = await promises_1.default.stat(filePath);
                if (stat.isDirectory())
                    filePath = path_1.default.join(filePath, 'index.html');
            }
            catch {
                // Next.js static export writes `foo.html` for `/foo` — try that too
                if (!filePath.endsWith('.html')) {
                    const htmlVariant = `${filePath}.html`;
                    try {
                        await promises_1.default.access(htmlVariant);
                        filePath = htmlVariant;
                    }
                    catch { }
                }
            }
            return electron_1.net.fetch((0, url_1.pathToFileURL)(filePath).toString());
        }
        catch (err) {
            console.error('[cench-protocol] failed to serve', request.url, err);
            return new Response('Internal error', { status: 500 });
        }
    });
}
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
    const appUrl = electron_1.app.isPackaged ? 'cench://app/index.html' : DEV_URL;
    win.loadURL(appUrl);
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
electron_1.app.whenReady().then(async () => {
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
    await registerCenchProtocol();
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
    // Export API server (port 3002, HTTP) removed in the True Desktop migration.
    // See SHIP_READINESS.md and the Week 1 plan — operations re-expose as IPC later.
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});

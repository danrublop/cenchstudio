import path from 'path'
import fs from 'fs/promises'
import { spawn } from 'child_process'
import puppeteer from 'puppeteer'

const PLATFORM = process.platform
const IS_MAC = PLATFORM === 'darwin'

console.log(`[renderer] Platform: ${PLATFORM}`)

// ── Virtual time injection script ──────────────────────────────────────────
// Injected via evaluateOnNewDocument BEFORE any page scripts run.
// Replaces performance.now, Date.now, and requestAnimationFrame with
// deterministic virtual-time versions so we can step through frames
// at any speed for ALL animation libraries (GSAP, anime.js, Motion v11, etc.)

const VIRTUAL_TIME_SCRIPT = `
(function() {
  var _virtualTimeMs = 0;

  // Override performance.now
  var _origPerfNow = performance.now.bind(performance);
  performance.now = function() { return _virtualTimeMs; };

  // Override Date.now
  var _origDateNow = Date.now;
  Date.now = function() { return Math.floor(_virtualTimeMs); };

  // RAF queue — replaces the browser's real requestAnimationFrame
  // Animation libraries (GSAP, anime.js, Motion v11) use RAF for
  // their render loops. setTimeout/setInterval are left as-is to
  // avoid timer cascades with looping animations.
  var _rafQueue = [];
  var _nextRafId = 1;
  var _cancelledIds = new Set();

  window.requestAnimationFrame = function(cb) {
    var id = _nextRafId++;
    _rafQueue.push({ id: id, cb: cb });
    return id;
  };

  window.cancelAnimationFrame = function(id) {
    _cancelledIds.add(id);
  };

  // Advance virtual time and fire all queued RAF callbacks
  window.__advanceFrame = function(timeMs) {
    _virtualTimeMs = timeMs;
    var cbs = _rafQueue.splice(0);
    _cancelledIds.clear();
    for (var i = 0; i < cbs.length; i++) {
      if (!_cancelledIds.has(cbs[i].id)) {
        try { cbs[i].cb(_virtualTimeMs); } catch(e) {}
      }
    }
  };

  // Expose for debugging
  window.__getVirtualTime = function() { return _virtualTimeMs; };
  window.__getRafQueueSize = function() { return _rafQueue.length; };
})();
`

// ── Singleton browser ──────────────────────────────────────────────────────
let browserInstance = null
let browserLaunchPromise = null

async function getBrowser() {
  if (browserInstance?.connected) return browserInstance
  if (browserLaunchPromise) return browserLaunchPromise

  browserLaunchPromise = (async () => {
    console.log('[renderer] Launching headless Chrome via Puppeteer...')
    const browser = await puppeteer.launch({
      headless: 'shell',
      protocolTimeout: 300_000, // 5 min safety net for slow scenes
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=swiftshader',   // Software WebGL — needed for 3D world scenes
        '--no-first-run',
        '--no-zygote',
      ],
    })
    console.log(`[renderer] Chrome launched: ${await browser.version()}`)
    browser.on('disconnected', () => {
      console.log('[renderer] Chrome disconnected')
      browserInstance = null
      browserLaunchPromise = null
    })
    browserInstance = browser
    return browser
  })()

  return browserLaunchPromise
}

// ── Scene renderer ─────────────────────────────────────────────────────────

async function renderScene(browser, scene, opts) {
  const { outputDir, baseUrl, width, height, fps, onProgress, onSceneDone, sceneIndex } = opts
  const outputPath = path.join(outputDir, `scene-${scene.id}.mp4`)
  const totalFrames = Math.round(scene.duration * fps)
  const frameDurationMs = 1000 / fps

  // 3D world scenes use __updateScene for frame stepping instead of virtual time
  const is3DWorld = scene.sceneType === '3d_world'
  const url = `${baseUrl}/scenes/${scene.id}.html`

  console.log(`[renderer] Rendering scene ${sceneIndex + 1}: ${url} (${totalFrames} frames, ${scene.duration}s @ ${fps}fps)${is3DWorld ? ' [3D WORLD]' : ''}`)

  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })

  // 3D world scenes use __updateScene for frame stepping — do NOT inject virtual time
  // (virtual time breaks WebGL rendering loops). Regular scenes use WVC virtual time.
  if (!is3DWorld) {
    await page.evaluateOnNewDocument(VIRTUAL_TIME_SCRIPT)
  } else {
    // Signal WVC capture mode to the 3D world template
    await page.evaluateOnNewDocument(`window.__wvc_render = true;`)
  }

  let ffmpeg = null
  try {
    // Navigate and wait for scene to be ready
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })

    // For 3D world scenes: config is already baked into the HTML — wait for assets to load
    if (is3DWorld) {
      await page.waitForFunction(
        'window.__sceneReady && typeof window.__sceneReady.then === "function"',
        { timeout: 30000 }
      )
      await page.evaluate(() => window.__sceneReady)
      await page.waitForFunction('typeof window.__updateScene === "function"', { timeout: 10000 })
    }

    // For regular scenes: wait for GSAP timeline and set up virtual time
    if (!is3DWorld) {
      await page.waitForFunction('window.__tl != null', { timeout: 15000 })

      // Unblock the playback controller's RAF interception.
      await page.evaluate(() => {
        if (typeof window.__resume === 'function') window.__resume()
      })

      // Pump a few frames at time=0 to let initialization callbacks fire
      for (let init = 0; init < 3; init++) {
        await page.evaluate(() => window.__advanceFrame(0))
      }
    }

    // Spawn FFmpeg process
    const ffmpegArgs = [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-framerate', String(fps),
      '-i', '-',
      '-c:v', IS_MAC ? 'h264_videotoolbox' : 'libx264',
      '-pix_fmt', 'yuv420p',
      ...(IS_MAC ? ['-q:v', '50'] : ['-preset', 'fast', '-crf', '18']),
      '-movflags', '+faststart',
      outputPath,
    ]

    ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

    let ffmpegStderr = ''
    ffmpeg.stderr.on('data', (chunk) => { ffmpegStderr += chunk.toString() })

    const ffmpegDone = new Promise((resolve, reject) => {
      ffmpeg.on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg exited ${code}: ${ffmpegStderr.slice(-500)}`))
      })
    })

    // Frame-by-frame capture
    for (let frame = 0; frame < totalFrames; frame++) {
      const timeMs = (frame / fps) * 1000
      const timeSec = frame / fps

      if (is3DWorld) {
        // 3D world: call __updateScene(t) which renders the Three.js frame
        await page.evaluate((t) => {
          if (window.__updateScene) window.__updateScene(t)
        }, timeSec)
        // Small delay for GPU to finish rendering
        await new Promise(r => setTimeout(r, 5))
      } else {
        // Regular scene: advance virtual time (GSAP, anime.js, Motion)
        await page.evaluate((ms) => {
          window.__advanceFrame(ms)
          window.__advanceFrame(ms)
          if (window.__tl) {
            window.__tl.seek(ms / 1000)
            window.__tl.progress(window.__tl.progress())
          }
          if (typeof window.draw === 'function') {
            try { window.draw() } catch(e) {}
          }
        }, timeMs)

        // For React scenes: flush React state update after frame advance
        // so the DOM reflects the new frame before screenshot
        if (scene.sceneType === 'react') {
          await page.evaluate(() => new Promise(r => requestAnimationFrame(r)))
        }
      }

      // Capture the frame
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 95,
        optimizeForSpeed: true,
      })

      // Write to FFmpeg
      const canWrite = ffmpeg.stdin.write(screenshot)
      if (!canWrite) {
        await new Promise(r => ffmpeg.stdin.once('drain', r))
      }

      // Report progress
      onProgress(sceneIndex, ((frame + 1) / totalFrames) * 100)
    }

    // Close FFmpeg stdin and wait for it to finish (with timeout)
    ffmpeg.stdin.end()
    const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
    await Promise.race([
      ffmpegDone,
      new Promise((_, reject) => setTimeout(() => {
        ffmpeg.kill('SIGKILL')
        reject(new Error(`FFmpeg timed out after ${FFMPEG_TIMEOUT_MS / 1000}s`))
      }, FFMPEG_TIMEOUT_MS)),
    ])

    onSceneDone(sceneIndex)
    console.log(`[renderer] Scene ${sceneIndex + 1} complete: ${outputPath}`)

    return outputPath
  } finally {
    // Ensure FFmpeg stdin is closed even on screenshot failure
    if (ffmpeg && ffmpeg.stdin && !ffmpeg.stdin.destroyed) {
      ffmpeg.stdin.end()
    }
    await page.close().catch(() => {})
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render each scene to an individual MP4 using Puppeteer + FFmpeg.
 * Uses virtual time injection for deterministic frame-by-frame capture
 * across all animation libraries (GSAP, anime.js, Motion v11, CSS, etc.)
 *
 * @param {Array<{id:string, duration:number}>} scenes
 * @param {object} opts
 * @returns {Promise<string[]>} Array of output video file paths
 */
export async function renderScenes(scenes, opts = {}) {
  const {
    outputDir,
    baseUrl = 'http://localhost:3000',
    width = 1920,
    height = 1080,
    fps = 30,
    onProgress = () => {},
    onSceneDone = () => {},
  } = opts

  await fs.mkdir(outputDir, { recursive: true })

  const browser = await getBrowser()
  const videoPaths = []

  for (let i = 0; i < scenes.length; i++) {
    const videoPath = await renderScene(browser, scenes[i], {
      outputDir, baseUrl, width, height, fps,
      onProgress, onSceneDone, sceneIndex: i,
    })
    videoPaths.push(videoPath)
  }

  return videoPaths
}

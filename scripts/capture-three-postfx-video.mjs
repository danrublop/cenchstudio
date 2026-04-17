/**
 * Capture screenshots of each scene in the post-fx showcase project and
 * stitch them into a demo MP4. Uses the render-server's Puppeteer install.
 *
 * Usage: CENCH_BASE_URL=http://localhost:3002 node scripts/capture-three-postfx-video.mjs <projectId>
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(__dirname, '../render-server/package.json'))
const puppeteer = require('puppeteer')

const BASE = process.env.CENCH_BASE_URL || 'http://localhost:3002'
const projectId = process.argv[2]
if (!projectId) {
  console.error('usage: node capture-three-postfx-video.mjs <projectId>')
  process.exit(1)
}

const OUT_DIR = path.resolve(__dirname, '../.tmp-postfx-capture')
await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(OUT_DIR, { recursive: true })

const res = await fetch(`${BASE}/api/projects/${projectId}`)
if (!res.ok) {
  console.error(`GET /api/projects/${projectId} → ${res.status}`)
  process.exit(1)
}
const project = await res.json()
const scenes = project.scenes
  .filter((s) => s.sceneType === 'three')
  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

console.log(`Capturing ${scenes.length} scenes…`)

const browser = await puppeteer.launch({
  // Use non-headless Chrome so the real GPU powers WebGL. Runs invisibly behind
  // the terminal because nothing calls focus(). For true headless you'd need
  // to install `@mesa` or use docker with EGL — not worth it here.
  headless: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-angle=default',
    '--enable-unsafe-swiftshader',
    '--window-position=-2000,-2000',
    '--window-size=1920,1080',
  ],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
})

async function captureScene(scene, index) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })

  // Stub window.__tl BEFORE any scene script runs. Scene code pattern:
  //   window.__tl.to(state, { progress: 1, duration: DURATION, onUpdate })
  // We immediately run the onUpdate at progress=0.5 and call it periodically
  // until the capture is taken, so the scene renders continuously.
  await page.evaluateOnNewDocument(() => {
    const ANIM_PROGRESS_AT_CAPTURE = 0.5
    const updaters = []
    let elapsed = 0
    window.__tl = {
      to(target, cfg /*, position */) {
        const dur = cfg.duration || window.DURATION || 6
        const onUpdate = cfg.onUpdate
        if (target && typeof target === 'object' && 'progress' in target) {
          target.progress = ANIM_PROGRESS_AT_CAPTURE
        }
        if (typeof onUpdate === 'function') updaters.push({ fn: onUpdate, dur })
        return this
      },
      time() {
        const firstDur = updaters[0]?.dur || window.DURATION || 6
        return firstDur * ANIM_PROGRESS_AT_CAPTURE + elapsed
      },
      duration() {
        return updaters[0]?.dur || window.DURATION || 6
      },
      seek() { return this },
      progress() { return ANIM_PROGRESS_AT_CAPTURE },
      pause() { return this },
      play() { return this },
    }
    // Drive updaters continuously so shadow maps, post-fx composer, and
    // __cenchEnvRoot animation all have real frame callbacks.
    let tickActive = false
    function tick() {
      tickActive = true
      elapsed += 1 / 60
      for (const u of updaters) {
        try { u.fn() } catch (e) { /* ignore frame errors */ }
      }
      requestAnimationFrame(tick)
    }
    // Start ticking once the first .to is registered.
    const origTo = window.__tl.to
    window.__tl.to = function (...args) {
      const r = origTo.apply(this, args)
      if (!tickActive) requestAnimationFrame(tick)
      return r
    }
  })

  const url = `${BASE}/scenes/${scene.id}.html`
  console.log(`  [${index + 1}/${scenes.length}] ${scene.name} ← ${url}`)
  page.on('pageerror', (e) => console.warn('    pageerror:', e.message.slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') console.warn('    console.error:', m.text().slice(0, 200))
  })
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

  // Let the scene render for ~1.5 seconds so GLTF loads, composer warms up,
  // and the env runtime's native-RAF loop (for track_rolling_topdown) ticks.
  await new Promise((r) => setTimeout(r, 1500))

  const outPath = path.join(OUT_DIR, `frame-${String(index + 1).padStart(2, '0')}.png`)
  await page.screenshot({ path: outPath, type: 'png' })
  await page.close()
  return { scene, outPath }
}

const results = []
for (let i = 0; i < scenes.length; i++) {
  try {
    results.push(await captureScene(scenes[i], i))
  } catch (e) {
    console.warn(`    capture failed: ${e.message}`)
  }
}

await browser.close()

// Write a text overlay manifest describing each scene
const manifest = results.map((r, i) => `${i + 1}. ${r.scene.name}`).join('\n')
await writeFile(path.join(OUT_DIR, 'manifest.txt'), manifest)
console.log('Captured:', manifest)

// Stitch: each frame held for 3 seconds with a short crossfade between.
const framePaths = results.map((r) => r.outPath)
if (framePaths.length === 0) {
  console.error('No frames captured — aborting')
  process.exit(1)
}

// Build ffmpeg concat + xfade chain: one input per image, each 3 seconds
// long, 0.5s fade between.
const PER = 3 // seconds per still
const FADE = 0.5
const videoOut = path.resolve(__dirname, '../three-postfx-showcase.mp4')

// Generate per-image short videos then concat with xfade
const args = []
for (const f of framePaths) {
  args.push('-loop', '1', '-t', String(PER), '-i', f)
}

// Build filter_complex: scale each, concat with xfade chain
const n = framePaths.length
let filter = ''
for (let i = 0; i < n; i++) {
  filter += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30[v${i}];`
}
if (n === 1) {
  filter += `[v0]copy[vout]`
} else {
  let prev = `v0`
  for (let i = 1; i < n; i++) {
    const next = i === n - 1 ? 'vout' : `x${i}`
    const offset = (i * PER) - FADE * i
    filter += `[${prev}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset}[${next}];`
    prev = next
  }
  filter = filter.replace(/;$/, '')
}

args.push('-filter_complex', filter, '-map', '[vout]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-y', videoOut)

console.log('ffmpeg …')
const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] })
if (r.status !== 0) {
  console.error('ffmpeg failed', r.status)
  process.exit(1)
}
console.log('\nVideo:', videoOut)

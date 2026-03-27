import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Detect platform once at module load
const PLATFORM = process.platform // 'linux' | 'darwin' | 'win32'
const IS_LINUX = PLATFORM === 'linux'
const IS_MAC = PLATFORM === 'darwin'
const IS_WIN = PLATFORM === 'win32'

console.log(`[renderer] Platform: ${PLATFORM}`)

/**
 * Resolve the system Chrome/Chromium executable path for macOS and Windows.
 * Returns undefined on Linux (WVC finds it automatically).
 */
function getChromePath() {
  if (IS_MAC) {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }
  if (IS_WIN) {
    // Try common Windows installation locations
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    ]
    for (const p of candidates) {
      try {
        fs.access(p) // sync-ish — best effort; WVC will throw if wrong
      } catch {}
    }
    return candidates[0] // WVC will error with a clear message if wrong
  }
  return undefined // Linux: auto-detected
}

/**
 * Render each scene to an individual MP4 using WebVideoCreator.
 *
 * headless behaviour is auto-selected by OS:
 *   Linux  → headless (full server mode)
 *   macOS  → visible Chrome window (headless is unreliable on macOS)
 *   Windows→ visible Chrome window
 *
 * Override with env var: WVC_HEADLESS=true|false
 *
 * @param {Array<{id:string, duration:number}>} scenes
 * @param {object} opts
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

  // Lazy import so render server can start without WVC being installed
  let WebVideoCreator, VIDEO_ENCODER
  try {
    const wvcModule = await import('web-video-creator')
    WebVideoCreator = wvcModule.default
    VIDEO_ENCODER = wvcModule.VIDEO_ENCODER
  } catch (err) {
    throw new Error(
      `web-video-creator is not installed. Run: cd render-server && npm install\n${err.message}`
    )
  }

  const wvc = new WebVideoCreator()

  // Headless: auto-detect by OS unless overridden via WVC_HEADLESS env var
  const isHeadless =
    process.env.WVC_HEADLESS !== undefined
      ? process.env.WVC_HEADLESS !== 'false'
      : IS_LINUX // only headless on Linux by default

  const chromePath = getChromePath()

  const wvcConfig = {
    mp4Encoder: VIDEO_ENCODER?.CPU?.H264 ?? 'libx264',
    browserHeadless: isHeadless,
    browserUseGPU: false,
    debug: process.env.WVC_DEBUG === 'true',
  }

  if (chromePath) {
    wvcConfig.browserExecutablePath = chromePath
  }

  console.log(
    `[renderer] WVC config: headless=${isHeadless}, platform=${PLATFORM}${chromePath ? `, chrome=${chromePath}` : ''}`
  )

  wvc.config(wvcConfig)

  const videoPaths = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const outputPath = path.join(outputDir, `scene-${scene.id}.mp4`)
    const url = `${baseUrl}/scenes/${scene.id}.html`

    console.log(`[renderer] Rendering scene ${i + 1}/${scenes.length}: ${url}`)

    await new Promise((resolve, reject) => {
      let video
      try {
        video = wvc.createSingleVideo({
          url,
          width,
          height,
          fps,
          duration: Math.round(scene.duration * 1000), // ms
          outputPath,
        })
      } catch (err) {
        reject(err)
        return
      }

      video.on('progress', (p) => {
        onProgress(i, typeof p === 'number' ? p : parseFloat(p) || 0)
      })

      video.on('completed', () => {
        onSceneDone(i)
        resolve()
      })

      video.on('error', (err) => {
        reject(new Error(`Scene ${i + 1} render failed: ${err?.message || err}`))
      })

      video.start()
    })

    videoPaths.push(outputPath)
  }

  return videoPaths
}

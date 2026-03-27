import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { renderScenes } from './renderer.js'
import { stitchScenes } from './stitcher.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const NEXT_BASE_URL = process.env.NEXT_BASE_URL || 'http://localhost:3000'
const OUTPUT_DIR = path.resolve(__dirname, '..', 'renders')

const app = express()

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', pid: process.pid })
})

/**
 * POST /render
 * Body: {
 *   scenes: Array<{ id: string, duration: number, transition: string }>,
 *   outputName: string,
 *   settings: { resolution: '720p'|'1080p'|'4k', fps: 24|30|60, format: 'mp4' }
 * }
 *
 * Returns SSE stream:
 *   data: { type: 'scene_progress', scene: N, progress: 0-100 }
 *   data: { type: 'scene_done', scene: N }
 *   data: { type: 'stitching' }
 *   data: { type: 'complete', downloadUrl: '/renders/output.mp4' }
 *   data: { type: 'error', message: '...' }
 */
app.post('/render', async (req, res) => {
  const { scenes = [], outputName = `render-${Date.now()}`, settings = {} } = req.body

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: 'scenes array is required' })
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const { resolution = '1080p', fps = 30 } = settings

    const dimensions = {
      '720p':  { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
      '4k':    { width: 3840, height: 2160 },
    }[resolution] || { width: 1920, height: 1080 }

    // Render each scene to an MP4
    const videoPaths = await renderScenes(scenes, {
      outputDir: OUTPUT_DIR,
      baseUrl: NEXT_BASE_URL,
      width: dimensions.width,
      height: dimensions.height,
      fps,
      onProgress: (sceneIndex, progress) => {
        send({ type: 'scene_progress', scene: sceneIndex + 1, progress })
      },
      onSceneDone: (sceneIndex) => {
        send({ type: 'scene_done', scene: sceneIndex + 1 })
      },
    })

    // Stitch scenes into final MP4
    send({ type: 'stitching' })

    const outputPath = path.join(OUTPUT_DIR, `${outputName}.mp4`)
    const transitions = scenes.map((s) => ({ type: s.transition || 'none', duration: 0.5 }))

    await stitchScenes(videoPaths, transitions, outputPath)

    send({ type: 'complete', downloadUrl: `/renders/${outputName}.mp4` })
  } catch (err) {
    console.error('Render error:', err)
    send({ type: 'error', message: err.message || 'Render failed' })
  } finally {
    res.end()
  }
})

// Serve rendered files
app.use('/renders', express.static(OUTPUT_DIR))

app.listen(PORT, () => {
  console.log(`[cench-studio-render] Server running on http://localhost:${PORT}`)
  console.log(`[cench-studio-render] Next.js base URL: ${NEXT_BASE_URL}`)
  console.log(`[cench-studio-render] Output dir: ${OUTPUT_DIR}`)
})

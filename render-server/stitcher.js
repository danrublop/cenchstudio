import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IS_WIN = process.platform === 'win32'

// Use bundled ffmpeg binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

/** Normalize a file path for use inside FFmpeg concat list files. */
function toConcatPath(p) {
  // FFmpeg concat demuxer requires forward slashes and single-quote escaping
  return p.replace(/\\/g, '/').replace(/'/g, "\\'")
}

/**
 * Stitch multiple scene MP4s into one final video.
 *
 * @param {string[]} videoPaths
 * @param {Array<{type:'none'|'crossfade'|'wipe-left'|'wipe-right', duration:number}>} transitions
 * @param {string} outputPath
 */
export async function stitchScenes(videoPaths, transitions, outputPath) {
  if (videoPaths.length === 0) {
    throw new Error('No video paths to stitch')
  }

  if (videoPaths.length === 1) {
    // Just copy the single file
    await fs.copyFile(videoPaths[0], outputPath)
    return
  }

  const allNone = transitions.every((t) => t.type === 'none')

  if (allNone) {
    await simpleConcatVideos(videoPaths, outputPath)
  } else {
    await xfadeConcatVideos(videoPaths, transitions, outputPath)
  }
}

/**
 * Simple concat via concat demuxer (no transitions).
 */
async function simpleConcatVideos(videoPaths, outputPath) {
  // Write a concat list file
  const tmpDir = os.tmpdir()
  const listFile = path.join(tmpDir, `cench-studio-concat-${uuidv4()}.txt`)
  const listContent = videoPaths.map((p) => `file '${toConcatPath(p)}'`).join('\n')
  await fs.writeFile(listFile, listContent)

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(outputPath)
      .on('start', (cmd) => console.log('[stitcher] FFmpeg command:', cmd))
      .on('progress', (p) => {
        if (p.percent) console.log(`[stitcher] Progress: ${p.percent.toFixed(1)}%`)
      })
      .on('end', () => {
        fs.unlink(listFile).catch(() => {})
        console.log('[stitcher] Concat complete:', outputPath)
        resolve()
      })
      .on('error', (err) => {
        fs.unlink(listFile).catch(() => {})
        reject(new Error(`FFmpeg concat failed: ${err.message}`))
      })
      .run()
  })
}

/**
 * Concat with xfade transitions.
 * Calculates offset for each transition based on cumulative durations.
 */
async function xfadeConcatVideos(videoPaths, transitions, outputPath) {
  // First, probe durations of all clips
  const durations = await Promise.all(videoPaths.map(probeDuration))

  // Build xfade filter chain
  // [0][1]xfade=transition=fade:duration=0.5:offset=D0-0.25[v01];
  // [v01][2]xfade=transition=fade:duration=0.5:offset=D0+D1-0.5[v012]; etc.

  let accumulatedDuration = 0
  let filterParts = []
  let prevLabel = '[0:v]'

  for (let i = 0; i < videoPaths.length - 1; i++) {
    const transition = transitions[i] || { type: 'none', duration: 0.5 }
    const transDur = transition.duration || 0.5
    const xfadeType = getXfadeType(transition.type)

    accumulatedDuration += durations[i]
    const offset = Math.max(0, accumulatedDuration - transDur)

    const nextLabel = i === videoPaths.length - 2 ? '[vout]' : `[v${i + 1}]`
    const currentInput = i === 0 ? '[0:v]' : `[v${i}]`

    filterParts.push(
      `${currentInput}[${i + 1}:v]xfade=transition=${xfadeType}:duration=${transDur}:offset=${offset.toFixed(3)}${nextLabel}`
    )
  }

  const complexFilter = filterParts.join(';')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()

    videoPaths.forEach((p) => cmd.input(p))

    cmd
      .complexFilter(complexFilter)
      .outputOptions(['-map [vout]', '-c:v libx264', '-pix_fmt yuv420p', '-preset fast'])
      .output(outputPath)
      .on('start', (c) => console.log('[stitcher] FFmpeg xfade command:', c))
      .on('progress', (p) => {
        if (p.percent) console.log(`[stitcher] xfade progress: ${p.percent.toFixed(1)}%`)
      })
      .on('end', () => {
        console.log('[stitcher] xfade complete:', outputPath)
        resolve()
      })
      .on('error', (err) => {
        console.error('[stitcher] xfade error, falling back to simple concat:', err.message)
        // Fallback to simple concat
        simpleConcatVideos(videoPaths, outputPath).then(resolve).catch(reject)
      })
      .run()
  })
}

function getXfadeType(transition) {
  const map = {
    crossfade: 'fade',
    'wipe-left': 'wipeleft',
    'wipe-right': 'wiperight',
    none: 'fade',
  }
  return map[transition] || 'fade'
}

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      resolve(metadata?.format?.duration ?? 0)
    })
  })
}

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
 * @param {Array<{type:string, duration:number}>} transitions — type ids from lib/transitions.ts (FFmpeg xfade)
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
 * Handles mixed scenes where some have audio and some don't by
 * adding a silent audio track to scenes that lack one.
 */
async function simpleConcatVideos(videoPaths, outputPath) {
  // Check which videos have audio streams so we can normalize
  const hasAudio = await Promise.all(videoPaths.map(async (p) => {
    try {
      const meta = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(p, (err, m) => err ? reject(err) : resolve(m))
      })
      return meta.streams.some((s) => s.codec_type === 'audio')
    } catch {
      return false
    }
  }))

  const anyHasAudio = hasAudio.some(Boolean)

  let finalPaths = videoPaths
  if (anyHasAudio) {
    // Normalize: add silent audio to videos that don't have it
    const { execFile: execFileCb } = await import('child_process')
    const { promisify } = await import('util')
    const execFileP = promisify(execFileCb)
    const ffmpegBin = ffmpegStatic || 'ffmpeg'

    finalPaths = await Promise.all(videoPaths.map(async (p, i) => {
      if (hasAudio[i]) return p
      // Add silent audio stream using anullsrc
      const withAudio = p.replace(/\.mp4$/, '-silent-audio.mp4')
      try {
        await execFileP(ffmpegBin, [
          '-i', p,
          '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
          '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y',
          withAudio,
        ])
        return withAudio
      } catch {
        // If adding silent audio fails, use original (concat may still work)
        return p
      }
    }))
  }

  // Write a concat list file
  const tmpDir = os.tmpdir()
  const listFile = path.join(tmpDir, `cench-studio-concat-${uuidv4()}.txt`)
  const listContent = finalPaths.map((p) => `file '${toConcatPath(p)}'`).join('\n')
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

  // Probe audio presence so we can either concat audio or run video-only.
  const hasAudio = await Promise.all(videoPaths.map(async (p) => {
    try {
      const meta = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(p, (err, m) => err ? reject(err) : resolve(m))
      })
      return meta.streams.some((s) => s.codec_type === 'audio')
    } catch {
      return false
    }
  }))

  const anyHasAudio = hasAudio.some(Boolean)
  let finalVideoPaths = videoPaths

  // If some scenes have audio and some don't, add silent audio to missing ones
  // so the audio concat filter has consistent streams.
  if (anyHasAudio && hasAudio.some((h) => !h)) {
    const { execFile: execFileCb } = await import('child_process')
    const { promisify } = await import('util')
    const execFileP = promisify(execFileCb)
    const ffmpegBin = ffmpegStatic || 'ffmpeg'

    finalVideoPaths = await Promise.all(videoPaths.map(async (p, i) => {
      if (hasAudio[i]) return p
      const withAudio = p.replace(/\.mp4$/, '-silent-audio.mp4')
      try {
        await execFileP(ffmpegBin, [
          '-i', p,
          '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
          '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y',
          withAudio,
        ])
        return withAudio
      } catch {
        // If adding silent audio fails, keep original; we'll likely run video-only.
        return p
      }
    }))
  }

  // Build xfade filter chain
  // [0][1]xfade=transition=fade:duration=0.5:offset=D0-0.25[v01];
  // [v01][2]xfade=transition=fade:duration=0.5:offset=D0+D1-0.5[v012]; etc.

  let accumulatedDuration = 0
  let filterParts = []
  let prevLabel = '[0:v]'

  for (let i = 0; i < videoPaths.length - 1; i++) {
    const transition = transitions[i] || { type: 'none', duration: 0.5 }
    const requestedDur = transition.duration || 0.5
    const isCut = transition.type === 'none'
    // When the xfade path is used (any scene has a blend), "none" must be a near-instant cut, not a half-second fade.
    const transDur = isCut ? 0.04 : requestedDur
    const xfadeType = getXfadeType(transition.type)

    accumulatedDuration += durations[i]
    const offset = Math.max(0, accumulatedDuration - transDur)

    const nextLabel = i === videoPaths.length - 2 ? '[vout]' : `[v${i + 1}]`
    const currentInput = i === 0 ? '[0:v]' : `[v${i}]`

    filterParts.push(
      `${currentInput}[${i + 1}:v]xfade=transition=${xfadeType}:duration=${transDur}:offset=${offset.toFixed(3)}${nextLabel}`
    )
  }

  // Also concat audio streams: [0:a][1:a]...[N:a]concat=n=N:v=0:a=1[aout]
  if (anyHasAudio) {
    const audioInputs = finalVideoPaths.map((_, i) => `[${i}:a]`).join('')
    filterParts.push(
      `${audioInputs}concat=n=${finalVideoPaths.length}:v=0:a=1[aout]`
    )
  }

  const complexFilter = filterParts.join(';')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()

    finalVideoPaths.forEach((p) => cmd.input(p))

    cmd
      .complexFilter(complexFilter)
      .outputOptions(
        anyHasAudio
          ? ['-map [vout]', '-map [aout]', '-c:v libx264', '-c:a aac', '-pix_fmt yuv420p', '-preset fast']
          : ['-map [vout]', '-c:v libx264', '-pix_fmt yuv420p', '-preset fast']
      )
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

/** Keep in sync with lib/transitions.ts TRANSITION_CATALOG xfade values */
function getXfadeType(transition) {
  const map = {
    none: 'fade',
    crossfade: 'fade',
    dissolve: 'dissolve',
    'fade-black': 'fadeblack',
    'fade-white': 'fadewhite',
    'wipe-left': 'wipeleft',
    'wipe-right': 'wiperight',
    'wipe-up': 'wipeup',
    'wipe-down': 'wipedown',
    'wipe-tl': 'wipetl',
    'wipe-tr': 'wipetr',
    'wipe-bl': 'wipebl',
    'wipe-br': 'wipebr',
    'slide-left': 'slideleft',
    'slide-right': 'slideright',
    'slide-up': 'slideup',
    'slide-down': 'slidedown',
    'smooth-left': 'smoothleft',
    'smooth-right': 'smoothright',
    'smooth-up': 'smoothup',
    'smooth-down': 'smoothdown',
    'circle-open': 'circleopen',
    'circle-close': 'circleclose',
    radial: 'radial',
    'vert-open': 'vertopen',
    'horz-open': 'horzopen',
    'cover-left': 'coverleft',
    'cover-right': 'coverright',
    'reveal-left': 'revealleft',
    'reveal-right': 'revealright',
    'diag-tl': 'diagtl',
    'diag-tr': 'diagtr',
    'diag-bl': 'diagbl',
    'diag-br': 'diagbr',
    'zoom-in': 'zoomin',
    distance: 'distance',
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

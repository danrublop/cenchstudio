import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Resolve ffmpeg binary: try ffmpeg-static, then fall back to system ffmpeg
let FFMPEG_BIN = 'ffmpeg'
try {
  const ffmpegStatic = (await import('ffmpeg-static')).default
  if (ffmpegStatic && typeof ffmpegStatic === 'string') {
    FFMPEG_BIN = ffmpegStatic
  }
} catch {
  // ffmpeg-static not available, use system ffmpeg
}

/**
 * Resolve the project root. The render server lives at <root>/render-server/,
 * so public/ is always at <root>/public/ regardless of cwd.
 */
function getProjectRoot() {
  return path.resolve(__dirname, '..')
}

/**
 * Download a URL to a local temp file if it's a remote URL,
 * or resolve to an absolute path if it's a local /audio/ or /uploads/ path.
 *
 * @param {string|null} urlOrPath
 * @param {string} tempDir
 * @param {string} baseUrl - Next.js server URL for resolving relative paths
 * @returns {Promise<string|null>} Resolved local file path, or null if unresolvable
 */
export async function resolveAudioPath(urlOrPath, tempDir, baseUrl = 'http://localhost:3000') {
  if (!urlOrPath) return null

  // Client-only sentinel URLs — cannot be used in server-side export
  if (urlOrPath.startsWith('web-speech://') || urlOrPath.startsWith('puter-tts://')) {
    console.warn(`[audio-mixer] Skipping client-only audio source: ${urlOrPath}`)
    return null
  }

  // Local path relative to public/ (e.g. /audio/tts-xxx.mp3 or /uploads/music.mp3)
  if (urlOrPath.startsWith('/audio/') || urlOrPath.startsWith('/uploads/')) {
    const localPath = path.join(getProjectRoot(), 'public', urlOrPath)
    if (fs.existsSync(localPath)) return localPath
    // Try fetching from Next.js server as fallback
    const fullUrl = `${baseUrl}${urlOrPath}`
    return downloadToTemp(fullUrl, tempDir)
  }

  // Absolute URL — download to temp
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return downloadToTemp(urlOrPath, tempDir)
  }

  // Absolute local file path
  if (path.isAbsolute(urlOrPath) && fs.existsSync(urlOrPath)) {
    return urlOrPath
  }

  console.warn(`[audio-mixer] Cannot resolve audio path: ${urlOrPath}`)
  return null
}

/**
 * Download a URL to a temp file.
 * @param {string} url
 * @param {string} tempDir
 * @returns {Promise<string|null>} Local file path
 */
async function downloadToTemp(url, tempDir) {
  const ext = path.extname(new URL(url).pathname) || '.mp3'
  const tempPath = path.join(tempDir, `audio-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(tempPath, buffer)
    return tempPath
  } catch (err) {
    console.error(`[audio-mixer] Failed to download ${url}:`, err.message)
    return null
  }
}

/**
 * Mix audio tracks with a scene video using FFmpeg.
 *
 * @param {string} videoPath - Path to the silent (or existing) scene video
 * @param {Object} audioTracks - Audio track configuration
 * @param {Object} [audioTracks.tts] - { path: string } - TTS narration file path (local)
 * @param {Array}  [audioTracks.sfx] - [{ path: string, triggerAt: number, volume: number }]
 * @param {Object} [audioTracks.music] - { path: string, volume: number, loop: boolean, duckDuringTTS: boolean, duckLevel: number }
 * @param {number} duration - Scene duration in seconds
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Output file path
 */
export async function mixAudioTracks(videoPath, audioTracks, duration, outputPath) {
  const inputs = ['-i', videoPath] // Input 0: video
  const filterParts = []
  let audioStreamCount = 0
  const hasDucking = audioTracks.music?.duckDuringTTS && audioTracks.tts?.path

  // ── TTS ────────────────────────────────────────────────────────────────────
  if (audioTracks.tts?.path) {
    inputs.push('-i', audioTracks.tts.path)
    audioStreamCount++

    if (hasDucking) {
      // When ducking: split TTS into two streams — one for mixing, one for sidechain
      filterParts.push(`[${audioStreamCount}:a]asplit=2[tts][tts_sc]`)
    } else {
      filterParts.push(`[${audioStreamCount}:a]acopy[tts]`)
    }
  }

  // ── SFX (multiple, each with delay + volume) ──────────────────────────────
  const sfxLabels = []
  for (const sfx of audioTracks.sfx || []) {
    if (!sfx.path) continue
    inputs.push('-i', sfx.path)
    audioStreamCount++
    const delayMs = Math.round((sfx.triggerAt || 0) * 1000)
    const label = `sfx${sfxLabels.length}`
    // adelay with all=1 works for any channel count
    filterParts.push(
      `[${audioStreamCount}:a]adelay=${delayMs}:all=1,volume=${sfx.volume ?? 0.8}[${label}]`
    )
    sfxLabels.push(label)
  }

  // ── Music (optional loop, ducking when TTS is present) ─────────────────────
  let musicLabel = null
  if (audioTracks.music?.path) {
    inputs.push('-i', audioTracks.music.path)
    audioStreamCount++
    const vol = audioTracks.music.volume ?? 0.12

    if (audioTracks.music.loop) {
      // Loop music to fill scene duration using aloop with large loop count
      const sampleCount = 999999999
      filterParts.push(
        `[${audioStreamCount}:a]aloop=${sampleCount}:size=2147483647,atrim=0:${duration},volume=${vol}[music_raw]`
      )
    } else {
      filterParts.push(`[${audioStreamCount}:a]volume=${vol}[music_raw]`)
    }

    // Apply sidechaincompress ducking when TTS is present
    if (hasDucking) {
      const duckLevel = audioTracks.music.duckLevel || 0.2
      // Use [tts_sc] (the split copy) as sidechain, keeping [tts] free for mixing
      filterParts.push(
        `[music_raw][tts_sc]sidechaincompress=threshold=0.02:ratio=10:attack=100:release=500:level_in=1:level_sc=${(1 / duckLevel).toFixed(2)}[music]`
      )
      musicLabel = 'music'
    } else {
      musicLabel = 'music_raw'
    }
  }

  // ── No audio tracks → just copy the video file ────────────────────────────
  if (audioStreamCount === 0) {
    fs.copyFileSync(videoPath, outputPath)
    return outputPath
  }

  // ── Build amix filter to combine all audio streams ─────────────────────────
  const mixInputs = []
  if (audioTracks.tts?.path) mixInputs.push('[tts]')
  sfxLabels.forEach((l) => mixInputs.push(`[${l}]`))
  if (musicLabel) mixInputs.push(`[${musicLabel}]`)

  if (mixInputs.length === 1) {
    // Single audio stream — pad to scene duration, no mixing needed
    filterParts.push(`${mixInputs[0]}apad=pad_dur=${duration}[aout]`)
  } else {
    // Mix all audio streams together
    filterParts.push(
      `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=longest:dropout_transition=2[aout]`
    )
  }

  const filterComplex = filterParts.join(';')

  const args = [
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '0:v',     // Video from input 0
    '-map', '[aout]',  // Mixed audio output
    '-c:v', 'copy',    // Copy video codec (no re-encode)
    '-c:a', 'aac',     // Encode audio as AAC
    '-b:a', '192k',    // Audio bitrate
    '-t', String(duration), // Limit output to scene duration
    '-y',              // Overwrite output
    outputPath,
  ]

  console.log(`[audio-mixer] FFmpeg command: ${FFMPEG_BIN} ${args.join(' ')}`)

  try {
    await execFileAsync(FFMPEG_BIN, args, { maxBuffer: 50 * 1024 * 1024 })
    console.log(`[audio-mixer] Audio mix complete: ${outputPath}`)
    return outputPath
  } catch (err) {
    console.error('[audio-mixer] FFmpeg audio mix failed:', err.stderr || err.message)
    throw new Error(`Audio mixing failed: ${err.message}`)
  }
}

/**
 * Resolve all audio sources for a scene's audioLayer into local file paths,
 * then mix them with the scene video.
 *
 * This is the high-level entry point called from the render pipeline.
 *
 * @param {string} videoPath - Path to the silent scene video
 * @param {Object} audioLayer - Scene's audioLayer object (from types.ts AudioLayer)
 * @param {number} duration - Scene duration in seconds
 * @param {string} outputPath - Output file path for audio-mixed video
 * @param {string} tempDir - Temp directory for downloaded audio files
 * @param {string} baseUrl - Next.js server URL
 * @returns {Promise<string>} Path to the final video (with audio, or original if no audio)
 */
export async function mixSceneAudio(videoPath, audioLayer, duration, outputPath, tempDir, baseUrl) {
  if (!audioLayer || !audioLayer.enabled) {
    return videoPath // No audio layer — return original video
  }

  // Resolve all audio source paths
  const audioTracks = {}

  // TTS track
  if (audioLayer.tts?.src && audioLayer.tts.status === 'ready') {
    const ttsPath = await resolveAudioPath(audioLayer.tts.src, tempDir, baseUrl)
    if (ttsPath) {
      audioTracks.tts = { path: ttsPath }
    }
  }

  // SFX tracks
  if (audioLayer.sfx?.length > 0) {
    audioTracks.sfx = []
    for (const sfx of audioLayer.sfx) {
      if (!sfx.src) continue
      const sfxPath = await resolveAudioPath(sfx.src, tempDir, baseUrl)
      if (sfxPath) {
        audioTracks.sfx.push({
          path: sfxPath,
          triggerAt: sfx.triggerAt || 0,
          volume: sfx.volume ?? 0.8,
        })
      }
    }
  }

  // Music track
  if (audioLayer.music?.src) {
    const musicPath = await resolveAudioPath(audioLayer.music.src, tempDir, baseUrl)
    if (musicPath) {
      audioTracks.music = {
        path: musicPath,
        volume: audioLayer.music.volume ?? 0.12,
        loop: audioLayer.music.loop ?? false,
        duckDuringTTS: audioLayer.music.duckDuringTTS ?? false,
        duckLevel: audioLayer.music.duckLevel ?? 0.2,
      }
    }
  }

  // Legacy single-source audio (audioLayer.src without multi-track)
  if (!audioTracks.tts && !audioTracks.sfx?.length && !audioTracks.music && audioLayer.src) {
    const legacyPath = await resolveAudioPath(audioLayer.src, tempDir, baseUrl)
    if (legacyPath) {
      audioTracks.tts = { path: legacyPath }
    }
  }

  // Check if there's anything to mix
  const hasAudio = audioTracks.tts || audioTracks.sfx?.length > 0 || audioTracks.music
  if (!hasAudio) {
    return videoPath
  }

  return mixAudioTracks(videoPath, audioTracks, duration, outputPath)
}

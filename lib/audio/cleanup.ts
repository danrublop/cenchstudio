import fs from 'fs/promises'
import path from 'path'
import { getAudioDir } from './paths'

/** Default max age for audio files: 24 hours */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Clean up old audio files to prevent unbounded disk growth.
 * Deletes files older than maxAgeMs. Skips non-audio files.
 *
 * Call this periodically (e.g., on server startup or via a cron endpoint).
 */
export async function cleanupAudioFiles(maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<{
  deleted: number
  errors: number
}> {
  const audioDir = getAudioDir()
  const now = Date.now()
  let deleted = 0
  let errors = 0

  let entries: string[]
  try {
    entries = await fs.readdir(audioDir)
  } catch {
    // Directory doesn't exist yet — nothing to clean
    return { deleted: 0, errors: 0 }
  }

  const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac'])

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase()
    if (!audioExtensions.has(ext)) continue

    const filePath = path.join(audioDir, entry)
    try {
      const stat = await fs.stat(filePath)
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.unlink(filePath)
        deleted++
      }
    } catch {
      errors++
    }
  }

  if (deleted > 0) {
    console.log(`[audio-cleanup] Deleted ${deleted} old audio files${errors > 0 ? ` (${errors} errors)` : ''}`)
  }

  return { deleted, errors }
}

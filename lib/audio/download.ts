import fs from 'fs/promises'
import path from 'path'

/**
 * Download a remote audio URL to public/audio/ and return the local path.
 * If the URL is already local (/audio/...), returns it unchanged.
 * Used to ensure SFX/music from Freesound/Pixabay are available for
 * scene HTML (same-origin) and WVC export (headless, no cross-origin).
 */
export async function downloadToLocal(remoteUrl: string, prefix: string = 'dl'): Promise<string> {
  // Already local
  if (remoteUrl.startsWith('/audio/') || remoteUrl.startsWith('/uploads/')) {
    return remoteUrl
  }

  // Client-only sentinel URLs — can't download
  if (remoteUrl.startsWith('web-speech://') || remoteUrl.startsWith('puter-tts://')) {
    return remoteUrl
  }

  const audioDir = path.join(process.cwd(), 'public', 'audio')
  await fs.mkdir(audioDir, { recursive: true })

  // Determine file extension from URL or default to mp3
  let ext = '.mp3'
  try {
    const urlPath = new URL(remoteUrl).pathname
    ext = path.extname(urlPath) || '.mp3'
  } catch {
    // Malformed URL — use default extension
  }
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
  const filePath = path.join(audioDir, filename)

  const res = await fetch(remoteUrl)
  if (!res.ok) {
    throw new Error(`Failed to download audio: ${res.status} ${res.statusText}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(filePath, buffer)

  return `/audio/${filename}`
}

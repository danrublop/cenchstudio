import fs from 'fs/promises'
import path from 'path'

/** Allowed hostnames for audio downloads (known audio providers) */
const ALLOWED_HOSTS = new Set([
  'freesound.org',
  'www.freesound.org',
  'cdn.freesound.org',
  'pixabay.com',
  'cdn.pixabay.com',
  'api.elevenlabs.io',
  'storage.googleapis.com',
])

/** Max download size: 50MB */
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024

/**
 * Validate that a URL is safe to fetch (not internal/SSRF).
 * Only allows HTTPS to known audio provider hosts.
 */
function validateDownloadUrl(remoteUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(remoteUrl)
  } catch {
    throw new Error('Invalid download URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS download URLs are allowed')
  }

  // Block private/internal IPs even if hostname resolves to them
  const hostname = parsed.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error('Download from internal addresses is not allowed')
  }

  // Check against allowlist
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error(`Download not allowed from host: ${hostname}`)
  }
}

/**
 * Download a remote audio URL to public/audio/ and return the local path.
 * If the URL is already local (/audio/...), returns it unchanged.
 * Used to ensure SFX/music from Freesound/Pixabay are available for
 * scene HTML (same-origin) and WVC export (headless, no cross-origin).
 */
export async function downloadToLocal(remoteUrl: string, prefix: string = 'dl'): Promise<string> {
  // Already local
  if (
    remoteUrl.startsWith('/audio/') ||
    remoteUrl.startsWith('/uploads/') ||
    remoteUrl.startsWith('/sfx-library/')
  ) {
    return remoteUrl
  }

  // Client-only sentinel URLs — can't download
  if (remoteUrl.startsWith('web-speech://') || remoteUrl.startsWith('puter-tts://')) {
    return remoteUrl
  }

  validateDownloadUrl(remoteUrl)

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

  // Check content-length before buffering
  const contentLength = res.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
    throw new Error('Audio file too large to download')
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > MAX_DOWNLOAD_BYTES) {
    throw new Error('Audio file too large to download')
  }

  await fs.writeFile(filePath, buffer)

  return `/audio/${filename}`
}

import path from 'node:path'

/**
 * Runtime-writable uploads directory resolver.
 *
 * Mirrors `lib/audio/paths.ts` for uploaded/ingested media
 * (yt-dlp downloads, direct-URL ingest, user file uploads).
 *
 * `CENCH_UPLOADS_DIR` overrides the filesystem path.
 * `CENCH_UPLOADS_URL_BASE` overrides the URL prefix.
 *
 * Dev defaults (Next serves `public/uploads/*` at `/uploads/*`):
 *   dir:  `<cwd>/public/uploads`
 *   base: `/uploads/`
 *
 * Packaged (set by electron/main.ts):
 *   dir:  `<userData>/uploads`
 *   base: `cench://uploads/`
 */
export function getUploadsDir(): string {
  return process.env.CENCH_UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads')
}

export function uploadsUrlFor(relativePath: string): string {
  const raw = process.env.CENCH_UPLOADS_URL_BASE || '/uploads/'
  const base = raw.endsWith('/') ? raw : `${raw}/`
  // Strip any leading slash on `relativePath` so joining never yields `//`.
  const rel = relativePath.replace(/^\/+/, '')
  return `${base}${rel}`
}

export function isLocalUploadsUrl(url: string): boolean {
  return url.startsWith('/uploads/') || url.startsWith('cench://uploads/')
}

/**
 * File upload shim.
 *
 * Both IPC and HTTP paths share the same contract: return a URL the
 * renderer can hand to <audio>/<video>/<img>. Callers do not need to
 * know which transport ran.
 *
 * Dev (either transport): URL is `/uploads/<filename>`.
 * Packaged (IPC only): URL is `cench://uploads/<filename>`.
 */

export async function uploadBlob(blob: Blob, filename?: string): Promise<string> {
  const ipc = typeof window !== 'undefined' ? window.cenchApi?.media : undefined

  if (ipc) {
    const data = await blob.arrayBuffer()
    const { url } = await ipc.upload({
      data,
      mimeType: blob.type || 'application/octet-stream',
      originalName: filename,
    })
    return url
  }

  const form = new FormData()
  if (filename) form.append('file', blob, filename)
  else form.append('file', blob as Blob)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const data = (await res.json()) as { url?: string }
  if (!data.url) throw new Error('Upload response missing url')
  return data.url
}

/**
 * Server-side request/response coordination for agent frame captures.
 *
 * The agent runs server-side but the rendered pixels only exist in the
 * browser. When the model calls `capture_frame`, the server emits a
 * `capture_request` SSE event, then awaits a POST from the client with
 * the rendered image. This module is the rendezvous point.
 *
 * Stored on globalThis so hot-reload and Next.js route bundling don't
 * produce multiple competing maps.
 */

import crypto from 'crypto'

export interface CaptureResponse {
  dataUri: string
  mimeType: string
}

interface PendingEntry {
  resolve: (value: CaptureResponse) => void
  reject: (reason: Error) => void
  timeoutHandle: NodeJS.Timeout
}

const GLOBAL_KEY = '__cenchPendingCaptures__' as const
type PendingMap = Map<string, PendingEntry>

function getMap(): PendingMap {
  const g = globalThis as unknown as Record<string, unknown>
  let map = g[GLOBAL_KEY] as PendingMap | undefined
  if (!map) {
    map = new Map()
    g[GLOBAL_KEY] = map
  }
  return map
}

export interface PendingCapture {
  captureId: string
  promise: Promise<CaptureResponse>
}

/** Create a pending capture slot. Resolves when the client POSTs the image back. */
export function createPendingCapture(timeoutMs = 8000): PendingCapture {
  const captureId = crypto.randomUUID()
  const map = getMap()

  const promise = new Promise<CaptureResponse>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      map.delete(captureId)
      reject(new Error(`capture timeout after ${timeoutMs}ms`))
    }, timeoutMs)
    map.set(captureId, { resolve, reject, timeoutHandle })
  })

  return { captureId, promise }
}

export function resolvePendingCapture(captureId: string, dataUri: string, mimeType = 'image/jpeg'): boolean {
  const map = getMap()
  const entry = map.get(captureId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  map.delete(captureId)
  entry.resolve({ dataUri, mimeType })
  return true
}

export function rejectPendingCapture(captureId: string, reason: string): boolean {
  const map = getMap()
  const entry = map.get(captureId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  map.delete(captureId)
  entry.reject(new Error(reason))
  return true
}

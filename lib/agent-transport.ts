/**
 * Agent SSE transport shim.
 *
 * Isolates the renderer from the underlying transport so we can swap
 * fetch('/api/agent') for IPC events without touching `components/AgentChat.tsx`.
 *
 * Today: POSTs to the Next SSE endpoint and parses `data: <json>\n\n` frames.
 * Tomorrow: the Electron path will route through `window.cenchApi.agent.run`
 * with main-process `webContents.send('cench:agent.event', runId, ev)`.
 *
 * Event shape is whatever the agent runner emits (see `lib/agents/types`
 * `SSEEvent`). This module is transport-only — it does not interpret events.
 */

import type { SSEEvent } from '@/lib/agents/types'
import { createLogger } from './logger'

const log = createLogger('agent-transport')

export type AgentSseEvent = SSEEvent

export interface StreamAgentSseOptions {
  signal: AbortSignal
  onEvent: (event: AgentSseEvent) => void
  /** Fires each time we fall into the SSE backoff retry loop (not per mid-stream hiccup). */
  onReconnecting?: () => void
}

/** Matches the JSON parse behavior the component used inline. */
function parseAgentSseEvent(jsonStr: string): AgentSseEvent | null {
  try {
    return JSON.parse(jsonStr) as AgentSseEvent
  } catch (e) {
    log.warn('SSE JSON parse failed', {
      extra: {
        message: (e as Error).message,
        len: jsonStr.length,
        head: jsonStr.slice(0, 160),
      },
    })
    return null
  }
}

const SSE_BACKOFF_MS = [1000, 2000, 4000]
const SSE_TIMEOUT_MS = 90_000 // 90s — generous for long tool calls

/**
 * POST an agent request and consume the SSE stream, firing `onEvent` per frame.
 * Resolves when the stream completes. Throws on network error, non-2xx,
 * 90s no-data timeout, or AbortError (rethrown — caller distinguishes).
 */
export async function streamAgentSse(
  body: Record<string, unknown>,
  { signal, onEvent, onReconnecting }: StreamAgentSseOptions,
): Promise<void> {
  const fetchBody = JSON.stringify(body)

  let response!: Response
  for (let attempt = 0; attempt <= SSE_BACKOFF_MS.length; attempt++) {
    try {
      response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: fetchBody,
        signal,
      })
      break
    } catch (fetchErr) {
      if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') throw fetchErr
      if (attempt >= SSE_BACKOFF_MS.length) throw fetchErr
      onReconnecting?.()
      await new Promise((r) => setTimeout(r, SSE_BACKOFF_MS[attempt]))
    }
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(
      `Agent error: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ''}`,
    )
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const readResult = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Agent connection timed out — no data received for 90s')),
            SSE_TIMEOUT_MS,
          )
        }),
      ])
      clearTimeout(timeoutId)
      const { done, value } = readResult
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue
        const event = parseAgentSseEvent(jsonStr)
        if (event) onEvent(event)
      }
    }
  } finally {
    try {
      reader.cancel()
    } catch {
      // reader may already be cancelled by the underlying error
    }
  }
}

/**
 * Send a captured frame (or error) back to the agent runner so it can
 * resolve a `capture_request` pending capture. Fire-and-forget is OK —
 * the runner has its own timeout on pending captures.
 */
export async function postAgentCaptureResponse(payload: {
  captureId: string
  dataUri?: string
  mimeType?: string
  error?: string
}): Promise<void> {
  await fetch('/api/agent/capture-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

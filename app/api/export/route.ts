import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.export')

const RENDER_SERVER_URL = process.env.NEXT_PUBLIC_RENDER_SERVER_URL || 'http://localhost:3001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    log.debug('request', { extra: { scenes: body.scenes?.length ?? 0, output: body.outputName ?? 'unnamed' } })

    // Proxy to render server and stream SSE back (5 min timeout)
    const renderRes = await fetch(`${RENDER_SERVER_URL}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    })

    if (!renderRes.ok) {
      const err = await renderRes.text()
      log.error('render server error', { extra: { status: renderRes.status, body: err } })
      const errorEvent = `data: ${JSON.stringify({ type: 'error', message: `Render server error: ${err}` })}\n\n`
      return new Response(errorEvent, {
        status: renderRes.status,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    if (!renderRes.body) {
      log.error('render server returned empty body')
      const errorEvent = `data: ${JSON.stringify({ type: 'error', message: 'Render server returned empty response' })}\n\n`
      return new Response(errorEvent, {
        status: 500,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    // Pass through the SSE stream from render server
    return new Response(renderRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: unknown) {
    log.error('export proxy error', { error: err })
    const message = err instanceof Error ? err.message : 'Export failed'

    // Return error as SSE event
    const errorEvent = `data: ${JSON.stringify({ type: 'error', message })}\n\n`
    return new Response(errorEvent, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  }
}

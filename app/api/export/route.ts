import { NextRequest, NextResponse } from 'next/server'

const RENDER_SERVER_URL = process.env.NEXT_PUBLIC_RENDER_SERVER_URL || 'http://localhost:3001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Proxy to render server and stream SSE back
    const renderRes = await fetch(`${RENDER_SERVER_URL}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!renderRes.ok) {
      const err = await renderRes.text()
      return NextResponse.json({ error: err }, { status: renderRes.status })
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
    console.error('Export proxy error:', err)
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

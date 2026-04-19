import { NextRequest, NextResponse } from 'next/server'
import { logAnalyticsEvent } from '@/lib/db/queries/analytics'
import { createLogger } from '@/lib/logger'

const log = createLogger('api.analytics-track')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const VALID_EVENTS = new Set([
  'project_started',
  'project_completed',
  'scene_viewed',
  'scene_ended',
  'path_taken',
  'interaction_fired',
  'choice_selected',
  'quiz_answered',
  'form_submitted',
  'variable_set',
])

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      projectId,
      sessionId,
      event,
      data = {},
    } = body as {
      projectId?: string
      sessionId?: string
      event?: string
      data?: Record<string, unknown>
    }

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400, headers: CORS_HEADERS })
    }
    if (!event || !VALID_EVENTS.has(event)) {
      return NextResponse.json(
        { error: `Invalid event. Must be one of: ${[...VALID_EVENTS].join(', ')}` },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const userAgent = req.headers.get('user-agent') ?? undefined
    const country = req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country') ?? undefined

    await logAnalyticsEvent({
      publishedProjectId: projectId,
      sessionId: sessionId || 'anonymous',
      eventType: event,
      sceneId: (data.sceneId as string) ?? undefined,
      interactionId: (data.interactionId as string) ?? undefined,
      data,
      userAgent,
      country,
    })

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (err) {
    log.error('Error:', { error: err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'analytics.json')

interface AnalyticsEvent {
  projectId: string
  event: string
  data: Record<string, unknown>
  timestamp: string
  sessionId: string
}

function readEvents(): AnalyticsEvent[] {
  try {
    if (!fs.existsSync(DB_PATH)) return []
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function writeEvents(events: AnalyticsEvent[]) {
  fs.mkdirSync(DB_DIR, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(events, null, 2))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, event, data = {}, sessionId } = body

    if (!projectId || !event) {
      return NextResponse.json({ error: 'Missing projectId or event' }, { status: 400 })
    }

    const entry: AnalyticsEvent = {
      projectId,
      event,
      data,
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'unknown',
    }

    const events = readEvents()
    events.push(entry)
    writeEvents(events)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Analytics error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const projectId = url.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const events = readEvents().filter((e) => e.projectId === projectId)

    // Compute basic stats
    const totalViews = events.filter((e) => e.event === 'project_started').length
    const completions = events.filter((e) => e.event === 'project_completed').length
    const completionRate = totalViews > 0 ? (completions / totalViews) * 100 : 0

    const sceneViews: Record<string, number> = {}
    const interactionCounts: Record<string, number> = {}
    const pathCounts: Record<string, number> = {}
    const quizResults: Record<string, { correct: number; wrong: number }> = {}

    for (const e of events) {
      if (e.event === 'scene_viewed') {
        const sid = e.data.sceneId as string
        sceneViews[sid] = (sceneViews[sid] ?? 0) + 1
      }
      if (e.event === 'interaction_fired') {
        const iid = e.data.interactionId as string
        interactionCounts[iid] = (interactionCounts[iid] ?? 0) + 1
      }
      if (e.event === 'path_taken') {
        const key = `${e.data.fromSceneId}->${e.data.toSceneId}`
        pathCounts[key] = (pathCounts[key] ?? 0) + 1
      }
      if (e.event === 'quiz_answered') {
        const qid = e.data.interactionId as string
        if (!quizResults[qid]) quizResults[qid] = { correct: 0, wrong: 0 }
        if (e.data.correct) quizResults[qid].correct++
        else quizResults[qid].wrong++
      }
    }

    return NextResponse.json({
      totalViews,
      completions,
      completionRate: Math.round(completionRate * 10) / 10,
      sceneViews,
      interactionCounts,
      pathCounts,
      quizResults,
      totalEvents: events.length,
    })
  } catch (err: unknown) {
    console.error('Analytics GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

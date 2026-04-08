/**
 * Cench Studio HTTP Client
 *
 * Bridges the iMessage agent to Cench Studio's APIs:
 * - POST /api/agent (SSE) — scene generation via the agent framework
 * - POST /render (SSE) — MP4 export via Puppeteer + FFmpeg
 * - GET /health, GET /api/scene — utilities
 */

const STUDIO_URL = process.env.CENCH_STUDIO_URL || 'http://localhost:3000'
const RENDER_URL = process.env.RENDER_SERVER_URL || 'http://localhost:3001'

// Timeouts & retries
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000 // 5 min for agent generation
const RENDER_TIMEOUT_MS = 5 * 60 * 1000 // 5 min for MP4 rendering
const MAX_RETRIES = 1 // Retry once on transient failure
const RETRY_DELAY_MS = 2000 // Wait before retry

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isLast = attempt === MAX_RETRIES
      const message = err instanceof Error ? err.message : String(err)
      const isTransient =
        message.includes('ECONNREFUSED') ||
        message.includes('ECONNRESET') ||
        message.includes('fetch failed') ||
        message.includes('AbortError') ||
        message.includes('502') ||
        message.includes('503')

      if (isLast || !isTransient) throw err
      console.warn(`[${label}] Attempt ${attempt + 1} failed (${message}), retrying in ${RETRY_DELAY_MS}ms...`)
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
  throw new Error('unreachable')
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface GenerationResult {
  scenes: SceneSummary[]
  textResponse: string
  usage: { inputTokens: number; outputTokens: number; costUsd: number }
}

export interface SceneSummary {
  id: string
  name: string
  sceneType: string
  duration: number
  audioLayer?: {
    enabled: boolean
    tts?: { src: string; duration?: number; status?: string }
    sfx?: Array<{ src: string; triggerAt: number; volume: number; duration?: number }>
    music?: { src: string; volume: number; loop: boolean; duckDuringTTS?: boolean }
  }
}

export interface RenderResult {
  downloadUrl: string
  localPath: string
}

export interface SSECallback {
  onPhase?: (phase: string) => void
  onProgress?: (scene: number, progress: number) => void
}

// ── Health Checks ──────────────────────────────────────────────────────────

export async function checkStudioHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${STUDIO_URL}/api/projects`, { signal: AbortSignal.timeout(5000) })
    return res.status < 500
  } catch {
    return false
  }
}

export async function checkRenderHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RENDER_URL}/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}

// ── Project Management ────────────────────────────────────────────────────

const PROJECT_CACHE_TTL_MS = 10 * 60 * 1000 // 10 min
const projectCache = new Map<string, { id: string; ts: number }>()

/**
 * Get or create a project for an iMessage contact.
 * Caches the project ID so subsequent requests reuse it.
 */
export async function getOrCreateProject(contactName: string): Promise<string | null> {
  const cached = projectCache.get(contactName)
  if (cached && Date.now() - cached.ts < PROJECT_CACHE_TTL_MS) return cached.id

  try {
    const res = await fetch(`${STUDIO_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: contactName, outputMode: 'mp4' }),
    })
    if (!res.ok) {
      console.warn(`[project] Failed to create: ${res.status}`)
      return null
    }
    const data = await res.json()
    const projectId = data.id ?? data.project?.id
    if (projectId) {
      projectCache.set(contactName, { id: projectId, ts: Date.now() })
      console.log(`[project] Created: ${contactName} → ${projectId}`)
    }
    return projectId ?? null
  } catch (err) {
    console.warn(`[project] Error:`, err)
    return null
  }
}

// ── Scene Generation ─────────────────────────────────────────────────────

/**
 * Call the Cench agent API to generate scenes from a prompt.
 * Consumes the SSE stream and returns collected results.
 */
export async function generateScenes(opts: {
  message: string
  scenes?: any[]
  globalStyle?: any
  projectName?: string
  projectId?: string
  history?: Array<{ role: string; content: string }>
  agentOverride?: string
  callbacks?: SSECallback
}): Promise<GenerationResult> {
  return withRetry(() => _generateScenes(opts), 'generateScenes')
}

async function _generateScenes(opts: {
  message: string
  scenes?: any[]
  globalStyle?: any
  projectName?: string
  projectId?: string
  history?: Array<{ role: string; content: string }>
  agentOverride?: string
  callbacks?: SSECallback
}): Promise<GenerationResult> {
  const body = {
    message: opts.message,
    scenes: opts.scenes ?? [],
    globalStyle: opts.globalStyle ?? {
      palette: ['#2D3436', '#636E72', '#DFE6E9', '#74B9FF'],
      background: '#FFFFFF',
      font: 'Inter, system-ui, sans-serif',
    },
    projectName: opts.projectName ?? 'iMessage Agent',
    ...(opts.projectId ? { projectId: opts.projectId } : {}),
    outputMode: 'mp4',
    agentOverride: opts.agentOverride ?? 'scene-maker',
    history: opts.history ?? [],
    // Only expose Motion, Canvas2D, D3 scene types (no physics, three, lottie, audio)
    // d3 excluded: its presence triggers "D3-only mode" guard that blocks motion/canvas2d add_layer
    activeTools: ['motion', 'canvas2d'],
    // Use Anthropic Claude for the agent (default), restrict everything else to free providers
    ...(process.env.IMESSAGE_MODEL ? { modelOverride: process.env.IMESSAGE_MODEL } : {}),
    // Only enable free audio providers (macOS native TTS, edge TTS, web speech)
    audioProviderEnabled: {
      'native-tts': true,
      'openai-edge-tts': true,
      'web-speech': true,
      puter: true,
      elevenlabs: false,
      'openai-tts': false,
      'gemini-tts': false,
      'google-tts': false,
    },
    // Disable paid media generation (image gen, video gen)
    mediaGenEnabled: {
      imageGen: false,
      videoGen: false,
      avatarGen: false,
    },
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)

  const res = await fetch(`${STUDIO_URL}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 401 || text.includes('401') || text.includes('authentication')) {
      throw new Error('API key is invalid or paused — check ANTHROPIC_API_KEY')
    }
    if (res.status === 429 || text.includes('rate_limit')) {
      throw new Error('API rate limited — wait a moment and try again')
    }
    throw new Error(`Agent API ${res.status}: ${text.slice(0, 200)}`)
  }

  // Parse SSE stream
  const scenes: SceneSummary[] = []
  let textResponse = ''
  let usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (!json || json === '[DONE]') continue

      try {
        const event = JSON.parse(json)

        // Log all SSE events in debug mode
        if (process.env.DEBUG === '1') {
          const summary = event.type === 'token' ? 'token' : `${event.type}: ${JSON.stringify(event).slice(0, 120)}`
          console.log(`   [sse] ${summary}`)
        }

        // Capture errors from the agent
        if (event.type === 'error') {
          const errMsg = event.error ?? event.message ?? JSON.stringify(event)
          console.error(`   [sse] ERROR from agent: ${errMsg}`)
          throw new Error(errMsg)
        }

        handleAgentEvent(event, scenes, (t) => (textResponse += t), opts.callbacks)

        if (event.type === 'done' && event.usage) {
          usage = {
            inputTokens: event.usage.inputTokens ?? 0,
            outputTokens: event.usage.outputTokens ?? 0,
            costUsd: event.usage.costUsd ?? 0,
          }
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue // skip malformed JSON
        throw e // propagate real errors
      }
    }
  }

  return { scenes, textResponse, usage }
}

function handleAgentEvent(
  event: any,
  scenes: SceneSummary[],
  appendText: (t: string) => void,
  callbacks?: SSECallback,
) {
  switch (event.type) {
    case 'token':
      if (event.text) appendText(event.text)
      break

    case 'tool_complete': {
      const tr = event.toolResult ?? event.result
      if (event.toolName === 'create_scene' && tr?.data?.sceneId) {
        scenes.push({
          id: tr.data.sceneId,
          name: event.toolInput?.name ?? 'Scene',
          sceneType: 'motion',
          duration: (event.toolInput?.duration as number) ?? 8,
        })
      }
      callbacks?.onPhase?.(`Tool complete: ${event.toolName}`)
      break
    }

    case 'tool_start':
      callbacks?.onPhase?.(`Running: ${event.toolName}`)
      break

    case 'preview_update':
      callbacks?.onPhase?.('Scene preview updated')
      break

    case 'state_change':
      // Track scene additions from state changes
      // changes is an array: [{ type: 'scene_created', sceneId, description }]
      if (Array.isArray(event.changes)) {
        for (const change of event.changes) {
          if (change.type === 'scene_created' && change.sceneId) {
            const exists = scenes.some((sc) => sc.id === change.sceneId)
            if (!exists) {
              scenes.push({
                id: change.sceneId,
                name: change.description ?? 'Scene',
                sceneType: 'motion',
                duration: 8,
              })
            }
          }
        }
      }
      // Also capture final state with full scene data
      if (event.updatedScenes && Array.isArray(event.updatedScenes)) {
        for (const s of event.updatedScenes) {
          const existing = scenes.find((sc) => sc.id === s.id)
          if (existing) {
            existing.name = s.name ?? existing.name
            existing.sceneType = s.sceneType ?? existing.sceneType
            existing.duration = s.duration ?? existing.duration
          } else {
            scenes.push({
              id: s.id,
              name: s.name ?? 'Scene',
              sceneType: s.sceneType ?? 'motion',
              duration: s.duration ?? 8,
            })
          }
        }
      }
      break
  }
}

// ── Fetch scenes from project ──────────────────────────────────────────────

export async function fetchScenes(projectId: string): Promise<SceneSummary[]> {
  const res = await fetch(`${STUDIO_URL}/api/scene?projectId=${projectId}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.scenes ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    sceneType: s.sceneType ?? 'svg',
    duration: s.duration,
  }))
}

// ── MP4 Rendering ──────────────────────────────────────────────────────────

/**
 * Call the render server to produce an MP4 from generated scenes.
 * Consumes the SSE stream and returns the download URL.
 */
export async function renderToMp4(
  scenes: SceneSummary[],
  outputName?: string,
  callbacks?: SSECallback,
): Promise<RenderResult> {
  return withRetry(() => _renderToMp4(scenes, outputName, callbacks), 'renderToMp4')
}

async function _renderToMp4(
  scenes: SceneSummary[],
  outputName?: string,
  callbacks?: SSECallback,
): Promise<RenderResult> {
  const name = outputName ?? `imessage-${Date.now()}`

  const renderController = new AbortController()
  const renderTimeout = setTimeout(() => renderController.abort(), RENDER_TIMEOUT_MS)

  try {
    const renderBody = {
      scenes: scenes.map((s) => ({
        id: s.id,
        duration: s.duration,
        sceneType: s.sceneType,
        transition: 'none',
        ...(s.audioLayer ? { audioLayer: s.audioLayer } : {}),
      })),
      outputName: name,
      settings: { resolution: '1080p', fps: 30, format: 'mp4' },
    }

    if (process.env.DEBUG === '1') {
      const hasAudio = renderBody.scenes.some((s: any) => s.audioLayer?.enabled)
      console.log(`   [render] sending ${renderBody.scenes.length} scene(s), hasAudio=${hasAudio}`)
      renderBody.scenes.forEach((s: any, i: number) => {
        console.log(
          `   [render] scene ${i}: id=${s.id.slice(0, 20)} audio=${!!s.audioLayer?.enabled} tts=${s.audioLayer?.tts?.src ?? 'none'}`,
        )
      })
    }

    const res = await fetch(`${RENDER_URL}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: renderController.signal,
      body: JSON.stringify(renderBody),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Render API ${res.status}: ${text}`)
    }

    // Parse SSE stream
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let downloadUrl = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const json = line.slice(6).trim()
        if (!json) continue

        try {
          const event = JSON.parse(json)

          switch (event.type) {
            case 'scene_progress':
              callbacks?.onProgress?.(event.scene, event.progress)
              callbacks?.onPhase?.(`Rendering scene ${event.scene}...`)
              break
            case 'scene_done':
              callbacks?.onPhase?.(`Scene ${event.scene} rendered`)
              break
            case 'mixing_audio':
              callbacks?.onPhase?.('Mixing audio...')
              break
            case 'stitching':
              callbacks?.onPhase?.('Stitching final video...')
              break
            case 'complete':
              downloadUrl = event.downloadUrl
              break
            case 'error':
              throw new Error(`Render failed: ${event.message}`)
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue // skip malformed JSON
          throw e // propagate real errors
        }
      }
    }

    if (!downloadUrl) throw new Error('Render completed without download URL')

    return {
      downloadUrl,
      localPath: `${RENDER_URL}${downloadUrl}`,
    }
  } finally {
    clearTimeout(renderTimeout)
  }
}

// ── Download MP4 to local file ─────────────────────────────────────────────

export async function downloadMp4(url: string, destPath: string): Promise<void> {
  const { writeFile } = await import('fs/promises')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const arrayBuf = await res.arrayBuffer()
    await writeFile(destPath, Buffer.from(arrayBuf))
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * SSE streaming endpoint for the Cench Studio agent system.
 *
 * POST /api/agent
 * Accepts a JSON body with message, agent settings, and current world state.
 * Streams Server-Sent Events back to the client.
 *
 * Event format: `data: <JSON>\n\n`
 *
 * Transport-layer-only — all orchestration lives in
 * `lib/services/agent-runner.ts` so the Electron IPC handler can reuse it.
 */

import { NextRequest } from 'next/server'
import crypto from 'crypto'
import type { AgentType, ModelId, SSEEvent } from '@/lib/agents/types'
import type { Scene } from '@/lib/types'
import { assertProjectAccess } from '@/lib/auth-helpers'
import { runAgentRequest, reserveRunSlot, releaseRunSlot, type AgentAPIRequest } from '@/lib/services/agent-runner'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes — multi-scene videos need time for sequential code generation

export type { AgentAPIRequest } from '@/lib/services/agent-runner'

export async function POST(req: NextRequest) {
  let body: AgentAPIRequest

  try {
    body = await req.json()
  } catch {
    console.warn('[Agent API] Invalid JSON body received')
    return new Response('Invalid JSON body', { status: 400 })
  }

  const isValidMessage =
    (typeof body.message === 'string' && body.message.trim().length > 0) ||
    (Array.isArray(body.message) && body.message.length > 0)
  if (!isValidMessage) {
    console.warn('[Agent API] Missing required field: message')
    return new Response('Missing required field: message', { status: 400 })
  }

  if (!body.scenes || !Array.isArray(body.scenes)) {
    console.warn('[Agent API] Missing required field: scenes')
    return new Response('Missing required field: scenes', { status: 400 })
  }

  // ── Input size limits ──────────────────────────────────────────────────────
  const MAX_MESSAGE_LENGTH = 50_000
  const MAX_SCENES = 100
  const MAX_HISTORY = 200

  const msgTextForValidation = typeof body.message === 'string' ? body.message : JSON.stringify(body.message)
  if (msgTextForValidation.length > MAX_MESSAGE_LENGTH) {
    return new Response('Message too long', { status: 413 })
  }
  if (body.scenes.length > MAX_SCENES) {
    return new Response('Too many scenes', { status: 413 })
  }
  if (body.history && body.history.length > MAX_HISTORY) {
    return new Response('History too long', { status: 413 })
  }

  // Verify project ownership if projectId is provided
  // Also derive authenticated userId from session (never trust client-supplied userId)
  let authenticatedUserId: string | null = null
  if (body.projectId) {
    const access = await assertProjectAccess(body.projectId)
    if (access.error) return access.error
    authenticatedUserId = access.user?.id ?? null
  }

  // Server-side authoritative scene read — merge with client scenes to prevent
  // stripped code fields from corrupting agent context (Fix 4)
  let serverScenes: Scene[] = []
  if (body.projectId) {
    try {
      const { getFullProject } = await import('@/lib/db/queries/projects')
      const dbProject = await getFullProject(body.projectId)
      if (dbProject?.scenes) {
        serverScenes = dbProject.scenes as unknown as Scene[]
      }
    } catch (e) {
      console.warn(`[Agent API] Could not read server scenes: ${(e as Error).message}`)
    }
  }

  // Merge: prefer server's code fields when client's are empty/stripped
  if (serverScenes.length > 0) {
    const mergedScenes = body.scenes.map((clientScene: any) => {
      const serverScene = serverScenes.find((s: any) => s.id === clientScene.id)
      if (!serverScene) return clientScene
      return {
        ...clientScene,
        canvasCode: clientScene.canvasCode || (serverScene as any).canvasCode || '',
        sceneCode: clientScene.sceneCode || (serverScene as any).sceneCode || '',
        sceneHTML: clientScene.sceneHTML || (serverScene as any).sceneHTML || '',
        svgContent: clientScene.svgContent || (serverScene as any).svgContent || '',
        canvasBackgroundCode: clientScene.canvasBackgroundCode || (serverScene as any).canvasBackgroundCode || '',
        lottieSource: clientScene.lottieSource || (serverScene as any).lottieSource || '',
      }
    })
    // Add any server scenes not present in client
    for (const serverScene of serverScenes) {
      if (!mergedScenes.some((s: any) => s.id === (serverScene as any).id)) {
        mergedScenes.push(serverScene as any)
      }
    }
    body.scenes = mergedScenes
  }

  // ── Mock mode: return canned SSE stream without hitting any LLM API ──────
  // Activated via env var OR client-side toggle (body.mockMode)
  if (process.env.MOCK_AGENT === 'true' || body.mockMode === true) {
    return createMockAgentResponse(body)
  }

  // Concurrency gate — reject before opening the SSE stream so the client
  // gets a plain 409 instead of an empty event-stream.
  const slot = reserveRunSlot(body.projectId)
  if (!slot.ok) {
    return new Response(JSON.stringify({ error: 'Agent run already in progress for this project' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Abort controller — signals the runner to stop when the client disconnects
  const abortController = new AbortController()
  req.signal.addEventListener('abort', () => {
    console.log('[Agent API] Client disconnected, aborting runner')
    abortController.abort()
  })

  // SSE stream — transport wraps each event from the service in `data: ...\n\n`.
  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController<Uint8Array>
  let streamClosed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
    },
    cancel() {
      streamClosed = true
      abortController.abort()
    },
  })

  function emitToStream(event: SSEEvent) {
    if (streamClosed) {
      console.warn('[Agent API] Attempted to send after stream closed', event.type)
      return
    }
    try {
      streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    } catch (e) {
      streamClosed = true
      console.error('[Agent API] Stream write failed:', (e as Error).message)
      abortController.abort()
    }
  }

  // SSE keepalive heartbeat — prevents proxies (Cloudflare, Vercel, nginx)
  // from closing the connection during long tool executions.
  const heartbeatInterval = setInterval(() => {
    emitToStream({ type: 'heartbeat' })
  }, 20_000)

  // Hand off to the transport-agnostic runner. Do NOT await — the POST
  // returns the streaming Response immediately and the runner writes to it
  // as events happen.
  runAgentRequest({
    body,
    authenticatedUserId,
    abortSignal: abortController.signal,
    emit: emitToStream,
  }).finally(() => {
    releaseRunSlot(body.projectId)
    clearInterval(heartbeatInterval)
    try {
      streamController.close()
    } catch {
      // already closed
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ── Mock agent response for UI testing without API credits ─────────────────
//
// Keyword triggers in user message select scenario:
//   "storyboard"  → storyboard proposal + review card
//   "permission"  → tool blocked by permission (GenerationConfirmCard)
//   "error"       → error mid-stream
//   "multi"       → multi-iteration with several tool calls
//   (default)     → standard thinking → text → tool → done flow
//
// All scenarios exercise SSE parsing, streaming UI, and state management
// without touching any LLM or third-party API.

function createMockAgentResponse(body: AgentAPIRequest) {
  const encoder = new TextEncoder()
  const runId = crypto.randomUUID()
  const messageText = (typeof body.message === 'string' ? body.message : 'mock message').toLowerCase()
  const mockSceneId = body.scenes[0]?.id ?? 'mock-scene-1'

  // Pick scenario based on keywords in user message
  const scenario = messageText.includes('storyboard')
    ? 'storyboard'
    : messageText.includes('permission')
      ? 'permission'
      : messageText.includes('error')
        ? 'error'
        : messageText.includes('multi')
          ? 'multi'
          : 'default'

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
      const streamWords = async (text: string, ms = 45) => {
        for (const word of text.split(' ')) {
          send({ type: 'token', token: word + ' ' })
          await delay(ms)
        }
      }

      // ── Common preamble ──────────────────────────────────────────────
      send({ type: 'run_start', runId })
      await delay(80)

      send({
        type: 'agent_routed',
        agentType: 'director' as AgentType,
        routeMethod: 'heuristic',
        toolCount: 8,
      })
      await delay(150)

      // Thinking block (shared by all scenarios)
      send({ type: 'thinking_start' })
      const thinkingChunks = [
        'Let me analyze the request. ',
        `The user said "${messageText.slice(0, 50)}". `,
        "I'll determine the best approach ",
        'and generate the appropriate output.',
      ]
      for (const chunk of thinkingChunks) {
        send({ type: 'thinking_token', token: chunk })
        await delay(35)
      }
      send({ type: 'thinking_complete', fullThinking: thinkingChunks.join('') })
      await delay(120)

      // ── Scenario: STORYBOARD ─────────────────────────────────────────
      if (scenario === 'storyboard') {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("Great, I'll plan out a multi-scene video for you. Let me create a storyboard first.")
        await delay(200)

        // plan_scenes tool call
        send({
          type: 'tool_start',
          toolName: 'plan_scenes',
          toolInput: { prompt: messageText.slice(0, 100), targetScenes: 3 },
        })
        await delay(600)

        const mockStoryboard = {
          title: 'How Neural Networks Learn',
          scenes: [
            {
              name: 'Introduction',
              purpose: 'Hook the viewer with a compelling question',
              sceneType: 'motion',
              duration: 5,
              narrationDraft: 'Have you ever wondered how AI learns to recognize a cat?',
              visualElements: 'Animated question mark morphing into a brain icon',
            },
            {
              name: 'Forward Pass',
              purpose: 'Show data flowing through layers',
              sceneType: 'motion',
              duration: 8,
              narrationDraft: 'Data flows through layers of neurons, each one transforming the input.',
              visualElements: 'Animated network diagram with glowing data particles',
            },
            {
              name: 'Backpropagation',
              purpose: 'Explain how the network adjusts',
              sceneType: 'canvas2d',
              duration: 10,
              narrationDraft: 'The network compares its guess to the answer and adjusts its weights.',
              visualElements: 'Hand-drawn arrows flowing backwards through the network',
            },
          ],
          totalDuration: 23,
          styleNotes: 'Clean whiteboard style with blue accent colors',
          featureFlags: { narration: true, music: true, sfx: false, interactions: false },
        }

        send({
          type: 'tool_complete',
          toolName: 'plan_scenes',
          toolResult: {
            success: true,
            data: { storyboard: mockStoryboard },
          },
        })
        await delay(100)

        // Also send storyboard_proposed event (some code paths listen to this)
        send({ type: 'storyboard_proposed', storyboard: mockStoryboard as any })
        await delay(200)

        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)
        await streamWords(
          "I've created a 3-scene storyboard above. Review it and click Approve to start building, or edit the scenes first.",
        )

        const fullText =
          "Great, I'll plan out a multi-scene video for you. Let me create a storyboard first. I've created a 3-scene storyboard above. Review it and click Approve to start building, or edit the scenes first."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'plan_scenes',
              input: { prompt: messageText.slice(0, 100), targetScenes: 3 },
              output: { success: true, data: { storyboard: mockStoryboard } },
              durationMs: 600,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 4000 },
        })

        // ── Scenario: PERMISSION ─────────────────────────────────────────
      } else if (scenario === 'permission') {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("I'll add narration to your scene. Let me generate the voiceover.")
        await delay(200)

        // Tool starts then gets blocked by permission
        send({
          type: 'tool_start',
          toolName: 'generate_narration',
          toolInput: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
        })
        await delay(500)

        send({
          type: 'tool_complete',
          toolName: 'generate_narration',
          toolInput: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
          toolResult: {
            success: false,
            error: 'Permission required',
            permissionNeeded: {
              api: 'elevenLabs',
              estimatedCost: '$0.03',
              reason: 'Text-to-speech generation requires ElevenLabs API access',
              generationType: 'tts' as any,
              prompt: 'Welcome to this animated explainer.',
              provider: 'elevenlabs',
              availableProviders: [
                { id: 'elevenlabs', name: 'ElevenLabs', cost: '$0.03/request', isFree: false },
                { id: 'googleTts', name: 'Google TTS', cost: 'Free', isFree: true },
                { id: 'openaiTts', name: 'OpenAI TTS', cost: '$0.015/request', isFree: false },
              ],
              config: { voice: 'alloy', model: 'eleven_multilingual_v2' },
              toolArgs: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
            },
          },
        })
        await delay(200)

        await streamWords(
          'I need your permission to use the text-to-speech API. Please approve or choose a provider above.',
        )

        const fullText =
          "I'll add narration to your scene. Let me generate the voiceover. I need your permission to use the text-to-speech API. Please approve or choose a provider above."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_narration',
              input: { sceneId: mockSceneId, text: 'Welcome to this animated explainer.', voice: 'alloy' },
              output: { success: false, error: 'Permission required' },
              durationMs: 500,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 3000 },
        })

        // ── Scenario: ERROR ──────────────────────────────────────────────
      } else if (scenario === 'error') {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords('Let me generate that scene for you.')
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: mockSceneId, prompt: 'test scene', sceneType: 'motion' },
        })
        await delay(400)

        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: false,
            error: 'Scene generation failed: template rendering error — invalid animation keyframe at offset 240',
          },
        })
        await delay(150)

        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)
        await streamWords("The scene generation hit an error. I'll try a different approach with simpler keyframes.")
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: mockSceneId, prompt: 'test scene (simplified)', sceneType: 'motion' },
        })
        await delay(600)

        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: mockSceneId,
            changes: [
              { type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Generated simplified animation' },
            ],
          },
        })
        await delay(100)

        send({
          type: 'state_change',
          changes: [{ type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Scene updated after retry' }],
        })
        await delay(100)

        send({ type: 'preview_update', sceneId: mockSceneId })
        await delay(100)

        send({ type: 'iteration_start', iteration: 3, maxIterations: 10 })
        await delay(80)
        await streamWords('Fixed! I simplified the animation keyframes and the scene rendered successfully.')

        const fullText =
          "Let me generate that scene for you. The scene generation hit an error. I'll try a different approach with simpler keyframes. Fixed! I simplified the animation keyframes and the scene rendered successfully."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: mockSceneId, prompt: 'test scene', sceneType: 'motion' },
              output: { success: false, error: 'template rendering error' },
              durationMs: 400,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: mockSceneId, prompt: 'test scene (simplified)', sceneType: 'motion' },
              output: { success: true, affectedSceneId: mockSceneId },
              durationMs: 600,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 5000 },
        })

        // ── Scenario: MULTI (many iterations + tools) ────────────────────
      } else if (scenario === 'multi') {
        const sceneIds = body.scenes.map((s) => s.id)
        if (sceneIds.length < 2) sceneIds.push('mock-scene-2', 'mock-scene-3')

        // Sub-agent start events
        send({
          type: 'sub_agent_start',
          subAgentId: 'sub-1',
          subAgentSceneIndex: 0,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Intro Scene',
        })
        await delay(100)

        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("I'll build all your scenes. Starting with the intro.")
        await delay(200)

        // First scene generation
        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: sceneIds[0], prompt: 'intro animation', sceneType: 'motion' },
        })
        await delay(700)
        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: sceneIds[0],
            changes: [{ type: 'scene_updated' as const, sceneId: sceneIds[0], description: 'Generated intro scene' }],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [{ type: 'scene_updated' as const, sceneId: sceneIds[0], description: 'Intro scene created' }],
        })
        send({ type: 'preview_update', sceneId: sceneIds[0] })
        await delay(100)

        send({
          type: 'sub_agent_complete',
          subAgentId: 'sub-1',
          subAgentSceneIndex: 0,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Intro Scene',
          subAgentSuccess: true,
        })
        await delay(100)

        // Second scene
        send({
          type: 'sub_agent_start',
          subAgentId: 'sub-2',
          subAgentSceneIndex: 1,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Main Content',
        })
        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)

        await streamWords('Intro done. Now building the main content scene.')
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: sceneIds[1], prompt: 'main content with charts', sceneType: 'd3' },
        })
        await delay(900)
        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: sceneIds[1],
            changes: [
              { type: 'scene_updated' as const, sceneId: sceneIds[1], description: 'Generated D3 data visualization' },
            ],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [
            { type: 'scene_updated' as const, sceneId: sceneIds[1], description: 'Main content scene created' },
          ],
        })
        send({ type: 'preview_update', sceneId: sceneIds[1] })
        await delay(100)

        send({
          type: 'sub_agent_complete',
          subAgentId: 'sub-2',
          subAgentSceneIndex: 1,
          subAgentTotal: sceneIds.length,
          subAgentSceneName: 'Main Content',
          subAgentSuccess: true,
        })
        await delay(100)

        // Third scene — update global style too
        send({ type: 'iteration_start', iteration: 3, maxIterations: 10 })
        await delay(80)

        send({
          type: 'tool_start',
          toolName: 'update_style',
          toolInput: { preset: 'whiteboard', palette: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'] },
        })
        await delay(300)
        send({
          type: 'tool_complete',
          toolName: 'update_style',
          toolResult: {
            success: true,
            changes: [{ type: 'global_updated' as const, description: 'Applied whiteboard style preset' }],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [{ type: 'global_updated' as const, description: 'Style preset updated to whiteboard' }],
        })
        await delay(100)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: sceneIds[2] ?? 'mock-scene-3', prompt: 'closing scene', sceneType: 'motion' },
        })
        await delay(600)
        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: sceneIds[2] ?? 'mock-scene-3',
            changes: [
              {
                type: 'scene_created' as const,
                sceneId: sceneIds[2] ?? 'mock-scene-3',
                description: 'Created closing scene',
              },
            ],
          },
        })
        await delay(80)
        send({
          type: 'state_change',
          changes: [
            {
              type: 'scene_created' as const,
              sceneId: sceneIds[2] ?? 'mock-scene-3',
              description: 'Closing scene added',
            },
          ],
        })
        send({ type: 'preview_update', sceneId: sceneIds[2] ?? 'mock-scene-3' })
        await delay(100)

        // Final iteration with summary
        send({ type: 'iteration_start', iteration: 4, maxIterations: 10 })
        await delay(80)
        await streamWords(
          "All 3 scenes are ready! I've built an intro with Motion, a D3 data chart for the main content, and a closing animation. The whiteboard style has been applied across the project.",
        )

        const fullText =
          "I'll build all your scenes. Starting with the intro. Intro done. Now building the main content scene. All 3 scenes are ready!"
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: sceneIds[0] },
              output: { success: true, affectedSceneId: sceneIds[0] },
              durationMs: 700,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: sceneIds[1] },
              output: { success: true, affectedSceneId: sceneIds[1] },
              durationMs: 900,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'update_style',
              input: { preset: 'whiteboard' },
              output: { success: true },
              durationMs: 300,
            },
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: sceneIds[2] ?? 'mock-scene-3' },
              output: { success: true },
              durationMs: 600,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 8000 },
        })

        // ── Scenario: DEFAULT ────────────────────────────────────────────
      } else {
        send({ type: 'iteration_start', iteration: 1, maxIterations: 10 })
        await delay(80)

        await streamWords("I'll create an animated explainer scene for you. Let me generate the code now.")
        await delay(200)

        send({
          type: 'tool_start',
          toolName: 'generate_scene',
          toolInput: { sceneId: mockSceneId, prompt: messageText.slice(0, 100), sceneType: 'motion' },
        })
        await delay(800)

        send({
          type: 'tool_complete',
          toolName: 'generate_scene',
          toolResult: {
            success: true,
            affectedSceneId: mockSceneId,
            changes: [
              { type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Generated animation code' },
            ],
          },
        })
        await delay(100)

        send({
          type: 'state_change',
          changes: [
            {
              type: 'scene_updated' as const,
              sceneId: mockSceneId,
              description: 'Scene code updated with new animation',
            },
          ],
        })
        send({ type: 'preview_update', sceneId: mockSceneId })
        await delay(200)

        send({ type: 'iteration_start', iteration: 2, maxIterations: 10 })
        await delay(80)

        await streamWords(
          "Here's your animation! The scene features smooth transitions with the Motion renderer. You can preview it in the player above, or tweak it by sending another message.",
        )

        const fullText =
          "I'll create an animated explainer scene for you. Let me generate the code now. Here's your animation! The scene features smooth transitions with the Motion renderer."
        send({
          type: 'done',
          agentType: 'director' as AgentType,
          modelId: 'claude-sonnet-4-20250514' as ModelId,
          fullText,
          toolCalls: [
            {
              id: crypto.randomUUID(),
              toolName: 'generate_scene',
              input: { sceneId: mockSceneId, prompt: messageText.slice(0, 100), sceneType: 'motion' },
              output: {
                success: true,
                affectedSceneId: mockSceneId,
                changes: [
                  { type: 'scene_updated' as const, sceneId: mockSceneId, description: 'Generated animation code' },
                ],
              },
              durationMs: 800,
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, apiCalls: 0, costUsd: 0, totalDurationMs: 3000 },
        })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

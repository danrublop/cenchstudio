/**
 * SSE streaming endpoint for the Cench Studio agent system.
 *
 * POST /api/agent
 * Accepts a JSON body with message, agent settings, and current world state.
 * Streams Server-Sent Events back to the client.
 *
 * Event format: `data: <JSON>\n\n`
 */

import { NextRequest } from 'next/server'
import type { AgentType, ModelId, ModelTier, SSEEvent, ChatMessage } from '@/lib/agents/types'
import type { Scene, GlobalStyle, APIPermissions } from '@/lib/types'
import { runAgent } from '@/lib/agents/runner'

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes

export interface AgentAPIRequest {
  message: string
  agentOverride?: AgentType
  modelOverride?: ModelId | null
  modelTier?: ModelTier
  sceneContext?: 'all' | 'selected' | 'auto' | string
  activeTools?: string[]
  history?: ChatMessage[]
  projectId?: string
  // World state from client
  scenes: Scene[]
  globalStyle: GlobalStyle
  projectName: string
  outputMode: 'mp4' | 'interactive'
  selectedSceneId?: string | null
  apiPermissions?: APIPermissions
}

export async function POST(req: NextRequest) {
  let body: AgentAPIRequest

  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (!body.message || typeof body.message !== 'string') {
    return new Response('Missing required field: message', { status: 400 })
  }

  if (!body.scenes || !Array.isArray(body.scenes)) {
    return new Response('Missing required field: scenes', { status: 400 })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
    },
  })

  function sendEvent(event: SSEEvent) {
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`
      streamController.enqueue(encoder.encode(data))
    } catch {
      // Stream may be closed
    }
  }

  // Run agent asynchronously
  runAgent({
    message: body.message,
    agentOverride: body.agentOverride,
    modelOverride: body.modelOverride,
    modelTier: body.modelTier,
    sceneContext: body.sceneContext,
    activeTools: body.activeTools,
    history: body.history,
    projectId: body.projectId,
    scenes: body.scenes,
    globalStyle: body.globalStyle ?? {
      palette: ['#181818', '#121212', '#e84545', '#151515', '#f0ece0'],
      strokeWidth: 2,
      font: 'Caveat',
      duration: 8,
      theme: 'dark',
    },
    projectName: body.projectName ?? 'Untitled Project',
    outputMode: body.outputMode ?? 'mp4',
    selectedSceneId: body.selectedSceneId,
    apiPermissions: body.apiPermissions,
    emit: sendEvent,
  })
    .then(result => {
      // The 'done' event is already emitted inside runAgent.
      // Send the final updated state as a separate event for the client to apply.
      sendEvent({
        type: 'done',
        agentType: result.agentType,
        modelId: result.modelId,
        fullText: result.fullText,
        toolCalls: result.toolCalls,
        // Include updated state for client to merge
        changes: [{
          type: 'global_updated',
          description: '__state_sync__',
        }],
      })

      // Send the updated scenes/globalStyle in a separate data payload
      sendEvent({
        type: 'state_change',
        changes: [{
          type: 'global_updated',
          description: '__final_state__',
        }],
        // Attach updated state to the event
        ...({
          updatedScenes: result.updatedScenes,
          updatedGlobalStyle: result.updatedGlobalStyle,
        } as unknown as Partial<SSEEvent>),
      })
    })
    .catch(error => {
      console.error('[Agent API] Runner error:', error)
      sendEvent({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    })
    .finally(() => {
      try {
        streamController.close()
      } catch {
        // Already closed
      }
    })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

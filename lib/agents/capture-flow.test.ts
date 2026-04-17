// @vitest-environment node
/**
 * Integration test for the capture_frame server-side pipeline.
 *
 * Exercises every piece that runs without Anthropic:
 *  1. The capture_frame tool handler returns the clientAction marker
 *  2. A pending capture is created, the "client" posts the image back,
 *     the promise resolves with the posted dataUri
 *  3. buildToolResultContent turns that into an Anthropic image block
 *
 * What this does NOT cover: the Anthropic HTTP round-trip. That needs a
 * valid API key + live SDK stream. The pieces below are every line of code
 * executed on the server between "Claude wants a frame" and "Claude sees it".
 */

import { describe, it, expect } from 'vitest'
import { executeTool } from './tool-executor'
import { createPendingCapture, resolvePendingCapture } from './pending-captures'
import { buildToolResultContent, parseDataUri } from './runner'
import type { Scene, GlobalStyle, SceneGraph } from '../types'
import type { WorldStateMutable } from './tool-executor'

const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVR4nGP8z8Dwn4GBgYGJgYGBAQAVNwF4F7vRTAAAAABJRU5ErkJggg=='

function makeWorld(): WorldStateMutable {
  const scene: Scene = {
    id: 'scene-abc-123',
    name: 'Hero',
    duration: 6,
    bgColor: '#1a2b3c',
    sceneType: 'svg',
    svgContent: '<svg viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#1a2b3c"/></svg>',
    textOverlays: [{ id: 't1', content: 'Caption', x: 10, y: 80, size: 48, color: '#ff0', animation: 'none' }],
  } as unknown as Scene

  const globalStyle: GlobalStyle = {
    palette: ['#1a2b3c', '#ffffff', '#ffff00', '#ff00ff'],
  } as unknown as GlobalStyle

  const sceneGraph: SceneGraph = { nodes: [], edges: [] } as unknown as SceneGraph

  return {
    scenes: [scene],
    globalStyle,
    projectName: 'test',
    outputMode: 'mp4',
    sceneGraph,
  }
}

describe('capture_frame end-to-end pipeline', () => {
  it('returns the clientAction marker when invoked', async () => {
    const world = makeWorld()
    const result = await executeTool('capture_frame', { sceneId: 'scene-abc-123', time: 1 }, world)
    expect(result.success).toBe(true)
    const data = result.data as any
    expect(data.clientAction).toBe('capture_frame')
    expect(data.sceneId).toBe('scene-abc-123')
    expect(data.time).toBe(1)
    expect(typeof data.description).toBe('string')
    expect(data.description.length).toBeGreaterThan(0)
  })

  it('resolves the full round-trip: tool → pending capture → client post → image block', async () => {
    const world = makeWorld()

    // 1. Tool runs (this is what executeAndEmit calls)
    const result = await executeTool('capture_frame', { sceneId: 'scene-abc-123', time: 1 }, world)
    expect((result.data as any).clientAction).toBe('capture_frame')

    // 2. runner.ts creates the pending capture
    const { captureId, promise } = createPendingCapture(2000)

    // 3. The "client" receives the capture_request SSE event and POSTs back
    // (simulates what /api/agent/capture-response does)
    setTimeout(() => resolvePendingCapture(captureId, RED_PNG, 'image/png'), 10)

    // 4. runner.ts awaits the image
    const img = await promise
    expect(img.dataUri).toBe(RED_PNG)
    expect(img.mimeType).toBe('image/png')

    // 5. runner.ts attaches it to result.data
    ;(result.data as any).capturedImage = img

    // 6. recordToolResult packages content with buildToolResultContent
    const content = buildToolResultContent(result)

    expect(Array.isArray(content)).toBe(true)
    const blocks = content as Array<any>
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('text')
    expect(blocks[0].text).toContain('"success":true')
    expect(blocks[1].type).toBe('image')
    expect(blocks[1].source).toMatchObject({
      type: 'base64',
      media_type: 'image/png',
    })
    expect(blocks[1].source.data.length).toBeGreaterThan(10)
    // Exact payload survives intact
    expect(blocks[1].source.data).toBe(RED_PNG.split(',')[1])
  })

  it('falls back to JSON string when no image was captured', () => {
    const noImage = {
      success: true,
      data: { clientAction: 'capture_frame', sceneId: 'x', time: 1, description: 'text only' },
    }
    const content = buildToolResultContent(noImage as any)
    expect(typeof content).toBe('string')
    expect(content).toContain('"success":true')
  })

  it('falls back to JSON string when the dataUri is malformed', () => {
    const bad = {
      success: true,
      data: {
        clientAction: 'capture_frame',
        sceneId: 'x',
        time: 1,
        description: '...',
        capturedImage: { dataUri: 'not-a-data-uri', mimeType: 'image/png' },
      },
    }
    const content = buildToolResultContent(bad as any)
    expect(typeof content).toBe('string')
  })

  it('parseDataUri accepts each supported image media type', () => {
    for (const mt of ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const) {
      const parsed = parseDataUri(`data:${mt};base64,AAAA`)
      expect(parsed?.mediaType).toBe(mt)
      expect(parsed?.base64).toBe('AAAA')
    }
    expect(parseDataUri('data:text/plain;base64,AAAA')).toBeNull()
  })

  it('verify_scene also triggers capture_frame (visual verification)', async () => {
    const world = makeWorld()
    const result = await executeTool('verify_scene', { sceneId: 'scene-abc-123', time: 1 }, world)
    const data = result.data as any
    expect(data.clientAction).toBe('capture_frame')
    expect(data.sceneId).toBe('scene-abc-123')
  })
})

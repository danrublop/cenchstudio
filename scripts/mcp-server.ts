#!/usr/bin/env npx tsx
/**
 * Cench Studio MCP Server
 *
 * Exposes the same tools as the in-app agent via the Model Context Protocol.
 * Works with Claude Code, Cursor, Windsurf, and any MCP-compatible AI tool.
 *
 * Requires the Cench Studio dev server to be running (npm run dev).
 *
 * Usage:
 *   npx tsx scripts/mcp-server.ts                    # auto-select most recent project
 *   PROJECT_ID=abc123 npx tsx scripts/mcp-server.ts  # specific project
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

// The adapter uses HTTP only — no DB/env imports needed
import {
  executeToolCall,
  getToolDefinitions,
  loadWorldState,
  refreshWorld,
  listProjects,
  getSceneList,
  getCurrentProjectId,
  getProjectInfo,
  readScene,
} from '../lib/agents/mcp-adapter.js'

// ── Server Setup ────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'cench-studio', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
)

// ── List Tools ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getToolDefinitions()

  const mcpTools = [
    {
      name: 'select_project',
      description:
        'Select which project to work with. Lists all projects if no ID provided, or switches to the specified project.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID to switch to. Omit to list all projects.',
          },
        },
      },
    },
    {
      name: 'refresh_state',
      description: 'Reload project state from the server. Use after making changes in the app UI to sync.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'list_scenes',
      description: 'List all scenes in the current project with their IDs, names, types, and durations.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'write_scene_code',
      description: `Create or update a scene with pre-written React JSX code. Use this instead of add_layer when YOU write the scene code directly.

Pass raw JSX as sceneCode — a React function component that uses useCurrentFrame(), spring(), interpolate(), AbsoluteFill, and bridge components (ThreeJSLayer, Canvas2DLayer, D3Layer, etc). The component must export default.

If sceneId is omitted, a new scene is created. If sceneId is provided, the existing scene's code is replaced.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          sceneId: { type: 'string', description: 'Scene ID to update. Omit to create a new scene.' },
          sceneCode: {
            type: 'string',
            description: 'Raw JSX code — the React function component. Do NOT wrap in JSON.',
          },
          styles: { type: 'string', description: 'Optional CSS styles (no <style> tags).' },
          name: { type: 'string', description: 'Scene name (for new scenes).' },
          duration: { type: 'number', description: 'Duration in seconds (default 8).' },
          bgColor: { type: 'string', description: 'Background color hex (default #0a0c10).' },
          sceneType: { type: 'string', description: 'Scene type (default "react").' },
        },
        required: ['sceneCode'],
      },
    },
    {
      name: 'get_world_state',
      description:
        'Get the current project state including all scenes, global style, and project settings. Use this to refresh your context after creating or editing scenes — your initial context may be stale.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'read_scene',
      description:
        "Read a scene's full data including all layer code. Use this to inspect existing scene code before editing.",
      inputSchema: {
        type: 'object' as const,
        properties: {
          sceneId: { type: 'string', description: 'Scene ID to read.' },
        },
        required: ['sceneId'],
      },
    },
    ...tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.input_schema,
    })),
  ]

  return { tools: mcpTools }
})

// ── Call Tool ───────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'select_project') {
    const projectId = (args as any)?.projectId
    if (!projectId) {
      const projects = await listProjects()
      return {
        content: [
          {
            type: 'text' as const,
            text: `Available projects:\n${projects.map((p) => `- ${p.id} — ${p.name}`).join('\n')}\n\nCall select_project with a projectId to switch.`,
          },
        ],
      }
    }
    await loadWorldState(projectId)
    const scenes = getSceneList()
    return {
      content: [
        {
          type: 'text' as const,
          text: `Switched to project: ${projectId}\n${scenes.length} scenes loaded:\n${scenes.map((s) => `- ${s.id} — "${s.name}" (${s.type}, ${s.duration}s)`).join('\n')}`,
        },
      ],
    }
  }

  if (name === 'refresh_state') {
    await refreshWorld()
    const scenes = getSceneList()
    return {
      content: [
        {
          type: 'text' as const,
          text: `State refreshed. ${scenes.length} scenes:\n${scenes.map((s) => `- ${s.id} — "${s.name}" (${s.type}, ${s.duration}s)`).join('\n')}`,
        },
      ],
    }
  }

  if (name === 'list_scenes') {
    try {
      await loadWorldState(getCurrentProjectId() ?? undefined)
    } catch {}
    const scenes = getSceneList()
    if (!scenes.length) {
      return { content: [{ type: 'text' as const, text: 'No scenes in current project.' }] }
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: scenes.map((s, i) => `${i + 1}. ${s.id} — "${s.name}" (${s.type}, ${s.duration}s)`).join('\n'),
        },
      ],
    }
  }

  // get_world_state: Return full project state for context refresh
  if (name === 'get_world_state') {
    try {
      await refreshWorld()
      const info = getProjectInfo()
      const scenes = getSceneList()

      // Build scene type distribution
      const typeCounts: Record<string, number> = {}
      scenes.forEach((s) => {
        typeCounts[s.type] = (typeCounts[s.type] || 0) + 1
      })

      // Fetch code previews for each scene (lightweight — just first 200 chars)
      const sceneDetails = await Promise.all(
        scenes.map(async (s, i) => {
          try {
            const full = await readScene(s.id)
            const code =
              (full as any).reactCode ||
              (full as any).sceneCode ||
              (full as any).svgContent ||
              (full as any).canvasCode ||
              ''
            return {
              index: i,
              id: s.id,
              name: s.name,
              type: s.type,
              duration: s.duration,
              hasCode: !!code,
              codePreview: code ? code.slice(0, 200) + (code.length > 200 ? '...' : '') : undefined,
              hasAudio: !!(full as any).audioLayer?.enabled,
              hasInteractions: ((full as any).interactions?.length ?? 0) > 0,
            }
          } catch {
            return { index: i, id: s.id, name: s.name, type: s.type, duration: s.duration, hasCode: false }
          }
        }),
      )

      const state = {
        project: info,
        sceneCount: scenes.length,
        totalDuration: scenes.reduce((a, s) => a + s.duration, 0),
        sceneTypeMix: typeCounts,
        scenes: sceneDetails,
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(state, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to get world state: ${(err as Error).message}` }],
        isError: true,
      }
    }
  }

  // read_scene: Read full scene data including layer code
  if (name === 'read_scene') {
    const sceneId = (args as any)?.sceneId
    if (!sceneId) {
      return { content: [{ type: 'text' as const, text: 'sceneId is required.' }], isError: true }
    }
    try {
      const scene = await readScene(sceneId)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(scene, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Failed to read scene: ${(err as Error).message}` }],
        isError: true,
      }
    }
  }

  // write_scene_code: Accept pre-written JSX and set it on a scene.
  // This is the primary tool for Claude Code — it writes the code itself,
  // then passes it here (bypasses the Anthropic API-based add_layer).
  if (name === 'write_scene_code') {
    const { sceneId, sceneCode, styles, name: sceneName, duration, bgColor, sceneType } = (args as any) ?? {}
    const projectId = getCurrentProjectId()
    if (!projectId) {
      return { content: [{ type: 'text' as const, text: 'No project selected.' }], isError: true }
    }
    if (!sceneCode) {
      return {
        content: [{ type: 'text' as const, text: 'sceneCode is required — pass the raw JSX function code.' }],
        isError: true,
      }
    }
    try {
      const baseUrl = process.env.CENCH_BASE_URL || 'http://localhost:3000'
      // If no sceneId, create a new scene first
      let targetSceneId = sceneId
      if (!targetSceneId) {
        const createRes = await fetch(`${baseUrl}/api/scene`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            name: sceneName || 'Untitled Scene',
            type: sceneType || 'react',
            prompt: '',
            generatedCode: JSON.stringify({ sceneCode, styles: styles || '' }),
            duration: duration || 8,
            bgColor: bgColor || '#0a0c10',
          }),
        })
        if (!createRes.ok) {
          const err = await createRes.text()
          return { content: [{ type: 'text' as const, text: `Failed to create scene: ${err}` }], isError: true }
        }
        const createData = await createRes.json()
        targetSceneId = createData.scene?.id ?? createData.id
        await refreshWorld()
        return {
          content: [
            {
              type: 'text' as const,
              text: `Scene created: ${targetSceneId} — "${sceneName || 'Untitled Scene'}" (${duration || 8}s)\nPreview: /scenes/${targetSceneId}.html`,
            },
          ],
        }
      }
      // PATCH existing scene with new code
      const patchRes = await fetch(`${baseUrl}/api/scene`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sceneId: targetSceneId,
          generatedCode: JSON.stringify({ sceneCode, styles: styles || '' }),
          ...(sceneName ? { name: sceneName } : {}),
          ...(duration ? { duration } : {}),
          ...(bgColor ? { bgColor } : {}),
        }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.text()
        return { content: [{ type: 'text' as const, text: `Failed to update scene: ${err}` }], isError: true }
      }
      await refreshWorld()
      return {
        content: [
          {
            type: 'text' as const,
            text: `Scene updated: ${targetSceneId}\nPreview: /scenes/${targetSceneId}.html`,
          },
        ],
      }
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `write_scene_code error: ${(err as Error).message}` }],
        isError: true,
      }
    }
  }

  // Execute agent tool
  try {
    const result = await executeToolCall(name, (args as Record<string, unknown>) ?? {})
    return {
      content: [{ type: 'text' as const, text: result.content }],
      ...(result.success ? {} : { isError: true }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// ── Resources ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'cench://project/scenes',
        name: 'Current Scenes',
        description: 'List of all scenes in the current project',
        mimeType: 'application/json',
      },
      {
        uri: 'cench://project/info',
        name: 'Project Info',
        description: 'Current project ID, name, and settings',
        mimeType: 'application/json',
      },
    ],
  }
})

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri

  if (uri === 'cench://project/scenes') {
    try {
      await loadWorldState(getCurrentProjectId() ?? undefined)
    } catch {}
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(getSceneList(), null, 2) }],
    }
  }

  if (uri === 'cench://project/info') {
    const info = getProjectInfo()
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(info, null, 2),
        },
      ],
    }
  }

  throw new Error(`Unknown resource: ${uri}`)
})

// ── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const projectId = process.env.PROJECT_ID || undefined
  try {
    await loadWorldState(projectId)
    const scenes = getSceneList()
    console.error(`[cench-mcp] Loaded project ${getCurrentProjectId()} with ${scenes.length} scenes`)
  } catch (e) {
    console.error(`[cench-mcp] Warning: Could not pre-load project state. Is the dev server running?`)
    console.error(`[cench-mcp]   ${(e as Error).message}`)
    console.error(`[cench-mcp] Tools are still available — state will load on first tool call.`)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[cench-mcp] Server started on stdio')
}

main().catch((e) => {
  console.error('[cench-mcp] Fatal:', e)
  process.exit(1)
})

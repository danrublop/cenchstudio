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
      description:
        'Reload project state from the server. Use after making changes in the app UI to sync.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'list_scenes',
      description:
        'List all scenes in the current project with their IDs, names, types, and durations.',
      inputSchema: { type: 'object' as const, properties: {} },
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
    try { await loadWorldState(getCurrentProjectId() ?? undefined) } catch {}
    const scenes = getSceneList()
    if (!scenes.length) {
      return { content: [{ type: 'text' as const, text: 'No scenes in current project.' }] }
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: scenes
            .map((s, i) => `${i + 1}. ${s.id} — "${s.name}" (${s.type}, ${s.duration}s)`)
            .join('\n'),
        },
      ],
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
    try { await loadWorldState(getCurrentProjectId() ?? undefined) } catch {}
    return {
      contents: [
        { uri, mimeType: 'application/json', text: JSON.stringify(getSceneList(), null, 2) },
      ],
    }
  }

  if (uri === 'cench://project/info') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ projectId: getCurrentProjectId() }, null, 2),
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

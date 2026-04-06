/**
 * MCP Adapter — bridges MCP tool calls to the Cench Studio agent tool executor
 * via the HTTP API. This avoids importing DB modules directly, keeping the
 * MCP server lightweight and dependency-free.
 */

import { ALL_TOOLS } from './tools'
import type { ClaudeToolDefinition } from './types'

const BASE_URL = process.env.CENCH_STUDIO_URL || 'http://localhost:3000'

// ── HTTP Helpers ────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${path} — ${body}`)
  }
  return res.json()
}

// ── State ───────────────────────────────────────────────────────────────────

let currentProjectId: string | null = null
let cachedScenes: { id: string; name: string; sceneType: string; duration: number }[] = []

// ── Project Management ──────────────────────────────────────────────────────

export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const projects = await apiFetch('/api/projects')
  return projects.map((p: any) => ({ id: p.id, name: p.name }))
}

export async function loadWorldState(projectId?: string): Promise<void> {
  if (!projectId) {
    const projects = await listProjects()
    if (!projects.length) throw new Error('No projects found. Create one in the app first.')
    projectId = projects[0].id
  }

  currentProjectId = projectId

  // Load scene list
  const scenesData = await apiFetch(`/api/scene?projectId=${projectId}`)
  cachedScenes = (scenesData.scenes ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    sceneType: s.sceneType ?? 'svg',
    duration: s.duration,
  }))
}

export async function refreshWorld(): Promise<void> {
  return loadWorldState(currentProjectId ?? undefined)
}

export function getCurrentProjectId(): string | null {
  return currentProjectId
}

export function getSceneList(): { id: string; name: string; type: string; duration: number }[] {
  return cachedScenes.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.sceneType,
    duration: s.duration,
  }))
}

// ── Tool Execution ──────────────────────────────────────────────────────────

export interface MCPToolCallResult {
  success: boolean
  content: string
  data?: unknown
}

/**
 * Execute a tool call via the HTTP API endpoint.
 * The endpoint loads world state, runs the tool handler, and persists changes.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  projectId?: string,
): Promise<MCPToolCallResult> {
  const pid = projectId ?? currentProjectId
  if (!pid) throw new Error('No project selected. Call select_project first.')

  const result = await apiFetch('/api/mcp-tool', {
    method: 'POST',
    body: JSON.stringify({ projectId: pid, toolName, args }),
  })

  // Refresh scene cache after successful mutations
  if (result.success) {
    try {
      await refreshWorld()
    } catch {
      // Non-fatal
    }
  }

  return {
    success: result.success,
    content: result.content ?? result.error ?? 'Unknown result',
    data: result.data,
  }
}

// ── Tool Schema Export ──────────────────────────────────────────────────────

export function getToolDefinitions(): ClaudeToolDefinition[] {
  return ALL_TOOLS
}

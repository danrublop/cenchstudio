/**
 * MCP Adapter — bridges MCP tool calls to the Cench Studio agent tool executor
 * via the HTTP API. This avoids importing DB modules directly, keeping the
 * MCP server lightweight and dependency-free.
 */

import { ALL_TOOLS } from './tools'
import type { ClaudeToolDefinition } from './types'
import { createLogger } from '../logger'

const log = createLogger('agent.mcp-adapter')

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
let cachedProjectInfo: { name: string; outputMode: string; globalStyle: Record<string, unknown> } | null = null

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

  // Load project info
  try {
    const projects = await apiFetch('/api/projects')
    const project = projects.find((p: any) => p.id === projectId)
    if (project) {
      const desc = typeof project.description === 'string' ? JSON.parse(project.description) : project.description
      cachedProjectInfo = {
        name: project.name,
        outputMode: desc?.outputMode ?? 'mp4',
        globalStyle: desc?.globalStyle ?? {},
      }
    }
  } catch {
    // Non-fatal — project info is optional context
  }

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

export function getProjectInfo(): {
  projectId: string | null
  name: string
  outputMode: string
  globalStyle: Record<string, unknown>
} {
  return {
    projectId: currentProjectId,
    name: cachedProjectInfo?.name ?? 'Unknown',
    outputMode: cachedProjectInfo?.outputMode ?? 'mp4',
    globalStyle: cachedProjectInfo?.globalStyle ?? {},
  }
}

/** Fetch a single scene with full layer code from the API */
export async function readScene(sceneId: string): Promise<Record<string, unknown>> {
  const pid = currentProjectId
  if (!pid) throw new Error('No project selected.')
  const data = await apiFetch(`/api/scene?projectId=${pid}&sceneId=${sceneId}`)
  return data.scene ?? data
}

// ── Tool Execution ──────────────────────────────────────────────────────────

export interface MCPToolCallResult {
  success: boolean
  content: string
  data?: unknown
}

/** Tools that LLM-generate content — benefit from retry on transient failures
 *  (empty code, API timeout, rate limit, etc.). Surgical tools (reorder, patch)
 *  are NOT retried because a failure there likely indicates a real problem, not
 *  a transient one. Mirrors the in-app runner's GENERATION_TOOL_SET. */
const RETRYABLE_MCP_TOOLS = new Set([
  'add_layer',
  'regenerate_layer',
  'edit_layer',
  'write_scene_code',
  'generate_chart',
  'generate_physics_scene',
  'create_world_scene',
  'add_narration',
  'generate_avatar_narration',
  'generate_avatar_scene',
  'generate_image_from_reference',
  'generate_variation',
  'regenerate_asset',
])

/** Patterns that indicate a transient failure worth retrying. */
function isTransientError(errText: string): boolean {
  const s = (errText ?? '').toLowerCase()
  return (
    s.includes('timeout') ||
    s.includes('timed out') ||
    s.includes('rate limit') ||
    s.includes('429') ||
    s.includes('503') ||
    s.includes('504') ||
    s.includes('econnreset') ||
    s.includes('empty code') ||
    s.includes('empty response') ||
    s.includes('failed to parse')
  )
}

/**
 * Execute a tool call via the HTTP API endpoint.
 * The endpoint loads world state, runs the tool handler, and persists changes.
 * For known-flaky generation tools, retries once on transient errors.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  projectId?: string,
): Promise<MCPToolCallResult> {
  const pid = projectId ?? currentProjectId
  if (!pid) throw new Error('No project selected. Call select_project first.')

  const maxAttempts = RETRYABLE_MCP_TOOLS.has(toolName) ? 2 : 1
  let result: any
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result = await apiFetch('/api/mcp-tool', {
      method: 'POST',
      body: JSON.stringify({ projectId: pid, toolName, args }),
    })
    const shouldRetry =
      !result.success &&
      !result.permissionNeeded &&
      attempt < maxAttempts &&
      typeof result.error === 'string' &&
      isTransientError(result.error)
    if (!shouldRetry) break
    // Exponential-ish backoff with a small jitter.
    const waitMs = 400 * attempt + Math.floor(Math.random() * 250)
    log.warn('transient tool failure, retrying', {
      extra: { toolName, attempt, error: result.error?.slice(0, 120), waitMs },
    })
    await new Promise((r) => setTimeout(r, waitMs))
  }

  // Refresh scene cache after successful mutations
  if (result.success) {
    try {
      await refreshWorld()
    } catch {
      // Non-fatal
    }
  }

  // Surface permission blocks as clear, actionable messages so Claude Code
  // can inform the user (the MCP path has no interactive approval UI).
  if (result.permissionNeeded) {
    const pn = result.permissionNeeded
    return {
      success: false,
      content:
        `Permission required: ${pn.api ?? 'API'} usage needs approval.\n` +
        `Reason: ${pn.reason ?? 'Agent requested a paid API'}\n` +
        `Estimated cost: ${pn.estimatedCost ?? 'unknown'}\n\n` +
        `To approve, open the app's Settings → Permissions panel and set the API to "always allow", ` +
        `or use a free provider instead (e.g., provider: "openai-edge-tts" for TTS).`,
      data: result.data,
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

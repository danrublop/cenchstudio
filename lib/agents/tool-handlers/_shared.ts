/**
 * Shared utilities for tool handlers.
 *
 * Every handler file was duplicating ok(), err(), findScene(), and updateScene().
 * This module provides a single canonical implementation.
 */

import type { Scene } from '@/lib/types'
import type { ToolResult, StateChange } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

// Re-export types that handlers need so they can import from a single location.
export type { ToolResult } from '@/lib/agents/types'
export type { WorldStateMutable } from '@/lib/agents/tool-executor'

// ── Result helpers ───────────────────────────────────────────────────────────

/** Return a success result tied to a specific scene. */
export function ok(affectedSceneId: string | null, description: string, data?: unknown): ToolResult {
  const change: StateChange = affectedSceneId
    ? { type: 'scene_updated', sceneId: affectedSceneId, description }
    : { type: 'global_updated', description }
  return { success: true, affectedSceneId, changes: [change], data }
}

/** Return a success result for a global (non-scene) operation. */
export function okGlobal(description: string, data?: unknown): ToolResult {
  return ok(null, description, data)
}

/** Return an error result. */
export function err(message: string): ToolResult {
  return { success: false, error: message }
}

// ── World-state helpers ──────────────────────────────────────────────────────

/** Find a scene by ID, or undefined if not found. */
export function findScene(world: WorldStateMutable, sceneId: string): Scene | undefined {
  return world.scenes.find((s) => s.id === sceneId)
}

/** Find a scene or return an error result. Useful for early-return guard clauses. */
export function findSceneOrErr(world: WorldStateMutable, sceneId: string): Scene | ToolResult {
  const scene = world.scenes.find((s) => s.id === sceneId)
  if (!scene) return err(`Scene "${sceneId}" not found`)
  return scene
}

/** Update a scene in-place, returning the updated scene or null if not found. */
export function updateScene(world: WorldStateMutable, sceneId: string, updates: Partial<Scene>): Scene | null {
  const idx = world.scenes.findIndex((s) => s.id === sceneId)
  if (idx === -1) return null
  const updated = { ...world.scenes[idx], ...updates }
  // Keep D3 structured data coherent when scene type changes away from d3.
  if (updates.sceneType && updates.sceneType !== 'd3') {
    updated.chartLayers = []
    updated.d3Data = null
  }
  world.scenes[idx] = updated
  return updated
}

// ── Type guard ───────────────────────────────────────────────────────────────

/** Check whether a findSceneOrErr result is an error (ToolResult) vs a Scene. */
export function isToolError(value: Scene | ToolResult): value is ToolResult {
  return 'success' in value && !('id' in value && typeof (value as Record<string, unknown>).id === 'string')
}

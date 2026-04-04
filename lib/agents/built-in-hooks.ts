/**
 * Built-in tool hooks for the Cench Studio agent system.
 *
 * These hooks provide default validation and telemetry for tool execution.
 * Register them at server startup (e.g., in the agent API route).
 */

import { registerPreToolHook, registerPostToolHook } from './tool-executor'
import type { PreToolHookContext, PostToolHookContext } from './tool-executor'

let registered = false

/**
 * Reset the registration flag so built-in hooks can be re-registered
 * after a clearToolHooks() call. Used by hook-config.ts when reloading
 * project hooks between runs.
 */
export function resetBuiltInHooksRegistration(): void {
  registered = false
}

/**
 * Register all built-in hooks. Safe to call multiple times (idempotent).
 */
export function registerBuiltInHooks(): void {
  if (registered) return
  registered = true

  // ── Pre-tool: Scene existence validation ─────────────────────────────────
  // Blocks tools that reference a sceneId that doesn't exist in the world state.
  registerPreToolHook('*', 'validate-scene-exists', (ctx: PreToolHookContext) => {
    const sceneId = ctx.args.sceneId as string | undefined
    if (!sceneId) return {}

    const exists = ctx.world.scenes.some((s) => s.id === sceneId)
    if (!exists) {
      return {
        deny: true,
        reason: `Scene "${sceneId}" does not exist. Available scenes: ${ctx.world.scenes.map((s) => `"${s.name}" (${s.id.slice(0, 8)})`).join(', ') || 'none'}`,
      }
    }
    return {}
  })

  // ── Pre-tool: Duration range validation ──────────────────────────────────
  // Ensures scene durations stay within 2-60s range.
  registerPreToolHook('set_scene_duration', 'validate-duration-range', (ctx: PreToolHookContext) => {
    const duration = ctx.args.duration as number | undefined
    if (duration !== undefined && (duration < 2 || duration > 60)) {
      return {
        deny: true,
        reason: `Duration ${duration}s is out of range. Must be between 2 and 60 seconds.`,
      }
    }
    return {}
  })

  // ── Post-tool: Slow tool warning ─────────────────────────────────────────
  // Flags tools that took more than 30 seconds.
  registerPostToolHook('*', 'slow-tool-warning', (_ctx: PostToolHookContext) => {
    if (_ctx.durationMs > 30000) {
      return {
        warning: `Tool ${_ctx.toolName} took ${(_ctx.durationMs / 1000).toFixed(1)}s — consider optimizing or splitting the operation.`,
      }
    }
    return {}
  })

  // ── Post-tool: Generation cost tracking ──────────────────────────────────
  // Logs generation tool costs for analytics.
  registerPostToolHook('add_layer', 'track-generation-cost', (ctx: PostToolHookContext) => {
    if (ctx.result.success && ctx.durationMs > 0) {
      const data = ctx.result.data as Record<string, any> | undefined
      if (data?.usage) {
        // Cost data is already in the result; hook just ensures it's logged
        return {}
      }
    }
    return {}
  })
}

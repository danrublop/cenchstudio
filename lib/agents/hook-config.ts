/**
 * Declarative hook configuration for the agent tool pipeline.
 *
 * Allows SDK users and project configs to register hooks via JSON config
 * rather than code. Supports two hook types:
 *   - webhook: POST to an external URL with tool context
 *   - inline:  JavaScript executed in a sandboxed Node.js vm context
 *
 * Hooks are loaded at the start of each agent run and cleared between runs.
 */

import { registerPreToolHook, registerPostToolHook, removeHooksByName } from './tool-executor'
import type { PreToolHookContext, PreToolHookResult, PostToolHookContext, PostToolHookResult } from './tool-executor'
import vm from 'vm'

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeclaredHook {
  /** Human-readable hook name for logging */
  name: string
  /** Tool name pattern: exact tool name or '*' for all tools */
  toolPattern: string
  /** Hook type: webhook calls an external URL, inline runs JS in a sandbox */
  type: 'webhook' | 'inline'
  /** Webhook URL (required when type is 'webhook') */
  url?: string
  /** JavaScript code body (required when type is 'inline'). Receives `ctx` as the context object.
   *  Must return an object: { deny?: boolean, reason?: string, modifiedArgs?: object }
   *  for pre-tool hooks, or { warning?: string } for post-tool hooks. */
  code?: string
  /** Timeout in ms (default: 5000). Hook is skipped if it exceeds this. */
  timeout?: number
  /** Hook phase: pre (before tool execution) or post (after). Default: 'pre'. */
  phase?: 'pre' | 'post'
}

export interface HookConfig {
  preToolUse?: DeclaredHook[]
  postToolUse?: DeclaredHook[]
}

// ── Validation ──────────────────────────────────────────────────────────────

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

// ── Webhook Execution ───────────────────────────────────────────────────────

async function executeWebhook(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { error: `Webhook returned ${res.status}` }
    }
    return (await res.json()) as Record<string, unknown>
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { error: 'Webhook timed out' }
    }
    return { error: (err as Error).message }
  } finally {
    clearTimeout(timer)
  }
}

// ── Inline (Sandboxed) Execution ────────────────────────────────────────────

function executeInlineSandboxed(
  code: string,
  ctx: Record<string, unknown>,
  timeoutMs: number,
): Record<string, unknown> {
  // Provide safe utility globals but block access to process/require/import
  const sandbox = {
    ctx,
    result: {} as Record<string, unknown>,
    // Safe globals for hook authors
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    // Block dangerous globals
    process: undefined,
    require: undefined,
    global: undefined,
    globalThis: undefined,
  }

  try {
    const script = new vm.Script(`result = (function(ctx) { ${code} })(ctx);`)
    const context = vm.createContext(sandbox)
    script.runInContext(context, { timeout: timeoutMs })
    return sandbox.result ?? {}
  } catch (err) {
    return { error: `Inline hook error: ${(err as Error).message}` }
  }
}

// ── Hook Registration ───────────────────────────────────────────────────────

function wrapPreHook(hook: DeclaredHook): (ctx: PreToolHookContext) => Promise<PreToolHookResult> {
  const timeoutMs = hook.timeout ?? 5000

  return async (ctx) => {
    const payload = {
      event: 'PreToolUse',
      toolName: ctx.toolName,
      args: ctx.args,
    }

    let response: Record<string, unknown>

    if (hook.type === 'webhook' && hook.url) {
      if (!isValidWebhookUrl(hook.url)) {
        console.warn(`[hook:${hook.name}] Invalid webhook URL: ${hook.url}`)
        return {}
      }
      response = await executeWebhook(hook.url, payload, timeoutMs)
    } else if (hook.type === 'inline' && hook.code) {
      response = executeInlineSandboxed(hook.code, payload, timeoutMs)
    } else {
      return {} // misconfigured hook, skip
    }

    if (response.error) {
      // Hook errors don't block execution — log as warning
      console.warn(`[hook:${hook.name}] Error: ${response.error}`)
      return {}
    }

    return {
      deny: response.deny === true,
      reason: typeof response.reason === 'string' ? response.reason : undefined,
      modifiedArgs: response.modifiedArgs as Record<string, unknown> | undefined,
    }
  }
}

function wrapPostHook(hook: DeclaredHook): (ctx: PostToolHookContext) => Promise<PostToolHookResult> {
  const timeoutMs = hook.timeout ?? 5000

  return async (ctx) => {
    const payload = {
      event: 'PostToolUse',
      toolName: ctx.toolName,
      args: ctx.args,
      result: { success: ctx.result.success, data: ctx.result.data },
      durationMs: ctx.durationMs,
    }

    let response: Record<string, unknown>

    if (hook.type === 'webhook' && hook.url) {
      if (!isValidWebhookUrl(hook.url)) {
        console.warn(`[hook:${hook.name}] Invalid webhook URL: ${hook.url}`)
        return {}
      }
      response = await executeWebhook(hook.url, payload, timeoutMs)
    } else if (hook.type === 'inline' && hook.code) {
      response = executeInlineSandboxed(hook.code, payload, timeoutMs)
    } else {
      return {}
    }

    if (response.error) {
      console.warn(`[hook:${hook.name}] Error: ${response.error}`)
      return {}
    }

    return {
      warning: typeof response.warning === 'string' ? response.warning : undefined,
    }
  }
}

/**
 * Load hooks from a declarative HookConfig.
 *
 * Returns cleanup function that removes only the user-configured hooks.
 * Built-in hooks (registered once at module load) are left untouched.
 * This is safe for concurrent agent runs — each run manages its own
 * user hooks via the returned cleanup function.
 *
 * Usage:
 *   const cleanup = loadProjectHooks(config)
 *   try { await runAgent(...) } finally { cleanup() }
 */
export function loadProjectHooks(config?: HookConfig): () => void {
  if (!config) return () => {}

  const registeredNames: string[] = []

  // Register user-configured pre-tool hooks
  if (config.preToolUse) {
    for (const hook of config.preToolUse) {
      const name = `user:${hook.name}`
      registerPreToolHook(hook.toolPattern, name, wrapPreHook(hook))
      registeredNames.push(name)
    }
  }

  // Register user-configured post-tool hooks
  if (config.postToolUse) {
    for (const hook of config.postToolUse) {
      const name = `user:${hook.name}`
      registerPostToolHook(hook.toolPattern, name, wrapPostHook(hook))
      registeredNames.push(name)
    }
  }

  // Return cleanup function that removes only hooks registered by this call
  return () => {
    removeHooksByName(registeredNames)
  }
}

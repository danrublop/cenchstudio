/**
 * Agent Commands Plugin — SDK contribution for imessage-kit.
 *
 * Full command framework with multi-step flows, typed arguments,
 * per-contact permissions, and middleware chains. Supersedes the
 * simple command-parser for production agent use cases.
 *
 * Usage:
 *   const cmds = createAgentCommandsPlugin({ sendReply: (to, text) => sdk.send(to, text) })
 *   sdk.use(cmds)
 *
 *   cmds.register({
 *     name: 'deploy',
 *     description: 'Deploy to an environment',
 *     permissions: ['admin'],
 *     args: [{ name: 'env', type: 'choice', choices: ['staging', 'prod'], required: true }],
 *     handler: async (args, ctx) => `Deploying to ${args.named.env}...`,
 *   })
 *
 * Contribution target: @photon-ai/imessage-kit core or plugin registry
 */

import type { DataLayer } from './data-layer.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentCommandsOptions {
  prefix?: string // command prefix, default '/'
  sendReply?: (to: string, text: string) => Promise<void>
  permissionCheck?: (contactId: string, permission: string) => boolean
  flowTimeout?: number // ms before an active flow expires, default 300000 (5 min)
  dataLayer?: DataLayer // optional, for persisting permissions
}

export interface ArgDefinition {
  name: string
  type: 'string' | 'number' | 'boolean' | 'choice'
  required?: boolean
  default?: unknown
  choices?: string[] // for type 'choice'
  description?: string
  prompt?: string // question to ask if arg is missing in interactive mode
}

export interface ParsedArgs {
  positional: string[]
  named: Record<string, string | number | boolean>
  raw: string
}

export interface FlowStep {
  name: string
  prompt: string | ((context: FlowContext) => string)
  validate?: (input: string, context: FlowContext) => string | null
  transform?: (input: string) => unknown
  skipIf?: (context: FlowContext) => boolean
}

export interface FlowDefinition {
  steps: FlowStep[]
  onComplete: (context: FlowContext) => Promise<string | void>
  onCancel?: (context: FlowContext) => Promise<string | void>
}

export interface FlowContext {
  contactId: string
  commandName: string
  stepData: Record<string, unknown>
  currentStep: number
  startedAt: Date
}

export type Middleware = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>

export interface MiddlewareContext {
  contactId: string
  commandName: string
  args: ParsedArgs
  message: any
  reply: (text: string) => Promise<void>
}

export type CommandExecutor = (
  args: ParsedArgs,
  ctx: { contactId: string; message: any; reply: (text: string) => Promise<void> },
) => Promise<string | void>

export interface AgentCommand {
  name: string
  description: string
  aliases?: string[]
  args?: ArgDefinition[]
  permissions?: string[]
  middleware?: Middleware[]
  handler?: CommandExecutor // simple single-step handler
  flow?: FlowDefinition // multi-step flow (mutually exclusive with handler)
}

// ── State ──────────────────────────────────────────────────────────────────

const commands = new Map<string, AgentCommand>()
const aliasMap = new Map<string, string>() // alias → canonical name
const globalMiddleware: Middleware[] = []

interface ActiveFlow {
  context: FlowContext
  flow: FlowDefinition
  command: AgentCommand
  timeoutId: ReturnType<typeof setTimeout>
}

const activeFlows = new Map<string, ActiveFlow>() // contactId → active flow

// Permission store (in-memory, optionally backed by DataLayer)
const permissions = new Map<string, Set<string>>() // contactId → permissions

let _opts: AgentCommandsOptions = {}

// ── Argument Parsing ───────────────────────────────────────────────────────

function parseArgs(raw: string, defs?: ArgDefinition[]): ParsedArgs {
  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
  const positional: string[] = []
  const named: Record<string, string | number | boolean> = {}

  for (const token of tokens) {
    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=')
      if (eqIdx > 0) {
        const key = token.substring(2, eqIdx)
        const val = token.substring(eqIdx + 1).replace(/^"|"$/g, '')
        named[key] = val
      } else {
        const key = token.substring(2)
        named[key] = true
      }
    } else {
      positional.push(token.replace(/^"|"$/g, ''))
    }
  }

  // Map positional args to ArgDefinition names
  if (defs) {
    const positionalDefs = defs.filter((d) => !d.name.startsWith('-'))
    for (let i = 0; i < positionalDefs.length && i < positional.length; i++) {
      const def = positionalDefs[i]
      named[def.name] = coerceArg(positional[i], def)
    }

    // Apply defaults
    for (const def of defs) {
      if (!(def.name in named) && def.default !== undefined) {
        named[def.name] = def.default as string | number | boolean
      }
    }
  }

  return { positional, named, raw }
}

function coerceArg(value: string, def: ArgDefinition): string | number | boolean {
  switch (def.type) {
    case 'number': {
      const n = Number(value)
      return isNaN(n) ? value : n
    }
    case 'boolean':
      return value === 'true' || value === '1' || value === 'yes'
    case 'choice':
      return value.toLowerCase()
    default:
      return value
  }
}

function validateArgs(args: ParsedArgs, defs?: ArgDefinition[]): string | null {
  if (!defs) return null

  for (const def of defs) {
    const val = args.named[def.name]
    if (def.required && (val === undefined || val === '')) {
      return `Missing required argument: ${def.name}${def.description ? ` (${def.description})` : ''}`
    }
    if (def.type === 'choice' && val !== undefined && def.choices) {
      if (!def.choices.includes(String(val).toLowerCase())) {
        return `Invalid value for ${def.name}: "${val}". Must be one of: ${def.choices.join(', ')}`
      }
    }
  }

  return null
}

// ── Middleware Runner ───────────────────────────────────────────────────────

async function runMiddleware(chain: Middleware[], ctx: MiddlewareContext, handler: () => Promise<void>): Promise<void> {
  let idx = 0
  const next = async (): Promise<void> => {
    if (idx < chain.length) {
      const mw = chain[idx++]
      await mw(ctx, next)
    } else {
      await handler()
    }
  }
  await next()
}

// ── Flow Management ────────────────────────────────────────────────────────

function startFlow(
  contactId: string,
  command: AgentCommand,
  flow: FlowDefinition,
  reply: (text: string) => Promise<void>,
): void {
  // Cancel existing flow if any
  cancelFlow(contactId)

  const context: FlowContext = {
    contactId,
    commandName: command.name,
    stepData: {},
    currentStep: 0,
    startedAt: new Date(),
  }

  // Set timeout
  const timeout = _opts.flowTimeout ?? 5 * 60 * 1000
  const timeoutId = setTimeout(async () => {
    activeFlows.delete(contactId)
    await reply('flow timed out, start over if you need to').catch(() => {})
  }, timeout)

  activeFlows.set(contactId, { context, flow, command, timeoutId })

  // Send first step prompt (skip steps that should be skipped)
  advanceFlow(contactId, reply).catch(() => {})
}

async function advanceFlow(contactId: string, reply: (text: string) => Promise<void>): Promise<void> {
  const active = activeFlows.get(contactId)
  if (!active) return

  const { context, flow } = active

  // Skip steps that meet skipIf condition
  while (context.currentStep < flow.steps.length) {
    const step = flow.steps[context.currentStep]
    if (step.skipIf && step.skipIf(context)) {
      context.currentStep++
      continue
    }
    break
  }

  if (context.currentStep >= flow.steps.length) {
    // All steps done — complete
    clearTimeout(active.timeoutId)
    activeFlows.delete(contactId)
    const result = await flow.onComplete(context)
    if (result) await reply(result)
    return
  }

  const step = flow.steps[context.currentStep]
  const promptText = typeof step.prompt === 'function' ? step.prompt(context) : step.prompt
  await reply(promptText)
}

async function handleFlowResponse(
  contactId: string,
  input: string,
  reply: (text: string) => Promise<void>,
): Promise<boolean> {
  const active = activeFlows.get(contactId)
  if (!active) return false

  // Cancel keywords
  const lower = input.trim().toLowerCase()
  if (lower === 'cancel' || lower === '/cancel' || lower === 'quit') {
    clearTimeout(active.timeoutId)
    activeFlows.delete(contactId)
    if (active.flow.onCancel) {
      const result = await active.flow.onCancel(active.context)
      if (result) await reply(result)
    } else {
      await reply('cancelled')
    }
    return true
  }

  const step = active.flow.steps[active.context.currentStep]

  // Validate
  if (step.validate) {
    const error = step.validate(input, active.context)
    if (error) {
      await reply(error)
      return true
    }
  }

  // Transform and store
  let value: unknown = input
  if (step.transform) {
    try {
      value = step.transform(input)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invalid input'
      await reply(msg)
      return true
    }
  }
  active.context.stepData[step.name] = value
  active.context.currentStep++

  // Advance to next step
  await advanceFlow(contactId, reply)
  return true
}

// ── Public API ─────────────────────────────────────────────────────────────

export function registerAgentCommand(cmd: AgentCommand): void {
  const name = cmd.name.toLowerCase()
  commands.set(name, cmd)
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      aliasMap.set(alias.toLowerCase(), name)
    }
  }
}

export function unregisterAgentCommand(name: string): void {
  const canonical = name.toLowerCase()
  const cmd = commands.get(canonical)
  if (cmd?.aliases) {
    for (const alias of cmd.aliases) {
      aliasMap.delete(alias.toLowerCase())
    }
  }
  commands.delete(canonical)
}

export function getAgentCommands(): AgentCommand[] {
  return Array.from(commands.values())
}

export function getAgentCommand(name: string): AgentCommand | undefined {
  const canonical = aliasMap.get(name.toLowerCase()) ?? name.toLowerCase()
  return commands.get(canonical)
}

export function grantPermission(contactId: string, permission: string): void {
  let perms = permissions.get(contactId)
  if (!perms) {
    perms = new Set()
    permissions.set(contactId, perms)
  }
  perms.add(permission.toLowerCase())

  // Persist if dataLayer available
  if (_opts.dataLayer) {
    const store = _opts.dataLayer.scope('agent-commands')
    store.set(contactId, 'permissions', Array.from(perms))
  }
}

export function revokePermission(contactId: string, permission: string): void {
  const perms = permissions.get(contactId)
  if (!perms) return
  perms.delete(permission.toLowerCase())

  if (_opts.dataLayer) {
    const store = _opts.dataLayer.scope('agent-commands')
    store.set(contactId, 'permissions', Array.from(perms))
  }
}

export function hasPermission(contactId: string, permission: string): boolean {
  // Check custom permission callback first
  if (_opts.permissionCheck) {
    return _opts.permissionCheck(contactId, permission)
  }
  const perms = permissions.get(contactId)
  return perms?.has(permission.toLowerCase()) ?? false
}

export function cancelFlow(contactId: string): boolean {
  const active = activeFlows.get(contactId)
  if (!active) return false
  clearTimeout(active.timeoutId)
  activeFlows.delete(contactId)
  return true
}

export function getActiveFlow(contactId: string): FlowContext | null {
  return activeFlows.get(contactId)?.context ?? null
}

export function useGlobalMiddleware(mw: Middleware): void {
  globalMiddleware.push(mw)
}

function generateCommandsHelp(): string {
  const cmds = getAgentCommands()
  if (cmds.length === 0) return 'No commands registered.'
  const prefix = _opts.prefix ?? '/'
  const lines = cmds.map((c) => {
    const aliases = c.aliases?.length ? ` (${c.aliases.map((a) => prefix + a).join(', ')})` : ''
    const perms = c.permissions?.length ? ` [${c.permissions.join(', ')}]` : ''
    return `  ${prefix}${c.name}${aliases}${perms} — ${c.description}`
  })
  return `Available commands:\n${lines.join('\n')}`
}

// ── Plugin Factory ─────────────────────────────────────────────────────────

export function createAgentCommandsPlugin(opts?: AgentCommandsOptions) {
  _opts = opts ?? {}
  const prefix = _opts.prefix ?? '/'

  // Load persisted permissions from dataLayer
  if (_opts.dataLayer) {
    const store = _opts.dataLayer.scope('agent-commands')
    const contacts = _opts.dataLayer.getContactsWithKey('agent-commands', 'permissions')
    for (const contactId of contacts) {
      const perms = store.get<string[]>(contactId, 'permissions')
      if (perms && Array.isArray(perms)) {
        permissions.set(contactId, new Set(perms))
      }
    }
  }

  // Register built-in /commands help
  registerAgentCommand({
    name: 'commands',
    description: 'List all available commands',
    aliases: ['cmds'],
    handler: async () => generateCommandsHelp(),
  })

  const plugin = {
    name: 'agent-commands',
    version: '1.0.0',
    description: 'Multi-step command framework with flows, permissions, and middleware',

    // Expose API on the plugin object for external access
    register: registerAgentCommand,
    unregister: unregisterAgentCommand,
    commands: getAgentCommands,
    command: getAgentCommand,
    grant: grantPermission,
    revoke: revokePermission,
    hasPermission,
    cancelFlow,
    getActiveFlow,
    useMiddleware: useGlobalMiddleware,

    async onNewMessage(msg: any) {
      const text: string = (msg.text ?? '').trim()
      const sender = msg.sender ?? msg.handle ?? ''
      if (!text || !sender || msg.isReaction) return

      const reply = async (replyText: string) => {
        if (_opts.sendReply) {
          await _opts.sendReply(sender, replyText)
        }
      }

      // Step 1: Check if contact has an active flow
      if (activeFlows.has(sender)) {
        await handleFlowResponse(sender, text, reply)
        return
      }

      // Step 2: Check if message is a command
      if (!text.startsWith(prefix)) return

      const spaceIdx = text.indexOf(' ')
      const cmdName = (spaceIdx === -1 ? text : text.substring(0, spaceIdx)).substring(prefix.length).toLowerCase()
      const rawArgs = spaceIdx === -1 ? '' : text.substring(spaceIdx + 1).trim()

      // Resolve command (check name and aliases)
      const canonical = aliasMap.get(cmdName) ?? cmdName
      const cmd = commands.get(canonical)
      if (!cmd) return // Unknown command — don't consume, let other plugins handle

      // Step 3: Check permissions
      if (cmd.permissions && cmd.permissions.length > 0) {
        const missing = cmd.permissions.filter((p) => !hasPermission(sender, p))
        if (missing.length > 0) {
          await reply(`permission denied (need: ${missing.join(', ')})`)
          return
        }
      }

      // Step 4: Parse and validate arguments
      const args = parseArgs(rawArgs, cmd.args)
      const argError = validateArgs(args, cmd.args)
      if (argError) {
        await reply(argError)
        return
      }

      // Step 5: Start flow or execute handler
      if (cmd.flow) {
        startFlow(sender, cmd, cmd.flow, reply)
        return
      }

      if (cmd.handler) {
        const mwCtx: MiddlewareContext = {
          contactId: sender,
          commandName: cmd.name,
          args,
          message: msg,
          reply,
        }

        const allMiddleware = [...globalMiddleware, ...(cmd.middleware ?? [])]

        await runMiddleware(allMiddleware, mwCtx, async () => {
          const result = await cmd.handler!(args, {
            contactId: sender,
            message: msg,
            reply,
          })
          if (result) await reply(result)
        })
      }
    },

    onDestroy() {
      // Clear all active flows
      for (const [, active] of activeFlows) {
        clearTimeout(active.timeoutId)
      }
      activeFlows.clear()
      commands.clear()
      aliasMap.clear()
      globalMiddleware.length = 0
    },
  }

  return plugin
}

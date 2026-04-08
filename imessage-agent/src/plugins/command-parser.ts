/**
 * Command Parser Plugin — SDK contribution for imessage-kit.
 *
 * Registers /slash commands and routes them to handlers.
 * Provides a clean API for building command-driven iMessage agents.
 *
 * Usage:
 *   const parser = createCommandParser()
 *   parser.register('/chart', async (args, msg) => { ... })
 *   parser.register('/help', async (args, msg) => { ... })
 *   sdk.use(parser.plugin())
 */

export interface CommandMessage {
  sender: string
  text: string
  guid?: string
  chatId?: string
}

export type CommandHandler = (args: string, msg: CommandMessage) => Promise<string | void>

interface RegisteredCommand {
  name: string
  description: string
  handler: CommandHandler
}

const commands = new Map<string, RegisteredCommand>()
let fallbackHandler: CommandHandler | null = null

/**
 * Register a /slash command.
 */
export function registerCommand(name: string, handler: CommandHandler, description = ''): void {
  // Normalize: ensure leading slash
  const cmd = name.startsWith('/') ? name.toLowerCase() : `/${name.toLowerCase()}`
  commands.set(cmd, { name: cmd, description, handler })
}

/**
 * Register a fallback handler for messages that aren't commands.
 */
export function setFallback(handler: CommandHandler): void {
  fallbackHandler = handler
}

/**
 * Parse a message and return the matched command + args, if any.
 */
export function parseCommand(text: string): { command: string; args: string } | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return null

  const spaceIdx = trimmed.indexOf(' ')
  const command = (spaceIdx === -1 ? trimmed : trimmed.substring(0, spaceIdx)).toLowerCase()
  const args = spaceIdx === -1 ? '' : trimmed.substring(spaceIdx + 1).trim()

  if (!commands.has(command)) return null
  return { command, args }
}

/**
 * Process a message — runs the command handler if it matches.
 * Returns the handler's response string, or null if no command matched.
 */
export async function processCommand(text: string, msg: CommandMessage): Promise<string | null> {
  const parsed = parseCommand(text)

  if (parsed) {
    const cmd = commands.get(parsed.command)!
    const result = await cmd.handler(parsed.args, msg)
    return result ?? null
  }

  if (fallbackHandler) {
    const result = await fallbackHandler(text, msg)
    return result ?? null
  }

  return null
}

/**
 * List all registered commands (useful for /help).
 */
export function listCommands(): Array<{ name: string; description: string }> {
  return Array.from(commands.values()).map((c) => ({
    name: c.name,
    description: c.description,
  }))
}

/**
 * Generate a help text listing all commands.
 */
export function generateHelp(prefix = 'Available commands:'): string {
  const cmds = listCommands()
  if (cmds.length === 0) return 'No commands registered.'
  const lines = cmds.map((c) => `  ${c.name}${c.description ? ` — ${c.description}` : ''}`)
  return `${prefix}\n${lines.join('\n')}`
}

/**
 * Create an imessage-kit compatible plugin.
 * The plugin intercepts messages starting with "/" and routes them.
 */
export function createCommandParserPlugin(opts?: { onReply?: (to: string, text: string) => Promise<void> }) {
  return {
    name: 'command-parser',
    async onNewMessage(msg: any) {
      const text = msg.text ?? msg.body ?? ''
      if (!text.startsWith('/')) return

      const cmdMsg: CommandMessage = {
        sender: msg.sender ?? msg.handle ?? '',
        text,
        guid: msg.guid,
        chatId: msg.chatId,
      }

      const response = await processCommand(text, cmdMsg)
      if (response && opts?.onReply) {
        await opts.onReply(cmdMsg.sender, response)
      }
    },
  }
}

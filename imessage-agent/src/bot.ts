/**
 * Cench Bot — message router and command dispatcher.
 *
 * Routes incoming iMessages to the appropriate command handler,
 * manages concurrency (one generation per contact), and delivers results.
 */

import { getLastScenes } from './conversation-store.js'
import { checkStudioHealth, checkRenderHealth } from './cench-client.js'
import { getProgress } from './utils/progress.js'
import { handleExplain } from './commands/explain.js'
import { handleEdit } from './commands/edit.js'
import { handleChart } from './commands/chart.js'
import { handleBriefing } from './commands/briefing.js'
import { handleTest } from './commands/test.js'
import type { CommandContext, CommandResult } from './commands/types.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface MessageSender {
  sendText: (to: string, text: string) => Promise<void>
  sendFile: (to: string, filePath: string, caption?: string) => Promise<void>
  sendReaction: (to: string, messageGuid: string, reaction: string) => Promise<void>
}

export interface IncomingMessage {
  sender: string
  text: string
  isFromMe: boolean
  isSelfChat?: boolean
  chatId?: string
  guid?: string
}

// ── Contact Allowlist ─────────────────────────────────────────────────────

const ALLOWED_CONTACTS: Set<string> | null = process.env.ALLOWED_CONTACTS
  ? new Set(process.env.ALLOWED_CONTACTS.split(',').map((c) => c.trim().toLowerCase()))
  : null

function isContactAllowed(contactId: string): boolean {
  if (!ALLOWED_CONTACTS) return true // No allowlist → allow all
  return ALLOWED_CONTACTS.has(contactId.toLowerCase())
}

// ── Trigger Detection ─────────────────────────────────────────────────────

const SLASH_COMMANDS = ['/chart', '/help', '/clear', '/briefing', '/progress', '/test']

function extractTrigger(text: string): { triggered: boolean; cleanText: string } {
  const trimmed = text.trim()

  // Slash commands are always triggered
  const lowerTrimmed = trimmed.toLowerCase()
  if (SLASH_COMMANDS.some((cmd) => lowerTrimmed.startsWith(cmd))) {
    return { triggered: true, cleanText: trimmed }
  }

  // @cench anywhere in text → triggered, strip it out
  const atMention = /@cench\b/i
  if (atMention.test(trimmed)) {
    const cleaned = trimmed
      .replace(atMention, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return { triggered: true, cleanText: cleaned || 'help' }
  }

  return { triggered: false, cleanText: trimmed }
}

// ── Concurrency & Rate Limiting ────────────────────────────────────────────

interface ContactQueue {
  running: Promise<void> | null
  pending: Array<() => Promise<void>>
}

const contactQueues = new Map<string, ContactQueue>()
const MAX_QUEUED_PER_CONTACT = 2 // Max jobs waiting in queue per contact
const GLOBAL_CONCURRENT_LIMIT = 3 // Max simultaneous generations across all contacts
const GLOBAL_WAIT_TIMEOUT_MS = 10 * 60 * 1000 // 10 min max wait for a slot

function activeJobCount(): number {
  let count = 0
  for (const q of contactQueues.values()) {
    if (q.running) count++
  }
  return count
}

function drainQueue(contactId: string): void {
  const queue = contactQueues.get(contactId)
  if (!queue) return

  // If something is still running, wait for it to finish
  if (queue.running) return

  const next = queue.pending.shift()
  if (!next) {
    // Nothing left — clean up
    contactQueues.delete(contactId)
    return
  }

  queue.running = next()
}

// ── Intent Classification ──────────────────────────────────────────────────

type Intent = 'briefing' | 'chart' | 'edit' | 'explain' | 'help' | 'clear' | 'progress' | 'test'

function classifyIntent(text: string, contactId: string): Intent {
  const lower = text.trim().toLowerCase()

  // Help
  if (lower === 'help' || lower === '/help') return 'help'

  // Clear history
  if (lower === 'clear' || lower === '/clear' || lower === 'reset') return 'clear'

  // Progress check
  if (lower === 'progress' || lower === '/progress' || lower === 'status') return 'progress'

  // Test render pipeline
  if (lower === 'test' || lower === '/test') return 'test'

  // Daily briefing
  if (/^(good\s*morning|gm|briefing|daily|morning|good\s*afternoon|good\s*evening)/i.test(lower)) {
    return 'briefing'
  }

  // Chart
  if (/^(\/chart\s|chart:\s*)/i.test(lower)) return 'chart'

  // Edit — if we have existing scenes and message looks like a modification
  const hasExistingScenes = getLastScenes(contactId).length > 0
  if (hasExistingScenes && isEditIntent(lower)) return 'edit'

  // Default: explain
  return 'explain'
}

function isEditIntent(text: string): boolean {
  const editPatterns = [
    /^(make|change|update|modify|adjust|fix|tweak|edit)\s/,
    /^(add|remove|delete|replace)\s/,
    /\b(shorter|longer|faster|slower|bigger|smaller)\b/,
    /\b(more|less)\s+(detail|animation|color|text)\b/,
    /^(can you|could you|please)\s+(make|change|update|fix)/,
    /\b(instead|rather|different)\b/,
  ]
  return editPatterns.some((p) => p.test(text))
}

// ── Message Handler ────────────────────────────────────────────────────────

export async function handleMessage(msg: IncomingMessage, sender: MessageSender): Promise<void> {
  // Skip own messages — unless it's a self-chat (note-to-self) or testing
  if (msg.isFromMe && !msg.isSelfChat && process.env.ALLOW_SELF !== '1') return

  const text = msg.text?.trim()
  if (!text) return

  const contactId = msg.sender

  // Contact allowlist check
  if (!isContactAllowed(contactId)) return

  // Trigger detection — ignore messages without @cench or a slash command
  const { triggered, cleanText } = extractTrigger(text)
  if (!triggered) {
    console.log(`   [skip] no trigger in: "${text.slice(0, 40)}"`)
    return
  }

  // Build reaction helper — tries to react, returns true if successful
  const reactToMessage = async (): Promise<boolean> => {
    if (!msg.guid) return false
    try {
      await sender.sendReaction(contactId, msg.guid, 'like')
      return true
    } catch {
      return false
    }
  }

  // Build context
  const ctx: CommandContext = {
    contactId,
    message: cleanText,
    messageGuid: msg.guid,
    sendReply: (reply: string) => sender.sendText(contactId, reply),
    sendFile: (path: string, caption?: string) => sender.sendFile(contactId, path, caption),
    reactToMessage,
  }

  // Handle simple commands that don't need generation
  const intent = classifyIntent(cleanText, contactId)

  if (intent === 'help') {
    await sender.sendText(
      contactId,
      `Cench — animated video via iMessage

text me @cench + what you want explained and I'll make an animated video

commands:
  @cench [topic] — animated explainer
  chart: [topic] — data visualization
  good morning — daily briefing
  make it shorter / change colors — edit last video
  /progress — check generation status
  clear — reset conversation

examples:
  @cench how does WiFi work
  @cench chart: global CO2 emissions
  @cench make it 5 seconds shorter`,
    )
    return
  }

  if (intent === 'clear') {
    const { clearHistory, setLastScenes } = await import('./conversation-store.js')
    clearHistory(contactId)
    setLastScenes(contactId, [])
    await sender.sendText(contactId, 'cleared, fresh start')
    return
  }

  if (intent === 'progress') {
    const current = getProgress(contactId)
    if (current) {
      await sender.sendText(contactId, `currently ${current}`)
    } else {
      await sender.sendText(contactId, 'nothing running right now')
    }
    return
  }

  // Get or create the contact's queue
  let queue = contactQueues.get(contactId)
  if (!queue) {
    queue = { running: null, pending: [] }
    contactQueues.set(contactId, queue)
  }

  // Check per-contact queue cap
  if (queue.running && queue.pending.length >= MAX_QUEUED_PER_CONTACT) {
    await sender.sendText(contactId, 'too many in the queue, hold on a bit')
    return
  }

  if (queue.running) {
    await sender.sendText(contactId, "still working on the last one, I'll get to this next")
  }

  // Enqueue the job (it will wait for global slot + then run)
  const jobFn = async () => {
    // Wait for a global slot if needed
    if (activeJobCount() > GLOBAL_CONCURRENT_LIMIT) {
      // Already counted as active via queue.running, so check > not >=
      // Wait for any running job across all contacts to finish
      const deadline = Date.now() + GLOBAL_WAIT_TIMEOUT_MS
      while (activeJobCount() > GLOBAL_CONCURRENT_LIMIT) {
        const runningJobs = Array.from(contactQueues.values())
          .map((q) => q.running)
          .filter((r): r is Promise<void> => r !== null)
        if (runningJobs.length === 0) break
        const timeout = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('global queue timeout')), Math.max(0, deadline - Date.now())),
        )
        await Promise.race([...runningJobs, timeout]).catch(() => {})
        if (Date.now() >= deadline) {
          await ctx.sendReply('waited too long for a slot, try again later')
          return
        }
      }
    }
    await processCommand(intent, ctx, sender)
  }

  if (!queue.running) {
    // No job running — start immediately
    queue.running = jobFn().finally(() => {
      queue!.running = null
      drainQueue(contactId)
    })
  } else {
    // Queue it behind the current job
    queue.pending.push(() =>
      jobFn().finally(() => {
        queue!.running = null
        drainQueue(contactId)
      }),
    )
  }
}

async function processCommand(intent: Intent, ctx: CommandContext, _msgSender: MessageSender): Promise<void> {
  console.log(`   [bot] intent=${intent} contact=${ctx.contactId.slice(0, 15)}`)

  // Health check before expensive operations
  const [studioOk, renderOk] = await Promise.all([checkStudioHealth(), checkRenderHealth()])

  console.log(`   [bot] health: studio=${studioOk} render=${renderOk}`)

  if (!studioOk) {
    console.log('   [bot] BLOCKED: studio offline')
    await ctx.sendReply('studio server is offline -- make sure Next.js is running on port 3000')
    return
  }

  if (!renderOk) {
    console.log('   [bot] BLOCKED: render server offline')
    await ctx.sendReply("render server is offline -- make sure it's running on port 3001")
    return
  }

  // Dispatch to handler
  console.log(`   [bot] dispatching to ${intent} handler...`)
  let result: CommandResult

  switch (intent) {
    case 'briefing':
      result = await handleBriefing(ctx)
      break
    case 'chart':
      result = await handleChart(ctx)
      break
    case 'edit':
      result = await handleEdit(ctx)
      break
    case 'test':
      result = await handleTest(ctx)
      break
    case 'explain':
    default:
      result = await handleExplain(ctx)
      break
  }

  console.log(`   [bot] result: success=${result.success} mp4=${!!result.mp4Path} error=${result.error ?? 'none'}`)

  // Send the MP4 if we got one
  if (result.success && result.mp4Path) {
    try {
      console.log(`   [bot] sending video: ${result.mp4Path}`)
      await ctx.sendFile(result.mp4Path, result.caption)
      console.log('   [bot] video sent!')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`   [bot] send failed: ${errMsg}`)
      await ctx.sendReply(`video's ready but couldn't send it: ${errMsg}`)
    }

    // Clean up temp file
    const { unlink } = await import('fs/promises')
    unlink(result.mp4Path).catch(() => {})
  } else if (!result.success && result.error) {
    await ctx.sendReply(result.error)
  }
}

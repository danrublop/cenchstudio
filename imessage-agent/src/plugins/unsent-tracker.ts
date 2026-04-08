/**
 * Unsent Message Tracker Plugin — SDK contribution for imessage-kit.
 *
 * Detects when previously-seen messages are unsent (deleted by sender).
 * Caches incoming messages by GUID and compares against subsequent
 * query results to detect text→null transitions.
 *
 * Also detects message edits (text changed to a different non-null value).
 *
 * Usage:
 *   sdk.use(createUnsentTrackerPlugin())
 *   onUnsent((event) => console.log(`${event.sender} unsent: "${event.originalText}"`))
 *
 * Contribution target: @photon-ai/imessage-kit core or plugin registry
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface UnsentEvent {
  type: 'unsent'
  guid: string
  originalText: string
  sender: string
  chatId: string
  originalDate: Date
  detectedAt: Date
}

export interface EditEvent {
  type: 'edited'
  guid: string
  originalText: string
  newText: string
  sender: string
  chatId: string
  originalDate: Date
  detectedAt: Date
}

interface SeenMessage {
  guid: string
  text: string
  sender: string
  chatId: string
  firstSeenAt: Date
}

export type UnsentHandler = (event: UnsentEvent) => void
export type EditHandler = (event: EditEvent) => void

export interface UnsentTrackerOptions {
  maxCacheSize?: number // default 2000
  onUnsent?: UnsentHandler
  onEdit?: EditHandler
}

// ── State ──────────────────────────────────────────────────────────────────

const seenMessages = new Map<string, SeenMessage>()
let unsentHandlers: UnsentHandler[] = []
let editHandlers: EditHandler[] = []
const unsentHistory: UnsentEvent[] = []
const MAX_HISTORY = 200

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Subscribe to unsent message events. Returns unsubscribe function.
 */
export function onUnsent(handler: UnsentHandler): () => void {
  unsentHandlers.push(handler)
  return () => {
    unsentHandlers = unsentHandlers.filter((h) => h !== handler)
  }
}

/**
 * Subscribe to message edit events. Returns unsubscribe function.
 */
export function onEdit(handler: EditHandler): () => void {
  editHandlers.push(handler)
  return () => {
    editHandlers = editHandlers.filter((h) => h !== handler)
  }
}

/**
 * Get history of unsent messages, optionally filtered by chatId.
 */
export function getUnsentMessages(chatId?: string): UnsentEvent[] {
  if (chatId) return unsentHistory.filter((e) => e.chatId === chatId)
  return [...unsentHistory]
}

/**
 * Look up the original text of a message by GUID (whether unsent or not).
 */
export function getOriginalText(guid: string): string | null {
  const seen = seenMessages.get(guid)
  if (seen) return seen.text
  const unsent = unsentHistory.find((e) => e.guid === guid)
  return unsent?.originalText ?? null
}

// ── Internal ───────────────────────────────────────────────────────────────

function cacheMessage(msg: any): void {
  if (!msg.guid || msg.isReaction) return
  const text = msg.text ?? null
  if (text === null) return // Don't cache messages that already have no text

  if (seenMessages.has(msg.guid)) return // Already cached

  // Evict oldest entry if cache is full
  if (seenMessages.size >= maxCacheSize) {
    const oldest = seenMessages.keys().next().value!
    seenMessages.delete(oldest)
  }

  seenMessages.set(msg.guid, {
    guid: msg.guid,
    text,
    sender: msg.sender ?? '',
    chatId: msg.chatId ?? '',
    firstSeenAt: msg.date ?? new Date(),
  })
}

function checkForUnsends(messages: readonly any[]): void {
  for (const msg of messages) {
    if (!msg.guid) continue
    const cached = seenMessages.get(msg.guid)
    if (!cached) continue

    const currentText = msg.text ?? null

    if (currentText === null && cached.text) {
      // Message was unsent
      const event: UnsentEvent = {
        type: 'unsent',
        guid: cached.guid,
        originalText: cached.text,
        sender: cached.sender,
        chatId: cached.chatId,
        originalDate: cached.firstSeenAt,
        detectedAt: new Date(),
      }

      // Store in history (bounded)
      unsentHistory.push(event)
      if (unsentHistory.length > MAX_HISTORY) unsentHistory.shift()

      // Remove from seen cache
      seenMessages.delete(msg.guid)

      // Notify handlers
      for (const handler of unsentHandlers) {
        try {
          handler(event)
        } catch {
          /* don't let handler errors crash the plugin */
        }
      }

      console.log(`🗑️ Unsent: ${event.sender} removed "${event.originalText.slice(0, 50)}"`)
    } else if (currentText !== null && currentText !== cached.text) {
      // Message was edited
      const event: EditEvent = {
        type: 'edited',
        guid: cached.guid,
        originalText: cached.text,
        newText: currentText,
        sender: cached.sender,
        chatId: cached.chatId,
        originalDate: cached.firstSeenAt,
        detectedAt: new Date(),
      }

      // Update cache with new text
      cached.text = currentText

      // Notify handlers
      for (const handler of editHandlers) {
        try {
          handler(event)
        } catch {
          /* don't let handler errors crash the plugin */
        }
      }

      console.log(
        `✏️ Edited: ${event.sender} changed "${event.originalText.slice(0, 30)}" → "${event.newText.slice(0, 30)}"`,
      )
    }
  }
}

// ── Plugin Factory ─────────────────────────────────────────────────────────

let maxCacheSize = 2000

export function createUnsentTrackerPlugin(opts?: UnsentTrackerOptions) {
  maxCacheSize = opts?.maxCacheSize ?? 2000

  if (opts?.onUnsent) onUnsent(opts.onUnsent)
  if (opts?.onEdit) onEdit(opts.onEdit)

  return {
    name: 'unsent-tracker',
    version: '1.0.0',
    description: 'Detects unsent and edited iMessages by tracking seen message GUIDs',

    onNewMessage(msg: any) {
      cacheMessage(msg)
    },

    onAfterQuery(messages: readonly any[]) {
      // Cache any new messages from queries
      for (const msg of messages) cacheMessage(msg)
      // Check for unsends/edits in the query results
      checkForUnsends(messages)
    },

    onDestroy() {
      seenMessages.clear()
      unsentHistory.length = 0
      unsentHandlers = []
      editHandlers = []
    },
  }
}

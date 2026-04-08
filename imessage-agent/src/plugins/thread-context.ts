/**
 * Thread Context Plugin — SDK contribution for imessage-kit.
 *
 * Tracks iMessage reply chains by monitoring the thread_originator fields
 * in the messages database. Provides context-aware message grouping.
 *
 * This enables agents to understand conversation threads and maintain
 * context across reply chains without re-reading the full history.
 */

interface ThreadMessage {
  guid: string
  sender: string
  text: string
  timestamp: Date
  replyToGuid: string | null
}

// In-memory thread cache — maps root message GUID to thread messages
const threads = new Map<string, ThreadMessage[]>()

// Maps any message GUID to its root thread GUID for fast lookup
const messageToThread = new Map<string, string>()

/**
 * Register a message into the thread tracking system.
 * Call this for every incoming message.
 */
export function trackMessage(msg: {
  guid: string
  sender: string
  text: string
  date?: Date
  thread_originator_guid?: string
}): string | null {
  const threadMsg: ThreadMessage = {
    guid: msg.guid,
    sender: msg.sender,
    text: msg.text,
    timestamp: msg.date ?? new Date(),
    replyToGuid: msg.thread_originator_guid ?? null,
  }

  if (msg.thread_originator_guid) {
    // This is a reply — find or create thread under the root
    const rootGuid = messageToThread.get(msg.thread_originator_guid) ?? msg.thread_originator_guid

    if (!threads.has(rootGuid)) {
      threads.set(rootGuid, [])
    }
    threads.get(rootGuid)!.push(threadMsg)
    messageToThread.set(msg.guid, rootGuid)

    return rootGuid
  } else {
    // This is a standalone message or thread starter
    messageToThread.set(msg.guid, msg.guid)
    threads.set(msg.guid, [threadMsg])
    return null
  }
}

/**
 * Get all messages in a thread by any message GUID in that thread.
 */
export function getThread(messageGuid: string): ThreadMessage[] {
  const rootGuid = messageToThread.get(messageGuid) ?? messageGuid
  return threads.get(rootGuid) ?? []
}

/**
 * Get a compressed context string for a thread — useful for feeding
 * into an LLM without wasting tokens on full message objects.
 */
export function getThreadContext(messageGuid: string, maxMessages = 10): string {
  const thread = getThread(messageGuid)
  if (thread.length === 0) return ''

  const recent = thread.slice(-maxMessages)
  return recent.map((m) => `${m.sender}: ${m.text}`).join('\n')
}

/**
 * Get thread depth (how many replies deep we are).
 */
export function getThreadDepth(messageGuid: string): number {
  const rootGuid = messageToThread.get(messageGuid) ?? messageGuid
  const thread = threads.get(rootGuid)
  return thread ? thread.length : 0
}

/**
 * Prune old threads to prevent unbounded memory growth.
 * Call periodically (e.g., every hour).
 */
export function pruneThreads(maxAgeMs = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs
  let pruned = 0

  for (const [rootGuid, messages] of threads) {
    const latest = messages[messages.length - 1]
    if (latest && latest.timestamp.getTime() < cutoff) {
      // Remove all GUID mappings for this thread
      for (const msg of messages) {
        messageToThread.delete(msg.guid)
      }
      threads.delete(rootGuid)
      pruned++
    }
  }

  return pruned
}

/**
 * Create an imessage-kit compatible plugin object.
 */
export function createThreadContextPlugin() {
  // Prune old threads every hour
  const pruneInterval = setInterval(() => pruneThreads(), 60 * 60 * 1000)

  return {
    name: 'thread-context',
    onNewMessage(msg: any) {
      // Skip reactions — they also use associatedMessageGuid but aren't thread replies
      if (msg.isReaction) return

      trackMessage({
        guid: msg.guid ?? `${Date.now()}`,
        sender: msg.sender ?? '',
        text: msg.text ?? '',
        date: msg.date,
        // The SDK exposes associatedMessageGuid for replies/reactions
        thread_originator_guid: msg.associatedMessageGuid,
      })
    },
    destroy() {
      clearInterval(pruneInterval)
    },
  }
}

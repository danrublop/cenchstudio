# Photon SDK Contributions

Plugins built for `@photon-ai/imessage-kit` during Cench Studio iMessage agent development. Each is self-contained, follows the SDK plugin interface, and is designed for upstream contribution.

All plugins are in `src/plugins/`.

---

## 1. Tapback Tracker (`tapback-tracker.ts`)

Detects and tracks iMessage reactions (tapbacks) as structured events. Enables preference learning from user reactions — e.g., if a user "loves" a generated video, the agent can remember that style.

**What it does:**

- Intercepts messages where `isReaction === true`
- Extracts reaction type (`love`, `like`, `laugh`, `dislike`, `emphasize`, `question`)
- Detects reaction removals via `isReactionRemoval`
- Resolves the target message via `associatedMessageGuid`
- Persists reactions to a store (SQLite in our case)
- Emits `TapbackEvent` objects to registered handlers

**API surface:**

- `createTapbackPlugin()` — returns SDK-compatible plugin
- `onTapback(handler)` — subscribe to tapback events, returns unsubscribe function

**SDK hooks used:** `onNewMessage`

**Example use case:**

```ts
import { onTapback } from './plugins/tapback-tracker'

onTapback((event) => {
  if (event.reaction === 'love') {
    // User loved the last video — save style preference
    savePreference(event.sender, 'preferred_style', lastStyle)
  }
})
```

---

## 2. Thread Context (`thread-context.ts`)

Tracks iMessage reply chains by monitoring `thread_originator_guid` / `associatedMessageGuid`. Provides compressed thread summaries for LLM context windows without re-reading full conversation history.

**What it does:**

- Builds an in-memory thread graph mapping reply GUIDs to root messages
- Groups messages by conversation thread
- Generates compressed context strings for LLM input
- Auto-prunes threads older than 24 hours (hourly interval)
- Exposes thread depth for detecting deep reply chains

**API surface:**

- `createThreadContextPlugin()` — returns SDK-compatible plugin with auto-pruning
- `trackMessage(msg)` — manually register a message into thread tracking
- `getThread(guid)` — get all messages in a thread by any message GUID
- `getThreadContext(guid, maxMessages?)` — compressed `"sender: text"` format for LLM context
- `getThreadDepth(guid)` — how many replies deep a message is
- `pruneThreads(maxAgeMs?)` — manual cleanup of old threads

**SDK hooks used:** `onNewMessage`, `destroy`

**Example use case:**

```ts
import { getThreadContext } from './plugins/thread-context'

// When handling a reply, get the conversation context
const context = getThreadContext(msg.guid, 10)
// → "Alice: explain quantum computing\nBot: Here's a video...\nAlice: make it shorter"
```

---

## 3. Command Parser (`command-parser.ts`)

A `/slash` command router for building command-driven iMessage agents. Registers command handlers, parses incoming messages, and auto-generates help text.

**What it does:**

- Routes messages starting with `/` to registered handlers
- Extracts command name and arguments
- Supports a fallback handler for non-command messages
- Auto-generates `/help` text from registered commands
- Sends replies via configurable callback

**API surface:**

- `createCommandParserPlugin(opts?)` — returns SDK-compatible plugin
- `registerCommand(name, handler, description?)` — register a `/slash` command
- `setFallback(handler)` — handler for messages that don't match any command
- `parseCommand(text)` — parse without executing (returns `{ command, args }`)
- `processCommand(text, msg)` — parse and execute the matching handler
- `listCommands()` — list all registered commands
- `generateHelp(prefix?)` — generate formatted help text

**SDK hooks used:** `onNewMessage`

**Example use case:**

```ts
import { registerCommand, createCommandParserPlugin } from './plugins/command-parser'

registerCommand(
  '/weather',
  async (args) => {
    const forecast = await getWeather(args || 'auto')
    return `Weather for ${args}: ${forecast}`
  },
  'Get weather forecast',
)

registerCommand(
  '/remind',
  async (args, msg) => {
    await scheduleReminder(msg.sender, args)
    return 'Reminder set!'
  },
  'Set a reminder',
)

sdk.use(
  createCommandParserPlugin({
    onReply: (to, text) => sdk.send(to, text),
  }),
)
```

---

## 4. Self-Chat Detector (`self-chat-detector.ts`)

Detects when a message comes from a self-chat (texting yourself / note-to-self). In iMessage, `isFromMe` is `true` for all outgoing messages, but it doesn't distinguish between "I sent this to someone else" and "I'm messaging myself." This plugin solves that.

**What it does:**

- Learns the current user's identity by observing outgoing messages (`isFromMe → sender`)
- When an incoming message arrives from a known self-identity, annotates it with `isSelfChat: true`
- Supports pre-seeding identities via `addSelfIdentity()` for instant detection
- Enables agents to respond to self-messages (useful for testing and personal assistant use cases)

**API surface:**

- `createSelfChatPlugin()` — returns SDK-compatible plugin
- `addSelfIdentity(id)` — manually register a phone number or Apple ID as "self"
- `isSelf(sender)` — check if a sender is the current user
- `getSelfIdentities()` — list all known self identities

**SDK hooks used:** `onNewMessage`

**Why this matters for the SDK:**
The `isFromMe` flag alone is insufficient for agents. An agent running on your Mac needs to distinguish:

- Messages you send to others (should be ignored)
- Messages you send to yourself (should be processed — it's a command)

This should ideally be a core SDK feature: a `Message.isSelfChat` boolean, or a `sdk.getSelfIdentity()` method. The plugin is a userland workaround until that exists.

**Example use case:**

```ts
import { createSelfChatPlugin, addSelfIdentity } from './plugins/self-chat-detector'

// Pre-seed your identity for instant detection
addSelfIdentity('daniel@icloud.com')
addSelfIdentity('+15551234567')

sdk.use(createSelfChatPlugin())

sdk.startWatching({
  onDirectMessage: (msg) => {
    if (msg.isSelfChat) {
      // This is a note-to-self — treat as a command
      handleCommand(msg.text)
    }
  },
})
```

---

## 5. Data Layer (`data-layer.ts`)

Generic per-contact key-value store with namespace scoping. Replaces ad-hoc persistence patterns with a shared SQLite backend that any plugin can use.

**What it does:**

- Provides a namespaced KV store (`namespace + contactId + key → JSON value`)
- Supports ordered list operations (push, get, remove)
- Auto-tracks contact metadata (lastSeen, messageCount) on each message
- Scoped accessors prevent namespace collisions between plugins

**API surface:**

- `createDataLayerPlugin(opts?)` — returns plugin with `.dataLayer` property
- `dataLayer.scope(namespace)` — get a namespace-scoped store
- `ScopedStore.get<T>(contactId, key)`, `.set()`, `.delete()`, `.getAll()`, `.deleteAll()`
- `ScopedStore.getGlobal<T>(key)`, `.setGlobal()` — non-contact data (uses `_global`)
- `ScopedStore.listPush()`, `.listGet()`, `.listRemove()` — ordered collections
- `dataLayer.getContactsWithKey(namespace, key)` — query which contacts have a key

**SDK hooks used:** `onInit`, `onNewMessage`, `onDestroy`

---

## 6. Unsent Message Tracker (`unsent-tracker.ts`)

Detects when previously-seen messages are unsent (deleted by sender) or edited. Caches incoming messages by GUID and compares against subsequent query results.

**What it does:**

- Caches every incoming message's GUID and text (bounded at 2000 entries, LRU eviction)
- On `onAfterQuery`, compares cached messages against current state
- If a known GUID now has `text === null`, emits an `UnsentEvent`
- If text changed to a different non-null value, emits an `EditEvent`
- Maintains a bounded history of unsent messages

**API surface:**

- `createUnsentTrackerPlugin(opts?)` — returns SDK-compatible plugin
- `onUnsent(handler)` — subscribe to unsent events, returns unsubscribe
- `onEdit(handler)` — subscribe to edit events, returns unsubscribe
- `getUnsentMessages(chatId?)` — retrieve unsent message history
- `getOriginalText(guid)` — look up what a message originally said

**SDK hooks used:** `onNewMessage`, `onAfterQuery`, `onDestroy`

**Example use case:**

```ts
import { onUnsent } from './plugins/unsent-tracker'

onUnsent((event) => {
  console.log(`${event.sender} deleted: "${event.originalText}"`)
  // Could notify, log for moderation, or update context
})
```

---

## 7. Contact Tagger (`contact-tagger.ts`)

Per-contact tagging system for routing, filtering, and permissions. Tags are persisted in SQLite.

**What it does:**

- CRUD operations on contact tags (many-to-many: contacts ↔ tags)
- Auto-tags first-time contacts with configurable default tags
- Tag-based filtering with required/excluded tag matching
- Persists to SQLite with indexed lookups

**API surface:**

- `createContactTaggerPlugin(opts?)` — returns SDK-compatible plugin
- `addTag(contactId, tag)`, `removeTag(contactId, tag)`
- `getTags(contactId)` — all tags for a contact
- `getContactsByTag(tag)` — all contacts with a tag
- `hasTag(contactId, tag)` — check membership
- `setTags(contactId, tags[])` — atomic replace
- `getAllTags()` — list all unique tags in use
- `matchesTags(contactId, required, excluded?)` — filter matching

**SDK hooks used:** `onInit`, `onNewMessage`, `onDestroy`

**Example use case:**

```ts
import { addTag, hasTag, getContactsByTag } from './plugins/contact-tagger'

addTag('+15551234567', 'vip')
addTag('+15551234567', 'team')

if (hasTag(sender, 'vip')) {
  // Priority handling
}

const teamMembers = getContactsByTag('team')
```

---

## 8. Notes Bridge (`notes-bridge.ts`)

Read/write Apple Notes via AppleScript. Gives iMessage agents a persistent scratchpad outside the chat — leave notes, read them back, search across notes.

**What it does:**

- Creates, reads, appends to, lists, deletes, and searches Apple Notes
- Serializes AppleScript calls to avoid overwhelming Notes.app
- Strips HTML from note bodies for plain-text consumption
- Escapes special characters to prevent AppleScript injection
- Optionally auto-captures `note:` prefixed messages

**API surface:**

- `createNotesBridgePlugin(opts?)` — returns SDK-compatible plugin
- `createNote(title, body, folder?)` — create a note
- `readNote(title, folder?)` — read a note by title
- `appendToNote(title, text, folder?)` — append or create
- `listNotes(folder?)` — list notes in a folder
- `deleteNote(title, folder?)` — delete a note
- `searchNotes(query)` — search across all notes
- `ensureFolder(name)` — create folder if missing

**SDK hooks used:** `onInit`, `onNewMessage`

**Example use case:**

```ts
import { createNote, readNote, appendToNote } from './plugins/notes-bridge'

// Agent leaves a note for the user
await createNote("Today's Summary", 'Generated 3 videos, 2 charts')

// User sends "note: remember to fix the chart colors"
// → auto-captured and appended to "Notes from +1555..." note
```

---

## 9. Agent Commands (`agent-commands.ts`)

Full command framework with multi-step flows, typed arguments, per-contact permissions, and middleware chains. A production-grade superset of command-parser.

**What it does:**

- Registers commands with typed argument definitions (`string | number | boolean | choice`)
- Parses positional args + `--named=value` flags
- Multi-step interactive flows with validation, transforms, and skip conditions
- Per-contact permissions with optional DataLayer persistence
- Middleware chains (global + per-command) for logging, rate limiting, etc.
- Flow timeout with auto-cancellation (default 5 min)
- Built-in `/commands` help command

**API surface:**

- `createAgentCommandsPlugin(opts?)` — returns plugin with API methods
- `plugin.register(cmd)` — register a command
- `plugin.grant(contactId, perm)`, `plugin.revoke()`, `plugin.hasPermission()`
- `plugin.cancelFlow(contactId)`, `plugin.getActiveFlow(contactId)`
- `plugin.useMiddleware(mw)` — add global middleware

**SDK hooks used:** `onNewMessage`, `onDestroy`

**Example — simple command:**

```ts
cmds.register({
  name: 'ping',
  description: 'Check if the agent is alive',
  handler: async () => 'pong',
})
```

**Example — multi-step flow:**

```ts
cmds.register({
  name: 'deploy',
  description: 'Deploy to an environment',
  permissions: ['admin'],
  flow: {
    steps: [
      {
        name: 'env',
        prompt: 'Which environment? (staging / production)',
        validate: (input) =>
          ['staging', 'production'].includes(input.toLowerCase()) ? null : 'Must be staging or production',
      },
      {
        name: 'confirm',
        prompt: (ctx) => `Deploy to ${ctx.stepData.env}? (yes/no)`,
        validate: (input) => (['yes', 'no'].includes(input.toLowerCase()) ? null : 'yes or no'),
      },
    ],
    onComplete: async (ctx) => {
      if (ctx.stepData.confirm === 'no') return 'Cancelled.'
      return `Deploying to ${ctx.stepData.env}...`
    },
  },
})
```

---

## Contribution Notes

**Plugin interface compatibility:** All plugins implement the `Plugin` interface from `@photon-ai/imessage-kit` v2.1.2:

```ts
interface Plugin {
  name: string
  version?: string
  description?: string
  onInit?: () => void | Promise<void>
  onNewMessage?: (message: Message) => void | Promise<void>
  onAfterQuery?: (messages: readonly Message[]) => void | Promise<void>
  onBeforeSend?: (to, content) => void | Promise<void>
  onAfterSend?: (to, result) => void | Promise<void>
  onError?: (error: Error, context?: string) => void | Promise<void>
  onDestroy?: () => void | Promise<void>
}
```

**Registration:** All plugins are registered via `sdk.use(plugin)`.

**Dependencies:**

- Tapback tracker: SQLite via `conversation-store.ts`
- Data layer, contact tagger: SQLite via `better-sqlite3` (self-contained)
- Notes bridge: macOS `osascript` (AppleScript)
- Agent commands: optional DataLayer for permission persistence
- Thread context, command parser, self-chat detector, unsent tracker: no external dependencies

# Photon iMessage Application

**Turn iMessage into an AI agent platform.** Built on [`@photon-ai/imessage-kit`](https://github.com/photon-hq/imessage-kit) — a type-safe iMessage SDK for macOS.

This is a full reference implementation of a Photon-powered application: an iMessage agent that generates animated explainer videos through [Cench Studio](../README.md). Text it a topic, get back an MP4.

```
You: "@cench how does WiFi work"
Bot: [likes your message]
Bot: [sends 12-second animated explainer video]
```

---

## What this application does

The Cench iMessage Agent bridges Apple's iMessage to an AI video generation pipeline. When someone texts your Mac, the agent:

1. **Receives** the message via Photon SDK (polls `chat.db` every 2s)
2. **Routes** it through plugins (tapback tracking, thread context, command parsing)
3. **Classifies** the intent (explain, chart, briefing, edit, or system command)
4. **Generates** an animated scene via the Cench Studio agent API
5. **Renders** the scene to MP4 via Puppeteer + FFmpeg
6. **Sends** the video back over iMessage via AppleScript

All of this runs locally on macOS — no cloud, no server, no app to install.

---

## Architecture

```
                        ┌─────────────────────────────────────────────────┐
                        │              Photon SDK (imessage-kit)          │
                        │                                                 │
  iMessage ──────────►  │  chat.db (SQLite read) ──► poll ──► onNewMessage │
                        │  osascript (AppleScript) ◄── send ◄── sendFile  │
                        │                                                 │
                        │  ┌─────────────────────────────────────────┐    │
                        │  │              Plugin Chain                │    │
                        │  │                                         │    │
                        │  │  self-chat-detector                     │    │
                        │  │  tapback-tracker                        │    │
                        │  │  thread-context                         │    │
                        │  │  unsent-tracker                         │    │
                        │  │  contact-tagger                         │    │
                        │  │  notes-bridge                           │    │
                        │  │  command-parser                         │    │
                        │  │  agent-commands                         │    │
                        │  │  data-layer                             │    │
                        │  └─────────────────────────────────────────┘    │
                        └────────────────────┬────────────────────────────┘
                                             │
                                             ▼
                        ┌─────────────────────────────────────────────────┐
                        │              Bot Router (bot.ts)                 │
                        │                                                 │
                        │  trigger detection ──► intent classification    │
                        │  concurrency queue ──► command dispatch          │
                        │  contact allowlist ──► health checks             │
                        └────────────────────┬────────────────────────────┘
                                             │
                          ┌──────────┬───────┴────────┬──────────┐
                          ▼          ▼                ▼          ▼
                       explain    chart          briefing     edit
                          │          │                │          │
                          └──────────┴───────┬────────┴──────────┘
                                             │
                                             ▼
                        ┌─────────────────────────────────────────────────┐
                        │         Cench Studio (localhost:3000)            │
                        │         POST /api/agent (SSE stream)            │
                        └────────────────────┬────────────────────────────┘
                                             │
                                             ▼
                        ┌─────────────────────────────────────────────────┐
                        │         Render Server (localhost:3001)           │
                        │         Puppeteer + FFmpeg ──► MP4               │
                        └────────────────────┬────────────────────────────┘
                                             │
                                             ▼
                                      MP4 sent via iMessage
```

---

## Setup

### Prerequisites

- **macOS** with Full Disk Access enabled (System Settings > Privacy > Full Disk Access > Terminal)
- **Node.js 18+** or Bun
- Cench Studio running locally (`npm run dev`)
- Render server running (`cd render-server && npm start`)

### Install

```bash
cd imessage-agent
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required — Cench Studio and render server URLs
CENCH_STUDIO_URL=http://localhost:3000
RENDER_SERVER_URL=http://localhost:3001

# Optional — restrict who can use the agent
ALLOWED_CONTACTS=+15551234567,friend@icloud.com

# Optional — your Apple ID for self-chat testing
SELF_ID=you@icloud.com,+15559876543

# Optional — weather API for daily briefings
WEATHER_API_KEY=your_weatherapi_key

# Optional — override the LLM model
IMESSAGE_MODEL=claude-sonnet-4-6
```

### Run

```bash
# Start all three processes:

# Terminal 1 — Cench Studio
npm run dev

# Terminal 2 — Render server
cd render-server && npm start

# Terminal 3 — iMessage Agent
cd imessage-agent && npm start
```

The agent will start polling for iMessages. Text `@cench` followed by any topic to your Mac's phone number or Apple ID.

### Mock mode (no iMessage needed)

For development without iMessage access:

```bash
cd imessage-agent
MOCK=1 npm start
```

This opens a stdin/stdout chat interface. Prefix messages with `@cench` or use `/commands` — mock mode does not auto-inject triggers, so you test the exact same message flow as real iMessage.

---

## Commands

| Input                                       | What happens                         |
| ------------------------------------------- | ------------------------------------ |
| `@cench [topic]`                            | Animated explainer video             |
| `@cench chart: [topic]` or `/chart [topic]` | Data visualization video             |
| `good morning` / `gm` / `briefing`          | Animated daily briefing with weather |
| `make it shorter` / `change the colors`     | Edit the last generated video        |
| `/progress` or `status`                     | Check current generation status      |
| `/help` or `help`                           | Show available commands              |
| `/clear` or `clear` or `reset`              | Reset conversation history           |
| `/test`                                     | Test the full render pipeline        |

The agent responds to `@cench` mentions and `/slash` commands. Messages without a trigger are ignored.

---

## How the Photon SDK is used

### Initialization

```typescript
import { IMessageSDK } from '@photon-ai/imessage-kit'

const sdk = new IMessageSDK({
  watcher: {
    pollInterval: 2000, // check for new messages every 2s
    excludeOwnMessages: true, // ignore messages you send to others
    unreadOnly: false,
  },
  debug: false,
})
```

### Plugin registration

Plugins are registered via `sdk.use()` and hook into the SDK lifecycle:

```typescript
// Foundation layer
sdk.use(createDataLayerPlugin())

// Message processing
sdk.use(createSelfChatPlugin())
sdk.use(createTapbackPlugin())
sdk.use(createThreadContextPlugin())
sdk.use(createUnsentTrackerPlugin())
sdk.use(createContactTaggerPlugin({ autoTagNew: ['new'] }))

// Apple Notes integration
sdk.use(createNotesBridgePlugin({ defaultFolder: 'Cench Agent' }))

// Command frameworks
sdk.use(createCommandParserPlugin({ onReply: (to, text) => sdk.send(to, text) }))
sdk.use(
  createAgentCommandsPlugin({
    sendReply: (to, text) => sdk.send(to, text),
    dataLayer: dataPlugin.dataLayer,
  }),
)
```

### Message watching

```typescript
await sdk.startWatching({
  onDirectMessage: (msg) => {
    // Skip reactions — handled by tapback plugin
    if (msg.isReaction) return

    // Build IncomingMessage and dispatch to bot router
    handleMessage(
      {
        sender: msg.sender,
        text: msg.text,
        isFromMe: msg.isFromMe,
        isSelfChat: msg.isSelfChat, // set by self-chat-detector plugin
        chatId: msg.chatId,
        guid: msg.guid,
      },
      sender,
    )
  },
  onGroupMessage: () => {
    // Group messages ignored for now — DMs only
  },
})
```

### Sending messages and files

```typescript
// Text reply
await sdk.send(contactId, 'your video is ready')

// Send MP4 file
await sdk.sendFile(contactId, '/tmp/explainer.mp4', 'here you go')

// React to a message (tapback)
const handle = sdk.message({ guid: messageGuid })
if (handle?.react) await handle.react('like')
```

---

## SDK Plugin Contributions

This project contributes **9 plugins** to the Photon SDK ecosystem. Each is a standalone file in `src/plugins/`, follows the SDK `Plugin` interface, and is designed for upstream contribution to `@photon-ai/imessage-kit`.

### Original plugins (4)

| Plugin                 | What it does                                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Self-Chat Detector** | Learns your Apple ID from outgoing messages, annotates self-chat messages with `isSelfChat: true`. Solves the SDK limitation where `isFromMe` can't distinguish "sent to others" from "texting yourself." |
| **Tapback Tracker**    | Intercepts iMessage reactions (love, like, laugh, dislike, emphasize, question), emits structured `TapbackEvent` objects, persists to SQLite for preference learning.                                     |
| **Thread Context**     | Tracks reply chains via `associatedMessageGuid`, builds an in-memory thread graph, provides compressed `"sender: text"` summaries for LLM context windows. Auto-prunes threads older than 24h.            |
| **Command Parser**     | Routes `/slash` commands to registered handlers. Parses command name + arguments, supports fallback handler for non-command messages, auto-generates `/help` text.                                        |

### New plugins (5)

| Plugin             | What it does                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data Layer**     | Generic per-contact key-value store with namespace scoping. Shared SQLite backend for all plugins. Supports KV pairs, ordered lists, and auto-tracks contact metadata (lastSeen, messageCount). Atomic SQL increment for high-frequency writes.                                                                           |
| **Unsent Tracker** | Detects unsent and edited messages by caching seen GUIDs (bounded at 2000, LRU eviction). Compares against `onAfterQuery` results to detect `text -> null` (unsent) or `text -> different text` (edited). Emits `UnsentEvent` and `EditEvent`.                                                                            |
| **Contact Tagger** | Per-contact tagging system persisted in SQLite. CRUD on tags, auto-tag first-time contacts, query contacts by tag, filter with required/excluded matching. Transactional `setTags` for atomic tag replacement.                                                                                                            |
| **Notes Bridge**   | Read/write Apple Notes via AppleScript. Create, read, append, list, delete, and search notes. Serialized AppleScript queue to avoid overwhelming Notes.app. HTML stripping, injection-safe escaping. Optional auto-capture of `note:` prefixed messages.                                                                  |
| **Agent Commands** | Production command framework superseding command-parser. Multi-step interactive flows with per-step validation and transforms. Typed argument parsing (positional + `--named=value`). Per-contact permissions with DataLayer persistence. Middleware chains (global + per-command). Flow timeouts with auto-cancellation. |

### Plugin hooks used

| Hook           | Plugins that use it                                                        |
| -------------- | -------------------------------------------------------------------------- |
| `onInit`       | data-layer, contact-tagger, notes-bridge                                   |
| `onNewMessage` | All 9 plugins                                                              |
| `onAfterQuery` | unsent-tracker                                                             |
| `onDestroy`    | data-layer, contact-tagger, thread-context, unsent-tracker, agent-commands |

For full API documentation of each plugin, see [PHOTON_CONTRIBUTIONS.md](PHOTON_CONTRIBUTIONS.md).

---

## Concurrency model

The agent manages concurrency at two levels:

- **Per-contact queue:** One job runs at a time per contact. Additional messages queue up (max 2 pending). Queue drains automatically via `drainQueue()`.
- **Global limit:** Max 3 simultaneous generations across all contacts. If all slots are full, the message waits with a 10-minute timeout.

This prevents: expensive duplicate generations, memory exhaustion from parallel renders, and API rate limiting from too many concurrent Claude calls.

---

## Data persistence

| Store                   | What                                                             | Backend                           |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------- |
| `data/conversations.db` | Per-contact chat history, scene references, tapback records      | SQLite (better-sqlite3, WAL mode) |
| `data/plugin-data.db`   | Generic plugin KV store (data-layer), contact metadata           | SQLite                            |
| `data/contact-tags.db`  | Contact tags                                                     | SQLite                            |
| In-memory               | Thread graph, unsent message cache, active flows, GUID dedup set | Maps/Sets                         |

All SQLite databases use WAL mode for concurrent read access. Old messages are pruned per-contact (100 max). Old tapbacks are pruned per-contact (200 max). Generated TTS and test scene files are cleaned up after 24 hours.

---

## Environment variables

| Variable            | Default                   | Description                                                     |
| ------------------- | ------------------------- | --------------------------------------------------------------- |
| `CENCH_STUDIO_URL`  | `http://localhost:3000`   | Cench Studio server URL                                         |
| `RENDER_SERVER_URL` | `http://localhost:3001`   | Render server URL                                               |
| `MOCK`              | —                         | Set to `1` for stdin/stdout mode (no iMessage)                  |
| `ALLOW_SELF`        | —                         | Set to `1` to process your own messages                         |
| `SELF_ID`           | —                         | Comma-separated Apple IDs/phone numbers for self-chat detection |
| `ALLOWED_CONTACTS`  | —                         | Comma-separated contact allowlist (allow all if unset)          |
| `IMESSAGE_MODEL`    | —                         | Override the LLM model for generation                           |
| `WEATHER_API_KEY`   | —                         | WeatherAPI key for daily briefings                              |
| `AGENT_DB_PATH`     | `./data/conversations.db` | Path to conversation database                                   |
| `DEBUG`             | —                         | Set to `1` for verbose logging                                  |

---

## File structure

```
imessage-agent/
  src/
    index.ts                    — Entry point, SDK boot, plugin registration
    bot.ts                      — Message router, concurrency queue, intent classification
    cench-client.ts             — HTTP bridge to Cench Studio + render server
    conversation-store.ts       — SQLite persistence (contacts, messages, scenes, tapbacks)
    commands/
      explain.ts                — Default: generate explainer video
      chart.ts                  — Data visualization video
      briefing.ts               — Daily animated briefing
      edit.ts                   — Modify last generated video
      test.ts                   — Pipeline test (no API calls)
      types.ts                  — CommandContext, CommandResult interfaces
    plugins/
      self-chat-detector.ts     — Detect note-to-self messages
      tapback-tracker.ts        — Track iMessage reactions
      thread-context.ts         — Reply chain tracking for LLM context
      command-parser.ts         — /slash command routing
      data-layer.ts             — Generic per-contact KV store
      unsent-tracker.ts         — Detect unsent/edited messages
      contact-tagger.ts         — Per-contact tagging
      notes-bridge.ts           — Apple Notes via AppleScript
      agent-commands.ts         — Multi-step command framework
    utils/
      progress.ts               — Console-only progress tracking
    types/
      imessage-kit.d.ts         — TypeScript declarations for the SDK
  PHOTON.md                     — This file
  PHOTON_CONTRIBUTIONS.md       — Detailed plugin API documentation
  README.md                     — Quick-start guide
  .env.example                  — Configuration template
```

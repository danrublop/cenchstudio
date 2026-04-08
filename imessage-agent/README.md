# Cench iMessage Agent

**Text it what you want to explain, get back an animated video.**

An iMessage-native agent built with [Photon imessage-kit](https://github.com/photon-hq/imessage-kit) that generates animated explainer videos through Cench Studio's AI video engine.

> **Full documentation:** See [PHOTON.md](PHOTON.md) for the complete Photon application guide — architecture, SDK usage, all 9 plugin contributions, setup, and configuration.

## How it works

```
You: "explain how neural networks learn"
Bot: "🎬 Got it! Creating your animated video..."
Bot: "🎞️ Rendering frames..."
Bot: [sends MP4 video]
```

No UI. No app to open. Just text and get back a video.

## Commands

| Input                            | What happens                            |
| -------------------------------- | --------------------------------------- |
| Any topic                        | Animated explainer video                |
| `chart: CO2 emissions over time` | D3 data visualization video             |
| `good morning`                   | Animated daily briefing (weather, date) |
| `make it shorter`                | Edit the last video                     |
| `help`                           | Show all commands                       |
| `clear`                          | Reset conversation                      |

## Architecture

```
iMessage → Photon SDK → Cench Agent API → Scene Generation → MP4 Render → iMessage
```

Three local processes:

1. **Next.js** (`:3000`) — Cench Studio + Agent API
2. **Render Server** (`:3001`) — Puppeteer + FFmpeg for MP4 export
3. **iMessage Agent** — This project, bridges iMessage to Cench

## Setup

### Prerequisites

- macOS with Full Disk Access enabled
- Node.js 18+ or Bun
- Cench Studio running locally

### Install

```bash
cd imessage-agent
npm install
```

### Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

### Run

```bash
# Terminal 1: Start Cench Studio
npm run dev

# Terminal 2: Start render server
cd render-server && npm start

# Terminal 3: Start iMessage agent
cd imessage-agent && npm start

# Or in mock mode (stdin/stdout, no iMessage needed):
MOCK=1 npm start
```

## SDK Contributions

This project contributes **9 plugins** to the Photon SDK ecosystem:

| Plugin             | Description                                           |
| ------------------ | ----------------------------------------------------- |
| Self-Chat Detector | Distinguish note-to-self from messages to others      |
| Tapback Tracker    | Track iMessage reactions as structured events         |
| Thread Context     | Reply chain tracking with compressed LLM context      |
| Command Parser     | `/slash` command routing with auto-help               |
| Data Layer         | Generic per-contact KV store for all plugins          |
| Unsent Tracker     | Detect unsent and edited messages                     |
| Contact Tagger     | Per-contact tagging with SQLite persistence           |
| Notes Bridge       | Apple Notes read/write via AppleScript                |
| Agent Commands     | Multi-step flows, typed args, permissions, middleware |

See [PHOTON.md](PHOTON.md) for full details and [PHOTON_CONTRIBUTIONS.md](PHOTON_CONTRIBUTIONS.md) for complete API docs.

## Why this agent?

1. **Personal utility** — I'd actually text this tomorrow morning to prep a presentation
2. **Conversation-native** — no UI, just text in → video out
3. **One sentence** — "Text it what you want to explain, get back a video"
4. **Unique** — no other iMessage agent generates animated videos

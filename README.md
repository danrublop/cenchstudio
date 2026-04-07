# Cench Studio

AI-powered animated explainer video creator. Type a prompt, get a fully animated scene — rendered at 1920x1080, exportable as MP4, or publishable as an interactive embed with branching, quizzes, and hotspots.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)

## What is Cench Studio?

Cench Studio generates animated video scenes from natural-language prompts. A multi-agent system powered by Claude routes your request to the right specialist — a Director for multi-scene narratives, a Scene-Maker for single scenes, an Editor for surgical changes, or a DoP for global style sweeps — and calls from a library of 92 tools across 16 families to build the result.

Scenes are self-contained HTML files driven by GSAP timelines, making them pausable, seekable, and frame-accurate. Seven rendering engines cover everything from hand-drawn whiteboard sketches (Canvas2D) to data visualizations (D3.js), 3D environments (Three.js), and rich DOM animations (Motion/Anime.js). Export to MP4 via a Puppeteer + FFmpeg render server, or publish as hosted interactive embeds with scene graphs, variables, and branching logic.

Four ways to use it: the **App UI** (visual editor at localhost:3000), the **`/cench` skill** (works in Claude Code, Cursor, Antigravity), the **REST API** (7 generation endpoints + CRUD), or the **Agent API** (SSE stream for custom AI workflows).

## Features

- **Multi-renderer engine** — Canvas2D, SVG, D3.js, Three.js, Motion/Anime.js, Lottie, Zdog
- **6-agent orchestration** — Router, Director, Planner, Scene-Maker, Editor, DoP
- **92 agent tools** across 16 families (scene, layer, element, style, media, template, interaction, parenting, export, chart, physics, 3D, avatar, recording, AI layers, planning)
- **Style presets** — Whiteboard, chalkboard, blueprint, clean, data-story, newspaper, neon, kraft
- **Data visualization** — 12+ D3 chart types with animated data binding
- **3D scenes** — Three.js environments with PBR materials, Zdog pseudo-3D illustrations
- **Physics simulations** — Pendulum, projectile, orbital, wave interference, and more
- **AI media generation** — Images (Flux, DALL-E, Recraft, Ideogram), video (Veo3), avatars (HeyGen), TTS (ElevenLabs, OpenAI, Google)
- **Interactive scenes** — Hotspots, choices, quizzes, gates, tooltips, forms, variables, scene graphs
- **MP4 export** — Puppeteer + FFmpeg with 39 transition types (xfade), 720p/1080p/4K
- **Interactive publishing** — Hosted embeds with branching navigation and player SDK
- **Electron desktop app** — Native desktop shell with Pixi + WebCodecs export engine
- **Multi-provider LLM support** — Anthropic (default), OpenAI, Google Gemini, Ollama (local)

## Architecture

```mermaid
graph LR
    A[User] --> B{App UI / Skill / API}
    B --> C[Agent Router<br/>Haiku]
    C --> D[Director<br/>Sonnet]
    C --> E[Scene-Maker<br/>Sonnet]
    C --> F[Editor<br/>Haiku]
    C --> G[DoP<br/>Haiku]
    D --> H[Tool Executor<br/>92 tools]
    E --> H
    F --> H
    G --> H
    H --> I[Renderers<br/>Canvas2D · SVG · D3<br/>Three.js · Motion · Lottie · Zdog]
    I --> J[Scene HTML<br/>1920×1080 · GSAP timeline]
    J --> K[Preview<br/>localhost:3000]
    J --> L[MP4 Export<br/>Puppeteer + FFmpeg]
    J --> M[Interactive Publish<br/>Scene graph + Player]
```

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Docker** (for PostgreSQL)
- **Anthropic API key** (required for scene generation + agent system)
- Optional: ElevenLabs, HeyGen, Fal.ai, Google AI, OpenAI API keys for media features

### Installation

```bash
git clone https://github.com/danrublop/cenchstudio.git
cd cenchstudio
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

| Variable                        | Required | Used by                                                                          |
| ------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Yes      | PostgreSQL connection (`postgresql://postgres:postgres@localhost:5432/inkframe`) |
| `ANTHROPIC_API_KEY`             | Yes      | All scene generation + agent system                                              |
| `FAL_KEY`                       | No       | Image generation (Flux, Recraft, Ideogram, Stable Diffusion)                     |
| `HEYGEN_API_KEY`                | No       | AI avatar talking-head video                                                     |
| `GOOGLE_AI_KEY`                 | No       | Veo3 video generation                                                            |
| `ELEVENLABS_API_KEY`            | No       | Text-to-speech narration                                                         |
| `OPENAI_API_KEY`                | No       | DALL-E 3 image generation                                                        |
| `NEXT_PUBLIC_RENDER_SERVER_URL` | No       | Render server URL (default: `http://localhost:3001`)                             |

### Database Setup

```bash
npm run db:start     # Start PostgreSQL via Docker
npm run db:migrate   # Apply database schema
npm run db:setup     # Seed data (optional)
```

### Start Development

```bash
npm run dev          # Next.js dev server → http://localhost:3000
npm run server       # Render server → http://localhost:3001 (separate terminal)
```

### Electron Desktop

```bash
npm run dev:electron   # Launches Electron + Next.js
```

## Project Structure

```
app/                        — Next.js App Router
  api/
    agent/                  — Multi-agent SSE endpoint
    generate*/              — 7 generation endpoints (SVG, Canvas, D3, Three, Motion, Lottie, Image)
    generate-video/         — Veo3 video generation
    generate-avatar/        — HeyGen avatar generation
    export/                 — MP4 export trigger
    scene/                  — Scene CRUD + HTML file writer
    projects/               — Project CRUD
    tts/                    — Text-to-speech (ElevenLabs)
    publish/                — Interactive embed publishing
    upload/                 — File uploads
    usage/                  — API usage stats
    permissions/            — API permission management
components/                 — React UI components
  timeline/                 — Timeline, tracks, playhead, zoom
lib/
  agents/                   — Agent framework (router, runner, prompts, tools, 18 handler modules)
  db/                       — Drizzle ORM schema + queries
  generation/               — LLM system prompts per scene type
  store/                    — Zustand editor state + actions
  types/                    — TypeScript interfaces
  templates/                — Scene template instantiation
render-server/              — Express server (Puppeteer + FFmpeg) for MP4 export
electron/                   — Electron desktop shell
packages/player/            — Embeddable interactive player SDK
scripts/                    — CLI tools, MCP server, setup
docs/                       — Architecture docs, system inventory, audits
```

## Scene Types

| Type      | `sceneType` | Endpoint               | Best for                                     |
| --------- | ----------- | ---------------------- | -------------------------------------------- |
| SVG       | `svg`       | `/api/generate`        | Diagrams, infographics, concept maps         |
| Canvas 2D | `canvas2d`  | `/api/generate-canvas` | Particle systems, generative art, hand-drawn |
| D3        | `d3`        | `/api/generate-d3`     | Charts, graphs, data-driven visualizations   |
| Three.js  | `three`     | `/api/generate-three`  | 3D objects, PBR materials, camera animation  |
| Motion    | `motion`    | `/api/generate-motion` | DOM animations, text reveals, UI mockups     |
| Lottie    | `lottie`    | `/api/generate-lottie` | Overlay annotations on Lottie animations     |
| Zdog      | `zdog`      | — (via agent skill)    | Pseudo-3D illustrations, isometric graphics  |

All scenes render at **1920x1080** with GSAP timelines for frame-accurate playback.

## Agent System

A Haiku-powered router automatically selects the right specialist for each request:

| Agent           | Role                                  | Default Model | Triggers                           |
| --------------- | ------------------------------------- | ------------- | ---------------------------------- |
| **Director**    | Multi-scene planning, narrative arcs  | Sonnet        | "create a video about", 3+ scenes  |
| **Scene-Maker** | Single scene generation               | Sonnet        | "add a scene", "new scene"         |
| **Editor**      | Surgical edits to existing scenes     | Haiku         | "change the color", "move", "fix"  |
| **DoP**         | Global visual style across all scenes | Haiku         | "make everything", "color palette" |

92 tools across 16 families: scene, layer, element, style, media, template, interaction, parenting, export, chart, physics, 3D world, avatar, recording, AI layers, and planning.

See [docs/SYSTEM-INVENTORY.md](docs/SYSTEM-INVENTORY.md) for the full tool matrix with parameters.

## Style Presets

| Preset       | Look                        | Default renderer |
| ------------ | --------------------------- | ---------------- |
| `whiteboard` | Hand-drawn marker on white  | canvas2d         |
| `chalkboard` | Chalk on dark green         | canvas2d         |
| `blueprint`  | Technical drawing on blue   | canvas2d         |
| `clean`      | Minimal vector graphics     | svg              |
| `data-story` | Data viz with clean axes    | d3               |
| `newspaper`  | Editorial, serif typography | svg              |
| `neon`       | Glowing lines on dark       | svg              |
| `kraft`      | Brown paper texture         | canvas2d         |

Each preset auto-configures renderer preference, roughness (0–3), drawing tool, stroke color, font, and background texture.

## API Reference

| Method  | Path                               | Description                         |
| ------- | ---------------------------------- | ----------------------------------- |
| `GET`   | `/api/scene?projectId=X`           | List scenes (no code, fast)         |
| `GET`   | `/api/scene?projectId=X&sceneId=Y` | Single scene with full layer code   |
| `POST`  | `/api/scene`                       | Create scene + write HTML file      |
| `PATCH` | `/api/scene`                       | Update layer code + regenerate HTML |
| `GET`   | `/api/projects`                    | List all projects                   |
| `POST`  | `/api/projects`                    | Create project                      |
| `POST`  | `/api/generate`                    | Generate SVG scene                  |
| `POST`  | `/api/generate-canvas`             | Generate Canvas2D scene             |
| `POST`  | `/api/generate-d3`                 | Generate D3 data viz                |
| `POST`  | `/api/generate-three`              | Generate Three.js 3D scene          |
| `POST`  | `/api/generate-motion`             | Generate Motion/Anime.js scene      |
| `POST`  | `/api/generate-lottie`             | Generate Lottie overlay             |
| `POST`  | `/api/agent`                       | Multi-agent SSE stream              |
| `POST`  | `/api/export`                      | MP4 export (SSE progress)           |
| `POST`  | `/api/tts`                         | Text-to-speech                      |
| `POST`  | `/api/publish`                     | Publish interactive embed           |

Full API documentation available at [localhost:3000/docs](http://localhost:3000/docs) when running the dev server.

## Scripts

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start Next.js dev server         |
| `npm run server`       | Start render server (MP4 export) |
| `npm run build`        | Production build                 |
| `npm run dev:electron` | Launch Electron desktop app      |
| `npm run db:start`     | Start PostgreSQL via Docker      |
| `npm run db:migrate`   | Apply database schema            |
| `npm run db:studio`    | Open Drizzle Studio (DB GUI)     |
| `npm run db:setup`     | Seed database                    |
| `npm run mcp`          | Start MCP server                 |
| `npm run lint`         | Run ESLint                       |
| `npm run format`       | Run Prettier                     |
| `npm run test`         | Run Vitest                       |
| `npm run test:ci`      | Run tests (CI mode)              |

## Documentation

| Document                                                       | Description                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| [CLAUDE.md](CLAUDE.md)                                         | Developer reference — stack, APIs, scene types, style system |
| [CODEBASE_MAP.md](CODEBASE_MAP.md)                             | Complete codebase architecture map                           |
| [ROADMAP.md](ROADMAP.md)                                       | Fully agentic editor roadmap (Gap 1–7)                       |
| [AGENT_FRAMEWORK_PROGRESS.md](AGENT_FRAMEWORK_PROGRESS.md)     | Agent system development status                              |
| [docs/SYSTEM-INVENTORY.md](docs/SYSTEM-INVENTORY.md)           | Full system inventory — 6 agents, 92 tools, 17 SSE events    |
| [docs/agent-framework-audit.md](docs/agent-framework-audit.md) | Request lifecycle, flow diagrams, hardening strategies       |
| [docs/agent-system-map.md](docs/agent-system-map.md)           | Agent system code organization                               |
| [docs/avatar-pipeline.md](docs/avatar-pipeline.md)             | Avatar pipeline documentation                                |
| [docs/knowledge-graph/](docs/knowledge-graph/)                 | Interactive knowledge graph (Graphify)                       |

## Knowledge Graph

An interactive knowledge graph of the core architecture is available at [`docs/knowledge-graph/graph.html`](docs/knowledge-graph/graph.html) — open it in any browser. Generated by [Graphify](https://github.com/safishamsi/graphify), it maps 502 nodes and 742 edges across the agent framework, state management, database layer, and API routes.

- [`docs/knowledge-graph/GRAPH_REPORT.md`](docs/knowledge-graph/GRAPH_REPORT.md) — Community analysis, god nodes, surprising connections
- [`docs/knowledge-graph/graph.json`](docs/knowledge-graph/graph.json) — Raw graph data for querying

Regenerate with: `graphify query "your question" --graph docs/knowledge-graph/graph.json`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run quality checks:
   ```bash
   npm run lint
   npm run format:check
   npm run test:ci
   ```
5. Commit and push
6. Open a Pull Request

Pre-commit hooks (Husky + lint-staged) run automatically on commit.

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License](LICENSE).

Copyright 2026 Daniel Lopez.

You are free to share and adapt this work for non-commercial purposes, with appropriate attribution.

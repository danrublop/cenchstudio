# Cench Studio

AI-powered animated video creation studio. Describe what you want, get production-ready animated scenes — exportable as MP4 or publishable as interactive embeds with branching, quizzes, and hotspots.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-41-9feaf9.svg)](https://www.electronjs.org/)

## What is Cench Studio?

Cench Studio is a desktop application for creating animated explainer videos with AI. Built on Electron, it combines a visual editor, a multi-agent AI system, and a React-based rendering framework into a single tool for going from idea to finished video.

The primary agent — the **Builder** — takes a natural-language prompt, searches a skill library for the right rendering technique, and generates animated scenes using a React composition framework. Scenes are built from composable layers: React components for layout and motion, Canvas2D for hand-drawn effects, Three.js for 3D, D3 for data visualization, SVG for vector graphics, and Lottie for pre-made animations — all in a single scene, all frame-synced.

Beyond the Builder, Cench ships with **14 built-in agents** (Directors for narrative planning, specialist animators for SVG/Canvas/Motion/3D/Zdog/D3, a Planner for storyboard-first workflows, an Editor for surgical changes, a DoP for global style) plus the ability to **create custom agents** with your own system prompts, tool access, and model preferences.

## Features

**Rendering**

- React-based composition framework with frame-synced animation (Remotion-style API)
- Multi-layer scenes — compose React, Canvas2D, Three.js, D3, SVG, Lottie, and Zdog layers together
- Bridge components for mixing renderers: `<Canvas2DLayer>`, `<ThreeJSLayer>`, `<D3Layer>`, `<SVGLayer>`, `<LottieLayer>`
- Frame-based animation via `useCurrentFrame()`, `interpolate()`, and `spring()` — no `useState`, fully deterministic
- Any legacy scene type auto-wraps to React via `wrapSceneAsReact()`

**AI Agents**

- Builder agent with skill discovery — searches a technique library before generating
- 14 built-in agents: Builder, Explainer Director, Onboarding Director, Product Demo Director, Planner, Scene Maker, Editor, DoP, SVG Artist, Canvas Animator, Motion Designer, 3D Designer, Zdog Artist, D3 Analyst
- Custom agent creation — define your own agents with custom prompts, model tier, icon, and tool access
- Plan mode — Planner agent proposes a storyboard, you approve before generation begins
- 92 agent tools across 16 families
- Multi-provider LLM support — Anthropic Claude (default), OpenAI, Google Gemini, Ollama (local)
- Extended thinking modes (adaptive / deep)

**Media Generation**

- AI image generation — Flux 1.1 Pro, Flux Schnell, Ideogram v3, Recraft v3, Stable Diffusion 3, DALL-E 3
- AI video generation — Google Veo3 text-to-video
- AI avatars — HeyGen talking-head video with 24+ avatar options
- Text-to-speech — ElevenLabs, OpenAI, Gemini, Google Cloud, macOS native, Web Speech API
- Image search — Unsplash integration
- Background removal, sticker generation, media caching

**Interactive & Export**

- MP4 export via Puppeteer + FFmpeg with 39 transition types, 720p/1080p/4K
- Electron-native export via Pixi + WebCodecs (faster, no browser needed)
- Interactive publishing — hosted embeds with scene graphs, hotspots, choices, quizzes, gates, tooltips, forms, and variables
- Embeddable player SDK

**Editor**

- 3-panel workspace: scene list, preview canvas with timeline, tabbed editor (Prompt, Layers, Interact)
- Screen recording with cursor telemetry, microphone, system audio, and optional webcam
- 8 style presets — whiteboard, chalkboard, blueprint, clean, data-story, newspaper, neon, kraft
- Data visualization — 12+ D3 chart types with animated data binding
- 3D scenes — Three.js with PBR materials, 3D model library, Zdog pseudo-3D
- Physics simulations — pendulum, projectile, orbital, wave interference, double-slit diffraction
- Canvas animation template library (25+ pre-built motion templates)
- Drag-and-drop scene reordering, undo/redo, auto-save
- MCP server for integration with Claude Code, Cursor, and other AI tools

## Architecture

```mermaid
graph LR
    A[User] --> B[Electron App]
    B --> C{Agent Router}
    C --> D[Builder]
    C --> E[Directors]
    C --> F[Specialists]
    C --> G[Editor / DoP]
    D --> S[Skill Library]
    S --> H
    D --> H[Tool Executor<br/>92 tools]
    E --> H
    F --> H
    G --> H
    H --> I[React Composition<br/>Canvas2D / Three.js / D3<br/>SVG / Lottie / Zdog]
    I --> J[Scene HTML<br/>1920x1080]
    J --> K[Preview]
    J --> L[MP4 Export]
    J --> M[Interactive Publish]
```

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Docker** (for PostgreSQL)
- **Anthropic API key** (required for scene generation and the agent system)
- Optional: ElevenLabs, HeyGen, Fal.ai, Google AI, OpenAI keys for media features

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

| Variable                        | Required | Used by                                                               |
| ------------------------------- | -------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                  | Yes      | PostgreSQL (`postgresql://postgres:postgres@localhost:5432/inkframe`) |
| `ANTHROPIC_API_KEY`             | Yes      | Scene generation and agent system                                     |
| `FAL_KEY`                       | No       | Image generation (Flux, Recraft, Ideogram, Stable Diffusion)          |
| `HEYGEN_API_KEY`                | No       | AI avatar talking-head video                                          |
| `GOOGLE_AI_KEY`                 | No       | Veo3 video generation, Gemini LLM                                     |
| `ELEVENLABS_API_KEY`            | No       | Text-to-speech narration                                              |
| `OPENAI_API_KEY`                | No       | DALL-E 3 image generation, OpenAI LLM                                 |
| `NEXT_PUBLIC_RENDER_SERVER_URL` | No       | Render server URL (default: `http://localhost:3001`)                  |

### Database Setup

```bash
npm run db:start     # Start PostgreSQL via Docker
npm run db:migrate   # Apply database schema
npm run db:setup     # Seed data (optional)
```

### Development

```bash
npm run dev          # Web app at http://localhost:3000
npm run server       # Render server at http://localhost:3001 (separate terminal)
```

### Electron Desktop App

```bash
npm run dev:electron   # Launches Electron + Next.js
```

The Electron shell adds native save dialogs, screen recording, webcam capture, cursor telemetry, WebCodecs export, and an export API server on port 3002.

## Project Structure

```
app/                        -- Next.js App Router
  api/
    agent/                  -- Multi-agent SSE endpoint
    generate*/              -- Generation endpoints (SVG, Canvas, D3, Three, Motion, Lottie, React)
    generate-video/         -- Veo3 video generation
    generate-avatar/        -- HeyGen avatar generation
    export/                 -- MP4 export trigger
    scene/                  -- Scene CRUD + HTML writer
    projects/               -- Project CRUD
    tts/                    -- Text-to-speech
    publish/                -- Interactive embed publishing
components/                 -- React UI components
  timeline/                 -- Timeline, tracks, playhead, zoom
  recording/                -- Screen recording HUD and controls
  settings/                 -- Agent editor, settings tabs
lib/
  agents/                   -- Agent framework (router, runner, prompts, 18 handler modules)
  skills/library/           -- Skill guides (canvas2d, d3, motion, svg, three, zdog, physics, lottie, react)
  generation/               -- LLM system prompts + React wrappers
  store/                    -- Zustand editor state + actions
  types/                    -- TypeScript interfaces
  apis/                     -- External API clients (image-gen, veo3, heygen)
  charts/                   -- Structured D3 chart generation
electron/                   -- Electron main process + preload
render-server/              -- Express server (Puppeteer + FFmpeg) for MP4 export
packages/player/            -- Embeddable interactive player SDK
public/sdk/cench-react/     -- CenchReact runtime + bridge components
scripts/                    -- CLI tools, MCP server, setup
docs/                       -- Architecture docs, system inventory, knowledge graph
```

## React Composition Framework

Scenes use a frame-based React API inspired by Remotion. All animation derives from the current frame — no `useState`, fully deterministic, seekable and exportable.

```jsx
function MyScene() {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const opacity = interpolate(frame, [0, 30], [0, 1])
  const scale = spring({ frame, fps, config: { damping: 12 } })

  return (
    <AbsoluteFill>
      <div style={{ opacity, transform: `scale(${scale})` }}>Hello from Cench</div>
      <Canvas2DLayer
        draw={(ctx, f, config) => {
          /* particles */
        }}
      />
      <ThreeJSLayer
        setup={(THREE, scene, cam) => {
          /* init */
        }}
        update={(scene, cam, f) => {
          /* animate */
        }}
      />
    </AbsoluteFill>
  )
}
```

Bridge components (`Canvas2DLayer`, `ThreeJSLayer`, `D3Layer`, `SVGLayer`, `LottieLayer`) let you mix any renderer into a React scene without re-render overhead.

## Agent System

The Builder is the primary agent. It searches the skill library for techniques, then generates scenes using the full tool suite:

| Agent                     | Role                                      | Model  |
| ------------------------- | ----------------------------------------- | ------ |
| **Builder**               | Primary creative agent, skill discovery   | Sonnet |
| **Explainer Director**    | Multi-scene narrative videos              | Sonnet |
| **Onboarding Director**   | Product walkthrough videos                | Sonnet |
| **Product Demo Director** | Problem-solution-CTA videos               | Sonnet |
| **Planner**               | Storyboard-only, plan-first workflow      | Sonnet |
| **Scene Maker**           | Single scene generation                   | Sonnet |
| **Editor**                | Surgical edits to existing scenes         | Haiku  |
| **DoP**                   | Global style (palette, font, transitions) | Haiku  |
| **SVG Artist**            | SVG path animations, hand-drawn style     | Sonnet |
| **Canvas Animator**       | Particles, generative art, physics        | Sonnet |
| **Motion Designer**       | Multi-element choreography, GSAP          | Sonnet |
| **3D Designer**           | Three.js scenes, meshes, lighting         | Sonnet |
| **Zdog Artist**           | Pseudo-3D isometric illustrations         | Sonnet |
| **D3 Analyst**            | Data visualizations, charts               | Sonnet |
| **Custom agents**         | User-defined prompts and tool access      | Any    |

Custom agents are created in Settings with a name, system prompt, model tier, icon, and color. Use them for specific styles, recurring tasks, or domain expertise.

Plan mode: select the Planner agent to get a storyboard proposal before any scenes are generated. Review, edit, then approve to proceed.

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
| `POST`  | `/api/generate-react`              | Generate React scene                |
| `POST`  | `/api/generate-lottie`             | Generate Lottie overlay             |
| `POST`  | `/api/agent`                       | Multi-agent SSE stream              |
| `POST`  | `/api/export`                      | MP4 export (SSE progress)           |
| `POST`  | `/api/tts`                         | Text-to-speech                      |
| `POST`  | `/api/publish`                     | Publish interactive embed           |

Full API documentation at [localhost:3000/docs](http://localhost:3000/docs) when the dev server is running.

## Scripts

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start Next.js dev server         |
| `npm run dev:electron` | Launch Electron desktop app      |
| `npm run server`       | Start render server (MP4 export) |
| `npm run build`        | Production build                 |
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

| Document                                                       | Description                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                         | Developer reference -- stack, APIs, scene types, style system |
| [CODEBASE_MAP.md](CODEBASE_MAP.md)                             | Complete codebase architecture map                            |
| [ROADMAP.md](ROADMAP.md)                                       | Fully agentic editor roadmap (Gap 1-7)                        |
| [AGENT_FRAMEWORK_PROGRESS.md](AGENT_FRAMEWORK_PROGRESS.md)     | Agent system development status                               |
| [docs/SYSTEM-INVENTORY.md](docs/SYSTEM-INVENTORY.md)           | Full system inventory -- 6 agents, 92 tools, 17 SSE events    |
| [docs/agent-framework-audit.md](docs/agent-framework-audit.md) | Request lifecycle, flow diagrams, hardening strategies        |
| [docs/agent-system-map.md](docs/agent-system-map.md)           | Agent system code organization                                |
| [docs/avatar-pipeline.md](docs/avatar-pipeline.md)             | Avatar pipeline documentation                                 |
| [docs/knowledge-graph/](docs/knowledge-graph/)                 | Interactive knowledge graph (Graphify)                        |

## Knowledge Graph

An interactive knowledge graph of the core architecture is available at [`docs/knowledge-graph/graph.html`](docs/knowledge-graph/graph.html). Generated by [Graphify](https://github.com/safishamsi/graphify), it maps 502 nodes and 742 edges across the agent framework, state management, database layer, and API routes.

- [`docs/knowledge-graph/GRAPH_REPORT.md`](docs/knowledge-graph/GRAPH_REPORT.md) -- Community analysis, god nodes, surprising connections
- [`docs/knowledge-graph/graph.json`](docs/knowledge-graph/graph.json) -- Raw graph data for querying

Query from terminal: `graphify query "your question" --graph docs/knowledge-graph/graph.json`

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

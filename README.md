# Cench Studio

AI-powered animated video creation studio. Describe what you want, get production-ready animated scenes — exportable as MP4 or publishable as interactive embeds with branching, quizzes, and hotspots.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-41-9feaf9.svg)](https://www.electronjs.org/)

## What is Cench Studio?

Cench Studio is a desktop application for creating animated explainer videos with AI. Built on Electron, it combines a visual editor, a multi-agent AI system, and a React-based rendering framework into a single tool for going from idea to finished video.

The primary agent — the **Builder** — takes a natural-language prompt, searches a skill library for the right rendering technique, and generates animated scenes using a React composition framework. Scenes are built from composable layers: React components for layout and motion, Canvas2D for hand-drawn effects, Three.js for 3D, D3 for data visualization, SVG for vector graphics, Lottie for pre-made animations, and Zdog for pseudo-3D illustrations — all in a single scene, all frame-synced.

Beyond the Builder, Cench ships with **14 built-in agents** (Directors for narrative planning, specialist animators for SVG/Canvas/Motion/3D/Zdog/D3, a Planner for storyboard-first workflows, an Editor for surgical changes, a DoP for global style) plus the ability to **create custom agents** with your own system prompts, tool access, and model preferences.

Upload your own images, videos, SVGs, and audio. Add your branding as a watermark. Edit footage with trim controls. Overlay AI-generated content on top of real video. Publish as interactive experiences with scene graphs, variables, quizzes, and branching logic.

## Rendering

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

Bridge components let you mix renderers in a single scene without re-render overhead:

| Bridge Component  | Renderer      | Use case                                    |
| ----------------- | ------------- | ------------------------------------------- |
| `<Canvas2DLayer>` | Canvas 2D     | Particles, hand-drawn lines, procedural art |
| `<ThreeJSLayer>`  | Three.js r183 | 3D objects, PBR materials, environments     |
| `<D3Layer>`       | D3 v7         | Charts, graphs, data-driven animation       |
| `<SVGLayer>`      | SVG + GSAP    | Vector path reveals, icon animation         |
| `<LottieLayer>`   | lottie-web    | Pre-made Lottie animations synced to frame  |

Any legacy scene type auto-wraps to React via `wrapSceneAsReact()`.

## Three.js and 3D

Three.js scenes (r183, ES modules) support PBR rendering with `MeshStandardMaterial` and `MeshPhysicalMaterial`, environment maps, and studio lighting via `setupEnvironment()`. Pre-built environments include rolling track lanes, studio rooms, meadows, and void spaces.

A 3D model library with searchable catalog provides ready-to-use assets across categories (architecture, biology, objects, vehicles). Models load via GLTFLoader with scale metadata. The `three_data_scatter_scene` tool generates 3D point cloud visualizations.

3D World scenes combine environments, placed objects, floating HTML panels, and keyframed camera paths with easing — minimum 4-second duration for immersiveness.

## SVG

SVG scenes render at 1920x1080 with CSS and SMIL animation. Best for logo animations, icon sequences, sharp-scaling diagrams, and path morphing. Palette colors and stroke width come from the global style. All randomness uses seeded PRNG for deterministic rendering.

## Lottie

Lottie scenes generate JSON rendered by lottie-web at 1920x1080, 30fps. Every animated keyframe uses bezier easing handles for smooth motion. Shape types include ellipses, rects, stars, bezier paths, fills, strokes, and groups. Pre-made Lottie animations are also searchable via the `search_lottie` tool and syncable to the timeline with `CenchMotion.lottieSync()`.

## Zdog and Zdog Studio

Zdog is a pseudo-3D rendering engine for flat vector illustrations with depth. Ideal for molecules, gears, globes, org charts, and isometric explainers. Shapes include Ellipse, Rect, RoundedRect, Polygon, Cylinder, Cone, Box, and Hemisphere.

**Zdog Studio** is a character and scene composition system:

- **Character rigs** — Seed-based deterministic people with configurable proportions, facial styles (friendly/serious/curious), hair styles (short/bob/bun/flat/curls), eye/mouth/nose variants, and accessories (glasses, hat, tablet, badge)
- **Motion profiles** — idle, talk, wave, point, present, walk
- **Scene modules** — barChart, lineChart, donutChart, presentationBoard, desk, tablet
- **Beats** — Animation keyframes at specific timestamps for choreographing multi-character scenes
- **Asset library** — Save and reuse character formulas with tags

The `create_zdog_composed_scene` tool generates complete multi-character scenes with modules and animation beats from a single prompt.

## Talking Head Avatars

AI-generated talking head videos with lip-synced speech. Multiple providers:

| Provider    | Cost              | Notes                                            |
| ----------- | ----------------- | ------------------------------------------------ |
| TalkingHead | Free              | Basic                                            |
| MuseTalk    | ~$0.04/scene      |                                                  |
| Fabric 1.0  | ~$0.08-0.15/scene |                                                  |
| Aurora      | ~$0.05/scene      |                                                  |
| HeyGen      | ~$0.10-1.00       | 24+ avatars, voice catalog, green screen removal |

HeyGen avatars render with green background (#00FF00) for automatic chroma key removal. Position avatars anywhere in the scene with x/y/width/height controls, adjust opacity, and layer with z-index ordering. Voices come from a searchable catalog filtered by language and gender.

## Camera Motion

Cinematic camera moves applied to any scene type:

| Category | Moves                                                                   |
| -------- | ----------------------------------------------------------------------- |
| 2D moves | kenBurns, pan, dollyIn, dollyOut, rackFocus, shake, cut, reset          |
| 3D moves | orbit, dolly3D, rackFocus3D                                             |
| Presets  | presetReveal, presetEmphasis, presetCinematicPush, presetRackTransition |

Camera moves are set per-scene and sync to the timeline. Use `set_camera_motion` with an array of moves for sequenced camera work.

## Style System

16 style presets, each configuring the full visual pipeline:

| Preset              | Look                        | Renderer | Texture      |
| ------------------- | --------------------------- | -------- | ------------ |
| `whiteboard`        | Hand-drawn marker on white  | canvas2d | grain        |
| `chalkboard`        | Chalk on dark green         | canvas2d | chalk        |
| `blueprint`         | Technical drawing on blue   | canvas2d | lines        |
| `clean`             | Minimal vector graphics     | svg      | none         |
| `data-story`        | Data viz with clean axes    | d3       | none         |
| `newspaper`         | Editorial, serif typography | svg      | paper        |
| `neon`              | Glowing lines on dark       | svg      | screen blend |
| `kraft`             | Brown paper texture         | canvas2d | paper        |
| `threeblueonebrown` | 3Blue1Brown math style      | motion   | none         |
| `feynman`           | Physics education           | motion   | none         |
| `cinematic`         | Dark, high contrast film    | motion   | grain        |
| `pencil`            | Pencil sketch               | canvas2d | rough        |
| `risograph`         | Riso print, limited palette | canvas2d | offset       |
| `retro_terminal`    | ASCII green screen          | motion   | scanlines    |
| `science_journal`   | Academic publication        | svg      | none         |
| `pastel_edu`        | Soft pastels, educational   | motion   | none         |

Each preset controls:

- **Visual** — 4-color palette, background color, background style (plain/paper/grid/dots/chalkboard/kraft), font family
- **Drawing** — Roughness level (1-5), default tool (marker/pen/chalk/brush/highlighter), stroke color
- **Texture** — Style (none/grain/paper/chalk/lines), intensity (0-1), blend mode (multiply/screen/overlay)
- **Data** — Axis and grid colors for D3 charts
- **Agent** — Thinking mode, plan-first flag, preferred scene count, density settings

Scene-level overrides (before, after, warning, highlight) let you change palette mid-project for emphasis.

## Upload and Branding

Upload your own media and use it in scenes:

| Type   | Formats                   | Max size |
| ------ | ------------------------- | -------- |
| Images | JPEG, PNG, WebP, GIF, SVG | 10 MB    |
| Videos | MP4, MOV, WebM            | 100 MB   |
| Audio  | MP3, WAV                  | 100 MB   |

Uploaded assets get automatic thumbnails and metadata extraction (dimensions, duration, viewBox for SVGs). SVGs are sanitized to strip XSS vectors.

**Branding** — Add your logo as a watermark on any or all scenes. Configure position (top-left, top-right, bottom-left, bottom-right), opacity (0-1), and size (1-50% of scene width). Set a brand color for the interactive player. Custom domain and password protection available for published embeds.

**Footage editing** — Import video files and use them as scene layers. Set trim in/out points, adjust opacity, and composite AI-generated content on top. Video layers sit behind animated content with z-index control.

## Interactive Features

Projects can be published as interactive experiences with a scene graph instead of a linear timeline.

**Six interaction types:**

- **Hotspot** — Clickable region (circle/rectangle/pill) with pulse, glow, border, or filled style. Jumps to another scene on click.
- **Choice** — Multiple-choice buttons with optional question. Horizontal, vertical, or grid layout. Each option links to a different scene.
- **Quiz** — Multiple choice with correct answer tracking. Configure on-correct (continue/jump) and on-wrong (retry/jump/continue) behavior with explanation text.
- **Gate** — Progress gate requiring minimum watch time before the continue button appears.
- **Tooltip** — Hover or click triggered info overlay with configurable position (top/bottom/left/right).
- **Form** — Text, select, and radio inputs that set scene variables on submit.

**Scene graph** — Connect scenes with conditional edges. Edge conditions include: auto (play next when done), hotspot click, choice selection, quiz result, gate completion, and variable value checks.

**Variables** — Named values that persist across scenes. Set by form inputs, checked by edge conditions, interpolated in HTML content with `{varName}` tokens.

**13 interaction style presets** — glass, glass-warm, glass-cool, glass-dark, professional, solid, solid-light, solid-dark, minimal, outline, gradient, neon, custom. Each controls background, blur, border, shadow, fonts, padding, and hover effects.

**Player** — Published embeds include a player with theme (dark/light/transparent), brand color, progress bar, scene navigation dots, fullscreen toggle, and autoplay.

## AI Agents

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

The Builder searches a skill library of rendering technique guides before generating. 92 tools across 16 families. Multi-provider LLM support: Anthropic Claude (default), OpenAI, Google Gemini, Ollama (local). Extended thinking modes (adaptive/deep).

Custom agents are created in Settings with a name, system prompt, model tier, icon, and color. Use them for specific styles, recurring tasks, or domain expertise.

Plan mode: select the Planner agent to get a storyboard proposal before any scenes are generated. Review, edit, then approve to proceed.

## Media Generation

- **Images** — Flux 1.1 Pro, Flux Schnell, Ideogram v3, Recraft v3, Stable Diffusion 3, DALL-E 3. Styles: photorealistic, illustration, flat, sketch, 3D, watercolor, pixel art. Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4. Background removal available.
- **Video** — Google Veo3 text-to-video (5 or 8 second clips). Best for atmospheric backgrounds and b-roll.
- **Text-to-speech** — ElevenLabs, OpenAI, Gemini, Google Cloud, macOS native, Web Speech API. Voice selection, custom instructions, fade in/out, volume control.
- **Image search** — Unsplash integration for stock photography.

## Export

- **MP4** — Puppeteer + FFmpeg render server with 39 FFmpeg xfade transitions, 720p/1080p/4K, 24/30/60fps
- **Electron export** — Pixi + WebCodecs native pipeline (faster, no browser needed)
- **Interactive publish** — Hosted embed with scene graph, interactions, variables, player SDK
- **Screen recording** — Built-in recording with cursor telemetry, microphone, system audio, and optional webcam

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
    projects/               -- Project CRUD + asset uploads
    tts/                    -- Text-to-speech
    publish/                -- Interactive embed publishing
components/                 -- React UI components
  timeline/                 -- Timeline, tracks, playhead, zoom
  recording/                -- Screen recording HUD and controls
  settings/                 -- Agent editor, settings tabs
lib/
  agents/                   -- Agent framework (router, runner, prompts, 18 handler modules)
  skills/library/           -- Skill guides (canvas2d, d3, motion, svg, three, zdog, physics, lottie)
  generation/               -- LLM system prompts + React wrappers
  store/                    -- Zustand editor state + actions
  types/                    -- TypeScript interfaces (scene, interaction, zdog, camera)
  apis/                     -- External API clients (image-gen, veo3, heygen)
  charts/                   -- Structured D3 chart generation
  styles/                   -- Style presets and resolution
electron/                   -- Electron main process + preload
render-server/              -- Express server (Puppeteer + FFmpeg) for MP4 export
packages/player/            -- Embeddable interactive player SDK
public/sdk/cench-react/     -- CenchReact runtime + bridge components
scripts/                    -- CLI tools, MCP server, setup
docs/                       -- Architecture docs, system inventory, knowledge graph
```

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
| [docs/SYSTEM-INVENTORY.md](docs/SYSTEM-INVENTORY.md)           | Full system inventory -- agents, 92 tools, 17 SSE events      |
| [docs/agent-framework-audit.md](docs/agent-framework-audit.md) | Request lifecycle, flow diagrams, hardening strategies        |
| [docs/agent-system-map.md](docs/agent-system-map.md)           | Agent system code organization                                |
| [docs/avatar-pipeline.md](docs/avatar-pipeline.md)             | Avatar pipeline documentation                                 |
| [docs/knowledge-graph/](docs/knowledge-graph/)                 | Interactive knowledge graph (Graphify)                        |

## Knowledge Graph

An interactive knowledge graph of the core architecture is available at [`docs/knowledge-graph/graph.html`](docs/knowledge-graph/graph.html). Generated by [Graphify](https://github.com/safishamsi/graphify), it maps 502 nodes and 742 edges across the agent framework, state management, database layer, and API routes.

- [`docs/knowledge-graph/GRAPH_REPORT.md`](docs/knowledge-graph/GRAPH_REPORT.md) -- Community analysis, god nodes, surprising connections
- [`docs/knowledge-graph/graph.json`](docs/knowledge-graph/graph.json) -- Raw graph data for querying

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

# Cench Studio

**Cursor for video.** Prompt to create animated videos — or edit them yourself.

Cench is an AI video editor that combines code-driven animation, diffusion models, audio, and your own footage in one timeline. Describe what you want in plain English and the AI builds it. Then edit everything — layers, timing, styles, camera, interactions — just like a traditional editor.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-41-9feaf9.svg)](https://www.electronjs.org/)

---

### How it works

```
Prompt  -->  AI Agent  -->  Animated Scene  -->  Edit  -->  Export MP4 / Publish Interactive
```

1. **Describe** what you want in natural language
2. **The Builder agent** searches its skill library, picks the right renderer, and generates the scene
3. **Edit** layers, timing, styles, camera, audio, and media in the visual editor
4. **Export** as MP4, or publish as an interactive embed with branching and quizzes

---

## What you can make

|                             |                                                                 |
| --------------------------- | --------------------------------------------------------------- |
| **Explainer videos**        | Multi-scene narratives with animated diagrams, charts, and text |
| **Product demos**           | Screen recordings with AI-generated overlays and callouts       |
| **Data stories**            | Animated D3 charts and 3D scatter plots                         |
| **Interactive tutorials**   | Branching paths with quizzes, hotspots, and viewer choices      |
| **Talking head videos**     | AI avatars with lip-synced speech from 5 providers              |
| **3D scenes**               | Three.js environments with PBR materials and model libraries    |
| **Whiteboard animations**   | Hand-drawn style with Canvas2D, pen/marker/chalk tools          |
| **Isometric illustrations** | Zdog pseudo-3D with character rigs and animation beats          |
| **Physics simulations**     | Pendulum, orbital, wave interference, double-slit diffraction   |

---

## Combine everything in one scene

Cench uses a React composition framework where each scene can mix multiple renderers as layers:

```
React layout + motion          (text, cards, UI)
  + Canvas2D layer             (particles, hand-drawn lines)
  + Three.js layer             (3D objects, PBR)
  + D3 layer                   (charts, data viz)
  + SVG layer                  (path reveals, icons)
  + Lottie layer               (pre-made animations)
  + Video layer                (your footage, trimmed)
  + Avatar layer               (AI talking head)
  + Audio layer                (TTS narration or uploaded audio)
  + Image layer                (AI-generated or uploaded)
```

All layers are frame-synced, seekable, and deterministic for pixel-perfect MP4 export.

---

## AI agents

The **Builder** is your primary creative agent. It searches a skill library of rendering techniques, then generates scenes using 92 tools.

Beyond the Builder, pick a specialist or create your own:

| Agent                     | What it does                                            |
| ------------------------- | ------------------------------------------------------- |
| **Builder**               | Full creative agent with skill discovery                |
| **Explainer Director**    | Plans multi-scene narrative arcs                        |
| **Onboarding Director**   | Product walkthrough videos                              |
| **Product Demo Director** | Problem-solution-CTA structure                          |
| **Planner**               | Proposes a storyboard for your approval before building |
| **SVG Artist**            | Path animations, hand-drawn aesthetics                  |
| **Canvas Animator**       | Particles, generative art, physics                      |
| **Motion Designer**       | GSAP choreography, text reveals                         |
| **3D Designer**           | Three.js scenes, meshes, lighting                       |
| **Zdog Artist**           | Pseudo-3D isometric illustrations                       |
| **D3 Analyst**            | Data visualizations and charts                          |
| **Editor**                | Surgical changes to existing scenes                     |
| **DoP**                   | Global style sweeps (palette, font, transitions)        |
| **Custom**                | Your own prompt, model, icon, and tool access           |

Models: Anthropic Claude (default), OpenAI, Google Gemini, Ollama (local).

---

## AI media generation

| Type        | Models                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| **Images**  | Flux 1.1 Pro, Flux Schnell, Ideogram v3, Recraft v3, Stable Diffusion 3, DALL-E 3 |
| **Video**   | Google Veo3                                                                       |
| **Avatars** | HeyGen, TalkingHead, MuseTalk, Fabric, Aurora                                     |
| **TTS**     | ElevenLabs, OpenAI, Gemini, Google Cloud, macOS native                            |
| **Search**  | Unsplash stock photography                                                        |

Image styles: photorealistic, illustration, flat, sketch, 3D, watercolor, pixel art. Background removal included.

---

## Upload your own media

Bring your own footage, images, audio, and branding:

| Type   | Formats                   | Max    |
| ------ | ------------------------- | ------ |
| Images | JPEG, PNG, WebP, GIF, SVG | 10 MB  |
| Videos | MP4, MOV, WebM            | 100 MB |
| Audio  | MP3, WAV                  | 100 MB |

**Footage editing** -- Import video, set trim in/out points, adjust opacity, composite AI content on top.

**Branding** -- Add your logo as a watermark (configurable position, size, opacity). Set brand colors for the player. Custom domain and password protection for published embeds.

---

## 16 style presets

Every preset configures palette, fonts, roughness, drawing tools, textures, and background:

|                     |                  |                   |              |
| ------------------- | ---------------- | ----------------- | ------------ |
| `whiteboard`        | `chalkboard`     | `blueprint`       | `clean`      |
| `data-story`        | `newspaper`      | `neon`            | `kraft`      |
| `threeblueonebrown` | `feynman`        | `cinematic`       | `pencil`     |
| `risograph`         | `retro_terminal` | `science_journal` | `pastel_edu` |

Drawing tools: marker, pen, chalk, brush, highlighter. Textures: grain, paper, chalk, lines, scanlines. Roughness: 1-5. Scene-level overrides for emphasis (before/after/warning/highlight states).

---

## Camera motion

| 2D                                                 | 3D                          | Presets                                           |
| -------------------------------------------------- | --------------------------- | ------------------------------------------------- |
| kenBurns, pan, dollyIn, dollyOut, rackFocus, shake | orbit, dolly3D, rackFocus3D | cinematic push, reveal, emphasis, rack transition |

Applied per-scene, synced to the timeline.

---

## Interactive publishing

Publish as hosted interactive embeds with a scene graph instead of a linear timeline:

**Interaction types** -- Hotspots (click regions), choices (multiple-choice buttons), quizzes (with correct/wrong branching), gates (minimum watch time), tooltips (hover info), forms (text/select/radio inputs that set variables).

**Branching** -- Connect scenes with conditional edges based on interaction results, variable values, or auto-advance.

**Variables** -- Persist across scenes. Set by form inputs, checked in edge conditions, interpolated in content.

**Player** -- Dark/light/transparent theme, brand color, progress bar, scene nav dots, fullscreen, autoplay.

---

## Export

| Output              | How                                                                 |
| ------------------- | ------------------------------------------------------------------- |
| **MP4**             | Puppeteer + FFmpeg, 39 transition types, 720p/1080p/4K, 24/30/60fps |
| **Electron export** | Pixi + WebCodecs native pipeline (faster)                           |
| **Interactive**     | Hosted embed with scene graph, interactions, player SDK             |
| **Recording**       | Built-in screen + webcam + audio capture with cursor telemetry      |

---

## Three.js and 3D

PBR rendering with `MeshStandardMaterial` and `MeshPhysicalMaterial`. Environment maps and studio lighting. Searchable 3D model library (architecture, biology, objects, vehicles). 3D World scenes with environments (meadow, studio, void), floating HTML panels, and keyframed camera paths.

## Zdog Studio

Pseudo-3D character and scene composition. Seed-based character rigs with configurable hair, face, accessories, and motion profiles (idle, talk, wave, point, present, walk). Scene modules: bar chart, line chart, donut chart, presentation board, desk, tablet. Animation beats for multi-character choreography. Save and reuse characters from an asset library.

## Talking head avatars

5 providers (free to ~$1/scene). HeyGen: 24+ avatars, voice catalog, automatic green screen removal. Position anywhere with x/y/size controls, layer with z-index. Lip sync is automatic.

## SVG and Lottie

SVG: 1920x1080 viewBox, CSS/SMIL animation, palette-aware, seeded PRNG. Best for logos, icons, diagrams, path morphing.

Lottie: JSON generation rendered by lottie-web at 30fps. Searchable pre-made animation library with timeline sync via `CenchMotion.lottieSync()`.

---

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- Anthropic API key

### Install

```bash
git clone https://github.com/danrublop/cenchstudio.git
cd cenchstudio
npm install
cp .env.example .env   # Add your ANTHROPIC_API_KEY
```

### Run

```bash
npm run db:start       # Start PostgreSQL
npm run db:migrate     # Apply schema
npm run dev            # Web UI at localhost:3000
npm run server         # Render server at localhost:3001 (separate terminal)
```

### Desktop app

```bash
npm run dev:electron   # Electron + Next.js
```

Adds native save dialogs, screen recording, webcam capture, WebCodecs export, and an export API on port 3002.

### Environment variables

| Variable             | Required | What it does                                    |
| -------------------- | -------- | ----------------------------------------------- |
| `DATABASE_URL`       | Yes      | PostgreSQL connection                           |
| `ANTHROPIC_API_KEY`  | Yes      | Scene generation + agents                       |
| `FAL_KEY`            | No       | Image generation (Flux, Recraft, Ideogram, SD3) |
| `HEYGEN_API_KEY`     | No       | Avatar video generation                         |
| `GOOGLE_AI_KEY`      | No       | Veo3 video, Gemini LLM                          |
| `ELEVENLABS_API_KEY` | No       | Text-to-speech                                  |
| `OPENAI_API_KEY`     | No       | DALL-E 3, OpenAI LLM                            |

---

## Project structure

```
app/api/agent/          -- Multi-agent SSE endpoint
app/api/generate*/      -- 8 generation endpoints
app/api/scene/          -- Scene CRUD
app/api/projects/       -- Project CRUD + asset uploads
lib/agents/             -- Agent framework (router, runner, 18 tool handlers)
lib/skills/library/     -- Skill guides per renderer
lib/generation/         -- LLM prompts + React wrappers
lib/store/              -- Zustand state management
lib/types/              -- TypeScript interfaces
lib/styles/             -- 16 style presets
electron/               -- Desktop shell
render-server/          -- Puppeteer + FFmpeg
packages/player/        -- Embeddable player SDK
public/sdk/cench-react/ -- React runtime + bridge components
```

## Documentation

- [CLAUDE.md](CLAUDE.md) -- Developer reference
- [CODEBASE_MAP.md](CODEBASE_MAP.md) -- Full architecture map
- [ROADMAP.md](ROADMAP.md) -- NLE editor roadmap
- [docs/SYSTEM-INVENTORY.md](docs/SYSTEM-INVENTORY.md) -- 92 tools, 17 SSE events
- [docs/knowledge-graph/](docs/knowledge-graph/) -- Interactive knowledge graph ([Graphify](https://github.com/safishamsi/graphify))

## Contributing

```bash
npm run lint && npm run format:check && npm run test:ci
```

Fork, branch, PR. Pre-commit hooks run automatically via Husky.

## License

[CC BY-NC 4.0](LICENSE) -- Copyright 2026 Daniel Lopez

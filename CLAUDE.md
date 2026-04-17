# Cench Studio

AI-powered animated explainer video creator. Users type prompts, an agent generates animated scenes using Canvas2D, SVG, D3, Three.js, or HTML/Anime.js. Scenes export as MP4 or publish as interactive hosted embeds.

## Stack

- Frontend: Next.js App Router + TypeScript + Tailwind
- Database: PostgreSQL via Drizzle ORM (`lib/db/`)
- Render server: Node.js Express in `render-server/` (Puppeteer + FFmpeg)
- Agent: Anthropic Claude API with tool use (`app/api/agent/`)

## Key directories

```
app/                        — Next.js App Router
  api/
    agent/                  — POST: Agent framework SSE endpoint
    export/                 — POST: MP4 export trigger
    generate/               — POST: SVG generation via Claude
    generate-canvas/        — POST: Canvas2D generation
    generate-d3/            — POST: D3 data viz generation
    generate-three/         — POST: Three.js 3D generation
    generate-motion/        — POST: Motion/Anime.js generation
    generate-lottie/        — POST: Lottie animation generation
    generate-image/         — POST: AI image generation
    generate-video/         — POST: Veo3 video generation
    generate-avatar/        — POST: HeyGen avatar generation
    projects/               — GET+POST: project CRUD via PostgreSQL
    scene/                  — POST: write scene HTML to public/scenes/
    publish/                — POST: publish project as hosted embed
    tts/                    — POST: text-to-speech (ElevenLabs)
    upload/                 — POST: file uploads
    usage/                  — GET: API usage stats
    permissions/            — GET+POST: API permission management
    analytics/              — analytics endpoints
lib/
  types.ts                  — All TypeScript interfaces (Scene, SceneType, etc.)
  sceneTemplate.ts          — HTML template assembly per scene type
  db/                       — Drizzle ORM setup, schema, queries
  generation/               — LLM system prompts per scene type
  store.ts                  — Zustand editor state store
  agent-tools.ts            — Agent tool definitions
components/                 — React UI components
public/scenes/              — Generated scene HTML files (served statically)
scripts/
  inject-scene.ts           — CLI: wrap code in correct HTML template
  templates/                — Standalone HTML templates (legacy)
render-server/              — Express server for MP4 export
```

## APIs (app runs at localhost:3000)

| Method | Path                                      | Body / Params                                  | Response                                                                 |
| ------ | ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/verify-scene?projectId=X&sceneId=Y` | `expected` (comma-separated keywords)          | `{ success, report, checks, issues }` — static scene analysis            |
| GET    | `/api/scene?projectId=X`                  | —                                              | `{ scenes: [...] }` (layer summaries, no code)                           |
| GET    | `/api/scene?projectId=X&sceneId=Y`        | —                                              | `{ scene: {...} }` (full layers with code)                               |
| POST   | `/api/scene`                              | `{ id, html }`                                 | `{ success, path }` — writes HTML file to disk                           |
| PATCH  | `/api/scene`                              | `{ sceneId, layerId, generatedCode, prompt? }` | `{ success, scene: { id, previewUrl } }` — updates DB + regenerates HTML |
| GET    | `/api/projects`                           | —                                              | Array of projects                                                        |
| POST   | `/api/projects`                           | `{ name, outputMode, ... }`                    | Project object                                                           |
| POST   | `/api/generate`                           | `{ prompt, palette?, ... }`                    | `{ result (SVG), usage }`                                                |
| POST   | `/api/generate-canvas`                    | `{ prompt, palette?, ... }`                    | `{ result (JS), usage }`                                                 |
| POST   | `/api/generate-d3`                        | `{ prompt, palette?, ... }`                    | `{ result: { sceneCode, styles, suggestedData } }`                       |
| POST   | `/api/generate-three`                     | `{ prompt, palette?, ... }`                    | `{ result: { sceneCode } }`                                              |
| POST   | `/api/generate-motion`                    | `{ prompt, palette?, ... }`                    | `{ result: { sceneCode, styles, htmlContent } }`                         |
| POST   | `/api/export`                             | `{ scenes, settings }`                         | SSE stream of progress                                                   |

## Scene API details

**GET** — List scenes (no code, fast) or fetch a single scene with full layer code.
**POST** — Write raw HTML to `public/scenes/{id}.html`. ID must match `/^[a-zA-Z0-9\-]+$/`.
**PATCH** — Update a layer's code in Postgres, then regenerate the HTML file. This is the correct way to edit scenes — never edit HTML files directly.

## Scene HTML

Each scene is a self-contained HTML file at `/public/scenes/{id}.html`. Written directly by the agent using the Write tool, or via POST /api/scene.

## Globals available in every scene HTML

- `WIDTH`, `HEIGHT` = scene dimensions in pixels (default 1920x1080, varies by project aspect ratio)
- `PALETTE` = 4-color array from style preset
- `DURATION` = scene duration in seconds
- `ROUGHNESS` = roughness level from style preset (0-3)
- `FONT` = font family from style preset
- `TOOL` = default drawing tool from style preset
- `STROKE_COLOR` = primary stroke color from style preset
- `BG_COLOR` = background color (hex string, user-overridable via Layers panel)
- `DATA` = suggestedData object (D3 template only)
- `AXIS_COLOR`, `GRID_COLOR` = chart styling (D3 template only)

## Scene types

**React is the default renderer** (`sceneType: 'react'`). Every scene is a React
component that can compose multiple renderers via bridge components:

| Bridge Component  | Use for                                                 |
| ----------------- | ------------------------------------------------------- |
| Pure JSX          | Typography, layouts, cards, step lists (80% of content) |
| `<ThreeJSLayer>`  | 3D geometry, PBR materials, shadows                     |
| `<Canvas2DLayer>` | Hand-drawn strokes, particles, procedural art           |
| `<D3Layer>`       | Data visualization, charts                              |
| `<SVGLayer>`      | Vector draw-on animations                               |
| `<LottieLayer>`   | Micro-animations, icons                                 |

Legacy types (svg, canvas2d, motion, d3, three, lottie) still work for
existing scenes but new scenes should use React.

All scenes render at the project's aspect ratio dimensions (default **1920x1080**; also supports 9:16, 1:1, 4:5) and must complete within their specified duration. Always use `WIDTH`/`HEIGHT` globals instead of hardcoding dimensions. Use `resolveProjectDimensions(aspectRatio, resolution)` from `lib/dimensions.ts` to get pixel values.

## Style System

Style presets are **optional and off by default** (`presetId: null`).
When no preset is active, the generator has full creative control over
colors, fonts, backgrounds, and rendering approach. Users can opt into
a preset via the Style Picker in the Layers tab.

When a preset IS active, it configures:

- Renderer preference (Motion default; canvas2d for expressive drawing; SVG rare)
- Roughness level (0-3)
- Default drawing tool
- Stroke color defaults
- Background texture

When generating scenes, read the style guidance in the system prompt.
The globals ROUGHNESS, TOOL, STROKE_COLOR are injected automatically
by writeSceneHTML — do not hardcode these values in scene code.

**Renderer preference:** Motion is the default for explainer-style scenes (layouts, type, cards). Canvas2d is for expressive hand-drawn or procedural work. SVG is rarely chosen.

Available presets: whiteboard, chalkboard, blueprint, clean,
data-story, newspaper, neon, kraft

Texture overlays are applied automatically after render —
do not add generateTextureCanvas() calls in scene code.

## UI Panel Layout

The editor has two distinct panel areas with different purposes:

**Layers Tab** (right panel, scene-focused):

- Style preset picker and palette/background/font overrides
- Scene settings (name, duration, background color, transitions)
- Video layer, audio layer, SVG objects, text overlays
- AI generated layers
- All scene design controls live here

**Settings Panel** (gear icon sidebar, system-focused):

- Editor theme (dark/light) — global preference, not per-project
- Usage stats
- Agents configuration
- Models & API keys
- Permissions
- Dev tools

Scene palette and style controls must NOT be in the Settings panel.
The Settings panel is for system/app configuration only.
Editor theme (dark/light) is a global preference — it does not
change when switching projects or when the agent updates globalStyle.

## Agent vs Claude Code — scene generation

Both paths share `generateSceneHTML()` (lib/sceneTemplate.ts) and produce identical HTML output.
The in-app agent uses tool-based orchestration (40+ tools); Claude Code writes code directly
and calls REST APIs. The agent intentionally lacks filesystem access (sandboxed by design).
Claude Code compensates with the MCP server (`scripts/mcp-server.ts`) which exposes all
agent tools (verify_scene, plan_scenes, TTS, charts, interactions) for parity.

Design principles are shared: `lib/generation/design-principles.ts` is the single source
of truth, mirrored in `.claude/skills/cench/rules/design-principles.md`.

## Bundled SFX library (`public/sfx-library/`)

- **ZzFX** (MIT): procedural presets → WAV via `npm run sfx-library:zzfx`; manifest uses `librarySource: "zzfx"`.
- **SoLoud** ([jarikomppa/soloud](https://github.com/jarikomppa/soloud), **zlib/libpng** — commercial use allowed): optional imported assets should use filenames `soloud-*`, `librarySource: "soloud"`, and license text such as `zlib/libpng (SoLoud)`. See `THIRD_PARTY_AUDIO.md` for full notices.
- **react-sounds** ([e3ntity/react-sounds](https://github.com/e3ntity/react-sounds), **MIT**): optional; vendor audio under `public/sfx-library/` with `react-sounds-*` filenames, `librarySource: "react-sounds"`, and `license: "MIT (react-sounds)"` — do not rely on CDN URLs in exported scenes unless you intend to. Details in `THIRD_PARTY_AUDIO.md`.
- **Music Megathread** ([MoonWalker440/Music-Megathread](https://github.com/MoonWalker440/Music-Megathread)): **link directory only** — not a licensed music bundle. Do not treat it as a cleared catalog for shipped video; use Pixabay/Freesound APIs or user uploads. See `THIRD_PARTY_AUDIO.md`.

## When generating scenes with /cench

Read `.claude/skills/cench/SKILL.md` for domain rules, scene type selection, and HTML templates.

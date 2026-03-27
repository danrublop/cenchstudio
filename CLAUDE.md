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

| Method | Path | Body / Params | Response |
|---|---|---|---|
| GET | `/api/scene?projectId=X` | — | `{ scenes: [...] }` (layer summaries, no code) |
| GET | `/api/scene?projectId=X&sceneId=Y` | — | `{ scene: {...} }` (full layers with code) |
| POST | `/api/scene` | `{ id, html }` | `{ success, path }` — writes HTML file to disk |
| PATCH | `/api/scene` | `{ sceneId, layerId, generatedCode, prompt? }` | `{ success, scene: { id, previewUrl } }` — updates DB + regenerates HTML |
| GET | `/api/projects` | — | Array of projects |
| POST | `/api/projects` | `{ name, outputMode, ... }` | Project object |
| POST | `/api/generate` | `{ prompt, palette?, ... }` | `{ result (SVG), usage }` |
| POST | `/api/generate-canvas` | `{ prompt, palette?, ... }` | `{ result (JS), usage }` |
| POST | `/api/generate-d3` | `{ prompt, palette?, ... }` | `{ result: { sceneCode, styles, suggestedData } }` |
| POST | `/api/generate-three` | `{ prompt, palette?, ... }` | `{ result: { sceneCode } }` |
| POST | `/api/generate-motion` | `{ prompt, palette?, ... }` | `{ result: { sceneCode, styles, htmlContent } }` |
| POST | `/api/export` | `{ scenes, settings }` | SSE stream of progress |

## Scene API details

**GET** — List scenes (no code, fast) or fetch a single scene with full layer code.
**POST** — Write raw HTML to `public/scenes/{id}.html`. ID must match `/^[a-zA-Z0-9\-]+$/`.
**PATCH** — Update a layer's code in Postgres, then regenerate the HTML file. This is the correct way to edit scenes — never edit HTML files directly.

## Scene HTML

Each scene is a self-contained HTML file at `/public/scenes/{id}.html`. Written directly by the agent using the Write tool, or via POST /api/scene.

## Globals available in every scene HTML

- `WIDTH` = 1920, `HEIGHT` = 1080
- `PALETTE` = `["#181818","#121212","#e84545","#151515","#f0ece0"]` (Three.js template only)
- `DURATION` = seconds (Three.js template only)
- `DATA` = suggestedData object (D3 template only)

## Scene types

| Type | sceneType | Code format | Key element |
|---|---|---|---|
| SVG | `svg` | Raw `<svg>` element | `viewBox="0 0 1920 1080"` |
| Canvas 2D | `canvas2d` | Raw JavaScript | `document.getElementById('c')` |
| D3 | `d3` | JSON `{ styles, sceneCode, suggestedData }` | `d3.select('#chart')` |
| Three.js | `three` | JSON `{ sceneCode }` | THREE global (r128) |
| Motion | `motion` | JSON `{ styles, htmlContent, sceneCode }` | anime + Motion v11 |
| Lottie | `lottie` | Lottie JSON | lottie.loadAnimation |

All scenes render at **1920x1080** and must complete within their specified duration.

## When generating scenes with /cench

Read `.claude/skills/cench/SKILL.md` for domain rules, scene type selection, and HTML templates.

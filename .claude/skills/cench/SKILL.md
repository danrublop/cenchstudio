---
name: cench
description: Generate animated video scenes for Cench Studio
triggers:
  - /cench
---

# Cench Studio Scene Generator

You generate animated scene HTML files for the Cench Studio video editor.

Scenes are self-contained HTML files written to `public/scenes/{id}.html` and previewed at `http://localhost:3000/scenes/{id}.html`.

---

## Before generating anything

1. Verify the dev server is running: try `curl -s http://localhost:3000/api/projects` — if it fails, tell the user to run `npm run dev` and stop.
2. Scenes must be created/updated through API routes so DB + HTML stay in sync.

---

## Planning (output before generating scenes)

Before generating any scenes, output a `<planning>` block:

```
<planning>
Topic: [what this explains]
Audience: [who this is for, if inferable]
Scene count: [N] — [why this many, not more or fewer]
Renderer choices:
  - Scene 1 "[name]": [type] — [one sentence why this type]
  - Scene 2 "[name]": [type] — [one sentence why]
  ...
Narrative arc: [how scenes build on each other]
Duration rationale: [why these durations]
What I'm NOT doing: [notable alternatives considered and rejected]
</planning>
```

Then generate scenes.
The planning block is shown to the user so they can understand
and redirect your choices before you do the work.

---

## Parse the user prompt

Determine:

- **How many scenes** (default: 1; "video about X" implies 3–5 scenes)
- **Scene type** for each — see selection guide below
- **Narrative arc** if multi-scene: opening → development → conclusion
- **Duration** per scene (default: 8s)
- **Background color** per scene (default: `#181818`)

Assign IDs: lowercase hyphenated slugs + timestamp suffix, e.g. `water-cycle-01-1711234567`.

---

## Scene type selection guide

| Type       | Best for                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `motion`   | **Default for most explainers** — HTML/CSS layouts, typography, cards, steps, UI-like scenes, DOM diagrams; GSAP timeline             |
| `canvas2d` | Expressive hand-drawn strokes, particles, procedural/generative art, physics, fluid motion — **not** the default for clean explainers |
| `svg`      | **Rare** — single-scene vector draw-on only when Motion is a poor fit                                                                 |
| `d3`       | Charts, graphs, data visualization with real datasets                                                                                 |
| `three`    | 3D geometry, product visualization, spatial concepts, abstract 3D                                                                     |
| `lottie`   | Iconographic animations, micro-animations, looping decorative elements                                                                |
| `zdog`     | Pseudo-3D illustrations, isometric views, flat-shaded 3D objects, stylized graphics                                                   |
| `physics`  | Live, seekable physics simulations with equations (projectile, orbital, pendulum, oscillator, etc.)                                   |

For multi-scene videos: vary types deliberately when **content** demands (data vs 3D vs hand-drawn vs layout). Do **not** pick SVG just for variety — Motion can carry most explainer beats.

Physics parameter hygiene (to prevent framing/position glitches):

- Prefer angles in degrees in prompts/tool args (e.g. 35, 45, 60). Runtime normalizes units.
- Start with stable parameter ranges before edge-case extremes.
- Harmonic oscillator `x0`/`v0`: use either sim units (`0.5-4`) or pixel-like (`60-240`) — both are normalized.

---

## Planning scenes

Before writing any code, plan the full set of scenes:

- List each scene with: name, type, duration, background color, visual concept
- Describe the narrative arc
- Confirm the plan reads as a coherent video

**Duration calculation:**
For each scene, count all visible text elements (titles, labels, steps, annotations, captions).
Calculate: `duration = max(6, (totalWords / 2.5) + 3)`

Examples:

- Title + subtitle + 1 sentence = ~15 words → max(6, 15/2.5 + 3) = 9s
- 4 step-by-step lines + title = ~40 words → max(6, 40/2.5 + 3) = 19s → cap at 18s
- Diagram with 8 labels + title = ~25 words → max(6, 25/2.5 + 3) = 13s

Scenes should never feel rushed. The viewer needs time to read everything AND understand the visual.

---

## Generating code

Read the rule file for the chosen scene type before generating:

**D3 charts: use `generate_chart` tool** for standard chart types (bar, line, pie, donut, scatter, area, gauge, number, stacked/grouped bar). It calls the pre-built CenchCharts library — zero LLM tokens, consistent animation. Set `animated: true` for cinematic reveals. See `d3.md` for all chart types, data formats, and config options. Only use `add_layer` with `d3` for exotic/custom visualizations.

- SVG: `.claude/skills/cench/rules/svg.md`
- Canvas2D: `.claude/skills/cench/rules/canvas2d.md`
- D3: `.claude/skills/cench/rules/d3.md`
- Three.js: `.claude/skills/cench/rules/three.md`
- Motion/Anime.js: `.claude/skills/cench/rules/motion.md`
- All types: `.claude/skills/cench/rules/core.md` (universal rules)

Apply every rule in the relevant files. The rules are not suggestions.

---

## Scene IDs

Do NOT set a custom id when creating scenes via the API.
Let the API generate a UUID automatically.
The `name` field is the human-readable label shown in the app timeline.
Use descriptive names like "Title Card", "Visual Proof", "Practice Problem 1".

---

## After generating code

POST each scene to the API so it appears in the app and database:

```
POST http://localhost:3000/api/scene
Content-Type: application/json

{
  "projectId": "<projectId from GET /api/projects>",
  "name": "Scene Name",
  "type": "svg",
  "prompt": "what this scene shows",
  "generatedCode": "<the generated SVG/JS/JSON code>",
  "duration": 8,
  "bgColor": "#181818"
}
```

For SVG scenes, use `"svgContent"` instead of `"generatedCode"`.

For **structured D3** (CenchCharts, same as `generate_chart` / Layers editor), POST with `"type": "d3"` and **`chartLayers`**: an array of `{ id, name, chartType, data, config, layout, timing }`. The API compiles `sceneCode` + `d3Data` automatically. Optional `generatedCode: ""`. See `scripts/create-structured-d3-demo.ts`.

The API creates the scene in Postgres, generates the HTML, and writes it to disk.
The app will show the scene in the timeline automatically.

---

## Editing existing scenes

1. List scenes to find the target:
   `GET http://localhost:3000/api/scene?projectId={id}`

2. Get full layer code:
   `GET http://localhost:3000/api/scene?projectId={id}&sceneId={sid}`

3. Identify which layer to change (each has id, type, label, prompt).

4. Read the generatedCode, modify it.

5. Send the update:
   `PATCH http://localhost:3000/api/scene`
   Body: `{ "projectId": "...", "sceneId": "...", "generatedCode": "...", "prompt"?: "..." }`
   Updates Postgres AND regenerates HTML atomically.

NEVER edit `public/scenes/*.html` directly — those are generated outputs.

For D3 scenes with CenchCharts:

- Prefer `generate_chart` for standard chart types.
- Multiple charts in one scene are supported and should remain as structured chart layers (`scene.chartLayers`).
- Keep chart defaults readable (title/labels/grid/legend/legible font) unless user explicitly requests a different visual style.

---

## MCP Tools (optional, powerful)

If the Cench Studio MCP server is connected (`cench-studio` in settings), you have access
to all 50+ agent tools directly — the same tools the in-app agent uses. Key tools:

| Tool                   | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `verify_scene`         | Static analysis: checks content, text overlap, palette, audio, duration |
| `plan_scenes`          | Generate a storyboard before building scenes                            |
| `add_narration`        | Add TTS narration (auto-selects provider)                               |
| `add_sound_effect`     | Search and attach sound effects                                         |
| `add_background_music` | Search and attach background music                                      |
| `generate_chart`       | Create animated D3 chart (zero LLM cost)                                |
| `set_transition`       | Set transition effect between scenes                                    |
| `set_global_style`     | Set palette, font, preset across all scenes                             |
| `add_interaction`      | Add click/hover interactivity to elements                               |
| `select_project`       | Switch between projects                                                 |
| `list_scenes`          | List all scenes in current project                                      |

**When to use MCP tools vs REST API:**

- Use MCP tools for operations the agent already handles well (audio, verification, charts, interactions)
- Use REST API (POST/PATCH `/api/scene`) for creating/editing scene code — you write better code directly
- After creating scenes via REST, call `verify_scene` via MCP to check for issues

---

## After creating scenes

All scenes are parts of ONE video in the timeline.
They play sequentially: scene 1 → 2 → 3 → ... → final.

Direct the user to the app:

```
✅ {N} scenes created (~{total}s total)

Open the app to preview and export:
→ http://localhost:3000

Scenes in order:
1. {name} ({type}, {n}s)
2. {name} ({type}, {n}s)
...

To export as MP4: click Export in the app.
```

Do NOT present individual scene URLs as the primary output.
The app timeline is the primary interface.
Individual URLs are for debugging only.

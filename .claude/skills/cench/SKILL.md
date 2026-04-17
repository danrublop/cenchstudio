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
3. **Always create a new project** for a new video. Do NOT add scenes to an existing project unless the user explicitly asks to edit one.

```
POST http://localhost:3000/api/projects
Content-Type: application/json

{ "name": "Project Title", "outputMode": "mp4" }
```

Use the returned `id` as `projectId` for all subsequent scene creation calls.

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

## Aspect Ratio

Projects support multiple aspect ratios: 16:9 (landscape), 9:16 (vertical), 1:1 (square), 4:5 (portrait).
The scene template injects `WIDTH` and `HEIGHT` JS globals matching the project's dimensions.
Always use these globals instead of hardcoding 1920/1080.

Use `resolveProjectDimensions(aspectRatio, resolution)` from `lib/dimensions.ts` to get pixel dimensions.

---

## Scene type: always `react`

Every scene uses `"type": "react"`. The React component composes whatever renderers
the content needs via bridge components:

| Content type                          | How to build it                                                          |
| ------------------------------------- | ------------------------------------------------------------------------ |
| **Typography, layouts, cards, steps** | Pure JSX + `interpolate()` + `spring()` — no bridge needed               |
| **3D geometry, product viz, text**    | `<ThreeJSLayer>` bridge — meshes, CSG booleans, 3D text, post-processing |
| **Hand-drawn, particles, procedural** | `<Canvas2DLayer>` bridge                                                 |
| **Charts, data viz**                  | `<D3Layer>` bridge, or `generate_chart` MCP tool for standard charts     |
| **Vector draw-on**                    | `<SVGLayer>` bridge                                                      |
| **Micro-animations, icons**           | `<LottieLayer>` bridge                                                   |
| **Combined**                          | Stack multiple bridges in one scene with `<AbsoluteFill>` + `<Sequence>` |

The power of React: one scene can have a Three.js background, HTML text overlay,
Canvas2D particles, and a D3 chart — all composed in JSX.

### Three.js capabilities (via `<ThreeJSLayer>` — ALWAYS use React scenes for 3D)

**Default approach:** `type: 'react'` with `<ThreeJSLayer>` for 3D background + JSX for text overlays.
Call `buildStudio(THREE, scene, camera, renderer)` inside the ThreeJSLayer setup callback
to get a full studio environment (sky sphere, infinite grid, floor, lighting, env map).
Default style is `'white'` (clean white photo studio). Styles: `'white'`, `'corporate'`, `'playful'`, `'cinematic'`, `'showcase'`, `'tech'`, `'sky'`.
Text/info goes in `<AbsoluteFill>` JSX overlays with `interpolate()` for entrance animations.

Three.js r183. Full toolkit available:

- **3D text**: `troika-three-text` — SDF text with any Google Font, outlines, curved text, PBR materials
- **CSG booleans**: `three-bvh-csg` — subtract/union/intersect meshes (holes, cutouts, complex shapes)
- **Materials**: 8 presets (plastic, metal, glass, matte, glow, clearcoat, iridescent, velvet) + full MeshPhysicalMaterial
- **Post-processing**: EffectComposer with bloom, depth of field (BokehPass), SSAO, anti-aliasing (SMAAPass)
- **Lighting**: studio 3-point, cinematic RectAreaLight, sunset, dramatic, neon — plus environment maps
- **Camera**: orbit, dolly, crane, CatmullRomCurve3 paths, zoom (FOV animation)
- **Models**: GLTFLoader + DRACOLoader for compressed .glb, AnimationMixer for Mixamo animations
- **Effects**: Sparkles, Grid, Stars from `@pmndrs/vanilla`
- **34 pre-built components**: lighting, camera, objects, environments — compose via `assembleThreeScene()`
- **Model library**: CC0 GLB models (search via `search_3d_models` tool)

Read `.claude/skills/cench/rules/three.md` for full patterns and code examples.

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

**React is the default renderer.** Read these rule files before generating:

1. `.claude/skills/cench/rules/react.md` — **PRIMARY**: scene structure, bridge components, animation API
2. `.claude/skills/cench/rules/visual-quality.md` — typography, color, spatial, motion quality bar
3. `.claude/skills/cench/rules/core.md` — universal rules (duration, safe area, globals)

Every scene is a React component. Use bridge components (`ThreeJSLayer`, `Canvas2DLayer`,
`D3Layer`, `SVGLayer`, `LottieLayer`) to compose multiple renderers in one scene.

**D3 charts: use `generate_chart` MCP tool** for standard chart types (bar, line, pie, etc.).
Zero LLM tokens, consistent animation. Only write custom D3 via `<D3Layer>` bridge for exotic visualizations.

Legacy rule files (motion.md, canvas2d.md, three.md, svg.md, d3.md, zdog.md) still exist
for reference on renderer-specific APIs when using bridge components.

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
  "type": "react",
  "prompt": "what this scene shows",
  "generatedCode": "{\"sceneCode\": \"<JSX code>\", \"styles\": \"<optional CSS>\"}",
  "duration": 8,
  "bgColor": "#0a0c10"
}
```

The `generatedCode` field for React scenes is a JSON string containing `sceneCode` (JSX) and optional `styles` (CSS).

For **structured D3 charts** via MCP, use the `generate_chart` tool instead of writing D3 code.

The API creates the scene in Postgres, generates the HTML, and writes it to disk.
The app will show the scene in the timeline automatically.

---

## Adding narration (TTS)

If the user wants narration, add it after creating each scene. This is a two-step process:

### Step 1: Generate audio via TTS API

```
POST http://localhost:3000/api/tts
Content-Type: application/json

{ "text": "Narration text here", "sceneId": "<sceneId>" }
```

Returns: `{ "url": "/audio/tts-xxx.mp3", "duration": 12.5, "provider": "native-tts" }`

### Step 2: Attach audio to the scene's audioLayer

The TTS API only generates the audio file — you must PATCH the scene to attach it.
**IMPORTANT:** The audio must go in `audioLayer.tts` (the multi-track format), NOT `audioLayer.src` (legacy).

```
PATCH http://localhost:3000/api/scene
Content-Type: application/json

{
  "sceneId": "<sceneId>",
  "projectId": "<projectId>",
  "audioLayer": {
    "enabled": true,
    "tts": {
      "text": "The narration text",
      "provider": "native-tts",
      "voiceId": null,
      "src": "/audio/tts-xxx.mp3",
      "status": "ready",
      "duration": 12.5,
      "instructions": null
    }
  }
}
```

### Step 3: Update scene duration to match narration

If the narration is longer than the scene, PATCH the scene duration:

```
PATCH http://localhost:3000/api/scene
Content-Type: application/json

{ "sceneId": "<sceneId>", "projectId": "<projectId>", "duration": 14 }
```

Use `ceil(narrationDuration + 1)` as the scene duration.

**IMPORTANT:** PATCH calls on the same project must be sequential (not parallel) to avoid race conditions on the project JSON blob.

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

| Tool                        | What it does                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `verify_scene`              | Static analysis: checks content, text overlap, palette, audio, duration                |
| `plan_scenes`               | Generate a storyboard before building scenes                                           |
| `add_narration`             | Add TTS narration (auto-selects provider)                                              |
| `add_sound_effect`          | Search and attach sound effects                                                        |
| `add_background_music`      | Search and attach background music                                                     |
| `generate_chart`            | Create animated D3 chart (zero LLM cost)                                               |
| `set_transition`            | Set transition effect between scenes                                                   |
| `set_global_style`          | Set palette, font, preset across all scenes                                            |
| `add_interaction`           | Add overlay interactivity (hotspot, choice, quiz, gate, tooltip, form, slider, toggle) |
| `define_scene_variable`     | Define a typed variable on a scene (for slider/toggle/useVariable binding)             |
| `connect_scenes`            | Create scene graph edges with variable conditions for branching                        |
| `select_project`            | Switch between projects                                                                |
| `list_scenes`               | List all scenes in current project                                                     |
| `generate_avatar_narration` | Add talking avatar PIP overlay to a scene (auto-selects provider)                      |
| `generate_avatar_scene`     | Create full presenter scene with avatar, panels, gestures                              |

Avatar tools require an avatar provider configured in project settings (Settings > Media Gen).
See `.claude/skills/cench/rules/avatar.md` for detailed usage, moods, gestures, and placement rules.

**When to use MCP tools vs REST API:**

- Use MCP tools for operations the agent already handles well (audio, verification, charts)
- Use REST API (POST/PATCH `/api/scene`) for creating/editing scene code AND interactions/variables
- After creating scenes via REST, call `verify_scene` via MCP to check for issues

---

## Interactive video workflow

For interactive projects (outputMode: 'interactive'), scenes can respond to viewer input.
All of this is available via REST — no MCP tools required.

### Step 1: Create project with interactive mode

```
POST /api/projects
{ "name": "My Interactive Video", "outputMode": "interactive" }
```

### Step 2: Create scenes with useVariable/useInteraction hooks in code

Use the hooks in `generatedCode` (see `rules/react.md` → "Interactive Scenes"):

- `useVariable('rate', 5)` — reactive state synced with overlays
- `useInteraction('card')` — hover/click handlers
- `useTrigger('done')` — fire events to parent

### Step 3: Add interactions + variables via PATCH

PATCH accepts `interactions` and `variables` arrays directly:

```
PATCH /api/scene
{
  "projectId": "...",
  "sceneId": "...",
  "interactions": [
    {
      "id": "slider-rate",
      "type": "slider",
      "x": 5, "y": 80, "width": 40, "height": 8,
      "appearsAt": 1, "hidesAt": null,
      "entranceAnimation": "slide-up",
      "label": "Interest Rate",
      "min": 1, "max": 15, "step": 0.5,
      "defaultValue": 5,
      "setsVariable": "interestRate",
      "showValue": true, "unit": "%",
      "trackColor": null, "thumbColor": null
    },
    {
      "id": "toggle-compare",
      "type": "toggle",
      "x": 5, "y": 90, "width": 40, "height": 6,
      "appearsAt": 2, "hidesAt": null,
      "entranceAnimation": "fade",
      "label": "Show Comparison",
      "defaultValue": false,
      "setsVariable": "showComparison",
      "onLabel": "On", "offLabel": "Off",
      "activeColor": "#10b981"
    }
  ],
  "variables": [
    {"name": "interestRate", "type": "number", "defaultValue": 5},
    {"name": "showComparison", "type": "boolean", "defaultValue": false}
  ]
}
```

You can also pass `interactions` and `variables` in the initial POST when creating the scene.

### Step 4: Add quiz/choice/hotspot overlays

All 10 interaction types work via the same PATCH `interactions` array:

| Type        | Key fields                                        | Use case                      |
| ----------- | ------------------------------------------------- | ----------------------------- |
| `hotspot`   | label, shape, color, jumpsToSceneId               | Clickable regions on diagrams |
| `choice`    | question, options[{label, jumpsToSceneId}]        | Branching decisions           |
| `quiz`      | question, options[], correctOptionId, explanation | Knowledge checks              |
| `gate`      | buttonLabel, minimumWatchTime                     | Progression blocker           |
| `tooltip`   | triggerLabel, tooltipTitle, tooltipBody           | Info overlays                 |
| `form`      | fields[], setsVariables[], submitLabel            | Data collection               |
| `slider`    | min, max, step, setsVariable, label               | Numeric control               |
| `toggle`    | setsVariable, label, onLabel, offLabel            | Boolean switch                |
| `reveal`    | triggerLabel, revealedContent                     | Click-to-expand               |
| `countdown` | durationSeconds, onComplete                       | Timer                         |

### Step 5: Connect scene graph with conditions

PATCH any scene and include `sceneGraph` to set edges:

```
PATCH /api/scene
{
  "projectId": "...",
  "sceneId": "<any scene in the project>",
  "sceneGraph": {
    "startSceneId": "<first scene id>",
    "nodes": [
      {"id": "<s1>", "position": {"x": 100, "y": 100}},
      {"id": "<s2>", "position": {"x": 400, "y": 100}}
    ],
    "edges": [
      {
        "id": "edge-auto",
        "fromSceneId": "<s1>",
        "toSceneId": "<s2>",
        "condition": {"type": "auto", "interactionId": null, "variableName": null, "variableValue": null}
      },
      {
        "id": "edge-variable",
        "fromSceneId": "<s2>",
        "toSceneId": "<s3>",
        "condition": {
          "type": "variable",
          "interactionId": null,
          "variableName": "score",
          "variableValue": null,
          "variableCondition": {"variableName": "score", "operator": "gte", "value": 80}
        }
      }
    ]
  }
}
```

Condition operators: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `truthy`, `falsy`.

### Full workflow summary

1. POST `/api/projects` with `outputMode: 'interactive'`
2. POST `/api/scene` for each scene (with hooks in code + optional interactions/variables)
3. PATCH `/api/scene` to add/update interactions, variables, and scene graph
4. Open the app to preview — slider/toggle/quiz overlays render on top of scenes

See `rules/react.md` → "Interactive Scenes" for hook documentation and patterns.

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

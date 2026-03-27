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
2. Note: scenes are written as HTML files directly to `public/scenes/`. They do NOT require a database record — just write the file.

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

| Type | Best for |
|---|---|
| `svg` | Diagrams, infographics, data viz with draw-on effects, illustrations, concept maps |
| `canvas2d` | Particle systems, procedural animation, generative art, physics, fluid motion |
| `d3` | Charts, graphs, data visualization with real datasets |
| `three` | 3D geometry, product visualization, spatial concepts, abstract 3D |
| `motion` | Rich CSS layouts, card animations, UI mockups, text-heavy scenes |
| `lottie` | Iconographic animations, micro-animations, looping decorative elements |

For multi-scene videos: vary types deliberately. Don't use the same type for every scene.

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
   Body: `{ "sceneId": "...", "layerId": "...", "generatedCode": "..." }`
   Updates Postgres AND regenerates HTML atomically.

NEVER edit `public/scenes/*.html` directly — those are generated outputs.

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

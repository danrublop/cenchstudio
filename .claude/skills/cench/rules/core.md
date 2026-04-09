# Core Rules — All Scene Types

These rules apply to every scene regardless of type.

**Before generating any scene, also read `rules/design-principles.md`** — it contains the shared design quality bar (composition, typography, color, animation, variety) that applies to all scene types.

---

## Style presets are optional

By default, no style preset is active (`presetId: null`).
The generator has full creative control — choose colors, fonts,
backgrounds, and rendering approach based on the content.

If a user HAS enabled a preset, it sets:
ROUGHNESS — how rough/wobbly strokes are (0=clean, 3=very rough)
TOOL — default drawing tool (marker, pen, chalk, etc)
STROKE_COLOR — the primary ink color for this style
TEXTURE — background texture (applied automatically)
FONT — default font family

These are injected as globals in every scene template.
When a preset is active, use ROUGHNESS, TOOL, STROKE_COLOR as constants.
When no preset is active, these still exist as neutral defaults
(ROUGHNESS=0, TOOL='pen', FONT='Inter') — override freely.

## Renderer: React (default)

**Every scene is a React component.** Use `type: "react"` for all scenes.

Compose multiple renderers in one scene via bridge components:

- Pure JSX for layouts, typography, cards (80% of scenes)
- `<ThreeJSLayer>` for 3D content
- `<Canvas2DLayer>` for hand-drawn/procedural effects
- `<D3Layer>` for data visualization
- `<SVGLayer>` for vector draw-on
- `<LottieLayer>` for micro-animations

See `rules/react.md` for full API and `rules/visual-quality.md` for design guidance.

## Colors

When a preset is active: use PALETTE[0-3] and STROKE_COLOR globals.
When no preset: choose colors that serve the content (see visual-quality.md).

## Everything else below applies to all scenes.

---

## Globals

- Canvas is always **1920x1080** — fill the space deliberately
- Duration defaults to **8 seconds** unless specified

---

## Randomness — NEVER use Math.random()

Always use the mulberry32 seeded PRNG:

```js
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(42)
```

Every scene that uses randomness must include this function and call `rand()` instead of `Math.random()`.

---

## Text rules

- **NEVER animate text character-by-character** — animate the whole element
- Do not use `<foreignObject>` in SVG — use `<text>` elements only
- Pair large display text (80–160px) with smaller annotations (32–56px)

---

## Duration — how long a scene should be

Duration should match how long it takes to **read all visible text aloud**.
Estimate: **150 words per minute** (2.5 words per second).

For each scene, count all visible text (titles, labels, steps, annotations) and calculate:

```
duration = max(6, (wordCount / 2.5) + 3)
```

The +3s padding allows time for visual absorption after the last element appears.

**Scene type minimums:**

- Title cards: 5–7s
- Simple diagrams with labels: 8–12s
- Step-by-step walkthroughs (3+ steps): 12–18s
- Data-heavy scenes (charts, tables, comparisons): 12–18s
- Summary/recap scenes: 10–15s

**If narration will be added later:**
Duration should be set to match narration audio length + 1s padding.
Narration pace: ~150 words per minute. A 30-word narration ≈ 12s scene.

**Key principle:** Viewers need time to read AND understand. A scene with 5 text elements appearing sequentially needs each one visible for at least 1.5–2s before the next appears, plus 2–3s after the last one for the viewer to absorb the complete picture.

## Timing

- Animation must complete within the specified duration
- **Never** assign `--delay: 0` to all elements — stagger deliberately
- Layer order: background 0–20% of duration → midground 20–60% → foreground 60–80% → text 70–90%
- **Final element should finish animating at ~80% of duration** — leave 20% as a "hold" where everything is visible and the viewer absorbs the scene

---

## Safe area & viewport fitting

**ALL content must fit within the 1920×1080 viewBox.** No element may be positioned beyond x=1920 or y=1080 — anything outside is clipped and invisible in the preview and export. If you have too many items (bullet points, list entries, diagram nodes), you MUST either:

- Reduce the number of items to fit
- Use smaller font sizes / tighter spacing
- Split across multiple scenes
- Use a grid or multi-column layout instead of a single vertical list

Keep important content within a 100px inset from all edges (i.e., between x=100 and x=1820, y=100 and y=980). Background graphics may bleed to edges.

**Before finalizing**: mentally verify that your lowest element's y-coordinate + its height stays below 1080, and your rightmost element's x-coordinate + its width stays below 1920.

---

## Fonts

Use system fonts or load from Google Fonts via `<link>` in the HTML head. Safe system fonts: `'Arial'`, `'Georgia'`, `'monospace'`. For a modern look, add:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
```

Then use `font-family: 'Inter', sans-serif`.

---

## Element registration (required for inspector)

ALL generated elements must be registered with window.\_\_register()
so the property inspector can find and edit them.

Every element definition must include:
id: unique string, e.g. 'line-01', 'title-text'
type: element type string (rough-line, rough-circle, rough-rect, rough-arrow, text, svg-path, svg-text, etc.)
label: human-readable name shown in layers panel
bbox: { x, y, w, h } bounding box in 1920x1080 space
animStartTime: when element starts animating (seconds)
animDuration: how long the animation takes (seconds)
visible: true
opacity: 1

Canvas2D elements: register BEFORE adding to GSAP timeline.
SVG elements: add id attributes, auto-registered by scene loader.
Three.js: register with bbox: { x: 0, y: 0, w: 1920, h: 1080 }
(Three.js elements fill the scene, no sub-element selection)

Label elements descriptively:
GOOD: 'Arrow from client to server', 'Pythagorean formula', 'Step 3 label'
BAD: 'element-1', 'path', 'text'

Canvas2D example:

```js
const el_arrow = {
  id: 'arrow-01',
  type: 'rough-arrow',
  label: 'Arrow from client to server',
  x1: 200,
  y1: 540,
  x2: 1720,
  y2: 540,
  color: STROKE_COLOR,
  strokeWidth: 2.5,
  arrowheadSize: 20,
  tool: TOOL,
  seed: 1,
  visible: true,
  opacity: 1,
  animStartTime: 0,
  animDuration: 0.8,
  bbox: { x: 200, y: 520, w: 1520, h: 40 },
}
window.__register(el_arrow)
```

For redrawAll(), read properties from element objects (not hardcoded values)
so inspector property patches take effect immediately.

## Output format

Output raw code only. No markdown fences. No explanation before or after the code block.

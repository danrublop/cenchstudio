# Canvas2D Scene Rules

---

## Output format

Output raw JavaScript only. No HTML. No `<script>` tags. The template injects it.

The canvas renderer is auto-injected before your code — all drawing functions below are available as globals. Do not re-define them.

---

## Required skeleton

Copy this exactly. Fill in `draw()` with your animation logic:

```js
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const DURATION = 8; // replace with actual duration in seconds
const START_T = parseFloat(new URLSearchParams(location.search).get('t') || '0');
const startWall = performance.now() - START_T * 1000;

function getT() { return (performance.now() - startWall) / 1000; }

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn  = t => t * t * t;
const lerp    = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.max(0, Math.min(1, t));

function draw(t) {
  ctx.clearRect(0, 0, 1920, 1080);
  // YOUR DRAWING CODE — drive everything with t (0 → DURATION)
  // Background color is set by body CSS — do NOT fill it here
}

function loop() {
  const t = getT();
  if (t < DURATION) {
    draw(t);
    window.__animFrame = requestAnimationFrame(loop);
  } else {
    draw(DURATION);
  }
}

window.__pause  = () => { cancelAnimationFrame(window.__animFrame); };
window.__resume = () => { window.__animFrame = requestAnimationFrame(loop); };

window.__animFrame = requestAnimationFrame(loop);
```

---

## Drawing Tools

The renderer provides 5 hand-drawn drawing tools. Pass them via the `tool` option:

| Tool | `tool` value | Character | Best for |
|------|-------------|-----------|----------|
| Marker | `'marker'` | Bold, consistent, slight wobble | Titles, thick outlines |
| Pen | `'pen'` | Fine, precise, natural | Diagrams, labels, detail work |
| Chalk | `'chalk'` | Rough, grainy, textured | Chalkboard scenes, artistic fills |
| Brush | `'brush'` | Wide, tapered, calligraphic | Expressive strokes, watercolor-like |
| Highlighter | `'highlighter'` | Broad, semi-transparent | Emphasis boxes, underlining |

```js
// Example: draw a chalk-style circle on a chalkboard scene
await animateRoughCircle(ctx, 960, 540, 200, {
  tool: 'chalk',
  color: '#ffffff',
  seed: 42,
}, 800);
```

---

## Pressure and Texture

Pressure and texture are **automatic** — they are controlled by the tool you select.

- **Pressure**: Each tool has a built-in pressure profile. Strokes taper at tips and widen toward the peak. Override with `pressureOpts`:
  ```js
  pressureOpts: { peakAt: 0.4, minWidth: 0.25, sharpness: 2.5 }
  ```
  - `peakAt` (0–1): Where the stroke is widest
  - `minWidth` (0–1): Width at tips as a fraction of base width
  - `sharpness`: How sharply pressure peaks (higher = more pronounced)

- **Texture**: `chalk` and `brush` tools automatically apply grain/chalk overlays. Call `applyTextureOverlay` once at scene start for chalkboard scenes:
  ```js
  // Call once, not every frame — texture is cached
  applyTextureOverlay(canvas, 'chalk', 42);
  ```

---

## Path Smoothing

Chaikin's corner-cutting algorithm is applied automatically per tool. Override iterations:

```js
// More smoothing = rounder corners
await animateRoughRect(ctx, 100, 100, 400, 300, {
  tool: 'pen',
  smooth: true,
  smoothIterations: 3,
}, 600);

// Disable smoothing for raw, jagged chalk
await animateRoughLine(ctx, 100, 100, 800, 400, {
  tool: 'chalk',
  smooth: false,
}, 500);
```

---

## Available Drawing Functions

All `animateRough*` and `animate*` functions are **async** and return `Promise<void>`.
Use `await` or chain with `.then()` to sequence animations.

### Hand-drawn primitives (with roughness/wobble)

```js
// Line from point to point
await animateRoughLine(ctx, x1, y1, x2, y2, opts, durationMs);

// Circle — diameter is total width (not radius)
await animateRoughCircle(ctx, cx, cy, diameter, opts, durationMs);

// Rectangle — top-left origin
await animateRoughRect(ctx, x, y, w, h, opts, durationMs);

// Polygon — array of [x, y] vertices, auto-closed
await animateRoughPolygon(ctx, [[x1,y1],[x2,y2],[x3,y3]], opts, durationMs);

// Freeform curve — control points are smoothed before rendering
await animateRoughCurve(ctx, [[x1,y1],[x2,y2],[x3,y3]], opts, durationMs);

// Arrow with arrowhead (80% shaft, 20% head timing split)
await animateRoughArrow(ctx, x1, y1, x2, y2, opts, durationMs);
```

### Smooth primitives (no wobble)

```js
// Perfectly straight line
await animateLine(ctx, x1, y1, x2, y2, opts, durationMs);

// Perfect circle — r is radius
await animateCircle(ctx, cx, cy, r, opts, durationMs);

// Clean arrow with precise arrowhead
await animateArrow(ctx, x1, y1, x2, y2, opts, durationMs);
```

### Text — NEVER animated, ALWAYS instant

```js
// Text appears immediately (or after delay ms)
drawText(ctx, 'Hello World', x, y, {
  size: 48,          // font size in pixels
  color: '#ffffff',
  weight: 'bold',    // 'normal' | 'bold' | '600' etc.
  align: 'center',   // 'left' | 'center' | 'right'
  font: 'sans-serif',
  delay: 1500,       // optional: ms to wait before appearing
});
```

**CRITICAL**: Text NEVER animates character by character. Use `delay` to control when
the complete text appears. Never loop over characters.

### Utility

```js
// Fill a shape with a fade-in effect
await fadeInFill(ctx, (ctx) => { ctx.fillRect(x, y, w, h); }, '#color', alpha, durationMs);

// Simple delay
await wait(500); // pause for 500ms

// Draw a pre-loaded asset by ID
await drawAsset(ctx, 'assetId', { x, y, width, height, opacity });
```

---

## DrawOpts Reference

All drawing functions accept an `opts` object:

```js
{
  color: '#ffffff',         // stroke/text color (default '#000000')
  width: 4,                 // stroke width in pixels (overrides tool default)
  roughness: 1.2,           // wobble magnitude (overrides tool default)
  seed: 42,                 // PRNG seed — use a fixed number, never Math.random()
  fill: '#ff0000',          // fill color (null = no fill)
  fillAlpha: 0.2,           // fill opacity 0–1 (default 0.15)
  tool: 'chalk',            // which tool preset to use (default 'pen')
  pressureOpts: {           // override pressure profile
    peakAt: 0.4,
    minWidth: 0.25,
    sharpness: 2.5,
  },
  smooth: true,             // apply Chaikin smoothing (default: per-tool)
  smoothIterations: 2,      // number of smoothing passes
}
```

---

## Chalkboard Scenes

For chalkboard-style scenes:

1. Set `bgColor` to a dark green or near-black (e.g. `'#1a3a2a'` or `'#111111'`)
2. Use `tool: 'chalk'` for all strokes
3. Use white or off-white stroke colors (`'#f0f0e8'`, `'#e8e0d0'`)
4. Apply chalk texture once at the start (NOT in the draw loop):

```js
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// Apply chalk texture once — cached after first call
applyTextureOverlay(canvas, 'chalk', 42);

// Now draw chalk elements
async function runScene() {
  await animateRoughLine(ctx, 200, 400, 1720, 400, {
    tool: 'chalk',
    color: '#f0f0e8',
    width: 3,
    seed: 42,
  }, 800);

  drawText(ctx, 'E = mc²', 960, 300, {
    size: 120,
    color: '#f0f0e8',
    align: 'center',
    font: 'serif',
    delay: 900,
  });
}

runScene();
```

---

## Sequencing Animations

Use async/await to sequence drawing operations:

```js
async function runScene() {
  // Draw in sequence
  await animateRoughRect(ctx, 100, 100, 400, 300, { tool: 'marker', color: '#3b82f6', seed: 1 }, 500);
  await animateRoughLine(ctx, 300, 250, 900, 540, { tool: 'pen', color: '#ffffff', seed: 2 }, 400);
  drawText(ctx, 'Result', 900, 540, { size: 48, color: '#ffffff', delay: 0 });
  await wait(300);
  await animateRoughArrow(ctx, 960, 200, 960, 800, { tool: 'pen', color: '#f97316', seed: 3 }, 600);
}

runScene();
```

For parallel animations, use `Promise.all`:

```js
async function runScene() {
  // Draw three lines simultaneously
  await Promise.all([
    animateRoughLine(ctx, 100, 200, 500, 200, { tool: 'marker', color: '#ef4444', seed: 1 }, 500),
    animateRoughLine(ctx, 100, 400, 500, 400, { tool: 'marker', color: '#22c55e', seed: 2 }, 500),
    animateRoughLine(ctx, 100, 600, 500, 600, { tool: 'marker', color: '#3b82f6', seed: 3 }, 500),
  ]);
}
```

---

## Animation patterns

**Fade-in (rAF loop):**
```js
ctx.globalAlpha = easeOut(clamp01((t - startDelay) / fadeTime));
// draw element
ctx.globalAlpha = 1; // always reset after
```

**Motion:**
```js
const x = lerp(startX, endX, easeOut(clamp01((t - delay) / moveDur)));
```

**Stagger:** element N starts at `t = N * (DURATION / totalElements)`

**Layer order:** background 0–20% of duration → midground 20–60% → foreground/labels 60–90%

---

## Randomness — CRITICAL

- NEVER use `Math.random()`
- ALWAYS use `mulberry32` with a fixed numeric seed
- `mulberry32` is injected by the renderer — it is available as a global

```js
const rand = mulberry32(42); // fixed seed
const x = rand() * 1920;    // deterministic "random" position
```

---

## Do not

- Do not fill the background in `draw()` — `clearRect` + body CSS handles it
- Do not use `Math.random()` — use mulberry32 (already available as a global)
- Do not use `setInterval` — use the rAF loop pattern above
- Do not reference DOM elements outside the canvas
- Do not animate text character by character — text always appears as a whole unit
- Do not re-define `mulberry32`, `drawText`, `animateRoughLine`, or any renderer function — they are already injected

---

## Coordinates and scale

- Canvas logical size: 1920x1080 (set via `width`/`height` attributes)
- CSS scales it to fill the viewport — your coordinates are always in 1920x1080 space

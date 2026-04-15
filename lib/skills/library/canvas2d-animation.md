---
id: canvas2d-animation
name: Canvas2D Hand-Drawn Animation
category: renderer
tags: [canvas, canvas2d, hand-drawn, procedural, drawing, whiteboard, chalkboard, pen, marker, chalk, brush]
sceneType: canvas2d
complexity: medium
requires: []
description: Canvas2D scenes with hand-drawn tools (pen, marker, chalk, brush, highlighter). Best for expressive, procedural, or whiteboard-style art.
parameters:
  - name: tool
    type: string
    default: pen
    description: Drawing tool style
    enum: [pen, marker, chalk, brush, highlighter]
  - name: seed
    type: number
    default: 42
    description: PRNG seed for deterministic randomness
---

## Canvas2D Scenes

For **standard animated backgrounds** (starfield, particles, waves, rain/snow, fire haze, EQ bars, etc.), call `apply_canvas_motion_template` with a built-in `templateId` — deterministic, scrub-friendly, **no LLM cost**. On **motion / d3 / svg** scenes, set `asBackground: true` to keep foreground content and only add the full-frame canvas behind it; omit it (or use false) to replace the whole scene with Canvas2D. Use `add_layer` with canvas2d only when you need custom art the templates do not cover.

- Canvas is always 1920x1080
- Use requestAnimationFrame for animation loops
- Clear with ctx.clearRect(0, 0, 1920, 1080) each frame
- Access elapsed time via the getT() pattern in the skeleton
- NEVER use Math.random() — use mulberry32(seed) seeded PRNG (available as a global)
- The canvas renderer is auto-injected — all drawing functions below are globals

## Drawing Tools — choose based on visual character

- `'pen'` — fine, precise, hand-drawn lines. Default for diagrams and technical scenes.
- `'marker'` — bold, consistent strokes. Use for titles, thick outlines, emphasis.
- `'chalk'` — rough, grainy, textured. Required for chalkboard scenes. Use white/light colors.
- `'brush'` — wide, tapered, calligraphic. Use for expressive or artistic strokes.
- `'highlighter'` — broad, semi-transparent. Use for underlines and emphasis boxes.

## Drawing Function Signatures

```js
// All animateRough* and animate* functions return Promise<void> — use await
await animateRoughLine(ctx, x1, y1, x2, y2, { tool, color, width, seed }, durationMs);
await animateRoughCircle(ctx, cx, cy, diameter, { tool, color, seed }, durationMs);
await animateRoughRect(ctx, x, y, w, h, { tool, color, fill, fillAlpha, seed }, durationMs);
await animateRoughPolygon(ctx, [[x,y],...], { tool, color, seed }, durationMs);
await animateRoughCurve(ctx, [[x,y],...], { tool, color, seed }, durationMs);
await animateRoughArrow(ctx, x1, y1, x2, y2, { tool, color, seed }, durationMs);
await animateLine(ctx, x1, y1, x2, y2, { color, width, seed }, durationMs);
await animateCircle(ctx, cx, cy, radius, { color, width, fill, seed }, durationMs);
await animateArrow(ctx, x1, y1, x2, y2, { color, width, seed }, durationMs);

// Text is NEVER animated — appears instantly or after a delay
drawText(ctx, text, x, y, { size, color, weight, align, font, delay });

// Utilities
await fadeInFill(ctx, (ctx) => { ctx.fillRect(x,y,w,h); }, color, alpha, durationMs);
await wait(ms);
await drawAsset(ctx, assetId, { x, y, width, height, opacity });

// Texture overlay for chalkboard scenes — call ONCE, not in draw loop
applyTextureOverlay(canvas, 'chalk', seed);
```

## Tool Selection Guide

- Whiteboard/diagram scene → `'pen'` or `'marker'`
- Chalkboard scene → `'chalk'` exclusively; call `applyTextureOverlay(canvas, 'chalk', 42)` once at start
- Artistic/expressive scene → `'brush'`
- Clean modern scene → `animateLine` / `animateCircle` (no roughness)
- Key term highlight → `'highlighter'` with semi-transparent fill

## Sequencing Animations

```js
async function runScene() {
  await animateRoughRect(ctx, 100, 100, 400, 300, { tool: 'marker', color: '#3b82f6', seed: 1 }, 500);
  drawText(ctx, 'Label', 300, 250, { size: 36, color: '#fff', align: 'center' });
  await animateRoughArrow(ctx, 500, 250, 900, 540, { tool: 'pen', color: '#f97316', seed: 2 }, 400);
}
runScene();
```

## Chalkboard Pattern

```js
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
applyTextureOverlay(canvas, 'chalk', 42); // once, not in draw loop

async function runScene() {
  await animateRoughLine(ctx, 200, 540, 1720, 540, { tool: 'chalk', color: '#f0f0e8', seed: 42 }, 800);
  drawText(ctx, 'E = mc²', 960, 300, { size: 120, color: '#f0f0e8', align: 'center', font: 'serif', delay: 900 });
}
runScene();
```

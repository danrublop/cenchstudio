# Motion/Anime.js Scene Rules

**When to use:** **Default** for most explainer-style scenes: HTML/CSS layouts, typography, cards, step lists, UI-like frames, and diagram-like compositions built as DOM + GSAP (`window.__tl`). Prefer Motion over SVG and over canvas2d unless the content needs vector-only draw-on or hand-drawn/canvas technique.

---

## Output format

Output three pieces that get assembled into the HTML template:

- `styles` — raw CSS string (no `<style>` tags)
- `htmlContent` — HTML elements (no `<body>` tags, no `<html>` tags)
- `sceneCode` — JavaScript that runs inside a `<script type="module">`

---

## Libraries available

- `anime` — Anime.js 3.2.2 global (loaded via CDN script tag before your code)
- `animate`, `stagger` — imported from Motion v11 (may be undefined if CDN fails — always check before using)
- `window.__tl` — GSAP master timeline (the playback controller drives all timing)

---

## Template globals (injected before your code — do NOT redeclare)

`SCENE_ID`, `PALETTE`, `DURATION`, `ROUGHNESS`, `FONT`, `STROKE_COLOR`, `WIDTH` (default 1920), `HEIGHT` (default 1080) — dimensions change based on the project's aspect ratio

---

## CSS rules (styles)

- Use responsive layout: **flexbox or CSS grid** — NOT absolute pixel positioning
- Use `clamp()`, `vw`/`vh`, and percentages for sizing so content fits any viewport
- Body is fixed at `WIDTH × HEIGHT` (defaults to 1920×1080 for 16:9) with `overflow: hidden` — content MUST fit within these bounds
- Elements should start visible by default. Use CSS `@keyframes` for entrance animations
  that work without JavaScript (like SVG scenes do)
- You CAN set `opacity: 0` on elements if you animate them via CSS `animation: ... forwards`
- NEVER rely solely on JavaScript to make elements visible — always have a CSS fallback

### Good pattern — CSS-driven entrance:

```css
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.title {
  opacity: 0;
  animation: fadeSlideUp 0.6s ease-out 0.2s forwards;
}
```

### Good pattern — responsive layout:

```css
.container {
  display: flex;
  width: 100%;
  height: 100vh;
  align-items: center;
  justify-content: center;
  gap: 3%;
  padding: 4%;
}
.card {
  flex: 1;
  font-size: clamp(24px, 2vw, 36px);
}
```

### Bad pattern — absolute pixel positioning (AVOID):

```css
/* DON'T: overflows in small viewports */
.card {
  position: absolute;
  left: 1200px;
  top: 400px;
  width: 500px;
}
```

---

## HTML content rules

- No `<body>`, `<html>`, `<head>` tags — just the inner content
- Use semantic elements: `<div>`, `<h1>`, `<p>`, `<ul>`, `<span>`
- Assign IDs or classes for targeting in sceneCode
- Wrap everything in a container div with flex/grid layout

---

## sceneCode — GSAP timeline pattern (required)

ALL animation timing MUST go through `window.__tl` (the GSAP master timeline).
This ensures playback controls (play, pause, seek, scrub) work correctly.

**Required skeleton:**

```js
const els = {
  // Cache DOM elements
  title: document.getElementById('title'),
  items: document.querySelectorAll('.item'),
}

const state = { progress: 0 }
window.__tl.to(
  state,
  {
    progress: 1,
    duration: DURATION,
    ease: 'none',
    onUpdate: function () {
      const p = state.progress // 0 → 1 over DURATION seconds
      // Drive animations based on progress:
      // if (p > 0.1) els.title.style.opacity = Math.min(1, (p - 0.1) / 0.1);
    },
  },
  0,
)
```

**Progress-based animation tips:**

- Fade in: `Math.min(1, (p - startAt) / fadeLength)`
- Stagger: element N enters at `p > N * 0.1`
- Oscillate: `Math.sin(p * Math.PI * 2)`
- Ease-in: `Math.pow((p - start) / length, 2)`

---

## Timing guidance

- Total animation should complete within scene duration
- Layer order: backgrounds first → content second → text/labels last
- Keep all content within viewport bounds — if too many items, use smaller text or multi-column layout

---

## What NOT to do

- Do NOT use standalone `anime()` timelines — use `window.__tl` for all timing
- Do NOT use `setTimeout`, `setInterval`, or `requestAnimationFrame`
- Do NOT use `position: absolute` with pixel values for layout — use flex/grid
- Do NOT use `Math.random()` — use mulberry32 (see `core.md`)
- Do NOT animate text character-by-character — animate the whole element
- Do NOT redeclare template globals (DURATION, WIDTH, HEIGHT, PALETTE, etc.)
- Do NOT depend on `animate()` from Motion v11 being available — it may fail to load

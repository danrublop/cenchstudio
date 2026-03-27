# Motion/Anime.js Scene Rules

---

## Output format

Output three pieces that get assembled into the HTML template:

- `styles` — raw CSS string (no `<style>` tags)
- `htmlContent` — HTML elements (no `<body>` tags, no `<html>` tags)
- `sceneCode` — JavaScript that runs after Anime.js and Motion v11 are loaded

---

## Libraries available

- `anime` — Anime.js 3.2.2 global (loaded via CDN script tag)
- `animate`, `stagger` — imported from Motion v11 ES module (`https://esm.sh/motion@11`)

**Do not use `timeline`** — it is not exported from Motion v11. Use `anime()` with delays for sequences.

---

## CSS rules (styles)

- All CSS elements must start with `opacity: 0` — animate them in via sceneCode
- Use `position: absolute` for all positioned elements
- Use `left`/`top` as percentages or px values relative to 1920x1080
- Body is 1920x1080 — use percentages to position relative to canvas size

```css
.card {
  position: absolute;
  opacity: 0;
  left: 10%;
  top: 20%;
  width: 400px;
  height: 300px;
  background: #e84545;
}
```

---

## HTML content rules

- No `<body>`, `<html>`, `<head>` tags — just the inner content
- Use semantic elements: `<div>`, `<h1>`, `<p>`, `<ul>`, `<span>`
- Assign IDs or classes for targeting in sceneCode
- Everything is positioned absolute relative to the 1920x1080 body

---

## sceneCode patterns

**Simple sequence with anime:**
```js
anime({
  targets: '.title',
  opacity: [0, 1],
  translateY: [30, 0],
  duration: 800,
  easing: 'easeOutCubic',
  delay: 0
});

anime({
  targets: '.subtitle',
  opacity: [0, 1],
  translateY: [20, 0],
  duration: 600,
  easing: 'easeOutCubic',
  delay: 400
});
```

**Staggered list with Motion:**
```js
animate('.list-item', {
  opacity: [0, 1],
  y: [20, 0]
}, {
  delay: stagger(0.1),
  duration: 0.6,
  easing: 'ease-out'
});
```

**Combined sequence:**
Use `anime()` with explicit `delay` values for sequencing. For grid/list elements use `stagger()` from Motion.

---

## Timing guidance

- Total animation should complete within scene duration
- Use `delay` values (in ms for anime, in seconds for Motion) to stagger elements
- Layer order: backgrounds first → content second → text/labels last
- Typical stagger: 100–200ms between elements

---

## What NOT to do

- Do not use `timeline` from Motion v11 — not exported
- Do not use `position: fixed` — use `absolute`
- Do not use `Math.random()` — use mulberry32 (see `core.md`)
- Do not animate char-by-char — animate the whole text element

---

## HTML template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: BG_COLOR_HERE; position: relative; }
    STYLES_HERE
  </style>
</head>
<body>
  HTML_CONTENT_HERE
  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>
  <script type="module">
    import { animate, stagger } from "https://esm.sh/motion@11";
    window.__pause  = () => { document.querySelectorAll('*').forEach(el => {
      const s = getComputedStyle(el);
      if (s.animationName && s.animationName !== 'none') el.style.animationPlayState = 'paused';
    }); };
    window.__resume = () => { document.querySelectorAll('*').forEach(el => {
      const s = getComputedStyle(el);
      if (s.animationName && s.animationName !== 'none') el.style.animationPlayState = 'running';
    }); };
    SCENE_CODE_HERE
  </script>
</body>
</html>
```

Replace `BG_COLOR_HERE`, `STYLES_HERE` (raw CSS), `HTML_CONTENT_HERE`, and `SCENE_CODE_HERE`.

# SVG Scene Rules

**When to use:** Rarely. Prefer **Motion** for explainer layouts, cards, and typography. Use SVG only when a single self-contained vector scene with template `stroke` / `fadein` classes is clearly best (e.g. strict path draw-on, no DOM layout).

---

## SVG structure

Output the raw `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}">...</svg>` element (use the WIDTH/HEIGHT globals; defaults to 1920×1080 for 16:9). No wrapping HTML — the template handles that.

Always use this layer order inside the SVG:

```svg
<g id="bg">         <!-- full-bleed backgrounds, gradients — delay 0 to 20% of duration -->
<g id="midground">  <!-- primary graphics: charts, diagrams, illustrations — delay 20% to 60% -->
<g id="fg">         <!-- connectors, arrows, supporting lines — delay 60% to 80% -->
<g id="text">       <!-- all <text> elements: titles, labels, numbers — delay 70% to 90% -->
```

---

## Animation classes

Apply via `class="..."`. Set timing via `style="--dur:1s; --delay:0.5s"`.

| Class        | Effect                           | CSS vars                                      | Use for                              |
| ------------ | -------------------------------- | --------------------------------------------- | ------------------------------------ |
| `stroke`     | Path draw-on reveal              | `--len` (auto-calculated), `--dur`, `--delay` | Lines, paths, arrows, outlines       |
| `fadein`     | Opacity 0→1                      | `--dur`, `--delay`                            | Filled shapes, backgrounds, icons    |
| `scale`      | Scale 0→1 with elastic overshoot | `--dur`, `--delay`                            | Icons, callout circles, emphasis     |
| `slide-up`   | Slide up from below + fade       | `--dur`, `--delay`                            | Labels, annotations, captions        |
| `slide-left` | Slide from right + fade          | `--dur`, `--delay`                            | Titles entering from right           |
| `bounce`     | Elastic pop with overshoot       | `--dur`, `--delay`                            | Key numbers, highlighted data points |
| `rotate`     | Rotation entrance + fade         | `--dur`, `--delay`                            | Arrows, spinning decorative elements |

For `stroke` elements always add: `stroke-linecap="round" stroke-linejoin="round" fill="none"`

The `--len` variable is auto-calculated by the script at bottom of the SVG template:

```js
document.querySelectorAll('.stroke').forEach((el) => {
  if (el.getTotalLength) el.style.setProperty('--len', el.getTotalLength())
})
```

---

## Text elements

- Use `<text>` only — never `<foreignObject>`
- Specify `dominant-baseline` and `text-anchor` on every text element
- Apply `class="slide-up"` or `class="fadein"` with staggered `--delay`
- VIDEO sizing — nothing below 24px. Display: 100–180px; headings: 48–72px; body/labels: 32–56px; smallest annotations: 24px minimum

---

## Colors

Use the palette: `#181818, #121212, #e84545, #151515, #f0ece0`

- `#e84545` — red accent, use for emphasis, highlights, key numbers
- `#f0ece0` — off-white, use for primary text and light shapes
- `#181818` / `#121212` / `#151515` — dark backgrounds and fills

---

## Common patterns

**Arrow**: `<line class="stroke">` for shaft + `<polygon class="fadein">` for arrowhead. Stagger arrowhead delay 0.2s after shaft.

**Callout circle**: `<circle class="scale">` + `<text class="bounce">` inside. Use `transform-origin: center`.

**Data bar**: `<rect class="scale" style="transform-origin: bottom center">` — scales up from baseline.

**Connecting line**: `<path class="stroke">` with `d="M x1,y1 C cx,cy cx,cy x2,y2"` for curved connectors.

---

## What NOT to do

- Do not use `<foreignObject>` — it breaks in headless rendering
- Do not set `--delay: 0` on every element — always stagger
- Do not put text in `<image>` elements
- Do not use `clip-path` with external references — inline only
- Do not use CSS animations other than the predefined classes — the template CSS handles keyframes
- Do not animate `transform` directly on SVG elements without `transform-box: fill-box` for correct origin

---

## HTML template

Wrap the SVG output in this template exactly:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        width: 100%;
        height: 100vh;
        overflow: hidden;
        background: BG_COLOR_HERE;
      }
      #svg-layer {
        position: absolute;
        inset: 0;
        z-index: 2;
      }
      #svg-layer svg {
        width: 100%;
        height: 100%;
      }
      .stroke {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: var(--len, 1000);
        stroke-dashoffset: var(--len, 1000);
        animation: draw var(--dur, 1s) ease-in-out var(--delay, 0s) forwards;
      }
      .fadein {
        opacity: 0;
        animation: pop var(--dur, 0.4s) ease var(--delay, 0s) forwards;
      }
      .scale {
        opacity: 0;
        transform-origin: center;
        animation: scaleIn var(--dur, 0.4s) ease var(--delay, 0s) forwards;
      }
      .slide-up {
        opacity: 0;
        animation: slideUp var(--dur, 0.5s) ease var(--delay, 0s) forwards;
      }
      .slide-left {
        opacity: 0;
        animation: slideLeft var(--dur, 0.5s) ease var(--delay, 0s) forwards;
      }
      .bounce {
        opacity: 0;
        transform-origin: center;
        animation: bounceIn var(--dur, 0.6s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay, 0s) forwards;
      }
      .rotate {
        opacity: 0;
        transform-origin: center;
        animation: rotateIn var(--dur, 0.5s) ease var(--delay, 0s) forwards;
      }
      @keyframes draw {
        to {
          stroke-dashoffset: 0;
        }
      }
      @keyframes pop {
        to {
          opacity: 1;
        }
      }
      @keyframes scaleIn {
        from {
          opacity: 0;
          transform: scale(0);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes slideLeft {
        from {
          opacity: 0;
          transform: translateX(50px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes bounceIn {
        0% {
          opacity: 0;
          transform: scale(0);
        }
        60% {
          opacity: 1;
          transform: scale(1.15);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes rotateIn {
        from {
          opacity: 0;
          transform: rotate(-15deg);
        }
        to {
          opacity: 1;
          transform: rotate(0deg);
        }
      }
    </style>
  </head>
  <body>
    <div id="svg-layer">SVG_CONTENT_HERE</div>
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.stroke').forEach((el) => {
          if (el.getTotalLength) el.style.setProperty('--len', el.getTotalLength())
        })
        const t = parseFloat(new URLSearchParams(location.search).get('t') || '0')
        if (t > 0) {
          document.querySelectorAll('*').forEach((el) => {
            const s = window.getComputedStyle(el)
            if (s.animationName && s.animationName !== 'none') {
              el.style.animationDelay = (parseFloat(s.animationDelay) || 0) - t + 's'
            }
          })
        }
      })
    </script>
  </body>
</html>
```

Replace `BG_COLOR_HERE` with the actual background color hex. Replace `SVG_CONTENT_HERE` with the generated `<svg>` element.

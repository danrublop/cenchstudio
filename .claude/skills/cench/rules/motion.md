# Motion & Animation Rules

This file covers animation techniques across ALL scene types.
React is the default renderer — most animation uses `interpolate()`, `spring()`,
and bridge components. Motion/GSAP scenes use `window.__tl` and CenchMotion.

---

## Motion Personality System (`lib/motion/easing.ts`)

Every scene should have a consistent motion personality. Use `choose_motion_style`
(agent tool, zero cost) BEFORE generating animations to get easing configs.

| Personality   | Duration  | Stagger | Overshoot | GSAP entrance   | CSS entrance                        |
| ------------- | --------- | ------- | --------- | --------------- | ----------------------------------- |
| **Playful**   | 150-300ms | 60ms    | 15%       | `back.out(1.4)` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| **Premium**   | 350-600ms | 80ms    | 0%        | `power3.out`    | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| **Corporate** | 200-400ms | 70ms    | 2%        | `power2.inOut`  | `cubic-bezier(0.42, 0, 0.58, 1)`    |
| **Energetic** | 100-250ms | 40ms    | 25%       | `back.out(2.0)` | `cubic-bezier(0.22, 1.8, 0.36, 1)`  |

Emotion-to-personality mapping:

- joy/fun/delight/celebration → **playful**
- elegance/luxury/calm/sophistication → **premium**
- trust/professionalism/clarity/educational → **corporate**
- urgency/excitement/energy/speed → **energetic**

---

## React Scenes (default)

### Easing in `interpolate()`

```jsx
// Energetic entrance
const y = interpolate(frame, [0, 12], [40, 0], {
  extrapolateRight: 'clamp',
  easing: Easing.bezier(0.22, 1.8, 0.36, 1),
})

// Premium entrance (smooth deceleration)
const opacity = interpolate(frame, [0, 24], [0, 1], {
  extrapolateRight: 'clamp',
  easing: Easing.bezier(0.4, 0, 0.2, 1),
})

// Exit (always faster than entrance — 75% duration)
const exitOp = interpolate(frame, [exitStart, exitStart + 12], [1, 0], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
  easing: Easing.bezier(0.7, 0, 0.84, 0),
})
```

### Springs (for organic motion)

```jsx
const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })
// Presets: spring.config.gentle, .stiff, .wobbly, .snappy, .molasses
```

### Staggered lists

```jsx
items.map((item, i) => {
  const enterFrame = 20 + i * 4 // 4 frames = ~133ms at 30fps
  const op = interpolate(frame, [enterFrame, enterFrame + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1.8, 0.36, 1), // energetic
  })
  return <div style={{ opacity: op }}>{item}</div>
})
```

---

## LottieLayer in React Scenes

lottie-web is loaded globally in all React scenes. Two approaches:

### Inline JSON (for simple generated Lotties)

```jsx
var lottieData = { v: '5.7.1', fr: 30, ... };
<LottieLayer data={lottieData} style={{ width: 200, height: 200 }} />
```

### URL loading (for searched pre-made Lotties)

Define a `LottieFromURL` component that uses `window.lottie.loadAnimation({ path: url })`:

```jsx
function LottieFromURL(props) {
  var ref = React.useRef(null)
  var animRef = React.useRef(null)
  var frame = useCurrentFrame()
  var config = useVideoConfig()

  React.useEffect(
    function () {
      if (!ref.current || !props.url || !window.lottie) return
      if (animRef.current) animRef.current.destroy()
      animRef.current = window.lottie.loadAnimation({
        container: ref.current,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: props.url,
      })
      animRef.current.addEventListener('DOMLoaded', function () {
        animRef.current.goToAndStop(0, true)
      })
      return function () {
        if (animRef.current) animRef.current.destroy()
      }
    },
    [props.url],
  )

  React.useEffect(
    function () {
      if (!animRef.current || !animRef.current.totalFrames) return
      var time = frame / config.fps
      var lottieFrame = Math.min(time * (animRef.current.frameRate || 30), animRef.current.totalFrames - 1)
      animRef.current.goToAndStop(Math.max(0, lottieFrame), true)
    },
    [frame, config.fps],
  )

  return React.createElement('div', { ref: ref, style: props.style })
}
```

### Canvas renderer (for complex/performance-sensitive Lotties)

```jsx
<LottieLayer data={lottieData} renderer="canvas" />
```

---

## Motion/GSAP Scenes (legacy, still supported)

### CenchMotion Component Library

All scenes load `CenchMotion` — use these instead of raw GSAP for common patterns:

```js
// Text animations (SplitText powered)
CenchMotion.textReveal('.title', { style: 'chars', tl })
CenchMotion.textReveal('.subtitle', { style: 'words', tl })
CenchMotion.textReveal('.headline', { style: 'mask', tl })

// Element reveals
CenchMotion.fadeUp('.element', { tl, delay: 0.3 })
CenchMotion.staggerIn('.cards .card', { tl, stagger: 0.1, direction: 'up' })
CenchMotion.scaleIn('.icon', { tl, ease: 'back.out(1.7)' })
CenchMotion.slideIn('.panel', { from: 'right', tl })

// Numbers and progress
CenchMotion.countUp('#revenue', { to: 2400000, format: ',.0f', prefix: '$', tl })
CenchMotion.progressBar('.bar', { to: 73, tl })

// SVG (DrawSVG, MorphSVG — all free)
CenchMotion.drawPath('.line path', { tl })
CenchMotion.morphShape('#icon', { to: '#target', tl })

// Pre-made Lottie (from search_lottie)
CenchMotion.lottieSync('#lottie-wrap', { src: 'https://...json', tl, delay: 0.3 })
```

### CenchMotion.easing namespace

Named presets as GSAP-compatible strings:

```js
CenchMotion.easing.entrance.premium // 'power3.out'
CenchMotion.easing.entrance.energetic // 'back.out(2.0)'
CenchMotion.easing.exit.corporate // 'power2.in'
CenchMotion.easing.emphasis.playful // 'back.out(1.7)'
CenchMotion.easing.css.cenchEntrance // 'cubic-bezier(0.16, 1, 0.3, 1)'
```

### GSAP timeline pattern

```js
const tl = window.__tl
const state = { progress: 0 }
tl.to(
  state,
  {
    progress: 1,
    duration: DURATION,
    ease: 'none',
    onUpdate: function () {
      const p = state.progress
      // Drive animations from progress (0→1)
    },
  },
  0,
)
```

---

## Lottie Generation Best Practices

### When to generate vs search

| Approach             | Use when                                                   | Tool                                                          |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| **search_lottie**    | Characters, illustrations, complex icons                   | `search_lottie` → `CenchMotion.lottieSync` or `LottieFromURL` |
| **Generated Lottie** | Simple geometric shapes, abstract patterns, 2-3 layers max | `add_layer type:lottie`                                       |
| **CenchMotion**      | Text, counters, reveals, progress bars                     | Direct call, no Lottie needed                                 |

### Auto-validation pipeline

Generated Lottie JSON passes through:

1. **validateLottieJSON()** — checks structure, easing handles, frame ranges
2. **Auto-fix** — injects missing easing handles with corporate defaults
3. **scoreLottieQuality()** — 5-dimension score (visual, technical, emotional, performance, completeness)

The #1 crash cause (missing easing handles) is now auto-fixed before render.

---

## Scene Timing Structure

- 0-20%: background + first elements appear
- 20-60%: main content builds (staggered entrances)
- 60-80%: final elements, emphasis moments
- 80-100%: HOLD — everything visible, viewer absorbs

Final element should finish animating at ~80%. The last 20% is reading time.

---

## Rules

- NEVER use bounce or elastic easing — they feel dated
- NEVER use linear easing on position — it looks robotic
- NEVER use `Math.random()` — use frame-based deterministic values
- NEVER animate text character-by-character (use `CenchMotion.textReveal` or animate the whole element)
- Exit animations at 75% of entrance duration
- Stagger 50-100ms (2-3 frames at 30fps) between items, cap total under 800ms
- Vary animation directions — not everything should fade-in-from-below

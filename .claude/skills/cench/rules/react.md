# React Scene Rules (Default Renderer)

React is the **default renderer** for all scenes. Every scene is a React component
that can compose multiple rendering layers — HTML/CSS, Three.js, Canvas2D, D3, SVG, Lottie —
in a single unified component tree.

**Before generating any scene, also read `rules/visual-quality.md`** for typography,
color, spatial, and motion design guidance.

---

## Output format

Output a JSON object with two fields:

```json
{
  "sceneCode": "<JSX code — the full React component>",
  "styles": "<optional CSS string — no <style> tags>"
}
```

The JSX is transpiled in-browser via Babel. No imports needed — all APIs are available as globals.

---

## Available APIs (globals — do NOT import)

### Core hooks & components

| API                                                                    | Purpose                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `useCurrentFrame()`                                                    | Returns integer frame number (0, 1, 2, ...)                                                 |
| `useVideoConfig()`                                                     | Returns `{ fps, width, height, durationInFrames }`                                          |
| `interpolate(value, inputRange, outputRange, opts?)`                   | Map values between ranges                                                                   |
| `spring({ frame, fps, config?, from?, to? })`                          | Physics-based spring animation                                                              |
| `Easing.ease / .easeIn / .easeOut / .easeInOut / .bezier(x1,y1,x2,y2)` | Easing functions for interpolate                                                            |
| `<Sequence from={frame} durationInFrames={n}>`                         | Temporal composition — children see local frame starting at 0                               |
| `<AbsoluteFill style={{...}}>`                                         | Full-frame (WIDTH×HEIGHT) absolute layer, stacks via z-index                                |
| `useCenchSeek(cb)`                                                     | Fire `cb(timeSec)` on every seek/scrub — for animations that live outside the GSAP timeline |
| `useCenchTime()`                                                       | Current scene time in seconds, synced with playback + scrub                                 |

### Bridge components (for imperative renderers)

| Component                                                                                                       | Props                         | Use case                                      |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------- |
| `<Canvas2DLayer draw={(ctx, frame, config) => {}} />`                                                           | `width?`, `height?`, `style?` | Hand-drawn strokes, particles, procedural art |
| `<ThreeJSLayer setup={(THREE, scene, camera, renderer) => {}} update={(scene, camera, frame, config) => {}} />` | `style?`                      | 3D geometry, PBR materials, shadows           |
| `<D3Layer setup={(d3, el, config) => {}} update={(d3, el, frame, config) => {}} />`                             | `style?`                      | Data visualization, charts                    |
| `<SVGLayer setup={(svgEl, gsap, tl) => {}} viewBox?>`                                                           | `children?`, `style?`         | Vector draw-on animations                     |
| `<LottieLayer data={lottieJSON} />`                                                                             | `style?`                      | Micro-animations, icons                       |

### Scene globals (available on `window`)

`PALETTE`, `DURATION`, `FONT`, `BODY_FONT`, `STROKE_COLOR`, `WIDTH` (default 1920), `HEIGHT` (default 1080), `ROUGHNESS`, `SCENE_ID` — WIDTH/HEIGHT change based on the project's aspect ratio (e.g. 1080×1920 for 9:16, 1080×1080 for 1:1)

**Font pairing**: `FONT` is for headings/display text. `BODY_FONT` is for body text,
descriptions, and labels. When no font pairing is active, `BODY_FONT` equals `FONT`.
Use both for typographic contrast:

```jsx
<h1 style={{ fontFamily: FONT }}>Title</h1>
<p style={{ fontFamily: BODY_FONT }}>Body text here</p>
```

---

## Scene structure pattern

```jsx
function Scene() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Camera motion (runs once)
  React.useEffect(() => {
    CenchCamera.kenBurns({ duration: DURATION, endScale: 1.04 });
  }, []);

  return (
    <AbsoluteFill style={{ background: '#0a0c10' }}>
      {/* Layer 1: background (lowest z) */}
      <AbsoluteFill style={{ zIndex: 0 }}>
        <ThreeJSLayer setup={...} update={...} />
      </AbsoluteFill>

      {/* Layer 2: content (appears at frame 15) */}
      <Sequence from={15}>
        <AbsoluteFill style={{ zIndex: 1, padding: '6% 7%' }}>
          <Title frame={frame} />
          <FeatureList frame={frame} />
        </AbsoluteFill>
      </Sequence>

      {/* Layer 3: overlay effects (highest z) */}
      <AbsoluteFill style={{ zIndex: 2, pointerEvents: 'none' }}>
        <Canvas2DLayer draw={(ctx, f, cfg) => { /* particles */ }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Export the component — the template bootstrapper handles mounting
export default Scene;
```

**CRITICAL — two things the bootstrapper requires:**

1. **Do NOT mount the component yourself.** No `ReactDOM.createRoot()` or `.render()`.
   The template bootstrapper automatically wraps your exported component in `<CenchComposition>`
   and mounts it.
2. **You MUST end the file with `export default Scene;`** (or `export default Main;` etc.).
   The bootstrapper uses Babel's `transform-modules-commonjs` and reads
   `module.exports.default` to find the component. A scene without an export renders
   as a blank iframe with only a console error — no crash, no fallback.
   The template auto-injects `export default Scene;` if a `Scene` function is defined
   and no export is present, but don't rely on that — always write the export explicitly.

---

## Animation patterns

### Fade + slide entrance

```jsx
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
const y = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' })

;<div style={{ opacity, transform: `translateY(${y}px)` }}>Content</div>
```

### Staggered list

```jsx
{
  items.map((item, i) => {
    const enterFrame = 20 + i * 6
    const op = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    const x = interpolate(frame, [enterFrame, enterFrame + 18], [-40, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    return (
      <div key={i} style={{ opacity: op, transform: `translateX(${x}px)` }}>
        {item}
      </div>
    )
  })
}
```

### Spring entrance

```jsx
const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })

;<div style={{ transform: `scale(${scale})` }}>Content</div>
```

### Temporal composition with Sequence

```jsx
{
  /* Title appears immediately */
}
;<Sequence from={0} durationInFrames={durationInFrames}>
  <Title />
</Sequence>

{
  /* Chart fades in after 2 seconds */
}
;<Sequence from={fps * 2}>
  <ChartPanel />
</Sequence>

{
  /* CTA appears in last 3 seconds */
}
;<Sequence from={durationInFrames - fps * 3}>
  <CallToAction />
</Sequence>
```

---

## Camera motion (use on every scene)

Call CenchCamera from a `useEffect` in the root component. Camera moves register
on `window.__tl` automatically and are seekable.

```jsx
React.useEffect(() => {
  // Pick ONE per scene:
  CenchCamera.kenBurns({ duration: DURATION, endScale: 1.04 })
  // OR
  CenchCamera.presetCinematicPush({ at: 0, duration: DURATION * 0.6 })
  // OR
  CenchCamera.dollyIn({ targetSelector: '#hero-text', at: 1, duration: 3 })
}, [])
```

| Move                  | Effect                          | Best for                     |
| --------------------- | ------------------------------- | ---------------------------- |
| `kenBurns`            | Slow zoom, almost imperceptible | Default for any static scene |
| `presetCinematicPush` | Slow forward push               | Reveals, title cards         |
| `presetReveal`        | Zoom out from center            | Opening scenes               |
| `dollyIn`             | Zoom into specific element      | Emphasis moments             |
| `dollyOut`            | Pull back to reveal full scene  | After detail view            |
| `presetEmphasis`      | Zoom in, hold, zoom out         | Highlighting key content     |
| `pan`                 | Slide across scene              | Wide layouts, panoramas      |

**Every scene should have camera motion — but VARY it per scene purpose.**
Using `kenBurns` on every scene in a sequence reads as lazy and mechanical.
Pick the motion that matches what the scene is DOING:

- **Title / opening card** → `presetCinematicPush` (slow forward push feels intentional)
- **Static data / receipt / grid** → `kenBurns` with subtle endScale 1.02–1.03
- **Reveal / "here's what's available"** → `presetReveal` (zooms out to show everything)
- **Sign-off / closing card** → `presetEmphasis` (zoom-in hold)
- **Element the viewer should focus on** → `dollyIn` with `targetSelector`
- **Already-moving content (video playback, 3D spins)** → **skip CenchCamera entirely**;
  stacking camera motion on top of intrinsic motion causes visual nausea.

kenBurns is fine as a default — but if three scenes in a row all use it,
change one. Mechanical sameness is worse than a mildly wrong motion.

---

## When to use each layer type

### Pure JSX (no bridge) — THE DEFAULT

Use for: typography, layouts, cards, step lists, feature grids, callouts, quotes,
diagrams-as-HTML, anything that's fundamentally text + boxes.

This is what you should use 80% of the time. React + CSS + interpolate/spring
handles most explainer video content natively.

### ThreeJSLayer — 3D content

Use for: rotating objects, product visualization, spatial concepts, particle fields,
anything that needs real 3D with lighting and materials.

```jsx
<ThreeJSLayer
  setup={(THREE, scene, camera, renderer) => {
    // Called once — create geometry, materials, lights
    renderer.shadowMap.enabled = true
    camera.position.set(0, 4, 10)
    // Add meshes, lights, environment...
  }}
  update={(scene, camera, frame, config) => {
    // Called every frame — animate
    const t = frame / config.fps
    mesh.rotation.y = t * 0.5
  }}
/>
```

### Canvas2DLayer — hand-drawn / procedural

Use for: particles, hand-drawn strokes, procedural textures, organic effects,
chalk/marker aesthetics, noise overlays.

```jsx
<Canvas2DLayer
  draw={(ctx, frame, config) => {
    const t = frame / config.fps
    // Draw particles, strokes, etc.
  }}
/>
```

### D3Layer — data visualization

Use for: bar charts, line charts, scatter plots, custom data visualizations.
For standard charts, consider using the `generate_chart` MCP tool instead.

```jsx
<D3Layer
  setup={(d3, el, config) => {
    // Called once — create axes, scales, initial elements
    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 800 400').attr('width', '100%').attr('height', '100%')
    // ...
  }}
  update={(d3, el, frame, config) => {
    // Called every frame — animate data transitions
  }}
/>
```

### SVGLayer — vector draw-on

Use for: self-drawing paths, calligraphic strokes, technical diagrams with stroke animations.

### LottieLayer — micro-animations

Use for: animated icons, looping decorative elements, pre-made Lottie animations.

lottie-web is loaded globally in all React scenes. Two approaches:

**Inline JSON** (for simple generated Lotties):

```jsx
var data = { v: '5.7.1', fr: 30, ip: 0, op: 90, w: 400, h: 400, ... };
<LottieLayer data={data} style={{ width: 200, height: 200 }} />
```

**URL loading** (for searched pre-made Lotties from `search_lottie`):
Define a `LottieFromURL` helper that calls `window.lottie.loadAnimation({ path: url })`
and syncs frames via `goToAndStop(lottieFrame, true)` in a `useEffect`. See `rules/motion.md`
for the full implementation pattern.

**Canvas renderer** (for performance-sensitive complex Lotties):

```jsx
<LottieLayer data={data} renderer="canvas" />
```

**When to use Lottie vs CenchMotion in React scenes:**

- `LottieLayer`: Pre-made icons/illustrations from `search_lottie`, simple geometric animations
- `interpolate()` + `spring()`: Text reveals, fades, slides, scales — most scene animation
- No Lottie needed: counters, progress bars, staggered lists, element reveals

---

## Combining layers — the power of React

The whole point of React scenes is combining layers. A typical explainer might use:

1. **Background**: `<Canvas2DLayer>` with subtle particle drift OR `<ThreeJSLayer>` with slow 3D orbit
2. **Content**: Pure JSX — title, bullet points, diagrams as HTML
3. **Data**: `<D3Layer>` for an inset chart
4. **Accents**: `<Canvas2DLayer>` for floating particles or grain texture

Stack them with `<AbsoluteFill>` + `zIndex`. Time them with `<Sequence>`.

---

## Spring config presets

Instead of specifying `{ damping, mass, stiffness }` manually, use presets:

```jsx
spring({ frame, fps, config: spring.config.gentle }) // soft, slow settle
spring({ frame, fps, config: spring.config.stiff }) // fast, precise
spring({ frame, fps, config: spring.config.wobbly }) // bouncy feel
spring({ frame, fps, config: spring.config.snappy }) // quick pop
spring({ frame, fps, config: spring.config.molasses }) // slow, heavy
spring({ frame, fps, config: spring.config.default }) // balanced
```

---

## Interactive Scenes — Hooks for Viewer Input

React scenes can respond to viewer input via three hooks. These are for **viewer-driven state** (clicks, sliders, toggles) — animation state should still be frame-based via `useCurrentFrame()`.

### useVariable(name, defaultValue) — reactive state

Synced with the parent player via postMessage. Persists across the session.

```jsx
function Scene() {
  const frame = useCurrentFrame()
  const [interestRate, setRate] = useVariable('interestRate', 5)

  // Rate drives visual output — changes instantly when viewer adjusts slider
  const monthlyPayment = (200000 * (interestRate / 100 / 12)) / (1 - Math.pow(1 + interestRate / 100 / 12, -360))

  return (
    <AbsoluteFill style={{ background: PALETTE[0], fontFamily: FONT }}>
      <div style={{ fontSize: 120, fontWeight: 700, color: PALETTE[3] }}>${Math.round(monthlyPayment)}/mo</div>
      <div style={{ fontSize: 36, color: PALETTE[1] }}>at {interestRate}% interest</div>
    </AbsoluteFill>
  )
}
export default Scene
```

Use `define_scene_variable` MCP tool to declare the variable, then `add_interaction` with type `slider` to let the viewer control it.

### useInteraction(elementId) — click/hover handlers

Returns handler props + hover/click state for visual feedback.

```jsx
function Scene() {
  const frame = useCurrentFrame()
  const card1 = useInteraction('card-pricing')
  const card2 = useInteraction('card-enterprise')

  return (
    <AbsoluteFill style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'center' }}>
      <div
        {...card1.handlers}
        style={{
          padding: 40,
          borderRadius: 16,
          background: PALETTE[1],
          transform: `scale(${card1.isHovered ? 1.05 : 1})`,
          boxShadow: card1.isHovered ? '0 20px 60px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
          transition: 'all 200ms ease',
        }}
      >
        Starter — $29/mo
      </div>
      <div
        {...card2.handlers}
        style={{
          padding: 40,
          borderRadius: 16,
          background: PALETTE[2],
          transform: `scale(${card2.isHovered ? 1.05 : 1})`,
          transition: 'all 200ms ease',
        }}
      >
        Enterprise — Custom
      </div>
    </AbsoluteFill>
  )
}
export default Scene
```

### useTrigger(name) — fire events to parent

For one-shot events (completed a step, reached a milestone) that cross the iframe boundary.

```jsx
const milestone = useTrigger('completed-intro')
// Call milestone.fire({ section: 'intro' }) when the viewer finishes
```

### When to use in-scene hooks vs overlay interactions

| Scenario                              | Use                                     |
| ------------------------------------- | --------------------------------------- |
| Hoverable cards, charts, 3D objects   | `useInteraction` in scene code          |
| Slider that changes scene visuals     | `useVariable` in scene + slider overlay |
| Standard quiz, choice, gate           | Overlay via `add_interaction`           |
| Toggle that shows/hides a scene layer | `useVariable` + toggle overlay          |

**Combine both**: A scene with hoverable D3 bars (`useInteraction`) + an overlay quiz (`add_interaction`).

---

## Performance & Limits

- **Max 1-2 ThreeJSLayers per scene.** Each creates a WebGL context. Browsers allow 8-16 total. If you need multiple 3D objects, compose them in ONE ThreeJSLayer setup function.
- **D3Layer stability.** D3 manipulates the DOM directly. Wrap D3Layer in `React.memo` or give it a stable `key` to prevent React from unmounting it unexpectedly.
- **Memoize expensive components.** Every frame triggers a React re-render of the full tree. Use `React.memo()` on components that don't need `useCurrentFrame()`.
- **Canvas2DLayer:** Fine for up to ~500 objects per frame. For 1000+, consider simplifying or batching draw calls.

---

## Canvas bounds — WIDTH×HEIGHT (dynamic)

The scene renders inside a WIDTH×HEIGHT container (defaults to 1920×1080 for 16:9) with `overflow: hidden`. Dimensions change based on the project's aspect ratio (e.g. 1080×1920 for 9:16, 1080×1080 for 1:1, 1080×1350 for 4:5). Any content positioned outside this area is clipped and invisible. All layout must fit within these bounds:

- Use `<AbsoluteFill>` which fills the WIDTH×HEIGHT root — do not exceed it
- When using absolute positioning, keep coordinates within 0–WIDTH (x) and 0–HEIGHT (y)
- If content is too tall (e.g. long lists), reduce items, use smaller fonts, multi-column layouts, or split across scenes
- Keep important content within a 100px inset from edges (100 to WIDTH-100 x, 100 to HEIGHT-100 y)
- **Before finalizing**: verify that every element's position + size stays within the WIDTH×HEIGHT box

---

## What NOT to do

- Do NOT use `requestAnimationFrame` — frame updates come from `useCurrentFrame()`
- Do NOT use `useState` for animation state — derive everything from `frame`
- Do NOT use `setTimeout`, `setInterval`
- Do NOT use `Math.random()` — use frame-based deterministic values
- Do NOT import React/ReactDOM — they're already loaded as globals
- Do NOT add `<script>` tags in the JSX — all code goes in the component
- Do NOT mount manually — just `export default Scene;` (bootstrapper handles mounting)
- Do NOT use bounce/elastic easing — use `Easing.bezier(0.16, 1, 0.3, 1)` for entrances
- Do NOT use 2+ ThreeJSLayers in one scene — compose 3D into one layer

---

## Output format reminder

Output raw JSON only. No markdown fences. No explanation:

```json
{
  "sceneCode": "function Scene() { ... }\nexport default Scene;",
  "styles": ".custom-class { ... }"
}
```

The `styles` field is injected into a `<style>` block in `<head>`. Use it for
`@keyframes`, complex selectors, or CSS that's cleaner outside inline styles.
Most scenes don't need it — inline styles via `style={{}}` are preferred.

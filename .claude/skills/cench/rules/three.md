# Three.js Scene Rules (r183)

## Viewer-first mindset

The viewer is your audience — frame shots for them, not for showcasing 3D capability.

- Use 3D to **illustrate concepts** (laptop = technology, person = user, building = enterprise)
- **Text in HTML overlays, NOT 3D space**: Use React scenes (`type: 'react'`) with `<ThreeJSLayer>` for 3D background + JSX `<AbsoluteFill>` for titles/text on top. HTML text stays fixed on screen regardless of 3D camera movement — always readable.
- Only use troika 3D text for decorative effects where readability isn't critical
- Load **real models** from `/models/library/` for concrete objects
- Camera should be **intentional**: reveal shots, slow dolly, static hero angles
- Don't orbit randomly — orbit only to show all sides of a product
- For info-heavy scenes, keep camera static or very slow

### React + ThreeJSLayer — the default for all 3D videos

Use `type: 'react'`. 3D is the background via `<ThreeJSLayer>`. Text/info is HTML via JSX.
Call `buildStudio(THREE, scene, camera, renderer, 'corporate')` in the setup callback
to get the full studio environment (sky sphere, grid, floor, lighting, env map).

#### Explainer / Educational Template

```jsx
function Scene() {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  React.useEffect(() => {
    CenchCamera.kenBurns({ duration: DURATION, endScale: 1.03 })
  }, [])

  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
  const titleY = interpolate(frame, [0, 20], [40, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  })
  const subOp = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ zIndex: 0 }}>
        <ThreeJSLayer
          setup={(THREE, scene, camera, renderer) => {
            buildStudio(THREE, scene, camera, renderer, 'corporate')
            camera.position.set(0, 3, 10)
            camera.lookAt(0, 0, 0)
            // Add 3D content: models, geometry
          }}
          update={(scene, camera, frame, config) => {
            const t = frame / config.fps
            // Animate 3D objects using t
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ zIndex: 1, padding: '6% 7%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      >
        <div style={{ opacity: titleOp, transform: 'translateY(' + titleY + 'px)' }}>
          <h1 style={{ fontSize: 72, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Title Here</h1>
        </div>
        <div style={{ opacity: subOp, marginTop: 12 }}>
          <p style={{ fontSize: 28, color: '#4a4a5a', margin: 0 }}>Subtitle or description text</p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
export default Scene
```

#### Product Showcase Template

3D model rotating in background, feature info as HTML cards.

```jsx
// setup: buildStudio(THREE, scene, camera, renderer, 'showcase');
//        Load model with GLTFLoader, place on floor
// update: model.rotation.y = t * 0.2
// JSX overlay: product name, feature bullets animating in with stagger
```

#### Data / Business Template

3D objects as visual metaphor in background, metrics as large HTML numbers.

```jsx
// setup: buildStudio(THREE, scene, camera, renderer, 'corporate');
//        Add 3D bar chart or relevant geometry
// update: animate bars rising
// JSX overlay: big stat number (fontSize: 120), label, comparison text
```

#### Cinematic Template

Full 3D with minimal or no text. Camera path, dramatic lighting.

```jsx
// setup: buildStudio(THREE, scene, camera, renderer, 'cinematic');
//        Load models, add particles
// update: camera follows CatmullRomCurve3 path, animate objects
// JSX overlay: minimal — just a small title or none
```

## Template helpers

**`buildStudio(THREE, scene, camera, renderer, style?, opts?)`** — for use inside `<ThreeJSLayer setup={...}>`
Sets up: sky gradient sphere (128 segments), infinite grid, floor, 3-point lighting, env map.
Returns: `{ floorY }` — use `floorY` to position objects on the floor.

**Styles** (default: `'white'`):

- `'white'` — default. Clean white studio with circle-fade floor (ShaderMaterial, pure white). Like a photo studio.
- `'corporate'` — same as white but with infinite floor + fog blend
- `'playful'` — warm tones, soft overhead light, isometric feel
- `'cinematic'` — dark studio, dramatic lighting
- `'showcase'` — dark product display, subtle grid
- `'tech'` — dark void with neon palette lights
- `'sky'` — outdoor atmospheric sky (THREE.Sky shader), no colored floor, just grid + shadow catcher

**Floor modes** (via `opts.floorMode`):

- White style defaults to `'circle'` (ShaderMaterial — renders pure white, unaffected by lighting)
- Other styles default to `'infinite'` (MeshStandardMaterial + FogExp2 blend)
- `'circle'` — circular floor with radial shader fadeout
- `'none'` — no floor, just sky sphere + grid + shadow catcher

**Options:**

- `opts.floorMode` — `'infinite'` | `'circle'` | `'none'`
- `opts.floorColor` — hex string to override floor color
- `opts.floorRadius` — radius for circle mode (default: 80)

```jsx
<ThreeJSLayer
  setup={(THREE, scene, camera, renderer) => {
    // Default white studio (circle fade floor, pure white)
    const { floorY } = buildStudio(THREE, scene, camera, renderer)

    // Outdoor sky
    // buildStudio(THREE, scene, camera, renderer, 'sky');

    // Dark showcase
    // buildStudio(THREE, scene, camera, renderer, 'showcase');

    // Custom floor color
    // buildStudio(THREE, scene, camera, renderer, 'white', { floorColor: '#e0d8c8' });
  }}
/>
```

**`createStudioScene(style)`** — for standalone `type: 'three'` scenes only.
Returns `{ scene, camera, renderer, floor, render }`. NOT available inside ThreeJSLayer.

```js
const { scene, camera, renderer, render } = createStudioScene('corporate')
// Just add your objects and animate:
scene.add(myMesh)
const state = { progress: 0 }
window.__tl.to(
  state,
  {
    progress: 1,
    duration: DURATION,
    ease: 'none',
    onUpdate: function () {
      const t = state.progress * DURATION
      /* animate */ render()
    },
  },
  0,
)
render()
```

**`createPostProcessing(renderer, scene, camera, opts)`** — safe synchronous post-processing

```js
const pp = createPostProcessing(renderer, scene, camera, { bloom: 0.3 })
// In animation loop: pp.render() instead of renderer.render(scene, camera)
// No .then() needed — it's synchronous
```

Falls back to direct render if post-processing fails. No need to import EffectComposer yourself.

## Import pattern — ES modules via importmap

Scene code runs in its own `<script type="module">`. You MUST import
THREE yourself and read globals from `window`:

```js
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
const { WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment } = window
```

Never use `require()`, never use old UMD script tags.
All imports MUST be at the top of the scene code (ES module rule).

## Required boilerplate (always start with this)

```js
import * as THREE from 'three'
const { WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment } = window

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(WIDTH, HEIGHT)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, 1000)
camera.position.set(0, 4, 10)
camera.lookAt(0, 0, 0)
window.__threeCamera = camera // Required for CenchCamera 3D moves
```

## 3-point lighting (always include — never just AmbientLight)

```js
const ambient = new THREE.AmbientLight(0xffffff, 0.3)
const key = new THREE.DirectionalLight(0xffffff, 1.2)
key.position.set(-5, 8, 5)
key.castShadow = true
key.shadow.mapSize.width = 2048
key.shadow.mapSize.height = 2048
const fill = new THREE.DirectionalLight(0xfff4e0, 0.4)
fill.position.set(5, 2, 3)
const rim = new THREE.DirectionalLight(0xd0e8ff, 0.6)
rim.position.set(0, 3, -8)
scene.add(ambient, key, fill, rim)
```

NEVER use only AmbientLight — scenes look flat and washed out.

## Environment map (always call for professional lighting)

```js
setupEnvironment(scene, renderer)
```

Creates a procedural studio environment map with gradient sky and soft light panels.
Makes all PBR materials look dramatically better with realistic reflections.
Call this right after creating your scene and renderer.
Skip only if you're building a custom skybox **or** you use the **Cench stage environment** below (it already defines backdrop, lights, and ground). You may still call `setupEnvironment` after `applyCenchThreeEnvironment('track_rolling_topdown', …)` for extra reflections on hero meshes.

## Cench stage environment (agent builds _inside_ it)

The HTML template injects **`applyCenchThreeEnvironment(envId, scene, renderer, camera)`** and **`updateCenchThreeEnvironment(t)`** on `window`. The only supported id is **`track_rolling_topdown`**: white table, **four lane dividers**, **top-down** camera, patterned marbles rolling **alternate directions** per lane. Older saved scenes may still reference removed ids; the runtime maps them to `track_rolling_topdown` with a console warning.

**Required usage pattern**

```js
const { applyCenchThreeEnvironment, updateCenchThreeEnvironment } = window
// After scene, renderer, camera exist:
applyCenchThreeEnvironment('track_rolling_topdown', scene, renderer, camera)

// Use GSAP timeline — NOT requestAnimationFrame
const state = { progress: 0 }
window.__tl.to(
  state,
  {
    progress: 1,
    duration: DURATION,
    ease: 'none',
    onUpdate: function () {
      const t = state.progress * DURATION
      updateCenchThreeEnvironment(t)
      // … your hero mesh updates …
      renderer.render(scene, camera)
    },
  },
  0,
)
renderer.render(scene, camera)
```

The stage attaches under a group named **`__cenchEnvRoot`**. Do not remove it. The id is listed on `window.CENCH_THREE_ENV_IDS`.

### 3D data scatter (Cortico-style, vanilla Three)

The template also injects **`createCenchDataScatterplot(scene, { points, orbitSpeed?, pointRadius? })`** and **`updateCenchDataScatterplot(t)`**. Visual language is inspired by the MIT-licensed [CorticoAI/3d-react-demo](https://github.com/CorticoAI/3d-react-demo) (React + R3F); Cench runs **plain Three.js** only. Prefer the agent tool **`three_data_scatter_scene`** with `studioEnvironmentId: 'track_rolling_topdown'` + `points: [{x,y,z}]` so the scene is built deterministically without hand-writing the module.

## Materials — use MATERIALS presets (available in scene template)

```js
MATERIALS.plastic(PALETTE[0]) // matte colored plastic
MATERIALS.metal(PALETTE[1]) // shiny metal
MATERIALS.glass(PALETTE[2]) // transparent glass
MATERIALS.matte(PALETTE[0]) // completely matte
MATERIALS.glow(PALETTE[3]) // emissive, glowing
MATERIALS.clearcoat(PALETTE[0]) // car paint / lacquer finish (clearcoat layer)
MATERIALS.iridescent(PALETTE[1]) // oil-slick / holographic shimmer
MATERIALS.velvet(PALETTE[2]) // soft fabric / velvet sheen
MATERIALS.lowpoly(PALETTE[0]) // flat-shaded, friendly explainer aesthetic
```

Or custom MeshPhysicalMaterial for maximum control:

```js
new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(PALETTE[0]),
  roughness: 0.3,
  metalness: 0.5,
  clearcoat: 1.0, // glossy top layer
  clearcoatRoughness: 0.1,
  iridescence: 0.5, // rainbow shift at angles
  sheen: 0.8, // fabric-like soft highlight
  sheenRoughness: 0.4,
  sheenColor: new THREE.Color(PALETTE[1]),
  transmission: 0.9, // glass-like transparency
  thickness: 0.5, // refraction depth (with transmission)
  ior: 1.5, // index of refraction
})
```

NEVER use MeshBasicMaterial — looks flat and fake.
NEVER hardcode hex colors — always use PALETTE array.
`THREE.Color` accepts hex strings: `new THREE.Color('#e84545')`

## Animation loop — MUST use window.\_\_tl (GSAP)

The playback controller drives all animation through the GSAP master timeline.
**Do NOT use your own `requestAnimationFrame` loop** — RAF is blocked/unblocked
by the playback controller and will not work reliably in Three.js modules.

Use the GSAP `onUpdate` callback pattern instead:

```js
const state = { progress: 0 }
window.__tl.to(
  state,
  {
    progress: 1,
    duration: DURATION,
    ease: 'none',
    onUpdate: function () {
      const t = state.progress * DURATION // seconds 0 → DURATION

      // All animation driven by t
      mesh.rotation.y = t * 0.5

      renderer.render(scene, camera)
    },
  },
  0,
)

// Initial render so scene is visible while paused
renderer.render(scene, camera)
```

ALWAYS call `renderer.render(scene, camera)` once AFTER creating the scene
(before GSAP plays). This ensures the scene is visible while paused.

NEVER use `requestAnimationFrame` for your animation loop.
NEVER use `Date.now()` or `performance.now()` for timing.
NEVER use `Math.random()` — use `mulberry32(seed)` from the template.

## Camera animation patterns

```js
// Slow orbit
camera.position.x = Math.cos(t * 0.3) * 10
camera.position.z = Math.sin(t * 0.3) * 10
camera.lookAt(0, 0, 0)

// Isometric (fixed)
camera.position.set(10, 10, 10)
camera.lookAt(0, 0, 0)

// Top-down
camera.position.set(0, 15, 0)
camera.lookAt(0, 0, 0)

// Dolly in (move toward subject)
const startZ = 15,
  endZ = 5
const ease = 1 - Math.pow(1 - Math.min(t / (DURATION * 0.7), 1), 3)
camera.position.z = startZ + (endZ - startZ) * ease
camera.lookAt(0, 0, 0)

// Crane up (vertical rise while tracking)
camera.position.y = 2 + t * 0.8
camera.lookAt(0, 0, 0)

// CatmullRomCurve3 path (smooth multi-point camera path)
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-8, 3, 8),
  new THREE.Vector3(0, 5, 6),
  new THREE.Vector3(8, 3, 4),
  new THREE.Vector3(4, 2, -6),
])
const progress = Math.min(t / DURATION, 1)
camera.position.copy(curve.getPointAt(progress))
camera.lookAt(0, 0, 0)

// Zoom (change FOV — creates vertigo/dolly-zoom effect)
camera.fov = 60 - t * 3
camera.updateProjectionMatrix()
```

Camera motion should be slow and intentional (0.1–0.3 rad/s orbital). Frantic
spinning looks amateur. Combine camera moves with post-processing DOF for
cinematic rack-focus effects.

## Post-processing pipeline

All passes are available via `three/addons/postprocessing/`. When using
EffectComposer, replace `renderer.render(scene, camera)` with `composer.render()`.

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

// Bloom — glow on emissive materials (strength, radius, threshold)
composer.addPass(new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.3, 0.4, 0.85))

// Depth of Field — cinematic focus (focus distance, aperture, maxblur)
composer.addPass(new BokehPass(scene, camera, { focus: 10, aperture: 0.002, maxblur: 0.01 }))

// SSAO — ambient occlusion for depth in crevices
// const ssao = new SSAOPass(scene, camera, WIDTH, HEIGHT)
// ssao.kernelRadius = 8; ssao.minDistance = 0.005; ssao.maxDistance = 0.1
// composer.addPass(ssao)

// Anti-aliasing (better than default)
// composer.addPass(new SMAAPass(WIDTH, HEIGHT))

// OutputPass should always be LAST — handles tone mapping + color space
composer.addPass(new OutputPass())

// In GSAP onUpdate: composer.render() instead of renderer.render(scene, camera)
```

**Performance note:** Each pass adds render cost. For most scenes, use
RenderPass + one effect (bloom OR DOF) + OutputPass. Stack all three
only for hero/cinematic scenes. SSAO is expensive — use sparingly.

## CapsuleGeometry

**CapsuleGeometry(radius, length, capSegments, radialSegments)**
Pill/capsule shape, use instead of "double sphere + cylinder" workaround.

## OrbitControls

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

Enables mouse rotation in browser preview. Does nothing in WVC export
(no mouse events in headless Chrome). Use camera orbit code for auto-rotation.

## All geometries available (r183)

SphereGeometry, BoxGeometry, CylinderGeometry, ConeGeometry,
CapsuleGeometry, TorusGeometry, TorusKnotGeometry, PlaneGeometry,
RingGeometry, TubeGeometry, IcosahedronGeometry, OctahedronGeometry,
DodecahedronGeometry, TetrahedronGeometry, LatheGeometry,
ExtrudeGeometry, ShapeGeometry, EdgesGeometry, WireframeGeometry

## Shadows (all 4 required or shadows won't appear)

```
renderer.shadowMap.enabled = true   ← in boilerplate above
light.castShadow = true             ← on the DirectionalLight
mesh.castShadow = true              ← on objects casting shadows
floor.receiveShadow = true          ← on the surface
```

## Scale guide

- Objects: 0.5–3 units radius
- Camera distance: 8–15 units from origin
- Floor: y = –2 to –4

## When to use Three.js vs Zdog

Use Zdog for: flat illustrative pseudo-3D (molecules, gears, org charts,
globes). Simpler code, better aesthetic for whiteboard explainers.

Use Three.js for: realistic materials, particles, shader effects,
environmental scenes, anything needing real lighting and shadow.

## 3D Model Library

A curated library of CC0 GLB models is available at `/models/library/`.
Use `search_3d_models` tool to find models by keyword, then `get_3d_model_url`
to get the URL and loading snippet.

Categories: tech, business, abstract, people, transport, environment, data

Example models: laptop, server-rack, rocket, person-standing, globe, gear,
lock, key, shield, trophy, light-bulb, target, building-office

Loading pattern:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
loader.load('/models/library/tech/laptop.glb', (gltf) => {
  const model = gltf.scene
  model.scale.setScalar(1.0)
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  scene.add(model)
})
```

Prefer real models over procedural geometry when the scene calls for
recognizable objects (laptops, people, buildings, vehicles, etc.).

## WVC export determinism

`mulberry32(seed)` is defined in the scene template — use it.
Fixed seeds per element: seed=1, seed=2, seed=3...
Same seed = identical frames on every WVC render.

## Component Library

Before writing Three.js from scratch, check if pre-built components exist in
`lib/three-components/index.ts`. Use `assembleThreeScene()` to compose them.

Available components:

**Lighting** — always pick one:

- `lighting-studio` — 3-point key/fill/rim with soft shadows and warm tint (best all-purpose)
- `lighting-dramatic` — single SpotLight, deep shadows, cinematic contrast
- `lighting-soft-overhead` — even overhead, minimal shadow, good for diagrams
- `lighting-neon` — dark scene with pulsing palette-colored point lights
- `lighting-cinematic` — RectAreaLight key + warm fill + cool rim, soft box look
- `lighting-sunset` — warm directional with long shadows, orange/purple tints

**Camera** — always pick one:

- `camera-orbit-slow` — gentle orbit around origin
- `camera-pullback` — starts close, pulls back to reveal (great for openers)
- `camera-top-down` — fixed overhead looking straight down
- `camera-isometric` — fixed 45-degree isometric angle
- `camera-dolly-in` — starts far, moves in close to subject
- `camera-crane-up` — rises vertically while looking at origin
- `camera-path` — follows smooth CatmullRomCurve3 through scene

**Objects** — pick one or more:

- `object-floating-sphere` — sphere with gentle float and slow rotation
- `object-dna-helix` — rotating double helix from spheres and tubes
- `object-bar-chart-3d` — bars rising from a floor (built-in data array)
- `object-atom` — nucleus with orbiting electron rings
- `object-gear-pair` — two interlocking gears counter-rotating
- `object-building-blocks` — cubes flying in and assembling into a structure
- `object-trophy-pedestal` — pedestal with spotlight for showcasing objects
- `object-floating-cards` — multiple cards floating and rotating (info displays)
- `object-helix-particles` — particles arranged in DNA-like helix pattern
- `object-morphing-sphere` — sphere with vertex displacement animation
- `object-text-title` — troika 3D text with title/subtitle pair, gentle float
- `object-wireframe-box` — transparent box with glowing edges, tech aesthetic

**Environment** — optional, pick at most one:

- `env-grid-floor` — grid plane below objects (tech/blueprint aesthetic)
- `env-particles-bg` — slowly drifting background particles
- `env-gradient-bg` — gradient sky sphere from palette[0] to palette[1]
- `env-studio-backdrop` — curved cyclorama studio backdrop with floor
- `env-fog-atmosphere` — exponential fog for depth and atmosphere
- `env-hdri-room` — RoomEnvironment from Three.js addons (no external file)

### Usage example

```ts
import { assembleThreeScene } from '@/lib/three-components'

const code = assembleThreeScene({
  lighting: 'lighting-studio',
  camera: 'camera-orbit-slow',
  objects: ['object-atom'],
  environment: 'env-grid-floor',
  palette: PALETTE,
  duration: DURATION,
  layerId: 'three-layer',
  postProcessing: true, // adds bloom + output pass automatically
})
```

The returned string is ready for injection as scene code into `generateThreeHTML`.

`postProcessing` accepts `true` (default bloom) or `{ bloom: 0.5, dof: true, focusDistance: 12 }`.

## 3D Style Guide — pick one to match the content

| Style                 | Lighting                 | Materials                      | Camera                                   | Post-proc    | Environment                               | Use for                    |
| --------------------- | ------------------------ | ------------------------------ | ---------------------------------------- | ------------ | ----------------------------------------- | -------------------------- |
| **Corporate Clean**   | `lighting-studio`        | matte + clearcoat              | `camera-orbit-slow` or `camera-dolly-in` | subtle DOF   | `env-studio-backdrop` or `env-grid-floor` | SaaS, enterprise, product  |
| **Cinematic Dark**    | `lighting-dramatic`      | metal + iridescent             | `camera-crane-up` or `camera-path`       | bloom + DOF  | `env-fog-atmosphere` + particles          | Film, premium, reveals     |
| **Playful Isometric** | `lighting-soft-overhead` | plastic + velvet               | `camera-isometric`                       | none         | `env-gradient-bg`                         | Education, kids, tutorials |
| **Tech Wireframe**    | `lighting-neon`          | glass + glow + wireframe edges | `camera-orbit-slow`                      | bloom        | `env-grid-floor` + stars                  | Cyberpunk, data, AI        |
| **Product Showcase**  | `lighting-cinematic`     | clearcoat + glass              | `camera-dolly-in` + orbit                | shallow DOF  | `env-studio-backdrop`                     | Product demos, launches    |
| **Nature/Organic**    | `lighting-sunset`        | velvet + matte (earth)         | `camera-path`                            | subtle bloom | `env-fog-atmosphere`                      | Wellness, environment      |

Don't default to the same style. Match the 3D aesthetic to the video's audience and purpose.

## Scene Composition Templates

Common video scene types with recommended component combos:

**Title Card 3D:**
lighting-studio + camera-dolly-in + object-text-title + env-studio-backdrop + postProcessing: { bloom: 0.3 }

**Product Showcase:**
lighting-cinematic + camera-orbit-slow + object-trophy-pedestal + env-studio-backdrop + postProcessing: { bloom: 0.2 }
Load GLTF model on top of pedestal via customCode.

**Data Visualization:**
lighting-soft-overhead + camera-isometric + object-bar-chart-3d + env-grid-floor

**Concept Explainer:**
lighting-studio + camera-orbit-slow + multiple objects arranged spatially + troika text labels via customCode

**Abstract/Cinematic:**
lighting-neon + camera-path + object-morphing-sphere + env-fog-atmosphere + postProcessing: true

**Tech Architecture:**
lighting-neon + camera-orbit-slow + object-wireframe-box (multiple) + env-grid-floor + postProcessing: { bloom: 0.5 }
Connect boxes with LineSegments via customCode.

## HTML template

The template is generated by `generateThreeHTML()` in `lib/sceneTemplate.ts`.
Your scene code runs inside a `<script type="module">` block with THREE already imported.

Pre-defined variables available in your scene code:

- `THREE` — the Three.js namespace (r183, ES module)
- `WIDTH` (1920), `HEIGHT` (1080) — canvas dimensions
- `PALETTE` — array of 4 hex color strings from the style preset
- `DURATION` — scene duration in seconds
- `MATERIALS` — preset material factories: `.plastic(c)`, `.metal(c)`, `.glass(c)`, `.matte(c)`, `.glow(c)`, `.clearcoat(c)`, `.iridescent(c)`, `.velvet(c)`, `.lowpoly(c)`
- `mulberry32(seed)` — seeded PRNG function
- `SCENE_ID` — unique scene identifier

You can import additional Three.js addons:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
```

### SVG-to-3D Extrusion

To extrude an uploaded SVG (logo, icon) into 3D geometry:

**Important:** SVGLoader cannot resolve gradient fills (`url(#...)`). Always use
`PALETTE` colors explicitly instead of `path.color`. Use a pivot/inner group
pattern for correct centering with the Y-flip.

```js
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

const pivot = new THREE.Group()
scene.add(pivot)

const svgText = await fetch(svgUrl).then((r) => r.text())
const data = new SVGLoader().parse(svgText)
const inner = new THREE.Group()
let i = 0
for (const path of data.paths) {
  const shapes = SVGLoader.createShapes(path)
  for (const shape of shapes) {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 20,
      bevelEnabled: true,
      bevelThickness: 2,
      bevelSize: 1.5,
      bevelSegments: 8,
      curveSegments: 24,
    })
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE[i % PALETTE.length],
      metalness: 0.6,
      roughness: 0.25,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    inner.add(mesh)
    i++
  }
}
// Center inner at origin, scale+flip via pivot
const box = new THREE.Box3().setFromObject(inner)
const center = box.getCenter(new THREE.Vector3())
const size = box.getSize(new THREE.Vector3())
inner.position.set(-center.x, -center.y, -center.z)
const maxDim = Math.max(size.x, size.y, size.z)
const s = 4 / maxDim
pivot.scale.set(s, -s, s) // flip Y for SVG coordinate system
pivot.add(inner)
```

The agent also has an `extrude_svg_to_3d` tool that does this automatically given an asset ID.

The playback controller drives animation via the GSAP master timeline (`window.__tl`).
Use `window.__tl.to()` with `onUpdate` for all animation — never `requestAnimationFrame`.

## drei-vanilla helpers (@pmndrs/vanilla)

Production-quality visual effects available via importmap:

```js
import { Sparkles, Grid, Stars } from '@pmndrs/vanilla'
```

### Sparkles — shader-based particle sparkles

```js
const sparkles = new Sparkles(scene, {
  count: 50,
  size: 2,
  color: new THREE.Color(PALETTE[1]),
  speed: 0.3,
  scale: [10, 5, 10], // spread area
})
// In animation loop: sparkles.update(t);
```

### Grid — shader-based infinite ground grid

```js
const grid = new Grid(scene, {
  cellSize: 1,
  sectionSize: 5,
  sectionColor: new THREE.Color(PALETTE[0]),
  cellColor: new THREE.Color(0x444444),
  fadeDistance: 30,
  infiniteGrid: true,
})
```

### Stars — starfield background

```js
const stars = new Stars(scene, {
  count: 1000,
  radius: 50,
  depth: 50,
  factor: 4,
})
```

Use these instead of manually coding particle systems or grid planes.

## 3D Text — troika-three-text (SDF text rendering)

High-quality text in 3D scenes. Uses SDF (Signed Distance Field) rendering —
crisp at any size, supports any .woff2/.ttf font URL. Available via importmap.

```js
import { Text } from 'troika-three-text'

const text = new Text()
text.text = 'Hello World'
text.fontSize = 0.8
text.color = PALETTE[0]
text.anchorX = 'center'
text.anchorY = 'middle'
text.position.set(0, 2, 0)
// Load any Google Font woff2 URL:
text.font = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2'
text.sync() // triggers async font load + SDF generation
scene.add(text)
```

### Key properties

- `text.maxWidth = 8` — enables word wrapping
- `text.textAlign = 'center'` — left, center, right, justify
- `text.letterSpacing = 0.05` — tracking
- `text.lineHeight = 1.4` — line spacing
- `text.outlineWidth = 0.03` — text outline
- `text.outlineColor = PALETTE[1]`
- `text.strokeWidth = 0.01` — inner stroke
- `text.strokeColor = PALETTE[2]`
- `text.curveRadius = 5` — bends text along a curve (positive = concave)
- `text.fillOpacity = 0.8` — transparency

### Material override (for PBR lit text)

```js
text.material = new THREE.MeshStandardMaterial({
  color: new THREE.Color(PALETTE[0]),
  metalness: 0.5,
  roughness: 0.3,
})
```

### Animating text

```js
// In GSAP onUpdate:
text.position.y = 2 + Math.sin(t) * 0.3
text.rotation.y = t * 0.2
text.fillOpacity = Math.min(t / 0.5, 1) // fade in over 0.5s
```

Use troika-three-text for all 3D text: titles, labels, callouts, stats,
annotations. It's the only text solution that works well in Three.js scenes.

## CSG — Boolean operations on meshes (three-bvh-csg)

Create complex shapes by combining/subtracting/intersecting primitives.
Available via importmap. All standard Three.js geometries work as inputs.

```js
import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg'

// Create operands — Brush extends Mesh, so position/rotate them normally
const sphere = new Brush(new THREE.SphereGeometry(1.5, 32, 32), MATERIALS.metal(PALETTE[0]))
const cylinder = new Brush(new THREE.CylinderGeometry(0.5, 0.5, 4, 32), MATERIALS.plastic(PALETTE[1]))
cylinder.updateMatrixWorld()

const evaluator = new Evaluator()

// Subtract cylinder from sphere (creates a hole)
const result = evaluator.evaluate(sphere, cylinder, SUBTRACTION)
result.castShadow = true
scene.add(result)
```

### Operations

- `SUBTRACTION` — A minus B (carve holes, cutouts)
- `ADDITION` — A plus B (merge shapes)
- `INTERSECTION` — only where A and B overlap
- `DIFFERENCE` — XOR (everything except overlap)

### Tips

- Always call `brush.updateMatrixWorld()` after positioning before evaluate
- Inputs must be watertight (all standard primitives are fine)
- Chain operations: `evaluator.evaluate(result1, brush3, ADDITION)`
- Great for: mechanical parts, architectural cutouts, abstract sculptures,
  logos carved into surfaces, window cutouts in buildings

## Animated 3D models (Mixamo / GLTF animations)

Load animated .glb models (from Mixamo, Sketchfab, or user uploads) with
AnimationMixer. GLTFLoader is already available via Three.js addons.

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const gltf = await new GLTFLoader().loadAsync(modelUrl)
const model = gltf.scene
model.scale.setScalar(1.0)
model.traverse((child) => {
  if (child.isMesh) {
    child.castShadow = true
    child.receiveShadow = true
  }
})
scene.add(model)

// Play animations
const mixer = new THREE.AnimationMixer(model)
if (gltf.animations.length > 0) {
  const action = mixer.clipAction(gltf.animations[0])
  action.play()
}

// In GSAP onUpdate — advance the mixer by delta time:
let lastT = 0
// inside onUpdate:
const t = state.progress * DURATION
const delta = t - lastT
if (delta > 0) mixer.update(delta)
lastT = t
```

### DRACO compressed models (smaller file size)

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const draco = new DRACOLoader()
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
const loader = new GLTFLoader()
loader.setDRACOLoader(draco)
const gltf = await loader.loadAsync(modelUrl)
```

The Google-hosted DRACO decoder works without any extra setup.
Use DRACO for compressed .glb models — 50-90% smaller file sizes.

## RectAreaLight (soft box lighting)

Soft, rectangular area lights for product/studio scenes. Requires
the uniform library addon.

```js
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'

RectAreaLightUniformsLib.init()

const areaLight = new THREE.RectAreaLight(0xffffff, 5, 4, 2)
areaLight.position.set(-3, 5, 3)
areaLight.lookAt(0, 0, 0)
scene.add(areaLight)
```

RectAreaLight creates realistic soft shadows like a photography softbox.
Best for product shots, studio environments, and cinematic scenes.
Note: RectAreaLight does NOT cast shadow maps — it only provides
soft illumination. Combine with a DirectionalLight for cast shadows.

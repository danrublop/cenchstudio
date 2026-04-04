# Three.js Scene Rules (r183)

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

function animate() {
  const t =
    window.__tl && typeof window.__tl.time === 'function' ? window.__tl.time() : (performance.now() - startTime) / 1000
  if (t > DURATION) return

  updateCenchThreeEnvironment(t)

  // … your hero mesh updates …

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
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
```

Or custom:

```js
new THREE.MeshStandardMaterial({
  color: new THREE.Color(PALETTE[0]),
  roughness: 0.4,
  metalness: 0.1,
})
```

NEVER use MeshBasicMaterial — looks flat and fake.
NEVER hardcode hex colors — always use PALETTE array.
`THREE.Color` accepts hex strings: `new THREE.Color('#e84545')`

## Animation loop

```js
const startTime = performance.now()

function animate() {
  const t = (performance.now() - startTime) / 1000 // seconds
  if (t > DURATION) return

  // All animation driven by t
  mesh.rotation.y = t * 0.5

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

// Initial render so scene is visible while paused
renderer.render(scene, camera)
requestAnimationFrame(animate)
```

ALWAYS call `renderer.render(scene, camera)` once BEFORE `requestAnimationFrame(animate)`.
The playback controller blocks RAF until the parent sends 'play'.
Without an initial render, the scene shows a blank background while paused.

NEVER use `Date.now()`.
NEVER use `Math.random()` — use `mulberry32(seed)` from the template.

## Camera presets

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
```

## Now available (was missing in r128)

**CapsuleGeometry(radius, length, capSegments, radialSegments)**
Pill/capsule shape, use instead of "double sphere + cylinder" workaround.

**OrbitControls** (via addons):

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

Enables mouse rotation in browser preview. Does nothing in WVC export
(no mouse events in headless Chrome). Use camera orbit code for auto-rotation.

**EffectComposer + UnrealBloomPass** (via addons):

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
```

Good for glow effects on emissive materials. Doubles render time — use sparingly.

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

**Camera** — always pick one:

- `camera-orbit-slow` — gentle orbit around origin
- `camera-pullback` — starts close, pulls back to reveal (great for openers)
- `camera-top-down` — fixed overhead looking straight down
- `camera-isometric` — fixed 45-degree isometric angle

**Objects** — pick one or more:

- `object-floating-sphere` — sphere with gentle float and slow rotation
- `object-dna-helix` — rotating double helix from spheres and tubes
- `object-bar-chart-3d` — bars rising from a floor (built-in data array)
- `object-atom` — nucleus with orbiting electron rings
- `object-gear-pair` — two interlocking gears counter-rotating
- `object-building-blocks` — cubes flying in and assembling into a structure

**Environment** — optional, pick at most one:

- `env-grid-floor` — grid plane below objects (tech/blueprint aesthetic)
- `env-particles-bg` — slowly drifting background particles
- `env-gradient-bg` — gradient sky sphere from palette[0] to palette[1]

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
})
```

The returned string is ready for injection as scene code into `generateThreeHTML`.

## HTML template

The template is generated by `generateThreeHTML()` in `lib/sceneTemplate.ts`.
Your scene code runs inside a `<script type="module">` block with THREE already imported.

Pre-defined variables available in your scene code:

- `THREE` — the Three.js namespace (r183, ES module)
- `WIDTH` (1920), `HEIGHT` (1080) — canvas dimensions
- `PALETTE` — array of 4 hex color strings from the style preset
- `DURATION` — scene duration in seconds
- `MATERIALS` — preset material factories: `.plastic(c)`, `.metal(c)`, `.glass(c)`, `.matte(c)`, `.glow(c)`
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
```

The playback controller intercepts `requestAnimationFrame` for pause/play/seek control.
Use RAF normally — it will be managed automatically.

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

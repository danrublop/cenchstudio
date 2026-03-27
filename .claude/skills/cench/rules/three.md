# Three.js Scene Rules (r183)

## Import pattern — ES modules via importmap
The scene template includes an importmap in `<head>`.
Use ES module imports in your scene code:

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

Never use `require()`, never assume THREE is a global,
never use old UMD script tags.

## Required boilerplate (always start with this)

```js
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById(LAYER_ID).appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 4, 10);
camera.lookAt(0, 0, 0);
```

## 3-point lighting (always include — never just AmbientLight)

```js
const ambient = new THREE.AmbientLight(0xffffff, 0.3);
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(-5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.width = 2048;
key.shadow.mapSize.height = 2048;
const fill = new THREE.DirectionalLight(0xfff4e0, 0.4);
fill.position.set(5, 2, 3);
const rim = new THREE.DirectionalLight(0xd0e8ff, 0.6);
rim.position.set(0, 3, -8);
scene.add(ambient, key, fill, rim);
```

NEVER use only AmbientLight — scenes look flat and washed out.

## Materials — use MATERIALS presets (available in scene template)

```js
MATERIALS.plastic(PALETTE[0])  // matte colored plastic
MATERIALS.metal(PALETTE[1])    // shiny metal
MATERIALS.glass(PALETTE[2])    // transparent glass
MATERIALS.matte(PALETTE[0])    // completely matte
MATERIALS.glow(PALETTE[3])     // emissive, glowing
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
const startTime = performance.now();

function animate() {
  const t = (performance.now() - startTime) / 1000; // seconds
  if (t > DURATION) return;

  // All animation driven by t
  mesh.rotation.y = t * 0.5;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

document.fonts.ready.then(() => requestAnimationFrame(animate));
```

NEVER use `Date.now()`.
NEVER use `Math.random()` — use `mulberry32(seed)` from the template.

## Camera presets

```js
// Slow orbit
camera.position.x = Math.cos(t * 0.3) * 10;
camera.position.z = Math.sin(t * 0.3) * 10;
camera.lookAt(0, 0, 0);

// Isometric (fixed)
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

// Top-down
camera.position.set(0, 15, 0);
camera.lookAt(0, 0, 0);
```

## Now available (was missing in r128)

**CapsuleGeometry(radius, length, capSegments, radialSegments)**
Pill/capsule shape, use instead of "double sphere + cylinder" workaround.

**OrbitControls** (via addons):
```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```
Enables mouse rotation in browser preview. Does nothing in WVC export
(no mouse events in headless Chrome). Use camera orbit code for auto-rotation.

**EffectComposer + UnrealBloomPass** (via addons):
```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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
  lighting:     'lighting-studio',
  camera:       'camera-orbit-slow',
  objects:      ['object-atom'],
  environment:  'env-grid-floor',
  palette:      PALETTE,
  duration:     DURATION,
  layerId:      'three-layer',
})
```

The returned string is ready for injection as scene code into `generateThreeHTML`.

## HTML template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.183.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.183.0/examples/jsm/"
    }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: {{BG_COLOR}}; }
    canvas { width: 100% !important; height: 100% !important; display: block; }
  </style>
</head>
<body>
  <div id="{{LAYER_ID}}"></div>
  <script type="module">
    import * as THREE from 'three';

    const WIDTH = 1920, HEIGHT = 1080;
    const PALETTE = {{PALETTE}};
    const DURATION = {{DURATION}};
    const LAYER_ID = '{{LAYER_ID}}';

    // Material presets
    const MATERIALS = {
      plastic: (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.6, metalness: 0 }),
      metal: (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.2, metalness: 0.9 }),
      glass: (c) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c), transparent: true, opacity: 0.3, roughness: 0, transmission: 0.9 }),
      matte: (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 1, metalness: 0 }),
      glow: (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), emissive: new THREE.Color(c), emissiveIntensity: 0.8 }),
    };

    // Seeded PRNG
    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }

    window.__animFrame = null;
    window.__pause = () => { cancelAnimationFrame(window.__animFrame); };
    window.__resume = () => {};

    {{SCENE_CODE}}
  </script>
</body>
</html>
```

/**
 * Smoke project: 6 Three.js scenes exercising every post-fx preset and every
 * new stage environment. No agent, no LLM — writes scene code directly via
 * POST /api/scene and PATCH /api/scene so we can manually verify each preset.
 *
 * Usage: npm run dev (another terminal), then:
 *   node scripts/create-three-postfx-showcase.mjs
 */

const BASE = process.env.CENCH_BASE_URL || 'http://localhost:3000'

async function j(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data).slice(0, 600)}`)
  return data
}

/** A single scene exercising one stage env + one post-fx preset. */
function buildSceneCode(envId, presetName) {
  return `import * as THREE from 'three';
const { WIDTH, HEIGHT, PALETTE, DURATION } = window;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = window.CENCH_TONE_MAPS ? window.CENCH_TONE_MAPS.aces : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 3.5, 11);
camera.lookAt(0, 0.5, 0);
window.__threeCamera = camera;

window.applyCenchThreeEnvironment(${JSON.stringify(envId)}, scene, renderer, camera);

// Hero cluster: instanced field of icospheres + one central torus
const field = window.createInstancedField({
  geometry: new THREE.IcosahedronGeometry(0.28, 1),
  material: window.MATERIALS.metal(PALETTE[1]),
  count: 120,
  layout: 'sphere',
  radius: 3.6,
  randomRotation: true,
  randomScale: true,
  color: (i) => new THREE.Color().setHSL((i / 120), 0.65, 0.55),
});
scene.add(field);

const torus = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1.2, 0.35, 180, 24),
  window.MATERIALS.clearcoat(PALETTE[0] || '#ffffff'),
);
torus.castShadow = true;
scene.add(torus);

// Ground catches shadows for stage envs that expect it
if (${JSON.stringify(envId)} === 'data_lab') {
  // data_lab already has its own shadow-catcher
} else {
  window.addGroundPlane(scene, { mode: 'shadow', opacity: 0.28, y: -1.5 });
}

const fx = window.createCenchPostFXPreset(renderer, scene, camera, ${JSON.stringify(presetName)});

window.__tl.to({}, {
  duration: DURATION,
  ease: 'none',
  onUpdate() {
    const t = window.__tl.time ? window.__tl.time() : 0;
    torus.rotation.x = t * 0.45;
    torus.rotation.y = t * 0.6;
    field.rotation.y = t * 0.15;
    window.updateCenchThreeEnvironment(t);
    fx.render();
  },
}, 0);
fx.render();
`
}

const MATRIX = [
  { envId: 'studio_white',   preset: 'sharpCorporate', name: 'Studio White · Sharp Corporate' },
  { envId: 'cinematic_fog',  preset: 'cinematic',      name: 'Cinematic Fog · Cinematic' },
  { envId: 'iso_playful',    preset: 'ghibli',         name: 'Pastel Playful · Ghibli' },
  { envId: 'tech_grid',      preset: 'cyberpunk',      name: 'Tech Grid · Cyberpunk' },
  { envId: 'nature_sunset',  preset: 'vintage',        name: 'Nature Sunset · Vintage' },
  { envId: 'data_lab',       preset: 'bloom',          name: 'Data Lab · Bloom' },
]

async function main() {
  const project = await j('POST', '/api/projects', {
    name: `Three.js Post-FX Showcase ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
    scenes: [],
    sceneGraph: { nodes: [], edges: [], startSceneId: '' },
  })
  console.log('project', project.id)

  for (let i = 0; i < MATRIX.length; i++) {
    const cell = MATRIX[i]
    const sceneId = `three-postfx-${i}-${cell.envId}-${cell.preset}`
    const payload = {
      id: sceneId,
      projectId: project.id,
      sceneType: 'three',
      name: cell.name,
      duration: 6,
      sceneCode: buildSceneCode(cell.envId, cell.preset),
    }
    const res = await j('POST', `/api/projects/${project.id}/scenes`, payload).catch(async () => {
      // Fallback path for environments that don't expose that endpoint — just PATCH.
      return j('PATCH', '/api/scene', {
        sceneId,
        projectId: project.id,
        sceneType: 'three',
        sceneCode: payload.sceneCode,
        duration: 6,
      })
    })
    console.log(' scene', sceneId, '→', res?.success ?? 'ok')
  }

  console.log('\nOpen', `${BASE}/v/${project.id}`, 'and scrub through the 6 scenes.')
}

main().catch((e) => { console.error(e); process.exit(1) })

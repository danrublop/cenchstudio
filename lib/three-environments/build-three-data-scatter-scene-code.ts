/**
 * Full Three.js scene module for 3D scatter plots (Cortico-style, vanilla Three —
 * see https://github.com/CorticoAI/3d-react-demo for the original R3F reference).
 */
import { CENCH_STUDIO_ENV_IDS } from './registry'

export interface ScatterPoint3 {
  x: number
  y: number
  z: number
}

export interface BuildThreeDataScatterOpts {
  studioEnvironmentId: string
  points: ScatterPoint3[]
  orbitSpeed?: number
  pointRadius?: number
}

const STUDIO_ID_SET = new Set<string>(CENCH_STUDIO_ENV_IDS)

export function buildThreeDataScatterSceneCode(opts: BuildThreeDataScatterOpts): string {
  const envId = STUDIO_ID_SET.has(opts.studioEnvironmentId) ? opts.studioEnvironmentId : 'track_rolling_topdown'
  const pts = Array.isArray(opts.points) ? opts.points : []
  const orbit = typeof opts.orbitSpeed === 'number' ? opts.orbitSpeed : 0.12
  const pr = typeof opts.pointRadius === 'number' ? opts.pointRadius : 0.14
  const pointsJson = JSON.stringify(pts)
  const envJson = JSON.stringify(envId)

  return `
import * as THREE from 'three';
const { WIDTH, HEIGHT, DURATION, applyCenchThreeEnvironment, updateCenchThreeEnvironment, createCenchDataScatterplot, updateCenchDataScatterplot } = window;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 500);
camera.position.set(16, 11, 18);
camera.lookAt(0, 0, 0);
window.__threeCamera = camera;

applyCenchThreeEnvironment(${envJson}, scene, renderer, camera);

createCenchDataScatterplot(scene, {
  points: ${pointsJson},
  orbitSpeed: ${orbit},
  pointRadius: ${pr},
});

var startTime = performance.now();
function animate() {
  var t = window.__tl && typeof window.__tl.time === 'function' ? window.__tl.time() : (performance.now() - startTime) / 1000;
  if (t > DURATION) return;
  updateCenchThreeEnvironment(t);
  updateCenchDataScatterplot(t);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
renderer.render(scene, camera);
requestAnimationFrame(animate);
`.trim()
}

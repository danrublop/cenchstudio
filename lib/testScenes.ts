import type { D3ChartLayer, PhysicsLayer, Scene, TextOverlay } from './types'
import { STYLE_PRESETS } from './types'
import { v4 as uuidv4 } from 'uuid'
import { compileD3SceneFromLayers } from './charts/compile'
import { deriveChartLayersFromScene } from './charts/extract'
import { compilePhysicsSceneFromLayers } from './physics/compile'

/** Single full-stage chart cell (matches deriveChartLayersFromScene grid for one chart). */
const D3_TEST_CHART_LAYOUT = { x: 2, y: 2, width: 96, height: 96 } as const

function singleD3TestChartLayer(
  id: string,
  name: string,
  chartType: D3ChartLayer['chartType'],
  data: unknown[],
  config: Record<string, unknown>,
  sceneDuration: number,
  animated = true,
): D3ChartLayer {
  return {
    id,
    name,
    chartType,
    data,
    config,
    layout: { ...D3_TEST_CHART_LAYOUT },
    timing: { startAt: 0, duration: Math.max(0.5, sceneDuration), animated },
  }
}

/**
 * Materialize chartLayers + sceneCode + d3Data via compileD3SceneFromLayers (same path as editor saves).
 * Pass chartLayers explicitly for full config (e.g. margin); otherwise derive from legacy CenchCharts sceneCode.
 */
function finalizeD3TestScene(scene: Scene): Scene {
  if (scene.sceneType !== 'd3') return scene
  const layers: D3ChartLayer[] =
    (scene.chartLayers?.length ?? 0) > 0
      ? (scene.chartLayers ?? [])
      : deriveChartLayersFromScene({ ...scene, chartLayers: [] })
  if (layers.length === 0) return scene
  const compiled = compileD3SceneFromLayers(layers)
  return {
    ...scene,
    chartLayers: layers,
    sceneCode: compiled.sceneCode,
    d3Data: compiled.d3Data as Scene['d3Data'],
  }
}

function base(): Omit<Scene, 'id' | 'name' | 'sceneType' | 'prompt'> {
  return {
    summary: '',
    svgContent: '',
    canvasCode: '',
    canvasBackgroundCode: '',
    sceneCode: '',
    sceneHTML: '',
    sceneStyles: '',
    lottieSource: '',
    d3Data: null,
    usage: null,
    duration: 8,
    bgColor: '#ffffff',
    thumbnail: null,
    videoLayer: { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
    audioLayer: { enabled: false, src: null, volume: 1, fadeIn: false, fadeOut: false, startOffset: 0 },
    textOverlays: [],
    svgObjects: [],
    primaryObjectId: null,
    svgBranches: [],
    activeBranchId: null,
    transition: 'none',
    interactions: [],
    variables: [],
    aiLayers: [],
    messages: [],
    styleOverride: {},
    cameraMotion: null,
    worldConfig: null,
  }
}

export function createTestScenes(): Scene[] {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SVG — "Pythagorean Theorem"
  // ═══════════════════════════════════════════════════════════════════════════
  const svgScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'Pythagorean Theorem',
    sceneType: 'svg',
    prompt: 'Visual proof of the Pythagorean theorem with animated squares',
    bgColor: '#0d0f1a',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <style>
      .stroke { fill:none; stroke-linecap:round; stroke-linejoin:round;
        stroke-dasharray:var(--len,1000); stroke-dashoffset:var(--len,1000);
        animation:draw var(--dur,1.2s) ease-in-out var(--delay,0s) forwards; }
      .fadein { opacity:0; animation:pop var(--dur,0.5s) ease var(--delay,0s) forwards; }
      .scale  { opacity:0; transform-origin:center center;
        animation:scaleIn var(--dur,0.5s) ease var(--delay,0s) forwards; }
      .slide-up { opacity:0; animation:slideUp var(--dur,0.5s) ease var(--delay,0s) forwards; }
      .bounce { opacity:0; transform-origin:center center;
        animation:bounceIn var(--dur,0.6s) cubic-bezier(0.34,1.56,0.64,1) var(--delay,0s) forwards; }
      @keyframes draw      { to { stroke-dashoffset:0; } }
      @keyframes pop       { to { opacity:1; } }
      @keyframes scaleIn   { from { opacity:0; transform:scale(0); } to { opacity:1; transform:scale(1); } }
      @keyframes slideUp   { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
      @keyframes bounceIn  { 0%{opacity:0;transform:scale(0)} 60%{opacity:1;transform:scale(1.15)} 100%{transform:scale(1)} }
    </style>
  </defs>

  <!-- Title -->
  <text x="960" y="90" font-family="sans-serif" font-size="56" font-weight="700"
    fill="#e0e0e0" text-anchor="middle" class="slide-up" style="--delay:0.1s;--dur:0.6s">
    The Pythagorean Theorem
  </text>
  <text x="960" y="135" font-family="sans-serif" font-size="24"
    fill="#6b6b7a" text-anchor="middle" class="fadein" style="--delay:0.4s;--dur:0.5s">
    For any right triangle: the sum of the squares on the two shorter sides equals the square on the hypotenuse
  </text>

  <!-- Right triangle (3-4-5 scaled by 80: a=240, b=320, c=400) -->
  <!-- Vertices: A(660,760) B(660,520) C(980,760) -->

  <!-- Side a (vertical: A to B, length 240) -->
  <line x1="660" y1="760" x2="660" y2="520" stroke="#4f9cf7" stroke-width="4"
    class="stroke" style="--delay:0.8s;--dur:0.8s;--len:240"/>

  <!-- Side b (horizontal: A to C, length 320) -->
  <line x1="660" y1="760" x2="980" y2="760" stroke="#e84545" stroke-width="4"
    class="stroke" style="--delay:1.0s;--dur:0.8s;--len:320"/>

  <!-- Side c (hypotenuse: B to C, length 400) -->
  <line x1="660" y1="520" x2="980" y2="760" stroke="#a78bfa" stroke-width="4"
    class="stroke" style="--delay:1.2s;--dur:0.8s;--len:400"/>

  <!-- Right angle marker at A(660,760) -->
  <path d="M 660 720 L 700 720 L 700 760" fill="none" stroke="#6b6b7a" stroke-width="2"
    class="stroke" style="--delay:1.5s;--dur:0.4s;--len:80"/>

  <!-- Square on side a (left of vertical side, 240x240, blue) -->
  <rect x="420" y="520" width="240" height="240" rx="4" fill="#4f9cf7" opacity="0.08"
    stroke="#4f9cf7" stroke-width="2"
    class="scale" style="--delay:2.4s;--dur:0.6s"/>
  <text x="540" y="650" font-family="sans-serif" font-size="32" font-weight="700"
    fill="#4f9cf7" text-anchor="middle" class="bounce" style="--delay:2.8s;--dur:0.5s">
    a² = 9
  </text>

  <!-- Square on side b (below horizontal side, 320x320, red) -->
  <rect x="660" y="760" width="320" height="320" rx="4" fill="#e84545" opacity="0.08"
    stroke="#e84545" stroke-width="2"
    class="scale" style="--delay:3.0s;--dur:0.6s"/>
  <text x="820" y="930" font-family="sans-serif" font-size="32" font-weight="700"
    fill="#e84545" text-anchor="middle" class="bounce" style="--delay:3.4s;--dur:0.5s">
    b² = 16
  </text>

  <!-- Square on hypotenuse (tilted, 400x400, purple) -->
  <!-- Hyp from B(660,520) to C(980,760). Perp direction: (240,-320) normalized × 400 -->
  <polygon points="660,520 980,760 1220,440 900,200" fill="#a78bfa" opacity="0.08"
    stroke="#a78bfa" stroke-width="2"
    class="scale" style="--delay:3.6s;--dur:0.6s"/>
  <text x="940" y="410" font-family="sans-serif" font-size="32" font-weight="700"
    fill="#a78bfa" text-anchor="middle" class="bounce" style="--delay:4.0s;--dur:0.5s">
    c² = 25
  </text>

  <!-- Side labels (rendered after squares so they appear in front) -->
  <text x="630" y="650" font-family="sans-serif" font-size="36" font-weight="600"
    fill="#e0e0e0" text-anchor="end" class="fadein" style="--delay:1.6s;--dur:0.4s">
    a = 3
  </text>
  <text x="820" y="800" font-family="sans-serif" font-size="36" font-weight="600"
    fill="#e0e0e0" text-anchor="middle" class="fadein" style="--delay:1.8s;--dur:0.4s">
    b = 4
  </text>
  <text x="850" y="620" font-family="sans-serif" font-size="36" font-weight="600"
    fill="#e0e0e0" class="fadein" style="--delay:2.0s;--dur:0.4s">
    c = 5
  </text>

  <!-- The equation -->
  <text x="1550" y="550" font-family="sans-serif" font-size="48" font-weight="700"
    fill="#e0e0e0" text-anchor="middle" class="slide-up" style="--delay:4.5s;--dur:0.7s">
    a² + b² = c²
  </text>
  <text x="1550" y="610" font-family="sans-serif" font-size="36"
    fill="#6b6b7a" text-anchor="middle" class="fadein" style="--delay:5.0s;--dur:0.5s">
    9 + 16 = 25
  </text>

  <!-- Checkmark -->
  <path d="M 1510 650 L 1540 680 L 1600 620" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round"
    class="stroke" style="--delay:5.5s;--dur:0.5s;--len:120"/>

  <!-- Footer -->
  <text x="960" y="1050" font-family="sans-serif" font-size="18"
    fill="#4a4a5a" text-anchor="middle" letter-spacing="4" class="fadein" style="--delay:6.0s;--dur:0.5s">
    SVG SCENE TYPE
  </text>
</svg>`,
    svgBranches: [],
    activeBranchId: null,
    svgObjects: [],
    primaryObjectId: null,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Canvas 2D — "The Water Cycle"
  // ═══════════════════════════════════════════════════════════════════════════
  const canvasScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'The Water Cycle',
    sceneType: 'canvas2d',
    prompt: 'Animated diagram explaining the water cycle: evaporation, condensation, precipitation',
    bgColor: '#0a1628',
    canvasCode: `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// DURATION is injected by the template — do not redeclare
const START_T = parseFloat(new URLSearchParams(location.search).get('t') || '0');
const startWall = performance.now() - START_T * 1000;

function getT() { return (performance.now() - startWall) / 1000; }

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn  = t => t * t * t;
const lerp    = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.max(0, Math.min(1, t));

// Colors
const SKY_TOP = '#0a1628';
const SKY_BOT = '#1a3050';
const WATER = '#2563eb';
const MOUNTAIN = '#1e293b';
const SUN = '#f59e0b';
const CLOUD = '#94a3b8';
const RAIN = '#60a5fa';
const ARROW = '#4f9cf7';
const LABEL_COL = '#e0e0e0';
const SUBLABEL = '#6b6b7a';

// Seeded PRNG (in case template doesn't provide it)
if (typeof mulberry32 === 'undefined') {
  var mulberry32 = function(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }
}
const rand = mulberry32(99);

// Pre-generate rain drops
const rainDrops = [];
for (let i = 0; i < 40; i++) {
  rainDrops.push({
    x: 1200 + rand() * 400,
    startY: 300 + rand() * 50,
    speed: 200 + rand() * 150,
    len: 15 + rand() * 20,
    delay: rand() * 2,
  });
}

// Pre-generate evaporation particles
const evapParticles = [];
for (let i = 0; i < 25; i++) {
  evapParticles.push({
    x: 200 + rand() * 600,
    speed: 30 + rand() * 40,
    wobble: rand() * 4 + 2,
    wobbleFreq: rand() * 2 + 1,
    size: 3 + rand() * 4,
    delay: rand() * 3,
  });
}

function drawSky(t) {
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_BOT);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1920, 1080);
}

function drawSun(t) {
  const a = easeOut(clamp01(t / 0.8));
  ctx.globalAlpha = a;
  // Sun glow
  const glow = ctx.createRadialGradient(300, 180, 30, 300, 180, 120);
  glow.addColorStop(0, SUN);
  glow.addColorStop(0.5, 'rgba(245,158,11,0.2)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(180, 60, 240, 240);
  // Sun body
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.arc(300, 180, 50, 0, Math.PI * 2);
  ctx.fill();
  // Rays
  ctx.strokeStyle = SUN;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r1 = 60, r2 = 85;
    ctx.beginPath();
    ctx.moveTo(300 + Math.cos(angle) * r1, 180 + Math.sin(angle) * r1);
    ctx.lineTo(300 + Math.cos(angle) * r2, 180 + Math.sin(angle) * r2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawMountain(t) {
  const a = easeOut(clamp01((t - 0.3) / 0.8));
  ctx.globalAlpha = a;
  ctx.fillStyle = MOUNTAIN;
  ctx.beginPath();
  ctx.moveTo(0, 700);
  ctx.lineTo(200, 450);
  ctx.lineTo(400, 550);
  ctx.lineTo(600, 380);
  ctx.lineTo(800, 500);
  ctx.lineTo(900, 600);
  ctx.lineTo(900, 700);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawWater(t) {
  const a = easeOut(clamp01((t - 0.5) / 0.8));
  ctx.globalAlpha = a;
  const waterGrad = ctx.createLinearGradient(0, 700, 0, 1080);
  waterGrad.addColorStop(0, WATER);
  waterGrad.addColorStop(1, '#1e40af');
  ctx.fillStyle = waterGrad;
  // Gentle wave
  ctx.beginPath();
  ctx.moveTo(0, 720);
  for (let x = 0; x <= 1920; x += 10) {
    const y = 710 + Math.sin(x * 0.008 + t * 0.5) * 8 + Math.sin(x * 0.015 + t * 0.8) * 4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(1920, 1080);
  ctx.lineTo(0, 1080);
  ctx.closePath();
  ctx.fill();

  // Water label
  ctx.fillStyle = '#93c5fd';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Ocean / Lake', 500, 800);
  ctx.globalAlpha = 1;
}

function drawCloud(t, cx, cy, scale, delay) {
  const a = easeOut(clamp01((t - delay) / 0.6));
  if (a <= 0) return;
  ctx.globalAlpha = a * 0.85;
  ctx.fillStyle = CLOUD;
  ctx.beginPath();
  ctx.arc(cx, cy, 40 * scale, 0, Math.PI * 2);
  ctx.arc(cx + 35 * scale, cy - 10 * scale, 30 * scale, 0, Math.PI * 2);
  ctx.arc(cx - 30 * scale, cy + 5 * scale, 25 * scale, 0, Math.PI * 2);
  ctx.arc(cx + 15 * scale, cy + 15 * scale, 28 * scale, 0, Math.PI * 2);
  ctx.arc(cx - 15 * scale, cy - 15 * scale, 22 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawEvaporation(t) {
  const fadeIn = easeOut(clamp01((t - 1.5) / 0.8));
  if (fadeIn <= 0) return;
  evapParticles.forEach(p => {
    const pt = t - 1.5 - p.delay;
    if (pt <= 0) return;
    const cycle = pt % 4;
    const y = 700 - cycle * p.speed;
    if (y < 250) return;
    const x = p.x + Math.sin(cycle * p.wobbleFreq) * p.wobble;
    const alpha = fadeIn * (1 - clamp01((700 - y) / 400)) * 0.6;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawRain(t) {
  const fadeIn = easeOut(clamp01((t - 3.0) / 0.5));
  if (fadeIn <= 0) return;
  ctx.strokeStyle = RAIN;
  ctx.lineWidth = 1.5;
  rainDrops.forEach(d => {
    const pt = t - 3.0 - d.delay;
    if (pt <= 0) return;
    const cycle = (pt * d.speed) % 400;
    const y = d.startY + cycle;
    if (y > 700) return;
    ctx.globalAlpha = fadeIn * 0.5;
    ctx.beginPath();
    ctx.moveTo(d.x, y);
    ctx.lineTo(d.x - 2, y + d.len);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawArrow(t, points, delay, label, labelX, labelY) {
  const a = easeOut(clamp01((t - delay) / 0.6));
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.strokeStyle = ARROW;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  ctx.fillStyle = ARROW;
  ctx.beginPath();
  ctx.moveTo(last[0], last[1]);
  ctx.lineTo(last[0] - 12 * Math.cos(angle - 0.4), last[1] - 12 * Math.sin(angle - 0.4));
  ctx.lineTo(last[0] - 12 * Math.cos(angle + 0.4), last[1] - 12 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();

  // Label
  ctx.fillStyle = LABEL_COL;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, labelX, labelY);
  ctx.globalAlpha = 1;
}

function drawTitle(t) {
  const a = easeOut(clamp01(t / 0.6));
  ctx.globalAlpha = a;
  ctx.fillStyle = LABEL_COL;
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('The Water Cycle', 960, 70);
  ctx.fillStyle = SUBLABEL;
  ctx.font = '22px sans-serif';
  ctx.fillText('Evaporation  \u2192  Condensation  \u2192  Precipitation  \u2192  Collection', 960, 110);
  ctx.globalAlpha = 1;
}

function drawLabels(t) {
  // Stage labels
  const labels = [
    { text: '1. EVAPORATION', x: 450, y: 480, delay: 2.0, color: '#f59e0b' },
    { text: '2. CONDENSATION', x: 900, y: 230, delay: 2.8, color: CLOUD },
    { text: '3. PRECIPITATION', x: 1400, y: 230, delay: 3.5, color: RAIN },
    { text: '4. COLLECTION', x: 1400, y: 780, delay: 4.5, color: WATER },
  ];
  labels.forEach(l => {
    const a = easeOut(clamp01((t - l.delay) / 0.5));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = l.color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l.text, l.x, l.y);
    ctx.globalAlpha = 1;
  });
}

function draw(t) {
  ctx.clearRect(0, 0, 1920, 1080);
  drawSky(t);
  drawTitle(t);
  drawSun(t);
  drawMountain(t);
  drawWater(t);

  // Clouds
  drawCloud(t, 850, 280, 1.2, 1.2);
  drawCloud(t, 1050, 260, 0.9, 1.4);
  drawCloud(t, 1350, 300, 1.1, 1.6);
  drawCloud(t, 1500, 270, 0.8, 1.8);

  drawEvaporation(t);
  drawRain(t);

  // Arrows for each stage
  drawArrow(t, [[450, 690], [450, 550], [500, 350]], 2.2, 'Evaporation', 380, 530);
  drawArrow(t, [[700, 320], [900, 280], [1100, 290]], 3.0, 'Condensation', 900, 200);
  drawArrow(t, [[1350, 330], [1380, 500], [1400, 680]], 3.8, 'Precipitation', 1500, 500);
  drawArrow(t, [[1400, 720], [1100, 730], [800, 720]], 4.8, 'Collection', 1100, 760);

  drawLabels(t);
}

function loop() {
  const t = getT();
  if (t < DURATION) {
    draw(t);
    window.__animFrame = requestAnimationFrame(loop);
  } else {
    draw(DURATION);
  }
}

window.__pause  = () => { cancelAnimationFrame(window.__animFrame); };
window.__resume = () => { window.__animFrame = requestAnimationFrame(loop); };
window.__animFrame = requestAnimationFrame(loop);`,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Motion — "How Gravity Works"
  // ═══════════════════════════════════════════════════════════════════════════
  const motionScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'How Gravity Works',
    sceneType: 'motion',
    prompt: 'Animated explainer about gravity with falling objects and orbits',
    bgColor: '#0d0d12',
    sceneStyles: `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', 'Helvetica Neue', sans-serif; }

      /* CSS keyframes — play on load without RAF */
      @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      @keyframes fadeSlideLeft { from { opacity:0; transform:translateX(-30px); } to { opacity:1; transform:translateX(0); } }
      @keyframes fadeSlideRight { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
      @keyframes fadeScaleIn { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
      @keyframes dropApple { from { transform:translateY(0); } to { transform:translateY(120px); } }
      @keyframes growArrow { from { height:0; } to { height:60px; } }
      @keyframes pulseScale { 0%,100% { transform:scale(1); } 50% { transform:scale(1.15); } }
      @keyframes orbitMoon {
        0%   { transform: translate(0, 0); }
        25%  { transform: translate(-60px, -40px); }
        50%  { transform: translate(-120px, 0); }
        75%  { transform: translate(-60px, 40px); }
        100% { transform: translate(0, 0); }
      }

      /* Use a 3-column layout that fits any viewport */
      #layout {
        display: flex; width: 100%; height: 100vh;
        flex-direction: column; align-items: center;
        padding: 3% 4%;
      }

      #title {
        font-size: clamp(24px, 4vw, 56px); font-weight: 800; color: #e0e0e0;
        text-align: center; margin-bottom: 4px;
        opacity: 0; animation: fadeSlideUp 0.7s ease-out 0.2s forwards;
      }
      #subtitle {
        font-size: clamp(12px, 1.8vw, 22px); color: #6b6b7a;
        text-align: center; margin-bottom: 3%;
        opacity: 0; animation: fadeIn 0.5s ease-out 0.6s forwards;
      }

      #stages {
        display: flex; width: 100%; flex: 1;
        justify-content: space-around; align-items: center;
        gap: 2%;
      }

      .stage {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; flex: 1; opacity: 0;
        position: relative; min-width: 0;
      }

      /* Stage 1: Newton's apple */
      #apple-tree { animation: fadeSlideLeft 0.6s ease-out 1.0s forwards; }
      .tree-wrap { position: relative; width: clamp(100px, 14vw, 200px); height: clamp(160px, 22vw, 320px); }
      #tree-trunk {
        position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
        width: clamp(16px, 2vw, 30px); height: 40%;
        background: #78350f; border-radius: 4px;
      }
      #tree-crown {
        position: absolute; left: 50%; top: 0; transform: translateX(-50%);
        width: 80%; height: 50%; background: #166534; border-radius: 50%;
      }
      #apple {
        position: absolute; left: 52%; top: 44%;
        width: clamp(12px, 1.5vw, 20px); height: clamp(12px, 1.5vw, 20px);
        background: #e84545; border-radius: 50%;
        animation: dropApple 0.8s ease-in 2.0s forwards;
      }
      #gravity-arrow {
        position: absolute; left: 53%; top: 55%;
        width: 2px; height: 0; background: #f59e0b;
        animation: growArrow 0.6s ease-out 2.2s forwards;
      }
      .stage-label {
        font-size: clamp(11px, 1.2vw, 18px); font-weight: 600;
        margin-top: 8px; opacity: 0;
      }
      #apple-label { color: #e84545; animation: fadeIn 0.4s ease-out 1.6s forwards; }
      #g-label {
        color: #f59e0b; font-size: clamp(10px, 1.1vw, 16px);
        opacity: 0; animation: fadeIn 0.4s ease-out 2.8s forwards;
      }

      /* Stage 2: Formula */
      #formula-box { animation: fadeScaleIn 0.6s ease-out 3.2s forwards; text-align: center; }
      #formula { font-size: clamp(20px, 3.2vw, 48px); font-weight: 700; color: #e0e0e0; white-space: nowrap; }
      #formula-desc { font-size: clamp(10px, 1.2vw, 18px); color: #6b6b7a; margin-top: 8px; }
      .formula-part { display: inline-block; }
      #f-label { color: #4f9cf7; animation: pulseScale 0.6s ease-in-out 3.8s; }
      #g-const { color: #f59e0b; animation: pulseScale 0.6s ease-in-out 4.2s; }
      #m-labels { color: #a78bfa; animation: pulseScale 0.6s ease-in-out 4.6s; }
      #r-label { color: #e84545; }

      /* Stage 3: Earth-Moon orbit */
      #orbit-demo { animation: fadeSlideRight 0.6s ease-out 5.0s forwards; }
      .orbit-wrap { position: relative; width: clamp(120px, 18vw, 260px); height: clamp(120px, 18vw, 260px); }
      #orbit-ring {
        position: absolute; inset: 0;
        border: 2px dashed rgba(148,163,184,0.3); border-radius: 50%;
      }
      #earth {
        position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        width: clamp(30px, 4vw, 60px); height: clamp(30px, 4vw, 60px);
        background: #2563eb; border-radius: 50%;
      }
      #moon {
        position: absolute; right: 0; top: 50%; transform: translateY(-50%);
        width: clamp(14px, 1.8vw, 24px); height: clamp(14px, 1.8vw, 24px);
        background: #94a3b8; border-radius: 50%;
        animation: orbitMoon 4s linear 5.5s infinite;
      }
      #earth-label { color: #2563eb; animation: fadeIn 0.4s ease-out 5.4s forwards; opacity: 0; }
      #orbit-label { color: #94a3b8; animation: fadeIn 0.4s ease-out 5.8s forwards; opacity: 0; }

      /* Footer */
      #footer {
        font-size: clamp(10px, 1.2vw, 18px); color: #4a4a5a; letter-spacing: 4px;
        text-align: center; margin-top: auto; padding-top: 2%;
        opacity: 0; animation: fadeIn 0.5s ease-out 6.0s forwards;
      }
    `,
    sceneHTML: `
      <div id="layout">
        <div id="title">How Gravity Works</div>
        <div id="subtitle">The invisible force that shapes the universe</div>

        <div id="stages">
          <div id="apple-tree" class="stage">
            <div class="tree-wrap">
              <div id="tree-crown"></div>
              <div id="tree-trunk"></div>
              <div id="apple"></div>
              <div id="gravity-arrow"></div>
            </div>
            <div class="stage-label" id="apple-label">Newton's Apple</div>
            <div class="stage-label" id="g-label">g = 9.8 m/s²</div>
          </div>

          <div id="formula-box" class="stage">
            <div id="formula">
              <span id="f-label" class="formula-part">F</span>
              <span class="formula-part" style="color:#6b6b7a"> = </span>
              <span id="g-const" class="formula-part">G</span>
              <span class="formula-part" style="color:#6b6b7a"> &middot; </span>
              <span id="m-labels" class="formula-part">m&#8321;m&#8322;</span>
              <span class="formula-part" style="color:#6b6b7a"> / </span>
              <span id="r-label" class="formula-part">r²</span>
            </div>
            <div id="formula-desc">Newton's Law of Universal Gravitation</div>
          </div>

          <div id="orbit-demo" class="stage">
            <div class="orbit-wrap">
              <div id="orbit-ring"></div>
              <div id="earth"></div>
              <div id="moon"></div>
            </div>
            <div class="stage-label" id="earth-label">Earth</div>
            <div class="stage-label" id="orbit-label">Orbital Motion</div>
          </div>
        </div>

        <div id="footer">MOTION SCENE TYPE</div>
      </div>
    `,
    sceneCode: `
      // All animations are CSS @keyframes (defined in sceneStyles).
      // CSS animations work without RAF, so they play on load just like SVG scenes.
      // No anime.js or Motion v11 calls needed for this test scene.
    `,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. D3 — "World Energy Mix"
  // ═══════════════════════════════════════════════════════════════════════════
  const d3Scene: Scene = finalizeD3TestScene({
    ...base(),
    id: uuidv4(),
    name: 'World Energy Mix',
    sceneType: 'd3',
    prompt: 'Animated bar chart showing global energy sources',
    bgColor: '#0d0f1a',
    sceneStyles: '',
    chartLayers: [
      singleD3TestChartLayer(
        'chart-main',
        'World Energy Mix',
        'bar',
        [
          { label: 'Oil', value: 31, color: '#e84545' },
          { label: 'Coal', value: 27, color: '#78350f' },
          { label: 'Gas', value: 23, color: '#f59e0b' },
          { label: 'Hydro', value: 7, color: '#2563eb' },
          { label: 'Nuclear', value: 5, color: '#a78bfa' },
          { label: 'Wind', value: 4, color: '#06b6d4' },
          { label: 'Solar', value: 2, color: '#f59e0b' },
          { label: 'Other', value: 1, color: '#6b6b7a' },
        ],
        {
          title: 'World Energy Mix',
          subtitle: 'Share of global primary energy by source (%)',
          yLabel: 'Share (%)',
          valueFormat: ',.0f',
          valueSuffix: '%',
          showValues: true,
          showGrid: true,
          theme: 'dark',
        },
        8,
        true,
      ),
    ],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Three.js — "Stylized Planet"
  // ═══════════════════════════════════════════════════════════════════════════
  const threeScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'Stylized Planet',
    sceneType: 'three',
    prompt: 'Low-poly stylized planet with atmosphere, orbiting moon, and star field',
    bgColor: '#000000',
    sceneCode: `
import * as THREE from 'three';
const { WIDTH, HEIGHT, DURATION } = window;
const mulberry32 = window.mulberry32;
const rand = mulberry32(42);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor(0x000008);
document.body.appendChild(renderer.domElement);

const scene3 = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 2, 9);
camera.lookAt(0, 0, 0);

// Lighting
scene3.add(new THREE.AmbientLight(0x1a1a3a, 0.5));
const sunLight = new THREE.DirectionalLight(0xfff0e0, 1.5);
sunLight.position.set(8, 4, 6);
scene3.add(sunLight);
const rimLight = new THREE.DirectionalLight(0x4f9cf7, 0.4);
rimLight.position.set(-5, -2, -3);
scene3.add(rimLight);

// Star field
const starCount = 500;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = rand() * Math.PI * 2;
  const phi = Math.acos(2 * rand() - 1);
  const r = 30 + rand() * 50;
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
scene3.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.15, color: 0xffffff, transparent: true, opacity: 0.7 })));

// Planet
const planetGeo = new THREE.IcosahedronGeometry(2.2, 3);
const posAttr = planetGeo.getAttribute('position');
const planetColors = new Float32Array(posAttr.count * 3);

for (let i = 0; i < posAttr.count; i++) {
  const px = posAttr.getX(i);
  const py = posAttr.getY(i);
  const pz = posAttr.getZ(i);
  const len = Math.sqrt(px * px + py * py + pz * pz);

  // Vertex displacement for terrain
  const noise = Math.sin(px * 2.5 + 1.3) * Math.cos(pz * 2.1 + 0.7) * 0.15;
  const scale = 1 + noise * (0.5 + rand() * 0.5);
  posAttr.setXYZ(i, px / len * 2.2 * scale, py / len * 2.2 * scale, pz / len * 2.2 * scale);

  // Vertex colors
  const height = (scale - 1) / 0.15;
  if (Math.abs(py / len) > 0.7) {
    planetColors[i * 3] = 0.85; planetColors[i * 3 + 1] = 0.88; planetColors[i * 3 + 2] = 0.92;
  } else if (height > 0.3) {
    planetColors[i * 3] = 0.2 + rand() * 0.1;
    planetColors[i * 3 + 1] = 0.45 + rand() * 0.15;
    planetColors[i * 3 + 2] = 0.15 + rand() * 0.1;
  } else {
    planetColors[i * 3] = 0.1 + rand() * 0.05;
    planetColors[i * 3 + 1] = 0.3 + rand() * 0.1;
    planetColors[i * 3 + 2] = 0.65 + rand() * 0.15;
  }
}
planetGeo.setAttribute('color', new THREE.BufferAttribute(planetColors, 3));
planetGeo.computeVertexNormals();

const planet = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.7, metalness: 0.1, flatShading: true,
}));
scene3.add(planet);

// Atmosphere
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(2.55, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0x4f9cf7, transparent: true, opacity: 0.08, side: THREE.BackSide })
);
scene3.add(atmo);

// Ring
const ring = new THREE.Mesh(
  new THREE.RingGeometry(3.0, 4.2, 64),
  new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
);
ring.rotation.x = Math.PI * 0.42;
ring.rotation.z = 0.15;
scene3.add(ring);

// Moon
const moon = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.35, 2),
  new THREE.MeshStandardMaterial({ color: 0xb0b0b8, roughness: 0.8, flatShading: true })
);
scene3.add(moon);

const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  const delta = clock.getDelta();
  elapsed += delta;
  if (elapsed >= DURATION) {
    renderer.render(scene3, camera);
    return;
  }

  planet.rotation.y += delta * 0.15;
  atmo.rotation.y += delta * 0.12;
  ring.rotation.z += delta * 0.03;

  const moonAngle = elapsed * 0.4;
  moon.position.set(Math.cos(moonAngle) * 5, Math.sin(moonAngle * 0.3) * 0.8, Math.sin(moonAngle) * 5);
  moon.rotation.y += delta * 0.5;

  camera.position.x = Math.sin(elapsed * 0.15) * 1.5;
  camera.position.y = 2 + Math.sin(elapsed * 0.1) * 0.3;
  camera.lookAt(0, 0, 0);

  renderer.render(scene3, camera);
  window.__animFrame = requestAnimationFrame(animate);
}

window.__pause = () => { cancelAnimationFrame(window.__animFrame); clock.stop(); };
window.__resume = () => { clock.start(); clock.getDelta(); window.__animFrame = requestAnimationFrame(animate); };
renderer.render(scene3, camera);
window.__animFrame = requestAnimationFrame(animate);
`,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Lottie — "Lottie Showcase"
  // ═══════════════════════════════════════════════════════════════════════════
  // Real Lottie animation from LottieFiles — "Doctor with Notepad" (exported from After Effects).
  // Uses URL mode: lottieSource starts with 'http' so the template uses `path:` instead of `animationData:`.
  const lottieUrl = 'https://assets2.lottiefiles.com/packages/lf20_tutvdkg0.json'

  const lottieScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'Lottie Showcase',
    sceneType: 'lottie',
    prompt: 'Doctor with notepad — medical explainer animation',
    bgColor: '#0d0d12',
    lottieSource: lottieUrl,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <style>
      .fadein { opacity:0; animation:pop var(--dur,0.5s) ease var(--delay,0s) forwards; }
      .slide-up { opacity:0; animation:slideUp var(--dur,0.5s) ease var(--delay,0s) forwards; }
      @keyframes pop     { to { opacity:1; } }
      @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    </style>
  </defs>
  <text x="960" y="80" font-family="sans-serif" font-size="28" font-weight="300"
    fill="#a78bfa" text-anchor="middle" letter-spacing="6" class="slide-up" style="--delay:0.3s;--dur:0.6s">
    LOTTIE SHOWCASE
  </text>
  <text x="960" y="1040" font-family="sans-serif" font-size="14"
    fill="#4a4a5a" text-anchor="middle" letter-spacing="4" class="fadein" style="--delay:1.5s;--dur:0.5s">
    DOCTOR WITH NOTEPAD
  </text>
</svg>`,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Zdog — "Water Molecule"
  // ═══════════════════════════════════════════════════════════════════════════
  const zdogScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'Water Molecule',
    sceneType: 'zdog',
    prompt: 'Rotating 3D water molecule (H2O) with bonds and electron cloud rings',
    bgColor: '#0a0e1a',
    sceneCode: `
var canvas = document.getElementById('zdog-canvas');

var illo = new Zdog.Illustration({
  element: canvas,
  zoom: 5,
  dragRotate: false,
  resize: false,
  width: WIDTH,
  height: HEIGHT,
  rotate: { x: -0.25, y: 0.3 },
});

// ── Molecule group (so everything rotates together) ──
var molecule = new Zdog.Anchor({ addTo: illo });

// Oxygen atom — large red sphere at center
var oxygen = new Zdog.Shape({
  addTo: molecule,
  stroke: 56,
  color: PALETTE[2] || '#e84545',
});

// Hydrogen atom 1 — top-left, smaller blue sphere
var h1Pos = { x: -28, y: -22, z: 8 };
var hydrogen1 = new Zdog.Shape({
  addTo: molecule,
  translate: h1Pos,
  stroke: 36,
  color: PALETTE[4] || '#f0ece0',
});

// Hydrogen atom 2 — top-right, smaller blue sphere
var h2Pos = { x: 28, y: -22, z: -8 };
var hydrogen2 = new Zdog.Shape({
  addTo: molecule,
  translate: h2Pos,
  stroke: 36,
  color: PALETTE[4] || '#f0ece0',
});

// Bond 1: oxygen → hydrogen1 (cylinder)
var bond1 = new Zdog.Cylinder({
  addTo: molecule,
  diameter: 6,
  length: 22,
  translate: { x: h1Pos.x * 0.45, y: h1Pos.y * 0.45, z: h1Pos.z * 0.45 },
  rotate: { z: 0.65, x: -0.2 },
  stroke: 1,
  color: PALETTE[3] || '#16a34a',
  backface: PALETTE[3] || '#16a34a',
});

// Bond 2: oxygen → hydrogen2 (cylinder)
var bond2 = new Zdog.Cylinder({
  addTo: molecule,
  diameter: 6,
  length: 22,
  translate: { x: h2Pos.x * 0.45, y: h2Pos.y * 0.45, z: h2Pos.z * 0.45 },
  rotate: { z: -0.65, x: 0.2 },
  stroke: 1,
  color: PALETTE[3] || '#16a34a',
  backface: PALETTE[3] || '#16a34a',
});

// Electron cloud ring 1 — tilted ellipse orbit around oxygen
new Zdog.Ellipse({
  addTo: molecule,
  diameter: 70,
  stroke: 1.5,
  color: PALETTE[3] || '#2563eb',
  rotate: { x: Zdog.TAU / 3.5, y: 0.4 },
});

// Electron cloud ring 2 — perpendicular ellipse
new Zdog.Ellipse({
  addTo: molecule,
  diameter: 70,
  stroke: 1.5,
  color: PALETTE[3] || '#2563eb',
  rotate: { x: Zdog.TAU / 3.5, y: -0.8 },
});

// Tiny electron dots orbiting (4 dots on ring paths)
var electrons = [];
for (var i = 0; i < 4; i++) {
  var eOrbit = new Zdog.Anchor({
    addTo: molecule,
    rotate: { x: Zdog.TAU / 3.5, y: i < 2 ? 0.4 : -0.8 },
  });
  var dot = new Zdog.Shape({
    addTo: eOrbit,
    translate: { x: 35 },
    stroke: 6,
    color: PALETTE[3] || '#60a5fa',
  });
  electrons.push({ anchor: eOrbit, startAngle: (i % 2) * Math.PI });
}

// Label (HTML overlay)
var label = document.createElement('div');
label.textContent = 'H\\u2082O';
label.style.cssText = 'position:absolute;bottom:60px;width:100%;text-align:center;' +
  'font-family:' + FONT + ',sans-serif;font-size:48px;font-weight:700;' +
  'color:' + (PALETTE[4] || '#f0ece0') + ';letter-spacing:8px;opacity:0;' +
  'text-shadow:0 0 30px ' + (PALETTE[2] || '#e84545') + '40;';
document.body.appendChild(label);

// GSAP animation
var sceneState = { t: 0 };
window.__tl.to(sceneState, {
  t: DURATION,
  duration: DURATION,
  ease: 'none',
  onUpdate: function() {
    var t = sceneState.t;
    var p = t / DURATION;

    // Slow spin of entire molecule
    molecule.rotate.y = 0.3 + t * 0.4;
    molecule.rotate.x = -0.25 + Math.sin(t * 0.3) * 0.15;

    // Electrons orbit
    for (var i = 0; i < electrons.length; i++) {
      var e = electrons[i];
      var a = e.startAngle + t * (1.5 + i * 0.3);
      e.anchor.children[0].translate.x = Math.cos(a) * 35;
      e.anchor.children[0].translate.y = Math.sin(a) * 35;
    }

    // Gentle bob of hydrogens
    hydrogen1.translate.y = h1Pos.y + Math.sin(t * 1.5) * 2;
    hydrogen2.translate.y = h2Pos.y + Math.sin(t * 1.5 + 1) * 2;

    // Fade in label
    label.style.opacity = p > 0.15 ? Math.min(1, (p - 0.15) / 0.15) : 0;

    illo.updateRenderGraph();
  },
}, 0);
`,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. AI Layer Features Showcase
  // ═══════════════════════════════════════════════════════════════════════════
  const imageTestScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'AI Layer Showcase',
    sceneType: 'canvas2d',
    prompt: 'Showcase of AI layer features: animations, filters, positioning, cropping',
    duration: 12,
    bgColor: '#0f0f1a',
    canvasCode: `
const ctx = document.getElementById('c').getContext('2d');
const W = 1920, H = 1080;

animate((p) => {
  ctx.clearRect(0, 0, W, H);

  // Dark gradient background
  const grad = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, 900);
  grad.addColorStop(0, '#1a1a3e');
  grad.addColorStop(1, '#0a0a15');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Animated grid lines
  ctx.strokeStyle = 'rgba(79,156,247,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Title
  const titleAlpha = Math.min(1, p * 4);
  ctx.globalAlpha = titleAlpha;
  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('AI Layer Features', W / 2, 80);

  // Labels for each demo
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#4f9cf7';
  ctx.textAlign = 'center';

  const labelAlpha = Math.max(0, Math.min(1, (p - 0.15) * 4));
  ctx.globalAlpha = labelAlpha;
  ctx.fillText('Scale In', 280, 190);
  ctx.fillText('Slide Up + Filter', 700, 190);
  ctx.fillText('Spin In', 1120, 190);
  ctx.fillText('Fade In + Rotate', 1540, 190);

  const label2Alpha = Math.max(0, Math.min(1, (p - 0.5) * 3));
  ctx.globalAlpha = label2Alpha;
  ctx.fillText('Cropped', 280, 670);
  ctx.fillText('Grayscale Filter', 700, 670);
  ctx.fillText('Blur + Bright', 1120, 670);
  ctx.fillText('Drop Shadow', 1540, 670);

  ctx.globalAlpha = 1;
}, 0);
`,
    aiLayers: [
      // ── Row 1: Animation demos ──────────────────────────────────────────
      {
        id: 'demo-scale-in',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 280,
        y: 390,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Scale In Demo',
        startAt: 0.5,
        animation: { type: 'scale-in' as const, duration: 0.8, delay: 0.5, easing: 'ease-out' },
      },
      {
        id: 'demo-slide-up-filter',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 700,
        y: 390,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Slide Up + Sepia',
        startAt: 0,
        animation: { type: 'slide-up' as const, duration: 0.6, delay: 1.0, easing: 'ease-out' },
        filter: 'sepia(0.6) contrast(1.1)',
      },
      {
        id: 'demo-spin-in',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 1120,
        y: 390,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Spin In Demo',
        startAt: 0,
        animation: { type: 'spin-in' as const, duration: 1.0, delay: 1.5, easing: 'ease-out' },
      },
      {
        id: 'demo-fade-rotate',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 1540,
        y: 390,
        width: 300,
        height: 300,
        rotation: 12,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Fade + Rotated',
        startAt: 0,
        animation: { type: 'fade-in' as const, duration: 1.2, delay: 2.0, easing: 'ease-in-out' },
      },

      // ── Row 2: Filter & crop demos ──────────────────────────────────────
      {
        id: 'demo-crop',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 280,
        y: 870,
        width: 300,
        height: 200,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Cropped Face',
        startAt: 0,
        animation: { type: 'fade-in' as const, duration: 0.5, delay: 3.0, easing: 'ease-out' },
        cropX: 50,
        cropY: 25,
      } as any,
      {
        id: 'demo-grayscale',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 700,
        y: 870,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Grayscale',
        startAt: 0,
        animation: { type: 'slide-left' as const, duration: 0.6, delay: 3.5, easing: 'ease-out' },
        filter: 'grayscale(1) contrast(1.2)',
      },
      {
        id: 'demo-blur-bright',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 1120,
        y: 870,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Blur + Brightness',
        startAt: 0,
        animation: { type: 'slide-right' as const, duration: 0.6, delay: 4.0, easing: 'ease-out' },
        filter: 'blur(2px) brightness(1.4)',
      },
      {
        id: 'demo-shadow',
        type: 'image' as const,
        prompt: '',
        model: 'flux-schnell' as const,
        style: null,
        imageUrl: '/uploads/test-photo.jpg',
        x: 1540,
        y: 870,
        width: 300,
        height: 300,
        rotation: -5,
        opacity: 1,
        zIndex: 10,
        status: 'ready' as const,
        label: 'Drop Shadow',
        startAt: 0,
        animation: { type: 'scale-in' as const, duration: 0.7, delay: 4.5, easing: 'ease-out' },
        filter: 'drop-shadow(8px 8px 16px rgba(79,156,247,0.5))',
      },
    ],
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Motion + CenchMotion — "SaaS Metrics Dashboard"
  //    Showcases: textReveal (5 styles), countUp, progressBar, fadeUp,
  //    staggerIn, scaleIn, highlightReveal, flipReveal, floatIn
  // ═══════════════════════════════════════════════════════════════════════════
  const cenchMotionScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'CenchMotion — Elements',
    sceneType: 'motion',
    prompt: 'SaaS metrics dashboard showcasing all CenchMotion animation components',
    bgColor: '#0d0f1a',
    duration: 14,
    sceneStyles: `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', 'Helvetica Neue', sans-serif; color: #e0e0e0; }
      #layout { display: flex; flex-direction: column; width: 100%; height: 100vh; padding: 3% 4%; gap: 2%; }

      .title-row { text-align: center; }
      #main-title { font-size: clamp(28px, 4.5vw, 64px); font-weight: 800; color: #fff; }
      #subtitle { font-size: clamp(14px, 2vw, 28px); color: #6b6b7a; margin-top: 4px; }

      .metrics-row { display: flex; gap: 2%; justify-content: center; }
      .metric-card {
        flex: 1; max-width: 25%; background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
        padding: 3% 2%; text-align: center;
      }
      .metric-value { font-size: clamp(24px, 3.5vw, 56px); font-weight: 800; }
      .metric-label { font-size: clamp(10px, 1.2vw, 18px); color: #6b6b7a; margin-top: 4px; }
      #revenue .metric-value { color: #22c55e; }
      #users .metric-value { color: #4f9cf7; }
      #growth .metric-value { color: #f59e0b; }
      #nps .metric-value { color: #a78bfa; }

      .progress-row { display: flex; gap: 3%; align-items: center; padding: 0 2%; }
      .progress-group { flex: 1; }
      .progress-label { font-size: clamp(10px, 1.1vw, 16px); color: #9ca3af; margin-bottom: 6px; }
      .progress-track { height: clamp(8px, 1vw, 16px); background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
      .progress-fill { height: 100%; border-radius: 99px; }
      #bar-q1 .progress-fill { background: #22c55e; }
      #bar-q2 .progress-fill { background: #4f9cf7; }
      #bar-q3 .progress-fill { background: #f59e0b; }

      .features-row { display: flex; gap: 2%; justify-content: center; }
      .feature-card {
        flex: 1; max-width: 20%; background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06); border-radius: 12px;
        padding: 2%; text-align: center;
      }
      .feature-icon { font-size: clamp(24px, 3vw, 48px); margin-bottom: 6px; }
      .feature-name { font-size: clamp(11px, 1.2vw, 18px); font-weight: 600; }
      .feature-desc { font-size: clamp(9px, 1vw, 14px); color: #6b6b7a; margin-top: 4px; }

      .bottom-row { display: flex; gap: 3%; justify-content: center; align-items: center; }
      .highlight-text { font-size: clamp(14px, 2vw, 28px); font-weight: 600; }
      .cta-card {
        background: linear-gradient(135deg, #4f9cf7 0%, #a78bfa 100%);
        border-radius: 12px; padding: 1.5% 3%; text-align: center;
      }
      .cta-text { font-size: clamp(12px, 1.4vw, 22px); font-weight: 700; color: #fff; }

      .footer { text-align: center; font-size: clamp(9px, 0.9vw, 14px); color: #3a3a4a; }
    `,
    sceneHTML: `
      <div id="layout">
        <div class="title-row">
          <div id="main-title">Acme Analytics Dashboard</div>
          <div id="subtitle">Real-time SaaS metrics — Q4 2025</div>
        </div>

        <div class="metrics-row">
          <div class="metric-card" id="revenue">
            <div class="metric-value" id="revenue-val">$0</div>
            <div class="metric-label">Annual Revenue</div>
          </div>
          <div class="metric-card" id="users">
            <div class="metric-value" id="users-val">0</div>
            <div class="metric-label">Active Users</div>
          </div>
          <div class="metric-card" id="growth">
            <div class="metric-value" id="growth-val">0%</div>
            <div class="metric-label">YoY Growth</div>
          </div>
          <div class="metric-card" id="nps">
            <div class="metric-value" id="nps-val">0</div>
            <div class="metric-label">NPS Score</div>
          </div>
        </div>

        <div class="progress-row">
          <div class="progress-group" id="bar-q1">
            <div class="progress-label">Q1 Target: 78%</div>
            <div class="progress-track"><div class="progress-fill"></div></div>
          </div>
          <div class="progress-group" id="bar-q2">
            <div class="progress-label">Q2 Target: 92%</div>
            <div class="progress-track"><div class="progress-fill"></div></div>
          </div>
          <div class="progress-group" id="bar-q3">
            <div class="progress-label">Q3 Target: 64%</div>
            <div class="progress-track"><div class="progress-fill"></div></div>
          </div>
        </div>

        <div class="features-row">
          <div class="feature-card" id="feat-1">
            <div class="feature-icon">&#x1F680;</div>
            <div class="feature-name">Fast Deploy</div>
            <div class="feature-desc">Ship in minutes</div>
          </div>
          <div class="feature-card" id="feat-2">
            <div class="feature-icon">&#x1F512;</div>
            <div class="feature-name">Secure</div>
            <div class="feature-desc">SOC 2 compliant</div>
          </div>
          <div class="feature-card" id="feat-3">
            <div class="feature-icon">&#x1F4CA;</div>
            <div class="feature-name">Analytics</div>
            <div class="feature-desc">Real-time insights</div>
          </div>
          <div class="feature-card" id="feat-4">
            <div class="feature-icon">&#x1F310;</div>
            <div class="feature-name">Global CDN</div>
            <div class="feature-desc">Edge everywhere</div>
          </div>
        </div>

        <div class="bottom-row">
          <div class="highlight-text" id="highlight-line">Trusted by 2,400+ companies worldwide</div>
          <div class="cta-card" id="cta">
            <div class="cta-text">Start Free Trial</div>
          </div>
        </div>

        <div class="footer">CENCHMOTION TEST — textReveal · countUp · progressBar · staggerIn · scaleIn · highlightReveal · flipReveal · floatIn</div>
      </div>
    `,
    sceneCode: `
      var tl = window.__tl;

      // 1. textReveal — 'mask' style (cinematic word reveal)
      CenchMotion.textReveal('#main-title', { style: 'mask', tl: tl, delay: 0.3, duration: 0.8 });

      // 2. textReveal — 'typewriter' style
      CenchMotion.textReveal('#subtitle', { style: 'typewriter', tl: tl, delay: 1.2 });

      // 3. staggerIn — metric cards float in from bottom
      CenchMotion.staggerIn('.metric-card', { tl: tl, delay: 2.5, stagger: 0.15, direction: 'up', duration: 0.6 });

      // 4. countUp — four different formats
      CenchMotion.countUp('#revenue-val', { to: 2400000, format: ',.0f', prefix: '$', tl: tl, delay: 3.2, duration: 2 });
      CenchMotion.countUp('#users-val', { to: 184000, format: '.2s', tl: tl, delay: 3.4, duration: 1.8 });
      CenchMotion.countUp('#growth-val', { to: 47, suffix: '%', tl: tl, delay: 3.6, duration: 1.5 });
      CenchMotion.countUp('#nps-val', { to: 72, tl: tl, delay: 3.8, duration: 1.5 });

      // 5. progressBar — three bars animate to different widths
      CenchMotion.progressBar('#bar-q1 .progress-fill', { to: 78, tl: tl, delay: 5.5, duration: 1 });
      CenchMotion.progressBar('#bar-q2 .progress-fill', { to: 92, tl: tl, delay: 5.8, duration: 1 });
      CenchMotion.progressBar('#bar-q3 .progress-fill', { to: 64, tl: tl, delay: 6.1, duration: 1 });

      // 6. flipReveal — feature cards flip in on Y axis
      CenchMotion.flipReveal('.feature-card', { axis: 'Y', tl: tl, delay: 7.5, stagger: 0.15, duration: 0.7 });

      // 7. highlightReveal — text highlight with yellow marker
      CenchMotion.highlightReveal('#highlight-line', { color: '#FFE066', style: 'background', tl: tl, delay: 9.5, duration: 0.8 });

      // 8. floatIn — CTA card bounces in from right
      CenchMotion.floatIn('#cta', { direction: 'right', distance: 120, tl: tl, delay: 10.5, duration: 0.8 });

      // 9. fadeUp — footer
      CenchMotion.fadeUp('.footer', { tl: tl, delay: 11.5, duration: 0.6 });
    `,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Motion + CenchMotion — "SVG Plugin Showcase"
  //     Uses motion type (which executes sceneCode) with inline SVG in HTML.
  //     Showcases: drawPath, morphShape, scaleIn, slideIn, pathFollow
  // ═══════════════════════════════════════════════════════════════════════════
  const cenchMotionSVGScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'CenchMotion — SVG Plugins',
    sceneType: 'motion',
    prompt: 'SVG drawing showcase with drawPath, morphShape, pathFollow, and text animations',
    bgColor: '#0a0e1a',
    duration: 14,
    sceneStyles: `
      #canvas { width: 100%; height: 100vh; }
      #canvas svg { width: 100%; height: 100%; display: block; }
    `,
    sceneHTML: `
      <div id="canvas">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
          <defs>
            <path id="shape-star" d="M 960,420 L 990,500 1080,500 1008,550 1032,630 960,585 888,630 912,550 840,500 930,500 Z"/>
          </defs>
          <text id="svg-title" x="960" y="90" font-family="Inter, sans-serif" font-size="56" font-weight="800" fill="#ffffff" text-anchor="middle">SVG Plugin Showcase</text>
          <text id="svg-subtitle" x="960" y="140" font-family="Inter, sans-serif" font-size="24" fill="#6b6b7a" text-anchor="middle">DrawSVG &#xB7; MorphSVG &#xB7; MotionPath — all free in GSAP 3.14</text>
          <text id="draw-label" x="300" y="220" font-family="Inter, sans-serif" font-size="20" font-weight="600" fill="#9ca3af" text-anchor="middle">drawPath + scaleIn</text>
          <path id="circuit-1" d="M 100,250 L 300,250 L 300,400 L 500,400" stroke="#4f9cf7" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path id="circuit-2" d="M 100,300 L 250,300 L 250,500 L 500,500" stroke="#22c55e" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path id="circuit-3" d="M 100,350 L 200,350 L 200,600 L 500,600" stroke="#f59e0b" stroke-width="3" fill="none" stroke-linecap="round"/>
          <circle id="dot-1" cx="500" cy="400" r="8" fill="#4f9cf7"/>
          <circle id="dot-2" cx="500" cy="500" r="8" fill="#22c55e"/>
          <circle id="dot-3" cx="500" cy="600" r="8" fill="#f59e0b"/>
          <text id="morph-label" x="960" y="380" font-family="Inter, sans-serif" font-size="20" font-weight="600" fill="#9ca3af" text-anchor="middle">morphShape: circle &#x2192; star</text>
          <path id="morph-shape" d="M 960,540 m -120,0 a 120,120 0 1,0 240,0 a 120,120 0 1,0 -240,0" fill="none" stroke="#a78bfa" stroke-width="4"/>
          <path id="flow-track" d="M 200,800 C 500,750 700,400 960,350 C 1220,300 1400,500 1700,300" stroke="rgba(255,255,255,0.08)" stroke-width="2" fill="none" stroke-dasharray="8 4"/>
          <circle id="flow-dot" cx="200" cy="800" r="10" fill="#e84545"/>
          <text id="flow-label" x="960" y="870" font-family="Inter, sans-serif" font-size="20" font-weight="600" fill="#9ca3af" text-anchor="middle">pathFollow along curve</text>
          <text id="slide-label" x="1600" y="420" font-family="Inter, sans-serif" font-size="20" font-weight="600" fill="#9ca3af" text-anchor="middle">slideIn from right</text>
          <g id="slide-1"><rect x="1400" y="450" width="400" height="50" rx="8" fill="rgba(79,156,247,0.15)" stroke="#4f9cf7" stroke-width="1"/><text x="1600" y="482" font-family="Inter, sans-serif" font-size="18" fill="#4f9cf7" text-anchor="middle">Pipeline Stage 1</text></g>
          <g id="slide-2"><rect x="1400" y="520" width="400" height="50" rx="8" fill="rgba(34,197,94,0.15)" stroke="#22c55e" stroke-width="1"/><text x="1600" y="552" font-family="Inter, sans-serif" font-size="18" fill="#22c55e" text-anchor="middle">Pipeline Stage 2</text></g>
          <g id="slide-3"><rect x="1400" y="590" width="400" height="50" rx="8" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" stroke-width="1"/><text x="1600" y="622" font-family="Inter, sans-serif" font-size="18" fill="#f59e0b" text-anchor="middle">Pipeline Stage 3</text></g>
          <g id="slide-4"><rect x="1400" y="660" width="400" height="50" rx="8" fill="rgba(167,139,250,0.15)" stroke="#a78bfa" stroke-width="1"/><text x="1600" y="692" font-family="Inter, sans-serif" font-size="18" fill="#a78bfa" text-anchor="middle">Pipeline Stage 4</text></g>
          <text id="svg-footer" x="960" y="1050" font-family="Inter, sans-serif" font-size="14" fill="#3a3a4a" text-anchor="middle">CENCHMOTION SVG TEST — drawPath &#xB7; morphShape &#xB7; pathFollow &#xB7; scaleIn &#xB7; slideIn</text>
        </svg>
      </div>
    `,
    sceneCode: `
      var tl = window.__tl;

      // 1. textReveal — title with char stagger
      CenchMotion.textReveal('#svg-title', { style: 'chars', tl: tl, delay: 0.2, stagger: 0.02 });

      // 2. textReveal — subtitle with word stagger
      CenchMotion.textReveal('#svg-subtitle', { style: 'words', tl: tl, delay: 1.0 });

      // 3. fadeUp — section labels
      CenchMotion.fadeUp('#draw-label', { tl: tl, delay: 1.8 });
      CenchMotion.fadeUp('#morph-label', { tl: tl, delay: 5.0 });
      CenchMotion.fadeUp('#flow-label', { tl: tl, delay: 8.0 });
      CenchMotion.fadeUp('#slide-label', { tl: tl, delay: 9.5 });

      // 4. drawPath — three circuit board lines draw sequentially
      CenchMotion.drawPath('#circuit-1', { tl: tl, delay: 2.0, duration: 1.0 });
      CenchMotion.drawPath('#circuit-2', { tl: tl, delay: 2.4, duration: 1.0 });
      CenchMotion.drawPath('#circuit-3', { tl: tl, delay: 2.8, duration: 1.0 });

      // 5. scaleIn — endpoint dots pop in after lines finish
      CenchMotion.scaleIn('#dot-1', { tl: tl, delay: 3.2 });
      CenchMotion.scaleIn('#dot-2', { tl: tl, delay: 3.5 });
      CenchMotion.scaleIn('#dot-3', { tl: tl, delay: 3.8 });

      // 6. morphShape — circle morphs into star
      CenchMotion.drawPath('#morph-shape', { tl: tl, delay: 5.5, duration: 1.2 });
      CenchMotion.morphShape('#morph-shape', { to: '#shape-star', tl: tl, delay: 7.0, duration: 1.5 });

      // 7. pathFollow — red dot follows the flow curve
      CenchMotion.pathFollow('#flow-dot', { path: '#flow-track', tl: tl, delay: 8.5, duration: 2.5, autoRotate: false });

      // 8. slideIn — pipeline stages slide in from right with stagger
      CenchMotion.slideIn('#slide-1', { from: 'right', distance: 500, tl: tl, delay: 10.0, duration: 0.6 });
      CenchMotion.slideIn('#slide-2', { from: 'right', distance: 500, tl: tl, delay: 10.3, duration: 0.6 });
      CenchMotion.slideIn('#slide-3', { from: 'right', distance: 500, tl: tl, delay: 10.6, duration: 0.6 });
      CenchMotion.slideIn('#slide-4', { from: 'right', distance: 500, tl: tl, delay: 10.9, duration: 0.6 });

      // 9. fadeUp — footer
      CenchMotion.fadeUp('#svg-footer', { tl: tl, delay: 12.0 });
    `,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Avatar Test — TalkingHead with lip sync, playback sync, settings panel
  // ═══════════════════════════════════════════════════════════════════════════
  const speechText =
    'Hello! I am the avatar test. Watch my mouth move as I speak. I can change moods and do gestures too.'
  const avatarTestScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'Avatar Test — Lip Sync + Controls',
    sceneType: 'canvas2d',
    prompt: 'Avatar with lip sync, playback sync, mood/gesture controls, and settings panel',
    duration: 12,
    bgColor: '#1a1a2e',
    canvasCode: `
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const rand = mulberry32(42);

const particles = Array.from({ length: 30 }, () => ({
  x: rand() * WIDTH, y: rand() * HEIGHT,
  r: 2 + rand() * 4, speed: 0.3 + rand() * 0.6,
  phase: rand() * Math.PI * 2,
  color: PALETTE[Math.floor(rand() * PALETTE.length)],
}));

function render(t) {
  const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  g.addColorStop(0, '#1a1a2e');
  g.addColorStop(0.5, '#16213e');
  g.addColorStop(1, '#0f3460');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  particles.forEach(p => {
    const x = p.x + Math.sin(t * p.speed + p.phase) * 30;
    const y = p.y + Math.cos(t * p.speed * 0.7 + p.phase) * 20;
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 2 + p.phase);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.globalAlpha = Math.min(1, t / 1.5);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Avatar Test', WIDTH / 2, 180);
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Lip sync · Playback sync · Settings panel · Gestures', WIDTH / 2, 230);
  ctx.globalAlpha = 1;

  // Status panel
  const boxAlpha = Math.min(1, Math.max(0, (t - 1) / 1));
  ctx.globalAlpha = boxAlpha;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const bx = 100, by = 300, bw = 700, bh = 420;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '20px system-ui';
  ctx.textAlign = 'left';
  [
    'Narration: 4 lines with mood changes + gestures',
    'Line 1: wave + happy → "Hello! I am the avatar test"',
    'Line 2: lookAt(0.3, 0.5) → lip sync explanation',
    'Line 3: surprise + handup → mood change demo',
    'Line 4: happy + thumbup → gesture demo',
    'Playback: speaks on play, stops on pause, restarts',
    'Fallback: server TTS → browser SpeechSynthesis',
    'Placement: PIP bottom-right, circle, 280px',
    'View: upper | Eye contact: 0.7 | Head movement: on',
  ].forEach((line, i) => ctx.fillText(line, bx + 30, by + 45 + i * 42));
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

if (window.__tl) {
  const proxy = { t: 0 };
  window.__tl.to(proxy, { t: DURATION, duration: DURATION, ease: 'none', onUpdate: () => render(proxy.t) }, 0);
}
render(0);
`,
    audioLayer: {
      enabled: true,
      src: null,
      volume: 1,
      fadeIn: false,
      fadeOut: false,
      startOffset: 0,
      tts: null,
    },
    aiLayers: [
      {
        id: uuidv4(),
        type: 'avatar' as const,
        avatarId: '',
        voiceId: '',
        script: speechText,
        removeBackground: false,
        x: 1640,
        y: 800,
        width: 280,
        height: 280,
        opacity: 1,
        zIndex: 100,
        videoUrl: null,
        thumbnailUrl: null,
        status: 'ready' as const,
        heygenVideoId: null,
        estimatedDuration: 12,
        startAt: 0,
        label: 'Avatar Narrator',
        avatarPlacement: 'pip_bottom_right',
        avatarProvider: 'talkinghead',
        talkingHeadUrl: `talkinghead://render?text=${encodeURIComponent(speechText)}&audio=&character=friendly`,
        narrationScript: {
          mood: 'happy' as const,
          view: 'upper' as const,
          lipsyncHeadMovement: true,
          eyeContact: 0.7,
          position: 'pip_bottom_right' as const,
          pipSize: 280,
          pipShape: 'circle' as const,
          enterAt: 0,
          entranceAnimation: 'fade' as const,
          lines: [
            {
              text: 'Hello! I am the avatar test scene.',
              mood: 'happy' as const,
              gesture: 'wave' as const,
              lookCamera: true,
            },
            {
              text: 'Watch my mouth move as I speak. The lip sync drives from the TTS audio.',
              pauseBefore: 300,
              lookAt: { x: 0.3, y: 0.5 },
            },
            {
              text: 'I can change moods too. This is my surprised face!',
              mood: 'surprise' as const,
              gesture: 'handup' as const,
              pauseBefore: 200,
              lookCamera: true,
            },
            {
              text: 'And gestures — like a thumbs up for good work.',
              mood: 'happy' as const,
              gesture: 'thumbup' as const,
              pauseBefore: 200,
            },
          ],
        },
      } as any,
    ],
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: Three.js r183 — "Office Desk Scene" (showcases new features)
  // ═══════════════════════════════════════════════════════════════════════════
  const threeR183Scene: Scene = {
    ...base(),
    id: uuidv4(),
    name: '3D Office Desk (r183)',
    sceneType: 'three',
    prompt:
      'Office desk with laptop, chair, and floating UI elements — showcases r183 ES modules, setupEnvironment, GLTFLoader, and proper PBR lighting',
    bgColor: '#1a1a2e',
    duration: 10,
    sceneCode: `
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const { WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment } = window;

// ── Renderer ──────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor('#1a1a2e');
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(4, 3.5, 6);
camera.lookAt(0, 0.8, 0);

// ── Studio environment map (procedural) ───────────────────────────────────
setupEnvironment(scene, renderer);

// ── 3-point lighting with shadows ─────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.25);

const key = new THREE.DirectionalLight(0xfff6e0, 1.6);
key.position.set(-5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 30;
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
key.shadow.bias = -0.001;

const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
fill.position.set(6, 2, 4);

const rim = new THREE.DirectionalLight(0xffe0d0, 0.6);
rim.position.set(0, 4, -9);

scene.add(ambient, key, fill, rim);

// ── Floor ─────────────────────────────────────────────────────────────────
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.9, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

// ── Grid overlay on floor ─────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(20, 40, 0x3a3a5e, 0x2d2d48);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// ── Procedural desk ──────────────────────────────────────────────────────
const deskGroup = new THREE.Group();

// Desktop surface
const desktop = new THREE.Mesh(
  new THREE.BoxGeometry(3, 0.08, 1.5),
  MATERIALS.matte(PALETTE[0])
);
desktop.position.y = 1.0;
desktop.castShadow = true;
desktop.receiveShadow = true;
deskGroup.add(desktop);

// Legs
const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8);
const legMat = MATERIALS.metal(PALETTE[1]);
[[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]].forEach(([x, z]) => {
  const leg = new THREE.Mesh(legGeo, legMat);
  leg.position.set(x, 0.5, z);
  leg.castShadow = true;
  deskGroup.add(leg);
});

scene.add(deskGroup);

// ── Load 3D models from library ──────────────────────────────────────────
const loader = new GLTFLoader();
const baseUrl = window.location.origin || 'http://localhost:3000';

// Laptop on the desk
loader.load(baseUrl + '/models/library/tech/laptop.glb', (gltf) => {
  const laptop = gltf.scene;
  laptop.scale.setScalar(0.8);
  laptop.position.set(-0.3, 1.05, 0);
  laptop.rotation.y = 0.2;
  laptop.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material = child.material.clone();
        child.material.roughness = 0.4;
        child.material.metalness = 0.6;
      }
    }
  });
  scene.add(laptop);
}, undefined, () => {
  // Fallback: procedural laptop
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.03, 0.5),
    MATERIALS.metal(PALETTE[1])
  );
  base.position.set(-0.3, 1.06, 0);
  base.castShadow = true;
  scene.add(base);

  const screenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE[2]),
    emissive: new THREE.Color(PALETTE[2]),
    emissiveIntensity: 0.3,
    roughness: 0.1,
    metalness: 0.8,
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.02), screenMat);
  screen.position.set(-0.3, 1.35, -0.2);
  screen.rotation.x = -0.15;
  screen.castShadow = true;
  scene.add(screen);
});

// Chair model
loader.load(baseUrl + '/models/library/business/office-chair.glb', (gltf) => {
  const chair = gltf.scene;
  chair.scale.setScalar(0.7);
  chair.position.set(0, 0, 1.8);
  chair.rotation.y = Math.PI + 0.3;
  chair.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(chair);
}, undefined, () => {
  // Fallback: simple chair shape
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.05, 0.5),
    MATERIALS.matte(PALETTE[0])
  );
  seat.position.set(0, 0.6, 1.8);
  seat.castShadow = true;
  scene.add(seat);
});

// ── Floating holographic UI panels ────────────────────────────────────────
const panels = [];
const panelData = [
  { w: 0.9, h: 0.6, x: 0.8, y: 2.0, z: -0.3, ry: -0.3 },
  { w: 0.5, h: 0.4, x: 1.6, y: 1.8, z: 0.1, ry: -0.5 },
  { w: 0.6, h: 0.35, x: -1.5, y: 1.9, z: -0.2, ry: 0.4 },
];
const rand = mulberry32(7);

panelData.forEach((p, i) => {
  const panelGroup = new THREE.Group();

  // Glass panel
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(p.w, p.h),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(PALETTE[2]),
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.8,
      side: THREE.DoubleSide,
    })
  );
  panelGroup.add(panel);

  // Glowing border
  const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(p.w, p.h));
  const borderMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(PALETTE[2]),
    transparent: true,
    opacity: 0.7,
  });
  panelGroup.add(new THREE.LineSegments(borderGeo, borderMat));

  // Fake text lines
  for (let j = 0; j < 3; j++) {
    const lineW = 0.15 + rand() * (p.w * 0.5);
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(lineW, 0.02),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE[3]),
        transparent: true,
        opacity: 0.5,
      })
    );
    line.position.set(-p.w * 0.3 + lineW * 0.5, p.h * 0.25 - j * 0.08, 0.001);
    panelGroup.add(line);
  }

  panelGroup.position.set(p.x, p.y, p.z);
  panelGroup.rotation.y = p.ry;
  scene.add(panelGroup);
  panels.push({ group: panelGroup, baseY: p.y, phase: i * 2.1 });
});

// ── Particle dust ─────────────────────────────────────────────────────────
const dustCount = 200;
const dustPositions = new Float32Array(dustCount * 3);
const dustRand = mulberry32(99);
for (let i = 0; i < dustCount; i++) {
  dustPositions[i * 3] = (dustRand() - 0.5) * 10;
  dustPositions[i * 3 + 1] = dustRand() * 5;
  dustPositions[i * 3 + 2] = (dustRand() - 0.5) * 10;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  size: 0.03,
  color: new THREE.Color(PALETTE[2]),
  transparent: true,
  opacity: 0.4,
}));
scene.add(dust);

// ── Animation loop ────────────────────────────────────────────────────────
const startTime = performance.now();

function animate() {
  const t = (performance.now() - startTime) / 1000;
  if (t > DURATION) return;

  // Camera slow orbit
  const angle = t * 0.12;
  camera.position.x = 4 * Math.cos(angle) + Math.sin(t * 0.08) * 0.5;
  camera.position.z = 6 * Math.sin(angle);
  camera.position.y = 3.5 + Math.sin(t * 0.15) * 0.3;
  camera.lookAt(0, 0.8, 0);

  // Float the holographic panels
  panels.forEach((p) => {
    p.group.position.y = p.baseY + Math.sin(t * 0.8 + p.phase) * 0.06;
  });

  // Slowly drift dust
  const pos = dust.geometry.attributes.position;
  for (let i = 0; i < dustCount; i++) {
    pos.array[i * 3 + 1] += 0.001;
    if (pos.array[i * 3 + 1] > 5) pos.array[i * 3 + 1] = 0;
  }
  pos.needsUpdate = true;

  // Rotate grid subtly
  gridHelper.rotation.y = t * 0.01;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
renderer.render(scene, camera);
requestAnimationFrame(animate);
`,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. Physics — "Physics Simulations Showcase"
  // ═══════════════════════════════════════════════════════════════════════════
  const physicsScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'Physics Simulations',
    sceneType: 'physics',
    prompt:
      'Showcase of 4 physics simulations: pendulum, double pendulum, projectile, and harmonic oscillator running simultaneously',
    bgColor: '#0a0e1a',
    duration: 20,
    sceneHTML: `<div style="width:1920px;height:1080px;position:relative;overflow:hidden;">
  <!-- Title bar -->
  <div id="phys-title" style="position:absolute;top:30px;left:0;right:0;text-align:center;z-index:10;font-family:'Inter',sans-serif;pointer-events:none;">
    <div style="font-size:44px;font-weight:700;color:#e2e8f0;letter-spacing:-1px;">Physics Simulation Engine</div>
    <div style="font-size:20px;color:#64748b;margin-top:6px;">Deterministic \u2022 WVC-seekable \u2022 RK4 integration \u2022 120Hz physics</div>
  </div>

  <!-- 2x2 grid of simulations -->
  <div style="display:grid;grid-template-columns:922px 922px;grid-template-rows:462px 462px;gap:16px;padding:110px 30px 30px;width:1920px;height:1080px;box-sizing:border-box;">
    <!-- Pendulum -->
    <div style="position:relative;border-radius:16px;overflow:hidden;background:rgba(15,23,42,0.8);border:1px solid rgba(100,150,255,0.15);">
      <div id="lbl-pend" style="position:absolute;top:12px;left:16px;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;color:#60a5fa;z-index:2;opacity:0;">Simple Pendulum</div>
      <div id="eq-pend" style="position:absolute;bottom:12px;right:16px;font-family:'Inter',sans-serif;font-size:13px;color:#94a3b8;z-index:2;opacity:0;"></div>
      <canvas id="sim-pendulum" width="922" height="462" style="display:block;"></canvas>
    </div>
    <!-- Double Pendulum -->
    <div style="position:relative;border-radius:16px;overflow:hidden;background:rgba(15,23,42,0.8);border:1px solid rgba(255,100,100,0.15);">
      <div id="lbl-double" style="position:absolute;top:12px;left:16px;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;color:#f87171;z-index:2;opacity:0;">Double Pendulum (Chaos)</div>
      <div id="eq-double" style="position:absolute;bottom:12px;right:16px;font-family:'Inter',sans-serif;font-size:13px;color:#94a3b8;z-index:2;opacity:0;"></div>
      <canvas id="sim-double" width="922" height="462" style="display:block;"></canvas>
    </div>
    <!-- Projectile -->
    <div style="position:relative;border-radius:16px;overflow:hidden;background:rgba(15,23,42,0.8);border:1px solid rgba(34,197,94,0.15);">
      <div id="lbl-proj" style="position:absolute;top:12px;left:16px;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;color:#4ade80;z-index:2;opacity:0;">Projectile Motion</div>
      <div id="eq-proj" style="position:absolute;bottom:12px;right:16px;font-family:'Inter',sans-serif;font-size:13px;color:#94a3b8;z-index:2;opacity:0;"></div>
      <canvas id="sim-projectile" width="922" height="462" style="display:block;"></canvas>
    </div>
    <!-- Harmonic Oscillator -->
    <div style="position:relative;border-radius:16px;overflow:hidden;background:rgba(15,23,42,0.8);border:1px solid rgba(249,115,22,0.15);">
      <div id="lbl-shm" style="position:absolute;top:12px;left:16px;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;color:#fb923c;z-index:2;opacity:0;">Damped Harmonic Oscillator</div>
      <div id="eq-shm" style="position:absolute;bottom:12px;right:16px;font-family:'Inter',sans-serif;font-size:13px;color:#94a3b8;z-index:2;opacity:0;"></div>
      <canvas id="sim-shm" width="922" height="462" style="display:block;"></canvas>
    </div>
  </div>

  <!-- Footer -->
  <div style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-family:'Inter',sans-serif;font-size:13px;color:#475569;letter-spacing:3px;text-transform:uppercase;">Physics Scene Type</div>
</div>`,
    sceneCode: `
(function() {
  var c1 = document.getElementById('sim-pendulum');
  var c2 = document.getElementById('sim-double');
  var c3 = document.getElementById('sim-projectile');
  var c4 = document.getElementById('sim-shm');

  if (!c1 || !c2 || !c3 || !c4 || !window.PhysicsSims) { console.error('[PhysicsTest] Missing canvas or PhysicsSims'); return; }

    // ── 1. Simple Pendulum ──
    var pend = new PhysicsSims.PendulumSim(c1, {
      g: 9.8, length: 2, angle: Math.PI / 3, damping: 0.02,
    });
    pend.init();
    PhysicsSims.registerWithTimeline(pend, DURATION, { startAt: 0 });

    // ── 2. Double Pendulum (Chaos) ──
    var doub = new PhysicsSims.DoublePendulumSim(c2, {
      g: 9.8, L1: 1, L2: 1, m1: 1, m2: 1,
      theta1: Math.PI * 0.75, theta2: Math.PI * 0.75 + 0.001,
    });
    doub.init();
    PhysicsSims.registerWithTimeline(doub, DURATION, { startAt: 0 });

    // ── 3. Projectile Motion ──
    var proj = new PhysicsSims.ProjectileSim(c3, {
      v0: 25, angle: Math.PI / 4, g: 9.8, drag: 0,
    });
    proj.init();
    PhysicsSims.registerWithTimeline(proj, DURATION, { startAt: 0 });

    // ── 4. Harmonic Oscillator (underdamped) ──
    var shm = new PhysicsSims.HarmonicOscillatorSim(c4, {
      mass: 1, k: 10, damping: 0.3, x0: 2, v0: 0,
      driving_frequency: 0, driving_amplitude: 0,
    });
    shm.init();
    PhysicsSims.registerWithTimeline(shm, DURATION, { startAt: 0 });

    // ── Parameter change demo: add driving force to SHM at t=10 ──
    shm.scheduleParamChange('driving_amplitude', 0, 5, 10, 2);
    shm.scheduleParamChange('driving_frequency', 0, 3.16, 10, 2);
    shm.precompute(DURATION);

    // ── Animate labels in with GSAP ──
    if (window.__tl) {
      var tl = window.__tl;
      var pairs = [
        ['lbl-pend', 'eq-pend'],
        ['lbl-double', 'eq-double'],
        ['lbl-proj', 'eq-proj'],
        ['lbl-shm', 'eq-shm'],
      ];
      pairs.forEach(function(p, i) {
        var lbl = document.getElementById(p[0]);
        var eq = document.getElementById(p[1]);
        if (lbl) tl.to(lbl, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.3 + i * 0.15);
        if (eq) tl.to(eq, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.8 + i * 0.15);
      });

      // Fade in title
      var title = document.getElementById('phys-title');
      if (title) {
        gsap.set(title, { opacity: 0, y: -15 });
        tl.to(title, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.1);
      }

      // Add "resonance!" callout at t=12 when driving force kicks in
      tl.call(function() {
        var ann = document.createElement('div');
        ann.style.cssText = 'position:absolute;bottom:60px;right:50px;background:rgba(249,115,22,0.9);color:#fff;padding:10px 20px;border-radius:8px;font-family:Inter,sans-serif;font-size:16px;font-weight:600;z-index:20;pointer-events:none;';
        ann.textContent = 'Driving force activated \\u2014 approaching resonance!';
        document.body.appendChild(ann);
        gsap.from(ann, { opacity: 0, x: 30, duration: 0.4 });
        gsap.to(ann, { opacity: 0, delay: 4, duration: 0.4, onComplete: function() { ann.remove(); } });
      }, null, 12);
    }

    // ── Inject equation text from PhysicsEquations database ──
    if (window.PhysicsEquations) {
      var eqs = window.PhysicsEquations;
      var map = {
        'eq-pend': eqs.pendulum_ode,
        'eq-double': eqs.lyapunov_exponent,
        'eq-proj': eqs.projectile_range,
        'eq-shm': eqs.resonance_freq,
      };
      for (var id in map) {
        var el = document.getElementById(id);
        if (el && map[id]) el.textContent = map[id].description;
      }
    }
})();`,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Avatar Glassmorphic — container styling, character select, size controls
  // ═══════════════════════════════════════════════════════════════════════════
  const glassAvatarSpeech =
    'Welcome to the glassmorphic avatar demo. You can change my character, resize my container, and adjust the blur and glow in the layers panel.'
  const glassAvatarScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'Avatar Glass — Container + Character',
    sceneType: 'canvas2d',
    prompt: 'Avatar with glassmorphic container, character selection, size & style controls',
    duration: 15,
    bgColor: '#0f0a1a',
    canvasCode: `
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const rand = mulberry32(99);

// Gradient mesh orbs
const orbs = Array.from({ length: 5 }, () => ({
  x: rand() * WIDTH, y: rand() * HEIGHT,
  r: 200 + rand() * 300,
  vx: (rand() - 0.5) * 0.4,
  vy: (rand() - 0.5) * 0.3,
  color: PALETTE[Math.floor(rand() * PALETTE.length)],
}));

// Floating particles
const dots = Array.from({ length: 50 }, () => ({
  x: rand() * WIDTH, y: rand() * HEIGHT,
  r: 1 + rand() * 2.5, speed: 0.2 + rand() * 0.5,
  phase: rand() * Math.PI * 2,
}));

function render(t) {
  // Deep dark gradient base
  const bg = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.5, 0, WIDTH * 0.5, HEIGHT * 0.5, WIDTH * 0.7);
  bg.addColorStop(0, '#1a1030');
  bg.addColorStop(0.5, '#0f0a1a');
  bg.addColorStop(1, '#050208');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft gradient orbs — lava-lamp feel behind glassmorphic container
  orbs.forEach(o => {
    o.x += o.vx; o.y += o.vy;
    if (o.x < -o.r) o.x = WIDTH + o.r;
    if (o.x > WIDTH + o.r) o.x = -o.r;
    if (o.y < -o.r) o.y = HEIGHT + o.r;
    if (o.y > HEIGHT + o.r) o.y = -o.r;
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    const c = o.color;
    g.addColorStop(0, c + '30');
    g.addColorStop(0.6, c + '10');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
  });

  // Floating particles
  ctx.globalAlpha = 0.5;
  dots.forEach(p => {
    const x = p.x + Math.sin(t * p.speed + p.phase) * 40;
    const y = p.y + Math.cos(t * p.speed * 0.8 + p.phase) * 25;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.2 + 0.3 * Math.sin(t * 1.5 + p.phase);
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Title
  const titleAlpha = Math.min(1, t / 1.2);
  ctx.globalAlpha = titleAlpha;
  ctx.fillStyle = '#f0e6ff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Glassmorphic Avatar', WIDTH / 2, 140);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#a78bfa';
  ctx.fillText('Container style \u00b7 Character select \u00b7 Size & blur controls', WIDTH / 2, 185);
  ctx.globalAlpha = 1;

  // Info card — glassmorphic style
  const cardAlpha = Math.min(1, Math.max(0, (t - 1.5) / 1));
  if (cardAlpha > 0) {
    ctx.globalAlpha = cardAlpha;
    const cx = 80, cy = 260, cw = 740, ch = 520;
    // Glass background
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 20); ctx.fill();
    // Glass border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Inner glow top edge
    const ig = ctx.createLinearGradient(cx, cy, cx, cy + 40);
    ig.addColorStop(0, 'rgba(255,255,255,0.08)');
    ig.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, 40, [20, 20, 0, 0]); ctx.fill();

    ctx.fillStyle = '#e2e0f0';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Layers Panel Controls', cx + 30, cy + 50);

    ctx.font = '17px system-ui';
    ctx.fillStyle = '#c4b5fd';
    [
      'Character: choose Friendly / Professional / Energetic',
      'Container Style section:',
      '  \u2022 Blur — backdrop blur (0\u201340px)',
      '  \u2022 BG opacity — container transparency',
      '  \u2022 Border color + opacity + width',
      '  \u2022 Shadow — drop shadow intensity',
      '  \u2022 Inner glow — soft glow from edges',
      '',
      'Scene Layout section:',
      '  \u2022 Position — PIP corner or fullscreen',
      '  \u2022 PIP size — avatar dimensions (120\u2013500px)',
      '  \u2022 PIP shape — circle / rounded / square',
      '  \u2022 Background color',
      '',
      'Eye contact slider controls gaze tracking',
    ].forEach((line, i) => ctx.fillText(line, cx + 30, cy + 90 + i * 28));
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'start';
}

if (window.__tl) {
  const proxy = { t: 0 };
  window.__tl.to(proxy, { t: DURATION, duration: DURATION, ease: 'none', onUpdate: () => render(proxy.t) }, 0);
}
render(0);
`,
    aiLayers: [
      {
        id: uuidv4(),
        type: 'avatar' as const,
        avatarId: '',
        voiceId: '',
        script: glassAvatarSpeech,
        removeBackground: false,
        x: 1560,
        y: 720,
        width: 320,
        height: 320,
        opacity: 1,
        zIndex: 100,
        videoUrl: null,
        thumbnailUrl: null,
        status: 'ready' as const,
        heygenVideoId: null,
        estimatedDuration: 15,
        startAt: 0,
        label: 'Glass Avatar',
        avatarPlacement: 'pip_bottom_right',
        avatarProvider: 'talkinghead',
        talkingHeadUrl: `talkinghead://render?text=${encodeURIComponent(glassAvatarSpeech)}&audio=&character=professional`,
        narrationScript: {
          mood: 'happy' as const,
          view: 'upper' as const,
          lipsyncHeadMovement: true,
          eyeContact: 0.8,
          position: 'pip_bottom_right' as const,
          pipSize: 320,
          pipShape: 'rounded' as const,
          character: 'professional' as const,
          // Glassmorphic container
          containerBlur: 20,
          containerBorderColor: '#a78bfa',
          containerBorderOpacity: 0.4,
          containerBorderWidth: 2,
          containerShadowOpacity: 0.5,
          containerInnerGlow: 0.6,
          containerBgOpacity: 0.25,
          background: '#6366f1',
          enterAt: 0.5,
          entranceAnimation: 'scale-in' as const,
          lines: [
            {
              text: 'Welcome to the glassmorphic avatar demo!',
              mood: 'happy' as const,
              gesture: 'wave' as const,
              lookCamera: true,
            },
            {
              text: 'You can change my character in the layers panel. Try switching to Friendly or Energetic.',
              pauseBefore: 300,
              lookAt: { x: 0.2, y: 0.5 },
            },
            {
              text: 'Open Container Style to adjust the blur, border glow, and transparency behind me.',
              pauseBefore: 200,
              mood: 'neutral' as const,
              lookCamera: true,
            },
            {
              text: 'You can also resize me, change my shape, and pick any background color. Pretty cool right?',
              mood: 'surprise' as const,
              gesture: 'thumbup' as const,
              pauseBefore: 200,
              lookCamera: true,
            },
          ],
        },
      } as any,
    ],
  }

  return [
    svgScene,
    canvasScene,
    motionScene,
    d3Scene,
    threeScene,
    threeR183Scene,
    lottieScene,
    zdogScene,
    imageTestScene,
    cenchMotionScene,
    cenchMotionSVGScene,
    avatarTestScene,
    glassAvatarScene,
    physicsScene,
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Interactive test scenes — canvas2d with animated backgrounds for glassmorphic overlay testing
// ═══════════════════════════════════════════════════════════════════════════════

export function createInteractiveTestScenes(): Scene[] {
  const ids = {
    hotspot: uuidv4(),
    choice: uuidv4(),
    quiz: uuidv4(),
    gate: uuidv4(),
    tooltip: uuidv4(),
    form: uuidv4(),
  }

  /** Animated particle field with floating orbs + gradient mesh backdrop */
  function makeCanvasBg(accent: string, accent2: string, theme: string): string {
    return `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;

// Particles
const particles = Array.from({length: 80}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.3,
  r: Math.random() * 2 + 0.5, a: Math.random() * 0.4 + 0.1,
}));

// Floating orbs
const orbs = Array.from({length: 5}, (_, i) => ({
  x: W * (0.15 + Math.random() * 0.7), y: H * (0.2 + Math.random() * 0.6),
  r: 60 + Math.random() * 120, phase: i * 1.2,
  color: i % 2 === 0 ? '${accent}' : '${accent2}',
  speed: 0.3 + Math.random() * 0.5,
}));

let t = 0;
function draw() {
  t += 0.016;

  // Dark background
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Gradient mesh blobs
  orbs.forEach(o => {
    const ox = o.x + Math.sin(t * o.speed + o.phase) * 60;
    const oy = o.y + Math.cos(t * o.speed * 0.7 + o.phase) * 40;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
    g.addColorStop(0, o.color + '18');
    g.addColorStop(0.5, o.color + '08');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(ox - o.r, oy - o.r, o.r * 2, o.r * 2);
  });

  // Fine grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Particles
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = '${accent}' + Math.floor(p.a * 255).toString(16).padStart(2, '0');
    ctx.fill();
  });

  // Title
  const titleAlpha = Math.min(1, t * 2);
  ctx.globalAlpha = titleAlpha;
  ctx.font = '600 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '${accent}';
  ctx.textAlign = 'center';
  ctx.fillText('${theme}', W/2, 120);
  ctx.font = '400 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Interactive Scene Test', W/2, 160);
  ctx.globalAlpha = 1;

  // Connection lines between nearby particles
  ctx.strokeStyle = '${accent}' + '0a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const d = dx*dx + dy*dy;
      if (d < 15000) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  window.__tl.time() < DURATION && requestAnimationFrame(draw);
}
draw();
`
  }

  // ─── 1. Hotspot — Nebula ─────────────────────────────────────────────
  const hotspotScene: Scene = {
    ...base(),
    id: ids.hotspot,
    name: 'Nebula Explorer',
    sceneType: 'canvas2d',
    prompt: 'Hotspot test — nebula theme',
    bgColor: '#0a0a14',
    duration: 10,
    canvasCode: makeCanvasBg('#e84545', '#f59e0b', 'Nebula Explorer'),
    interactions: [
      {
        id: uuidv4(),
        type: 'hotspot' as const,
        x: 35,
        y: 38,
        width: 14,
        height: 10,
        appearsAt: 1.5,
        hidesAt: null,
        entranceAnimation: 'pop' as const,
        label: 'Explore',
        shape: 'pill' as const,
        style: 'pulse' as const,
        color: '#e84545',
        triggersEdgeId: null,
        jumpsToSceneId: ids.choice,
        // Warm glass — high inner glow, warm white tint
        visualStyle: {
          bgOpacity: 0.18,
          blur: 24,
          borderOpacity: 0.35,
          innerGlow: 0.7,
          bgColor: '#fff5e6',
          fontSize: 16,
          fontFamily: "'Space Grotesk', sans-serif",
        },
      },
      {
        id: uuidv4(),
        type: 'hotspot' as const,
        x: 55,
        y: 55,
        width: 10,
        height: 10,
        appearsAt: 2.5,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        label: 'Details',
        shape: 'circle' as const,
        style: 'glow' as const,
        color: '#f59e0b',
        triggersEdgeId: null,
        jumpsToSceneId: null,
        // Amber glass
        visualStyle: { bgOpacity: 0.12, blur: 20, borderOpacity: 0.4, innerGlow: 0.8, bgColor: '#fef3c7' },
      },
    ],
    variables: [],
  }

  // ─── 2. Choice — Crossroads ──────────────────────────────────────────
  const choiceScene: Scene = {
    ...base(),
    id: ids.choice,
    name: 'The Crossroads',
    sceneType: 'canvas2d',
    prompt: 'Choice test — branching paths',
    bgColor: '#0a0a14',
    duration: 12,
    canvasCode: makeCanvasBg('#3b82f6', '#8b5cf6', 'The Crossroads'),
    interactions: [
      {
        id: uuidv4(),
        type: 'choice' as const,
        x: 25,
        y: 30,
        width: 50,
        height: 30,
        appearsAt: 1.5,
        hidesAt: null,
        entranceAnimation: 'slide-up' as const,
        question: 'Choose your next experience',
        layout: 'vertical' as const,
        options: [
          {
            id: uuidv4(),
            label: 'Knowledge Check — Test what you know',
            icon: null,
            jumpsToSceneId: ids.quiz,
            color: '#8b5cf6',
          },
          {
            id: uuidv4(),
            label: 'The Vault — Prove your patience',
            icon: null,
            jumpsToSceneId: ids.gate,
            color: '#10b981',
          },
          {
            id: uuidv4(),
            label: 'Registration — Personalize your journey',
            icon: null,
            jumpsToSceneId: ids.form,
            color: '#ec4899',
          },
        ],
        // Cool blue glass — crisp edges, high border
        visualStyle: {
          bgOpacity: 0.12,
          blur: 28,
          borderOpacity: 0.4,
          borderRadius: 24,
          innerGlow: 0.6,
          bgColor: '#e0f2fe',
          shadowSpread: 40,
          fontFamily: "'Inter', sans-serif",
          fontSize: 15,
        },
      },
    ],
    variables: [],
  }

  // ─── 3. Quiz — Knowledge Check ───────────────────────────────────────
  const quizScene: Scene = {
    ...base(),
    id: ids.quiz,
    name: 'Knowledge Check',
    sceneType: 'canvas2d',
    prompt: 'Quiz test — answer to proceed',
    bgColor: '#0a0a14',
    duration: 20,
    canvasCode: makeCanvasBg('#8b5cf6', '#a78bfa', 'Knowledge Check'),
    interactions: [
      {
        id: uuidv4(),
        type: 'quiz' as const,
        x: 25,
        y: 22,
        width: 50,
        height: 56,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'slide-up' as const,
        question: 'What does SVG stand for?',
        options: [
          { id: 'a', label: 'Simple Vector Graphics' },
          { id: 'b', label: 'Scalable Vector Graphics' },
          { id: 'c', label: 'Standard Visual Geometry' },
          { id: 'd', label: 'Structured Vector Grid' },
        ],
        correctOptionId: 'b',
        onCorrect: 'jump' as const,
        onCorrectSceneId: ids.tooltip,
        onWrong: 'retry' as const,
        onWrongSceneId: null,
        explanation: 'SVG = Scalable Vector Graphics — an XML-based format for 2D vector images.',
        // Purple-tinted glass — frosted amethyst look
        visualStyle: {
          bgOpacity: 0.14,
          blur: 22,
          borderOpacity: 0.3,
          borderRadius: 22,
          innerGlow: 0.5,
          bgColor: '#ede9fe',
          shadowSpread: 36,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 15,
        },
      },
    ],
    variables: [],
  }

  // ─── 4. Gate — The Vault ─────────────────────────────────────────────
  const gateScene: Scene = {
    ...base(),
    id: ids.gate,
    name: 'The Vault',
    sceneType: 'canvas2d',
    prompt: 'Gate test — pause and continue',
    bgColor: '#0a0a14',
    duration: 12,
    canvasCode: makeCanvasBg('#10b981', '#34d399', 'The Vault'),
    interactions: [
      {
        id: uuidv4(),
        type: 'gate' as const,
        x: 40,
        y: 45,
        width: 20,
        height: 10,
        appearsAt: 3,
        hidesAt: null,
        entranceAnimation: 'pop' as const,
        buttonLabel: 'Unlock & Continue',
        buttonStyle: 'primary' as const,
        minimumWatchTime: 2,
        // Emerald glass — heavy blur, strong glow
        visualStyle: {
          bgOpacity: 0.2,
          blur: 30,
          borderOpacity: 0.45,
          borderRadius: 16,
          innerGlow: 0.8,
          bgColor: '#d1fae5',
          shadowSpread: 48,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 17,
        },
      },
    ],
    variables: [],
  }

  // ─── 5. Tooltip — Systems Overview ────────────────────────────────────
  const tooltipScene: Scene = {
    ...base(),
    id: ids.tooltip,
    name: 'Systems Overview',
    sceneType: 'canvas2d',
    prompt: 'Tooltip test — hover for details',
    bgColor: '#0a0a14',
    duration: 12,
    canvasCode: makeCanvasBg('#06b6d4', '#0ea5e9', 'Systems Overview'),
    interactions: [
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 20,
        y: 40,
        width: 6,
        height: 6,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: '#06b6d4',
        triggerLabel: '1',
        tooltipTitle: 'Rendering Engine',
        tooltipBody: 'Handles all Canvas2D, SVG, D3, Three.js, and Lottie scene rendering at 1920x1080.',
        tooltipPosition: 'right' as const,
        tooltipMaxWidth: 280,
        // Cyan glass — minimal, thin borders
        visualStyle: {
          bgOpacity: 0.1,
          blur: 20,
          borderOpacity: 0.25,
          borderRadius: 14,
          innerGlow: 0.4,
          bgColor: '#cffafe',
          shadowSpread: 24,
          fontSize: 13,
        },
      },
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 50,
        y: 30,
        width: 6,
        height: 6,
        appearsAt: 1.5,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: '#3b82f6',
        triggerLabel: '2',
        tooltipTitle: 'Agent Framework',
        tooltipBody:
          'AI-powered scene generation using Claude with tool use. Routes to specialized agents per scene type.',
        tooltipPosition: 'bottom' as const,
        tooltipMaxWidth: 280,
        // Blue glass — richer glow
        visualStyle: {
          bgOpacity: 0.13,
          blur: 24,
          borderOpacity: 0.3,
          borderRadius: 16,
          innerGlow: 0.55,
          bgColor: '#dbeafe',
          shadowSpread: 30,
          fontSize: 13,
        },
      },
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 72,
        y: 50,
        width: 6,
        height: 6,
        appearsAt: 2,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: '#f59e0b',
        triggerLabel: '3',
        tooltipTitle: 'Export Pipeline',
        tooltipBody: 'Puppeteer captures frames, FFmpeg stitches to MP4. Supports 720p, 1080p, and 4K output.',
        tooltipPosition: 'left' as const,
        tooltipMaxWidth: 280,
        // Amber glass — warm tint
        visualStyle: {
          bgOpacity: 0.12,
          blur: 18,
          borderOpacity: 0.35,
          borderRadius: 14,
          innerGlow: 0.5,
          bgColor: '#fef3c7',
          shadowSpread: 28,
          fontSize: 13,
        },
      },
    ],
    variables: [],
  }

  // ─── 6. Form — Registration ──────────────────────────────────────────
  const formScene: Scene = {
    ...base(),
    id: ids.form,
    name: 'Registration',
    sceneType: 'canvas2d',
    prompt: 'Form test — collect variables',
    bgColor: '#0a0a14',
    duration: 30,
    canvasCode: makeCanvasBg('#ec4899', '#f472b6', 'Registration'),
    interactions: [
      {
        id: uuidv4(),
        type: 'form' as const,
        x: 25,
        y: 15,
        width: 50,
        height: 70,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'slide-up' as const,
        fields: [
          {
            id: 'name_field',
            label: 'Your Name',
            type: 'text' as const,
            placeholder: 'Enter your name...',
            options: [],
            required: true,
          },
          {
            id: 'role_field',
            label: 'Role',
            type: 'select' as const,
            placeholder: null,
            options: ['Designer', 'Developer', 'Product Manager', 'Other'],
            required: true,
          },
          {
            id: 'exp_field',
            label: 'Experience Level',
            type: 'radio' as const,
            placeholder: null,
            options: ['Beginner', 'Intermediate', 'Advanced'],
            required: false,
          },
        ],
        submitLabel: 'Submit & Continue',
        setsVariables: [
          { fieldId: 'name_field', variableName: 'userName' },
          { fieldId: 'role_field', variableName: 'userRole' },
          { fieldId: 'exp_field', variableName: 'userExp' },
        ],
        jumpsToSceneId: ids.hotspot,
        // Rose glass — soft pink tint, large radius, monospace font
        visualStyle: {
          bgOpacity: 0.15,
          blur: 26,
          borderOpacity: 0.3,
          borderRadius: 24,
          innerGlow: 0.6,
          bgColor: '#fce7f3',
          shadowSpread: 40,
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
          textColor: '#ffffff',
        },
      },
    ],
    variables: [{ name: 'userName' }, { name: 'userRole' }, { name: 'userExp' }],
  }

  return [hotspotScene, choiceScene, quizScene, gateScene, tooltipScene, formScene]
}

/**
 * Two scenes that pack every interaction type and several `STYLE_PRESETS` for UI polish demos.
 * Load via Settings → Dev → "Load Interactive style showcase (2 scenes)".
 */
export function createInteractiveStyleShowcaseScenes(): Scene[] {
  const lab1 = uuidv4()
  const lab2 = uuidv4()
  const quizOptA = uuidv4()
  const quizOptB = uuidv4()
  const quizOptC = uuidv4()
  const choiceOptA = uuidv4()
  const choiceOptB = uuidv4()
  const choiceOptC = uuidv4()

  function makeCanvasBg(accent: string, accent2: string, theme: string): string {
    return `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;
const particles = Array.from({length: 80}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.3,
  r: Math.random() * 2 + 0.5, a: Math.random() * 0.4 + 0.1,
}));
const orbs = Array.from({length: 5}, (_, i) => ({
  x: W * (0.15 + Math.random() * 0.7), y: H * (0.2 + Math.random() * 0.6),
  r: 60 + Math.random() * 120, phase: i * 1.2,
  color: i % 2 === 0 ? '${accent}' : '${accent2}',
  speed: 0.3 + Math.random() * 0.5,
}));
let t = 0;
function draw() {
  t += 0.016;
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);
  orbs.forEach(o => {
    const ox = o.x + Math.sin(t * o.speed + o.phase) * 60;
    const oy = o.y + Math.cos(t * o.speed * 0.7 + o.phase) * 40;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
    g.addColorStop(0, o.color + '18');
    g.addColorStop(0.5, o.color + '08');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(ox - o.r, oy - o.r, o.r * 2, o.r * 2);
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = '${accent}' + Math.floor(p.a * 255).toString(16).padStart(2, '0');
    ctx.fill();
  });
  const titleAlpha = Math.min(1, t * 2);
  ctx.globalAlpha = titleAlpha;
  ctx.font = '600 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '${accent}';
  ctx.textAlign = 'center';
  ctx.fillText('${theme}', W/2, 120);
  ctx.font = '400 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Interactive UI + style presets', W/2, 160);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '${accent}' + '0a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      if (dx*dx + dy*dy < 15000) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }
  window.__tl.time() < DURATION && requestAnimationFrame(draw);
}
draw();
`
  }

  const scene1: Scene = {
    ...base(),
    id: lab1,
    name: 'Style Lab — Act I',
    sceneType: 'canvas2d',
    prompt: 'Interactive showcase — hotspots, tooltips, choice, gate, mixed presets',
    bgColor: '#0a0a14',
    duration: 16,
    canvasCode: makeCanvasBg('#c084fc', '#818cf8', 'Style Lab — Act I'),
    variables: [],
    interactions: [
      {
        id: uuidv4(),
        type: 'hotspot',
        x: 6,
        y: 70,
        width: 18,
        height: 12,
        appearsAt: 0.4,
        hidesAt: null,
        entranceAnimation: 'pop',
        label: '→ Act II',
        shape: 'pill',
        style: 'pulse',
        color: '#e84545',
        triggersEdgeId: null,
        jumpsToSceneId: lab2,
        visualStyle: { ...STYLE_PRESETS['glass-warm'], fontSize: 15 },
      },
      {
        id: uuidv4(),
        type: 'hotspot',
        x: 76,
        y: 68,
        width: 16,
        height: 14,
        appearsAt: 0.9,
        hidesAt: null,
        entranceAnimation: 'fade',
        label: 'No jump',
        shape: 'rectangle',
        style: 'border',
        color: '#94a3b8',
        triggersEdgeId: null,
        jumpsToSceneId: null,
        visualStyle: { ...STYLE_PRESETS.outline, borderRadius: 10, fontSize: 13 },
      },
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 10,
        y: 26,
        width: 6,
        height: 6,
        appearsAt: 1.1,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#e84545',
        triggerLabel: 'i',
        tooltipTitle: 'Neon preset',
        tooltipBody:
          'Tooltip triggers use the same glass style system — this one uses the neon preset with glow-friendly borders.',
        tooltipPosition: 'right',
        tooltipMaxWidth: 260,
        visualStyle: { ...STYLE_PRESETS.neon, fontSize: 13 },
      },
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 84,
        y: 20,
        width: 6,
        height: 5,
        appearsAt: 1.4,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        triggerShape: 'rectangle',
        triggerColor: '#38bdf8',
        triggerLabel: '?',
        tooltipTitle: 'Glass cool',
        tooltipBody: 'Positioned left so the card opens into the frame. Try every corner in your own projects.',
        tooltipPosition: 'left',
        tooltipMaxWidth: 280,
        visualStyle: { ...STYLE_PRESETS['glass-cool'], fontSize: 13 },
      },
      {
        id: uuidv4(),
        type: 'choice',
        x: 14,
        y: 36,
        width: 72,
        height: 28,
        appearsAt: 2.2,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        question: 'Branching — where next?',
        layout: 'horizontal',
        options: [
          { id: choiceOptA, label: 'Act II', icon: '▶', jumpsToSceneId: lab2, color: '#a78bfa' },
          { id: choiceOptB, label: 'Act II (same)', icon: null, jumpsToSceneId: lab2, color: '#34d399' },
          { id: choiceOptC, label: 'Stay', icon: null, jumpsToSceneId: '', color: '#64748b' },
        ],
        visualStyle: { ...STYLE_PRESETS.gradient, fontSize: 15, textAlign: 'center' },
      },
      {
        id: uuidv4(),
        type: 'gate',
        x: 42,
        y: 44,
        width: 16,
        height: 10,
        appearsAt: 8.5,
        hidesAt: null,
        entranceAnimation: 'fade',
        buttonLabel: 'Continue timeline',
        buttonStyle: 'outline',
        minimumWatchTime: 0,
        visualStyle: { ...STYLE_PRESETS['glass-dark'], fontSize: 16, textAlign: 'center' },
      },
    ],
  }

  const scene2: Scene = {
    ...base(),
    id: lab2,
    name: 'Style Lab — Act II',
    sceneType: 'canvas2d',
    prompt: 'Interactive showcase — quiz, form, solid + minimal presets',
    bgColor: '#0a0a14',
    duration: 26,
    canvasCode: makeCanvasBg('#22d3ee', '#f472b6', 'Style Lab — Act II'),
    variables: [{ name: 'visitorName' }, { name: 'focusArea' }],
    interactions: [
      {
        id: uuidv4(),
        type: 'quiz',
        x: 12,
        y: 18,
        width: 76,
        height: 52,
        appearsAt: 0.5,
        hidesAt: 9,
        entranceAnimation: 'slide-up',
        question: 'What does Cench Studio prefer for explainer-style scenes?',
        options: [
          { id: quizOptA, label: 'Motion / Anime.js forward scenes' },
          { id: quizOptB, label: 'SVG-only, never Motion' },
          { id: quizOptC, label: 'Static PNG slides' },
        ],
        correctOptionId: quizOptA,
        onCorrect: 'continue',
        onCorrectSceneId: null,
        onWrong: 'retry',
        onWrongSceneId: null,
        explanation: 'Motion is the default renderer for explainers; Canvas2D and others are used when the brief fits.',
        visualStyle: { ...STYLE_PRESETS['solid-light'], fontSize: 15, textAlign: 'left' },
      },
      {
        id: uuidv4(),
        type: 'form',
        x: 22,
        y: 16,
        width: 56,
        height: 62,
        appearsAt: 9.2,
        hidesAt: null,
        entranceAnimation: 'pop',
        fields: [
          {
            id: 'fld_name',
            label: 'Name (injected as {visitorName})',
            type: 'text',
            placeholder: 'Your name',
            options: [],
            required: true,
          },
          {
            id: 'fld_focus',
            label: 'Focus',
            type: 'select',
            placeholder: null,
            options: ['Animation', 'Data viz', '3D', 'Publishing'],
            required: false,
          },
          {
            id: 'fld_level',
            label: 'Level',
            type: 'radio',
            placeholder: null,
            options: ['Hobbyist', 'Pro', 'Team'],
            required: false,
          },
        ],
        submitLabel: 'Save & return to Act I',
        setsVariables: [
          { fieldId: 'fld_name', variableName: 'visitorName' },
          { fieldId: 'fld_focus', variableName: 'focusArea' },
        ],
        jumpsToSceneId: lab1,
        visualStyle: { ...STYLE_PRESETS.minimal, fontSize: 14, textAlign: 'left', borderOpacity: 0.35 },
      },
      {
        id: uuidv4(),
        type: 'hotspot',
        x: 40,
        y: 78,
        width: 20,
        height: 11,
        appearsAt: 9,
        hidesAt: null,
        entranceAnimation: 'fade',
        label: 'Skip form → Act I',
        shape: 'pill',
        style: 'glow',
        color: '#f472b6',
        triggersEdgeId: null,
        jumpsToSceneId: lab1,
        visualStyle: { ...STYLE_PRESETS.solid, accentColor: '#f472b6', fontSize: 14 },
      },
    ],
  }

  return [scene1, scene2]
}

const PROF_INTERACTION = { ...STYLE_PRESETS.professional }

/**
 * Six canvas scenes — one interaction type each, all using the **Professional** style preset.
 * Linear auto-advance when a scene ends; hotspots/choices/quiz/gate/form also jump ahead.
 * Load: Settings → Dev → "Load Professional interaction tour (6 scenes)".
 */
export function createInteractiveProfessionalTourScenes(): Scene[] {
  const s1 = uuidv4()
  const s2 = uuidv4()
  const s3 = uuidv4()
  const s4 = uuidv4()
  const s5 = uuidv4()
  const s6 = uuidv4()
  const qA = uuidv4()
  const qB = uuidv4()
  const qC = uuidv4()
  const ch1 = uuidv4()
  const ch2 = uuidv4()

  function makeTourBg(accent: string, accent2: string, title: string): string {
    return `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;
const particles = Array.from({length: 70}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.28,
  r: Math.random() * 2 + 0.5, a: Math.random() * 0.35 + 0.08,
}));
const orbs = Array.from({length: 4}, (_, i) => ({
  x: W * (0.2 + Math.random() * 0.6), y: H * (0.22 + Math.random() * 0.5),
  r: 70 + Math.random() * 100, phase: i * 1.1,
  color: i % 2 === 0 ? '${accent}' : '${accent2}',
  speed: 0.25 + Math.random() * 0.45,
}));
let t = 0;
function draw() {
  t += 0.016;
  ctx.fillStyle = '#0c1222';
  ctx.fillRect(0, 0, W, H);
  orbs.forEach(o => {
    const ox = o.x + Math.sin(t * o.speed + o.phase) * 50;
    const oy = o.y + Math.cos(t * o.speed * 0.7 + o.phase) * 36;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
    g.addColorStop(0, o.color + '14');
    g.addColorStop(0.55, o.color + '06');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(ox - o.r, oy - o.r, o.r * 2, o.r * 2);
  });
  ctx.strokeStyle = 'rgba(148,163,184,0.06)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = '${accent}' + Math.floor(p.a * 255).toString(16).padStart(2, '0');
    ctx.fill();
  });
  const titleAlpha = Math.min(1, t * 1.8);
  ctx.globalAlpha = titleAlpha;
  ctx.font = '600 48px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '${accent}';
  ctx.textAlign = 'center';
  ctx.fillText('${title.replace(/'/g, "\\'")}', W/2, 118);
  ctx.font = '400 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(226,232,240,0.45)';
  ctx.fillText('Professional interaction preset', W/2, 158);
  ctx.globalAlpha = 1;
  window.__tl.time() < DURATION && requestAnimationFrame(draw);
}
draw();
`
  }

  const sceneHotspot: Scene = {
    ...base(),
    id: s1,
    name: 'Tour 1 · Hotspot',
    sceneType: 'canvas2d',
    prompt: 'Professional preset tour — hotspot',
    bgColor: '#0c1222',
    duration: 12,
    canvasCode: makeTourBg('#2563eb', '#64748b', '1 · Hotspot'),
    variables: [],
    interactions: [
      {
        id: uuidv4(),
        type: 'hotspot',
        x: 38,
        y: 62,
        width: 24,
        height: 12,
        appearsAt: 0.8,
        hidesAt: null,
        entranceAnimation: 'fade',
        label: 'Next: Choice →',
        shape: 'pill',
        style: 'border',
        color: '#2563eb',
        triggersEdgeId: null,
        jumpsToSceneId: s2,
        visualStyle: { ...PROF_INTERACTION, textAlign: 'center' },
      },
    ],
  }

  const sceneChoice: Scene = {
    ...base(),
    id: s2,
    name: 'Tour 2 · Choice',
    sceneType: 'canvas2d',
    prompt: 'Professional preset tour — choice',
    bgColor: '#0c1222',
    duration: 14,
    canvasCode: makeTourBg('#0ea5e9', '#2563eb', '2 · Choice'),
    variables: [],
    interactions: [
      {
        id: uuidv4(),
        type: 'choice',
        x: 20,
        y: 38,
        width: 60,
        height: 36,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        question: 'How should we continue?',
        layout: 'vertical',
        options: [
          { id: ch1, label: 'Continue to knowledge check', icon: null, jumpsToSceneId: s3, color: '#2563eb' },
          { id: ch2, label: 'Same destination', icon: null, jumpsToSceneId: s3, color: '#64748b' },
        ],
        visualStyle: { ...PROF_INTERACTION },
      },
    ],
  }

  const sceneQuiz: Scene = {
    ...base(),
    id: s3,
    name: 'Tour 3 · Quiz',
    sceneType: 'canvas2d',
    prompt: 'Professional preset tour — quiz',
    bgColor: '#0c1222',
    duration: 18,
    canvasCode: makeTourBg('#6366f1', '#818cf8', '3 · Quiz'),
    variables: [],
    interactions: [
      {
        id: uuidv4(),
        type: 'quiz',
        x: 16,
        y: 28,
        width: 68,
        height: 50,
        appearsAt: 0.8,
        hidesAt: null,
        entranceAnimation: 'pop',
        question: 'Which style best matches a clear B2B explainer?',
        options: [
          { id: qA, label: 'Heavy neon glow and loud motion' },
          { id: qB, label: 'Legible panels, calm blue accent' },
          { id: qC, label: 'Maximum decorative chrome' },
        ],
        correctOptionId: qB,
        onCorrect: 'jump',
        onCorrectSceneId: s4,
        onWrong: 'retry',
        onWrongSceneId: null,
        explanation: 'The Professional preset uses high-contrast type and a restrained palette.',
        visualStyle: { ...PROF_INTERACTION },
      },
    ],
  }

  const sceneGate: Scene = {
    ...base(),
    id: s4,
    name: 'Tour 4 · Gate',
    sceneType: 'canvas2d',
    prompt: 'Professional preset tour — gate',
    bgColor: '#0c1222',
    duration: 14,
    canvasCode: makeTourBg('#10b981', '#0d9488', '4 · Gate'),
    variables: [],
    interactions: [
      {
        id: uuidv4(),
        type: 'gate',
        x: 42,
        y: 44,
        width: 16,
        height: 10,
        appearsAt: 2,
        hidesAt: null,
        entranceAnimation: 'fade',
        buttonLabel: 'Continue to tooltips',
        buttonStyle: 'primary',
        minimumWatchTime: 0,
        visualStyle: { ...PROF_INTERACTION, textAlign: 'center' },
      },
    ],
  }

  const sceneTooltip: Scene = {
    ...base(),
    id: s5,
    name: 'Tour 5 · Tooltip',
    sceneType: 'canvas2d',
    prompt: 'Professional preset tour — tooltip',
    bgColor: '#0c1222',
    duration: 12,
    canvasCode: makeTourBg('#f59e0b', '#ea580c', '5 · Tooltip'),
    variables: [],
    interactions: [
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 22,
        y: 42,
        width: 6,
        height: 6,
        appearsAt: 0.6,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#2563eb',
        triggerLabel: null,
        tooltipTitle: 'Definition',
        tooltipBody:
          'Professional tooltips use a dark slate popover with a clear ! button; quizzes and forms share the same preset chrome.',
        tooltipPosition: 'right',
        tooltipMaxWidth: 280,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 70,
        y: 38,
        width: 6,
        height: 6,
        appearsAt: 1.2,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#0f172a',
        triggerLabel: null,
        tooltipTitle: 'Tip',
        tooltipBody: 'Hover or focus each blue circle; placement alternates left and right for this tour.',
        tooltipPosition: 'left',
        tooltipMaxWidth: 260,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
    ],
  }

  const sceneForm: Scene = {
    ...base(),
    id: s6,
    name: 'Tour 6 · Form',
    sceneType: 'canvas2d',
    prompt: 'Professional preset tour — form',
    bgColor: '#0c1222',
    duration: 20,
    canvasCode: makeTourBg('#ec4899', '#a855f7', '6 · Form'),
    variables: [{ name: 'visitorName' }],
    interactions: [
      {
        id: uuidv4(),
        type: 'form',
        x: 22,
        y: 22,
        width: 56,
        height: 58,
        appearsAt: 0.8,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        fields: [
          {
            id: 'fld_name',
            label: 'Name',
            type: 'text',
            placeholder: 'Jane Doe',
            options: [],
            required: true,
          },
          {
            id: 'fld_role',
            label: 'Role',
            type: 'select',
            placeholder: null,
            options: ['Marketing', 'Product', 'Learning', 'Other'],
            required: false,
          },
        ],
        submitLabel: 'Submit & restart tour',
        setsVariables: [{ fieldId: 'fld_name', variableName: 'visitorName' }],
        jumpsToSceneId: s1,
        visualStyle: { ...PROF_INTERACTION },
      },
    ],
  }

  return [sceneHotspot, sceneChoice, sceneQuiz, sceneGate, sceneTooltip, sceneForm]
}

/**
 * Three canvas scenes focused on **Professional** preset tooltips (slate popover + Motion in editor).
 * Circle triggers render as true circles with a white ! icon; pill and rounded shapes on scene 3.
 * Load: Settings → Dev → "Load Professional tooltip demo (3 scenes)".
 */
export function createProfessionalTooltipTestScenes(): Scene[] {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  function demoBg(title: string, subtitle: string): string {
    const t = esc(title)
    const sub = esc(subtitle)
    return `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;
ctx.fillStyle = '#0c1222';
ctx.fillRect(0, 0, W, H);
const g = ctx.createLinearGradient(0, 0, W, H);
g.addColorStop(0, 'rgba(37, 99, 235, 0.11)');
g.addColorStop(1, 'rgba(30, 41, 59, 0.35)');
ctx.fillStyle = g;
ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
ctx.lineWidth = 1;
for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
ctx.font = '600 40px system-ui, -apple-system, sans-serif';
ctx.fillStyle = '#f1f5f9';
ctx.textAlign = 'center';
ctx.fillText('${t}', W / 2, 102);
ctx.font = '400 16px system-ui, -apple-system, sans-serif';
ctx.fillStyle = 'rgba(148, 163, 184, 0.88)';
ctx.fillText('${sub}', W / 2, 144);
`
  }

  const s1 = uuidv4()
  const s2 = uuidv4()
  const s3 = uuidv4()

  const sceneTb: Scene = {
    ...base(),
    id: s1,
    name: 'Pro tooltip · Top & bottom',
    sceneType: 'canvas2d',
    prompt: 'Professional tooltip demo — vertical placement',
    bgColor: '#0c1222',
    duration: 14,
    canvasCode: demoBg('1 · Top & bottom', 'Circular ! triggers — hover or Tab+focus to open the slate tooltip'),
    interactions: [
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 18,
        y: 26,
        width: 6,
        height: 6,
        appearsAt: 0.4,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#2563eb',
        triggerLabel: null,
        tooltipTitle: 'Tooltip below trigger',
        tooltipBody:
          'Placement: bottom. Use when the info button sits high on the frame so the popover has room below.',
        tooltipPosition: 'bottom',
        tooltipMaxWidth: 300,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 72,
        y: 68,
        width: 6,
        height: 6,
        appearsAt: 0.7,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#0ea5e9',
        triggerLabel: null,
        tooltipTitle: 'Tooltip above trigger',
        tooltipBody:
          'Placement: top. The panel animates in the editor preview; keyboard focus on the circle also opens it.',
        tooltipPosition: 'top',
        tooltipMaxWidth: 300,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
    ],
  }

  const sceneLr: Scene = {
    ...base(),
    id: s2,
    name: 'Pro tooltip · Left & right',
    sceneType: 'canvas2d',
    prompt: 'Professional tooltip demo — horizontal placement',
    bgColor: '#0c1222',
    duration: 14,
    canvasCode: demoBg('2 · Left & right', 'Edge-mounted ! buttons — tooltips open toward the center'),
    interactions: [
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 10,
        y: 42,
        width: 6,
        height: 6,
        appearsAt: 0.4,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#6366f1',
        triggerLabel: null,
        tooltipTitle: 'Opens to the right',
        tooltipBody: 'Placement: right. Pairs with left-side triggers so copy stays on-screen.',
        tooltipPosition: 'right',
        tooltipMaxWidth: 280,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 80,
        y: 46,
        width: 6,
        height: 6,
        appearsAt: 0.7,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#64748b',
        triggerLabel: null,
        tooltipTitle: 'Opens to the left',
        tooltipBody: 'Placement: left. Mirror this when your trigger sits on the right.',
        tooltipPosition: 'left',
        tooltipMaxWidth: 280,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
    ],
  }

  const sceneShapes: Scene = {
    ...base(),
    id: s3,
    name: 'Pro tooltip · Shapes + loop',
    sceneType: 'canvas2d',
    prompt: 'Professional tooltip demo — trigger shapes and hotspot',
    bgColor: '#0c1222',
    duration: 16,
    canvasCode: demoBg('3 · Shapes & wrap-up', 'Pill label + rounded square — then Restart to scene 1'),
    interactions: [
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 22,
        y: 38,
        width: 18,
        height: 7,
        appearsAt: 0.5,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        triggerShape: 'pill',
        triggerColor: '#1e3a5f',
        triggerLabel: 'Policy',
        tooltipTitle: 'Multi-line body',
        tooltipBody:
          'Pill triggers show a text label; the popover uses a comfortable min width so sentences wrap cleanly instead of one word per line.',
        tooltipPosition: 'top',
        tooltipMaxWidth: 360,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
      {
        id: uuidv4(),
        type: 'tooltip',
        x: 68,
        y: 52,
        width: 8,
        height: 8,
        appearsAt: 0.9,
        hidesAt: null,
        entranceAnimation: 'pop',
        triggerShape: 'rounded',
        triggerColor: '#2563eb',
        triggerLabel: null,
        tooltipTitle: 'Rounded square',
        tooltipBody: 'Rounded rectangle hit area — same slate tooltip as circles; optional empty label.',
        tooltipPosition: 'left',
        tooltipMaxWidth: 260,
        visualStyle: { ...PROF_INTERACTION, fontSize: 14 },
      },
      {
        id: uuidv4(),
        type: 'hotspot',
        x: 36,
        y: 82,
        width: 28,
        height: 10,
        appearsAt: 1.2,
        hidesAt: null,
        entranceAnimation: 'fade',
        label: '↻ Restart demo (scene 1)',
        shape: 'pill',
        style: 'border',
        color: '#38bdf8',
        triggersEdgeId: null,
        jumpsToSceneId: s1,
        visualStyle: { ...PROF_INTERACTION, textAlign: 'center', fontSize: 14 },
      },
    ],
  }

  return [sceneTb, sceneLr, sceneShapes]
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3D World test scenes — one per environment template
// ═══════════════════════════════════════════════════════════════════════════════

export function createWorldTestScenes(): Scene[] {
  // ── Meadow — sunset landscape with nature objects and floating panel ────────
  const meadowScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: '3D World: Meadow',
    sceneType: '3d_world',
    prompt: 'Sunset meadow with trees and a floating info panel',
    bgColor: '#000000',
    duration: 10,
    worldConfig: {
      environment: 'meadow',
      timeOfDay: 'sunset',
      windStrength: 0.8,
      grassDensity: 40000,
      objects: [
        { assetId: 'tree', position: [-4, 0, -6], rotation: [0, 0.3, 0], scale: 2 },
        { assetId: 'tree', position: [5, 0, -8], rotation: [0, -0.5, 0], scale: 1.8 },
        { assetId: 'tree', position: [-7, 0, -12], scale: 2.5 },
        { assetId: 'person-standing', position: [0, 0, 3], rotation: [0, Math.PI, 0], scale: 1.2 },
      ],
      panels: [
        {
          html: '<h1 style="font-size:48px;font-weight:800;color:#2d1b00;margin-bottom:16px">Welcome to Cench</h1><p style="font-size:22px;color:#4a3520;line-height:1.5">AI-powered video creation<br/>in immersive 3D environments</p>',
          position: [2.5, 1.8, 0],
          rotation: [0, -0.3, 0],
          width: 3,
          height: 1.5,
        },
      ],
      avatars: [],
      cameraPath: [
        { t: 0, pos: [0, 1.6, 8], lookAt: [0, 1.2, 0] },
        { t: 5, pos: [1, 1.8, 6], lookAt: [0.5, 1.4, -2] },
        { t: 10, pos: [2, 2.0, 5], lookAt: [0, 1.0, -4] },
      ],
    },
  }

  // ── Studio Room — classroom with desk setup and whiteboard panel ────────────
  const studioScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: '3D World: Studio Room',
    sceneType: '3d_world',
    prompt: 'Classroom with whiteboard, desk and tech props',
    bgColor: '#000000',
    duration: 10,
    worldConfig: {
      environment: 'studio_room',
      roomStyle: 'classroom',
      objects: [
        { assetId: 'desk', position: [0, 0, 0], scale: 1.5 },
        { assetId: 'laptop', position: [0, 0.76, 0], rotation: [0, Math.PI, 0], scale: 1 },
        { assetId: 'office-chair', position: [0, 0, 1.5], rotation: [0, Math.PI, 0], scale: 1.2 },
        { assetId: 'book', position: [1.5, 0.76, 0.2], rotation: [0, 0.4, 0], scale: 0.8 },
      ],
      panels: [
        {
          html: '<h2 style="font-size:42px;font-weight:700;color:#1a1a2e;margin-bottom:12px">Lesson 1</h2><p style="font-size:20px;color:#333;line-height:1.6">Introduction to Machine Learning</p><ul style="font-size:18px;color:#555;margin-top:16px;padding-left:20px"><li>Supervised vs Unsupervised</li><li>Neural Network Basics</li><li>Training & Inference</li></ul>',
          position: [0, 1.5, -3.9],
          rotation: [0, 0, 0],
          width: 3.5,
          height: 2,
        },
      ],
      avatars: [],
      cameraPath: [
        { t: 0, pos: [0, 1.6, 4], lookAt: [0, 1.2, -2] },
        { t: 5, pos: [-0.5, 1.5, 3], lookAt: [0, 1.4, -3] },
        { t: 10, pos: [0, 1.4, 2.5], lookAt: [0, 1.5, -3.9] },
      ],
    },
  }

  // ── Void Space — floating panels in arc layout with abstract objects ────────
  const voidScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: '3D World: Void Space',
    sceneType: '3d_world',
    prompt: 'Abstract dark space with floating data panels and tech objects',
    bgColor: '#000000',
    duration: 12,
    worldConfig: {
      environment: 'void_space',
      spaceLayout: 'arc',
      objects: [
        {
          assetId: 'shield',
          position: [-3, 0.5, -2],
          scale: 1.5,
          gsapAnimation: { property: 'rotation.y', from: 0, to: Math.PI * 2, duration: 8 },
        },
        {
          assetId: 'chain-link',
          position: [3, -0.5, -1],
          scale: 1.2,
          gsapAnimation: { property: 'rotation.y', from: 0, to: -Math.PI * 2, duration: 10 },
        },
        { assetId: 'arrow-3d', position: [0, 2, -4], rotation: [0, 0, -Math.PI / 4], scale: 1.5 },
        { assetId: 'target', position: [-2, -1, -3], scale: 1 },
        { assetId: 'light-bulb', position: [2, 1.5, -3], scale: 1.2 },
      ],
      panels: [
        {
          html: '<div style="text-align:center"><h1 style="font-size:36px;font-weight:800;color:#8b5cf6;margin-bottom:8px">Security</h1><p style="font-size:18px;color:#a5a5b5">End-to-end encryption<br/>Zero-knowledge proofs</p></div>',
          width: 2,
          height: 1,
        },
        {
          html: '<div style="text-align:center"><h1 style="font-size:36px;font-weight:800;color:#06b6d4;margin-bottom:8px">Scale</h1><p style="font-size:18px;color:#a5a5b5">10M+ requests/sec<br/>Global edge network</p></div>',
          width: 2,
          height: 1,
        },
        {
          html: '<div style="text-align:center"><h1 style="font-size:36px;font-weight:800;color:#f59e0b;margin-bottom:8px">AI-Powered</h1><p style="font-size:18px;color:#a5a5b5">Real-time inference<br/>Adaptive learning</p></div>',
          width: 2,
          height: 1,
        },
      ],
      avatars: [],
      cameraPath: [
        { t: 0, pos: [0, 0, 6], lookAt: [0, 0, 0] },
        { t: 4, pos: [-1, 0.5, 4], lookAt: [0, 0, -1] },
        { t: 8, pos: [1, -0.3, 3], lookAt: [0, 0, -2] },
        { t: 12, pos: [0, 0, 2], lookAt: [0, 0, -3] },
      ],
    },
  }

  return [meadowScene, studioScene, voidScene]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Medical Explainer — Myocarditis adverse effects (8 scenes, science_journal)
// ═══════════════════════════════════════════════════════════════════════════════

export function createMedicalTestScenes(): Scene[] {
  const ids = {
    title: uuidv4(),
    anatomy: uuidv4(),
    pathophysiology: uuidv4(),
    presentation: uuidv4(),
    diagnostic: uuidv4(),
    complications: uuidv4(),
    management: uuidv4(),
    prognosis: uuidv4(),
  }

  // Shared palette — science_journal
  const NAVY = '#1a1a2e'
  const RED = '#e94560'
  const DARK_NAVY = '#16213e'
  const GREY = '#888888'

  function medicalTTS(text: string) {
    return {
      enabled: true,
      src: null,
      volume: 1,
      fadeIn: false,
      fadeOut: false,
      startOffset: 0,
      tts: {
        text,
        provider: 'web-speech' as const,
        voiceId: null,
        src: null,
        status: 'pending' as const,
        duration: null,
        instructions: null,
      },
    }
  }

  // ─── 1. Title Card ───────────────────────────────────────────────────
  const titleScene: Scene = {
    ...base(),
    id: ids.title,
    name: 'Myocarditis: Adverse Effects',
    sceneType: 'motion',
    prompt: 'Title card for myocarditis clinical review',
    bgColor: '#FFFFFF',
    duration: 10,
    sceneStyles: `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
      #layout { text-align: center; opacity: 0; animation: fadeSlideUp 1s ease 0.3s forwards; }
      h1 { font: 700 64px/1.15 Georgia, serif; color: ${NAVY}; letter-spacing: -0.5px; }
      .accent-line { width: 120px; height: 3px; background: ${RED}; margin: 28px auto; opacity: 0; animation: growLine 0.8s ease 0.9s forwards; }
      h2 { font: 400 26px/1.4 Georgia, serif; color: ${GREY}; }
      .fig { position: fixed; bottom: 40px; left: 60px; font: italic 13px Georgia, serif; color: ${GREY}; opacity: 0; animation: fadeSlideUp 0.6s ease 1.4s forwards; }
      @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes growLine { from { opacity: 0; width: 0; } to { opacity: 1; width: 120px; } }
    `,
    sceneHTML: `
      <div id="layout">
        <h1>Myocarditis</h1>
        <h1 style="font-size:48px; color:${RED}">Adverse Effects &amp; Clinical Management</h1>
        <div class="accent-line"></div>
        <h2>A Clinical Review for Medical Professionals</h2>
      </div>
      <div class="fig">Fig. 1 | Title Overview</div>
    `,
    audioLayer: medicalTTS(
      'Welcome to this clinical review of myocarditis and its adverse effects. This presentation covers cardiac anatomy, pathophysiology, clinical presentation, diagnostic workup, complications, management algorithms, and prognostic outcomes.',
    ),
    styleOverride: {},
  }

  // ─── 2. Cardiac Anatomy (canvas2d + tooltips) ────────────────────────
  const anatomyScene: Scene = {
    ...base(),
    id: ids.anatomy,
    name: 'Cardiac Anatomy',
    sceneType: 'canvas2d',
    prompt: 'Heart cross-section highlighting myocardium',
    bgColor: '#FFFFFF',
    duration: 20,
    canvasCode: `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;

const cx = W / 2, cy = H / 2 + 30;
let t = 0;

function draw() {
  t += 0.016;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const progress = Math.min(t / 2, 1);

  // Heart outline (simplified cross-section)
  ctx.save();
  ctx.translate(cx, cy);

  // Outer wall — epicardium
  ctx.beginPath();
  ctx.ellipse(0, -20, 280 * progress, 300 * progress, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '${GREY}';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Myocardium band (thick, highlighted)
  ctx.beginPath();
  ctx.ellipse(0, -20, 250 * progress, 270 * progress, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '${RED}';
  ctx.lineWidth = 40;
  ctx.globalAlpha = 0.25 * progress;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Inner wall — endocardium
  ctx.beginPath();
  ctx.ellipse(0, -20, 220 * progress, 240 * progress, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '${DARK_NAVY}';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Septum (vertical divider)
  ctx.beginPath();
  ctx.moveTo(0, -260 * progress);
  ctx.lineTo(0, 220 * progress);
  ctx.strokeStyle = '${NAVY}';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Chamber labels
  if (progress > 0.7) {
    const labelAlpha = Math.min(1, (progress - 0.7) / 0.3);
    ctx.globalAlpha = labelAlpha;
    ctx.font = '500 22px Inter, sans-serif';
    ctx.fillStyle = '${NAVY}';
    ctx.textAlign = 'center';
    ctx.fillText('LV', -110, 20);
    ctx.fillText('RV', 110, 20);
    ctx.fillText('LA', -110, -120);
    ctx.fillText('RA', 110, -120);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Layer labels on the right
  if (progress > 0.8) {
    const la = Math.min(1, (progress - 0.8) / 0.2);
    ctx.globalAlpha = la;
    ctx.font = '400 18px Inter, sans-serif';
    ctx.textAlign = 'left';
    const lx = cx + 320;
    // Epicardium
    ctx.fillStyle = '${GREY}';
    ctx.fillText('Epicardium', lx, cy - 180);
    ctx.beginPath(); ctx.moveTo(cx + 270, cy - 180); ctx.lineTo(lx - 10, cy - 180); ctx.strokeStyle = '${GREY}'; ctx.lineWidth = 1; ctx.stroke();
    // Myocardium
    ctx.fillStyle = '${RED}';
    ctx.fillText('Myocardium (target)', lx, cy - 60);
    ctx.beginPath(); ctx.moveTo(cx + 240, cy - 60); ctx.lineTo(lx - 10, cy - 60); ctx.strokeStyle = '${RED}'; ctx.lineWidth = 1; ctx.stroke();
    // Endocardium
    ctx.fillStyle = '${DARK_NAVY}';
    ctx.fillText('Endocardium', lx, cy + 60);
    ctx.beginPath(); ctx.moveTo(cx + 210, cy + 60); ctx.lineTo(lx - 10, cy + 60); ctx.strokeStyle = '${DARK_NAVY}'; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Title
  ctx.font = '700 42px Georgia, serif';
  ctx.fillStyle = '${NAVY}';
  ctx.textAlign = 'center';
  ctx.fillText('Cardiac Wall Layers', cx, 80);

  // Fig label
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '${GREY}';
  ctx.textAlign = 'left';
  ctx.fillText('Fig. 2 | Cross-sectional anatomy of the heart wall', 60, H - 40);

  window.__tl.time() < DURATION && requestAnimationFrame(draw);
}
draw();
`,
    interactions: [
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 68,
        y: 30,
        width: 5,
        height: 5,
        appearsAt: 3,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: GREY,
        triggerLabel: '1',
        tooltipTitle: 'Epicardium',
        tooltipBody:
          'The outermost serous layer (visceral pericardium). Contains coronary vessels and adipose tissue. Rarely involved in isolated myocarditis.',
        tooltipPosition: 'right' as const,
        tooltipMaxWidth: 300,
        visualStyle: {
          bgOpacity: 0.08,
          blur: 16,
          borderOpacity: 0.2,
          borderRadius: 12,
          innerGlow: 0.3,
          bgColor: '#f5f5f5',
          fontSize: 13,
          fontFamily: "'Inter', sans-serif",
        },
      },
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 68,
        y: 47,
        width: 5,
        height: 5,
        appearsAt: 3.5,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: RED,
        triggerLabel: '2',
        tooltipTitle: 'Myocardium',
        tooltipBody:
          'The thick muscular layer responsible for contractile function. Primary site of inflammation in myocarditis — viral infiltration and immune-mediated injury cause myocyte necrosis.',
        tooltipPosition: 'right' as const,
        tooltipMaxWidth: 300,
        visualStyle: {
          bgOpacity: 0.08,
          blur: 16,
          borderOpacity: 0.2,
          borderRadius: 12,
          innerGlow: 0.3,
          bgColor: '#fef2f2',
          fontSize: 13,
          fontFamily: "'Inter', sans-serif",
        },
      },
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 68,
        y: 58,
        width: 5,
        height: 5,
        appearsAt: 4,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: DARK_NAVY,
        triggerLabel: '3',
        tooltipTitle: 'Endocardium',
        tooltipBody:
          'Inner lining of the chambers. Continuous with valve leaflets. May show secondary involvement in severe myocarditis with mural thrombus formation.',
        tooltipPosition: 'right' as const,
        tooltipMaxWidth: 300,
        visualStyle: {
          bgOpacity: 0.08,
          blur: 16,
          borderOpacity: 0.2,
          borderRadius: 12,
          innerGlow: 0.3,
          bgColor: '#eff6ff',
          fontSize: 13,
          fontFamily: "'Inter', sans-serif",
        },
      },
    ],
    audioLayer: medicalTTS(
      'The heart wall comprises three layers. The epicardium is the outermost serous layer. The myocardium, highlighted here in red, is the thick muscular layer responsible for contractile function and the primary site of inflammation in myocarditis. The endocardium lines the interior chambers.',
    ),
    styleOverride: {},
  }

  // ─── 3. Pathophysiology — Inflammatory Cascade ───────────────────────
  const pathophysiologyScene: Scene = {
    ...base(),
    id: ids.pathophysiology,
    name: 'Inflammatory Cascade',
    sceneType: 'canvas2d',
    prompt: 'Pathophysiology of myocarditis: viral entry → immune activation → myocyte necrosis → fibrosis',
    bgColor: '#FFFFFF',
    duration: 20,
    canvasCode: `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;

const stages = [
  { label: 'Viral Entry', sub: 'Coxsackievirus B, Adenovirus,\\nSARS-CoV-2, Parvovirus B19', color: '${NAVY}', icon: 'virus' },
  { label: 'Immune Activation', sub: 'Innate + adaptive response\\nT-cell & macrophage infiltration', color: '${DARK_NAVY}', icon: 'immune' },
  { label: 'Myocyte Necrosis', sub: 'Direct cytopathic effect\\n+ immune-mediated injury', color: '${RED}', icon: 'damage' },
  { label: 'Fibrosis', sub: 'Replacement fibrosis\\nConduction abnormalities', color: '${GREY}', icon: 'scar' },
];

const stageW = 340, stageH = 180, gap = 60;
const totalW = stages.length * stageW + (stages.length - 1) * gap;
const startX = (W - totalW) / 2;
const stageY = H / 2 - stageH / 2 + 20;

let t = 0;
function draw() {
  t += 0.016;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.font = '700 42px Georgia, serif';
  ctx.fillStyle = '${NAVY}';
  ctx.textAlign = 'center';
  ctx.fillText('Pathophysiology of Myocarditis', W / 2, 80);

  stages.forEach((s, i) => {
    const stageDelay = i * 1.2;
    const progress = Math.max(0, Math.min(1, (t - 1 - stageDelay) / 0.8));
    if (progress <= 0) return;

    const sx = startX + i * (stageW + gap);

    ctx.globalAlpha = progress;

    // Box
    ctx.fillStyle = s.color + '0d';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    const r = 12;
    ctx.beginPath();
    ctx.roundRect(sx, stageY, stageW, stageH, r);
    ctx.fill();
    ctx.stroke();

    // Stage number
    ctx.beginPath();
    ctx.arc(sx + stageW / 2, stageY - 22, 20, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.font = '700 16px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), sx + stageW / 2, stageY - 22);
    ctx.textBaseline = 'alphabetic';

    // Label
    ctx.font = '700 22px Georgia, serif';
    ctx.fillStyle = s.color;
    ctx.fillText(s.label, sx + stageW / 2, stageY + 50);

    // Sub-text (handle newlines)
    ctx.font = '400 16px Inter, sans-serif';
    ctx.fillStyle = '${GREY}';
    const lines = s.sub.split('\\\\n');
    lines.forEach((line, li) => {
      ctx.fillText(line, sx + stageW / 2, stageY + 85 + li * 22);
    });

    // Arrow to next stage
    if (i < stages.length - 1) {
      const arrowProgress = Math.max(0, Math.min(1, (t - 1.5 - stageDelay) / 0.5));
      if (arrowProgress > 0) {
        ctx.globalAlpha = arrowProgress;
        const ax = sx + stageW + 5;
        const ay = stageY + stageH / 2;
        ctx.strokeStyle = '${GREY}';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + gap - 10, ay);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(ax + gap - 10, ay - 6);
        ctx.lineTo(ax + gap - 2, ay);
        ctx.lineTo(ax + gap - 10, ay + 6);
        ctx.fillStyle = '${GREY}';
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  });

  // Fig label
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '${GREY}';
  ctx.textAlign = 'left';
  ctx.fillText('Fig. 3 | Inflammatory cascade in myocarditis — from viral entry to replacement fibrosis', 60, H - 40);

  window.__tl.time() < DURATION && requestAnimationFrame(draw);
}
draw();
`,
    audioLayer: medicalTTS(
      'Myocarditis pathophysiology follows a characteristic cascade. Initial viral entry, most commonly coxsackievirus B or adenovirus, triggers innate immune activation. This progresses to direct myocyte necrosis from both viral cytopathic effects and immune-mediated injury. In chronic cases, the inflammatory process culminates in replacement fibrosis, which may impair contractile function and conduction.',
    ),
    styleOverride: {},
  }

  // ─── 4. Clinical Presentation (motion) ───────────────────────────────
  const presentationScene: Scene = {
    ...base(),
    id: ids.presentation,
    name: 'Clinical Presentation',
    sceneType: 'motion',
    prompt: 'Symptoms grid for myocarditis presentation',
    bgColor: '#FFFFFF',
    duration: 15,
    sceneStyles: `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #fff; overflow: hidden; }
      .title { font: 700 42px Georgia, serif; color: ${NAVY}; text-align: center; margin-top: 50px; opacity: 0; animation: fadeSlideUp 0.8s ease 0.3s forwards; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; max-width: 1400px; margin: 50px auto; padding: 0 60px; }
      .card { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 12px; padding: 32px; opacity: 0; animation: fadeSlideUp 0.6s ease forwards; }
      .card:nth-child(1) { animation-delay: 0.8s; }
      .card:nth-child(2) { animation-delay: 1.1s; }
      .card:nth-child(3) { animation-delay: 1.4s; }
      .card:nth-child(4) { animation-delay: 1.7s; }
      .card:nth-child(5) { animation-delay: 2.0s; }
      .card:nth-child(6) { animation-delay: 2.3s; }
      .card-title { font: 600 22px Inter, sans-serif; color: ${NAVY}; margin-bottom: 8px; }
      .card-desc { font: 400 15px Inter, sans-serif; color: ${GREY}; line-height: 1.5; }
      .severity { display: inline-block; font: 500 11px Inter, sans-serif; padding: 3px 10px; border-radius: 20px; margin-top: 12px; }
      .severity.high { background: ${RED}15; color: ${RED}; }
      .severity.moderate { background: ${NAVY}12; color: ${NAVY}; }
      .severity.flag { background: ${RED}; color: #fff; }
      .fig { position: fixed; bottom: 40px; left: 60px; font: italic 13px Georgia, serif; color: ${GREY}; opacity: 0; animation: fadeSlideUp 0.6s ease 2.8s forwards; }
      @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    `,
    sceneHTML: `
      <div class="title">Clinical Presentation</div>
      <div class="grid">
        <div class="card">
          <div class="card-title">Chest Pain</div>
          <div class="card-desc">Occurs in ~70% of cases. Often sharp, pleuritic. May mimic acute coronary syndrome.</div>
          <span class="severity high">High frequency</span>
        </div>
        <div class="card">
          <div class="card-title">Dyspnea</div>
          <div class="card-desc">Reflects myocardial dysfunction. Exertional or at rest in severe cases.</div>
          <span class="severity high">High frequency</span>
        </div>
        <div class="card">
          <div class="card-title">Palpitations</div>
          <div class="card-desc">Arrhythmogenesis from inflammation. PVCs to sustained VT possible.</div>
          <span class="severity moderate">Moderate</span>
        </div>
        <div class="card">
          <div class="card-title">Fatigue</div>
          <div class="card-desc">Systemic inflammatory response. Disproportionate to activity level.</div>
          <span class="severity moderate">Moderate</span>
        </div>
        <div class="card">
          <div class="card-title">Fever</div>
          <div class="card-desc">Low-grade in viral etiology. Suggests active systemic inflammation.</div>
          <span class="severity moderate">Variable</span>
        </div>
        <div class="card">
          <div class="card-title">Syncope</div>
          <div class="card-desc">Hemodynamic compromise or malignant arrhythmia. Requires urgent evaluation.</div>
          <span class="severity flag">Red flag</span>
        </div>
      </div>
      <div class="fig">Fig. 4 | Clinical presentation of acute myocarditis — symptom frequency and severity</div>
    `,
    audioLayer: medicalTTS(
      'Clinical presentation of myocarditis is heterogeneous. Chest pain occurs in approximately seventy percent of cases, often mimicking acute coronary syndrome. Dyspnea and palpitations reflect myocardial dysfunction and arrhythmogenesis respectively. Syncope is a red-flag symptom indicating potential hemodynamic compromise or malignant arrhythmia.',
    ),
    styleOverride: {},
  }

  // ─── 5. Diagnostic Biomarkers (d3 + quiz) ────────────────────────────
  const quizCorrectId = uuidv4()
  const diagnosticScene: Scene = finalizeD3TestScene({
    ...base(),
    id: ids.diagnostic,
    name: 'Diagnostic Biomarkers',
    sceneType: 'd3',
    prompt: 'Bar chart of diagnostic biomarker sensitivity in myocarditis',
    bgColor: '#FFFFFF',
    duration: 20,
    sceneStyles: '',
    chartLayers: [
      singleD3TestChartLayer(
        'chart-main',
        'Diagnostic Biomarkers',
        'horizontalBar',
        [
          { label: 'Troponin I/T', value: 94, color: RED },
          { label: 'CMR (Lake Louise)', value: 91, color: RED },
          { label: 'BNP/NT-proBNP', value: 85, color: NAVY },
          { label: 'CRP', value: 78, color: NAVY },
          { label: 'ESR', value: 72, color: NAVY },
        ],
        {
          title: 'Diagnostic Sensitivity in Acute Myocarditis',
          subtitle: 'Fig. 5 — sensitivity of key diagnostic modalities (%)',
          xLabel: 'Sensitivity (%)',
          valueFormat: ',.0f',
          valueSuffix: '%',
          showValues: true,
          showGrid: true,
          theme: 'light',
          fontFamily: 'Georgia, serif',
          margin: { top: 130, right: 100, bottom: 110, left: 320 },
        },
        20,
        true,
      ),
    ],
    interactions: [
      {
        id: uuidv4(),
        type: 'quiz' as const,
        x: 25,
        y: 52,
        width: 50,
        height: 40,
        appearsAt: 6,
        hidesAt: null,
        entranceAnimation: 'slide-up' as const,
        question: 'Which biomarker has the highest sensitivity for acute myocarditis?',
        options: [
          { id: quizCorrectId, label: 'Troponin I/T' },
          { id: uuidv4(), label: 'CRP' },
          { id: uuidv4(), label: 'ESR' },
          { id: uuidv4(), label: 'BNP/NT-proBNP' },
        ],
        correctOptionId: quizCorrectId,
        onCorrect: 'jump' as const,
        onCorrectSceneId: ids.complications,
        onWrong: 'retry' as const,
        onWrongSceneId: null,
        explanation:
          'Troponin I/T has ~94% sensitivity in acute myocarditis, making it the most sensitive serum biomarker for myocardial injury.',
        visualStyle: {
          bgOpacity: 0.1,
          blur: 18,
          borderOpacity: 0.25,
          borderRadius: 16,
          innerGlow: 0.3,
          bgColor: '#f5f5f5',
          shadowSpread: 24,
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
        },
      },
    ],
    audioLayer: medicalTTS(
      'The diagnostic workup relies on biomarker elevation and cardiac imaging. Troponin I or T demonstrates the highest sensitivity at approximately ninety-four percent. Cardiac MRI using Lake Louise criteria is the gold standard for non-invasive diagnosis. Inflammatory markers including CRP and ESR provide supporting evidence.',
    ),
    styleOverride: {},
  })

  // ─── 6. Complications (canvas2d + gate) ──────────────────────────────
  const complicationsScene: Scene = {
    ...base(),
    id: ids.complications,
    name: 'Complications',
    sceneType: 'canvas2d',
    prompt: 'Four quadrant layout: arrhythmias, DCM, heart failure, sudden cardiac death',
    bgColor: '#FFFFFF',
    duration: 20,
    canvasCode: `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;

const quads = [
  { label: 'Ventricular Arrhythmias', sub: 'VT / VF — most immediate threat', color: '${RED}' },
  { label: 'Dilated Cardiomyopathy', sub: 'Up to 30% of biopsy-proven cases', color: '${NAVY}' },
  { label: 'Acute Heart Failure', sub: 'May require inotropic support', color: '${DARK_NAVY}' },
  { label: 'Sudden Cardiac Death', sub: 'Especially in young athletes', color: '${RED}' },
];

const qw = 700, qh = 340, gapX = 80, gapY = 60;
const startX = (W - 2 * qw - gapX) / 2;
const startY = 160;

let t = 0;
function draw() {
  t += 0.016;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.font = '700 42px Georgia, serif';
  ctx.fillStyle = '${NAVY}';
  ctx.textAlign = 'center';
  ctx.fillText('Adverse Complications', W / 2, 80);

  quads.forEach((q, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const qx = startX + col * (qw + gapX);
    const qy = startY + row * (qh + gapY);
    const delay = i * 0.8;
    const progress = Math.max(0, Math.min(1, (t - 1.5 - delay) / 0.7));
    if (progress <= 0) return;

    ctx.globalAlpha = progress;

    // Box
    ctx.fillStyle = q.color + '08';
    ctx.strokeStyle = q.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(qx, qy, qw, qh, 12);
    ctx.fill();
    ctx.stroke();

    // Warning icon for red items
    if (q.color === '${RED}') {
      ctx.font = '600 28px Inter, sans-serif';
      ctx.fillStyle = '${RED}';
      ctx.textAlign = 'left';
      ctx.fillText('⚠', qx + 24, qy + 42);
    }

    // Label
    ctx.font = '700 26px Georgia, serif';
    ctx.fillStyle = q.color;
    ctx.textAlign = 'center';
    ctx.fillText(q.label, qx + qw / 2, qy + qh / 2 - 15);

    // Sub
    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillStyle = '${GREY}';
    ctx.fillText(q.sub, qx + qw / 2, qy + qh / 2 + 25);

    ctx.globalAlpha = 1;
  });

  // ECG trace in quad 1
  const ecgProgress = Math.max(0, Math.min(1, (t - 2) / 2));
  if (ecgProgress > 0) {
    ctx.globalAlpha = ecgProgress;
    const ex = startX + 60, ey = startY + qh - 70;
    ctx.strokeStyle = '${RED}';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    const ecgLen = (qw - 120) * ecgProgress;
    for (let px = 0; px < ecgLen; px += 2) {
      const phase = (px / 40) % 1;
      let dy = 0;
      if (phase > 0.3 && phase < 0.35) dy = -40;
      else if (phase > 0.35 && phase < 0.45) dy = 25;
      else if (phase > 0.45 && phase < 0.5) dy = -15;
      else dy = Math.sin(px * 0.05) * 2;
      ctx.lineTo(ex + px, ey + dy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Fig label
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '${GREY}';
  ctx.textAlign = 'left';
  ctx.fillText('Fig. 6 | Major adverse complications of myocarditis', 60, H - 40);

  window.__tl.time() < DURATION && requestAnimationFrame(draw);
}
draw();
`,
    interactions: [
      {
        id: uuidv4(),
        type: 'gate' as const,
        x: 35,
        y: 3,
        width: 30,
        height: 7,
        appearsAt: 0.5,
        hidesAt: null,
        entranceAnimation: 'pop' as const,
        buttonLabel: 'Proceed to Complications',
        buttonStyle: 'primary' as const,
        minimumWatchTime: 0,
        visualStyle: {
          bgOpacity: 0.1,
          blur: 16,
          borderOpacity: 0.25,
          borderRadius: 12,
          innerGlow: 0.3,
          bgColor: '#f5f5f5',
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
        },
      },
    ],
    audioLayer: medicalTTS(
      'Myocarditis carries significant risk of adverse sequelae. Ventricular arrhythmias, including ventricular tachycardia and fibrillation, represent the most immediate threat. Progression to dilated cardiomyopathy occurs in up to thirty percent of biopsy-proven cases. Sudden cardiac death remains the most feared complication, particularly in young athletes.',
    ),
    styleOverride: {},
  }

  // ─── 7. Management Algorithm (canvas2d) ──────────────────────────────
  const managementScene: Scene = {
    ...base(),
    id: ids.management,
    name: 'Management Algorithm',
    sceneType: 'canvas2d',
    prompt: 'Severity-stratified treatment flowchart for myocarditis',
    bgColor: '#FFFFFF',
    duration: 20,
    canvasCode: `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = 1920, H = 1080;
c.width = W; c.height = H;

const boxW = 360, boxH = 100, r = 10;

function drawBox(x, y, w, h, label, sub, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color + '0d';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill(); ctx.stroke();
  ctx.font = '700 22px Georgia, serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + (sub ? h / 2 - 8 : h / 2 + 8));
  if (sub) {
    ctx.font = '400 15px Inter, sans-serif';
    ctx.fillStyle = '${GREY}';
    ctx.fillText(sub, x + w / 2, y + h / 2 + 18);
  }
  ctx.globalAlpha = 1;
}

function drawArrow(x1, y1, x2, y2, alpha) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '${GREY}';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2 - 8 * Math.cos(angle - 0.4), y2 - 8 * Math.sin(angle - 0.4));
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(angle + 0.4), y2 - 8 * Math.sin(angle + 0.4));
  ctx.fillStyle = '${GREY}';
  ctx.fill();
  ctx.globalAlpha = 1;
}

let t = 0;
const cx = W / 2;

function draw() {
  t += 0.016;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.font = '700 42px Georgia, serif';
  ctx.fillStyle = '${NAVY}';
  ctx.textAlign = 'center';
  ctx.fillText('Management Algorithm', cx, 70);

  // Top box: Confirmed Myocarditis
  const a0 = Math.min(1, Math.max(0, (t - 0.5) / 0.6));
  drawBox(cx - boxW / 2, 110, boxW, boxH, 'Acute Myocarditis Confirmed', 'EMB or CMR-based diagnosis', '${NAVY}', a0);

  // Arrow down to severity branch
  const a1 = Math.min(1, Math.max(0, (t - 1.2) / 0.4));
  drawArrow(cx, 210, cx, 260, a1);

  // Three severity paths
  const paths = [
    { x: cx - 520, label: 'Mild', sub: 'NSAIDs + Activity restriction', color: '${NAVY}' },
    { x: cx - boxW / 2, label: 'Moderate', sub: 'Immunosuppression + HF therapy', color: '${DARK_NAVY}' },
    { x: cx + 160, label: 'Severe', sub: 'Mechanical circulatory support', color: '${RED}' },
  ];

  paths.forEach((p, i) => {
    const delay = 1.8 + i * 0.6;
    const alpha = Math.min(1, Math.max(0, (t - delay) / 0.6));

    // Branch arrow
    const arrowAlpha = Math.min(1, Math.max(0, (t - delay + 0.2) / 0.4));
    drawArrow(cx, 260, p.x + boxW / 2, 310, arrowAlpha);

    drawBox(p.x, 310, boxW, boxH, p.label, p.sub, p.color, alpha);

    // Follow-up boxes
    const fDelay = delay + 0.8;
    const fAlpha = Math.min(1, Math.max(0, (t - fDelay) / 0.6));
    drawArrow(p.x + boxW / 2, 410, p.x + boxW / 2, 460, fAlpha);

    const followUps = [
      'Close monitoring\\nSerial troponin & echo',
      'GDMT + consider EMB\\nColchicine or azathioprine',
      'IABP / VAD\\nTransplant evaluation',
    ];
    const lines = followUps[i].split('\\\\n');
    const fBoxH = 90;
    drawBox(p.x, 460, boxW, fBoxH, lines[0], lines[1], p.color, fAlpha);
  });

  // Fig label
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '${GREY}';
  ctx.textAlign = 'left';
  ctx.fillText('Fig. 7 | Severity-stratified management algorithm for acute myocarditis', 60, H - 40);

  window.__tl.time() < DURATION && requestAnimationFrame(draw);
}
draw();
`,
    audioLayer: medicalTTS(
      'Management follows a severity-stratified algorithm. Mild cases receive NSAIDs for chest pain and activity restriction. Moderate cases with ventricular dysfunction warrant guideline-directed heart failure therapy and consideration of immunosuppressive agents. Severe hemodynamic compromise may necessitate mechanical circulatory support. Refractory cases should be evaluated for cardiac transplantation.',
    ),
    styleOverride: {},
  }

  // ─── 8. Prognosis & Outcomes (d3) ────────────────────────────────────
  const prognosisScene: Scene = finalizeD3TestScene({
    ...base(),
    id: ids.prognosis,
    name: 'Prognosis & Outcomes',
    sceneType: 'd3',
    prompt: 'Long-term outcome distribution in myocarditis',
    bgColor: '#FFFFFF',
    duration: 15,
    sceneStyles: '',
    chartLayers: [
      singleD3TestChartLayer(
        'chart-main',
        'Prognosis & Outcomes',
        'horizontalBar',
        [
          { label: 'Full Recovery', value: 50, color: NAVY },
          { label: 'Residual Dysfunction', value: 25, color: DARK_NAVY },
          { label: 'Dilated CMP', value: 18, color: GREY },
          { label: 'Transplant / Death', value: 7, color: RED },
        ],
        {
          title: 'Long-term Outcomes in Myocarditis',
          subtitle: 'Fig. 8 — approximate distribution at 5-year follow-up (%)',
          xLabel: 'Share (%)',
          valueFormat: ',.0f',
          valueSuffix: '%',
          showValues: true,
          showGrid: true,
          theme: 'light',
          fontFamily: 'Georgia, serif',
          margin: { top: 130, right: 100, bottom: 110, left: 340 },
        },
        15,
        true,
      ),
    ],
    audioLayer: medicalTTS(
      'Long-term prognosis in myocarditis is variable. Approximately fifty percent of patients achieve full recovery of ventricular function. Twenty-five percent retain residual dysfunction. Eighteen percent progress to dilated cardiomyopathy. Seven percent face transplantation or cardiac death. Early diagnosis and guideline-directed therapy remain the strongest predictors of favorable outcomes.',
    ),
    styleOverride: {},
  })

  return [
    titleScene,
    anatomyScene,
    pathophysiologyScene,
    presentationScene,
    diagnosticScene,
    complicationsScene,
    managementScene,
    prognosisScene,
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Text editing harness — one scene per renderer + SVG / interaction / physics text sources
// ═══════════════════════════════════════════════════════════════════════════════

function harnessOverlay(id: string, content: string, yPct = 12): TextOverlay {
  return {
    id,
    content,
    font: 'Inter, system-ui, sans-serif',
    size: 32,
    color: '#e2e8f0',
    x: 50,
    y: yPct,
    animation: 'fade-in',
    duration: 0.6,
    delay: 0.1,
  }
}

const HARNESS_CANVAS_BG = `
const c = document.getElementById('c');
const ctx = c.getContext('2d');
function draw() {
  ctx.fillStyle = '#0c0c14';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.font = '22px system-ui,sans-serif';
  ctx.fillText('Canvas — use Text tab for overlays', 48, 52);
  if (window.__tl && window.__tl.time() < DURATION) requestAnimationFrame(draw);
}
draw();
`

/** Scenes for testing unified Text tab: overlays, SVG &lt;text&gt;, interactions, physics copy. */
export function createTextEditingHarnessScenes(): Scene[] {
  const lottieUrl = 'https://assets2.lottiefiles.com/packages/lf20_tutvdkg0.json'

  const idSvg = uuidv4()
  const idIx = uuidv4()
  const idMotion = uuidv4()
  const idD3 = uuidv4()
  const idThree = uuidv4()
  const idLottie = uuidv4()
  const idZdog = uuidv4()
  const idPhysics = uuidv4()

  const physLayerId = uuidv4()
  const physLayer: PhysicsLayer = {
    id: physLayerId,
    name: 'Pendulum (harness)',
    simulation: 'pendulum',
    layout: 'split',
    params: {},
    equations: [],
    title: 'Editable physics title',
    narration: 'Editable physics narration — change this in the Text tab.',
  }
  const physCompiled = compilePhysicsSceneFromLayers(idPhysics, physLayer)

  const ixHotspot = uuidv4()
  const ixChoice = uuidv4()
  const ixChoiceOptA = uuidv4()
  const ixChoiceOptB = uuidv4()
  const ixQuiz = uuidv4()
  const ixQuizOptA = uuidv4()
  const ixQuizOptB = uuidv4()
  const ixGate = uuidv4()
  const ixTooltip = uuidv4()
  const ixForm = uuidv4()
  const ixFormField = uuidv4()

  const svgHarness: Scene = {
    ...base(),
    id: idSvg,
    name: 'Harness · SVG (main + object + overlay)',
    sceneType: 'svg',
    prompt: 'Text harness: SVG main, SVG object, overlay',
    bgColor: '#12121a',
    duration: 10,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <rect width="100%" height="100%" fill="#12121a"/>
  <text id="harness-svg-title" x="960" y="220" fill="#e2e8f0" font-size="52" font-family="system-ui,sans-serif" text-anchor="middle">SVG main title (editable)</text>
  <text id="harness-svg-sub" x="960" y="280" fill="#94a3b8" font-size="24" font-family="system-ui,sans-serif" text-anchor="middle">SVG subtitle on main SVG</text>
</svg>`,
    svgObjects: [
      {
        id: 'harness-svg-obj',
        prompt: 'Harness badge',
        svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140"><text id="harness-obj-label" x="260" y="85" text-anchor="middle" fill="#f472b6" font-size="32" font-family="system-ui,sans-serif">SVG object text</text></svg>`,
        x: 8,
        y: 58,
        width: 28,
        opacity: 1,
        zIndex: 6,
      },
    ],
    textOverlays: [harnessOverlay('harness-ol-svg', 'Text overlay on SVG scene', 10)],
  }

  const interactionsHarness: Scene = {
    ...base(),
    id: idIx,
    name: 'Harness · Interactions (all copy fields)',
    sceneType: 'canvas2d',
    prompt: 'Hotspot, choice, quiz, gate, tooltip, form — edit strings in Text tab',
    bgColor: '#0c0c14',
    duration: 30,
    canvasCode: HARNESS_CANVAS_BG,
    textOverlays: [harnessOverlay('harness-ol-ix', 'Overlay on interactions scene', 8)],
    interactions: [
      {
        id: ixHotspot,
        type: 'hotspot',
        x: 8,
        y: 18,
        width: 12,
        height: 8,
        appearsAt: 0.5,
        hidesAt: null,
        entranceAnimation: 'pop',
        label: 'Hotspot label',
        shape: 'pill',
        style: 'pulse',
        color: '#e84545',
        triggersEdgeId: null,
        jumpsToSceneId: null,
      },
      {
        id: ixChoice,
        type: 'choice',
        x: 22,
        y: 16,
        width: 52,
        height: 28,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        question: 'Choice question text?',
        layout: 'horizontal',
        options: [
          { id: ixChoiceOptA, label: 'First option label', icon: null, jumpsToSceneId: idIx, color: '#6366f1' },
          { id: ixChoiceOptB, label: 'Second option label', icon: null, jumpsToSceneId: idIx, color: '#22c55e' },
        ],
      },
      {
        id: ixQuiz,
        type: 'quiz',
        x: 22,
        y: 46,
        width: 52,
        height: 30,
        appearsAt: 1.5,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        question: 'Quiz question text?',
        options: [
          { id: ixQuizOptA, label: 'Wrong answer label' },
          { id: ixQuizOptB, label: 'Correct answer label' },
        ],
        correctOptionId: ixQuizOptB,
        onCorrect: 'continue',
        onCorrectSceneId: null,
        onWrong: 'retry',
        onWrongSceneId: null,
        explanation: 'Quiz explanation text after answer.',
      },
      {
        id: ixGate,
        type: 'gate',
        x: 40,
        y: 78,
        width: 20,
        height: 10,
        appearsAt: 2,
        hidesAt: null,
        entranceAnimation: 'pop',
        buttonLabel: 'Continue gate',
        buttonStyle: 'primary',
        minimumWatchTime: 0.5,
      },
      {
        id: ixTooltip,
        type: 'tooltip',
        x: 72,
        y: 20,
        width: 10,
        height: 10,
        appearsAt: 0.8,
        hidesAt: null,
        entranceAnimation: 'fade',
        triggerShape: 'circle',
        triggerColor: '#38bdf8',
        triggerLabel: '?',
        tooltipTitle: 'Tooltip title',
        tooltipBody: 'Tooltip body copy — editable.',
        tooltipPosition: 'left',
        tooltipMaxWidth: 280,
      },
      {
        id: ixForm,
        type: 'form',
        x: 18,
        y: 72,
        width: 44,
        height: 22,
        appearsAt: 2.5,
        hidesAt: null,
        entranceAnimation: 'slide-up',
        fields: [
          {
            id: ixFormField,
            label: 'Name field label',
            type: 'text',
            placeholder: 'Placeholder text',
            options: [],
            required: false,
          },
        ],
        submitLabel: 'Submit',
        setsVariables: [],
        jumpsToSceneId: null,
      },
    ],
    variables: [],
  }

  const motionHarness: Scene = {
    ...base(),
    id: idMotion,
    name: 'Harness · Motion',
    sceneType: 'motion',
    prompt: 'Motion scene with overlay only for text tab',
    bgColor: '#111827',
    duration: 10,
    sceneStyles: `
      * { margin: 0; box-sizing: border-box; }
      body { min-height: 100vh; background: #111827; font-family: system-ui, sans-serif;
        display: flex; align-items: center; justify-content: center; color: #f1f5f9; }
      h1 { font-size: clamp(32px, 5vw, 56px); margin-bottom: 12px; }
      p { font-size: 18px; opacity: 0.65; }
    `,
    sceneHTML: `<div><h1>Motion harness</h1><p>HTML copy is not in Text tab — use overlays below.</p></div>`,
    sceneCode: `// CSS-only layout`,
    textOverlays: [harnessOverlay('harness-ol-motion', 'Motion overlay text', 11)],
  }

  const d3Harness: Scene = finalizeD3TestScene({
    ...base(),
    id: idD3,
    name: 'Harness · D3',
    sceneType: 'd3',
    prompt: 'D3 chart + overlay',
    bgColor: '#0f172a',
    duration: 12,
    sceneStyles: '',
    chartLayers: [
      singleD3TestChartLayer(
        'chart-main',
        'D3 harness chart',
        'bar',
        [
          { label: 'Alpha', value: 40, color: '#6366f1' },
          { label: 'Beta', value: 65, color: '#22c55e' },
        ],
        {
          title: 'D3 harness chart',
          subtitle: 'Chart titles live in code — overlays in Text tab',
          yLabel: 'Value',
          theme: 'dark',
        },
        12,
        true,
      ),
    ],
    textOverlays: [harnessOverlay('harness-ol-d3', 'D3 scene overlay', 9)],
  })

  const threeHarness: Scene = {
    ...base(),
    id: idThree,
    name: 'Harness · Three.js',
    sceneType: 'three',
    prompt: 'Minimal three + overlay',
    bgColor: '#000008',
    duration: 12,
    sceneCode: `
import * as THREE from 'three';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor(0x000010);
document.body.appendChild(renderer.domElement);
const scene3 = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
camera.position.z = 4;
scene3.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(3, 4, 5);
scene3.add(dir);
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.2, 1.2),
  new THREE.MeshStandardMaterial({ color: 0xe84545, metalness: 0.2, roughness: 0.45 }),
);
scene3.add(mesh);
function animate() {
  const t = window.__tl ? window.__tl.time() : 0;
  mesh.rotation.x = t * 0.7;
  mesh.rotation.y = t * 0.9;
  renderer.render(scene3, camera);
  if (t < DURATION) requestAnimationFrame(animate);
}
animate();
`,
    textOverlays: [harnessOverlay('harness-ol-three', 'Three.js overlay', 10)],
  }

  const lottieHarness: Scene = {
    ...base(),
    id: idLottie,
    name: 'Harness · Lottie',
    sceneType: 'lottie',
    prompt: 'Lottie + overlay',
    bgColor: '#0d0d12',
    duration: 12,
    lottieSource: lottieUrl,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <text id="lottie-harness-cap" x="960" y="90" fill="#a78bfa" font-size="26" font-family="system-ui,sans-serif" text-anchor="middle">Lottie harness caption</text>
</svg>`,
    textOverlays: [harnessOverlay('harness-ol-lottie', 'Lottie overlay', 14)],
  }

  const zdogHarness: Scene = {
    ...base(),
    id: idZdog,
    name: 'Harness · Zdog',
    sceneType: 'zdog',
    prompt: 'Minimal Zdog + overlay',
    bgColor: '#0a0e1a',
    duration: 12,
    sceneCode: `
var canvas = document.getElementById('zdog-canvas');
var illo = new Zdog.Illustration({
  element: canvas,
  zoom: 1.1,
  resize: false,
  width: WIDTH,
  height: HEIGHT,
  rotate: { x: -0.25, y: 0.35 },
});
new Zdog.Shape({ addTo: illo, stroke: 140, color: '#6366f1' });
new Zdog.Shape({ addTo: illo, stroke: 56, translate: { x: 70, y: -20 }, color: '#f472b6' });
function tick() {
  illo.rotate.y += 0.018;
  illo.updateRenderGraph();
  if (window.__tl.time() < DURATION) requestAnimationFrame(tick);
}
tick();
`,
    textOverlays: [harnessOverlay('harness-ol-zdog', 'Zdog overlay', 11)],
  }

  const physicsHarness: Scene = {
    ...base(),
    id: idPhysics,
    name: 'Harness · Physics (title + narration + overlay)',
    sceneType: 'physics',
    prompt: 'Physics layer copy + overlay',
    bgColor: '#0a0e1a',
    duration: 15,
    physicsLayers: [physLayer],
    sceneHTML: physCompiled.sceneHTML,
    sceneCode: physCompiled.sceneCode,
    textOverlays: [harnessOverlay('harness-ol-physics', 'Overlay on physics scene', 6)],
  }

  return [
    svgHarness,
    interactionsHarness,
    motionHarness,
    d3Harness,
    threeHarness,
    lottieHarness,
    zdogHarness,
    physicsHarness,
  ]
}

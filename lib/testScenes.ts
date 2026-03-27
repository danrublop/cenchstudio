import type { Scene } from './types'
import { v4 as uuidv4 } from 'uuid'

function base(): Omit<Scene, 'id' | 'name' | 'sceneType' | 'prompt'> {
  return {
    summary: '',
    svgContent: '',
    canvasCode: '',
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
  }
}

export function createTestScenes(): Scene[] {
  // ─── 1. SVG ────────────────────────────────────────────────────────────────
  const svgScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'TEST — SVG',
    sceneType: 'svg',
    prompt: 'Test SVG scene',
    bgColor: '#ffffff',
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

  <!-- Background grid -->
  <g class="fadein" style="--delay:0s;--dur:0.8s">
    <line x1="480" y1="0" x2="480" y2="1080" stroke="#1e1e2a" stroke-width="1"/>
    <line x1="960" y1="0" x2="960" y2="1080" stroke="#1e1e2a" stroke-width="1"/>
    <line x1="1440" y1="0" x2="1440" y2="1080" stroke="#1e1e2a" stroke-width="1"/>
    <line x1="0" y1="270" x2="1920" y2="270" stroke="#1e1e2a" stroke-width="1"/>
    <line x1="0" y1="540" x2="1920" y2="540" stroke="#1e1e2a" stroke-width="1"/>
    <line x1="0" y1="810" x2="1920" y2="810" stroke="#1e1e2a" stroke-width="1"/>
  </g>

  <!-- Title -->
  <text x="960" y="140" font-family="sans-serif" font-size="72" font-weight="bold"
    fill="#e84545" text-anchor="middle" class="slide-up" style="--delay:0.1s;--dur:0.7s">
    SVG Scene Type Test
  </text>
  <text x="960" y="200" font-family="sans-serif" font-size="32"
    fill="#6b6b7a" text-anchor="middle" class="fadein" style="--delay:0.4s;--dur:0.5s">
    Animation classes: stroke · fadein · scale · slide-up · bounce
  </text>

  <!-- stroke draw-on path -->
  <path d="M 300 350 C 400 250 520 450 620 350 S 820 250 920 350 S 1120 450 1220 350 S 1420 250 1520 350 L 1620 350"
    stroke="#e84545" stroke-width="4" class="stroke" style="--delay:0.6s;--dur:1.5s;--len:1500"/>
  <text x="960" y="410" font-family="sans-serif" font-size="22" fill="#6b6b7a"
    text-anchor="middle" class="fadein" style="--delay:2.2s;--dur:0.4s">stroke draw-on</text>

  <!-- circles: scale + bounce + fadein -->
  <circle cx="320" cy="580" r="60" fill="#e84545" class="scale" style="--delay:1.0s;--dur:0.5s"/>
  <text x="320" y="670" font-family="sans-serif" font-size="20" fill="#f0ece0"
    text-anchor="middle" class="fadein" style="--delay:1.6s;--dur:0.3s">scale</text>

  <circle cx="620" cy="580" r="60" fill="#151515" stroke="#e84545" stroke-width="3"
    class="bounce" style="--delay:1.3s;--dur:0.6s"/>
  <text x="620" y="670" font-family="sans-serif" font-size="20" fill="#f0ece0"
    text-anchor="middle" class="fadein" style="--delay:1.9s;--dur:0.3s">bounce</text>

  <rect x="860" y="520" width="200" height="120" rx="16" fill="#181818" stroke="#e84545" stroke-width="2"
    class="slide-up" style="--delay:1.6s;--dur:0.5s"/>
  <text x="960" y="590" font-family="sans-serif" font-size="20" fill="#f0ece0"
    text-anchor="middle" class="fadein" style="--delay:2.1s;--dur:0.3s">slide-up</text>

  <circle cx="1300" cy="580" r="60" fill="#e84545" opacity="0.7"
    class="fadein" style="--delay:1.9s;--dur:0.7s"/>
  <text x="1300" y="670" font-family="sans-serif" font-size="20" fill="#f0ece0"
    text-anchor="middle" class="fadein" style="--delay:2.6s;--dur:0.3s">fadein</text>

  <polygon points="1600,520 1660,640 1540,640" fill="#e84545"
    class="scale" style="--delay:2.2s;--dur:0.5s"/>
  <text x="1600" y="680" font-family="sans-serif" font-size="20" fill="#f0ece0"
    text-anchor="middle" class="fadein" style="--delay:2.8s;--dur:0.3s">scale</text>

  <!-- Bottom label -->
  <text x="960" y="980" font-family="sans-serif" font-size="24" fill="#3a3a45"
    text-anchor="middle" class="fadein" style="--delay:3.0s;--dur:0.5s">✓ All SVG animation classes working</text>
</svg>`,
    svgBranches: [],
    activeBranchId: null,
    svgObjects: [],
    primaryObjectId: null,
  }

  // ─── 2. Canvas 2D ─────────────────────────────────────────────────────────
  const canvasScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'TEST — Canvas 2D',
    sceneType: 'canvas2d',
    prompt: 'Test Canvas 2D scene',
    bgColor: '#ffffff',
    canvasCode: `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const DURATION = 8;
const START_T = parseFloat(new URLSearchParams(location.search).get('t') || '0');
const startWall = performance.now() - START_T * 1000;

function getT() { return (performance.now() - startWall) / 1000; }

const easeOut = t => 1 - Math.pow(1 - t, 3);
const lerp    = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.max(0, Math.min(1, t));

function draw(t) {
  ctx.clearRect(0, 0, 1920, 1080);

  // Title
  ctx.globalAlpha = easeOut(clamp01(t / 0.6));
  ctx.fillStyle = '#e84545';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Canvas 2D Scene Type Test', 960, 120);

  ctx.fillStyle = '#6b6b7a';
  ctx.font = '32px sans-serif';
  ctx.fillText('requestAnimationFrame loop · easing helpers · window.__bgColor', 960, 180);
  ctx.globalAlpha = 1;

  // Animated wave
  const waveAlpha = easeOut(clamp01((t - 0.3) / 0.5));
  ctx.globalAlpha = waveAlpha;
  ctx.strokeStyle = '#e84545';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 0; x <= 1920; x += 4) {
    const phase = (x / 1920) * Math.PI * 4 - t * 2;
    const y = 320 + Math.sin(phase) * 60 * Math.sin(Math.PI * clamp01(t / 1.5));
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Orbiting particles
  const numParticles = 8;
  const colors = ['#e84545', '#f0ece0', '#6b6b7a', '#3a3a45'];
  for (let i = 0; i < numParticles; i++) {
    const delay = i * 0.15;
    const a = easeOut(clamp01((t - 0.5 - delay) / 0.5));
    if (a <= 0) continue;
    const angle = (i / numParticles) * Math.PI * 2 + t * 0.8;
    const r = lerp(0, 220, easeOut(clamp01((t - 0.5 - delay) / 0.6)));
    const cx = 960 + Math.cos(angle) * r;
    const cy = 620 + Math.sin(angle) * r * 0.5;
    ctx.globalAlpha = a;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Center pulsing ring
  const ringA = easeOut(clamp01((t - 0.4) / 0.5));
  const ringR = lerp(0, 80, easeOut(clamp01((t - 0.4) / 0.8)));
  ctx.globalAlpha = ringA;
  ctx.strokeStyle = '#e84545';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(960, 620, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Bar chart
  const barData = [0.6, 0.85, 0.45, 0.95, 0.7, 0.55, 0.8];
  const barW = 80, barGap = 30, startX = 960 - (barData.length * (barW + barGap)) / 2 + barGap / 2;
  barData.forEach((val, i) => {
    const delay = 1.2 + i * 0.12;
    const p = easeOut(clamp01((t - delay) / 0.6));
    const h = val * 200 * p;
    const x = startX + i * (barW + barGap);
    ctx.globalAlpha = p;
    ctx.fillStyle = i % 2 === 0 ? '#e84545' : '#3a3a45';
    ctx.fillRect(x, 900 - h, barW, h);
    ctx.globalAlpha = 1;
  });

  // Footer
  const footerA = easeOut(clamp01((t - 3.0) / 0.5));
  ctx.globalAlpha = footerA;
  ctx.fillStyle = '#3a3a45';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✓ Canvas 2D working — rAF loop, easing, __bgColor wired', 960, 1040);
  ctx.globalAlpha = 1;
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

  // ─── 3. Motion ────────────────────────────────────────────────────────────
  const motionScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'TEST — Motion',
    sceneType: 'motion',
    prompt: 'Test Motion scene',
    bgColor: '#ffffff',
    sceneStyles: `
      #title { font-family:sans-serif; font-size:72px; font-weight:bold; color:#e84545;
        text-align:center; position:absolute; left:0; right:0; top:80px; opacity:0; }
      #sub { font-family:sans-serif; font-size:32px; color:#6b6b7a;
        text-align:center; position:absolute; left:0; right:0; top:180px; opacity:0; }
      .box { position:absolute; border-radius:16px; opacity:0; }
      #b1 { width:200px; height:200px; background:#e84545; left:200px; top:350px; }
      #b2 { width:200px; height:200px; background:#181818; border:3px solid #e84545; left:500px; top:350px; }
      #b3 { width:200px; height:200px; background:#151515; left:800px; top:350px; }
      #b4 { width:200px; height:200px; background:#e84545; opacity:0.5; left:1100px; top:350px; }
      #b5 { width:200px; height:200px; background:#f0ece0; left:1400px; top:350px; }
      .label { font-family:sans-serif; font-size:22px; color:#6b6b7a;
        position:absolute; text-align:center; opacity:0; }
      #footer { font-family:sans-serif; font-size:24px; color:#3a3a45;
        text-align:center; position:absolute; left:0; right:0; bottom:50px; opacity:0; }
    `,
    sceneHTML: `
      <div id="title">Motion.js + Anime.js Scene Type Test</div>
      <div id="sub">animate() · stagger() · timeline() · spring easing</div>
      <div id="b1" class="box"></div>
      <div id="b2" class="box"></div>
      <div id="b3" class="box"></div>
      <div id="b4" class="box"></div>
      <div id="b5" class="box"></div>
      <div class="label" id="l1" style="left:200px;top:570px;width:200px">Motion animate()</div>
      <div class="label" id="l2" style="left:500px;top:570px;width:200px">anime stagger</div>
      <div class="label" id="l3" style="left:800px;top:570px;width:200px">spring easing</div>
      <div class="label" id="l4" style="left:1100px;top:570px;width:200px">opacity anim</div>
      <div class="label" id="l5" style="left:1400px;top:570px;width:200px">scale+rotate</div>
      <div id="footer">✓ Motion library working</div>
    `,
    sceneCode: `
      // Motion animate
      animate('#title', { opacity: [0, 1], y: [40, 0] }, { duration: 0.7, easing: 'ease-out' });
      animate('#sub',   { opacity: [0, 1] }, { duration: 0.5, delay: 0.4, easing: 'ease-out' });

      // Box 1: Motion animate with spring
      animate('#b1', { opacity: [0, 1], scale: [0, 1] }, { duration: 0.6, delay: 0.6, easing: 'spring(1, 100, 10, 0)' });
      animate('#l1', { opacity: [0, 1] }, { duration: 0.4, delay: 1.3 });

      // Boxes 2-5: anime stagger
      anime({
        targets: ['#b2','#b3','#b4','#b5'],
        opacity: [0, 1],
        translateY: [60, 0],
        delay: anime.stagger(150, { start: 800 }),
        duration: 600,
        easing: 'easeOutCubic',
      });
      anime({
        targets: ['#l2','#l3','#l4','#l5'],
        opacity: [0, 1],
        delay: anime.stagger(150, { start: 1600 }),
        duration: 400,
        easing: 'easeOutCubic',
      });

      // Box 3: continuous spring bounce
      setTimeout(() => {
        anime({
          targets: '#b3',
          translateY: [-20, 0],
          direction: 'alternate',
          loop: true,
          duration: 800,
          easing: 'easeInOutSine',
        });
      }, 1400);

      // Box 5: rotate
      animate('#b5', { rotate: [0, 360] }, { duration: 2, delay: 1.5, repeat: Infinity, easing: 'linear' });

      // Footer
      animate('#footer', { opacity: [0, 1] }, { duration: 0.5, delay: 3.5 });
    `,
  }

  // ─── 4. D3 ────────────────────────────────────────────────────────────────
  const d3Scene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'TEST — D3',
    sceneType: 'd3',
    prompt: 'Test D3 scene',
    bgColor: '#ffffff',
    d3Data: [
      { label: 'SVG',     value: 92 },
      { label: 'Canvas',  value: 78 },
      { label: 'Motion',  value: 65 },
      { label: 'D3',      value: 88 },
      { label: 'Three.js',value: 71 },
      { label: 'Lottie',  value: 55 },
    ],
    sceneStyles: '',
    sceneCode: `
const margin = { top: 140, right: 80, bottom: 160, left: 120 };
const w = WIDTH - margin.left - margin.right;
const h = HEIGHT - margin.top - margin.bottom;

const svg = d3.select('#chart')
  .append('svg')
  .attr('viewBox', \`0 0 \${WIDTH} \${HEIGHT}\`)
  .attr('width', '100%')
  .attr('height', '100%');

const g = svg.append('g')
  .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

// Title
svg.append('text')
  .attr('x', WIDTH / 2).attr('y', 80)
  .attr('text-anchor', 'middle')
  .attr('font-family', 'sans-serif').attr('font-size', 56).attr('font-weight', 'bold')
  .attr('fill', '#e84545').attr('opacity', 0)
  .text('D3 Scene Type Test')
  .transition().duration(600).attr('opacity', 1);

svg.append('text')
  .attr('x', WIDTH / 2).attr('y', 128)
  .attr('text-anchor', 'middle')
  .attr('font-family', 'sans-serif').attr('font-size', 28)
  .attr('fill', '#6b6b7a').attr('opacity', 0)
  .text('Animated bar chart — transitions, stagger, scales')
  .transition().delay(300).duration(500).attr('opacity', 1);

const x = d3.scaleBand()
  .domain(DATA.map(d => d.label))
  .range([0, w]).padding(0.3);

const y = d3.scaleLinear()
  .domain([0, 100]).range([h, 0]);

// Gridlines
g.append('g').attr('class', 'grid')
  .call(d3.axisLeft(y).tickSize(-w).tickFormat(''))
  .selectAll('line').attr('stroke', '#1e1e2a').attr('stroke-width', 1);
g.select('.grid .domain').remove();

// X axis
g.append('g').attr('transform', \`translate(0,\${h})\`)
  .call(d3.axisBottom(x))
  .selectAll('text')
  .attr('font-family', 'sans-serif').attr('font-size', 24).attr('fill', '#6b6b7a');

// Y axis
g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%'))
  .selectAll('text')
  .attr('font-family', 'sans-serif').attr('font-size', 20).attr('fill', '#6b6b7a');

// Bars
g.selectAll('.bar')
  .data(DATA)
  .enter().append('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.label))
  .attr('width', x.bandwidth())
  .attr('y', h).attr('height', 0)
  .attr('fill', (d, i) => i % 2 === 0 ? '#e84545' : '#3a3a45')
  .attr('rx', 8)
  .transition().duration(700)
  .delay((d, i) => 400 + i * 120)
  .ease(d3.easeCubicOut)
  .attr('y', d => y(d.value))
  .attr('height', d => h - y(d.value));

// Value labels
g.selectAll('.val-label')
  .data(DATA)
  .enter().append('text')
  .attr('class', 'val-label')
  .attr('x', d => x(d.label) + x.bandwidth() / 2)
  .attr('y', d => y(d.value) - 16)
  .attr('text-anchor', 'middle')
  .attr('font-family', 'sans-serif').attr('font-size', 26).attr('font-weight', 'bold')
  .attr('fill', '#f0ece0').attr('opacity', 0)
  .text(d => d.value + '%')
  .transition().duration(400)
  .delay((d, i) => 900 + i * 120)
  .attr('opacity', 1);

// Footer
svg.append('text')
  .attr('x', WIDTH / 2).attr('y', HEIGHT - 30)
  .attr('text-anchor', 'middle')
  .attr('font-family', 'sans-serif').attr('font-size', 24)
  .attr('fill', '#3a3a45').attr('opacity', 0)
  .text('✓ D3 v7 working — scales, axes, transitions, stagger')
  .transition().delay(2000).duration(500).attr('opacity', 1);
`,
  }

  // ─── 5. Three.js ──────────────────────────────────────────────────────────
  const threeScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'TEST — Three.js',
    sceneType: 'three',
    prompt: 'Test Three.js scene',
    bgColor: '#ffffff',
    sceneCode: `
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor(0x0d0d12);
document.body.appendChild(renderer.domElement);

const scene3 = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 0, 8);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene3.add(ambient);
const dirLight = new THREE.DirectionalLight(0xe84545, 1.2);
dirLight.position.set(5, 5, 5);
scene3.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight2.position.set(-5, -3, 3);
scene3.add(dirLight2);

// Central torus knot
const torusGeo = new THREE.TorusKnotGeometry(1.5, 0.4, 128, 32);
const torusMat = new THREE.MeshStandardMaterial({ color: 0xe84545, roughness: 0.3, metalness: 0.7 });
const torus = new THREE.Mesh(torusGeo, torusMat);
scene3.add(torus);

// Orbiting spheres
const spheres = [];
const sphereColors = [0xe84545, 0xf0ece0, 0x6b6b7a, 0x3a3a45, 0x181818];
for (let i = 0; i < 5; i++) {
  const geo = new THREE.SphereGeometry(0.25, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ color: sphereColors[i], roughness: 0.4, metalness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  scene3.add(mesh);
  spheres.push(mesh);
}

// Background icosahedra
const bgGeos = [];
for (let i = 0; i < 20; i++) {
  const geo = new THREE.IcosahedronGeometry(Math.random() * 0.2 + 0.05, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1e1e2a, roughness: 0.8, wireframe: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 10 - 5);
  scene3.add(mesh);
  bgGeos.push(mesh);
}

const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  const delta = clock.getDelta();
  elapsed += delta;
  if (elapsed >= DURATION) {
    renderer.render(scene3, camera);
    return;
  }

  // Torus rotation
  torus.rotation.x += delta * 0.5;
  torus.rotation.y += delta * 0.7;

  // Orbiting spheres
  spheres.forEach((s, i) => {
    const angle = (i / spheres.length) * Math.PI * 2 + elapsed * 0.8;
    const r = 3.2;
    s.position.set(
      Math.cos(angle) * r,
      Math.sin(angle * 0.7) * 1.5,
      Math.sin(angle) * r * 0.5
    );
    s.rotation.y += delta;
  });

  // Drift bg geos
  bgGeos.forEach((m, i) => {
    m.rotation.x += delta * (0.1 + i * 0.005);
    m.rotation.z += delta * (0.05 + i * 0.003);
  });

  renderer.render(scene3, camera);
  window.__animFrame = requestAnimationFrame(animate);
}

window.__resume = () => { clock.getDelta(); window.__animFrame = requestAnimationFrame(animate); };
window.__animFrame = requestAnimationFrame(animate);
`,
  }

  // ─── 6. Lottie ────────────────────────────────────────────────────────────
  // Using a public Lottie animation URL for testing
  const lottieScene: Scene = {
    ...base(),
    id: uuidv4(),
    name: 'TEST — Lottie',
    sceneType: 'lottie',
    prompt: 'Test Lottie scene overlay',
    bgColor: '#ffffff',
    // A simple public Lottie JSON from LottieFiles CDN
    lottieSource: 'https://assets10.lottiefiles.com/packages/lf20_jcikwtux.json',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <style>
      .fadein { opacity:0; animation:pop 0.6s ease var(--delay,0s) forwards; }
      .stroke { fill:none; stroke-dasharray:var(--len,500); stroke-dashoffset:var(--len,500);
        animation:draw 1s ease-in-out var(--delay,0s) forwards; }
      @keyframes pop  { to { opacity:1; } }
      @keyframes draw { to { stroke-dashoffset:0; } }
    </style>
  </defs>

  <!-- Top label -->
  <text x="960" y="80" font-family="sans-serif" font-size="52" font-weight="bold"
    fill="#e84545" text-anchor="middle" class="fadein" style="--delay:0.3s">
    Lottie Scene Type Test
  </text>

  <!-- Corner bracket annotations -->
  <path d="M 60 60 L 60 160 M 60 60 L 160 60" stroke="#e84545" stroke-width="4" stroke-linecap="round"
    class="stroke" style="--delay:0.5s;--len:200"/>
  <path d="M 1860 60 L 1860 160 M 1860 60 L 1760 60" stroke="#e84545" stroke-width="4" stroke-linecap="round"
    class="stroke" style="--delay:0.7s;--len:200"/>
  <path d="M 60 1020 L 60 920 M 60 1020 L 160 1020" stroke="#e84545" stroke-width="4" stroke-linecap="round"
    class="stroke" style="--delay:0.9s;--len:200"/>
  <path d="M 1860 1020 L 1860 920 M 1860 1020 L 1760 1020" stroke="#e84545" stroke-width="4" stroke-linecap="round"
    class="stroke" style="--delay:1.1s;--len:200"/>

  <!-- Footer label -->
  <text x="960" y="1050" font-family="sans-serif" font-size="28" fill="#3a3a45"
    text-anchor="middle" class="fadein" style="--delay:1.5s">
    ✓ Lottie player + SVG overlay working
  </text>
</svg>`,
  }

  return [svgScene, canvasScene, motionScene, d3Scene, threeScene, lottieScene]
}

// ── Interactive test scenes (one per interaction type) ──────────────────────

export function createInteractiveTestScenes(): Scene[] {
  // Pre-generate IDs so scenes can reference each other
  const ids = {
    hotspot: uuidv4(),
    choice: uuidv4(),
    quiz: uuidv4(),
    gate: uuidv4(),
    tooltip: uuidv4(),
    form: uuidv4(),
  }

  const makeSvg = (title: string, subtitle: string, color = '#e84545') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs><style>
    .fadein { opacity:0; animation:pop 0.5s ease var(--delay,0s) forwards; }
    @keyframes pop { to { opacity:1; } }
  </style></defs>
  <rect width="1920" height="1080" fill="#f8f8f8" class="fadein" style="--delay:0s"/>
  <text x="960" y="200" font-family="sans-serif" font-size="72" font-weight="bold" fill="${color}" text-anchor="middle" class="fadein" style="--delay:0.2s">${title}</text>
  <text x="960" y="280" font-family="sans-serif" font-size="32" fill="#6b6b7a" text-anchor="middle" class="fadein" style="--delay:0.5s">${subtitle}</text>
  <line x1="400" y1="320" x2="1520" y2="320" stroke="#e0e0e0" stroke-width="2" class="fadein" style="--delay:0.7s"/>
  <text x="960" y="1040" font-family="sans-serif" font-size="20" fill="#aaa" text-anchor="middle" class="fadein" style="--delay:1s">Interactive test scene — switch to Interactive mode to see overlays</text>
</svg>`

  // ─── 1. Hotspot scene ──────────────────────────────────────────────────
  const hotspotScene: Scene = {
    ...base(),
    id: ids.hotspot,
    name: 'TEST — Hotspot',
    sceneType: 'svg',
    prompt: 'Hotspot interaction test',
    svgContent: makeSvg('Hotspot Test', 'Click the pulsing hotspot to jump to the Choice scene'),
    interactions: [
      {
        id: uuidv4(),
        type: 'hotspot' as const,
        x: 40, y: 45, width: 20, height: 15,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'pop' as const,
        label: 'Click me!',
        shape: 'pill' as const,
        style: 'pulse' as const,
        color: '#e84545',
        triggersEdgeId: null,
        jumpsToSceneId: ids.choice,
      },
    ],
    variables: [],
  }

  // ─── 2. Choice scene ──────────────────────────────────────────────────
  const choiceScene: Scene = {
    ...base(),
    id: ids.choice,
    name: 'TEST — Choice',
    sceneType: 'svg',
    prompt: 'Choice interaction test',
    svgContent: makeSvg('Choice Test', 'Pick an option below — each leads to a different scene', '#3b82f6'),
    interactions: [
      {
        id: uuidv4(),
        type: 'choice' as const,
        x: 25, y: 40, width: 50, height: 30,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'slide-up' as const,
        question: 'Where would you like to go?',
        layout: 'vertical' as const,
        options: [
          { id: uuidv4(), label: '📝 Take the Quiz', icon: null, jumpsToSceneId: ids.quiz, color: '#8b5cf6' },
          { id: uuidv4(), label: '🚪 Go to Gate', icon: null, jumpsToSceneId: ids.gate, color: '#10b981' },
          { id: uuidv4(), label: '📋 Fill out a Form', icon: null, jumpsToSceneId: ids.form, color: '#ec4899' },
        ],
      },
    ],
    variables: [],
  }

  // ─── 3. Quiz scene ────────────────────────────────────────────────────
  const quizScene: Scene = {
    ...base(),
    id: ids.quiz,
    name: 'TEST — Quiz',
    sceneType: 'svg',
    prompt: 'Quiz interaction test',
    svgContent: makeSvg('Quiz Test', 'Answer the question correctly to continue', '#8b5cf6'),
    interactions: [
      {
        id: uuidv4(),
        type: 'quiz' as const,
        x: 25, y: 35, width: 50, height: 40,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
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
      },
    ],
    variables: [],
  }

  // ─── 4. Gate scene ────────────────────────────────────────────────────
  const gateScene: Scene = {
    ...base(),
    id: ids.gate,
    name: 'TEST — Gate',
    sceneType: 'svg',
    prompt: 'Gate interaction test',
    svgContent: makeSvg('Gate Test', 'The animation pauses and a Continue button appears at 3s', '#10b981'),
    interactions: [
      {
        id: uuidv4(),
        type: 'gate' as const,
        x: 40, y: 50, width: 20, height: 10,
        appearsAt: 3,
        hidesAt: null,
        entranceAnimation: 'pop' as const,
        buttonLabel: 'Continue →',
        buttonStyle: 'primary' as const,
        minimumWatchTime: 2,
      },
    ],
    variables: [],
  }

  // ─── 5. Tooltip scene ─────────────────────────────────────────────────
  const tooltipScene: Scene = {
    ...base(),
    id: ids.tooltip,
    name: 'TEST — Tooltip',
    sceneType: 'svg',
    prompt: 'Tooltip interaction test',
    svgContent: makeSvg('Tooltip Test', 'Hover over the blue indicators to see tooltips', '#06b6d4'),
    interactions: [
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 25, y: 45, width: 8, height: 8,
        appearsAt: 0.5,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: '#06b6d4',
        triggerLabel: '?',
        tooltipTitle: 'Tooltip #1',
        tooltipBody: 'This is a tooltip overlay. It appears on hover and can show detailed information about any part of the scene.',
        tooltipPosition: 'right' as const,
        tooltipMaxWidth: 250,
      },
      {
        id: uuidv4(),
        type: 'tooltip' as const,
        x: 65, y: 45, width: 8, height: 8,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        triggerShape: 'circle' as const,
        triggerColor: '#3b82f6',
        triggerLabel: 'i',
        tooltipTitle: 'Tooltip #2',
        tooltipBody: 'Multiple tooltips can exist on the same scene. Each has independent position, timing, and content.',
        tooltipPosition: 'left' as const,
        tooltipMaxWidth: 250,
      },
    ],
    variables: [],
  }

  // ─── 6. Form scene ────────────────────────────────────────────────────
  const formScene: Scene = {
    ...base(),
    id: ids.form,
    name: 'TEST — Form',
    sceneType: 'svg',
    prompt: 'Form interaction test',
    svgContent: makeSvg('Form Test', 'Fill out the form — values become variables for subsequent scenes', '#ec4899'),
    interactions: [
      {
        id: uuidv4(),
        type: 'form' as const,
        x: 25, y: 35, width: 50, height: 45,
        appearsAt: 1,
        hidesAt: null,
        entranceAnimation: 'slide-up' as const,
        fields: [
          { id: 'name_field', label: 'Your Name', type: 'text' as const, placeholder: 'Enter your name...', options: [], required: true },
          { id: 'role_field', label: 'Role', type: 'select' as const, placeholder: null, options: ['Designer', 'Developer', 'Product Manager', 'Other'], required: true },
          { id: 'exp_field', label: 'Experience Level', type: 'radio' as const, placeholder: null, options: ['Beginner', 'Intermediate', 'Advanced'], required: false },
        ],
        submitLabel: 'Submit & Continue →',
        setsVariables: [
          { fieldId: 'name_field', variableName: 'userName' },
          { fieldId: 'role_field', variableName: 'userRole' },
          { fieldId: 'exp_field', variableName: 'userExp' },
        ],
        jumpsToSceneId: ids.hotspot, // loop back to start
      },
    ],
    variables: [
      { name: 'userName' },
      { name: 'userRole' },
      { name: 'userExp' },
    ],
  }

  return [hotspotScene, choiceScene, quizScene, gateScene, tooltipScene, formScene]
}

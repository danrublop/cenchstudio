/**
 * One project, four scenes — same narrative (technical pipeline + chart cue),
 * different renderers: svg | motion | canvas2d | zdog (composed, no LLM).
 *
 * Usage: node scripts/create-renderer-comparison-project.mjs
 * Requires: npm run dev, POST /api/generate-zdog (composed mode, no API key)
 */

const apiBase = process.env.CENCH_BASE_URL || 'http://localhost:3000'

const C = {
  bg: '#121212',
  ink: '#f0ece0',
  accent: '#e84545',
  muted: '#2a2a2a',
}

const DURATION = 10

async function j(method, path, body) {
  const res = await fetch(apiBase + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data).slice(0, 600)}`)
  return data
}

function svgTechnicalExplainer() {
  return `<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <g id="bg">
    <rect width="1920" height="1080" fill="${C.bg}" class="fadein" style="--dur:0.5s;--delay:0s"/>
    <rect x="80" y="80" width="1760" height="920" rx="24" fill="none" stroke="${C.muted}" stroke-width="3" class="fadein" style="--dur:0.55s;--delay:0.12s"/>
  </g>
  <g id="midground">
    <rect x="140" y="380" width="340" height="160" rx="16" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.8s;--delay:0.65s"/>
    <rect x="790" y="380" width="340" height="160" rx="16" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.8s;--delay:1.05s"/>
    <rect x="1440" y="380" width="340" height="160" rx="16" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.8s;--delay:1.45s"/>
    <line x1="480" y1="460" x2="790" y2="460" stroke="${C.accent}" stroke-width="7" class="stroke" style="--dur:0.6s;--delay:1.85s"/>
    <polygon points="790,460 752,436 752,484" fill="${C.accent}" class="fadein" style="--dur:0.3s;--delay:2.1s"/>
    <line x1="1130" y1="460" x2="1440" y2="460" stroke="${C.accent}" stroke-width="7" class="stroke" style="--dur:0.6s;--delay:2.25s"/>
    <polygon points="1440,460 1402,436 1402,484" fill="${C.accent}" class="fadein" style="--dur:0.3s;--delay:2.5s"/>
  </g>
  <g id="text">
    <text x="960" y="160" fill="${C.ink}" font-size="64" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.5s;--delay:0.2s">Comparison · SVG</text>
    <text x="960" y="230" fill="${C.ink}" font-size="30" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.4s;--delay:0.5s">Ingest → transform → serve</text>
    <text x="310" y="470" fill="${C.ink}" font-size="36" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.4s;--delay:0.95s">Ingest</text>
    <text x="960" y="470" fill="${C.ink}" font-size="36" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.4s;--delay:1.25s">Transform</text>
    <text x="1610" y="470" fill="${C.ink}" font-size="36" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.4s;--delay:1.55s">Serve</text>
  </g>
</svg>`
}

/** Motion: DOM built with createElement + GSAP __tl (POST /api/scene does not set sceneHTML). */
function motionSceneCode() {
  return `
const INK = '${C.ink}';
const ACCENT = '${C.accent}';

const st = document.createElement('style');
st.textContent = '#cmp-motion-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(12px,2vh,28px);padding:clamp(16px,3vw,48px);font-family:Arial,Helvetica,sans-serif;color:' + INK + ';box-sizing:border-box;}' +
  '#cmp-motion-wrap h1{font-size:clamp(22px,3.2vw,56px);margin:0;font-weight:700;text-align:center;opacity:0;}' +
  '#cmp-motion-wrap .row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:clamp(8px,1.5vw,24px);width:100%;max-width:min(92vw,1600px);}' +
  '#cmp-motion-wrap .card{flex:1 1 200px;min-height:clamp(100px,14vh,180px);border:3px solid ' + INK + ';border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:clamp(16px,2vw,32px);opacity:0;transform:scale(0.94);background:rgba(255,255,255,0.03);}' +
  '#cmp-motion-wrap .arrow{font-size:clamp(24px,3vw,48px);color:' + ACCENT + ';opacity:0;font-weight:700;}' +
  '#cmp-motion-wrap .sub{font-size:clamp(14px,1.6vw,26px);opacity:0;text-align:center;max-width:56ch;}';
document.head.appendChild(st);

const cam = document.getElementById('scene-camera');
const wrap = document.createElement('div');
wrap.id = 'cmp-motion-wrap';

const h1 = document.createElement('h1');
h1.id = 'cmp-m-title';
h1.textContent = 'Comparison · Motion (HTML/CSS)';

const sub = document.createElement('p');
sub.className = 'sub';
sub.id = 'cmp-m-sub';
sub.textContent = 'Same pipeline story — DOM layout + GSAP timeline';

const row = document.createElement('div');
row.className = 'row';

function card(label) {
  const d = document.createElement('div');
  d.className = 'card';
  d.textContent = label;
  return d;
}
function arrow() {
  const s = document.createElement('span');
  s.className = 'arrow';
  s.textContent = '\u2192';
  return s;
}

row.appendChild(card('Ingest'));
const a1 = arrow();
a1.id = 'cmp-a1';
row.appendChild(a1);
row.appendChild(card('Transform'));
const a2 = arrow();
a2.id = 'cmp-a2';
row.appendChild(a2);
row.appendChild(card('Serve'));

wrap.appendChild(h1);
wrap.appendChild(sub);
wrap.appendChild(row);
cam.insertBefore(wrap, cam.firstChild);

const els = {
  title: document.getElementById('cmp-m-title'),
  sub: document.getElementById('cmp-m-sub'),
  cards: wrap.querySelectorAll('.card'),
  a1: document.getElementById('cmp-a1'),
  a2: document.getElementById('cmp-a2'),
};

function fade(el, t, a, b) {
  if (!el) return;
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  el.style.opacity = String(x);
  const sc = 0.94 + 0.06 * x;
  if (el.classList && el.classList.contains('card')) el.style.transform = 'scale(' + sc + ')';
}

const dur = typeof window !== 'undefined' && window.DURATION != null ? window.DURATION : 10;
const proxy = { p: 0 };

if (window.__tl) {
  window.__tl.to(proxy, {
    p: 1,
    duration: dur,
    ease: 'none',
    onUpdate: function () {
      const t = proxy.p;
      fade(els.title, t, 0.02, 0.12);
      fade(els.sub, t, 0.08, 0.18);
      const cs = els.cards;
      fade(cs[0], t, 0.14, 0.28);
      fade(els.a1, t, 0.22, 0.32);
      fade(cs[1], t, 0.26, 0.4);
      fade(els.a2, t, 0.34, 0.44);
      fade(cs[2], t, 0.38, 0.52);
    },
  }, 0);
}
`
}

function canvasPipelineCode() {
  return `
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const START_T = parseFloat(new URLSearchParams(location.search).get('t') || '0');
const startWall = performance.now() - START_T * 1000;
function getT() { return (performance.now() - startWall) / 1000; }

const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp01 = t => Math.max(0, Math.min(1, t));

const INK = '${C.ink}';
const ACCENT = '${C.accent}';
const MUTED = '${C.muted}';

function draw(t) {
  ctx.clearRect(0, 0, 1920, 1080);
  ctx.strokeStyle = MUTED;
  ctx.lineWidth = 3;
  roundRect(ctx, 80, 80, 1760, 920, 24);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.globalAlpha = clamp01((t - 0.2) / 0.25);
  ctx.fillText('Comparison · Canvas2D', 960, 160);
  ctx.globalAlpha = 1;

  ctx.font = '30px Arial';
  ctx.globalAlpha = clamp01((t - 0.35) / 0.2);
  ctx.fillText('Ingest → transform → serve', 960, 230);
  ctx.globalAlpha = 1;

  const cards = [
    { x: 140, label: 'Ingest', start: 0.5 },
    { x: 790, label: 'Transform', start: 0.65 },
    { x: 1440, label: 'Serve', start: 0.8 },
  ];
  cards.forEach((c) => {
    const u = easeOut(clamp01((t - c.start) / 0.35));
    ctx.globalAlpha = u;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    roundRect(ctx, c.x, 380, 340, 160, 16);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '36px Arial';
    ctx.fillText(c.label, c.x + 170, 470);
  });
  ctx.globalAlpha = 1;

  const a1 = clamp01((t - 0.95) / 0.25);
  const a2 = clamp01((t - 1.1) / 0.25);
  drawArrow(ctx, 480, 460, 790, 460, a1);
  drawArrow(ctx, 1130, 460, 1440, 460, a2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArrow(ctx, x1, y1, x2, y2, alpha) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const s = 18;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - s * Math.cos(ang - 0.45), y2 - s * Math.sin(ang - 0.45));
  ctx.lineTo(x2 - s * Math.cos(ang + 0.45), y2 - s * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function loop() {
  const t = getT();
  const dur = typeof DURATION !== 'undefined' ? DURATION : 10;
  if (t < dur) {
    draw(t);
    window.__animFrame = requestAnimationFrame(loop);
  } else {
    draw(dur);
  }
}

window.__pause  = () => { cancelAnimationFrame(window.__animFrame); };
window.__resume = () => { window.__animFrame = requestAnimationFrame(loop); };

window.__animFrame = requestAnimationFrame(loop);
`
}

async function run() {
  const project = await j('POST', '/api/projects', {
    name: `Renderer comparison SVG·Motion·Canvas·Zdog ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
    globalStyle: {
      presetId: 'clean',
      bgColorOverride: C.bg,
      paletteOverride: ['#121212', '#e84545', '#f0ece0', '#151515'],
      fontOverride: 'Arial',
      strokeColorOverride: C.ink,
    },
  })

  const out = { projectId: project.id, projectName: project.name, scenes: [] }

  const s1 = await j('POST', '/api/scene', {
    projectId: project.id,
    name: '1 · SVG — pipeline',
    type: 'svg',
    prompt: 'Comparison: same pipeline story as other renderers',
    svgContent: svgTechnicalExplainer(),
    duration: DURATION,
    bgColor: C.bg,
  })
  out.scenes.push({ type: 'svg', ...s1.scene })

  const s2 = await j('POST', '/api/scene', {
    projectId: project.id,
    name: '2 · Motion — pipeline',
    type: 'motion',
    prompt: 'Comparison: DOM + GSAP __tl timeline',
    generatedCode: motionSceneCode(),
    duration: DURATION,
    bgColor: C.bg,
  })
  out.scenes.push({ type: 'motion', ...s2.scene })

  const s3 = await j('POST', '/api/scene', {
    projectId: project.id,
    name: '3 · Canvas2D — pipeline',
    type: 'canvas2d',
    prompt: 'Comparison: same layout drawn with canvas 2D',
    generatedCode: canvasPipelineCode(),
    duration: DURATION,
    bgColor: C.bg,
  })
  out.scenes.push({ type: 'canvas2d', ...s3.scene })

  const zdogGen = await j('POST', '/api/generate-zdog', {
    mode: 'composed',
    duration: DURATION,
    bgColor: C.bg,
    composedSpec: {
      seed: 88044,
      title: 'Zdog · pseudo-3D',
      people: [
        {
          id: 'presenter-1',
          placement: { x: -20, y: 10, z: 3, scale: 1.02, rotationY: 0.22 },
        },
      ],
      modules: [
        { id: 'chart-1', type: 'barChart', x: 22, y: 5, z: -4, scale: 0.92, data: [3, 5, 4, 7], color: '#e84545' },
        { id: 'board-1', type: 'presentationBoard', x: 22, y: -8, z: -2, scale: 0.88 },
      ],
      beats: [
        { at: 0.15, action: 'idleBreath', targetPersonId: 'presenter-1', duration: DURATION - 0.2 },
        { at: 1.2, action: 'present', targetPersonId: 'presenter-1', duration: 1.3 },
        { at: 3.5, action: 'pointRight', targetPersonId: 'presenter-1', duration: 1.2 },
        { at: 6, action: 'talkNod', targetPersonId: 'presenter-1', duration: 2 },
      ],
    },
  })

  const s4 = await j('POST', '/api/scene', {
    projectId: project.id,
    name: '4 · Zdog — presenter + chart',
    type: 'zdog',
    prompt: 'Comparison: composed pseudo-3D scene with bar chart module',
    generatedCode: zdogGen.result,
    duration: DURATION,
    bgColor: C.bg,
  })
  out.scenes.push({ type: 'zdog', ...s4.scene })

  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

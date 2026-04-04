/**
 * SVG Explainer Pack v4 — no Lucide; hand-built SVG + tuned stagger/hold.
 * Scenes: technical explainer, diagram, icons, chart grid (all SVG chart types), single bar focus.
 *
 * Usage: node scripts/create-svg-explainer-pack-v4.mjs
 */

const apiBase = 'http://localhost:3000';

const C = {
  bg: '#121212',
  bg2: '#181818',
  bg3: '#151515',
  ink: '#f0ece0',
  muted: '#151515',
  accent: '#e84545',
};

function wrapSvg(inner) {
  return `<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

const scenes = [
  {
    name: 'v4 Technical Explainer',
    prompt: 'Data pipeline: ingest, transform, serve — pure SVG boxes and arrows',
    duration: 12,
    bgColor: C.bg,
    svgContent: wrapSvg(`
      <g id="bg">
        <rect width="1920" height="1080" fill="${C.bg}" class="fadein" style="--dur:0.5s;--delay:0s"/>
        <rect x="80" y="80" width="1760" height="920" rx="24" fill="none" stroke="${C.muted}" stroke-width="3" class="fadein" style="--dur:0.6s;--delay:0.15s"/>
      </g>
      <g id="midground">
        <rect x="140" y="380" width="340" height="160" rx="16" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.85s;--delay:0.7s"/>
        <rect x="790" y="380" width="340" height="160" rx="16" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.85s;--delay:1.15s"/>
        <rect x="1440" y="380" width="340" height="160" rx="16" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.85s;--delay:1.6s"/>
        <line x1="480" y1="460" x2="790" y2="460" stroke="${C.accent}" stroke-width="7" class="stroke" style="--dur:0.65s;--delay:2.05s"/>
        <polygon points="790,460 752,436 752,484" fill="${C.accent}" class="fadein" style="--dur:0.35s;--delay:2.35s"/>
        <line x1="1130" y1="460" x2="1440" y2="460" stroke="${C.accent}" stroke-width="7" class="stroke" style="--dur:0.65s;--delay:2.5s"/>
        <polygon points="1440,460 1402,436 1402,484" fill="${C.accent}" class="fadein" style="--dur:0.35s;--delay:2.8s"/>
      </g>
      <g id="text">
        <text x="960" y="160" fill="${C.ink}" font-size="72" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.55s;--delay:0.25s">Technical Explainer</text>
        <text x="960" y="240" fill="${C.ink}" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.45s;--delay:0.55s">Ingest → transform → serve</text>
        <text x="310" y="470" fill="${C.ink}" font-size="38" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.45s;--delay:1s">Ingest</text>
        <text x="960" y="470" fill="${C.ink}" font-size="38" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.45s;--delay:1.35s">Transform</text>
        <text x="1610" y="470" fill="${C.ink}" font-size="38" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.45s;--delay:1.75s">Serve</text>
        <text x="960" y="780" fill="${C.ink}" font-size="30" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.45s;--delay:3.2s">End-to-end flow — no external icon fonts</text>
      </g>
    `),
  },
  {
    name: 'v4 Diagram',
    prompt: 'System diagram: clients, services, store — nodes and curved links',
    duration: 12,
    bgColor: C.bg2,
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="${C.bg2}" class="fadein" style="--dur:0.5s;--delay:0s"/></g>
      <g id="midground">
        <rect x="200" y="420" width="280" height="120" rx="14" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.75s;--delay:0.65s"/>
        <rect x="820" y="280" width="280" height="120" rx="14" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.75s;--delay:1s"/>
        <rect x="820" y="560" width="280" height="120" rx="14" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.75s;--delay:1.35s"/>
        <rect x="1440" y="400" width="280" height="120" rx="14" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.75s;--delay:1.7s"/>
        <path d="M480 480 C620 480 680 340 820 340" stroke="${C.accent}" stroke-width="5" fill="none" class="stroke" style="--dur:0.7s;--delay:2.1s"/>
        <path d="M480 480 C620 480 680 620 820 620" stroke="${C.accent}" stroke-width="5" fill="none" class="stroke" style="--dur:0.7s;--delay:2.35s"/>
        <path d="M1100 340 C1240 340 1300 460 1440 460" stroke="${C.accent}" stroke-width="5" fill="none" class="stroke" style="--dur:0.7s;--delay:2.6s"/>
        <path d="M1100 620 C1240 620 1300 460 1440 460" stroke="${C.accent}" stroke-width="5" fill="none" class="stroke" style="--dur:0.7s;--delay:2.85s"/>
      </g>
      <g id="text">
        <text x="960" y="140" fill="${C.ink}" font-size="68" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.55s;--delay:0.2s">Diagram</text>
        <text x="340" y="485" fill="${C.ink}" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.4s;--delay:1.1s">Clients</text>
        <text x="960" y="345" fill="${C.ink}" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.4s;--delay:1.45s">Service A</text>
        <text x="960" y="625" fill="${C.ink}" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.4s;--delay:1.65s">Service B</text>
        <text x="1580" y="465" fill="${C.ink}" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.4s;--delay:1.95s">Store</text>
      </g>
    `),
  },
  {
    name: 'v4 Icons (hand-built SVG)',
    prompt: 'Simple geometric icons: gear, cloud, shield, chart — built from paths/circles',
    duration: 11,
    bgColor: C.bg3,
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="${C.bg3}" class="fadein" style="--dur:0.5s;--delay:0s"/></g>
      <g id="midground">
        <g transform="translate(220,360)">
          <circle cx="100" cy="100" r="70" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.8s;--delay:0.7s"/>
          <circle cx="100" cy="100" r="22" fill="none" stroke="${C.ink}" stroke-width="4" class="fadein" style="--dur:0.35s;--delay:1.1s"/>
          <line x1="100" y1="30" x2="100" y2="50" stroke="${C.ink}" stroke-width="5" class="stroke" style="--dur:0.25s;--delay:1.25s"/>
          <line x1="100" y1="150" x2="100" y2="170" stroke="${C.ink}" stroke-width="5" class="stroke" style="--dur:0.25s;--delay:1.3s"/>
          <line x1="30" y1="100" x2="50" y2="100" stroke="${C.ink}" stroke-width="5" class="stroke" style="--dur:0.25s;--delay:1.35s"/>
          <line x1="150" y1="100" x2="170" y2="100" stroke="${C.ink}" stroke-width="5" class="stroke" style="--dur:0.25s;--delay:1.4s"/>
          <line x1="55" y1="55" x2="68" y2="68" stroke="${C.ink}" stroke-width="5" class="stroke" style="--dur:0.25s;--delay:1.45s"/>
          <line x1="145" y1="145" x2="132" y2="132" stroke="${C.ink}" stroke-width="5" class="stroke" style="--dur:0.25s;--delay:1.5s"/>
        </g>
        <path d="M620 400 Q720 320 820 400 Q920 480 1020 400 Q1120 320 1220 400 L1220 520 Q1120 440 1020 520 Q920 600 820 520 Q720 440 620 520 Z"
          fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:1s;--delay:1.8s"/>
        <path d="M1340 380 L1540 380 L1580 460 L1500 540 L1380 540 L1300 460 Z" fill="none" stroke="${C.accent}" stroke-width="4" class="stroke" style="--dur:0.85s;--delay:2.4s"/>
        <path d="M1480 460 L1500 480 L1520 440" stroke="${C.ink}" stroke-width="5" fill="none" class="stroke" style="--dur:0.4s;--delay:2.95s"/>
      </g>
      <g id="text">
        <text x="960" y="130" fill="${C.ink}" font-size="64" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.55s;--delay:0.2s">Icons (native SVG)</text>
        <text x="320" y="620" fill="${C.ink}" font-size="28" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.4s;--delay:1.6s">Gear</text>
        <text x="920" y="620" fill="${C.ink}" font-size="28" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.4s;--delay:2.2s">Cloud</text>
        <text x="1460" y="620" fill="${C.ink}" font-size="28" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.4s;--delay:3s">Shield</text>
      </g>
    `),
  },
  {
    name: 'v4 Chart types grid (all SVG)',
    prompt: 'Grid: vertical bars, horizontal bars, line, area, pie, donut, scatter — pure SVG',
    duration: 14,
    bgColor: C.bg,
    svgContent: wrapSvg(`
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.accent}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${C.accent}" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <g id="bg"><rect width="1920" height="1080" fill="${C.bg}" class="fadein" style="--dur:0.5s;--delay:0s"/></g>

      <!-- Cell frames -->
      <g stroke="${C.muted}" stroke-width="2" fill="none">
        <rect x="100" y="200" width="540" height="320" rx="12" class="fadein" style="--dur:0.4s;--delay:0.4s"/>
        <rect x="690" y="200" width="540" height="320" rx="12" class="fadein" style="--dur:0.4s;--delay:0.45s"/>
        <rect x="1280" y="200" width="540" height="320" rx="12" class="fadein" style="--dur:0.4s;--delay:0.5s"/>
        <rect x="100" y="560" width="540" height="320" rx="12" class="fadein" style="--dur:0.4s;--delay:0.55s"/>
        <rect x="690" y="560" width="540" height="320" rx="12" class="fadein" style="--dur:0.4s;--delay:0.6s"/>
        <rect x="1280" y="560" width="540" height="320" rx="12" class="fadein" style="--dur:0.4s;--delay:0.65s"/>
      </g>

      <!-- 1 Vertical bar -->
      <g transform="translate(100,200)">
        <text x="270" y="36" fill="${C.ink}" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.4s;--delay:0.85s">Vertical bars</text>
        <line x1="80" y1="280" x2="80" y2="70" stroke="${C.ink}" stroke-width="3" class="stroke" style="--dur:0.5s;--delay:1s"/>
        <line x1="80" y1="280" x2="460" y2="280" stroke="${C.ink}" stroke-width="3" class="stroke" style="--dur:0.5s;--delay:1.05s"/>
        <rect x="130" y="190" width="50" height="90" rx="4" fill="${C.accent}" class="scale" style="--dur:0.45s;--delay:1.25s;transform-origin:bottom center"/>
        <rect x="220" y="150" width="50" height="130" rx="4" fill="${C.accent}" class="scale" style="--dur:0.45s;--delay:1.35s;transform-origin:bottom center"/>
        <rect x="310" y="210" width="50" height="70" rx="4" fill="${C.accent}" class="scale" style="--dur:0.45s;--delay:1.45s;transform-origin:bottom center"/>
      </g>

      <!-- 2 Horizontal bar -->
      <g transform="translate(690,200)">
        <text x="270" y="36" fill="${C.ink}" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.4s;--delay:1.55s">Horizontal bars</text>
        <line x1="60" y1="100" x2="480" y2="100" stroke="${C.ink}" stroke-width="3" class="stroke" style="--dur:0.45s;--delay:1.7s"/>
        <rect x="60" y="120" width="200" height="36" rx="4" fill="${C.accent}" class="fadein" style="--dur:0.35s;--delay:1.95s"/>
        <rect x="60" y="175" width="320" height="36" rx="4" fill="${C.accent}" class="fadein" style="--dur:0.35s;--delay:2.05s"/>
        <rect x="60" y="230" width="260" height="36" rx="4" fill="${C.accent}" class="fadein" style="--dur:0.35s;--delay:2.15s"/>
      </g>

      <!-- 3 Line -->
      <g transform="translate(1280,200)">
        <text x="270" y="36" fill="${C.ink}" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.4s;--delay:2.2s">Line</text>
        <polyline points="80,240 180,180 280,200 380,120 460,160" fill="none" stroke="${C.accent}" stroke-width="4" class="stroke" style="--dur:0.9s;--delay:2.45s"/>
        <circle cx="80" cy="240" r="6" fill="${C.ink}" class="fadein" style="--dur:0.2s;--delay:2.9s"/>
        <circle cx="180" cy="180" r="6" fill="${C.ink}" class="fadein" style="--dur:0.2s;--delay:2.95s"/>
        <circle cx="280" cy="200" r="6" fill="${C.ink}" class="fadein" style="--dur:0.2s;--delay:3s"/>
        <circle cx="380" cy="120" r="6" fill="${C.ink}" class="fadein" style="--dur:0.2s;--delay:3.05s"/>
        <circle cx="460" cy="160" r="6" fill="${C.ink}" class="fadein" style="--dur:0.2s;--delay:3.1s"/>
      </g>

      <!-- 4 Area -->
      <g transform="translate(100,560)">
        <text x="270" y="36" fill="${C.ink}" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.4s;--delay:3.35s">Area</text>
        <path d="M80 260 L180 200 L280 220 L380 140 L460 180 L460 280 L80 280 Z" fill="url(#areaFill)" stroke="${C.accent}" stroke-width="3" class="fadein" style="--dur:0.6s;--delay:3.55s"/>
        <polyline points="80,260 180,200 280,220 380,140 460,180" fill="none" stroke="${C.accent}" stroke-width="3" class="stroke" style="--dur:0.85s;--delay:3.5s"/>
      </g>

      <!-- 5 Pie + donut -->
      <g transform="translate(690,560)">
        <text x="270" y="36" fill="${C.ink}" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.4s;--delay:4.1s">Pie + donut</text>
        <path d="M270 150 L270 75 A75 75 0 0 1 345 125 Z" fill="${C.accent}" class="fadein" style="--dur:0.45s;--delay:4.35s"/>
        <path d="M270 150 L345 125 A75 75 0 1 1 195 125 Z" fill="${C.ink}" opacity="0.4" class="fadein" style="--dur:0.45s;--delay:4.5s"/>
        <circle cx="400" cy="210" r="42" fill="none" stroke="${C.ink}" stroke-width="22" class="stroke" style="--dur:0.65s;--delay:4.7s"/>
        <circle cx="400" cy="210" r="42" fill="none" stroke="${C.accent}" stroke-width="22" stroke-dasharray="99 165" stroke-linecap="round" transform="rotate(-90 400 210)" class="stroke" style="--dur:0.65s;--delay:4.85s"/>
      </g>

      <!-- 6 Scatter -->
      <g transform="translate(1280,560)">
        <text x="270" y="36" fill="${C.ink}" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.4s;--delay:5s">Scatter</text>
        <line x1="70" y1="260" x2="70" y2="80" stroke="${C.ink}" stroke-width="2" class="stroke" style="--dur:0.4s;--delay:5.2s"/>
        <line x1="70" y1="260" x2="480" y2="260" stroke="${C.ink}" stroke-width="2" class="stroke" style="--dur:0.4s;--delay:5.25s"/>
        <circle cx="120" cy="220" r="9" fill="${C.accent}" class="scale" style="--dur:0.3s;--delay:5.45s"/>
        <circle cx="200" cy="140" r="9" fill="${C.accent}" class="scale" style="--dur:0.3s;--delay:5.55s"/>
        <circle cx="280" cy="190" r="9" fill="${C.accent}" class="scale" style="--dur:0.3s;--delay:5.65s"/>
        <circle cx="360" cy="110" r="9" fill="${C.accent}" class="scale" style="--dur:0.3s;--delay:5.75s"/>
        <circle cx="420" cy="170" r="9" fill="${C.accent}" class="scale" style="--dur:0.3s;--delay:5.85s"/>
      </g>

      <g id="text">
        <text x="960" y="120" fill="${C.ink}" font-size="56" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.55s;--delay:0.15s">SVG chart types (grid)</text>
        <text x="960" y="175" fill="${C.ink}" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.4s;--delay:0.45s">Bars · line · area · pie · donut · scatter — all vector</text>
      </g>
    `),
  },
  {
    name: 'v4 Step explainer',
    prompt: 'Three-step explainer with numbered blocks',
    duration: 11,
    bgColor: C.bg2,
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="${C.bg2}" class="fadein" style="--dur:0.5s;--delay:0s"/></g>
      <g id="midground">
        <rect x="160" y="380" width="480" height="200" rx="18" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.75s;--delay:0.7s"/>
        <rect x="720" y="380" width="480" height="200" rx="18" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.75s;--delay:1.15s"/>
        <rect x="1280" y="380" width="480" height="200" rx="18" fill="none" stroke="${C.ink}" stroke-width="4" class="stroke" style="--dur:0.75s;--delay:1.6s"/>
        <circle cx="240" cy="460" r="44" fill="${C.accent}" class="scale" style="--dur:0.5s;--delay:1.05s"/>
        <text x="240" y="468" fill="${C.bg2}" font-size="40" font-family="Arial, sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.3s;--delay:1.2s">1</text>
        <circle cx="960" cy="460" r="44" fill="${C.accent}" class="scale" style="--dur:0.5s;--delay:1.5s"/>
        <text x="960" y="468" fill="${C.bg2}" font-size="40" font-family="Arial, sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.3s;--delay:1.65s">2</text>
        <circle cx="1520" cy="460" r="44" fill="${C.accent}" class="scale" style="--dur:0.5s;--delay:1.95s"/>
        <text x="1520" y="468" fill="${C.bg2}" font-size="40" font-family="Arial, sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.3s;--delay:2.1s">3</text>
      </g>
      <g id="text">
        <text x="960" y="150" fill="${C.ink}" font-size="64" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.55s;--delay:0.2s">Step explainer</text>
        <text x="400" y="520" fill="${C.ink}" font-size="30" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.4s;--delay:2.4s">Define</text>
        <text x="960" y="520" fill="${C.ink}" font-size="30" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.4s;--delay:2.55s">Measure</text>
        <text x="1520" y="520" fill="${C.ink}" font-size="30" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.4s;--delay:2.7s">Improve</text>
      </g>
    `),
  },
];

async function main() {
  const projectRes = await fetch(`${apiBase}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `SVG Explainer Pack v4 (no Lucide) ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      outputMode: 'mp4',
    }),
  });

  if (!projectRes.ok) {
    console.error('project create failed', projectRes.status, await projectRes.text());
    process.exit(1);
  }

  const project = await projectRes.json();
  console.log('PROJECT', JSON.stringify({ id: project.id, name: project.name }));

  for (const scene of scenes) {
    const res = await fetch(`${apiBase}/api/scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        name: scene.name,
        type: 'svg',
        prompt: scene.prompt,
        svgContent: scene.svgContent,
        duration: scene.duration,
        bgColor: scene.bgColor,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('scene create failed', scene.name, res.status, text);
      process.exit(1);
    }
    const json = JSON.parse(text);
    console.log('SCENE', JSON.stringify({ name: scene.name, id: json.scene.id, previewUrl: json.scene.previewUrl }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

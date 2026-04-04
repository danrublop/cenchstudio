/**
 * One-shot: POST a new project + SVG scenes using embedded Lucide icon paths
 * (paths from lucide-react v0.400.0, ISC — see node_modules/lucide-react).
 *
 * Usage: node scripts/create-svg-explainer-pack-v3-lucide.mjs
 * Requires: npm run dev and API at http://localhost:3000
 */

const apiBase = 'http://localhost:3000';

function wrapSvg(inner) {
  return `<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/** Lucide default: 24×24, stroke 2, round caps — scale via transform on parent <g> */
const L = {
  stroke: '#f0ece0',
  accent: '#e84545',
};

function wrapIcon(tx, ty, scale, children) {
  return `<g transform="translate(${tx},${ty}) scale(${scale})" fill="none" stroke="${L.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</g>`;
}

const scenes = [
  {
    name: 'v3 Lucide — Security',
    prompt: 'Shield and Lock Lucide icons — secure pipeline explainer',
    duration: 10,
    bgColor: '#121212',
    svgContent: wrapSvg(`
      <g id="bg">
        <rect width="1920" height="1080" fill="#121212" class="fadein" style="--dur:0.6s;--delay:0s"/>
      </g>
      ${wrapIcon(220, 360, 9, `
        <path class="stroke" style="--dur:1s;--delay:0.9s" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      `)}
      <line x1="520" y1="468" x2="1180" y2="468" stroke="${L.accent}" stroke-width="8" class="stroke" style="--dur:0.7s;--delay:2.1s"/>
      <polygon points="1180,468 1148,448 1148,488" fill="${L.accent}" class="fadein" style="--dur:0.35s;--delay:2.45s"/>
      ${wrapIcon(1180, 360, 9, `
        <rect class="fadein" style="--dur:0.5s;--delay:2.6s" width="18" height="11" x="3" y="11" rx="2" ry="2"/>
        <path class="stroke" style="--dur:0.8s;--delay:2.8s" d="M7 11V7a5 5 0 0 1 10 0v4"/>
      `)}
      <g id="text">
        <text x="960" y="120" fill="${L.stroke}" font-size="68" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.6s;--delay:0.3s">v3 — Security (Lucide)</text>
        <text x="960" y="200" fill="${L.stroke}" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="fadein" style="--dur:0.5s;--delay:0.7s">Shield · Lock · encrypted flow</text>
      </g>
    `),
  },
  {
    name: 'v3 Lucide — Compute',
    prompt: 'Cpu and Zap Lucide icons — performance explainer',
    duration: 10,
    bgColor: '#181818',
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="#181818" class="fadein" style="--dur:0.6s;--delay:0s"/></g>
      ${wrapIcon(240, 320, 8, `
        <rect class="stroke" style="--dur:0.6s;--delay:1s" width="16" height="16" x="4" y="4" rx="2"/>
        <rect class="stroke" style="--dur:0.5s;--delay:1.15s" width="6" height="6" x="9" y="9" rx="1"/>
        <path class="stroke" style="--dur:0.35s;--delay:1.25s" d="M15 2v2"/><path class="stroke" style="--dur:0.35s;--delay:1.3s" d="M15 20v2"/>
        <path class="stroke" style="--dur:0.35s;--delay:1.35s" d="M2 15h2"/><path class="stroke" style="--dur:0.35s;--delay:1.4s" d="M2 9h2"/>
        <path class="stroke" style="--dur:0.35s;--delay:1.45s" d="M20 15h2"/><path class="stroke" style="--dur:0.35s;--delay:1.5s" d="M20 9h2"/>
        <path class="stroke" style="--dur:0.35s;--delay:1.55s" d="M9 2v2"/><path class="stroke" style="--dur:0.35s;--delay:1.6s" d="M9 20v2"/>
      `)}
      ${wrapIcon(1120, 300, 9, `
        <path class="stroke" style="--dur:1s;--delay:2.2s" d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
      `)}
      <g id="text">
        <text x="960" y="120" fill="${L.stroke}" font-size="68" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.6s;--delay:0.3s">v3 — Compute (Lucide)</text>
        <text x="640" y="560" fill="${L.stroke}" font-size="36" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.5s;--delay:3s">CPU</text>
        <text x="1280" y="560" fill="${L.accent}" font-size="36" font-family="Arial, sans-serif" text-anchor="middle" class="slide-up" style="--dur:0.5s;--delay:3.2s">Throughput</text>
      </g>
    `),
  },
  {
    name: 'v3 Lucide — Network',
    prompt: 'Network and Wifi Lucide icons — topology diagram',
    duration: 10,
    bgColor: '#151515',
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="#151515" class="fadein" style="--dur:0.6s;--delay:0s"/></g>
      ${wrapIcon(420, 260, 10, `
        <rect class="stroke" style="--dur:0.5s;--delay:1s" x="16" y="16" width="6" height="6" rx="1"/>
        <rect class="stroke" style="--dur:0.5s;--delay:1.1s" x="2" y="16" width="6" height="6" rx="1"/>
        <rect class="stroke" style="--dur:0.5s;--delay:1.2s" x="9" y="2" width="6" height="6" rx="1"/>
        <path class="stroke" style="--dur:0.6s;--delay:1.35s" d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
        <path class="stroke" style="--dur:0.5s;--delay:1.5s" d="M12 12V8"/>
      `)}
      ${wrapIcon(1180, 420, 7, `
        <path class="stroke" style="--dur:0.4s;--delay:2.2s" d="M12 20h.01"/>
        <path class="stroke" style="--dur:0.5s;--delay:2.35s" d="M2 8.82a15 15 0 0 1 20 0"/>
        <path class="stroke" style="--dur:0.5s;--delay:2.5s" d="M5 12.859a10 10 0 0 1 14 0"/>
        <path class="stroke" style="--dur:0.5s;--delay:2.65s" d="M8.5 16.429a5 5 0 0 1 7 0"/>
      `)}
      <path d="M720 420 C880 420 920 520 1080 520" stroke="${L.accent}" stroke-width="6" fill="none" class="stroke" style="--dur:0.8s;--delay:2s"/>
      <g id="text">
        <text x="960" y="110" fill="${L.stroke}" font-size="66" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.6s;--delay:0.3s">v3 — Network (Lucide)</text>
        <text x="960" y="900" fill="${L.stroke}" font-size="32" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.5s;--delay:3s">Topology · uplink</text>
      </g>
    `),
  },
  {
    name: 'v3 Lucide — Chart',
    prompt: 'BarChart3 Lucide icon — metrics scene',
    duration: 9,
    bgColor: '#121212',
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="#121212" class="fadein" style="--dur:0.6s;--delay:0s"/></g>
      ${wrapIcon(640, 340, 14, `
        <path class="stroke" style="--dur:0.8s;--delay:1s" d="M3 3v18h18"/>
        <path class="stroke" style="--dur:0.5s;--delay:1.4s" d="M18 17V9"/>
        <path class="stroke" style="--dur:0.5s;--delay:1.55s" d="M13 17V5"/>
        <path class="stroke" style="--dur:0.5s;--delay:1.7s" d="M8 17v-3"/>
      `)}
      <g id="text">
        <text x="960" y="130" fill="${L.stroke}" font-size="66" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.6s;--delay:0.3s">v3 — Chart (Lucide bar-chart-3)</text>
        <text x="960" y="820" fill="${L.accent}" font-size="38" font-family="Arial, sans-serif" text-anchor="middle" class="bounce" style="--dur:0.6s;--delay:2.4s">KPIs</text>
      </g>
    `),
  },
  {
    name: 'v3 Lucide — Layers & Sparkles',
    prompt: 'Layers and Sparkles Lucide icons — polish / stack explainer',
    duration: 10,
    bgColor: '#181818',
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="#181818" class="fadein" style="--dur:0.6s;--delay:0s"/></g>
      ${wrapIcon(280, 340, 8, `
        <path class="stroke" style="--dur:0.9s;--delay:1s" d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
        <path class="stroke" style="--dur:0.6s;--delay:1.5s" d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
        <path class="stroke" style="--dur:0.6s;--delay:1.8s" d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
      `)}
      ${wrapIcon(1120, 320, 7, `
        <path class="stroke" style="--dur:1.1s;--delay:2.4s" d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        <path class="stroke" style="--dur:0.35s;--delay:3.2s" d="M20 3v4"/>
        <path class="stroke" style="--dur:0.35s;--delay:3.25s" d="M22 5h-4"/>
        <path class="stroke" style="--dur:0.35s;--delay:3.3s" d="M4 17v2"/>
        <path class="stroke" style="--dur:0.35s;--delay:3.35s" d="M5 18H3"/>
      `)}
      <g id="text">
        <text x="960" y="120" fill="${L.stroke}" font-size="64" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.6s;--delay:0.3s">v3 — Layers & Sparkles (Lucide)</text>
        <text x="960" y="860" fill="${L.stroke}" font-size="32" font-family="Arial, sans-serif" text-anchor="middle" class="fadein" style="--dur:0.5s;--delay:3.5s">Stacked delivery · finish</text>
      </g>
    `),
  },
  {
    name: 'v3 Lucide — Verified',
    prompt: 'BadgeCheck Lucide icon — trust / QA explainer',
    duration: 9,
    bgColor: '#151515',
    svgContent: wrapSvg(`
      <g id="bg"><rect width="1920" height="1080" fill="#151515" class="fadein" style="--dur:0.6s;--delay:0s"/></g>
      ${wrapIcon(720, 380, 12, `
        <path class="stroke" style="--dur:1.2s;--delay:1s" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
        <path class="stroke" style="--dur:0.6s;--delay:2s" d="m9 12 2 2 4-4"/>
      `)}
      <g id="text">
        <text x="960" y="140" fill="${L.stroke}" font-size="66" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" class="slide-up" style="--dur:0.6s;--delay:0.3s">v3 — Verified (Lucide)</text>
        <text x="960" y="820" fill="${L.accent}" font-size="40" font-family="Arial, sans-serif" text-anchor="middle" class="bounce" style="--dur:0.6s;--delay:2.6s">Ship-ready</text>
      </g>
    `),
  },
];

async function main() {
  const projectRes = await fetch(`${apiBase}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `SVG Explainer Pack v3 Lucide ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
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

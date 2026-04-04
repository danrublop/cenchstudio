/**
 * Creates a multi-scene project showcasing TalkingHead (free) over motion, D3, Three, canvas2d, zdog, and avatar_scene.
 * TTS: set project defaultTTSProvider to web-speech — with no ElevenLabs/OpenAI/Gemini/Google/Edge keys,
 * TalkingHead uses in-page Web Speech fallback (see lib/sceneTemplate hasServerTTS).
 *
 * Prefer in-app: Settings → Dev → "Load Avatar showcase (9 scenes)" (same scenes, `generateSceneHTML` + POST).
 * CLI: npm run dev  →  npm run avatar-showcase
 */
import { v4 as uuidv4 } from 'uuid'
import type { D3ChartLayer } from '../lib/types'
import { DEFAULT_AUDIO_SETTINGS } from '../lib/types'
import {
  DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER,
  type TalkingHeadAvatarModelId,
} from '../lib/avatars/talkinghead-models'
import { buildCanvasAnimationCode, CANVAS_MOTION_TEMPLATES } from '../lib/templates/canvas-animation-templates'

const base = process.env.CENCH_BASE_URL || 'http://localhost:3000'

async function j(method: string, path: string, body?: object) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data).slice(0, 900)}`)
  return data as any
}

function talkingHeadAvatarLayer(opts: {
  placement: string
  lines: { text: string; mood?: string; gesture?: string; pauseBefore?: number; lookCamera?: boolean }[]
  character?: 'friendly' | 'professional' | 'energetic'
  avatarModelId?: TalkingHeadAvatarModelId
  pipSize?: number
  narrationPosition?: string
  label?: string
}) {
  const character = opts.character ?? 'friendly'
  const model = opts.avatarModelId ?? DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[character] ?? 'brunette'
  const allText = opts.lines.map((l) => l.text).join(' ')
  const url = `talkinghead://render?text=${encodeURIComponent(allText)}&audio=&character=${character}&model=${encodeURIComponent(model)}`
  const placement = opts.placement
  return {
    id: uuidv4(),
    type: 'avatar' as const,
    avatarId: '',
    voiceId: '',
    script: allText,
    removeBackground: false,
    x: placement === 'fullscreen' ? 960 : placement.includes('right') ? 1640 : 280,
    y: placement === 'fullscreen' ? 540 : placement.includes('top') ? 280 : 800,
    width: placement === 'fullscreen' ? 1920 : (opts.pipSize ?? 280),
    height: placement === 'fullscreen' ? 1080 : (opts.pipSize ?? 280),
    opacity: 1,
    zIndex: 100,
    videoUrl: null,
    thumbnailUrl: null,
    status: 'ready' as const,
    heygenVideoId: null,
    estimatedDuration: 14,
    startAt: 0,
    label: opts.label ?? 'TalkingHead',
    avatarPlacement: placement,
    avatarProvider: 'talkinghead',
    talkingHeadUrl: url,
    narrationScript: {
      mood: 'happy' as const,
      view: 'upper' as const,
      lipsyncHeadMovement: true,
      eyeContact: 0.72,
      position: opts.narrationPosition ?? placement,
      pipSize: opts.pipSize ?? 280,
      pipShape: 'circle' as const,
      enterAt: 0,
      entranceAnimation: 'fade' as const,
      character,
      avatarModelId: model,
      lines: opts.lines,
    },
  }
}

function d3BarCharts(): D3ChartLayer[] {
  return [
    {
      id: 'showcase-bar',
      name: 'Demo metric',
      chartType: 'bar',
      data: [
        { label: 'Q1', value: 32 },
        { label: 'Q2', value: 48 },
        { label: 'Q3', value: 41 },
        { label: 'Q4', value: 56 },
      ],
      config: {
        title: 'D3 + TalkingHead PIP',
        subtitle: 'Chart on the left; narrator bottom-right',
        xLabel: 'Quarter',
        yLabel: 'Score',
        showGrid: true,
        showValues: true,
      },
      layout: { x: 6, y: 14, width: 54, height: 72 },
      timing: { startAt: 0, duration: 12, animated: true },
    },
  ]
}

const MOTION_PANEL_RIGHT = `
const panel = document.createElement('div');
panel.style.cssText = 'position:absolute;left:72px;top:88px;max-width:1200px;z-index:2;pointer-events:none;';
const h1 = document.createElement('h1');
h1.style.cssText = 'margin:0 0 14px;font-size:48px;font-weight:800;color:#f8fafc;';
h1.textContent = 'Motion + PIP';
const p = document.createElement('p');
p.style.cssText = 'margin:0;font-size:22px;line-height:1.5;color:#94a3b8;';
p.textContent = 'TalkingHead in the corner. Swap the 3D mesh in avatar Properties, then save scene HTML. Without cloud TTS keys, speech uses Web Speech.';
panel.appendChild(h1);
panel.appendChild(p);
document.getElementById('scene-camera').prepend(panel);
`.trim()

const MOTION_PANEL_MPFB = `
const panel = document.createElement('div');
panel.style.cssText = 'position:absolute;left:72px;top:88px;max-width:1180px;z-index:2;pointer-events:none;';
const h1 = document.createElement('h1');
h1.style.cssText = 'margin:0 0 14px;font-size:46px;font-weight:800;color:#f1f5f9;';
h1.textContent = 'Alternate 3D presenter';
const p = document.createElement('p');
p.style.cssText = 'margin:0;font-size:21px;line-height:1.55;color:#94a3b8;';
p.textContent = 'This scene ships with the MPFB VRM. Scene one uses the brunette mesh — compare lip sync and silhouette.';
panel.appendChild(h1);
panel.appendChild(p);
document.getElementById('scene-camera').prepend(panel);
`.trim()

const MOTION_PANEL_LEFT = `
const panel = document.createElement('div');
panel.style.cssText = 'position:absolute;right:72px;top:88px;max-width:1200px;z-index:2;pointer-events:none;text-align:right;';
const h1 = document.createElement('h1');
h1.style.cssText = 'margin:0 0 14px;font-size:48px;font-weight:800;color:#f8fafc;';
h1.textContent = 'PIP on the left';
const p = document.createElement('p');
p.style.cssText = 'margin:0;font-size:22px;line-height:1.5;color:#94a3b8;';
p.textContent = 'Same motion stage; avatar placement is mirrored so content stays readable.';
panel.appendChild(h1);
panel.appendChild(p);
document.getElementById('scene-camera').prepend(panel);
`.trim()

const MOTION_PANEL_FULL = `
const panel = document.createElement('div');
panel.style.cssText = 'position:absolute;right:64px;top:80px;bottom:120px;width:46%;z-index:2;pointer-events:none;display:flex;flex-direction:column;justify-content:center;';
const h1 = document.createElement('h1');
h1.style.cssText = 'margin:0 0 16px;font-size:44px;font-weight:800;color:#0f172a;';
h1.textContent = 'Large presenter';
const p = document.createElement('p');
p.style.cssText = 'margin:0;font-size:21px;line-height:1.55;color:#334155;';
p.textContent = 'Fullscreen-left avatar placement leaves this column for titles and bullets.';
const ul = document.createElement('ul');
ul.style.cssText = 'margin:20px 0 0;padding-left:22px;font-size:20px;line-height:1.7;color:#475569;';
['Free TalkingHead VRM','Web Speech when no API keys','GSAP-driven scene clock'].forEach(function(t) {
  var li = document.createElement('li');
  li.textContent = t;
  ul.appendChild(li);
});
panel.appendChild(h1);
panel.appendChild(p);
panel.appendChild(ul);
document.getElementById('scene-camera').prepend(panel);
`.trim()

const THREE_SHOWCASE = `
import * as THREE from 'three';

const camRoot = document.getElementById('scene-camera');
const holder = document.createElement('div');
holder.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;';
camRoot.insertBefore(holder, camRoot.firstChild);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(1920, 1080);
renderer.setClearColor(0x0b1220);
holder.appendChild(renderer.domElement);

const scene3 = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1920 / 1080, 0.1, 200);
camera.position.set(0, 0.35, 4.2);
window.__threeCamera = camera;
scene3.add(new THREE.AmbientLight(0x445566, 0.85));
const key = new THREE.DirectionalLight(0xffffff, 1.05);
key.position.set(4, 6, 5);
scene3.add(key);

const mesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.15, 1),
  new THREE.MeshStandardMaterial({ color: 0x818cf8, roughness: 0.4, metalness: 0.25 })
);
scene3.add(mesh);

function tick() {
  var u = window.__tl ? window.__tl.time() : 0;
  mesh.rotation.x = u * 0.55;
  mesh.rotation.y = u * 0.72;
  renderer.render(scene3, camera);
  if (u < DURATION) requestAnimationFrame(tick);
}
renderer.render(scene3, camera);
requestAnimationFrame(tick);
`.trim()

const ZDOG_SHOWCASE = `
var illo = new Zdog.Illustration({
  element: '#zdog-canvas',
  zoom: 1.1,
  dragRotate: false,
});
new Zdog.Box({
  addTo: illo,
  width: 140, height: 140, depth: 140,
  stroke: false,
  color: '#6366f1',
  leftFace: '#4f46e5',
  rightFace: '#818cf8',
  topFace: '#c7d2fe',
});
new Zdog.Shape({
  addTo: illo,
  path: [ { x: -40 }, { x: 40 } ],
  stroke: 10,
  color: '#f472b6',
  translate: { y: -120 },
});
function zTick() {
  var u = window.__tl ? window.__tl.time() : 0;
  illo.rotate.y = u * 0.35;
  illo.rotate.x = Math.sin(u * 0.5) * 0.15;
  illo.updateRenderGraph();
  if (u < DURATION) requestAnimationFrame(zTick);
}
illo.updateRenderGraph();
requestAnimationFrame(zTick);
`.trim()

async function run() {
  const project = await j('POST', '/api/projects', {
    name: `Avatar showcase (TalkingHead + Web Speech) ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
    audioSettings: { ...DEFAULT_AUDIO_SETTINGS, defaultTTSProvider: 'web-speech' },
  })

  const canvasTpl = CANVAS_MOTION_TEMPLATES[4] ?? CANVAS_MOTION_TEMPLATES[0]
  const canvasCode = buildCanvasAnimationCode(canvasTpl.id)

  const scenes: { name: string; body: Record<string, unknown> }[] = [
    {
      name: '01 Motion · PIP + brunette mesh',
      body: {
        projectId: project.id,
        name: '01 Motion · PIP + brunette mesh',
        type: 'motion',
        prompt: 'Avatar showcase — motion + TalkingHead',
        generatedCode: MOTION_PANEL_RIGHT,
        duration: 12,
        bgColor: '#0f172a',
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'pip_bottom_right',
            avatarModelId: 'brunette',
            lines: [
              {
                text: 'Scene one: Motion renderer with a corner PIP and the default brunette three D presenter.',
                mood: 'happy',
                gesture: 'wave',
                lookCamera: true,
              },
              { text: 'TalkingHead lip sync uses Web Speech when no server TTS keys are set.', pauseBefore: 280 },
            ],
          }),
        ],
      },
    },
    {
      name: '02 Motion · PIP bottom-left',
      body: {
        projectId: project.id,
        name: '02 Motion · PIP bottom-left',
        type: 'motion',
        prompt: 'Avatar showcase — mirrored PIP',
        generatedCode: MOTION_PANEL_LEFT,
        duration: 12,
        bgColor: '#111827',
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'pip_bottom_left',
            lines: [
              { text: 'Scene two: same motion stack, but the avatar sits on the left.', lookCamera: true },
              { text: 'Use this when your main visuals lean right.', pauseBefore: 250 },
            ],
            character: 'professional',
          }),
        ],
      },
    },
    {
      name: '03 Motion · Fullscreen-left presenter',
      body: {
        projectId: project.id,
        name: '03 Motion · Fullscreen-left presenter',
        type: 'motion',
        prompt: 'Avatar showcase — large presenter column',
        generatedCode: MOTION_PANEL_FULL,
        duration: 14,
        bgColor: '#e2e8f0',
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'fullscreen_left',
            narrationPosition: 'fullscreen_left',
            pipSize: 520,
            lines: [
              {
                text: 'Scene three: fullscreen-left placement gives a keynote-style presenter.',
                mood: 'happy',
                gesture: 'handup',
                lookCamera: true,
              },
              { text: 'The explainer column stays on the opposite side.', pauseBefore: 300 },
            ],
          }),
        ],
      },
    },
    {
      name: '04 D3 charts · PIP narrator',
      body: {
        projectId: project.id,
        name: '04 D3 charts · PIP narrator',
        type: 'd3',
        prompt: 'Avatar showcase — CenchCharts + TalkingHead',
        generatedCode: '',
        duration: 12,
        bgColor: '#020617',
        chartLayers: d3BarCharts(),
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'pip_bottom_right',
            lines: [
              { text: 'Scene four: structured D3 charts with a data narrator in the corner.', lookCamera: true },
              { text: 'Great for metrics, pipelines, and quarterly stories.', pauseBefore: 260 },
            ],
          }),
        ],
      },
    },
    {
      name: '05 Three.js · PIP + WebGL',
      body: {
        projectId: project.id,
        name: '05 Three.js · PIP + WebGL',
        type: 'three',
        prompt: 'Avatar showcase — Three.js under TalkingHead',
        generatedCode: THREE_SHOWCASE,
        duration: 12,
        bgColor: '#0b1220',
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'pip_bottom_right',
            lines: [
              { text: 'Scene five: WebGL lives behind the UI layer so the avatar stays visible.', lookCamera: true },
              { text: 'The canvas is mounted inside the scene camera at z-index zero.', pauseBefore: 280 },
            ],
            character: 'energetic',
          }),
        ],
      },
    },
    {
      name: `06 Canvas2D · ${canvasTpl.name}`,
      body: {
        projectId: project.id,
        name: `06 Canvas2D · ${canvasTpl.name}`,
        type: 'canvas2d',
        prompt: `Avatar showcase — canvas template ${canvasTpl.id}`,
        generatedCode: canvasCode,
        duration: 10,
        bgColor: canvasTpl.suggestedBgColor,
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'pip_bottom_right',
            lines: [
              { text: 'Scene six: procedural canvas two D animation with a corner host.', lookCamera: true },
              { text: 'Templates live under lib slash templates slash canvas-animation-templates.', pauseBefore: 240 },
            ],
          }),
        ],
      },
    },
    {
      name: '07 Zdog · isometric host',
      body: {
        projectId: project.id,
        name: '07 Zdog · isometric host',
        type: 'zdog',
        prompt: 'Avatar showcase — Zdog + TalkingHead',
        generatedCode: ZDOG_SHOWCASE,
        duration: 10,
        bgColor: '#1e1b4b',
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'pip_bottom_right',
            lines: [
              { text: 'Scene seven: pseudo-three-D illustration with Zdog.', mood: 'happy', gesture: 'thumbup' },
              { text: 'Lightweight and playful next to heavy WebGL scenes.', pauseBefore: 220 },
            ],
          }),
        ],
      },
    },
    {
      name: '08 Avatar scene · panels + presenter',
      body: {
        projectId: project.id,
        name: '08 Avatar scene · panels + presenter',
        type: 'avatar_scene',
        prompt: 'Avatar showcase — full avatar_scene layout',
        generatedCode: '',
        duration: 14,
        bgColor: '#0f172a',
        aiLayers: [
          (() => {
            const lines = [
              {
                text: 'Scene eight: full avatar scene with GSAP-timed HTML panels beside the presenter.',
                mood: 'happy',
                gesture: 'wave',
                lookCamera: true,
              },
              {
                text: 'Change the 3D model in Properties any time; lip sync follows the same script.',
                pauseBefore: 350,
              },
            ]
            const allText = lines.map((l) => l.text).join(' ')
            const narrationScript = {
              lines,
              position: 'fullscreen_left' as const,
              mood: 'happy' as const,
              view: 'mid' as const,
              lipsyncHeadMovement: true,
              eyeContact: 0.7,
              character: 'friendly' as const,
              avatarModelId: 'brunette' as const,
            }
            return {
              id: uuidv4(),
              type: 'avatar' as const,
              avatarId: '',
              voiceId: '',
              script: allText,
              removeBackground: false,
              x: 0,
              y: 0,
              width: 1920,
              height: 1080,
              opacity: 1,
              zIndex: 100,
              videoUrl: null,
              thumbnailUrl: null,
              status: 'ready' as const,
              heygenVideoId: null,
              estimatedDuration: 14,
              startAt: 0,
              label: 'Presenter',
              avatarPlacement: 'fullscreen_left',
              avatarProvider: 'talkinghead',
              talkingHeadUrl: `talkinghead://render?text=${encodeURIComponent(allText)}&audio=&character=friendly&model=brunette`,
              narrationScript,
              avatarSceneConfig: {
                narrationScript,
                contentPanels: [
                  {
                    id: 'panel-a',
                    html: '<h2>Timed panel A</h2><p>Reveals early on the timeline. Edit copy in layer properties.</p>',
                    position: 'right',
                    revealAt: '1',
                    exitAt: '7',
                  },
                  {
                    id: 'panel-b',
                    html: '<h2>3D presenter</h2><p>Open the avatar row → Properties → 3D presenter model, then save HTML.</p>',
                    position: 'right',
                    revealAt: '4',
                  },
                ],
                backdrop: '#0f172a',
                avatarPosition: 'left',
                avatarSize: 44,
              },
            }
          })(),
        ],
      },
    },
    {
      name: '09 Motion · MPFB mesh',
      body: {
        projectId: project.id,
        name: '09 Motion · MPFB mesh',
        type: 'motion',
        prompt: 'Avatar showcase — second built-in VRM',
        generatedCode: MOTION_PANEL_MPFB,
        duration: 12,
        bgColor: '#1e293b',
        aiLayers: [
          talkingHeadAvatarLayer({
            placement: 'pip_bottom_right',
            character: 'professional',
            avatarModelId: 'mpfb',
            lines: [
              {
                text: 'Scene nine: same Motion stack as scene one, but the MPFB professional mesh is locked in.',
                lookCamera: true,
              },
              {
                text: 'Compare mouth movement and framing, then try other models from avatar Properties.',
                pauseBefore: 300,
              },
            ],
          }),
        ],
      },
    },
  ]

  const created: { id: string; name: string; previewUrl?: string }[] = []
  for (const s of scenes) {
    const res = await j('POST', '/api/scene', s.body)
    created.push({ id: res.scene.id, name: res.scene.name, previewUrl: res.scene.previewUrl })
  }

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        projectName: project.name,
        note: 'TalkingHead uses Web Speech in the page when no server TTS env vars are set.',
        sceneCount: created.length,
        scenes: created,
        openApp: base.replace(/\/$/, ''),
      },
      null,
      2,
    ),
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

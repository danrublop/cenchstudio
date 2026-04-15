/**
 * TalkingHead (free) + Web Speech TTS demo reel across renderers.
 * Cench-style: scenes are full `Scene` objects; HTML is produced by `generateSceneHTML` and written via POST /api/scene { id, html }.
 *
 * Load: Settings → Dev → "Load Avatar showcase (9 scenes)".
 * Sets default TTS to web-speech when seeding (store) so TalkingHead falls back cleanly without cloud keys.
 */
import { v4 as uuidv4 } from 'uuid'
import type { AvatarLayer, D3ChartLayer, NarrationScript, Scene } from './types'
import { compileD3SceneFromLayers } from './charts/compile'
import { DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER, type TalkingHeadAvatarModelId } from './avatars/talkinghead-models'
import { buildCanvasAnimationCode, CANVAS_MOTION_TEMPLATES } from './templates/canvas-animation-templates'

function base(): Omit<Scene, 'id' | 'name' | 'sceneType' | 'prompt'> {
  return {
    summary: '',
    svgContent: '',
    canvasCode: '',
    canvasBackgroundCode: '',
    sceneCode: '',
    reactCode: '',
    sceneHTML: '',
    sceneStyles: '',
    lottieSource: '',
    d3Data: null,
    chartLayers: [],
    usage: null,
    duration: 10,
    bgColor: '#0f172a',
    thumbnail: null,
    videoLayer: { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
    audioLayer: { enabled: false, src: null, volume: 1, fadeIn: false, fadeOut: false, startOffset: 0 },
    textOverlays: [],
    svgObjects: [],
    primaryObjectId: null,
    svgBranches: [],
    activeBranchId: null,
    transition: 'crossfade',
    interactions: [],
    variables: [],
    aiLayers: [],
    messages: [],
    styleOverride: {},
    cameraMotion: null,
    worldConfig: null,
  }
}

function talkingHeadLayer(opts: {
  placement: NarrationScript['position']
  lines: NarrationScript['lines']
  character?: NarrationScript['character']
  /** Explicit VRM id; defaults from character preset when omitted. */
  avatarModelId?: TalkingHeadAvatarModelId
  pipSize?: number
  label?: string
}): AvatarLayer {
  const character = opts.character ?? 'friendly'
  const model = opts.avatarModelId ?? DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[character] ?? 'brunette'
  const allText = opts.lines.map((l) => l.text).join(' ')
  const url = `talkinghead://render?text=${encodeURIComponent(allText)}&audio=&character=${character}&model=${encodeURIComponent(model)}`
  const placement = opts.placement
  return {
    id: uuidv4(),
    type: 'avatar',
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
    status: 'ready',
    heygenVideoId: null,
    estimatedDuration: 14,
    startAt: 0,
    label: opts.label ?? 'TalkingHead',
    avatarPlacement: placement,
    avatarProvider: 'talkinghead',
    talkingHeadUrl: url,
    narrationScript: {
      mood: 'happy',
      view: 'upper',
      lipsyncHeadMovement: true,
      eyeContact: 0.72,
      position: placement,
      pipSize: opts.pipSize ?? 280,
      pipShape: 'circle',
      enterAt: 0,
      entranceAnimation: 'fade',
      character,
      avatarModelId: model,
      lines: opts.lines,
    },
  }
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
p.textContent = 'Same motion stack; avatar on the left so visuals stay readable.';
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
p.textContent = 'Fullscreen-left avatar leaves this column for titles and bullets.';
const ul = document.createElement('ul');
ul.style.cssText = 'margin:20px 0 0;padding-left:22px;font-size:20px;line-height:1.7;color:#475569;';
['Free TalkingHead VRM','Web Speech without API keys','GSAP timeline scrub'].forEach(function(t) {
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

function d3BarCharts(): D3ChartLayer[] {
  return [
    {
      id: 'avatar-showcase-bar',
      name: 'Quarterly',
      chartType: 'bar',
      data: [
        { label: 'Q1', value: 32 },
        { label: 'Q2', value: 48 },
        { label: 'Q3', value: 41 },
        { label: 'Q4', value: 56 },
      ],
      config: {
        title: 'D3 + TalkingHead PIP',
        subtitle: 'Structured chartLayers (CenchCharts)',
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

export function createAvatarShowcaseScenes(): Scene[] {
  const canvasTpl = CANVAS_MOTION_TEMPLATES[4] ?? CANVAS_MOTION_TEMPLATES[0]
  const canvasCode = buildCanvasAnimationCode(canvasTpl.id)
  const chartLayers = d3BarCharts()
  const compiled = compileD3SceneFromLayers(chartLayers)

  const lines8: NarrationScript['lines'] = [
    {
      text: 'Scene eight: full avatar scene with GSAP-timed HTML panels beside the presenter.',
      mood: 'happy',
      gesture: 'wave',
      lookCamera: true,
    },
    { text: 'Change the 3D model in Properties any time; lip sync follows the same script.', pauseBefore: 350 },
  ]
  const all8 = lines8.map((l) => l.text).join(' ')
  const narration8: NarrationScript = {
    lines: lines8,
    position: 'fullscreen_left',
    mood: 'happy',
    view: 'mid',
    lipsyncHeadMovement: true,
    eyeContact: 0.7,
    character: 'friendly',
    avatarModelId: 'brunette',
  }

  const avatarSceneLayer: AvatarLayer = {
    id: uuidv4(),
    type: 'avatar',
    avatarId: '',
    voiceId: '',
    script: all8,
    removeBackground: false,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    opacity: 1,
    zIndex: 100,
    videoUrl: null,
    thumbnailUrl: null,
    status: 'ready',
    heygenVideoId: null,
    estimatedDuration: 14,
    startAt: 0,
    label: 'Presenter',
    avatarPlacement: 'fullscreen_left',
    avatarProvider: 'talkinghead',
    talkingHeadUrl: `talkinghead://render?text=${encodeURIComponent(all8)}&audio=&character=friendly&model=brunette`,
    narrationScript: narration8,
    avatarSceneConfig: {
      narrationScript: narration8,
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

  return [
    {
      ...base(),
      id: uuidv4(),
      name: '01 Motion · PIP + brunette mesh',
      sceneType: 'motion',
      prompt: 'Avatar showcase — motion + TalkingHead',
      duration: 12,
      bgColor: '#0f172a',
      sceneCode: MOTION_PANEL_RIGHT,
      aiLayers: [
        talkingHeadLayer({
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
    {
      ...base(),
      id: uuidv4(),
      name: '02 Motion · PIP bottom-left',
      sceneType: 'motion',
      prompt: 'Avatar showcase — mirrored PIP',
      duration: 12,
      bgColor: '#111827',
      sceneCode: MOTION_PANEL_LEFT,
      aiLayers: [
        talkingHeadLayer({
          placement: 'pip_bottom_left',
          character: 'professional',
          lines: [
            { text: 'Scene two: avatar on the left for right-weighted layouts.', lookCamera: true },
            { text: 'Same Motion plus Anime stack as scene one.', pauseBefore: 250 },
          ],
        }),
      ],
    },
    {
      ...base(),
      id: uuidv4(),
      name: '03 Motion · Fullscreen-left presenter',
      sceneType: 'motion',
      prompt: 'Avatar showcase — keynote-style column',
      duration: 14,
      bgColor: '#e2e8f0',
      sceneCode: MOTION_PANEL_FULL,
      aiLayers: [
        talkingHeadLayer({
          placement: 'fullscreen_left',
          pipSize: 520,
          lines: [
            {
              text: 'Scene three: fullscreen-left presenter beside explainer copy.',
              mood: 'happy',
              gesture: 'handup',
              lookCamera: true,
            },
            { text: 'Good for host-led lessons and product walkthroughs.', pauseBefore: 300 },
          ],
        }),
      ],
    },
    {
      ...base(),
      id: uuidv4(),
      name: '04 D3 · Charts + narrator',
      sceneType: 'd3',
      prompt: 'Avatar showcase — CenchCharts + TalkingHead',
      duration: 12,
      bgColor: '#020617',
      chartLayers,
      sceneCode: compiled.sceneCode,
      d3Data: compiled.d3Data,
      aiLayers: [
        talkingHeadLayer({
          placement: 'pip_bottom_right',
          lines: [
            { text: 'Scene four: data visualization with a corner narrator.', lookCamera: true },
            { text: 'Structured chart layers compile to one D3 scene.', pauseBefore: 260 },
          ],
        }),
      ],
    },
    {
      ...base(),
      id: uuidv4(),
      name: '05 Three.js · WebGL + PIP',
      sceneType: 'three',
      prompt: 'Avatar showcase — Three under TalkingHead',
      duration: 12,
      bgColor: '#0b1220',
      sceneCode: THREE_SHOWCASE,
      aiLayers: [
        talkingHeadLayer({
          placement: 'pip_bottom_right',
          character: 'energetic',
          lines: [
            { text: 'Scene five: WebGL canvas sits behind the presenter layer.', lookCamera: true },
            { text: 'Renderer mounts inside scene-camera at z-index zero.', pauseBefore: 280 },
          ],
        }),
      ],
    },
    {
      ...base(),
      id: uuidv4(),
      name: `06 Canvas2D · ${canvasTpl.name}`,
      sceneType: 'canvas2d',
      prompt: `Avatar showcase — canvas template ${canvasTpl.id}`,
      duration: 10,
      bgColor: canvasTpl.suggestedBgColor,
      canvasCode: canvasCode,
      aiLayers: [
        talkingHeadLayer({
          placement: 'pip_bottom_right',
          lines: [
            { text: 'Scene six: procedural canvas animation with a host.', lookCamera: true },
            { text: 'Templates live in lib slash templates slash canvas-animation-templates.', pauseBefore: 240 },
          ],
        }),
      ],
    },
    {
      ...base(),
      id: uuidv4(),
      name: '07 Zdog · isometric',
      sceneType: 'zdog',
      prompt: 'Avatar showcase — Zdog + TalkingHead',
      duration: 10,
      bgColor: '#1e1b4b',
      sceneCode: ZDOG_SHOWCASE,
      aiLayers: [
        talkingHeadLayer({
          placement: 'pip_bottom_right',
          lines: [
            { text: 'Scene seven: lightweight pseudo-three-D with Zdog.', mood: 'happy', gesture: 'thumbup' },
            { text: 'Pairs well with explainer voiceover.', pauseBefore: 220 },
          ],
        }),
      ],
    },
    {
      ...base(),
      id: uuidv4(),
      name: '08 Avatar scene · panels',
      sceneType: 'avatar_scene',
      prompt: 'Avatar showcase — avatar_scene layout',
      duration: 14,
      bgColor: '#0f172a',
      aiLayers: [avatarSceneLayer],
    },
    {
      ...base(),
      id: uuidv4(),
      name: '09 Motion · MPFB mesh',
      sceneType: 'motion',
      prompt: 'Avatar showcase — second built-in VRM',
      duration: 12,
      bgColor: '#1e293b',
      sceneCode: MOTION_PANEL_MPFB,
      aiLayers: [
        talkingHeadLayer({
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
  ]
}

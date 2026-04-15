/**
 * Single-scene sanity check for TalkingHead mouth motion on the free VRM (no TTS / no API keys).
 * Uses narrationScript.fakeLipsync: jaw-only loop for estimated speaking time from line text.
 *
 * Load: Settings → Dev → "Load TalkingHead lip sync test (1 scene)".
 */
import { v4 as uuidv4 } from 'uuid'
import type { AvatarLayer, NarrationScript, Scene } from './types'
import { DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER, type TalkingHeadAvatarModelId } from './avatars/talkinghead-models'

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
    duration: 12,
    bgColor: '#0c1222',
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

function talkingHeadAvatar(opts: {
  placement: NarrationScript['position']
  lines: NarrationScript['lines']
  character?: NarrationScript['character']
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
    x: placement.includes('right') ? 1640 : 280,
    y: placement.includes('top') ? 280 : 800,
    width: opts.pipSize ?? 300,
    height: opts.pipSize ?? 300,
    opacity: 1,
    zIndex: 100,
    videoUrl: null,
    thumbnailUrl: null,
    status: 'ready',
    heygenVideoId: null,
    estimatedDuration: 14,
    startAt: 0,
    label: opts.label ?? 'Lip sync test',
    avatarPlacement: placement,
    avatarProvider: 'talkinghead',
    talkingHeadUrl: url,
    narrationScript: {
      mood: 'happy',
      view: 'upper',
      lipsyncHeadMovement: true,
      eyeContact: 0.75,
      fakeLipsync: true,
      position: placement,
      pipSize: opts.pipSize ?? 300,
      pipShape: 'circle',
      enterAt: 0,
      entranceAnimation: 'fade',
      character,
      avatarModelId: model,
      lines: opts.lines,
    },
  }
}

const PANEL = `
const panel = document.createElement('div');
panel.style.cssText = 'position:absolute;left:64px;top:72px;max-width:1100px;z-index:2;pointer-events:none;';
const h1 = document.createElement('h1');
h1.style.cssText = 'margin:0 0 12px;font-size:44px;font-weight:800;color:#e2e8f0;letter-spacing:-0.02em;';
h1.textContent = 'TalkingHead lip sync test';
const p = document.createElement('p');
p.style.cssText = 'margin:0 0 10px;font-size:20px;line-height:1.55;color:#94a3b8;max-width:52rem;';
p.textContent = 'This scene uses fake lipsync only: the free TalkingHead model moves its mouth for a few seconds from the narration text length. No Web Speech and no cloud TTS required. Turn off fake lipsync in the layer script to test real TTS + speakAudio.';
const ul = document.createElement('ul');
ul.style.cssText = 'margin:0;padding-left:1.25rem;font-size:17px;line-height:1.65;color:#64748b;';
['Press play — you should see jaw motion, silence is OK', 'Clear fakeLipsync on narration to use server or Web Speech TTS'].forEach(function (t) {
  var li = document.createElement('li');
  li.textContent = t;
  ul.appendChild(li);
});
panel.appendChild(h1);
panel.appendChild(p);
panel.appendChild(ul);
document.getElementById('scene-camera').prepend(panel);
`.trim()

export function createTalkingHeadLipSyncTestScene(): Scene[] {
  const lines: NarrationScript['lines'] = [
    {
      text: 'Lip sync test. You should see my mouth move while I speak.',
      mood: 'happy',
      lookCamera: true,
    },
    {
      text: 'If you only hear audio but the mouth stays frozen, check the browser console inside the scene preview.',
      pauseBefore: 350,
    },
  ]

  return [
    {
      ...base(),
      id: uuidv4(),
      name: 'Test · TalkingHead lip sync',
      sceneType: 'motion',
      prompt: 'Minimal motion scene to verify TalkingHead lip sync',
      duration: 14,
      bgColor: '#0c1222',
      sceneCode: PANEL,
      aiLayers: [
        talkingHeadAvatar({
          placement: 'pip_bottom_right',
          avatarModelId: 'brunette_remote',
          pipSize: 300,
          label: 'Lip sync',
          lines,
        }),
      ],
    },
  ]
}

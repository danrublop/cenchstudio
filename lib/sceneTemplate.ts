/* eslint-disable no-useless-escape -- <\/script> escapes required in template literal HTML to prevent early tag closing */
import type {
  Scene,
  AILayer,
  AvatarLayer,
  Veo3Layer,
  ImageLayer,
  StickerLayer,
  AudioLayer,
  GlobalStyle,
  WatermarkConfig,
  CameraMove,
  AudioSettings,
} from './types'
import { type ProjectDimensions, DEFAULT_DIMENSIONS } from './dimensions'
import { getBestTTSProvider } from './audio/resolve-best-tts-provider'
import {
  THREE_ENVIRONMENT_RUNTIME_SCRIPT,
  THREE_HELPERS_RUNTIME_SCRIPT,
  THREE_SCATTER_RUNTIME_SCRIPT,
} from './three-environments/inlined-runtimes'
import { CANVAS_RENDERER_CODE } from './canvas-renderer/inlined'
import { resolveStyle, type ResolvedStyle } from './styles/presets'
import { resolveSceneStyle } from './styles/scene-presets'
import { buildFontLink, buildMultiFontLink, resolveSceneFontFamily, sceneFontCssStack } from './fonts/catalog'
import { GSAP_HEAD } from './scene-html/gsap-head'
import { PLAYBACK_CONTROLLER } from './scene-html/playback-controller'
import { ELEMENT_REGISTRY } from './scene-html/element-registry'
import { normalizeAudioLayer } from './audio/normalize'
import { chartLayersUsePlotly, chartLayersUseRecharts } from './charts/compile'
import {
  getTalkingHeadGlbPath,
  resolveTalkingHeadModelId,
  resolveTalkingHeadModelIdFromLayer,
} from './avatars/talkinghead-models'

/** Build a Google Fonts link tag that loads both heading and body fonts (if different). */
function buildSceneFontLinks(style: ResolvedStyle): string {
  const unique = [...new Set([style.font, style.bodyFont].filter(Boolean) as string[])]
  if (unique.length === 0) return ''
  if (unique.length === 1) return buildFontLink(unique[0])
  return buildMultiFontLink(unique)
}

function canvasBgTag(W = 1920, H = 1080): string {
  return `<canvas id="c" width="${W}" height="${H}" style="display:block;position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;margin:0;padding:0;border:0;pointer-events:none;"></canvas>`
}

function sceneUsesCanvasBackground(scene: Scene): boolean {
  return (
    !!scene.canvasBackgroundCode?.trim() && ['motion', 'd3', 'svg', 'physics', 'react'].includes(scene.sceneType ?? '')
  )
}

// ── Multi-track audio HTML generation ─────────────────────────────────────────

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escape a string for safe insertion into a JS single-quoted string literal. */
function escapeJsString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/<\/script/gi, '<\\/script')
}

/** Strip closing style tags from CSS to prevent context escape in <style> blocks. */
function sanitizeCssBlock(s: string): string {
  return s.replace(/<\/style/gi, '/* escaped */')
}

/** Validate and parse a hex color string, returning '0,0,0' for invalid input. */
function safeHexToRgb(hex: string): string {
  const h = (hex || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h) && !/^[0-9a-fA-F]{3}$/.test(h)) return '0,0,0'
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return `${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)}`
}

function generateAudioHTML(audioLayer: AudioLayer | null | undefined): string {
  const al = normalizeAudioLayer(audioLayer)
  if (!al.enabled) return ''

  const parts: string[] = []
  const vol = Math.min(1, Math.max(0, Number(al.volume)))
  const startOff = Number.isFinite(al.startOffset) && al.startOffset > 0 ? al.startOffset : 0
  const volAttr = Number.isFinite(vol) ? vol : 1
  const dataVol = ` data-volume="${volAttr}"`
  const dataOff = ` data-start-offset="${startOff}"`

  // TTS track
  if (al.tts?.src && al.tts.status === 'ready') {
    parts.push(`<audio id="scene-tts" src="${al.tts.src}" data-track="tts"${dataVol}${dataOff} preload="auto"></audio>`)
  } else if (al.tts && !al.tts.src && al.tts.status === 'ready') {
    // Client-side TTS (web-speech or puter): inject config div
    parts.push(
      `<div id="scene-tts-config" data-provider="${al.tts.provider}" data-text="${escapeAttr(al.tts.text)}" data-voice="${al.tts.voiceId ?? ''}" style="display:none"></div>`,
    )
  } else if (al.src) {
    // Legacy single-track audio
    parts.push(`<audio id="scene-audio" src="${al.src}"${dataVol}${dataOff} preload="auto"></audio>`)
  }

  // SFX tracks
  for (const sfx of al.sfx ?? []) {
    parts.push(
      `<audio id="sfx-${sfx.id}" src="${sfx.src}" data-track="sfx" data-trigger-at="${sfx.triggerAt}" data-volume="${sfx.volume}" preload="auto"></audio>`,
    )
  }

  // Music track
  if (al.music?.src) {
    parts.push(
      `<audio id="scene-music" src="${al.music.src}" data-track="music" data-volume="${al.music.volume}" ${al.music.loop ? 'loop' : ''} data-duck="${al.music.duckDuringTTS}" data-duck-level="${al.music.duckLevel}" preload="auto"></audio>`,
    )
  }

  return parts.join('\n  ')
}

// ── AI Layer HTML generation ────────────────────────────────────────────────

function generateAILayersHTML(layers: AILayer[] | undefined, audioSettings?: AudioSettings | null): string {
  if (!layers || layers.length === 0) return ''

  return layers
    .filter((l) => l.status === 'ready')
    .map((layer) => {
      switch (layer.type) {
        case 'avatar':
          return generateAvatarLayerHTML(layer as AvatarLayer, audioSettings)
        case 'veo3':
          return generateVeo3LayerHTML(layer as Veo3Layer)
        case 'image':
          return generateImageLayerHTML(layer as ImageLayer)
        case 'sticker':
          return generateStickerLayerHTML(layer as StickerLayer)
        default:
          return ''
      }
    })
    .join('\n  ')
}

function generateAvatarLayerHTML(layer: AvatarLayer, audioSettings?: AudioSettings | null): string {
  const startAt = layer.startAt ?? 0
  const placement = (layer as any).avatarPlacement as string | undefined
  const talkingHeadUrl = (layer as any).talkingHeadUrl as string | undefined
  const ns = layer.narrationScript
  const pipShape = ns?.pipShape ?? 'circle'
  const containerEnabled = ns?.containerEnabled !== false
  const avatarScale = ns?.avatarScale ?? 1.15

  // TalkingHead provider: inject inline Three.js canvas
  if (talkingHeadUrl) {
    return generateTalkingHeadHTML(layer, talkingHeadUrl, placement, audioSettings)
  }

  if (!layer.videoUrl) return ''

  // Determine positioning based on placement
  const posStyle = getAvatarPlacementCSS(placement, ns?.pipSize, pipShape, containerEnabled)
  const videoStyle = `${posStyle.media}transform:scale(${avatarScale});transform-origin:center bottom;`

  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};${posStyle.container}">
  <video
    id="${layer.id}-video"
    style="${videoStyle}"
    src="${layer.videoUrl}"
    playsinline
    muted>
  </video>
  <script>
    // Sync avatar video to GSAP timeline (no autoplay)
    window.addEventListener('load', function() {
      var v = document.getElementById('${layer.id}-video');
      if (!v || !window.__tl) return;
      window.__tl.call(function() { v.play(); }, null, ${startAt});
      window.__tl.call(function() { v.pause(); }, null, ${startAt} + (v.duration || 30));
    });
  </script>
</div>`
}

function getAvatarPlacementCSS(
  placement?: string,
  pipSize?: number,
  pipShape?: string,
  containerEnabled: boolean = true,
): { container: string; media: string } {
  if (placement === 'fullscreen') {
    return {
      container: 'position:absolute;inset:0;',
      media: 'width:100%;height:100%;object-fit:cover;',
    }
  }
  if (placement === 'fullscreen_left') {
    return {
      container: 'position:absolute;left:0;bottom:0;width:40%;height:100%;',
      media: 'width:100%;height:100%;object-fit:cover;',
    }
  }
  if (placement === 'fullscreen_right') {
    return {
      container: 'position:absolute;right:0;bottom:0;width:40%;height:100%;',
      media: 'width:100%;height:100%;object-fit:cover;',
    }
  }

  const pipPositions: Record<string, string> = {
    pip_bottom_right: 'bottom:40px;right:40px;',
    pip_bottom_left: 'bottom:40px;left:40px;',
    pip_top_right: 'top:40px;right:40px;',
  }
  const pos = pipPositions[placement ?? 'pip_bottom_right'] ?? pipPositions.pip_bottom_right
  const size = pipSize ?? 280
  const radius = pipShape === 'square' ? '0' : pipShape === 'rounded' ? '16px' : '50%'
  const containerChrome = containerEnabled
    ? 'overflow:hidden;border:3px solid rgba(255,255,255,0.3);box-shadow:0 8px 32px rgba(0,0,0,0.4);'
    : 'overflow:visible;border:none;box-shadow:none;background:transparent;'

  return {
    container: `position:absolute;${pos}width:${size}px;height:${size}px;border-radius:${radius};${containerChrome}`,
    media: 'width:100%;height:100%;object-fit:cover;',
  }
}

/** Check if a server-side TTS provider is configured (env vars only, no fs imports) */
function hasServerTTS(): boolean {
  return !!(
    process.env.ELEVENLABS_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_TTS_API_KEY ||
    process.env.EDGE_TTS_URL
  )
}

/**
 * URL baked into TalkingHead only when server TTS can satisfy /api/tts/talkinghead.
 * Respects project audioSettings so "Web Speech" does not point the avatar at a 503 endpoint.
 */
function talkingHeadTtsEndpointForEmbed(audioSettings?: AudioSettings | null): string | null {
  if (!hasServerTTS()) return null
  const p = getBestTTSProvider(audioSettings ?? undefined)
  if (p === 'web-speech' || p === 'puter') return null
  return '/api/tts/talkinghead'
}

function talkingHeadTtsEndpointJsLiteral(audioSettings?: AudioSettings | null): string {
  const ep = talkingHeadTtsEndpointForEmbed(audioSettings)
  return ep == null ? 'null' : JSON.stringify(ep)
}

function generateTalkingHeadHTML(
  layer: AvatarLayer,
  talkingHeadUrl: string,
  placement?: string,
  audioSettings?: AudioSettings | null,
): string {
  const params = new URL(talkingHeadUrl)
  const audioSrc = params.searchParams.get('audio') || ''

  // NarrationScript settings (with defaults)
  const ns = layer.narrationScript
  const textFromUrl = params.searchParams.get('text') || ''
  const textFromLines = ns?.lines?.length ? ns.lines.map((l) => l.text).join(' ') : ''
  const text = textFromUrl || textFromLines || (layer.script || '').trim()
  const character = ns?.character ?? params.searchParams.get('character') ?? 'friendly'
  const mood = ns?.mood ?? 'happy'
  const view = ns?.view ?? 'upper'
  const eyeContact = ns?.eyeContact ?? 0.7
  const headMovement = ns?.lipsyncHeadMovement !== false
  const fakeLipsync = ns?.fakeLipsync === true
  const enterAt = ns?.enterAt ?? layer.startAt ?? 0
  const exitAt = ns?.exitAt
  const entrance = ns?.entranceAnimation ?? 'fade'
  const exitAnim = ns?.exitAnimation ?? 'fade'
  const pipShape = ns?.pipShape ?? 'circle'
  const avatarScale = ns?.avatarScale ?? 1.15
  const containerEnabled = ns?.containerEnabled !== false

  // Container glassmorphic styling
  const cBlur = ns?.containerBlur ?? 0
  const cBorderColor = ns?.containerBorderColor ?? '#ffffff'
  const cBorderOpacity = ns?.containerBorderOpacity ?? 0.3
  const cBorderWidth = ns?.containerBorderWidth ?? 3
  const cShadowOpacity = ns?.containerShadowOpacity ?? 0.4
  const cInnerGlow = ns?.containerInnerGlow ?? 0
  const cBgOpacity = ns?.containerBgOpacity ?? 1

  const effectivePlacement = ns?.position ?? placement
  const posStyle = getAvatarPlacementCSS(effectivePlacement, ns?.pipSize, pipShape, containerEnabled)
  const containerId = `${layer.id}-talkinghead`
  const fallbackId = `${layer.id}-fallback`

  const characterEmoji: Record<string, string> = { friendly: '😊', professional: '👔', energetic: '⚡' }
  const characterColor: Record<string, string> = { friendly: '#6366f1', professional: '#0ea5e9', energetic: '#f59e0b' }
  const emoji = characterEmoji[character] || '🎙️'
  const bgColor = ns?.background ?? characterColor[character] ?? '#6366f1'

  const pipGlbUrl = getTalkingHeadGlbPath(resolveTalkingHeadModelIdFromLayer(layer))

  // Build glassmorphic container style
  const bgRgb = safeHexToRgb(bgColor)
  const borderRgb = safeHexToRgb(cBorderColor)

  const glassBg = cBlur > 0 ? `rgba(${bgRgb},${cBgOpacity})` : bgColor
  const glassBackdrop =
    cBlur > 0
      ? `backdrop-filter:blur(${cBlur}px) saturate(180%);-webkit-backdrop-filter:blur(${cBlur}px) saturate(180%);`
      : ''
  const glassBorder = `border:${cBorderWidth}px solid rgba(${borderRgb},${cBorderOpacity});`
  const glassShadow = [
    cShadowOpacity > 0 ? `0 8px 32px rgba(0,0,0,${cShadowOpacity})` : '',
    cInnerGlow > 0 ? `inset 0 1px 0 rgba(255,255,255,${Math.min(cInnerGlow, 1)})` : '',
    cInnerGlow > 0 ? `inset 0 0 20px 10px rgba(${bgRgb},${cInnerGlow})` : '',
  ]
    .filter(Boolean)
    .join(',')

  const wrapperVisualStyle = containerEnabled
    ? `background:${glassBg};${glassBackdrop}${glassBorder}box-shadow:${glassShadow || 'none'};`
    : 'background:transparent;border:none;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;'
  const contentOverflow = containerEnabled
    ? 'overflow:hidden;border-radius:inherit;'
    : 'overflow:visible;border-radius:0;'

  // Start hidden — GSAP entrance animation fades in at enterAt
  const fallbackBg = containerEnabled
    ? `background:linear-gradient(135deg, ${bgColor}, ${bgColor}dd);`
    : 'background:transparent;'

  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:0;z-index:${layer.zIndex};${posStyle.container}${wrapperVisualStyle}transition:opacity 0.4s;">
  <div id="${containerId}" style="width:100%;height:100%;position:absolute;inset:0;${contentOverflow}z-index:0;transform:scale(${avatarScale});transform-origin:center bottom;"></div>
  <div id="${fallbackId}" style="width:100%;height:100%;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;${fallbackBg}z-index:1;border-radius:inherit;">
    <div style="font-size:64px;line-height:1;animation:pulse-avatar 2s ease-in-out infinite;">${emoji}</div>
    <div id="${fallbackId}-status" style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:8px;font-family:system-ui;letter-spacing:0.5px;">Loading 3D...</div>
  </div>
  <style>
    @keyframes pulse-avatar { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  </style>
  <script type="module">
    (async function() {
      const fallback = document.getElementById('${fallbackId}');
      const statusEl = document.getElementById('${fallbackId}-status');
      const container = document.getElementById('${containerId}');
      const wrapper = document.getElementById('${layer.id}');
      if (!container) return;

      // Wait for container to have dimensions (iframe may be display:none initially)
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        if (statusEl) statusEl.textContent = 'Waiting for visibility...';
        await new Promise((resolve) => {
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver((entries) => {
              for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                  ro.disconnect(); resolve(); return;
                }
              }
            });
            ro.observe(container);
          } else {
            const iv = setInterval(() => {
              if (container.offsetWidth > 0 && container.offsetHeight > 0) { clearInterval(iv); resolve(); }
            }, 200);
          }
        });
      }

      try {
        if (statusEl) statusEl.textContent = 'Loading TalkingHead...';
        const mod = await import('https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/modules/talkinghead.mjs');
        const TalkingHead = mod.TalkingHead;
        if (!TalkingHead) { console.error('[TalkingHead] Not in module exports'); return; }

        if (statusEl) statusEl.textContent = 'Initializing 3D...';

        // Restore native RAF — TalkingHead's Three.js loop must not be blocked
        if (window.__nativeRAF) window.requestAnimationFrame = window.__nativeRAF;
        if (window.__nativeCAF) window.cancelAnimationFrame = window.__nativeCAF;
        window.__rafUnlocked = true;

        const head = new TalkingHead(container, {
          ttsEndpoint: ${talkingHeadTtsEndpointJsLiteral(audioSettings)},
          ttsLang: 'en-US',
          cameraView: '${view}',
          cameraRotateEnable: false,
          avatarSpeakingEyeContact: ${eyeContact},
          avatarIdleEyeContact: ${Math.max(0, eyeContact - 0.2)},
        });

        const vrmUrl = ${JSON.stringify(pipGlbUrl)};
        if (statusEl) statusEl.textContent = 'Loading avatar model...';
        await head.showAvatar({
          url: vrmUrl, body: 'F', lipsyncLang: 'en',
          lipsyncHeadMovement: ${headMovement},
        }, (e) => {
          if (statusEl && e.total) statusEl.textContent = 'Loading ' + Math.round(100 * e.loaded / e.total) + '%';
        });

        // 3D loaded — remove fallback
        if (fallback) fallback.style.display = 'none';

        // Start in neutral idle (breathing/blinking). Active mood set on play.
        head.setMood('neutral');

        // Expose for playback controller + settings panel postMessage commands
        window.__avatarHead = head;
        window.__avatarMood = '${mood}';
        window.__avatarSpeechStarted = false;

        // ── Entrance / exit via GSAP timeline ───────────────────
        if (window.__tl) {
          ${
            entrance === 'scale-in'
              ? `wrapper.style.transform = 'scale(0)';
          window.__tl.to(wrapper, { opacity: 1, scale: 1, duration: 0.4 }, ${enterAt});`
              : entrance === 'slide-up'
                ? `wrapper.style.transform = 'translateY(40px)';
          window.__tl.to(wrapper, { opacity: 1, y: 0, duration: 0.4 }, ${enterAt});`
                : `window.__tl.to(wrapper, { opacity: 1, duration: 0.4 }, ${enterAt});`
          }
          ${
            exitAt != null
              ? exitAnim === 'scale-out'
                ? `window.__tl.to(wrapper, { opacity: 0, scale: 0, duration: 0.4 }, ${exitAt});`
                : exitAnim === 'slide-down'
                  ? `window.__tl.to(wrapper, { opacity: 0, y: 40, duration: 0.4 }, ${exitAt});`
                  : `window.__tl.to(wrapper, { opacity: 0, duration: 0.4 }, ${exitAt});`
              : ''
          }
        } else {
          wrapper.style.opacity = '1';
        }

        // ── Speech with lip sync: speakAudio (server/URL) drives mouth; Web Speech + jaw fallback ──
        function __cenchTraverseFaceMesh(root) {
          if (!root || !root.traverse) return null;
          var found = null;
          var preferred = [
            'jawOpen', 'mouthOpen', 'jaw_lower', 'Jaw_Open', 'aac', 'viseme_aa', 'viseme_A',
            'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'mouthSmile', 'mouthFunnel',
          ];
          root.traverse(function (child) {
            if (found || !child.isMesh || !child.morphTargetDictionary) return;
            var d = child.morphTargetDictionary;
            var i, k;
            for (i = 0; i < preferred.length; i++) {
              k = preferred[i];
              if (k in d) { found = child; return; }
            }
            var names = Object.keys(d);
            for (i = 0; i < names.length; i++) {
              var n = names[i];
              var lower = n.toLowerCase();
              if (lower.indexOf('jaw') !== -1 || lower.indexOf('mouth') !== -1 || n.indexOf('viseme_') === 0) {
                found = child;
                return;
              }
            }
          });
          return found;
        }

        function __cenchFindFaceMeshForLipSync(h, domContainer) {
          var roots = [h.nodeAvatar, h.scene, h.avatar, domContainer].filter(Boolean);
          var ri;
          for (ri = 0; ri < roots.length; ri++) {
            var m = __cenchTraverseFaceMesh(roots[ri]);
            if (m) return m;
          }
          return null;
        }

        function __cenchApplyMouthJaw(md, mt, jaw) {
          var pairs = [
            ['jawOpen', jaw],
            ['mouthOpen', jaw],
            ['jaw_lower', jaw * 0.92],
            ['Jaw_Open', jaw],
            ['aac', jaw * 0.7],
            ['viseme_aa', jaw * 0.55],
            ['viseme_A', jaw * 0.5],
            ['viseme_E', jaw * 0.45],
            ['viseme_I', jaw * 0.35],
            ['viseme_O', jaw * 0.38],
            ['viseme_U', jaw * 0.32],
          ];
          for (var pi = 0; pi < pairs.length; pi++) {
            var nm = pairs[pi][0];
            var v = pairs[pi][1];
            if (nm in md) mt[md[nm]] = v;
          }
        }

        async function __cenchSpeakServerTtsToHead(endpoint, txt) {
          if (!endpoint || !txt) return false;
          try {
            var r = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: { text: txt },
                voice: { languageCode: 'en-US', name: '' },
                audioConfig: { audioEncoding: 'MP3' },
              }),
            });
            if (!r.ok) return false;
            var data = await r.json();
            if (!data.audioContent) return false;
            var binary = atob(data.audioContent);
            var len = binary.length;
            var bytes = new Uint8Array(len);
            var i;
            for (i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            var AC = window.AudioContext || window.webkitAudioContext;
            var audioCtx = new AC();
            try {
              if (audioCtx.state === 'suspended') await audioCtx.resume();
            } catch (e0) {}
            var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            var audioBuf = await audioCtx.decodeAudioData(ab);
            var words = txt.split(/\\s+/).filter(Boolean);
            if (!words.length) words = ['...'];
            var totalMs = audioBuf.duration * 1000;
            var perWord = totalMs / (words.length || 1);
            head.speakAudio({
              audio: audioBuf,
              words: words,
              wtimes: words.map(function (_, wi) { return Math.round(wi * perWord); }),
              wdurations: words.map(function () { return Math.round(perWord * 0.9); }),
            });
            return true;
          } catch (e) {
            console.warn('[TalkingHead] server TTS speakAudio failed:', e);
            return false;
          }
        }

        const textToSpeak = decodeURIComponent('${encodeURIComponent(text)}');
        const audioUrl = decodeURIComponent('${encodeURIComponent(audioSrc)}');

        var faceMesh = __cenchFindFaceMeshForLipSync(head, container);
        const FAKE_LIPSYNC = ${fakeLipsync ? 'true' : 'false'};

        function fakeTalkJawOnly(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              if (Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
        }

        function speakWithBrowserTTS(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              var synth = window.speechSynthesis;
              var speaking = synth && synth.speaking;
              if (!speaking && Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
          if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (e1) {}
            try { window.speechSynthesis.resume(); } catch (e2) {}
            var u = new SpeechSynthesisUtterance(txt);
            u.lang = 'en-US';
            u.rate = 1;
            u.onend = function () { stopJaw(); };
            u.onerror = function () { /* jaw continues until endAt */ };
            window.speechSynthesis.speak(u);
          }
        }

        window.__avatarStartSpeech = async function () {
          try {
            if (FAKE_LIPSYNC) {
              fakeTalkJawOnly(textToSpeak);
              return;
            }
            if (audioUrl) {
              const resp = await fetch(audioUrl);
              const arrayBuf = await resp.arrayBuffer();
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              try {
                if (audioCtx.state === 'suspended') await audioCtx.resume();
              } catch (e3) {}
              const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
              const words = textToSpeak ? textToSpeak.split(/\\s+/) : ['...'];
              const totalMs = audioBuf.duration * 1000;
              const perWord = totalMs / (words.length || 1);
              head.speakAudio({
                audio: audioBuf,
                words: words,
                wtimes: words.map((_, i) => Math.round(i * perWord)),
                wdurations: words.map(() => Math.round(perWord * 0.9)),
              });
              return;
            }
            var ep = head.opt && head.opt.ttsEndpoint;
            if (textToSpeak && ep && (await __cenchSpeakServerTtsToHead(ep, textToSpeak))) return;
            speakWithBrowserTTS(textToSpeak);
          } catch (e) {
            console.warn('[TalkingHead] Speech error:', e);
            speakWithBrowserTTS(textToSpeak);
          }
        };

        console.log('[TalkingHead] Ready — mood=${mood}, view=${view}, eyeContact=${eyeContact}');

      } catch(e) {
        console.error('[TalkingHead] Fatal:', e);
        if (statusEl) {
          statusEl.textContent = 'Error: ' + (e.message || e);
          statusEl.style.color = 'rgba(255,100,100,0.8)';
        }
      }
    })();
  </script>
</div>`
}

function generateVeo3LayerHTML(layer: Veo3Layer): string {
  if (!layer.videoUrl) return ''
  const startAt = layer.startAt ?? 0
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <video
    id="${layer.id}-video"
    style="position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;object-fit:cover;"
    src="${layer.videoUrl}"
    playsinline
    muted
    ${layer.loop ? 'loop' : ''}>
  </video>
  <script>
    // Sync veo3 video to GSAP timeline (no autoplay)
    window.addEventListener('load', function() {
      var v = document.getElementById('${layer.id}-video');
      if (!v || !window.__tl) return;
      v.playbackRate = ${layer.playbackRate ?? 1};
      window.__tl.call(function() { v.play(); }, null, ${startAt});
    });
  </script>
</div>`
}

/** Generate GSAP animation script for an AI layer */
function generateLayerAnimationScript(
  layerId: string,
  imgId: string,
  anim: import('./types').LayerAnimation | undefined,
  startAt: number,
): string {
  if (!anim || anim.type === 'none') return ''

  const ease =
    anim.easing === 'linear'
      ? 'none'
      : anim.easing === 'ease-in'
        ? 'power2.in'
        : anim.easing === 'ease-in-out'
          ? 'power2.inOut'
          : 'power2.out'
  const delay = startAt + (anim.delay ?? 0)
  const dur = anim.duration ?? 0.5

  // Map animation types to GSAP from/to properties
  const animMap: Record<string, { initial: string; props: string }> = {
    'fade-in': { initial: 'opacity:0;', props: `opacity:1, duration:${dur}, ease:'${ease}'` },
    'fade-out': { initial: '', props: `opacity:0, duration:${dur}, ease:'${ease}'` },
    'slide-left': {
      initial: 'opacity:0;transform:translateX(100px);',
      props: `opacity:1, x:0, duration:${dur}, ease:'${ease}'`,
    },
    'slide-right': {
      initial: 'opacity:0;transform:translateX(-100px);',
      props: `opacity:1, x:0, duration:${dur}, ease:'${ease}'`,
    },
    'slide-up': {
      initial: 'opacity:0;transform:translateY(60px);',
      props: `opacity:1, y:0, duration:${dur}, ease:'${ease}'`,
    },
    'slide-down': {
      initial: 'opacity:0;transform:translateY(-60px);',
      props: `opacity:1, y:0, duration:${dur}, ease:'${ease}'`,
    },
    'scale-in': {
      initial: 'opacity:0;transform:scale(0);',
      props: `opacity:1, scale:1, duration:${dur}, ease:'${ease}'`,
    },
    'scale-out': { initial: '', props: `opacity:0, scale:0, duration:${dur}, ease:'${ease}'` },
    'spin-in': {
      initial: 'opacity:0;transform:rotate(-180deg) scale(0);',
      props: `opacity:1, rotation:0, scale:1, duration:${dur}, ease:'${ease}'`,
    },
  }

  const config = animMap[anim.type]
  if (!config) return ''

  return `<script>
    window.addEventListener('load', function() {
      var el = document.getElementById('${imgId}');
      if (!el || !window.__tl) return;
      window.__tl.to(el, { ${config.props} }, ${delay});
    });
  </script>`
}

function generateImageLayerHTML(layer: ImageLayer): string {
  if (!layer.imageUrl) return ''
  const filterCSS = layer.filter ? `filter:${layer.filter};` : ''
  const anim = layer.animation
  const initialStyle = anim && anim.type !== 'none' ? getAnimInitialStyle(anim.type) : ''
  const cropStyle =
    (layer as any).cropX != null
      ? `object-fit:cover;object-position:${(layer as any).cropX}% ${(layer as any).cropY ?? 50}%;overflow:hidden;`
      : 'object-fit:contain;'
  const imgId = `${layer.id}-img`

  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <img
    id="${imgId}"
    src="${layer.imageUrl}"
    style="position:absolute;left:${layer.x - layer.width / 2}px;top:${layer.y - layer.height / 2}px;width:${layer.width}px;height:${layer.height}px;transform:rotate(${layer.rotation}deg);${cropStyle}${filterCSS}${initialStyle}"
  >
  ${generateLayerAnimationScript(layer.id, imgId, anim, layer.startAt ?? 0)}
</div>`
}

function getAnimInitialStyle(type: string): string {
  const map: Record<string, string> = {
    'fade-in': 'opacity:0;',
    'slide-left': 'opacity:0;transform:translateX(100px);',
    'slide-right': 'opacity:0;transform:translateX(-100px);',
    'slide-up': 'opacity:0;transform:translateY(60px);',
    'slide-down': 'opacity:0;transform:translateY(-60px);',
    'scale-in': 'opacity:0;transform:scale(0);',
    'spin-in': 'opacity:0;transform:rotate(-180deg) scale(0);',
  }
  return map[type] ?? ''
}

function generateStickerLayerHTML(layer: StickerLayer): string {
  const src = layer.stickerUrl ?? layer.imageUrl
  if (!src) return ''
  const filterCSS = layer.filter ? `filter:${layer.filter};` : ''
  const imgId = `${layer.id}-img`

  // Use new animation system if set, otherwise fall back to legacy animateIn
  const anim = layer.animation
  const hasNewAnim = anim && anim.type !== 'none'
  const initialStyle = hasNewAnim
    ? getAnimInitialStyle(anim.type)
    : layer.animateIn
      ? 'opacity:0;transform:scale(0.5);'
      : ''

  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <img
    id="${imgId}"
    src="${src}"
    style="position:absolute;left:${layer.x - layer.width / 2}px;top:${layer.y - layer.height / 2}px;width:${layer.width}px;height:${layer.height}px;transform:rotate(${layer.rotation}deg);object-fit:contain;${filterCSS}${initialStyle}"
  >
  ${
    hasNewAnim
      ? generateLayerAnimationScript(layer.id, imgId, anim, layer.startAt ?? 0)
      : layer.animateIn
        ? `<script>
    window.addEventListener('load', function() {
      var img = document.getElementById('${imgId}');
      if (!img || !window.__tl) return;
      window.__tl.to(img, {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: 'power2.out',
      }, ${layer.startAt ?? 0});
    });
  </script>`
        : ''
  }
</div>`
}

function generateCanvasHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const { canvasCode = '' } = scene
  const useTexture = style.textureStyle !== 'none'
  const useRoughJs = style.roughnessLevel > 0
  const sceneHash = hashString(scene.id)

  const audioHTML = generateAudioHTML(scene.audioLayer)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      inset: 0;
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform, filter;
    }
    canvas {
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      width: ${W}px;
      height: ${H}px;
      margin: 0;
      padding: 0;
      border: 0;
    }
  </style>
  ${useRoughJs ? `<script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>` : ''}
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera">
  <canvas id="c" width="${W}" height="${H}"></canvas>
  <canvas id="texture-canvas" width="${W}" height="${H}"
    style="display:${useTexture ? 'block' : 'none'}; position:absolute; inset:0; pointer-events:none;
           mix-blend-mode:${style.textureBlendMode}; opacity:${style.textureIntensity};"></canvas>
  ${audioHTML}

  <script>
    // ── Scene globals ─────────────────────────────────────
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};
    var TOOL         = '${style.defaultTool}';
    var STROKE_COLOR = '${style.strokeColor}';

    // Seeded random
    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }

    // Audio volume is handled by the playback controller
  </script>

  ${generateAILayersHTML(scene.aiLayers, audioSettings)}

  </div><!-- /scene-camera -->

  <script>
${CANVAS_RENDERER_CODE}
  </script>

  <!-- playback-controller-slot -->

  <script>
${canvasCode}
  </script>

  <script>
    // ── Automatic texture overlay ─────────────────────────
    ${
      useTexture
        ? `
    (function applyTextureOverlay() {
      const textureCanvas = document.getElementById('texture-canvas');
      if (!textureCanvas) return;
      const ctx = textureCanvas.getContext('2d');
      function mulberry32(seed) {
        return function() {
          seed |= 0; seed = seed + 0x6D2B79F5 | 0;
          let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
      }
      const rand = mulberry32(${sceneHash});

      ${
        style.textureStyle === 'grain'
          ? `
        const imageData = ctx.createImageData(${W}, ${H});
        for (let i = 0; i < imageData.data.length; i += 4) {
          const noise = rand() * 255;
          imageData.data[i]   = noise;
          imageData.data[i+1] = noise;
          imageData.data[i+2] = noise;
          imageData.data[i+3] = rand() * 255;
        }
        ctx.putImageData(imageData, 0, 0);
      `
          : ''
      }

      ${
        style.textureStyle === 'paper'
          ? `
        for (let x = 0; x < ${W}; x += 1.5) {
          for (let y = 0; y < ${H}; y += 1.5) {
            const v = rand();
            ctx.fillStyle = \`rgba(0,0,0,\${v})\`;
            ctx.fillRect(x, y, 1.5, 1.5);
          }
        }
      `
          : ''
      }

      ${
        style.textureStyle === 'chalk'
          ? `
        for (let y = 0; y < ${H}; y += 2) {
          ctx.beginPath();
          ctx.strokeStyle = \`rgba(255,255,255,\${rand() * 0.3})\`;
          ctx.lineWidth = 1 + rand() * 2;
          ctx.moveTo(0, y + rand() * 2);
          for (let x = 0; x < ${W}; x += 20) {
            ctx.lineTo(x, y + (rand() - 0.5) * 4);
          }
          ctx.stroke();
        }
      `
          : ''
      }

      ${
        style.textureStyle === 'lines'
          ? `
        for (let y = 0; y < ${H}; y += 28) {
          ctx.beginPath();
          ctx.strokeStyle = \`rgba(0,0,0,0.06)\`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(0, y);
          ctx.lineTo(${W}, y);
          ctx.stroke();
        }
      `
          : ''
      }
    })();
    `
        : '// No texture overlay for this style preset'
    }
  </script>
</body>
</html>`
}

function generateMotionHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const { sceneCode = '', sceneHTML = '', sceneStyles = '' } = scene

  const audioHTML = generateAudioHTML(scene.audioLayer)
  const fixedStage = sceneUsesCanvasBackground(scene)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ${
      fixedStage
        ? `html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      left: 0;
      top: 0;
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform, filter;
    }`
        : `html, body { width: 100%; height: 100vh; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      inset: 0;
      transform-origin: center center;
      will-change: transform, filter;
    }`
    }
    ${sanitizeCssBlock(sceneStyles)}
  </style>
  ${
    fixedStage
      ? `<script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>`
      : ''
  }
</head>
<body>
  <div id="scene-camera"${fixedStage ? '' : ' style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;"'}>
  ${sceneUsesCanvasBackground(scene) ? `${canvasBgTag(W, H)}<div id="motion-foreground" style="position:absolute;inset:0;z-index:1;width:100%;height:100%;overflow:hidden;">` : ''}
  ${sceneHTML}
  ${sceneUsesCanvasBackground(scene) ? `</div>` : ''}
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};

    // Audio volume is handled by the playback controller
  </script>

  <!-- playback-controller-slot -->

  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>
  <script type="module">
    var animate, stagger;
    try {
      var m = await import("https://esm.sh/motion@11");
      animate = m.animate;
      stagger = m.stagger;
    } catch(e) {
      console.warn('Motion v11 failed to load, falling back to anime.js only:', e);
    }

    ${sceneCode}
  </script>
</body>
</html>`
}

function generateD3HTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const { sceneCode = '', sceneStyles = '', d3Data = null } = scene
  const needsPlotly = chartLayersUsePlotly(scene.chartLayers)
  const needsRecharts = chartLayersUseRecharts(scene.chartLayers)
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080

  const audioHTML = generateAudioHTML(scene.audioLayer)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${
    needsRecharts
      ? `<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client"
  }
}
</script>`
      : ''
  }
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      left: 0;
      top: 0;
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform, filter;
    }
    #chart { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; }
    ${
      needsRecharts
        ? `[data-cench-recharts] { box-sizing: border-box; }
    [data-cench-recharts] .recharts-cartesian-grid line { stroke: var(--cench-recharts-grid, rgba(255,255,255,0.08)); }
    [data-cench-recharts] .recharts-default-legend { color: var(--cench-recharts-tick, rgba(232,228,220,0.75)); }`
        : ''
    }
    ${sanitizeCssBlock(sceneStyles)}
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera">
  ${sceneUsesCanvasBackground(scene) ? canvasBgTag(W, H) : ''}
  <div id="chart"></div>
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
  <script src="/sdk/cench-charts.js"></script>
  ${needsPlotly ? '<script src="https://cdn.plot.ly/plotly-3.4.0.min.js" charset="utf-8"></script>' : ''}
  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var DATA = ${JSON.stringify(d3Data)};
    var WIDTH = ${W}, HEIGHT = ${H};
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var AXIS_COLOR   = '${style.axisColor}';
    var GRID_COLOR   = '${style.gridColor}';
    ${
      needsRecharts
        ? `(function () {
      var root = document.documentElement;
      var p = PALETTE || [];
      for (var i = 0; i < 5; i++) {
        if (p[i]) root.style.setProperty('--chart-' + (i + 1), p[i]);
      }
      root.style.setProperty('--cench-font', FONT || 'system-ui, sans-serif');
      root.style.setProperty('--cench-recharts-tick', AXIS_COLOR || 'rgba(232,228,220,0.65)');
      root.style.setProperty('--cench-recharts-grid', GRID_COLOR || 'rgba(255,255,255,0.08)');
      root.style.setProperty('--cench-recharts-title', 'rgba(240,236,224,0.95)');
    })();`
        : ''
    }

    // Audio volume is handled by the playback controller
  </script>

  <!-- playback-controller-slot -->

  <script>
    ${sceneCode}
  </script>
  ${
    needsRecharts
      ? `<script type="module">
  import { mountCenchRechartsLayers } from '/sdk/cench-recharts-scene.mjs';
  mountCenchRechartsLayers().catch(function (e) { console.warn('[cench-recharts]', e); });
</script>`
      : ''
  }
</body>
</html>`
}

function generateThreeHTML(
  scene: Scene,
  style?: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const { sceneCode = '' } = scene
  const effectiveBgColor = style?.bgColor ?? scene.bgColor ?? '#fffef9'
  const palette = JSON.stringify(style?.palette ?? ['#1a1a2e', '#e84545', '#16a34a', '#2563eb'])
  const duration = scene.duration ?? 8
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080

  const audioHTML = generateAudioHTML(scene.audioLayer)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.183.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.183.0/examples/jsm/",
      "three/examples/jsm/": "https://unpkg.com/three@0.183.0/examples/jsm/",
      "@pmndrs/vanilla": "https://esm.sh/@pmndrs/vanilla@1.25.0?external=three",
      "troika-three-text": "/vendor/troika-three-text.esm.js",
      "three-bvh-csg": "/vendor/three-bvh-csg.esm.js"
    }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${effectiveBgColor};
      transform-origin: top left;
    }
    canvas { display: block; }
  </style>
  <script>
    // Scale ${W}x${H} body to fit the actual viewport
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);

    // Force preserveDrawingBuffer so export can read WebGL canvas via drawImage.
    // Without this, the buffer is cleared after compositing and reads return blank.
    // Applied unconditionally — perf cost is negligible at ${W}x${H}.
    (function() {
      var origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, attrs) {
        if (type === 'webgl' || type === 'webgl2') {
          attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
        }
        return origGetContext.call(this, type, attrs);
      };
    })();

    // Globals accessible from module scope via window.*
    window.WIDTH = ${W};
    window.HEIGHT = ${H};
    window.PALETTE = ${palette};
    window.DURATION = ${duration};
    window.SCENE_ID = '${escapeJsString(scene.id)}';

    window.MATERIALS = {
      plastic: function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 0.6, metalness: 0 }); },
      metal:   function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 0.2, metalness: 0.9 }); },
      glass:   function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), transparent: true, opacity: 0.3, roughness: 0, transmission: 0.9 }); },
      matte:   function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 1, metalness: 0 }); },
      glow:    function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), emissive: new T.Color(c), emissiveIntensity: 0.8 }); },
      clearcoat: function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), clearcoat: 1.0, clearcoatRoughness: 0.1, roughness: 0.3, metalness: 0.5 }); },
      iridescent: function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), iridescence: 1.0, iridescenceIOR: 1.5, roughness: 0.2, metalness: 0.8 }); },
      velvet: function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), sheen: 1.0, sheenRoughness: 0.8, sheenColor: new T.Color(c), roughness: 0.9 }); },
      lowpoly: function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 0.7, metalness: 0, flatShading: true }); },
    };

    window.mulberry32 = function(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    };
  </script>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <!-- playback-controller-slot -->

  <!-- Template setup: import THREE, define globals + setupEnvironment on window -->
  <script type="module">
    import * as THREE from 'three';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
    import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
    import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
    import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
    import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
    import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
    import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
    import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
    window.THREE = THREE;

    // Procedural studio environment map — makes all PBR materials look professional.
    // Scene code calls: setupEnvironment(scene, renderer)
    window.setupEnvironment = function(targetScene, renderer) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envScene = new THREE.Scene();

        const skyGeo = new THREE.SphereGeometry(50, 32, 16);
        const skyMat = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: {
            topColor:    { value: new THREE.Color(0xddeeff) },
            bottomColor: { value: new THREE.Color(0xfff8f0) },
          },
          vertexShader: \`
            varying vec3 vWorldPos;
            void main() {
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vWorldPos = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          \`,
          fragmentShader: \`
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorldPos;
            void main() {
              float h = normalize(vWorldPos).y * 0.5 + 0.5;
              gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
            }
          \`,
        });
        envScene.add(new THREE.Mesh(skyGeo, skyMat));

        const panelGeo = new THREE.PlaneGeometry(8, 4);
        const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(-6, 8, 5);
        panel.lookAt(0, 0, 0);
        envScene.add(panel);

        const fillGeo = new THREE.PlaneGeometry(6, 3);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xe0e8ff, side: THREE.DoubleSide });
        const fillPanel = new THREE.Mesh(fillGeo, fillMat);
        fillPanel.position.set(7, 3, 3);
        fillPanel.lookAt(0, 0, 0);
        envScene.add(fillPanel);

        const envMap = pmrem.fromScene(envScene, 0.04).texture;
        targetScene.environment = envMap;
        pmrem.dispose();
        envScene.clear();
      } catch(e) {
        console.warn('setupEnvironment failed:', e);
      }
    };

    // Safe post-processing wrapper — SYNCHRONOUS, no .then() needed.
    // Scene code calls: const pp = createPostProcessing(renderer, scene, camera, { bloom: 0.3 })
    // Then in animation loop: pp.render() instead of renderer.render(scene, camera)
    window.createPostProcessing = function(renderer, scene, camera, opts) {
      opts = opts || {};
      try {
        var composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        if (opts.bloom !== false) {
          var strength = typeof opts.bloom === 'number' ? opts.bloom : 0.3;
          composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(window.WIDTH, window.HEIGHT), strength, 0.4, 0.85
          ));
        }
        composer.addPass(new OutputPass());
        return { render: function() { composer.render(); }, composer: composer };
      } catch(e) {
        console.warn('createPostProcessing failed, using direct render:', e);
        return { render: function() { renderer.render(scene, camera); } };
      }
    };

    // Studio scene presets — one-call setup for common 3D scene configurations.
    // Scene code calls: const studio = createStudioScene('corporate')
    // Returns { scene, camera, renderer, floor, render }
    window.createStudioScene = function(style) {
      style = style || 'corporate';
      var T = THREE;
      var W = window.WIDTH, H = window.HEIGHT;
      var P = window.PALETTE;

      var renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.LinearToneMapping;
      renderer.outputColorSpace = T.SRGBColorSpace;
      document.body.appendChild(renderer.domElement);

      var scene = new T.Scene();
      var camera = new T.PerspectiveCamera(50, W / H, 0.1, 1000);
      window.__threeCamera = camera;

      var configs = {
        corporate: { camPos: [0, 3, 12], camLookAt: [0, 0, 0], exposure: 1.0, floorY: -2.5, skyTop: '#999999', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#d0cdc8', offset: 50, exponent: 0.6 },
        playful:   { camPos: [10, 8, 10], camLookAt: [0, 0, 0], exposure: 1.0, floorY: -2,   skyTop: '#908880', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#c8c4be', offset: 50, exponent: 0.6 },
        cinematic: { camPos: [0, 2, 14],  camLookAt: [0, 0, 0], exposure: 1.0, floorY: -3,   skyTop: '#020204', skyBot: '#0e0c14', floorCol: '#0e0c14', gridCol: '#1a1828', offset: 30, exponent: 0.5 },
        showcase:  { camPos: [0, 2, 14],  camLookAt: [0, 0, 0], exposure: 1.0, floorY: -3,   skyTop: '#06050a', skyBot: '#18141e', floorCol: '#18141e', gridCol: '#221e2a', offset: 30, exponent: 0.5 },
        tech:      { camPos: [0, 4, 14],  camLookAt: [0, 0, 0], exposure: 1.0, floorY: -3,   skyTop: '#020204', skyBot: '#080810', floorCol: '#080810', gridCol: '#1a1a28', offset: 30, exponent: 0.5 },
        sky:       { camPos: [0, 3, 12],  camLookAt: [0, 0, 0], exposure: 0.5, floorY: -2.5, skyTop: null, skyBot: null, floorCol: '#c8d8c0', gridCol: '#a0b098', offset: 0, exponent: 0 },
      };
      var c = configs[style] || configs.corporate;

      renderer.toneMappingExposure = c.exposure;
      camera.position.set(c.camPos[0], c.camPos[1], c.camPos[2]);
      camera.lookAt(c.camLookAt[0], c.camLookAt[1], c.camLookAt[2]);

      // ── Lighting (3-point studio for all styles) ──
      var isLight = (style === 'corporate' || style === 'playful');
      scene.add(new T.AmbientLight(isLight ? 0xffffff : 0x111122, isLight ? 0.3 : 0.08));
      var keyL = new T.DirectionalLight(isLight ? 0xfff6e0 : 0xffffff, isLight ? 1.0 : 0.8);
      keyL.position.set(-5, 8, 5);
      keyL.castShadow = true;
      keyL.shadow.mapSize.set(2048, 2048);
      keyL.shadow.camera.left = -15; keyL.shadow.camera.right = 15;
      keyL.shadow.camera.top = 15; keyL.shadow.camera.bottom = -15;
      keyL.shadow.bias = -0.001;
      scene.add(keyL);
      var fillL = new T.DirectionalLight(isLight ? 0xd0e8ff : 0x4444aa, isLight ? 0.35 : 0.2);
      fillL.position.set(6, 2, 4);
      scene.add(fillL);
      var rimL = new T.DirectionalLight(isLight ? 0xffe0d0 : 0xff6040, isLight ? 0.5 : 0.35);
      rimL.position.set(0, 4, -9);
      scene.add(rimL);

      // ── Sky Background ──
      var fY = c.floorY;
      if (style === 'sky') {
        import('three/addons/objects/Sky.js').then(function(mod) {
          var skySun = new mod.Sky();
          skySun.scale.setScalar(450000);
          scene.add(skySun);
          var u = skySun.material.uniforms;
          u['turbidity'].value = 10;
          u['rayleigh'].value = 2;
          u['mieCoefficient'].value = 0.005;
          u['mieDirectionalG'].value = 0.8;
          u['sunPosition'].value.set(400000, 400000, 400000);
        }).catch(function() {});
      } else {
        // Sky gradient sphere — 128 vertical segments = smooth, no banding
        var skyGeo = new T.SphereGeometry(5000, 32, 128);
        var skyVS = 'varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
        var skyFS = 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }';
        var skyMat = new T.ShaderMaterial({
          uniforms: { topColor: { value: new T.Color(c.skyTop) }, bottomColor: { value: new T.Color(c.skyBot) }, offset: { value: c.offset }, exponent: { value: c.exponent } },
          vertexShader: skyVS, fragmentShader: skyFS, side: T.BackSide, depthWrite: false
        });
        scene.add(new T.Mesh(skyGeo, skyMat));
      }

      // ── Infinite Grid (inlined from Fyrestar/THREE.InfiniteGridHelper) ──
      var gridGeo = new T.PlaneGeometry(2, 2, 1, 1);
      var gridVS = 'varying vec3 worldPosition; uniform float uDistance; void main() { vec3 pos = position.xzy * uDistance; pos.xz += cameraPosition.xz; worldPosition = pos; gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0); }';
      var gridFS = 'varying vec3 worldPosition; uniform float uSize1; uniform float uSize2; uniform vec3 uColor; uniform float uDistance; float getGrid(float size) { vec2 r = worldPosition.xz / size; vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r); float line = min(grid.x, grid.y); return 1.0 - min(line, 1.0); } void main() { float d = 1.0 - min(distance(cameraPosition.xz, worldPosition.xz) / uDistance, 1.0); float g1 = getGrid(uSize1); float g2 = getGrid(uSize2); gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0)); gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2); if (gl_FragColor.a <= 0.0) discard; }';
      var gridMat = new T.ShaderMaterial({
        side: T.DoubleSide, transparent: true,
        uniforms: { uSize1: { value: 10 }, uSize2: { value: 100 }, uColor: { value: new T.Color(c.gridCol) }, uDistance: { value: 3000 } },
        vertexShader: gridVS, fragmentShader: gridFS,
        extensions: { derivatives: true }
      });
      var grid = new T.Mesh(gridGeo, gridMat);
      grid.frustumCulled = false;
      grid.position.y = fY;
      scene.add(grid);

      // ── Floor — infinite with fog blend ──
      var floorGeo = new T.PlaneGeometry(10000, 10000);
      var floorMat = new T.MeshStandardMaterial({ color: new T.Color(c.floorCol), roughness: 1.0, metalness: 0, envMapIntensity: 0.2 });
      var floor = new T.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = fY - 0.01;
      floor.receiveShadow = true;
      scene.add(floor);
      scene.fog = new T.FogExp2(new T.Color(c.skyBot), 0.003);

      // ── Environment map for PBR reflections ──
      window.setupEnvironment(scene, renderer);

      return {
        scene: scene, camera: camera, renderer: renderer, floor: floor,
        render: function() { renderer.render(scene, camera); }
      };
    };

    ${THREE_ENVIRONMENT_RUNTIME_SCRIPT}
    ${THREE_SCATTER_RUNTIME_SCRIPT}
    ${THREE_HELPERS_RUNTIME_SCRIPT}
  </script>

  <!-- Scene code: separate module so it can have its own imports at the top -->
  <script type="module">
    ${sceneCode}
  </script>
</body>
</html>`
}

function generateZdogHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const { sceneCode = '' } = scene
  const bgColor = scene.bgColor || style.bgColor || '#fffef9'
  const palette = JSON.stringify(style.palette)
  const duration = scene.duration ?? 8
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080

  const audioHTML = generateAudioHTML(scene.audioLayer)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${bgColor};
      transform-origin: top left;
    }
    canvas { display: block; }
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  <canvas id="zdog-canvas" width="${W}" height="${H}"></canvas>
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script src="https://unpkg.com/zdog@1/dist/zdog.dist.min.js"></script>
  <script>
    var WIDTH = ${W}, HEIGHT = ${H};
    var PALETTE = ${palette};
    var DURATION = ${duration};
    var FONT = '${style.font}';
    var BODY_FONT = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';

    // Seeded PRNG — use mulberry32(seed)() instead of Math.random()
    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    var SCENE_ID = '${escapeJsString(scene.id)}';

    // Audio volume is handled by the playback controller
  </script>

  <!-- playback-controller-slot -->

  <script>
${sceneCode}
  </script>
</body>
</html>`
}

function generateLottieHTML(scene: Scene, audioSettings?: AudioSettings | null, dims?: ProjectDimensions): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const { bgColor = '#fffef9', lottieSource = '', svgContent = '' } = scene

  const audioHTML = generateAudioHTML(scene.audioLayer)

  const lottieInit = lottieSource.startsWith('http')
    ? `path: "${lottieSource}"`
    : `animationData: ${lottieSource || '{}'}`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: ${bgColor}; }
    #lottie-container { width: 100%; height: 100%; }
    #svg-overlay { position: absolute; inset: 0; pointer-events: none; }
    #svg-overlay svg { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  <div id="lottie-container"></div>
  <div id="svg-overlay">${svgContent}</div>
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script>
    var SCENE_ID = '${escapeJsString(scene.id)}';
    var DURATION = ${scene.duration ?? 8};

    const anim = lottie.loadAnimation({
      container: document.getElementById('lottie-container'),
      renderer: 'svg',
      loop: false,
      autoplay: false,
      ${lottieInit}
    });

    // Force render frame 0 as soon as lottie-web builds its SVG DOM.
    // Without this, autoplay:false + paused GSAP timeline = no frame ever painted.
    anim.addEventListener('DOMLoaded', function() {
      anim.goToAndStop(0, true);
    });

    // Integrate Lottie with GSAP timeline when available
    window.addEventListener('load', () => {
      if (window.__tl) {
        const proxy = { frame: 0 };
        const totalFrames = anim.totalFrames || 1;
        window.__tl.to(proxy, {
          frame: totalFrames,
          duration: DURATION,
          ease: 'none',
          onUpdate: () => anim.goToAndStop(proxy.frame, true),
        }, 0);
        // Belt-and-suspenders: ensure frame 0 is visible while paused
        anim.goToAndStop(0, true);
      }
    });

    // Audio volume is handled by the playback controller
  </script>
</body>
</html>`
}

// ── Helper functions ──────────────────────────────────────────────────────────

function buildBgStyleCSS(style: ResolvedStyle): string {
  switch (style.bgStyle) {
    case 'grid':
      return `
        background-image:
          linear-gradient(${style.gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${style.gridColor} 1px, transparent 1px);
        background-size: 40px 40px;`
    case 'dots':
      return `
        background-image: radial-gradient(
          circle, ${style.gridColor} 1.5px, transparent 1.5px
        );
        background-size: 40px 40px;`
    default:
      return ''
  }
}

function generatePhysicsHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const { sceneCode = '', sceneStyles = '', sceneHTML = '' } = scene
  const audioHTML = generateAudioHTML(scene.audioLayer)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$','$'], ['\\\\(','\\\\)']], displayMath: [['$$','$$'], ['\\\\[','\\\\]']] },
      svg: { fontCache: 'global' },
      startup: { pageReady: function() { return MathJax.startup.defaultPageReady().then(function() { window.__mathjaxReady = true; }); } }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      font-family: ${sceneFontCssStack(style.font)};
      ${buildBgStyleCSS(style)}
    }

    /* Split layout: simulation left, text/equations right */
    .physics-layout-split {
      --sim-panel: 60%;
      --text-panel: 40%;
      display: flex; width: ${W}px; height: ${H}px;
    }
    .physics-layout-split .sim-panel {
      flex: 0 0 var(--sim-panel); height: 100%; position: relative;
      overflow: hidden;
    }
    .physics-layout-split .sim-panel canvas { display: block; width: 100%; height: 100%; }
    .physics-layout-split .text-panel {
      flex: 0 0 var(--text-panel); height: 100%; padding: 60px 50px;
      display: flex; flex-direction: column; justify-content: center;
      color: ${style.palette[0] || '#e2e8f0'};
      overflow: hidden;
      --content-scale: 1;
    }

    /* Overlay layout: centered simulation + floating explanation card */
    .physics-layout-overlay {
      width: ${W}px; height: ${H}px; position: relative;
    }
    .physics-layout-overlay .sim-stage {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .physics-layout-overlay .sim-stage canvas {
      display: block;
      width: 100%; height: 100%;
      transform: scale(var(--sim-scale, 0.82));
      transform-origin: center center;
    }
    .physics-explain-card {
      position: absolute;
      transform: translate(-50%, -50%);
      background: var(--card-bg, rgba(8, 12, 22, 0.72));
      border: 1px solid var(--card-border, rgba(255,255,255,0.18));
      border-radius: var(--card-radius, 14px);
      padding: var(--card-padding, 20px 24px);
      color: var(--card-text, #fff);
      box-shadow: var(--card-shadow, 0 14px 45px rgba(0,0,0,0.28));
      backdrop-filter: blur(var(--card-blur, 3px));
      opacity: var(--card-opacity, 1);
      overflow: hidden;
      --content-scale: 1;
      max-height: 80%;
      z-index: 3;
      text-align: var(--card-text-align, left);
    }
    .physics-explain-card.physics-explain-split {
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;
      backdrop-filter: none;
    }
    .physics-explain-card.physics-explain-split .physics-sub-card-frame {
      position: absolute;
      inset: 0;
      border-radius: var(--card-radius, 14px);
      background: var(--card-bg, rgba(8, 12, 22, 0.72));
      border: 1px solid var(--card-border, rgba(255,255,255,0.18));
      box-shadow: var(--card-shadow, 0 14px 45px rgba(0,0,0,0.28));
      backdrop-filter: blur(var(--card-blur, 3px));
      opacity: var(--card-opacity, 1);
      pointer-events: none;
    }
    .physics-explain-card.physics-explain-split .physics-sub-text {
      position: relative;
      padding: var(--card-padding, 20px 24px);
      color: var(--card-text, #fff);
      overflow: hidden;
      max-height: 100%;
      text-align: var(--card-text-align, left);
    }
    .physics-layout-overlay.equation-focus .physics-explain-card:not(.physics-explain-split) {
      background: rgba(6, 10, 20, 0.78);
    }
    .physics-layout-overlay.equation-focus .physics-explain-split .physics-sub-card-frame {
      background: rgba(6, 10, 20, 0.78);
    }
    .physics-explain-card.center-card {
      text-align: center;
    }

    /* Fullscreen layout: sim fills canvas */
    .physics-layout-fullscreen {
      width: ${W}px; height: ${H}px; position: relative;
    }
    .physics-layout-fullscreen canvas { display: block; width: 100%; height: 100%; }
    .physics-layout-fullscreen .caption-overlay {
      position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
      max-width: 80%; padding: 20px 40px;
      background: rgba(0,0,0,0.7); border-radius: 12px;
      color: #fff; font-size: calc(28px * var(--content-scale, 1)); text-align: center;
      line-height: 1.35; max-height: 35%;
      overflow: hidden;
      --content-scale: 1;
    }
    .physics-layout-fullscreen .caption-overlay.physics-caption-split {
      padding: 0;
      background: transparent;
    }
    .physics-layout-fullscreen .caption-overlay.physics-caption-split .physics-caption-frame {
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: rgba(0,0,0,0.7);
      pointer-events: none;
    }
    .physics-layout-fullscreen .caption-overlay.physics-caption-split .physics-caption-text {
      position: relative;
      padding: 20px 40px;
      font-size: calc(28px * var(--content-scale, 1));
      text-align: center;
      line-height: 1.35;
      max-height: 35%;
      overflow: hidden;
    }

    /* Equation focus layout: big equation center, sim as background */
    .physics-layout-equation {
      width: ${W}px; height: ${H}px; position: relative;
    }
    .physics-layout-equation canvas {
      position: absolute; inset: 0; opacity: 0.25; filter: blur(2px);
      width: 100%; height: 100%;
    }
    .physics-layout-equation .equation-center {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 2; color: #fff;
      padding: 70px 110px;
      text-align: center;
      overflow: hidden;
      --content-scale: 1;
    }
    .physics-layout-equation .equation-center .mjx-container {
      font-size: calc(48px * var(--content-scale, 1)) !important;
      max-width: 100%;
    }

    /* Equation styling */
    .equation-block { margin: calc(24px * var(--content-scale, 1)) 0; max-width: 100%; }
    .equation-block .mjx-container {
      font-size: calc(var(--card-equation-size, 32px) * var(--content-scale, 1)) !important;
      max-width: 100%;
      transform-origin: left center;
      display: inline-block;
    }
    .narration-text {
      font-size: calc(var(--card-body-size, 26px) * var(--content-scale, 1));
      line-height: 1.5;
      margin: calc(20px * var(--content-scale, 1)) 0;
      opacity: 0.9;
      max-width: 100%;
      overflow-wrap: anywhere;
      hyphens: auto;
    }
    .narration-text.is-clamped {
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .scene-title {
      font-size: calc(var(--card-title-size, 42px) * var(--content-scale, 1));
      font-weight: 700;
      margin-bottom: calc(20px * var(--content-scale, 1));
      line-height: 1.15;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    /* Annotation overlays */
    .physics-annotation {
      position: absolute; pointer-events: none; z-index: 10;
      font-family: ${sceneFontCssStack(style.font)};
    }
    .physics-annotation.label {
      background: rgba(0,0,0,0.8); color: #fff;
      padding: 6px 14px; border-radius: 6px; font-size: 18px;
    }
    .physics-annotation.callout {
      background: rgba(59,130,246,0.9); color: #fff;
      padding: 12px 20px; border-radius: 8px; font-size: 20px;
      max-width: 300px;
    }
    .physics-annotation.equation_popup {
      background: rgba(0,0,0,0.85); color: #fff;
      padding: 16px 24px; border-radius: 10px;
    }

    ${sanitizeCssBlock(sceneStyles)}
  </style>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  ${sceneUsesCanvasBackground(scene) ? canvasBgTag(W, H) : ''}
  ${sceneHTML}
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }

    function overflows(el) {
      return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    }

    function fitMathBlocks(scope) {
      if (!scope) return;
      var mathEls = scope.querySelectorAll('.mjx-container');
      mathEls.forEach(function (mathEl) {
        var parent = mathEl.parentElement;
        if (!parent) return;
        mathEl.style.transform = 'scale(1)';
        var maxW = Math.max(1, parent.clientWidth - 6);
        var naturalW = Math.max(1, mathEl.scrollWidth);
        var ratio = maxW / naturalW;
        var eqScale = Math.max(0.72, Math.min(1, ratio));
        if (eqScale < 0.999) {
          mathEl.style.transform = 'scale(' + eqScale.toFixed(3) + ')';
        }
      });
    }

    function fitContainerContent(container, minScale) {
      if (!container) return;
      var scale = 1;
      minScale = typeof minScale === 'number' ? minScale : 0.78;
      container.style.setProperty('--content-scale', '1');
      fitMathBlocks(container);
      for (var i = 0; i < 10; i++) {
        if (!overflows(container)) break;
        scale = Math.max(minScale, scale - 0.03);
        container.style.setProperty('--content-scale', scale.toFixed(2));
        fitMathBlocks(container);
        if (scale <= minScale) break;
      }
      if (overflows(container)) {
        container.querySelectorAll('.narration-text').forEach(function (el) { el.classList.add('is-clamped'); });
        fitMathBlocks(container);
      } else {
        container.querySelectorAll('.narration-text').forEach(function (el) { el.classList.remove('is-clamped'); });
      }
    }

    function fitSplitLayouts() {
      var layouts = document.querySelectorAll('.physics-layout-split');
      layouts.forEach(function (layout) {
        var textPanel = layout.querySelector('.text-panel');
        if (!textPanel) return;
        var splits = [40, 45, 50];
        var fitted = false;
        for (var i = 0; i < splits.length; i++) {
          var textPct = splits[i];
          layout.style.setProperty('--text-panel', textPct + '%');
          layout.style.setProperty('--sim-panel', (100 - textPct) + '%');
          fitContainerContent(textPanel, 0.8);
          if (!overflows(textPanel)) {
            fitted = true;
            break;
          }
        }
        if (!fitted) {
          fitContainerContent(textPanel, 0.75);
        }
      });
    }

    function fitReadableContent() {
      fitSplitLayouts();
      var targets = document.querySelectorAll('.physics-layout-equation .equation-center, .physics-layout-fullscreen .caption-overlay, .physics-layout-overlay .physics-explain-card');
      targets.forEach(function (el) { fitContainerContent(el, 0.78); });
    }

    function fitPhysicsLayout() {
      fitToViewport();
      fitReadableContent();
      // Run an extra pass after fonts/equations settle.
      setTimeout(fitReadableContent, 60);
      setTimeout(fitReadableContent, 260);
      setTimeout(fitReadableContent, 800);
      var attempts = 0;
      var timer = setInterval(function () {
        attempts += 1;
        if (window.__mathjaxReady || attempts > 10) {
          fitReadableContent();
        }
        if (window.__mathjaxReady || attempts > 10) clearInterval(timer);
      }, 250);
    }

    window.addEventListener('resize', fitToViewport);
    window.addEventListener('resize', fitReadableContent);
    document.addEventListener('DOMContentLoaded', fitPhysicsLayout);
  </script>

  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};

    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }
  </script>

  <script src="/sdk/physics-equations.js"></script>
  <script src="/sdk/physics-sims.js"></script>

  <!-- playback-controller-slot -->

  <script>
${sceneCode}
  </script>
</body>
</html>`
}

function generateCameraMotionScript(moves: CameraMove[]): string {
  const calls = moves
    .map((move) => {
      const paramsStr = move.params && Object.keys(move.params).length > 0 ? JSON.stringify(move.params) : '{}'
      return `  CenchCamera.${move.type}(${paramsStr});`
    })
    .join('\n')

  return `<script>
// Camera motion (added by set_camera_motion)
window.addEventListener('load', function() {
  if (typeof CenchCamera === 'undefined') return;
${calls}
});
</script>`
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function resolveStyleFromGlobal(globalStyle?: GlobalStyle): ResolvedStyle {
  if (!globalStyle) return resolveStyle(null)
  return resolveStyle(globalStyle.presetId, globalStyle)
}

/** `WorldEnvironment` uses underscores; files on disk use hyphens (e.g. studio_room → studio-room.html). */
function worldTemplateFilename(environment: string): string {
  const map: Record<string, string> = {
    meadow: 'meadow.html',
    studio_room: 'studio-room.html',
    void_space: 'void-space.html',
  }
  return map[environment] ?? `${environment.replace(/_/g, '-')}.html`
}

function generateWorldHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const wc = scene.worldConfig
  if (!wc) return '<!-- No worldConfig -->'

  const environment = wc.environment || 'meadow'
  const worldHtmlFile = worldTemplateFilename(environment)
  // Merge the TalkingHead TTS endpoint into worldConfig so the avatar overlay
  // helper (public/worlds/world-avatar-overlay.js) can bake it into
  // TalkingHead at boot. Null when no server TTS provider is configured —
  // the helper falls back to fakeLipsync in that case.
  const configWithAudio = {
    ...wc,
    ttsEndpoint: talkingHeadTtsEndpointForEmbed(audioSettings),
  }
  const configJSON = JSON.stringify(configWithAudio)
  const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Server-side: read the world template from disk and inject __worldConfig
  // before the <script type="module"> so config is available at parse time.
  if (typeof window === 'undefined') {
    try {
      const fs = require('fs')
      const pathMod = require('path')
      const templatePath = pathMod.join(process.cwd(), 'public', 'worlds', worldHtmlFile)
      let templateHTML: string = fs.readFileSync(templatePath, 'utf-8')

      const configScript = `<script>
    window.__worldConfig = ${configJSON};
    window.DURATION = ${scene.duration ?? 10};
    window.SCENE_ID = '${escapeJsString(scene.id)}';
  </script>`

      const moduleIdx = templateHTML.indexOf('<script type="module">')
      if (moduleIdx !== -1) {
        templateHTML = templateHTML.slice(0, moduleIdx) + configScript + '\n  ' + templateHTML.slice(moduleIdx)
      } else {
        templateHTML = templateHTML.replace('</body>', `${configScript}\n</body>`)
      }

      templateHTML = templateHTML.replace('<head>', `<head>\n  <base href="${appBaseUrl}/">`)
      return templateHTML
    } catch {
      /* fall through */
    }
  }

  // Client-side fallback: a loader page that fetches the template, injects
  // config into a blob URL, and renders it in a full-size iframe.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000;
      transform-origin: top left;
    }
    iframe { border: none; width: ${W}px; height: ${H}px; display: block; }
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <script>
    (async function() {
      var config = ${configJSON};
      var baseUrl = '${appBaseUrl}';
      var res = await fetch(baseUrl + '/worlds/${worldHtmlFile}');
      var html = await res.text();

      // Inject config before module script so it is available at parse time
      var tag = '<scr' + 'ipt>window.__worldConfig=' + JSON.stringify(config) +
        ';window.DURATION=${scene.duration ?? 10};window.SCENE_ID="${escapeJsString(scene.id)}";</scr' + 'ipt>';
      var idx = html.indexOf('<script type="module">');
      if (idx !== -1) html = html.slice(0, idx) + tag + '\\n' + html.slice(idx);
      html = html.replace('<head>', '<head>\\n<base href="' + baseUrl + '/">');

      // Render via blob URL in iframe — preserves importmap support
      var blob = new Blob([html], { type: 'text/html' });
      var frame = document.createElement('iframe');
      frame.src = URL.createObjectURL(blob);
      frame.style.cssText = 'border:none;width:${W}px;height:${H}px;';
      document.body.appendChild(frame);

      // Bridge WVC globals from iframe to parent
      frame.addEventListener('load', function() {
        var w = frame.contentWindow;
        window.__updateScene = function(t) { if (w.__updateScene) w.__updateScene(t); };
        if (w.__sceneReady) window.__sceneReady = w.__sceneReady;
        if (w.__tl) window.__tl = w.__tl;
      });
    })();
  </script>
</body>
</html>`
}

// ── Avatar Scene (full-scene presenter mode) ───────────────────────────────

function generateAvatarSceneHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const audioHTML = generateAudioHTML(scene.audioLayer)
  const panelFontStack = sceneFontCssStack(style.font)

  // Find the avatar layer to get config
  const avatarLayer = scene.aiLayers?.find((l) => l.type === 'avatar') as AvatarLayer | undefined
  const asc = avatarLayer?.avatarSceneConfig
  const ns = asc?.narrationScript ?? avatarLayer?.narrationScript
  const contentPanels = asc?.contentPanels ?? []
  const backdrop = asc?.backdrop ?? style.bgColor
  const avatarPosition = asc?.avatarPosition ?? 'left'
  const avatarSize = asc?.avatarSize ?? 40 // percentage of viewport

  let avatarSceneThUrl: URL | null = null
  try {
    if (avatarLayer?.talkingHeadUrl?.startsWith('talkinghead://')) {
      avatarSceneThUrl = new URL(avatarLayer.talkingHeadUrl)
    }
  } catch {
    avatarSceneThUrl = null
  }
  const avatarSceneGlb = getTalkingHeadGlbPath(resolveTalkingHeadModelId(ns, avatarSceneThUrl))
  const fakeLipsyncScene = ns?.fakeLipsync === true

  // Avatar container CSS based on position
  const avatarCSS =
    avatarPosition === 'center'
      ? `position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:${avatarSize}%;height:100%;`
      : avatarPosition === 'right'
        ? `position:absolute;right:0;bottom:0;width:${avatarSize}%;height:100%;`
        : `position:absolute;left:0;bottom:0;width:${avatarSize}%;height:100%;`

  // Content panel on opposite side
  const contentSide = avatarPosition === 'right' ? 'left' : 'right'
  const contentCSS = `position:absolute;${contentSide}:60px;top:50%;transform:translateY(-50%);width:${100 - avatarSize - 10}%;max-width:800px;z-index:10;`

  // Generate content panel HTML
  const panelsHTML = contentPanels
    .map((panel, i) => {
      const panelStyle = panel.style
        ? Object.entries(panel.style)
            .map(([k, v]) => `${k}:${escapeAttr(v)}`)
            .join(';')
        : ''
      const safeId = String(panel.id || i).replace(/[^a-zA-Z0-9\-_]/g, '')
      return `<div id="panel-${safeId}" class="content-panel" style="opacity:0;${panelStyle}">${panel.html}</div>`
    })
    .join('\n    ')

  // Generate GSAP timeline code for content panels
  const panelAnimCode = contentPanels
    .map((panel, i) => {
      // Sanitize ID to alphanumeric + hyphens only
      const rawId = String(panel.id || i).replace(/[^a-zA-Z0-9\-_]/g, '')
      const id = `panel-${rawId}`
      const enterTime = panel.revealAt === 'start' ? 0 : parseFloat(panel.revealAt) || i * 3 + 2
      const exitTime = panel.exitAt ? parseFloat(panel.exitAt) : undefined
      let code = `window.__tl.to(document.getElementById('${id}'), { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, ${enterTime});`
      if (exitTime != null) {
        code += `\n      window.__tl.to(document.getElementById('${id}'), { opacity: 0, y: -20, duration: 0.4 }, ${exitTime});`
      }
      return code
    })
    .join('\n      ')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${backdrop}; }
    .content-panel {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(8px);
      border-radius: 16px;
      padding: 40px;
      border: 1px solid rgba(255,255,255,0.1);
      transform: translateY(20px);
      font-family: ${panelFontStack}, system-ui, sans-serif;
      color: ${style.palette[0] === '#ffffff' || style.palette[0] === '#fff' ? '#1a1a2e' : '#f0f0f0'};
    }
    .content-panel h2 { font-size: 32px; margin-bottom: 16px; }
    .content-panel p { font-size: 20px; line-height: 1.6; opacity: 0.85; }
    .content-panel ul { font-size: 20px; line-height: 2; padding-left: 24px; }
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
      document.body.style.transformOrigin = 'top left';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">

  <!-- Scene backdrop -->
  <div id="scene-backdrop" style="position:absolute;inset:0;z-index:0;background:${backdrop};"></div>

  <!-- Content panels -->
  <div id="scene-content" style="${contentCSS}">
    ${panelsHTML}
  </div>

  <!-- Avatar container -->
  <div id="avatar-container" style="${avatarCSS}z-index:5;"></div>

  ${audioHTML}

  <script>
    var SCENE_ID = '${escapeJsString(scene.id)}';
    var PALETTE = ${JSON.stringify(style.palette)};
    var DURATION = ${scene.duration};
    var WIDTH = ${W};
    var HEIGHT = ${H};
    var FONT = '${resolveSceneFontFamily(style.font).replace(/'/g, "\\'")}';
    var BODY_FONT = '${resolveSceneFontFamily(style.bodyFont || style.font).replace(/'/g, "\\'")}';
  </script>

  <!-- playback-controller-slot -->

  <!-- TalkingHead init for full-scene avatar -->
  <script type="module">
    (async function() {
      const container = document.getElementById('avatar-container');
      if (!container) return;

      // Wait for visibility
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        await new Promise((resolve) => {
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver((entries) => {
              for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                  ro.disconnect(); resolve(); return;
                }
              }
            });
            ro.observe(container);
          } else {
            const iv = setInterval(() => {
              if (container.offsetWidth > 0 && container.offsetHeight > 0) { clearInterval(iv); resolve(); }
            }, 200);
          }
        });
      }

      try {
        const mod = await import('https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/modules/talkinghead.mjs');
        const TalkingHead = mod.TalkingHead;
        if (!TalkingHead) return;

        if (window.__nativeRAF) window.requestAnimationFrame = window.__nativeRAF;
        if (window.__nativeCAF) window.cancelAnimationFrame = window.__nativeCAF;
        window.__rafUnlocked = true;

        const mood = '${ns?.mood ?? 'happy'}';
        const view = '${ns?.view ?? 'mid'}';
        const eyeContact = ${ns?.eyeContact ?? 0.7};
        const headMovement = ${ns?.lipsyncHeadMovement !== false};

        const head = new TalkingHead(container, {
          ttsEndpoint: ${talkingHeadTtsEndpointJsLiteral(audioSettings)},
          ttsLang: 'en-US',
          cameraView: view,
          cameraRotateEnable: false,
          avatarSpeakingEyeContact: eyeContact,
          avatarIdleEyeContact: Math.max(0, eyeContact - 0.2),
        });

        const vrmUrl = ${JSON.stringify(avatarSceneGlb)};
        await head.showAvatar({
          url: vrmUrl, body: 'F', lipsyncLang: 'en',
          lipsyncHeadMovement: headMovement,
        });

        head.setMood('neutral');
        window.__avatarHead = head;
        window.__avatarMood = mood;
        window.__avatarSpeechStarted = false;

        // Content panel animations (added after TalkingHead init — refresh GSAP duration)
        if (window.__tl) {
          ${panelAnimCode}
          try {
            if (typeof window.__tl.invalidate === 'function') window.__tl.invalidate();
          } catch (e) {}
        }

        function __cenchTraverseFaceMesh(root) {
          if (!root || !root.traverse) return null;
          var found = null;
          var preferred = [
            'jawOpen', 'mouthOpen', 'jaw_lower', 'Jaw_Open', 'aac', 'viseme_aa', 'viseme_A',
            'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'mouthSmile', 'mouthFunnel',
          ];
          root.traverse(function (child) {
            if (found || !child.isMesh || !child.morphTargetDictionary) return;
            var d = child.morphTargetDictionary;
            var i, k;
            for (i = 0; i < preferred.length; i++) {
              k = preferred[i];
              if (k in d) { found = child; return; }
            }
            var names = Object.keys(d);
            for (i = 0; i < names.length; i++) {
              var n = names[i];
              var lower = n.toLowerCase();
              if (lower.indexOf('jaw') !== -1 || lower.indexOf('mouth') !== -1 || n.indexOf('viseme_') === 0) {
                found = child;
                return;
              }
            }
          });
          return found;
        }

        function __cenchFindFaceMeshForLipSync(h, domContainer) {
          var roots = [h.nodeAvatar, h.scene, h.avatar, domContainer].filter(Boolean);
          var ri;
          for (ri = 0; ri < roots.length; ri++) {
            var m = __cenchTraverseFaceMesh(roots[ri]);
            if (m) return m;
          }
          return null;
        }

        function __cenchApplyMouthJaw(md, mt, jaw) {
          var pairs = [
            ['jawOpen', jaw],
            ['mouthOpen', jaw],
            ['jaw_lower', jaw * 0.92],
            ['Jaw_Open', jaw],
            ['aac', jaw * 0.7],
            ['viseme_aa', jaw * 0.55],
            ['viseme_A', jaw * 0.5],
            ['viseme_E', jaw * 0.45],
            ['viseme_I', jaw * 0.35],
            ['viseme_O', jaw * 0.38],
            ['viseme_U', jaw * 0.32],
          ];
          for (var pi = 0; pi < pairs.length; pi++) {
            var nm = pairs[pi][0];
            var v = pairs[pi][1];
            if (nm in md) mt[md[nm]] = v;
          }
        }

        async function __cenchSpeakServerTtsToHead(endpoint, txt) {
          if (!endpoint || !txt) return false;
          try {
            var r = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: { text: txt },
                voice: { languageCode: 'en-US', name: '' },
                audioConfig: { audioEncoding: 'MP3' },
              }),
            });
            if (!r.ok) return false;
            var data = await r.json();
            if (!data.audioContent) return false;
            var binary = atob(data.audioContent);
            var len = binary.length;
            var bytes = new Uint8Array(len);
            var i;
            for (i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            var AC = window.AudioContext || window.webkitAudioContext;
            var audioCtx = new AC();
            try {
              if (audioCtx.state === 'suspended') await audioCtx.resume();
            } catch (e0) {}
            var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            var audioBuf = await audioCtx.decodeAudioData(ab);
            var words = txt.split(/\\s+/).filter(Boolean);
            if (!words.length) words = ['...'];
            var totalMs = audioBuf.duration * 1000;
            var perWord = totalMs / (words.length || 1);
            head.speakAudio({
              audio: audioBuf,
              words: words,
              wtimes: words.map(function (_, wi) { return Math.round(wi * perWord); }),
              wdurations: words.map(function () { return Math.round(perWord * 0.9); }),
            });
            return true;
          } catch (e) {
            console.warn('[AvatarScene] server TTS speakAudio failed:', e);
            return false;
          }
        }

        var faceMesh = __cenchFindFaceMeshForLipSync(head, container);
        const FAKE_LIPSYNC_SCENE = ${fakeLipsyncScene ? 'true' : 'false'};

        function fakeTalkJawOnly(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              if (Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
        }

        function speakWithBrowserTTS(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              var synth = window.speechSynthesis;
              var speaking = synth && synth.speaking;
              if (!speaking && Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
          if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (e1) {}
            try { window.speechSynthesis.resume(); } catch (e2) {}
            var u = new SpeechSynthesisUtterance(txt);
            u.lang = 'en-US';
            u.rate = 1;
            u.onend = function () { stopJaw(); };
            u.onerror = function () {};
            window.speechSynthesis.speak(u);
          }
        }

        // Speech
        ${
          ns?.lines && ns.lines.length > 0
            ? (() => {
                const allText = ns.lines.map((l) => l.text).join(' ')
                return `
        window.__avatarStartSpeech = async function() {
          try {
            var all = ${JSON.stringify(allText)};
            if (FAKE_LIPSYNC_SCENE) {
              fakeTalkJawOnly(all);
              return;
            }
            var ep = head.opt && head.opt.ttsEndpoint;
            if (all && ep && (await __cenchSpeakServerTtsToHead(ep, all))) return;
            speakWithBrowserTTS(all);
          } catch (e) {
            console.warn('[AvatarScene] speech error:', e);
            speakWithBrowserTTS(${JSON.stringify(allText)});
          }
        };`
              })()
            : `
        const ttsAudio = document.getElementById('scene-tts') || document.getElementById('scene-audio');
        if (ttsAudio && ttsAudio.src) {
          window.__avatarStartSpeech = async function() {
            try {
              const resp = await fetch(ttsAudio.src);
              const arrayBuf = await resp.arrayBuffer();
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              try {
                if (audioCtx.state === 'suspended') await audioCtx.resume();
              } catch (e4) {}
              const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
              const text = (ttsAudio.dataset.text || '').split(/\\s+/).filter(Boolean);
              const words = text.length > 0 ? text : ['...'];
              const totalMs = audioBuf.duration * 1000;
              const perWord = totalMs / (words.length || 1);
              head.speakAudio({
                audio: audioBuf,
                words: words,
                wtimes: words.map((_, i) => Math.round(i * perWord)),
                wdurations: words.map(() => Math.round(perWord * 0.9)),
              });
            } catch(e) { console.warn('[AvatarScene] Audio lip sync error:', e); }
          };
        }`
        }

        console.log('[AvatarScene] Ready — mood=' + mood + ', view=' + view + ', panels=${contentPanels.length}');

      } catch(e) {
        console.error('[AvatarScene] Fatal:', e);
      }
    })();
  </script>

  ${generateAILayersHTML(
    scene.aiLayers?.filter((l) => l.type !== 'avatar'),
    audioSettings,
  )}

  </div><!-- /scene-camera -->
</body>
</html>`
}

/**
 * Normalize a React scene's JSX so the bootstrapper can always find the component.
 *
 * The bootstrapper wraps the transpiled code in a CommonJS closure and reads
 * `module.exports.default` / `module.exports.Scene` after execution. That only
 * gets populated when the source has an ES export statement. Authors (and
 * agents) routinely write `function Scene() { ... }` and forget the export,
 * which silently produces a blank iframe.
 *
 * This helper appends `export default Scene;` (or the right export for whatever
 * top-level component they defined) when no export is present. If no recognizable
 * component is found, the source is returned unchanged — the bootstrapper's
 * existing error message will fire.
 */
export function normalizeReactSceneExport(src: string): string {
  if (!src || typeof src !== 'string') return src
  // Fast path: any existing export statement means the author was explicit.
  if (
    /\bexport\s+default\b/.test(src) ||
    /\bmodule\.exports\s*=/.test(src) ||
    /\bexports\.[A-Za-z_$][\w$]*\s*=/.test(src) ||
    /\bexport\s*\{[^}]+\}/.test(src)
  ) {
    return src
  }
  // Look for a recognizable top-level component declaration. Prefer "Scene";
  // fall back to other conventional names.
  const CANDIDATES = ['Scene', 'Main', 'App', 'Root', 'Composition', 'VideoScene']
  for (const name of CANDIDATES) {
    const re = new RegExp(
      `(^|\\n)\\s*(?:async\\s+)?function\\s+${name}\\b|` + `(^|\\n)\\s*(?:const|let|var)\\s+${name}\\s*=`,
    )
    if (re.test(src)) {
      return `${src.replace(/\s+$/, '')}\n\nexport default ${name};\n`
    }
  }
  return src
}

function generateReactHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  // React scenes store JSX in reactCode; fall back to sceneCode for compat
  const reactCode = scene.reactCode || scene.sceneCode || ''
  const sceneStyles = scene.sceneStyles || ''
  const audioHTML = generateAudioHTML(scene.audioLayer)
  const palette = style.palette ?? ['#1a1a2e', '#16213e', '#0f3460', '#e94560']
  const duration = scene.duration ?? 8
  const textOverlaysHTML = renderTextOverlaysHTML(scene.textOverlays ?? [])

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute; inset: 0;
      width: ${W}px; height: ${H}px;
      transform-origin: center center;
      will-change: transform, filter;
    }
    #react-root {
      position: absolute; inset: 0;
      width: ${W}px; height: ${H}px;
      overflow: hidden;
    }
    ${TEXT_OVERLAY_CSS}
    ${sanitizeCssBlock(sceneStyles)}
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
      document.body.style.transformOrigin = 'top left';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  <\/script>
  <!-- React 18 UMD -->
  <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"><\/script>
  <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"><\/script>
  <!-- Babel standalone: in-browser JSX transpilation (bundled locally to avoid CDN failures) -->
  <script src="/sdk/babel.min.js"><\/script>
  <!-- lottie-web: required by LottieLayer bridge and CenchMotion.lottieSync -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"><\/script>
</head>
<body>
  <div id="scene-camera">
    <div id="react-root"></div>
    ${textOverlaysHTML}
    ${audioHTML}
    ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div>

  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(palette)};
    var DURATION     = ${duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};
    // Scene variables (reactive via useVariable hook)
    window.__CENCH_VARIABLES = ${JSON.stringify(
      Object.fromEntries(
        (scene.variables ?? []).map((v) => [
          v.name,
          v.defaultValue ?? (v.type === 'number' ? 0 : v.type === 'boolean' ? false : ''),
        ]),
      ),
    )};
  <\/script>

  <!-- playback-controller-slot -->

  <!-- Three.js r183 UMD (exposes window.THREE) + D3 v7 (available for bridge components) -->
  <script src="https://unpkg.com/three@0.160.0/build/three.min.js"><\/script>
  <script src="/vendor/three-sky.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"><\/script>
  <script>
  // buildStudio(THREE, scene, camera, renderer, style) — sets up studio environment inside ThreeJSLayer
  // Adds: sky gradient sphere (128 segments), infinite grid, white floor, 3-point lighting, env map
  // floorMode: 'infinite' (default, extends to horizon with fog), 'circle' (radial fade), 'none'
  // floorColor: override floor color (hex string), null = use style default
  window.buildStudio = function(T, scene, camera, renderer, style, opts) {
    style = style || 'white';
    opts = opts || {};
    var floorMode = opts.floorMode || 'infinite';
    var floorColorOverride = opts.floorColor || null;
    var configs = {
      white:     { floorY: -2.5, skyTop: '#999999', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#d0cdc8', offset: 50, exponent: 0.6, ambientI: 0.3, keyI: 1.0, useSky: false, noFog: true, useShaderFloor: true },
      corporate: { floorY: -2.5, skyTop: '#b0b0b0', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#d0cdc8', offset: 50, exponent: 0.6, ambientI: 0.4, keyI: 1.0, useSky: false },
      playful:   { floorY: -2,   skyTop: '#908880', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#c8c4be', offset: 50, exponent: 0.6, ambientI: 0.3, keyI: 1.0, useSky: false },
      cinematic: { floorY: -3,   skyTop: '#020204', skyBot: '#0e0c14', floorCol: '#0e0c14', gridCol: '#1a1828', offset: 30, exponent: 0.5, ambientI: 0.08, keyI: 0.8, useSky: false },
      showcase:  { floorY: -3,   skyTop: '#06050a', skyBot: '#18141e', floorCol: '#18141e', gridCol: '#221e2a', offset: 30, exponent: 0.5, ambientI: 0.08, keyI: 0.8, useSky: false },
      tech:      { floorY: -3,   skyTop: '#020204', skyBot: '#080810', floorCol: '#080810', gridCol: '#1a1a28', offset: 30, exponent: 0.5, ambientI: 0.08, keyI: 0.8, useSky: false },
      sky:       { floorY: -2.5, skyTop: null, skyBot: '#c0d8f0', floorCol: null, gridCol: '#a0b098', offset: 33, exponent: 0.6, ambientI: 0.4, keyI: 1.2, useSky: true },
    };
    var c = configs[style] || configs.corporate;
    var isLight = (style === 'white' || style === 'corporate' || style === 'playful');
    // Override renderer settings — the bridge creates with alpha:true which makes bg transparent
    renderer.setClearColor(isLight ? 0xffffff : 0x060510, 1);
    renderer.toneMapping = 1; // LinearToneMapping = 1
    renderer.toneMappingExposure = c.useSky ? 0.5 : 1.0;
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = 'srgb';
    // Sky background
    if (c.useSky && T.Sky) {
      // Real THREE.Sky atmospheric scattering — outdoor look
      var skySun = new T.Sky();
      skySun.scale.setScalar(450000);
      scene.add(skySun);
      var u = skySun.material.uniforms;
      u['turbidity'].value = 10;
      u['rayleigh'].value = 2;
      u['mieCoefficient'].value = 0.005;
      u['mieDirectionalG'].value = 0.8;
      u['sunPosition'].value.set(400000, 400000, 400000);
      renderer.toneMappingExposure = 0.5;
    } else if (c.useSky) {
      // Fallback if Sky not loaded: blue gradient
      var skyGeo = new T.SphereGeometry(5000, 32, 128);
      var skyVS = 'varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
      var skyFS = 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }';
      scene.add(new T.Mesh(skyGeo, new T.ShaderMaterial({ uniforms: { topColor: {value: new T.Color('#3060a0')}, bottomColor: {value: new T.Color('#b8d4f0')}, offset: {value: 33}, exponent: {value: 0.6} }, vertexShader: skyVS, fragmentShader: skyFS, side: T.BackSide, depthWrite: false })));
    } else {
      // Gradient sky sphere (128 vertical segments = smooth, no banding)
      var skyGeo = new T.SphereGeometry(5000, 32, 128);
      var skyVS = 'varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
      var skyFS = 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }';
      scene.add(new T.Mesh(skyGeo, new T.ShaderMaterial({ uniforms: { topColor: {value: new T.Color(c.skyTop)}, bottomColor: {value: new T.Color(c.skyBot)}, offset: {value: c.offset}, exponent: {value: c.exponent} }, vertexShader: skyVS, fragmentShader: skyFS, side: T.BackSide, depthWrite: false })));
    }
    // Infinite grid
    var gridGeo = new T.PlaneGeometry(2, 2, 1, 1);
    var gridVS = 'varying vec3 worldPosition; uniform float uDistance; void main() { vec3 pos = position.xzy * uDistance; pos.xz += cameraPosition.xz; worldPosition = pos; gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0); }';
    var gridFS = 'varying vec3 worldPosition; uniform float uSize1; uniform float uSize2; uniform vec3 uColor; uniform float uDistance; float getGrid(float size) { vec2 r = worldPosition.xz / size; vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r); float line = min(grid.x, grid.y); return 1.0 - min(line, 1.0); } void main() { float d = 1.0 - min(distance(cameraPosition.xz, worldPosition.xz) / uDistance, 1.0); float g1 = getGrid(uSize1); float g2 = getGrid(uSize2); gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0)); gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2); if (gl_FragColor.a <= 0.0) discard; }';
    var grid = new T.Mesh(gridGeo, new T.ShaderMaterial({ side: T.DoubleSide, transparent: true, uniforms: { uSize1: {value:10}, uSize2: {value:100}, uColor: {value: new T.Color(c.gridCol)}, uDistance: {value:3000} }, vertexShader: gridVS, fragmentShader: gridFS, extensions: { derivatives: true } }));
    grid.frustumCulled = false; grid.position.y = c.floorY; scene.add(grid);
    // Floor — mode: 'infinite' (fog blend), 'circle' (radial fade), 'none'
    // If floorCol is null (sky style), skip colored floor — just add shadow catcher
    if (!c.floorCol && !floorColorOverride) { floorMode = 'none'; }
    // White studio default: use ShaderMaterial circle floor (renders at exact color, unaffected by lighting)
    if (c.useShaderFloor && floorMode === 'infinite') { floorMode = 'circle'; }
    var actualFloorCol = floorColorOverride ? new T.Color(floorColorOverride) : (c.floorCol ? new T.Color(c.floorCol) : new T.Color('#ffffff'));
    if (floorMode === 'circle') {
      var circRadius = opts.floorRadius || 80;
      var circGeo = new T.CircleGeometry(circRadius, 128);
      var circFS = 'uniform vec3 uColor; uniform float uRadius; varying vec3 vWorldPos; void main() { float dist = length(vWorldPos.xz); float fade = 1.0 - smoothstep(uRadius * 0.3, uRadius * 0.95, dist); gl_FragColor = vec4(uColor, fade); }';
      var circVS = 'varying vec3 vWorldPos; void main() { vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
      var circMat = new T.ShaderMaterial({ uniforms: { uColor: {value: actualFloorCol}, uRadius: {value: circRadius} }, vertexShader: circVS, fragmentShader: circFS, transparent: true, side: T.DoubleSide, depthWrite: false });
      var circFloor = new T.Mesh(circGeo, circMat);
      circFloor.rotation.x = -Math.PI / 2; circFloor.position.y = c.floorY - 0.01; scene.add(circFloor);
      // Shadow catcher
      var shadowFloor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.15 }));
      shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = c.floorY - 0.005; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
    } else if (floorMode !== 'none') {
      // Infinite floor — large plane + fog to blend with sky at horizon
      var infFloor = new T.Mesh(new T.PlaneGeometry(10000, 10000), new T.MeshStandardMaterial({ color: actualFloorCol, roughness: 1.0, metalness: 0, envMapIntensity: 0 }));
      infFloor.rotation.x = -Math.PI / 2; infFloor.position.y = c.floorY - 0.01; infFloor.receiveShadow = true; scene.add(infFloor);
      if (!c.noFog) scene.fog = new T.FogExp2(new T.Color(c.skyBot), 0.003);
    }
    // Always add a shadow catcher
    if (floorMode === 'none') {
      var shFloor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.15 }));
      shFloor.rotation.x = -Math.PI / 2; shFloor.position.y = c.floorY - 0.005; shFloor.receiveShadow = true; scene.add(shFloor);
    }
    // 3-point lighting
    scene.add(new T.AmbientLight(isLight ? 0xffffff : 0x111122, c.ambientI));
    var keyL = new T.DirectionalLight(isLight ? 0xfff6e0 : 0xffffff, c.keyI);
    keyL.position.set(-5, 8, 5); keyL.castShadow = true; keyL.shadow.mapSize.set(2048, 2048);
    keyL.shadow.camera.left = -15; keyL.shadow.camera.right = 15; keyL.shadow.camera.top = 15; keyL.shadow.camera.bottom = -15; keyL.shadow.bias = -0.001;
    scene.add(keyL);
    scene.add(new T.DirectionalLight(isLight ? 0xd0e8ff : 0x4444aa, isLight ? 0.35 : 0.2).translateX(6).translateY(2).translateZ(4));
    scene.add(new T.DirectionalLight(isLight ? 0xffe0d0 : 0xff6040, isLight ? 0.5 : 0.35).translateY(4).translateZ(-9));
    // Env map
    try {
      var pmrem = new T.PMREMGenerator(renderer);
      var envScene = new T.Scene();
      var envSkyGeo = new T.SphereGeometry(50, 32, 16);
      var envSkyMat = new T.ShaderMaterial({ side: T.BackSide, uniforms: { topColor: {value: new T.Color(0xddeeff)}, bottomColor: {value: new T.Color(0xfff8f0)} }, vertexShader: 'varying vec3 vWP; void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWP=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}', fragmentShader: 'uniform vec3 topColor;uniform vec3 bottomColor;varying vec3 vWP;void main(){float h=normalize(vWP).y*0.5+0.5;gl_FragColor=vec4(mix(bottomColor,topColor,h),1.0);}' });
      envScene.add(new T.Mesh(envSkyGeo, envSkyMat));
      var p = new T.Mesh(new T.PlaneGeometry(8,4), new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}));
      p.position.set(-6,8,5); p.lookAt(0,0,0); envScene.add(p);
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
    } catch(e) {}
    return { floorY: c.floorY };
  };
  <\/script>
  <!-- CenchReact SDK: Remotion-style hooks + bridge components -->
  <script src="/sdk/cench-react/cench-react-runtime.js"><\/script>
  <script src="/sdk/cench-react/cench-react-bridges.js"><\/script>
  <!-- CenchMotion + CenchCamera (shared with other scene types) -->
  <script src="/sdk/cench-motion.js"><\/script>
  <script src="/sdk/cench-camera.js"><\/script>

  <script id="scene-jsx" type="text/cench-jsx">
${normalizeReactSceneExport(reactCode).replace(/<\/script/gi, '<\\/script')}
  <\/script>

  <script>
  // CenchReact bootstrapper: transpile JSX and mount the exported scene component.
  // The scene code runs in the same sandboxed iframe as all other scene types.
  (function() {
    var jsxSrc = document.getElementById('scene-jsx').textContent;
    if (!jsxSrc || !jsxSrc.trim()) return;

    // Transpile JSX to JS via Babel standalone
    var js;
    try {
      js = Babel.transform(jsxSrc, {
        presets: [['react', { runtime: 'classic' }]],
        plugins: ['transform-modules-commonjs'],
      }).code;
    } catch (e) {
      console.error('CenchReact: JSX transpilation failed', e);
      var errDiv = document.getElementById('react-root');
      if (errDiv) errDiv.textContent = 'JSX Error: ' + e.message;
      try {
        window.parent.postMessage({ source: 'cench-scene', type: 'cench-jsx-error', sceneId: SCENE_ID, message: e.message }, '*');
      } catch(ignore) {}
      return;
    }

    // Inject transpiled code as a script element (same pattern as other scene types
    // which embed AI-generated JS directly in inline script tags)
    var scriptEl = document.createElement('script');
    scriptEl.textContent = '(function(useCurrentFrame,useVideoConfig,interpolate,spring,Sequence,AbsoluteFill,Easing,Canvas2DLayer,ThreeJSLayer,D3Layer,SVGLayer,LottieLayer,useVariable,useInteraction,useTrigger){var module={exports:{}};var exports=module.exports;'
      + 'var require=function(mod){var _r={useCurrentFrame:useCurrentFrame,useVideoConfig:useVideoConfig,interpolate:interpolate,spring:spring,Sequence:Sequence,AbsoluteFill:AbsoluteFill,Easing:Easing};var m={"react":React,"three":typeof THREE!=="undefined"?THREE:{},"d3":typeof d3!=="undefined"?d3:{},"animejs":typeof anime!=="undefined"?anime:{},"anime":typeof anime!=="undefined"?anime:{},"remotion":_r,"@remotion/core":_r};if(m[mod]!==undefined)return m[mod];console.warn("CenchReact: unknown module "+mod);return {};};'
      + js
      + ';window.__CenchSceneExports=module.exports;'
      + '})(CenchReact.useCurrentFrame,CenchReact.useVideoConfig,CenchReact.interpolate,CenchReact.spring,CenchReact.Sequence,CenchReact.AbsoluteFill,CenchReact.Easing,CenchReact.Canvas2DLayer,CenchReact.ThreeJSLayer,CenchReact.D3Layer,CenchReact.SVGLayer,CenchReact.LottieLayer,CenchReact.useVariable,CenchReact.useInteraction,CenchReact.useTrigger);';
    document.body.appendChild(scriptEl);

    // Resolve the exported component
    var exp = window.__CenchSceneExports || {};
    var SceneComponent = exp.default || exp.Scene || (typeof exp === 'function' ? exp : null);
    if (typeof SceneComponent !== 'function') {
      // Self-diagnose: look at the source to hint what's missing.
      var hint = 'Add "export default Scene;" at the end of the scene code.';
      if (/function\\s+(Scene|Main|App|Root)\\b/.test(jsxSrc) && !/export\\s+default/.test(jsxSrc)) {
        hint = 'Found a component but no "export default" statement. Scene renders blank without it. Add: "export default Scene;" at the end.';
      } else if (!/function|const|let|var/.test(jsxSrc)) {
        hint = 'No component declaration found in scene source.';
      }
      console.error('CenchReact: No component exported. ' + hint);
      var root = document.getElementById('react-root');
      if (root) root.textContent = 'Scene error: ' + hint;
      return;
    }

    // Error boundary to catch runtime errors in scene code
    var ErrorBoundary = (function() {
      function EB(props) { this.state = { error: null }; }
      EB.prototype = Object.create(React.Component.prototype);
      EB.prototype.constructor = EB;
      EB.getDerivedStateFromError = function(err) { return { error: err }; };
      EB.prototype.componentDidCatch = function(err, info) {
        console.error('CenchReact scene error:', err, info);
      };
      EB.prototype.render = function() {
        if (this.state.error) {
          return React.createElement('div', {
            style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: '12px',
              background: '#1a1a2e', color: '#e84545', fontFamily: 'monospace', padding: '40px' }
          },
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 700 } }, 'Scene Error'),
            React.createElement('pre', { style: { fontSize: '13px', color: '#ccc', maxWidth: '80%',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, String(this.state.error.message || this.state.error))
          );
        }
        return this.props.children;
      };
      return EB;
    })();

    // Mount inside CenchComposition with Error Boundary
    var fps = 30;
    var root = ReactDOM.createRoot(document.getElementById('react-root'));
    root.render(
      React.createElement(ErrorBoundary, null,
        React.createElement(CenchReact.CenchComposition, {
          fps: fps,
          width: WIDTH,
          height: HEIGHT,
          durationInFrames: Math.round(DURATION * fps),
        }, React.createElement(SceneComponent))
      )
    );

    // Apply element overrides (non-destructive visual tweaks from the inspector)
    var __overrides = ${JSON.stringify(scene.elementOverrides ?? {})};
    if (Object.keys(__overrides).length > 0) {
      requestAnimationFrame(function() {
        setTimeout(function() {
          Object.keys(__overrides).forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            var props = __overrides[id];
            Object.keys(props).forEach(function(prop) {
              var val = props[prop];
              if (prop === 'text') el.textContent = String(val);
              else el.style[prop] = (typeof val === 'number') ? (val + 'px') : String(val);
            });
          });
        }, 50);
      });
    }
  })();
  <\/script>
</body>
</html>`
}
export function generateSceneHTML(
  scene: Scene,
  globalStyle?: GlobalStyle,
  watermark?: (WatermarkConfig & { publicUrl: string }) | null,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const { width: W, height: H } = dims ?? DEFAULT_DIMENSIONS
  // Use scene-level style override if present, otherwise fall back to global
  const hasOverride = scene.styleOverride != null && Object.keys(scene.styleOverride).length > 0
  const style =
    hasOverride && globalStyle
      ? resolveSceneStyle(scene.styleOverride, globalStyle)
      : resolveStyleFromGlobal(globalStyle)

  // Scene-level bgColor overrides the preset when explicitly set
  if (scene.bgColor) {
    style.bgColor = scene.bgColor
  }

  const _dims = { width: W, height: H }
  let html: string
  if (scene.sceneType === 'canvas2d') html = generateCanvasHTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === 'motion') html = generateMotionHTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === 'd3') html = generateD3HTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === 'three') html = generateThreeHTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === 'lottie') html = generateLottieHTML(scene, audioSettings, _dims)
  else if (scene.sceneType === 'zdog') html = generateZdogHTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === 'physics') html = generatePhysicsHTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === '3d_world') html = generateWorldHTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === 'avatar_scene') html = generateAvatarSceneHTML(scene, style, audioSettings, _dims)
  else if (scene.sceneType === 'react') html = generateReactHTML(scene, style, audioSettings, _dims)
  else html = generateSVGHTML(scene, style, audioSettings, _dims)

  // Inject <base> + GSAP + playback controller into <head>
  // <base> ensures relative asset URLs (/uploads/..., /generated/...) resolve
  // correctly even when the render server loads the HTML from a different origin
  const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  html = html.replace('<head>', `<head>\n  <base href="${appBaseUrl}/">` + GSAP_HEAD)

  // Inject import map for TalkingHead.js if any avatar layer uses it
  const hasTalkingHead = scene.aiLayers?.some((l: any) => l.type === 'avatar' && l.talkingHeadUrl)
  if (hasTalkingHead) {
    const importMap = `
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
    }
  }
  </script>`
    html = html.replace('</head>', importMap + '\n</head>')
  }

  // Inject playback controller BEFORE closing </body> (after globals, before scene code runs)
  // The controller creates window.__tl which scene code uses
  const controllerScript = `<script>${PLAYBACK_CONTROLLER}<\/script>`
  const registryScript = `<script>${ELEMENT_REGISTRY}<\/script>`
  // Insert before the first scene-specific <script> block after globals
  // Fallback: insert before </body>
  // Element registry goes right after playback controller
  const canvasBgUserCode = scene.canvasBackgroundCode?.trim() ?? ''
  const canvasBgScript =
    canvasBgUserCode && ['motion', 'd3', 'svg', 'react'].includes(scene.sceneType ?? '')
      ? `<script>\n${canvasBgUserCode}\n<\/script>`
      : ''

  if (html.includes('<!-- playback-controller-slot -->')) {
    html = html.replace(
      '<!-- playback-controller-slot -->',
      controllerScript + '\n' + registryScript + (canvasBgScript ? `\n${canvasBgScript}` : ''),
    )
  } else {
    html = html.replace('</body>', controllerScript + '\n' + registryScript + '\n</body>')
  }

  // Inject camera motion calls before </body> (after playback controller + scene code)
  if (scene.cameraMotion && scene.cameraMotion.length > 0) {
    const cameraScript = generateCameraMotionScript(scene.cameraMotion)
    html = html.replace('</body>', cameraScript + '\n</body>')
  }

  // Inject watermark overlay before </body> if configured
  if (watermark?.publicUrl) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const wmUrl = watermark.publicUrl.startsWith('http') ? watermark.publicUrl : `${baseUrl}${watermark.publicUrl}`
    const posCSS = getWatermarkPositionCSS(watermark.position)
    const wmHTML = `<div style="position:fixed;${posCSS};opacity:${watermark.opacity};pointer-events:none;z-index:9999;">
  <img src="${escapeAttr(wmUrl)}" style="width:${watermark.sizePercent}vw;height:auto;" />
</div>`
    html = html.replace('</body>', wmHTML + '\n</body>')
  }

  return html
}

function getWatermarkPositionCSS(position: WatermarkConfig['position']): string {
  switch (position) {
    case 'top-left':
      return 'top:2vw;left:2vw'
    case 'top-right':
      return 'top:2vw;right:2vw'
    case 'bottom-left':
      return 'bottom:2vw;left:2vw'
    case 'bottom-right':
      return 'bottom:2vw;right:2vw'
    default:
      return 'bottom:2vw;right:2vw'
  }
}

// ── Text overlay renderer (shared: used by SVG + React templates) ────────────

function renderTextOverlaysHTML(textOverlays: Array<import('./types').TextOverlay>): string {
  if (!textOverlays?.length) return ''
  const animMap: Record<string, string> = {
    'fade-in': 'fadeInOverlay',
    'slide-up': 'slideUpOverlay',
    typewriter: 'fadeInOverlay',
  }
  return textOverlays
    .map(
      (t) =>
        `<div class="text-overlay" style="left:${t.x}%;top:${t.y}%;font-family:${t.font};font-size:${t.size}px;color:${t.color};animation:${animMap[t.animation] ?? 'fadeInOverlay'} ${t.duration}s ease ${t.delay}s forwards;">${t.content}</div>`,
    )
    .join('\n  ')
}

const TEXT_OVERLAY_CSS = `
  .text-overlay {
    position: absolute;
    z-index: 3;
    opacity: 0;
    white-space: pre-wrap;
    pointer-events: none;
  }
  @keyframes fadeInOverlay {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideUpOverlay {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
`

function generateSVGHTML(
  scene: Scene,
  style: ResolvedStyle,
  audioSettings?: AudioSettings | null,
  dims?: ProjectDimensions,
): string {
  const W = dims?.width ?? 1920
  const H = dims?.height ?? 1080
  const { svgContent = '', videoLayer, textOverlays = [], svgObjects = [], primaryObjectId = null } = scene

  // New scenes: primary SVG is already in svgObjects, no need for #svg-layer
  const hasPrimaryObject = !!primaryObjectId && svgObjects.some((o) => o.id === primaryObjectId)

  const svgObjectsHTML = svgObjects
    .map((obj) =>
      obj.svgContent
        ? `<div class="svg-object" id="obj-${obj.id}" style="position:absolute;left:${obj.x}%;top:${obj.y}%;width:${obj.width}%;opacity:${obj.opacity};z-index:${obj.zIndex};pointer-events:none;">${obj.svgContent}</div>`
        : '',
    )
    .join('\n  ')

  const textOverlaysHTML = renderTextOverlaysHTML(textOverlays)

  const videoDisplay = videoLayer?.enabled ? 'block' : 'none'
  const videoOpacity = videoLayer?.opacity ?? 1
  const videoSrc = videoLayer?.src ?? ''
  const videoTrimStart = videoLayer?.trimStart ?? 0

  const audioHTML = generateAudioHTML(scene.audioLayer)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  ${style.roughnessLevel > 0.2 ? '<script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>' : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; animation-play-state: paused; }
    body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      ${buildBgStyleCSS(style)}
    }

    #video-layer {
      position: absolute; inset: 0;
      opacity: ${videoOpacity};
      z-index: 1;
      display: ${videoDisplay};
    }
    #video-layer video { width: 100%; height: 100%; object-fit: cover; }

    #svg-layer {
      position: absolute; inset: 0;
      z-index: 2;
    }
    #svg-layer svg { width: 100%; height: 100%; }

    .text-overlay {
      position: absolute;
      z-index: 3;
      opacity: 0;
      white-space: pre-wrap;
    }

    .svg-object svg { width: 100%; height: auto; display: block; background: transparent; }

    /* Stroke animation */
    .stroke {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: var(--len, 1000);
      stroke-dashoffset: var(--len, 1000);
      animation: draw var(--dur, 1s) ease-in-out var(--delay, 0s) forwards;
    }
    .fadein {
      opacity: 0;
      animation: pop var(--dur, 0.4s) ease var(--delay, 0s) forwards;
    }
    @keyframes draw      { to { stroke-dashoffset: 0; } }
    @keyframes pop       { to { opacity: 1; } }
    @keyframes scaleIn   { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideUp   { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideLeft { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes bounceIn  { 0% { opacity: 0; transform: scale(0); } 60% { opacity: 1; transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes rotateIn  { from { opacity: 0; transform: rotate(-15deg); } to { opacity: 1; transform: rotate(0deg); } }
    @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUpOverlay {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .scale {
      opacity: 0; transform-origin: center center;
      animation: scaleIn var(--dur, 0.4s) ease var(--delay, 0s) forwards;
    }
    .slide-up {
      opacity: 0;
      animation: slideUp var(--dur, 0.5s) ease var(--delay, 0s) forwards;
    }
    .slide-left {
      opacity: 0;
      animation: slideLeft var(--dur, 0.5s) ease var(--delay, 0s) forwards;
    }
    .bounce {
      opacity: 0; transform-origin: center center;
      animation: bounceIn var(--dur, 0.6s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay, 0s) forwards;
    }
    .rotate {
      opacity: 0; transform-origin: center center;
      animation: rotateIn var(--dur, 0.5s) ease var(--delay, 0s) forwards;
    }
  </style>
</head>
<body>

  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">

  ${sceneUsesCanvasBackground(scene) ? canvasBgTag(W, H) : ''}

  <div id="video-layer">
    ${videoLayer?.enabled && videoSrc ? `<video src="${videoSrc}" muted playsinline></video>` : ''}
  </div>

  ${hasPrimaryObject ? '' : `<div id="svg-layer">${svgContent}</div>`}

  ${audioHTML}

  ${svgObjectsHTML}

  ${textOverlaysHTML}

  ${generateAILayersHTML(scene.aiLayers, audioSettings)}

  </div><!-- /scene-camera -->

  <script>
    // ── Scene globals ─────────────────────────────────────
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};

    document.addEventListener('DOMContentLoaded', () => {
      // Auto-calculate stroke-dasharray lengths (legacy CSS animation scenes)
      document.querySelectorAll('.stroke').forEach(el => {
        if (el.getTotalLength) {
          el.style.setProperty('--len', el.getTotalLength());
        }
      });

      const video = document.querySelector('#video-layer video');
      if (video) video.currentTime = ${videoTrimStart};

      // Audio volume is handled by the playback controller
    });
  </script>

  <!-- playback-controller-slot -->
</body>
</html>`
}

import type { Scene, AILayer, AvatarLayer, Veo3Layer, ImageLayer, StickerLayer } from './types'
import { CANVAS_RENDERER_CODE } from './canvas-renderer/inlined'

// ── AI Layer HTML generation ────────────────────────────────────────────────

function generateAILayersHTML(layers: AILayer[] | undefined): string {
  if (!layers || layers.length === 0) return ''

  return layers
    .filter((l) => l.status === 'ready')
    .map((layer) => {
      switch (layer.type) {
        case 'avatar':
          return generateAvatarLayerHTML(layer as AvatarLayer)
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

function generateAvatarLayerHTML(layer: AvatarLayer): string {
  if (!layer.videoUrl) return ''
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <video
    id="${layer.id}-video"
    style="position:absolute;left:${layer.x - layer.width / 2}px;top:${layer.y - layer.height / 2}px;width:${layer.width}px;height:${layer.height}px;"
    src="${layer.videoUrl}"
    playsinline
    muted>
  </video>
  <script>
    setTimeout(() => {
      const v = document.getElementById('${layer.id}-video');
      if (v) v.play();
    }, ${(layer.startAt ?? 0) * 1000});
  </script>
</div>`
}

function generateVeo3LayerHTML(layer: Veo3Layer): string {
  if (!layer.videoUrl) return ''
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
    setTimeout(() => {
      const v = document.getElementById('${layer.id}-video');
      if (v) { v.playbackRate = ${layer.playbackRate ?? 1}; v.play(); }
    }, ${(layer.startAt ?? 0) * 1000});
  </script>
</div>`
}

function generateImageLayerHTML(layer: ImageLayer): string {
  if (!layer.imageUrl) return ''
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <img
    src="${layer.imageUrl}"
    style="position:absolute;left:${layer.x - layer.width / 2}px;top:${layer.y - layer.height / 2}px;width:${layer.width}px;height:${layer.height}px;transform:rotate(${layer.rotation}deg);object-fit:contain;"
  >
</div>`
}

function generateStickerLayerHTML(layer: StickerLayer): string {
  const src = layer.stickerUrl ?? layer.imageUrl
  if (!src) return ''
  const animateStyle = layer.animateIn ? 'opacity:0;transform:scale(0.5);' : ''
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <img
    id="${layer.id}-img"
    src="${src}"
    style="position:absolute;left:${layer.x - layer.width / 2}px;top:${layer.y - layer.height / 2}px;width:${layer.width}px;height:${layer.height}px;transform:rotate(${layer.rotation}deg);object-fit:contain;${animateStyle}"
  >
  ${layer.animateIn ? `<script>
    setTimeout(() => {
      const img = document.getElementById('${layer.id}-img');
      if (img) {
        img.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        img.style.opacity = '1';
        img.style.transform = 'rotate(${layer.rotation}deg) scale(1)';
      }
    }, ${(layer.startAt ?? 0) * 1000});
  </script>` : ''}
</div>`
}

function generateCanvasHTML(scene: Scene): string {
  const { bgColor = '#fffef9', canvasCode = '', audioLayer } = scene

  const audioTag =
    audioLayer?.enabled && audioLayer?.src
      ? `<audio src="${audioLayer.src}" id="scene-audio"></audio>`
      : ''

  const audioVolume = audioLayer?.volume ?? 1

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: ${bgColor}; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="c" width="1920" height="1080"></canvas>
  ${audioTag}

  <script>
    // Pause/resume stubs — overwritten by generated code below
    window.__animFrame = null;
    window.__pause  = () => { cancelAnimationFrame(window.__animFrame); };
    window.__resume = () => {};

    document.addEventListener('DOMContentLoaded', () => {
      const audio = document.getElementById('scene-audio');
      if (audio) {
        audio.volume = ${audioVolume};
        const _p = window.__pause, _r = window.__resume;
        window.__pause  = () => { _p(); audio.pause(); };
        window.__resume = () => { _r(); audio.play().catch(() => {}); };
      }
    });
  </script>

  ${generateAILayersHTML(scene.aiLayers)}

  <script>
${CANVAS_RENDERER_CODE}
  </script>

  <script>
${canvasCode}
  </script>
</body>
</html>`
}

function generateMotionHTML(scene: Scene): string {
  const { bgColor = '#fffef9', sceneCode = '', sceneHTML = '', sceneStyles = '', audioLayer } = scene

  const audioTag =
    audioLayer?.enabled && audioLayer?.src
      ? `<audio src="${audioLayer.src}" id="scene-audio"></audio>`
      : ''

  const audioVolume = audioLayer?.volume ?? 1

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: ${bgColor}; }
    ${sceneStyles}
  </style>
</head>
<body>
  ${sceneHTML}
  ${audioTag}

  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>
  <script type="module">
    import { animate, stagger } from "https://esm.sh/motion@11";

    window.__pause  = () => { document.querySelectorAll('*').forEach(el => { const s = getComputedStyle(el); if (s.animationName && s.animationName !== 'none') el.style.animationPlayState = 'paused'; }); };
    window.__resume = () => { document.querySelectorAll('*').forEach(el => { const s = getComputedStyle(el); if (s.animationName && s.animationName !== 'none') el.style.animationPlayState = 'running'; }); };

    document.addEventListener('DOMContentLoaded', () => {
      const audio = document.getElementById('scene-audio');
      if (audio) {
        audio.volume = ${audioVolume};
        const _p = window.__pause, _r = window.__resume;
        window.__pause  = () => { _p(); audio.pause(); };
        window.__resume = () => { _r(); audio.play().catch(() => {}); };
      }
    });

    ${sceneCode}
  </script>

  ${generateAILayersHTML(scene.aiLayers)}
</body>
</html>`
}

function generateD3HTML(scene: Scene): string {
  const { bgColor = '#fffef9', sceneCode = '', sceneStyles = '', d3Data = null, audioLayer } = scene

  const audioTag =
    audioLayer?.enabled && audioLayer?.src
      ? `<audio src="${audioLayer.src}" id="scene-audio"></audio>`
      : ''

  const audioVolume = audioLayer?.volume ?? 1

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: ${bgColor}; }
    #chart { width: 100%; height: 100%; }
    ${sceneStyles}
  </style>
</head>
<body>
  <div id="chart"></div>
  ${audioTag}

  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
  <script>
    const DATA = ${JSON.stringify(d3Data)};
    const WIDTH = 1920, HEIGHT = 1080;
    window.__pause  = () => {};
    window.__resume = () => {};

    document.addEventListener('DOMContentLoaded', () => {
      const audio = document.getElementById('scene-audio');
      if (audio) {
        audio.volume = ${audioVolume};
        window.__pause  = () => { audio.pause(); };
        window.__resume = () => { audio.play().catch(() => {}); };
      }
    });

    ${sceneCode}
  </script>

  ${generateAILayersHTML(scene.aiLayers)}
</body>
</html>`
}

function generateThreeHTML(scene: Scene): string {
  const { bgColor = '#fffef9', sceneCode = '', audioLayer } = scene
  const palette = JSON.stringify(['#181818', '#121212', '#e84545', '#151515', '#f0ece0'])
  const duration = scene.duration ?? 8

  const audioTag =
    audioLayer?.enabled && audioLayer?.src
      ? `<audio src="${audioLayer.src}" id="scene-audio"></audio>`
      : ''

  const audioVolume = audioLayer?.volume ?? 1

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: ${bgColor}; }
    canvas { display: block; }
  </style>
</head>
<body>
  ${audioTag}

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    var WIDTH = 1920, HEIGHT = 1080;
    var PALETTE = ${palette};
    var DURATION = ${duration};

    var MATERIALS = {
      plastic: function(c) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.6, metalness: 0 }); },
      metal:   function(c) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.2, metalness: 0.9 }); },
      glass:   function(c) { return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c), transparent: true, opacity: 0.3, roughness: 0, transmission: 0.9 }); },
      matte:   function(c) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 1, metalness: 0 }); },
      glow:    function(c) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(c), emissive: new THREE.Color(c), emissiveIntensity: 0.8 }); },
    };

    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    window.__animFrame = null;
    window.__pause  = function() { cancelAnimationFrame(window.__animFrame); };
    window.__resume = function() {};

    ${sceneCode}
  </script>

  ${generateAILayersHTML(scene.aiLayers)}
</body>
</html>`
}

function generateZdogHTML(scene: Scene): string {
  const { bgColor = '#fffef9', sceneCode = '', audioLayer } = scene
  const palette = JSON.stringify(['#181818', '#121212', '#e84545', '#151515', '#f0ece0'])
  const duration = scene.duration ?? 8

  const audioTag =
    audioLayer?.enabled && audioLayer?.src
      ? `<audio src="${audioLayer.src}" id="scene-audio"></audio>`
      : ''

  const audioVolume = audioLayer?.volume ?? 1

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: ${bgColor}; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="zdog-canvas" width="1920" height="1080"></canvas>
  ${audioTag}

  <script src="https://unpkg.com/zdog@1/dist/zdog.dist.min.js"></script>
  <script>
    const WIDTH = 1920, HEIGHT = 1080;
    const PALETTE = ${palette};
    const DURATION = ${duration};
    const FONT = 'sans-serif';

    // Seeded PRNG — use mulberry32(seed)() instead of Math.random()
    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    // Pause/resume stubs — overwritten by generated scene code below
    window.__animFrame = null;
    window.__pause  = () => { cancelAnimationFrame(window.__animFrame); };
    window.__resume = () => {};

    document.addEventListener('DOMContentLoaded', () => {
      const audio = document.getElementById('scene-audio');
      if (audio) {
        audio.volume = ${audioVolume};
        const _p = window.__pause, _r = window.__resume;
        window.__pause  = () => { _p(); audio.pause(); };
        window.__resume = () => { _r(); audio.play().catch(() => {}); };
      }
    });
  </script>

  ${generateAILayersHTML(scene.aiLayers)}

  <script>
${sceneCode}
  </script>
</body>
</html>`
}

function generateLottieHTML(scene: Scene): string {
  const { bgColor = '#fffef9', lottieSource = '', svgContent = '', audioLayer } = scene

  const audioTag =
    audioLayer?.enabled && audioLayer?.src
      ? `<audio src="${audioLayer.src}" id="scene-audio"></audio>`
      : ''

  const audioVolume = audioLayer?.volume ?? 1

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
  <div id="lottie-container"></div>
  <div id="svg-overlay">${svgContent}</div>
  ${audioTag}

  <script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"></script>
  <script>
    const anim = lottie.loadAnimation({
      container: document.getElementById('lottie-container'),
      renderer: 'svg',
      loop: false,
      autoplay: true,
      ${lottieInit}
    });
    window.__pause  = () => anim.pause();
    window.__resume = () => anim.play();

    document.addEventListener('DOMContentLoaded', () => {
      const audio = document.getElementById('scene-audio');
      if (audio) {
        audio.volume = ${audioVolume};
        const _p = window.__pause, _r = window.__resume;
        window.__pause  = () => { _p(); audio.pause(); };
        window.__resume = () => { _r(); audio.play().catch(() => {}); };
      }
    });
  </script>

  ${generateAILayersHTML(scene.aiLayers)}
</body>
</html>`
}

export function generateSceneHTML(scene: Scene): string {
  if (scene.sceneType === 'canvas2d') return generateCanvasHTML(scene)
  if (scene.sceneType === 'motion') return generateMotionHTML(scene)
  if (scene.sceneType === 'd3') return generateD3HTML(scene)
  if (scene.sceneType === 'three') return generateThreeHTML(scene)
  if (scene.sceneType === 'lottie') return generateLottieHTML(scene)
  if ((scene.sceneType as string) === 'zdog') return generateZdogHTML(scene)
  const {
    bgColor = '#fffef9',
    svgContent = '',
    videoLayer,
    audioLayer,
    textOverlays = [],
    svgObjects = [],
    primaryObjectId = null,
  } = scene

  // New scenes: primary SVG is already in svgObjects, no need for #svg-layer
  const hasPrimaryObject = !!primaryObjectId && svgObjects.some((o) => o.id === primaryObjectId)

  const svgObjectsHTML = svgObjects
    .map((obj) =>
      obj.svgContent
        ? `<div class="svg-object" id="obj-${obj.id}" style="position:absolute;left:${obj.x}%;top:${obj.y}%;width:${obj.width}%;opacity:${obj.opacity};z-index:${obj.zIndex};pointer-events:none;">${obj.svgContent}</div>`
        : ''
    )
    .join('\n  ')

  const textOverlaysHTML = textOverlays
    .map((t) => {
      const animMap = {
        'fade-in': 'fadeInOverlay',
        'slide-up': 'slideUpOverlay',
        typewriter: 'fadeInOverlay',
      }
      return `<div class="text-overlay" style="left:${t.x}%;top:${t.y}%;font-family:${t.font};font-size:${t.size}px;color:${t.color};animation:${animMap[t.animation]} ${t.duration}s ease ${t.delay}s forwards;">${t.content}</div>`
    })
    .join('\n  ')

  const videoDisplay = videoLayer?.enabled ? 'block' : 'none'
  const videoOpacity = videoLayer?.opacity ?? 1
  const videoSrc = videoLayer?.src ?? ''
  const videoTrimStart = videoLayer?.trimStart ?? 0

  const audioTag =
    audioLayer?.enabled && audioLayer?.src
      ? `<audio src="${audioLayer.src}" id="scene-audio"></audio>`
      : ''

  const audioStartOffset = (audioLayer?.startOffset ?? 0) * 1000
  const audioVolume = audioLayer?.volume ?? 1
  const audioFadeIn = audioLayer?.fadeIn ?? false
  const audioFadeOut = audioLayer?.fadeOut ?? false

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; animation-play-state: paused; }
    body { width: 1920px; height: 1080px; overflow: hidden; background: ${bgColor}; }

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

  <div id="video-layer">
    ${videoLayer?.enabled && videoSrc ? `<video src="${videoSrc}" muted playsinline></video>` : ''}
  </div>

  ${hasPrimaryObject ? '' : `<div id="svg-layer">${svgContent}</div>`}

  ${audioTag}

  ${svgObjectsHTML}

  ${textOverlaysHTML}

  ${generateAILayersHTML(scene.aiLayers)}

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Auto-calculate stroke-dasharray lengths
      document.querySelectorAll('.stroke').forEach(el => {
        if (el.getTotalLength) {
          el.style.setProperty('--len', el.getTotalLength());
        }
      });

      const video = document.querySelector('#video-layer video');
      if (video) video.currentTime = ${videoTrimStart};

      const audio = document.getElementById('scene-audio');
      if (audio) audio.volume = ${audioVolume};

      // Scrub: offset animation delays by -t seconds for all animated elements
      const t = parseFloat(new URLSearchParams(location.search).get('t') || '0');
      if (t > 0) {
        document.querySelectorAll('*').forEach(el => {
          const s = window.getComputedStyle(el);
          if (s.animationName && s.animationName !== 'none') {
            const delay = parseFloat(s.animationDelay) || 0;
            el.style.animationDelay = (delay - t) + 's';
          }
        });
        if (video) video.currentTime = ${videoTrimStart} + t;
      }
    });
  </script>
</body>
</html>`
}

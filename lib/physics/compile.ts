import type { PhysicsLayer } from '../types'
import { buildPhysicsCardElement, shouldRegisterPhysicsCard } from './card-inspector'

const SIM_CLASS_MAP: Record<PhysicsLayer['simulation'], string> = {
  pendulum: 'PendulumSim',
  double_pendulum: 'DoublePendulumSim',
  projectile: 'ProjectileSim',
  orbital: 'OrbitalSim',
  wave_interference: 'WaveInterferenceSim',
  double_slit: 'DoubleSlitSim',
  electric_field: 'ElectricFieldSim',
  harmonic_oscillator: 'HarmonicOscillatorSim',
}

function esc(text: string): string {
  return (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function safeCssColor(c: unknown): string {
  const t = String(c ?? '').trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t
  if (/^rgba?\(\s*[\d.,\s%]+\s*\)$/.test(t)) return t
  return ''
}

function safeBgImageUrl(u: unknown): string {
  const t = String(u ?? '').trim()
  if (!t) return ''
  if (t.startsWith('/') || /^https?:\/\//i.test(t)) return t.replace(/[\r\n"'<>]/g, '')
  return ''
}

/** Layer stack panel: background | card chrome | title/equations/narration */
export type PhysicsSublayerKey = 'background' | 'card' | 'text'

export const DEFAULT_PHYSICS_SUBLAYER_ORDER: PhysicsSublayerKey[] = ['text', 'card', 'background']

export function parsePhysicsSubOrder(params: Record<string, unknown>): PhysicsSublayerKey[] {
  const raw = params.ui_physicsSublayerOrder
  const allowed = new Set<string>(['background', 'card', 'text'])
  const out: PhysicsSublayerKey[] = []
  const seen = new Set<string>()
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const k = String(x) as PhysicsSublayerKey
      if (allowed.has(k) && !seen.has(k)) {
        out.push(k)
        seen.add(k)
      }
    }
  }
  for (const k of DEFAULT_PHYSICS_SUBLAYER_ORDER) {
    if (!seen.has(k)) out.push(k)
  }
  return out
}

export function parsePhysicsSubHidden(params: Record<string, unknown>): Record<PhysicsSublayerKey, boolean> {
  const h = (params.ui_physicsSublayerHidden || {}) as Record<string, boolean>
  return {
    background: !!h.background,
    card: !!h.card,
    text: !!h.text,
  }
}

/** First in order = topmost (highest z-index). */
export function physicsSubZByOrder(order: PhysicsSublayerKey[]): Record<PhysicsSublayerKey, number> {
  const tier = [10, 20, 30]
  const r: Record<PhysicsSublayerKey, number> = {
    background: tier[0],
    card: tier[1],
    text: tier[2],
  }
  order.forEach((k, i) => {
    r[k] = tier[order.length - 1 - i]
  })
  return r
}

function buildPhysicsBackdrop(params: Record<string, unknown>, zIndex: number): string {
  const mode = String(params.ui_physicsBgMode ?? 'default')
  if (mode === 'default' || mode === '' || mode === 'none') return ''
  const z = `z-index:${zIndex};`
  if (mode === 'solid') {
    const raw = String(params.ui_physicsBgColor ?? '#0b1220')
    const c = safeCssColor(raw) || '#0b1220'
    return `<div class="physics-backdrop" style="position:absolute;inset:0;${z}background:${c};pointer-events:none;" aria-hidden="true"></div>`
  }
  if (mode === 'image') {
    const url = safeBgImageUrl(params.ui_physicsBgImageUrl)
    if (!url) return ''
    const escUrl = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `<div class="physics-backdrop" style="position:absolute;inset:0;${z}background-image:url('${escUrl}');background-size:cover;background-position:center;pointer-events:none;" aria-hidden="true"></div>`
  }
  return ''
}

function wrapPhysicsScene(inner: string, params: Record<string, unknown>, w: number, h: number): string {
  const pr = (params || {}) as Record<string, unknown>
  const order = parsePhysicsSubOrder(pr)
  const zs = physicsSubZByOrder(order)
  const hd = parsePhysicsSubHidden(pr)
  const bd = hd.background ? '' : buildPhysicsBackdrop(pr, zs.background)
  if (!bd) return inner
  const zFg = Math.max(5, 55 - zs.background)
  return `<div class="physics-scene-stack" style="position:relative;width:${w}px;height:${h}px;">${bd}<div class="physics-scene-foreground" style="position:absolute;inset:0;z-index:${zFg};width:100%;height:100%;">${inner}</div></div>`
}

function buildExplainCardSplit(
  cardStyle: string,
  layoutExtraClass: string,
  titleHTML: string,
  equationHTML: string,
  narrationHTML: string,
  zs: Record<PhysicsSublayerKey, number>,
  hd: Record<PhysicsSublayerKey, boolean>,
  canvasId: string,
  canvasW: number,
  canvasH: number,
  simScale: number,
): string {
  const zWrap = Math.max(zs.card, zs.text)
  const inner = `${titleHTML}\n${equationHTML}\n${narrationHTML}`
  const mid = Math.round((zs.background + Math.max(zs.card, zs.text)) / 2)
  const zSim = Math.max(1, Math.min(50, mid))
  const hideFrame = hd.card ? 'display:none;' : ''
  const hideText = hd.text ? 'display:none;' : ''
  return `<div class="sim-stage" style="z-index:${zSim};"><canvas id="${canvasId}" width="${canvasW}" height="${canvasH}" style="--sim-scale:${simScale};"></canvas></div>
  <div id="physics-explain-card-root" class="physics-explain-card physics-explain-split${layoutExtraClass}" style="${cardStyle};z-index:${zWrap};">
  <div class="physics-sub-card-frame" style="position:absolute;inset:0;z-index:${zs.card};${hideFrame}"></div>
  <div class="physics-sub-text" style="position:relative;z-index:${zs.text};${hideText}">${inner}</div>
</div>`
}

function buildFullscreenCaptionSplit(
  colorInline: string,
  titlePart: string,
  narrationPart: string,
  zs: Record<PhysicsSublayerKey, number>,
  hd: Record<PhysicsSublayerKey, boolean>,
): string {
  const hideFrame = hd.card ? 'display:none;' : ''
  const hideText = hd.text ? 'display:none;' : ''
  const zWrap = Math.max(zs.card, zs.text)
  const color = colorInline ? `${colorInline};` : ''
  return `<div id="physics-explain-card-root" class="caption-overlay physics-caption-split" style="${color}z-index:${zWrap};">
  <div class="physics-sub-card-frame physics-caption-frame" style="position:absolute;inset:0;z-index:${zs.card};border-radius:inherit;${hideFrame}"></div>
  <div class="physics-sub-text physics-caption-text" style="position:relative;z-index:${zs.text};${hideText}">${titlePart}${narrationPart}</div>
</div>`
}

type CardPreset = { bg: string; border: string; shadow: string; text: string; blur: number }
const CARD_PRESETS: Record<string, CardPreset> = {
  glass_dark: {
    bg: 'rgba(8,12,22,0.72)',
    border: 'rgba(255,255,255,0.18)',
    shadow: '0 14px 45px rgba(0,0,0,0.28)',
    text: '#ffffff',
    blur: 3,
  },
  glass_light: {
    bg: 'rgba(255,255,255,0.78)',
    border: 'rgba(0,0,0,0.12)',
    shadow: '0 14px 45px rgba(0,0,0,0.2)',
    text: '#0f172a',
    blur: 3,
  },
  neon: {
    bg: 'rgba(5,10,30,0.8)',
    border: 'rgba(56,189,248,0.55)',
    shadow: '0 0 0 1px rgba(56,189,248,0.4), 0 14px 45px rgba(56,189,248,0.24)',
    text: '#dbeafe',
    blur: 2,
  },
  chalk: {
    bg: 'rgba(22,25,35,0.86)',
    border: 'rgba(203,213,225,0.35)',
    shadow: '0 10px 30px rgba(0,0,0,0.35)',
    text: '#e2e8f0',
    blur: 1,
  },
}

export function compilePhysicsSceneFromLayers(
  sceneId: string,
  layer: PhysicsLayer,
): { sceneHTML: string; sceneCode: string } {
  const canvasId = `physics-canvas-${sceneId.slice(0, 8)}`
  const canvasW = 1920
  const canvasH = 1080
  const title = esc(layer.title || '')
  const narration = esc(layer.narration || '')
  const equations = Array.isArray(layer.equations) ? layer.equations.filter(Boolean) : []
  const equationHTML = equations.map((key) => `<div class="equation-block" id="eq-${key}"></div>`).join('\n')
  const titleColor = safeCssColor((layer.params as any)?.ui_titleColor)
  const bodyColor = safeCssColor((layer.params as any)?.ui_bodyColor)
  const titleStyle = titleColor ? ` style="color:${titleColor}"` : ''
  const narrStyle = bodyColor ? ` style="color:${bodyColor}"` : ''
  const titleHTML = title ? `<div class="scene-title"${titleStyle}>${title}</div>` : ''
  const narrationHTML = narration ? `<div class="narration-text"${narrStyle}>${narration}</div>` : ''
  const simScale = Math.max(
    0.35,
    Math.min(1.2, num((layer.params as any)?.ui_simScale, layer.layout === 'fullscreen' ? 1 : 0.82)),
  )
  let cardX = Math.max(0, Math.min(100, num((layer.params as any)?.ui_cardX, 74)))
  let cardY = Math.max(
    0,
    Math.min(100, num((layer.params as any)?.ui_cardY, layer.layout === 'equation_focus' ? 52 : 50)),
  )
  const cardWidth = Math.max(16, Math.min(55, num((layer.params as any)?.ui_cardWidth, 30)))
  const presetKey = String((layer.params as any)?.ui_cardPreset || 'glass_dark')
  const preset = CARD_PRESETS[presetKey] || CARD_PRESETS.glass_dark
  const cardOpacity = Math.max(0.2, Math.min(1, num((layer.params as any)?.ui_cardOpacity, 1)))
  const cardBlur = Math.max(0, Math.min(18, num((layer.params as any)?.ui_cardBlur, preset.blur)))
  const cardRadius = Math.max(0, Math.min(40, num((layer.params as any)?.ui_cardRadius, 14)))
  const cardPadding = Math.max(8, Math.min(56, num((layer.params as any)?.ui_cardPadding, 22)))
  const cardShadow = String((layer.params as any)?.ui_cardShadow || preset.shadow)
  const cardBg = String((layer.params as any)?.ui_cardBg || preset.bg)
  const cardBorder = String((layer.params as any)?.ui_cardBorder || preset.border)
  const cardText = String((layer.params as any)?.ui_cardText || preset.text)
  const textAlign =
    String((layer.params as any)?.ui_textAlign || (layer.layout === 'equation_focus' ? 'center' : 'left')) === 'center'
      ? 'center'
      : 'left'
  const titleSize = Math.max(16, Math.min(84, num((layer.params as any)?.ui_titleSize, 42)))
  const bodySize = Math.max(12, Math.min(54, num((layer.params as any)?.ui_bodySize, 26)))
  const equationSize = Math.max(14, Math.min(88, num((layer.params as any)?.ui_equationSize, 32)))
  const halfW = cardWidth / 2
  cardX = Math.max(halfW + 1, Math.min(99 - halfW, cardX))
  cardY = Math.max(8, Math.min(92, cardY))
  const cardStyle = [
    `left:${cardX}%`,
    `top:${cardY}%`,
    `width:${cardWidth}%`,
    `--card-bg:${cardBg}`,
    `--card-border:${cardBorder}`,
    `--card-shadow:${cardShadow}`,
    `--card-text:${cardText}`,
    `--card-blur:${cardBlur}px`,
    `--card-radius:${cardRadius}px`,
    `--card-padding:${cardPadding}px`,
    `--card-opacity:${cardOpacity}`,
    `--card-title-size:${titleSize}px`,
    `--card-body-size:${bodySize}px`,
    `--card-equation-size:${equationSize}px`,
    `--card-text-align:${textAlign}`,
  ].join(';')

  const pr = (layer.params || {}) as Record<string, unknown>
  const subOrder = parsePhysicsSubOrder(pr)
  const zs = physicsSubZByOrder(subOrder)
  const subHidden = parsePhysicsSubHidden(pr)

  const zCap = Math.max(zs.card, zs.text)
  const zCanvasFs = Math.max(1, Math.min(50, Math.round((zs.background + zCap) / 2)))

  let sceneHTML = ''
  if (layer.layout === 'split') {
    sceneHTML = `<div class="physics-layout-overlay">
  ${buildExplainCardSplit(cardStyle, '', titleHTML, equationHTML, narrationHTML, zs, subHidden, canvasId, canvasW, canvasH, simScale)}
</div>`
  } else if (layer.layout === 'equation_focus') {
    sceneHTML = `<div class="physics-layout-overlay equation-focus">
  ${buildExplainCardSplit(cardStyle, ' center-card', titleHTML, equationHTML, narrationHTML, zs, subHidden, canvasId, canvasW, canvasH, simScale)}
</div>`
  } else {
    const colorInline = bodyColor ? `color:${bodyColor}` : ''
    const strongOpen = title ? (titleColor ? `<strong style="color:${titleColor}">` : '<strong>') : ''
    const strongClose = title ? '</strong><br>' : ''
    const titlePart = title ? strongOpen + title + strongClose : ''
    const narrationPart = narration || ''
    const capBlock =
      title || narration ? buildFullscreenCaptionSplit(colorInline, titlePart, narrationPart, zs, subHidden) : ''
    sceneHTML = `<div class="physics-layout-fullscreen">
  <canvas id="${canvasId}" width="${canvasW}" height="${canvasH}" style="--sim-scale:${simScale};position:relative;z-index:${zCanvasFs};"></canvas>
  ${capBlock}
</div>`
  }

  sceneHTML = wrapPhysicsScene(sceneHTML, (layer.params || {}) as Record<string, unknown>, canvasW, canvasH)

  const paramsJSON = JSON.stringify(layer.params || {})
  const equationKeys = JSON.stringify(equations)
  const simClass = SIM_CLASS_MAP[layer.simulation]
  const cardEnter = String(pr.ui_cardEnter ?? 'none')
  const cardExit = String(pr.ui_cardExit ?? 'none')
  const titleEnter = String(pr.ui_titleEnter ?? 'slideDown')
  const narrEnter = String(pr.ui_narrEnter ?? 'fade')
  const eqMode = String(pr.ui_equationEnter ?? 'stagger')
  const cardEnterDur = num(pr.ui_cardEnterDur, 0.55)
  const cardExitDur = num(pr.ui_cardExitDur, 0.45)
  const titleEnterDur = num(pr.ui_titleEnterDur, 0.5)
  const narrEnterDur = num(pr.ui_narrEnterDur, 0.8)
  const eqDur = num(pr.ui_equationEnterDur, 0.6)
  const eqStagger = num(pr.ui_equationStagger, 0.8)
  const cardEnterAt = num(pr.ui_cardEnterAt, 0.15)
  const titleEnterAt = num(pr.ui_titleEnterAt, 0.2)
  const narrEnterAt = num(pr.ui_narrEnterAt, 0.5)
  const eqStartAt = num(pr.ui_equationStartAt, 1)

  const registerSnippet = shouldRegisterPhysicsCard(layer)
    ? (() => {
        const payload = buildPhysicsCardElement(sceneId, layer, 0)
        const json = JSON.stringify(payload)
        return `
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (!window.__register) return;
      var el = document.getElementById('physics-explain-card-root');
      if (!el) return;
      var staticEl = ${json};
      function bodyScale() {
        var bodyStyle = document.body.style.transform || '';
        var m = bodyStyle.match(/scale\\(([^)]+)\\)/);
        if (m) return parseFloat(m[1]);
        return Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      }
      function measureBBox() {
        var r = el.getBoundingClientRect();
        var s = bodyScale();
        return { x: r.left / s, y: r.top / s, w: r.width / s, h: r.height / s };
      }
      staticEl.bbox = measureBBox();
      window.__register(staticEl);
      function syncBBox() {
        var u = window.__elements[staticEl.id];
        if (u) u.bbox = measureBBox();
      }
      window.addEventListener('resize', syncBBox);
      setTimeout(syncBBox, 100);
      setTimeout(syncBBox, 500);
      setTimeout(syncBBox, 1200);
      try {
        window.parent.postMessage({
          source: 'cench-scene',
          type: 'elements_list',
          elements: JSON.parse(JSON.stringify(window.__elements)),
        }, '*');
      } catch (err) {}
    }, 40);
  });`
      })()
    : ''

  const sceneCode = `
(function() {
  function physEnterFrom(mode) {
    var o = { opacity: 0 };
    if (mode === 'scale') o.scale = 0.94;
    else if (mode === 'slideUp') o.y = 40;
    else if (mode === 'slideDown') o.y = -18;
    else if (mode === 'slideLeft') o.x = 40;
    return o;
  }
  function physEnterTo(mode, dur, ease) {
    var o = { opacity: 1, duration: dur, ease: ease || 'power2.out' };
    if (mode === 'scale') o.scale = 1;
    if (mode === 'slideUp' || mode === 'slideDown') o.y = 0;
    if (mode === 'slideLeft') o.x = 0;
    return o;
  }
  function physExitTo(mode, dur) {
    var o = { duration: dur, ease: 'power2.in' };
    if (mode === 'fade' || mode === 'scale' || mode === 'slideUp' || mode === 'slideDown' || mode === 'slideLeft') o.opacity = 0;
    if (mode === 'scale') o.scale = 0.92;
    if (mode === 'slideUp') o.y = -28;
    if (mode === 'slideDown') o.y = 28;
    if (mode === 'slideLeft') o.x = -28;
    return o;
  }
  function physApplyEnter(el, mode, dur, at) {
    if (!el || !window.__tl || mode === 'none') return;
    if (mode === 'fade') {
      gsap.set(el, { opacity: 0 });
      window.__tl.to(el, { opacity: 1, duration: dur, ease: 'power2.out' }, at);
      return;
    }
    gsap.set(el, physEnterFrom(mode));
    window.__tl.to(el, physEnterTo(mode, dur), at);
  }
  function physApplyFadeEnter(el, dur, at) {
    if (!el || !window.__tl) return;
    gsap.set(el, { opacity: 0 });
    window.__tl.to(el, { opacity: 1, duration: dur, ease: 'power2.out' }, at);
  }

  var canvas = document.getElementById('${canvasId}');
  if (!canvas) return;
  var sim = new PhysicsSims.${simClass}(canvas, ${paramsJSON});
  sim.init();
  PhysicsSims.registerWithTimeline(sim, DURATION);
  var eqKeys = ${equationKeys};
  if (eqKeys.length > 0 && window.PhysicsEquations) {
    eqKeys.forEach(function(key) {
      var eq = window.PhysicsEquations[key];
      var el = document.getElementById('eq-' + key);
      if (eq && el) { el.textContent = '$$' + eq.latex + '$$'; }
    });
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(function(e) { console.warn('MathJax error:', e); });
    }
  }
  if (window.__tl) {
    var cardEl = document.querySelector('.physics-explain-card') || document.querySelector('.caption-overlay');
    var cardIn = ${JSON.stringify(cardEnter)};
    var cardOut = ${JSON.stringify(cardExit)};
    if (cardEl && cardIn === 'fade') physApplyFadeEnter(cardEl, ${cardEnterDur}, ${cardEnterAt});
    else if (cardEl && cardIn !== 'none') physApplyEnter(cardEl, cardIn, ${cardEnterDur}, ${cardEnterAt});

    if (cardEl && cardOut !== 'none') {
      var tExit = Math.max(0, DURATION - ${cardExitDur});
      window.__tl.to(cardEl, physExitTo(cardOut, ${cardExitDur}), tExit);
    }

    var eqM = ${JSON.stringify(eqMode)};
    if (eqM === 'none') {
      /* equations stay visible */
    } else if (eqM === 'fade') {
      document.querySelectorAll('.equation-block').forEach(function(el) {
        gsap.set(el, { opacity: 0 });
        window.__tl.to(el, { opacity: 1, y: 0, duration: ${eqDur}, ease: 'power2.out' }, ${eqStartAt});
      });
    } else {
      document.querySelectorAll('.equation-block').forEach(function(el, i) {
        gsap.set(el, { opacity: 0, y: 20 });
        window.__tl.to(el, { opacity: 1, y: 0, duration: ${eqDur}, ease: 'power2.out' }, ${eqStartAt} + i * ${eqStagger});
      });
    }

    var narr = document.querySelector('.narration-text');
    var nIn = ${JSON.stringify(narrEnter)};
    if (narr) {
      if (nIn === 'fade') physApplyFadeEnter(narr, ${narrEnterDur}, ${narrEnterAt});
      else if (nIn !== 'none') physApplyEnter(narr, nIn, ${narrEnterDur}, ${narrEnterAt});
    }

    var titleEl = document.querySelector('.scene-title');
    var titIn = ${JSON.stringify(titleEnter)};
    if (titleEl) {
      if (titIn === 'fade') physApplyFadeEnter(titleEl, ${titleEnterDur}, ${titleEnterAt});
      else if (titIn !== 'none') physApplyEnter(titleEl, titIn, ${titleEnterDur}, ${titleEnterAt});
    }
  }
  window.__physicsSim = sim;
${registerSnippet}
})();`

  return { sceneHTML, sceneCode }
}

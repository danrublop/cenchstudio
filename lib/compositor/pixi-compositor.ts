/**
 * Reusable Pixi.js compositor core.
 *
 * Shared between:
 * - Path 2 export engine (lib/export2/pixi-mp4.ts) — deterministic frame-by-frame
 * - Continuous preview (lib/compositor/pixi-preview.ts) — real-time RAF loop
 *
 * This module handles:
 * - Pixi app initialization with configurable resolution
 * - Scene iframe bridge (seek + capture for canvas2d/d3/three/motion/zdog)
 * - Layer setup (SVG, text, AI layers, video)
 * - Per-frame animation (text overlays, AI layers, camera motion)
 * - Video layer seeking
 *
 * It does NOT handle encoding, muxing, or audio — those are export-only concerns.
 */

import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type {
  SceneCompositorConfig,
  TextOverlayConfig,
  AiLayerConfig,
  SvgObjectConfig,
  CameraMoveConfig,
} from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

export function parseHexColor(hex: string): number {
  const h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return (r << 16) | (g << 8) | b
  }
  if (h.length >= 6) return parseInt(h.slice(0, 6), 16)
  return 0x000000
}

// ── Scene iframe bridge ──────────────────────────────────────────────────────

const BRIDGE_SCENE_TYPES = new Set(['canvas2d', 'd3', 'three', 'motion', 'zdog'])

export interface SceneBridge {
  seekAndCopy: (timeSec: number) => Promise<void>
  dispose: () => void
}

export async function createSceneBridge(
  config: SceneCompositorConfig,
  cameraContainer: Container,
  onLog?: (msg: string) => void,
): Promise<{ bridge: SceneBridge | null; sprite: Sprite | null; texture: Texture | null }> {
  const sceneType = config.sceneType ?? ''
  if (!BRIDGE_SCENE_TYPES.has(sceneType) || !config.sceneHTML) {
    return { bridge: null, sprite: null, texture: null }
  }

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-20000px'
  iframe.style.top = '0'
  iframe.style.width = `${config.width}px`
  iframe.style.height = `${config.height}px`
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  iframe.srcdoc = config.sceneHTML
  document.body.appendChild(iframe)

  // Wait for playback controller ready
  const timeout = sceneType === 'three' ? 10000 : 5000
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(`${sceneType} iframe ready timeout`))
    }, timeout)
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data
      if (!d || d.source !== 'cench-scene' || d.type !== 'ready') return
      if (config.sceneId && d.sceneId && d.sceneId !== config.sceneId) return
      cleanup()
      resolve()
    }
    const cleanup = () => {
      clearTimeout(timer)
      window.removeEventListener('message', onMsg)
    }
    window.addEventListener('message', onMsg)
  })

  const bridgeCanvas = document.createElement('canvas')
  bridgeCanvas.width = config.width
  bridgeCanvas.height = config.height
  const bridgeCtx = bridgeCanvas.getContext('2d')
  if (!bridgeCtx) return { bridge: null, sprite: null, texture: null }

  const texture = Texture.from(bridgeCanvas as unknown as CanvasImageSource)
  const sprite = new Sprite(texture)
  sprite.x = 0
  sprite.y = 0
  sprite.width = config.width
  sprite.height = config.height
  sprite.alpha = 1
  sprite.zIndex = 11
  cameraContainer.addChild(sprite)

  // ── Capture strategies ──

  const captureCanvas2d = (doc: Document): boolean => {
    const src = doc.getElementById('c') as HTMLCanvasElement | null
    if (!src || !bridgeCtx) return false
    bridgeCtx.drawImage(src, 0, 0, config.width, config.height)
    return true
  }

  const captureThree = (doc: Document): boolean => {
    const src = doc.querySelector('canvas') as HTMLCanvasElement | null
    if (!src || !bridgeCtx) return false
    bridgeCtx.drawImage(src, 0, 0, config.width, config.height)
    return true
  }

  const captureD3 = async (doc: Document): Promise<boolean> => {
    if (!bridgeCtx) return false
    const chartCanvas = doc.querySelector('#chart canvas') as HTMLCanvasElement | null
    if (chartCanvas) {
      bridgeCtx.drawImage(chartCanvas, 0, 0, config.width, config.height)
      return true
    }
    const chart = doc.getElementById('chart')
    if (!chart) return false
    const svg = chart.querySelector('svg')
    if (!svg) return captureDomViaForeignObject(doc)
    const svgClone = svg.cloneNode(true) as SVGSVGElement
    if (!svgClone.getAttribute('width')) svgClone.setAttribute('width', String(config.width))
    if (!svgClone.getAttribute('height')) svgClone.setAttribute('height', String(config.height))
    if (!svgClone.getAttribute('xmlns')) svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    inlineComputedStyles(svgClone, svg)
    const serialized = new XMLSerializer().serializeToString(svgClone)
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    return new Promise<boolean>((resolve) => {
      const img = new Image()
      img.onload = () => {
        bridgeCtx!.drawImage(img, 0, 0, config.width, config.height)
        URL.revokeObjectURL(url)
        resolve(true)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(false)
      }
      img.src = url
    })
  }

  const captureDomViaForeignObject = (doc: Document): Promise<boolean> => {
    if (!bridgeCtx) return Promise.resolve(false)
    const body = doc.body
    if (!body) return Promise.resolve(false)
    const clone = body.cloneNode(true) as HTMLElement
    inlineComputedStyles(clone, body)
    const styles = Array.from(doc.querySelectorAll('style'))
    const styleText = styles.map((s) => s.textContent ?? '').join('\n')
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    const escapedStyle = styleText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}">
  <defs><style type="text/css">${escapedStyle}</style></defs>
  <foreignObject width="${config.width}" height="${config.height}">
    ${new XMLSerializer().serializeToString(clone)}
  </foreignObject>
</svg>`
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    return new Promise<boolean>((resolve) => {
      const img = new Image()
      img.onload = () => {
        bridgeCtx!.drawImage(img, 0, 0, config.width, config.height)
        URL.revokeObjectURL(url)
        resolve(true)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(false)
      }
      img.src = url
    })
  }

  const inlineComputedStyles = (clone: Element, source: Element): void => {
    try {
      const srcDoc = source.ownerDocument
      if (!srcDoc?.defaultView) return
      const computed = srcDoc.defaultView.getComputedStyle(source)
      const el = clone as HTMLElement
      const props = [
        'color',
        'background-color',
        'background',
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'text-align',
        'opacity',
        'transform',
        'border',
        'border-radius',
        'padding',
        'margin',
        'display',
        'position',
        'top',
        'left',
        'right',
        'bottom',
        'width',
        'height',
        'max-width',
        'max-height',
        'overflow',
        'fill',
        'stroke',
        'stroke-width',
      ]
      for (const p of props) {
        const v = computed.getPropertyValue(p)
        if (v) el.style.setProperty(p, v)
      }
    } catch {}
    const srcChildren = Array.from(source.children)
    const cloneChildren = Array.from(clone.children)
    for (let i = 0; i < cloneChildren.length && i < srcChildren.length; i++) {
      inlineComputedStyles(cloneChildren[i], srcChildren[i])
    }
  }

  // ── Seek + capture ──

  const seekAndCopy = async (timeSec: number) => {
    await new Promise<void>((resolve) => {
      const onAck = (ev: MessageEvent) => {
        const d = ev.data
        if (!d || d.source !== 'cench-scene' || d.type !== 'seeked') return
        if (config.sceneId && d.sceneId && d.sceneId !== config.sceneId) return
        window.removeEventListener('message', onAck)
        resolve()
      }
      window.addEventListener('message', onAck)
      iframe.contentWindow?.postMessage(
        { target: 'cench-scene', sceneId: config.sceneId ?? null, type: 'seek', time: timeSec },
        '*',
      )
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.removeEventListener('message', onAck)
          resolve()
        }),
      )
    })

    const doc = iframe.contentDocument
    if (!doc || !bridgeCtx || !texture) return
    bridgeCtx.clearRect(0, 0, config.width, config.height)
    const bodyBg = doc.defaultView?.getComputedStyle(doc.body)?.backgroundColor
    if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)') {
      bridgeCtx.fillStyle = bodyBg
      bridgeCtx.fillRect(0, 0, config.width, config.height)
    }
    switch (sceneType) {
      case 'canvas2d':
        captureCanvas2d(doc)
        break
      case 'three':
      case 'zdog':
        captureThree(doc)
        break
      case 'd3':
        await captureD3(doc)
        break
      case 'motion':
        await captureDomViaForeignObject(doc)
        break
    }
    texture.update()
  }

  const dispose = () => {
    try {
      iframe.remove()
    } catch {}
  }

  onLog?.(`scene bridge initialized for type: ${sceneType}`)
  return { bridge: { seekAndCopy, dispose }, sprite, texture }
}

// ── Camera motion ────────────────────────────────────────────────────────────

export function getCameraState(
  tSec: number,
  moves: CameraMoveConfig[],
  width: number,
  height: number,
): { scale: number; x: number; y: number } {
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k
  let state = { scale: 1, xPercent: 0, yPercent: 0 }

  for (const move of moves) {
    const p = move.params ?? {}
    const at = Number(p.at ?? 0)
    const duration = Math.max(0.001, Number(p.duration ?? 1))
    if (tSec < at) continue
    const u = Math.max(0, Math.min(1, (tSec - at) / duration))

    if (move.type === 'kenBurns') {
      state = {
        scale: lerp(Number(p.startScale ?? state.scale ?? 1), Number(p.endScale ?? 1.08), u),
        xPercent: lerp(Number(p.startX ?? state.xPercent ?? 0), Number(p.endX ?? -1.5), u),
        yPercent: lerp(Number(p.startY ?? state.yPercent ?? 0), Number(p.endY ?? -0.8), u),
      }
    } else if (move.type === 'pan') {
      state = {
        scale: state.scale,
        xPercent: lerp(Number(p.fromX ?? state.xPercent ?? 0), Number(p.toX ?? p.endX ?? -5), u),
        yPercent: lerp(Number(p.fromY ?? state.yPercent ?? 0), Number(p.toY ?? p.endY ?? 0), u),
      }
    } else if (move.type === 'dollyIn') {
      state = {
        scale: lerp(Number(p.fromScale ?? state.scale ?? 1), Number(p.toScale ?? 1.12), u),
        xPercent: lerp(Number(p.fromX ?? state.xPercent ?? 0), Number(p.toX ?? p.endX ?? 0), u),
        yPercent: lerp(Number(p.fromY ?? state.yPercent ?? 0), Number(p.toY ?? p.endY ?? 0), u),
      }
    } else if (move.type === 'dollyOut') {
      state = {
        scale: lerp(Number(p.fromScale ?? state.scale ?? 1.12), Number(p.toScale ?? 1), u),
        xPercent: lerp(Number(p.fromX ?? state.xPercent ?? 0), Number(p.toX ?? p.endX ?? 0), u),
        yPercent: lerp(Number(p.fromY ?? state.yPercent ?? 0), Number(p.toY ?? p.endY ?? 0), u),
      }
    } else if (move.type === 'cut') {
      state = {
        scale: Number(p.scale ?? state.scale ?? 1),
        xPercent: Number(p.xPercent ?? p.toX ?? p.endX ?? state.xPercent ?? 0),
        yPercent: Number(p.yPercent ?? p.toY ?? p.endY ?? state.yPercent ?? 0),
      }
    } else if (move.type === 'reset') {
      state = { scale: 1, xPercent: 0, yPercent: 0 }
    }
  }

  return { scale: state.scale, x: (state.xPercent / 100) * width, y: (state.yPercent / 100) * height }
}

// ── AI layer animation ───────────────────────────────────────────────────────

export function applyAiLayerAnimation(
  sprite: Sprite,
  layer: AiLayerConfig,
  tSec: number,
  baseX: number,
  baseY: number,
) {
  const startAt = Math.max(0, Number(layer.startAt ?? 0))
  const anim = layer.animation
  if (!anim || anim.type === 'none') {
    if (tSec < startAt) {
      sprite.alpha = 0
      return
    }
    sprite.alpha = Math.max(0, Math.min(1, Number(layer.opacity ?? 1)))
    sprite.position.set(baseX, baseY)
    return
  }
  const animDelay = Number(anim.delay ?? 0)
  const animDur = Math.max(0.01, Number(anim.duration ?? 0.5))
  const animStart = startAt + animDelay
  if (tSec < animStart) {
    sprite.alpha = 0
    return
  }
  const raw = (tSec - animStart) / animDur
  const p = Math.max(0, Math.min(1, raw))
  const baseAlpha = Math.max(0, Math.min(1, Number(layer.opacity ?? 1)))

  switch (anim.type) {
    case 'fade-in':
      sprite.alpha = baseAlpha * p
      sprite.position.set(baseX, baseY)
      break
    case 'fade-out':
      sprite.alpha = baseAlpha * (1 - p)
      sprite.position.set(baseX, baseY)
      break
    case 'slide-left':
      sprite.alpha = baseAlpha
      sprite.position.set(baseX + 200 * (1 - p), baseY)
      break
    case 'slide-right':
      sprite.alpha = baseAlpha
      sprite.position.set(baseX - 200 * (1 - p), baseY)
      break
    case 'slide-up':
      sprite.alpha = baseAlpha
      sprite.position.set(baseX, baseY + 200 * (1 - p))
      break
    case 'slide-down':
      sprite.alpha = baseAlpha
      sprite.position.set(baseX, baseY - 200 * (1 - p))
      break
    case 'scale-in': {
      const s = 0.3 + 0.7 * p
      sprite.alpha = baseAlpha * p
      sprite.scale.set(s * (layer.width / sprite.texture.width), s * (layer.height / sprite.texture.height))
      sprite.position.set(baseX, baseY)
      break
    }
    case 'scale-out': {
      const s = 1 - 0.7 * p
      sprite.alpha = baseAlpha * (1 - p)
      sprite.scale.set(s * (layer.width / sprite.texture.width), s * (layer.height / sprite.texture.height))
      sprite.position.set(baseX, baseY)
      break
    }
    case 'spin-in': {
      const s = 0.3 + 0.7 * p
      sprite.alpha = baseAlpha * p
      sprite.rotation = (1 - p) * Math.PI * 2
      sprite.scale.set(s * (layer.width / sprite.texture.width), s * (layer.height / sprite.texture.height))
      sprite.position.set(baseX, baseY)
      break
    }
    default:
      sprite.alpha = baseAlpha
      sprite.position.set(baseX, baseY)
  }
}

// ── Text overlay animation ───────────────────────────────────────────────────

export function applyTextAnimation(sprite: Text, overlay: TextOverlayConfig, tSec: number, fullContent: string) {
  const start = Math.max(0, Number(overlay.delay || 0))
  const end = start + Math.max(0.01, Number(overlay.duration || 1))
  if (tSec < start) {
    sprite.alpha = 0
    return
  }
  if (tSec > end) {
    sprite.alpha = 1
    sprite.text = fullContent
    return
  }
  const p = (tSec - start) / (end - start)
  switch (overlay.animation) {
    case 'fade-in':
      sprite.alpha = p
      break
    case 'slide-up':
      sprite.alpha = Math.min(1, p * 2)
      sprite.y = (overlay.y / 100) * 1080 + 40 * (1 - p)
      break
    case 'typewriter':
      sprite.alpha = 1
      sprite.text = fullContent.slice(0, Math.max(1, Math.round(fullContent.length * p)))
      break
    default:
      sprite.alpha = 1
  }
}

import type { PhysicsLayer } from '../types'
import type { PhysicsCardElement } from '../types/elements'

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

/** DOM / fullscreen caption exists */
export function shouldRegisterPhysicsCard(layer: PhysicsLayer): boolean {
  if (layer.layout === 'fullscreen' && !layer.title?.trim() && !layer.narration?.trim()) return false
  return true
}

export function physicsCanvasIdForScene(sceneId: string): string {
  return `physics-canvas-${sceneId.slice(0, 8)}`
}

/** Maps inspector property keys to physics layer `params` keys */
export const PHYSICS_CARD_PROP_TO_UI: Record<string, string> = {
  cardX: 'ui_cardX',
  cardY: 'ui_cardY',
  cardWidth: 'ui_cardWidth',
  cardPreset: 'ui_cardPreset',
  cardOpacity: 'ui_cardOpacity',
  cardBlur: 'ui_cardBlur',
  cardRadius: 'ui_cardRadius',
  cardPadding: 'ui_cardPadding',
  cardBg: 'ui_cardBg',
  cardBorder: 'ui_cardBorder',
  cardShadow: 'ui_cardShadow',
  cardText: 'ui_cardText',
  titleColor: 'ui_titleColor',
  bodyColor: 'ui_bodyColor',
  textAlign: 'ui_textAlign',
  titleSize: 'ui_titleSize',
  bodySize: 'ui_bodySize',
  equationSize: 'ui_equationSize',
  simScale: 'ui_simScale',
}

export function buildPhysicsCardElement(sceneId: string, layer: PhysicsLayer, layerIndex: number): PhysicsCardElement {
  const pr = (layer.params || {}) as Record<string, unknown>
  const presetKey = String(pr.ui_cardPreset || 'glass_dark')
  const cardWidth = Math.max(16, Math.min(55, num(pr.ui_cardWidth, 30)))
  let cardX = Math.max(0, Math.min(100, num(pr.ui_cardX, 74)))
  let cardY = Math.max(0, Math.min(100, num(pr.ui_cardY, layer.layout === 'equation_focus' ? 52 : 50)))
  const halfW = cardWidth / 2
  cardX = Math.max(halfW + 1, Math.min(99 - halfW, cardX))
  cardY = Math.max(8, Math.min(92, cardY))
  const subHidden = (pr.ui_physicsSublayerHidden || {}) as Record<string, boolean>
  const canvasId = physicsCanvasIdForScene(sceneId)

  return {
    id: `physics-card-${layerIndex}`,
    type: 'physics-card',
    label: 'Explain card',
    visible: !subHidden.card,
    opacity: Math.max(0.2, Math.min(1, num(pr.ui_cardOpacity, 1))),
    animStartTime: 0,
    animDuration: 0,
    bbox: { x: 0, y: 0, w: 192, h: 108 },
    physicsLayerIndex: layerIndex,
    canvasId,
    cardX,
    cardY,
    cardWidth,
    cardPreset: presetKey,
    cardBlur: Math.max(0, Math.min(18, num(pr.ui_cardBlur, 3))),
    cardRadius: Math.max(0, Math.min(40, num(pr.ui_cardRadius, 14))),
    cardPadding: Math.max(8, Math.min(56, num(pr.ui_cardPadding, 22))),
    cardBg: String(pr.ui_cardBg || ''),
    cardBorder: String(pr.ui_cardBorder || ''),
    cardShadow: String(pr.ui_cardShadow || ''),
    cardText: String(pr.ui_cardText || ''),
    titleColor: safeCssColor(pr.ui_titleColor) || '',
    bodyColor: safeCssColor(pr.ui_bodyColor) || '',
    textAlign:
      String(pr.ui_textAlign || (layer.layout === 'equation_focus' ? 'center' : 'left')) === 'center'
        ? 'center'
        : 'left',
    titleSize: Math.max(16, Math.min(84, num(pr.ui_titleSize, 42))),
    bodySize: Math.max(12, Math.min(54, num(pr.ui_bodySize, 26))),
    equationSize: Math.max(14, Math.min(88, num(pr.ui_equationSize, 32))),
    simScale: Math.max(0.35, Math.min(1.2, num(pr.ui_simScale, layer.layout === 'fullscreen' ? 1 : 0.82))),
  }
}

export function applyPhysicsCardInspectorPatch(layer: PhysicsLayer, property: string, value: unknown): PhysicsLayer {
  const params = { ...(layer.params || {}) } as Record<string, unknown>
  const subHidden = { ...((params.ui_physicsSublayerHidden || {}) as Record<string, boolean>) }

  if (property === 'visible') {
    if (value === false) subHidden.card = true
    else subHidden.card = false
    params.ui_physicsSublayerHidden = subHidden
  } else if (property === 'opacity') {
    params.ui_cardOpacity = Math.max(0.2, Math.min(1, Number(value)))
  } else {
    const uiKey = PHYSICS_CARD_PROP_TO_UI[property]
    if (uiKey) {
      const clearable =
        uiKey === 'ui_cardBg' ||
        uiKey === 'ui_cardBorder' ||
        uiKey === 'ui_cardText' ||
        uiKey === 'ui_titleColor' ||
        uiKey === 'ui_bodyColor' ||
        uiKey === 'ui_cardShadow'
      if (clearable && (value === null || value === 'none' || value === '')) {
        delete params[uiKey]
      } else {
        params[uiKey] = value
      }
    }
  }

  return { ...layer, params }
}

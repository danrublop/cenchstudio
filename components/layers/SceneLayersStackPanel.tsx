'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Atom,
  BarChart3,
  Box,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  Code2,
  Eye,
  EyeOff,
  Film,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  MousePointerClick,
  Music,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Type,
  User,
  Volume2,
} from 'lucide-react'
import { BG_STAGE_STACK_KEY, type LayerStackKey, parseLayerStackKey, pinLayerStackTail } from '@/lib/layer-stack-keys'
import { useVideoStore } from '@/lib/store'
import type { AILayer, AudioLayer, D3ChartLayer, InteractionElement, PhysicsLayer, Scene, SceneType } from '@/lib/types'
import { createDefaultInteraction, InteractionTextBulkForm } from '@/components/tabs/InteractTab'
import { compileD3SceneFromLayers } from '@/lib/charts/compile'
import { deriveChartLayersFromScene } from '@/lib/charts/extract'
import {
  compilePhysicsSceneFromLayers,
  DEFAULT_PHYSICS_SUBLAYER_ORDER,
  parsePhysicsSubHidden,
  parsePhysicsSubOrder,
  type PhysicsSublayerKey,
} from '@/lib/physics/compile'
import {
  chartLayerTitleLine,
  layerHiddenIdForTextSlot,
  listSvgTextElementsInMarkup,
  MAIN_SCENE_SVG_LAYER_ID,
  svgMarkupLikelyHasTextElements,
} from '@/lib/text-slots'

const LAYER_STACK_BODY_H_KEY = 'cench.layerStack.bodyHeight.v1'
const LAYER_STACK_H_MIN = 100
const LAYER_STACK_H_MAX = 560
const LAYER_STACK_H_DEFAULT = 280

function clampStackBodyHeight(px: number): number {
  return Math.max(LAYER_STACK_H_MIN, Math.min(LAYER_STACK_H_MAX, Math.round(px)))
}

function readStackBodyHeight(): number {
  if (typeof window === 'undefined') return LAYER_STACK_H_DEFAULT
  try {
    const raw = localStorage.getItem(LAYER_STACK_BODY_H_KEY)
    if (raw) {
      const n = parseInt(raw, 10)
      if (Number.isFinite(n)) return clampStackBodyHeight(n)
    }
  } catch {
    /* ignore */
  }
  return LAYER_STACK_H_DEFAULT
}

const PHYS_SUB_LABEL: Record<PhysicsSublayerKey, string> = {
  background: 'Background',
  card: 'Card',
  text: 'Text',
}

const PHYS_SUB_ICON: Record<PhysicsSublayerKey, typeof ImageIcon> = {
  background: ImageIcon,
  card: LayoutTemplate,
  text: Type,
}

type StackKey = LayerStackKey
const parseKey = parseLayerStackKey

/** Timeline “base” renderers — one stack row each (plus canvas background when used as a separate lane). */
const SCENE_RENDERER_STACK_TYPES: readonly SceneType[] = [
  'canvas2d',
  'motion',
  'd3',
  'three',
  'lottie',
  'zdog',
  'avatar_scene',
  '3d_world',
] as const

function pushSceneRendererStackKeys(scene: Scene, keys: StackKey[]) {
  const st = (scene.sceneType ?? 'svg') as SceneType
  if ((SCENE_RENDERER_STACK_TYPES as readonly string[]).includes(st)) {
    keys.push(`scene:${st}` as StackKey)
  }
  if (scene.canvasBackgroundCode?.trim() && st !== 'canvas2d') {
    keys.push('scene:canvas_bg' as StackKey)
  }
}

function audioRowVisible(a: AudioLayer): boolean {
  return a.enabled || !!a.tts?.text?.trim?.() || (a.sfx?.length ?? 0) > 0 || !!a.music
}

function buildDefaultOrder(scene: Scene): StackKey[] {
  const keys: StackKey[] = []
  const ai = [...(scene.aiLayers ?? [])].sort((x, y) => y.zIndex - x.zIndex)
  ai.forEach((l) => keys.push(`ai:${l.id}` as StackKey))
  const svg = [...(scene.svgObjects ?? [])].sort((x, y) => y.zIndex - x.zIndex)
  svg.forEach((o) => keys.push(`svg:${o.id}` as StackKey))
  const mainSvg = scene.svgContent?.trim() ?? ''
  if (mainSvg && svgMarkupLikelyHasTextElements(mainSvg)) {
    keys.push(`svg:${MAIN_SCENE_SVG_LAYER_ID}` as StackKey)
  }
  ;(scene.textOverlays ?? []).forEach((t) => keys.push(`text:${t.id}` as StackKey))
  deriveChartLayersFromScene(scene).forEach((c) => keys.push(`chart:${c.id}` as StackKey))
  pushSceneRendererStackKeys(scene, keys)
  ;(scene.physicsLayers ?? []).forEach((p) => keys.push(`physics:${p.id}` as StackKey))
  ;(scene.interactions ?? []).forEach((it) => keys.push(`interaction:${it.id}` as StackKey))
  keys.push(BG_STAGE_STACK_KEY)
  if (scene.videoLayer?.enabled && scene.videoLayer.src) keys.push('video')
  if (audioRowVisible(scene.audioLayer)) keys.push('audio')
  return keys
}

function mergeOrder(custom: string[] | undefined, fallback: StackKey[]): StackKey[] {
  const valid = new Set(fallback)
  const out: StackKey[] = []
  if (custom?.length) {
    for (const k of custom) {
      if (valid.has(k as StackKey)) out.push(k as StackKey)
    }
  }
  for (const k of fallback) {
    if (!out.includes(k)) out.push(k)
  }
  return pinLayerStackTail(out)
}

function labelForKey(scene: Scene, key: StackKey): string {
  const { kind, id } = parseKey(key)
  if (kind === 'bg' && id === 'stage') return 'Background'
  if (kind === 'video') return 'Video'
  if (kind === 'audio') return 'Audio'
  if (kind === 'ai' && id) {
    const l = (scene.aiLayers ?? []).find((x) => x.id === id)
    return l?.label ?? 'AI layer'
  }
  if (kind === 'svg' && id) {
    if (id === MAIN_SCENE_SVG_LAYER_ID) return 'Scene SVG'
    const o = (scene.svgObjects ?? []).find((x) => x.id === id)
    const p = (o?.prompt ?? '').trim()
    return p ? p.slice(0, 28) + (p.length > 28 ? '…' : '') : 'SVG object'
  }
  if (kind === 'text' && id) {
    const t = (scene.textOverlays ?? []).find((x) => x.id === id)
    const c = (t?.content ?? '').trim()
    return c ? c.slice(0, 28) + (c.length > 28 ? '…' : '') : 'Text'
  }
  if (kind === 'chart' && id) {
    const c = deriveChartLayersFromScene(scene).find((x) => x.id === id)
    return c?.name ?? 'Chart'
  }
  if (kind === 'physics' && id) {
    const p = (scene.physicsLayers ?? []).find((x) => x.id === id)
    return p?.name ?? 'Physics'
  }
  if (kind === 'interaction' && id) {
    const ix = (scene.interactions ?? []).find((x) => x.id === id)
    if (!ix) return 'Interaction'
    const preview =
      ix.type === 'hotspot'
        ? (ix as InteractionElement & { type: 'hotspot' }).label
        : ix.type === 'gate'
          ? (ix as InteractionElement & { type: 'gate' }).buttonLabel
          : ix.type === 'tooltip'
            ? (ix as InteractionElement & { type: 'tooltip' }).tooltipTitle
            : ix.type === 'choice'
              ? ((ix as InteractionElement & { type: 'choice' }).question ?? '').slice(0, 24)
              : ix.type === 'quiz'
                ? (ix as InteractionElement & { type: 'quiz' }).question.slice(0, 24)
                : ix.type === 'form'
                  ? (ix as InteractionElement & { type: 'form' }).submitLabel
                  : ''
    const tail = preview ? ` · ${preview.slice(0, 22)}${preview.length > 22 ? '…' : ''}` : ''
    return `${ix.type}${tail}`
  }
  if (kind === 'scene' && id) {
    const labels: Record<string, string> = {
      canvas2d: 'Canvas 2D',
      motion: 'Motion',
      d3: 'D3 scene',
      three: 'Three.js',
      lottie: 'Lottie',
      zdog: 'Zdog',
      avatar_scene: 'Avatar scene',
      '3d_world': '3D world',
      canvas_bg: 'Canvas background',
    }
    return labels[id] ?? id
  }
  return kind
}

function iconForSceneStackId(id: string) {
  switch (id) {
    case 'canvas2d':
      return Code2
    case 'motion':
      return Activity
    case 'd3':
      return BarChart3
    case 'three':
      return Box
    case 'lottie':
      return Clapperboard
    case 'zdog':
      return Sparkles
    case 'avatar_scene':
      return User
    case '3d_world':
      return Globe
    case 'canvas_bg':
      return LayoutTemplate
    default:
      return Layers
  }
}

function isAvatarLayer(l: AILayer | undefined): boolean {
  return l?.type === 'avatar'
}

/** Content to show under Video / first Avatar when scene has mixable audio tracks */
function sceneHasAudioStackDetails(scene: Scene): boolean {
  const a = scene.audioLayer
  if (!a) return false
  return !!(
    (a.tts?.text ?? '').trim() ||
    a.tts?.status === 'generating' ||
    a.tts?.status === 'pending' ||
    (a.src && String(a.src).length > 0) ||
    (a.music?.src && String(a.music.src).length > 0) ||
    (a.sfx?.length ?? 0) > 0
  )
}

function AudioStackSubRows({ scene, onOpenAudio }: { scene: Scene; onOpenAudio: () => void }) {
  const a = scene.audioLayer
  const rows: { id: string; Icon: typeof Volume2; label: string }[] = []
  if ((a.tts?.text ?? '').trim() || a.tts?.status === 'generating' || a.tts?.status === 'pending') {
    const t = (a.tts?.text ?? '').trim()
    const preview = t ? `${t.slice(0, 40)}${t.length > 40 ? '…' : ''}` : 'Voice / TTS'
    rows.push({ id: 'sub-tts', Icon: Volume2, label: `Narration · ${preview}` })
  }
  if (a.src && String(a.src).length > 0) {
    rows.push({ id: 'sub-src', Icon: Music, label: 'Audio file' })
  }
  if (a.music?.src && String(a.music.src).length > 0) {
    const name = (a.music.name ?? '').trim()
    rows.push({
      id: 'sub-music',
      Icon: Music,
      label: name ? `Music · ${name.slice(0, 32)}${name.length > 32 ? '…' : ''}` : 'Music',
    })
  }
  const nSfx = a.sfx?.length ?? 0
  if (nSfx > 0) {
    rows.push({ id: 'sub-sfx', Icon: Volume2, label: `Sound effects · ${nSfx}` })
  }
  if (rows.length === 0) return null
  return (
    <ul className="mt-0.5 space-y-0.5 border-l ml-2 pl-1" style={{ borderLeftColor: 'var(--color-hairline)' }}>
      {rows.map((r) => (
        <li key={r.id}>
          <div
            role="button"
            tabIndex={0}
            className="flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[11px] hover:bg-white/[0.04]"
            onClick={(e) => {
              e.stopPropagation()
              onOpenAudio()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenAudio()
              }
            }}
            title="Open Audio in Layers"
          >
            <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)]"
              aria-hidden
            >
              <r.Icon size={11} strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{r.label}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function iconForKey(scene: Scene, key: StackKey) {
  const { kind, id } = parseKey(key)
  if (kind === 'bg' && id === 'stage') return Palette
  if (kind === 'ai' && id) {
    const l = (scene.aiLayers ?? []).find((x) => x.id === id)
    if (isAvatarLayer(l)) return User
  }
  if (kind === 'scene' && id) return iconForSceneStackId(id)
  switch (kind) {
    case 'video':
      return Film
    case 'audio':
      return Music
    case 'ai':
      return Sparkles
    case 'svg':
      return Layers
    case 'text':
      return Type
    case 'chart':
      return BarChart3
    case 'physics':
      return Atom
    case 'interaction':
      return MousePointerClick
    default:
      return Layers
  }
}

interface Props {
  scene: Scene
}

type LayerStackRowsProps = {
  scene: Scene
  selectedKey: StackKey | null
  /** Toggle: same row again clears selection for this scene */
  onToggleRow: (key: StackKey) => void
  /** Double-click row → Layers → Properties tab */
  onOpenLayerProperties?: (key: StackKey) => void
}

function ChartTitleStackSubRow({
  rowId,
  chartLayer,
  hiddenSet,
  openTextTabForSlot,
  onToggleSlotHidden,
}: {
  rowId: string
  chartLayer: D3ChartLayer
  hiddenSet: Set<string>
  openTextTabForSlot: (slotKey: string) => void
  onToggleSlotHidden: (slotKey: string) => void
}) {
  const slotKey = `chart:${rowId}:title`
  const line = chartLayerTitleLine(chartLayer).slice(0, 48) || 'Title'
  const hid = layerHiddenIdForTextSlot(slotKey)
  const isTxHidden = hiddenSet.has(hid)
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[11px] hover:bg-white/[0.04]"
      onClick={() => openTextTabForSlot(slotKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openTextTabForSlot(slotKey)
        }
      }}
      title="Open in Text tab"
    >
      <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
      <button
        type="button"
        className="no-style flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        onClick={(e) => {
          e.stopPropagation()
          onToggleSlotHidden(slotKey)
        }}
        aria-label={isTxHidden ? 'Show layer' : 'Hide layer'}
      >
        {isTxHidden ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <Type size={11} className="shrink-0 text-[var(--color-text-muted)]" strokeWidth={2.25} />
      <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">Title · {line}</span>
    </div>
  )
}

function LayerStackRows({ scene, selectedKey, onToggleRow, onOpenLayerProperties }: LayerStackRowsProps) {
  const { updateScene, saveSceneHTML, openTextTabForSlot, openLayersSection } = useVideoStore()
  const [expandedPhysics, setExpandedPhysics] = useState<Record<string, boolean>>({})
  const [expandedSvgText, setExpandedSvgText] = useState<Record<string, boolean>>({})
  const [expandedChartTitle, setExpandedChartTitle] = useState<Record<string, boolean>>({})
  const [expandedVideoAudio, setExpandedVideoAudio] = useState(false)
  const [expandedAvatarAudio, setExpandedAvatarAudio] = useState<Record<string, boolean>>({})
  const [expandedInteractionText, setExpandedInteractionText] = useState<Record<string, boolean>>({})

  const patchPhysicsLayer = useCallback(
    (layerId: string, mapLayer: (l: PhysicsLayer) => PhysicsLayer) => {
      const layers = scene.physicsLayers ?? []
      const idx = layers.findIndex((p) => p.id === layerId)
      if (idx < 0) return
      const next = [...layers]
      next[idx] = mapLayer(layers[idx])
      const primary = next[0]
      const patch: Partial<Scene> = { physicsLayers: next, sceneType: 'physics' }
      if (primary) {
        const c = compilePhysicsSceneFromLayers(scene.id, primary)
        patch.sceneCode = c.sceneCode
        patch.sceneHTML = c.sceneHTML
      } else {
        patch.sceneCode = ''
        patch.sceneHTML = ''
      }
      updateScene(scene.id, patch)
      void saveSceneHTML(scene.id)
    },
    [scene.id, scene.physicsLayers, updateScene, saveSceneHTML],
  )

  const togglePhysicsSubHidden = useCallback(
    (layerId: string, sub: PhysicsSublayerKey) => {
      patchPhysicsLayer(layerId, (l) => {
        const h = { ...parsePhysicsSubHidden(l.params || {}) }
        h[sub] = !h[sub]
        return { ...l, params: { ...l.params, ui_physicsSublayerHidden: h } }
      })
    },
    [patchPhysicsLayer],
  )

  const movePhysicsSub = useCallback(
    (layerId: string, subIndex: number, dir: -1 | 1) => {
      patchPhysicsLayer(layerId, (l) => {
        const order = [...parsePhysicsSubOrder(l.params || {})]
        const j = subIndex + dir
        if (j < 0 || j >= order.length) return l
        ;[order[subIndex], order[j]] = [order[j], order[subIndex]]
        return { ...l, params: { ...l.params, ui_physicsSublayerOrder: order } }
      })
    },
    [patchPhysicsLayer],
  )

  const toggleSvgTextSlotHidden = useCallback(
    (slotKey: string) => {
      const k = layerHiddenIdForTextSlot(slotKey)
      const h = new Set(scene.layerHiddenIds ?? [])
      if (h.has(k)) h.delete(k)
      else h.add(k)
      updateScene(scene.id, { layerHiddenIds: Array.from(h) })
    },
    [scene.id, scene.layerHiddenIds, updateScene],
  )

  const toggleChartTitleSlotHidden = toggleSvgTextSlotHidden

  const fallbackOrder = useMemo(() => buildDefaultOrder(scene), [scene])
  const orderedKeys = useMemo(
    () => mergeOrder(scene.layerPanelOrder, fallbackOrder),
    [scene.layerPanelOrder, fallbackOrder],
  )

  const firstAvatarStackKey = useMemo(() => {
    for (const k of orderedKeys) {
      const { kind, id } = parseKey(k)
      if (kind !== 'ai' || !id) continue
      const l = (scene.aiLayers ?? []).find((x) => x.id === id)
      if (isAvatarLayer(l)) return k
    }
    return null
  }, [orderedKeys, scene.aiLayers])

  const hidden = useMemo(() => new Set(scene.layerHiddenIds ?? []), [scene.layerHiddenIds])

  const persistOrder = useCallback(
    (next: StackKey[]) => {
      updateScene(scene.id, { layerPanelOrder: [...next] })
    },
    [scene.id, updateScene],
  )

  const toggleHidden = useCallback(
    (key: StackKey) => {
      const h = new Set(scene.layerHiddenIds ?? [])
      if (h.has(key)) h.delete(key)
      else h.add(key)
      updateScene(scene.id, { layerHiddenIds: Array.from(h) })
    },
    [scene.id, scene.layerHiddenIds, updateScene],
  )

  const moveKey = useCallback(
    (index: number, dir: -1 | 1) => {
      const j = index + dir
      if (j < 0 || j >= orderedKeys.length) return
      if (orderedKeys[index] === 'audio' || orderedKeys[j] === 'audio') return
      if (orderedKeys[index] === BG_STAGE_STACK_KEY || orderedKeys[j] === BG_STAGE_STACK_KEY) return
      const next = [...orderedKeys]
      ;[next[index], next[j]] = [next[j], next[index]]
      persistOrder(pinLayerStackTail(next))
    },
    [orderedKeys, persistOrder],
  )

  const removeChartLayer = useCallback(
    (id: string) => {
      const next = deriveChartLayersFromScene(scene).filter((c) => c.id !== id)
      const compiled = compileD3SceneFromLayers(next)
      updateScene(scene.id, {
        sceneType: 'd3',
        chartLayers: next,
        sceneCode: compiled.sceneCode,
        d3Data: compiled.d3Data as any,
      })
      void saveSceneHTML(scene.id)
    },
    [scene, scene.id, updateScene, saveSceneHTML],
  )

  const removePhysicsLayer = useCallback(
    (id: string) => {
      const next = (scene.physicsLayers ?? []).filter((p) => p.id !== id)
      const primary = next[0]
      const patch: Partial<Scene> = { physicsLayers: next, sceneType: 'physics' }
      if (primary) {
        const compiled = compilePhysicsSceneFromLayers(scene.id, primary)
        patch.sceneCode = compiled.sceneCode
        patch.sceneHTML = compiled.sceneHTML
      } else {
        patch.sceneCode = ''
        patch.sceneHTML = ''
      }
      updateScene(scene.id, patch)
      void saveSceneHTML(scene.id)
    },
    [scene.physicsLayers, scene.id, updateScene, saveSceneHTML],
  )

  return (
    <>
      {orderedKeys.length === 0 ? (
        <p className="px-2 py-3 text-center text-[11px] text-[var(--color-text-muted)]">No layers in this scene yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {orderedKeys.map((key, index) => {
            const Icon = iconForKey(scene, key)
            const label = labelForKey(scene, key)
            const isHidden = hidden.has(key)
            const isSel = selectedKey === key
            const { kind, id: rowId } = parseKey(key)
            const aiLayer = kind === 'ai' && rowId ? (scene.aiLayers ?? []).find((x) => x.id === rowId) : undefined
            const isAvatarAi = isAvatarLayer(aiLayer)
            const isVideo = kind === 'video'
            const isSceneRenderer = kind === 'scene' && !!rowId
            const prominentRow = isVideo || isAvatarAi || isSceneRenderer
            const showVideoAudioSubs =
              isVideo && !!scene.videoLayer?.enabled && !!scene.videoLayer.src && sceneHasAudioStackDetails(scene)
            const showAvatarAudioSubs =
              isAvatarAi && !!rowId && key === firstAvatarStackKey && sceneHasAudioStackDetails(scene)
            const videoAudioExpanded = expandedVideoAudio
            const avatarAudioExpanded = !!(rowId && expandedAvatarAudio[rowId])
            const isPhysics = kind === 'physics' && rowId
            const physicsLayer = isPhysics && rowId ? scene.physicsLayers?.find((p) => p.id === rowId) : undefined
            const subOrder = physicsLayer
              ? parsePhysicsSubOrder(physicsLayer.params || {})
              : DEFAULT_PHYSICS_SUBLAYER_ORDER
            const subHiddenState = physicsLayer
              ? parsePhysicsSubHidden(physicsLayer.params || {})
              : { background: false, card: false, text: false }
            const phyExpanded = !!(rowId && expandedPhysics[rowId])

            const isSvgStackRow = kind === 'svg' && rowId
            const svgTextChildren =
              isSvgStackRow && rowId
                ? rowId === MAIN_SCENE_SVG_LAYER_ID
                  ? listSvgTextElementsInMarkup(scene.svgContent ?? '')
                  : listSvgTextElementsInMarkup((scene.svgObjects ?? []).find((x) => x.id === rowId)?.svgContent ?? '')
                : []
            const svgTextExpanded = !!(rowId && expandedSvgText[rowId])

            const isChartStackRow = kind === 'chart' && rowId
            const chartLayerForStack =
              isChartStackRow && rowId ? deriveChartLayersFromScene(scene).find((c) => c.id === rowId) : undefined
            const chartTitleExpanded = !!(rowId && expandedChartTitle[rowId])
            const isBgStage = key === BG_STAGE_STACK_KEY
            const isInteraction = kind === 'interaction' && rowId
            const interactionEl =
              isInteraction && rowId ? (scene.interactions ?? []).find((x) => x.id === rowId) : undefined
            const interactionTextExpanded = !!(rowId && expandedInteractionText[rowId])

            return (
              <li key={key}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onToggleRow(key)
                    if (kind === 'scene') openLayersSection('scene')
                    if (kind === 'ai' && rowId) {
                      const l = (scene.aiLayers ?? []).find((x) => x.id === rowId)
                      if (l?.type === 'avatar' && onOpenLayerProperties) onOpenLayerProperties(key)
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    onOpenLayerProperties?.(key)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onToggleRow(key)
                      if (kind === 'scene') openLayersSection('scene')
                    }
                  }}
                  title={
                    onOpenLayerProperties
                      ? 'Double-click for full properties (type, layout, style). Expand ▸ for text only. Avatar: single-click also opens Properties.'
                      : undefined
                  }
                  className={`flex cursor-pointer items-center gap-0.5 rounded px-1 text-[11px] ${
                    prominentRow ? 'py-1 min-h-[30px]' : 'py-0.5'
                  } ${isSel ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/40' : 'hover:bg-white/[0.04]'}`}
                >
                  <button
                    type="button"
                    className={`no-style flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ${isBgStage ? 'cursor-default opacity-40 pointer-events-none' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isBgStage) toggleHidden(key)
                    }}
                    aria-label={isHidden ? 'Show layer' : 'Hide layer'}
                    disabled={isBgStage}
                  >
                    {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  {isPhysics && rowId ? (
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedPhysics((p) => ({ ...p, [rowId]: !p[rowId] }))
                      }}
                      aria-expanded={phyExpanded}
                      aria-label={phyExpanded ? 'Collapse physics contents' : 'Expand physics contents'}
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-150 ${phyExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  ) : isSvgStackRow && svgTextChildren.length > 0 ? (
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedSvgText((p) => ({ ...p, [rowId!]: !p[rowId!] }))
                      }}
                      aria-expanded={svgTextExpanded}
                      aria-label={svgTextExpanded ? 'Collapse SVG text' : 'Expand SVG text'}
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-150 ${svgTextExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  ) : isChartStackRow && chartLayerForStack ? (
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedChartTitle((p) => ({ ...p, [rowId!]: !p[rowId!] }))
                      }}
                      aria-expanded={chartTitleExpanded}
                      aria-label={chartTitleExpanded ? 'Collapse chart title' : 'Expand chart title'}
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-150 ${chartTitleExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  ) : showVideoAudioSubs ? (
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedVideoAudio((v) => !v)
                      }}
                      aria-expanded={videoAudioExpanded}
                      aria-label={videoAudioExpanded ? 'Collapse video audio' : 'Expand video audio'}
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-150 ${videoAudioExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  ) : showAvatarAudioSubs && rowId ? (
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedAvatarAudio((p) => ({ ...p, [rowId]: !p[rowId] }))
                      }}
                      aria-expanded={avatarAudioExpanded}
                      aria-label={avatarAudioExpanded ? 'Collapse avatar audio' : 'Expand avatar audio'}
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-150 ${avatarAudioExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  ) : isInteraction && interactionEl ? (
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedInteractionText((p) => ({ ...p, [rowId!]: !p[rowId!] }))
                      }}
                      aria-expanded={interactionTextExpanded}
                      aria-label={interactionTextExpanded ? 'Collapse text' : 'Expand text'}
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-150 ${interactionTextExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  ) : null}
                  <Icon
                    size={prominentRow ? 14 : 12}
                    className="shrink-0 text-[var(--color-text-muted)]"
                    strokeWidth={2.25}
                  />
                  <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{label}</span>
                  <div className="flex shrink-0 items-center gap-0">
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-25"
                      disabled={key === 'audio' || key === BG_STAGE_STACK_KEY || index === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveKey(index, -1)
                      }}
                      aria-label="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="no-style flex h-6 w-5 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-25"
                      disabled={key === 'audio' || key === BG_STAGE_STACK_KEY || index === orderedKeys.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveKey(index, 1)
                      }}
                      aria-label="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {isSvgStackRow && rowId && svgTextExpanded && svgTextChildren.length > 0 && (
                  <ul
                    className="mt-0.5 space-y-0.5 border-l ml-2 pl-1"
                    style={{ borderLeftColor: 'var(--color-hairline)' }}
                  >
                    {svgTextChildren.map((tx) => {
                      const slotKey =
                        rowId === MAIN_SCENE_SVG_LAYER_ID ? `svg:main:${tx.ref}` : `svg:obj:${rowId}:${tx.ref}`
                      const line = (tx.preview || '').trim() || '(empty)'
                      const hid = layerHiddenIdForTextSlot(slotKey)
                      const isTxHidden = hidden.has(hid)
                      return (
                        <li key={`${rowId}-${tx.ref}`}>
                          <div
                            role="button"
                            tabIndex={0}
                            className="flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[11px] hover:bg-white/[0.04]"
                            onClick={() => openTextTabForSlot(slotKey)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openTextTabForSlot(slotKey)
                              }
                            }}
                            title="Open in Text tab"
                          >
                            <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
                            <button
                              type="button"
                              className="no-style flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleSvgTextSlotHidden(slotKey)
                              }}
                              aria-label={isTxHidden ? 'Show layer' : 'Hide layer'}
                            >
                              {isTxHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <Type size={11} className="shrink-0 text-[var(--color-text-muted)]" strokeWidth={2.25} />
                            <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{line}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {isChartStackRow && rowId && chartTitleExpanded && chartLayerForStack && (
                  <ul
                    className="mt-0.5 space-y-0.5 border-l ml-2 pl-1"
                    style={{ borderLeftColor: 'var(--color-hairline)' }}
                  >
                    <li key={`${rowId}-chart-title`}>
                      <ChartTitleStackSubRow
                        rowId={rowId}
                        chartLayer={chartLayerForStack}
                        hiddenSet={hidden}
                        openTextTabForSlot={openTextTabForSlot}
                        onToggleSlotHidden={toggleChartTitleSlotHidden}
                      />
                    </li>
                  </ul>
                )}

                {isPhysics && rowId && phyExpanded && physicsLayer && (
                  <ul
                    className="mt-0.5 space-y-0.5 border-l ml-2 pl-1"
                    style={{ borderLeftColor: 'var(--color-hairline)' }}
                  >
                    {subOrder.map((sub, si) => {
                      const SubIcon = PHYS_SUB_ICON[sub]
                      const subVisOff = subHiddenState[sub]
                      return (
                        <li key={`${rowId}-${sub}`}>
                          <div className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] hover:bg-white/[0.04]">
                            <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
                            <button
                              type="button"
                              className="no-style flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                              onClick={() => togglePhysicsSubHidden(rowId, sub)}
                              aria-label={subVisOff ? `Show ${PHYS_SUB_LABEL[sub]}` : `Hide ${PHYS_SUB_LABEL[sub]}`}
                            >
                              {subVisOff ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <SubIcon size={11} className="shrink-0 text-[var(--color-text-muted)]" strokeWidth={2.25} />
                            <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">
                              {PHYS_SUB_LABEL[sub]}
                            </span>
                            <div className="flex shrink-0 items-center gap-0">
                              <button
                                type="button"
                                className="no-style flex h-6 w-5 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-25"
                                disabled={si === 0}
                                onClick={() => movePhysicsSub(rowId, si, -1)}
                                aria-label="Move sublayer up"
                              >
                                <ChevronUp size={13} />
                              </button>
                              <button
                                type="button"
                                className="no-style flex h-6 w-5 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-25"
                                disabled={si === subOrder.length - 1}
                                onClick={() => movePhysicsSub(rowId, si, 1)}
                                aria-label="Move sublayer down"
                              >
                                <ChevronDown size={13} />
                              </button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {isVideo && videoAudioExpanded && showVideoAudioSubs && (
                  <AudioStackSubRows
                    scene={scene}
                    onOpenAudio={() => {
                      if (selectedKey !== 'audio') onToggleRow('audio')
                    }}
                  />
                )}

                {isAvatarAi && rowId && avatarAudioExpanded && showAvatarAudioSubs && (
                  <AudioStackSubRows
                    scene={scene}
                    onOpenAudio={() => {
                      if (selectedKey !== 'audio') onToggleRow('audio')
                    }}
                  />
                )}

                {isInteraction && rowId && interactionEl && interactionTextExpanded && (
                  <ul
                    className="mt-0.5 space-y-0.5 border-l ml-2 pl-1"
                    style={{ borderLeftColor: 'var(--color-hairline)' }}
                  >
                    <li>
                      <div className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px]">
                        <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
                        <Type size={11} className="shrink-0 text-[var(--color-text-muted)]" strokeWidth={2.25} />
                        <span className="min-w-0 flex-1 font-semibold text-[var(--color-text-primary)]">
                          Text & labels
                        </span>
                      </div>
                      <div className="border-t border-[var(--color-hairline)]/60 pt-2 pb-1 pl-1 pr-0.5">
                        <InteractionTextBulkForm scene={scene} el={interactionEl} />
                      </div>
                    </li>
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export default function SceneLayersStackPanel({ scene }: Props) {
  const scenes = useVideoStore((s) => s.scenes)
  const selectedSceneId = useVideoStore((s) => s.selectedSceneId)
  const selectScene = useVideoStore((s) => s.selectScene)
  const openLayerStackProperties = useVideoStore((s) => s.openLayerStackProperties)
  const {
    updateScene,
    saveSceneHTML,
    addTextOverlay,
    addSvgObject,
    removeAILayer,
    removeSvgObject,
    removeTextOverlay,
    addInteraction,
    removeInteraction,
    project,
  } = useVideoStore()

  const handleOpenLayerProperties = useCallback(
    (key: StackKey) => {
      openLayerStackProperties(String(key))
    },
    [openLayerStackProperties],
  )

  const [stackSegment, setStackSegment] = useState<'layers' | 'scenes'>('layers')
  const [selection, setSelection] = useState<{ sceneId: string; key: StackKey } | null>(null)
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [stackBodyHeight, setStackBodyHeight] = useState(LAYER_STACK_H_DEFAULT)
  const [stackResizeDrag, setStackResizeDrag] = useState(false)
  const [stackCollapsed, setStackCollapsed] = useState(false)
  const layerStackDragRef = useRef<{ startY: number; startH: number } | null>(null)
  const allowHeightPersist = useRef(false)

  useEffect(() => {
    setStackBodyHeight(readStackBodyHeight())
    allowHeightPersist.current = true
  }, [])

  useEffect(() => {
    if (!allowHeightPersist.current) return
    try {
      localStorage.setItem(LAYER_STACK_BODY_H_KEY, String(stackBodyHeight))
    } catch {
      /* ignore */
    }
  }, [stackBodyHeight])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = layerStackDragRef.current
      if (!d) return
      e.preventDefault()
      setStackBodyHeight(clampStackBodyHeight(d.startH + (d.startY - e.clientY)))
    }
    const onUp = () => {
      if (!layerStackDragRef.current) return
      layerStackDragRef.current = null
      setStackResizeDrag(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  useEffect(() => {
    if (stackSegment === 'scenes' && selectedSceneId) {
      setExpandedScenes((p) => (p[selectedSceneId] === undefined ? { ...p, [selectedSceneId]: true } : p))
    }
  }, [stackSegment, selectedSceneId])

  const onToggleRow = (sceneId: string) => (key: StackKey) => {
    setSelection((prev) => (prev?.sceneId === sceneId && prev.key === key ? null : { sceneId, key }))
  }

  const removeChartLayerFor = useCallback(
    (sceneId: string, id: string) => {
      const sc = scenes.find((s) => s.id === sceneId)
      if (!sc) return
      const next = deriveChartLayersFromScene(sc).filter((c) => c.id !== id)
      const compiled = compileD3SceneFromLayers(next)
      updateScene(sceneId, {
        sceneType: 'd3',
        chartLayers: next,
        sceneCode: compiled.sceneCode,
        d3Data: compiled.d3Data as any,
      })
      void saveSceneHTML(sceneId)
    },
    [scenes, updateScene, saveSceneHTML],
  )

  const removePhysicsLayerFor = useCallback(
    (sceneId: string, id: string) => {
      const sc = scenes.find((s) => s.id === sceneId)
      if (!sc) return
      const next = (sc.physicsLayers ?? []).filter((p) => p.id !== id)
      const primary = next[0]
      const patch: Partial<Scene> = { physicsLayers: next, sceneType: 'physics' }
      if (primary) {
        const compiled = compilePhysicsSceneFromLayers(sceneId, primary)
        patch.sceneCode = compiled.sceneCode
        patch.sceneHTML = compiled.sceneHTML
      } else {
        patch.sceneCode = ''
        patch.sceneHTML = ''
      }
      updateScene(sceneId, patch)
      void saveSceneHTML(sceneId)
    },
    [scenes, updateScene, saveSceneHTML],
  )

  const deleteSelected = useCallback(() => {
    if (!selection) return
    const { sceneId, key: selectedKey } = selection
    const sc = scenes.find((s) => s.id === sceneId)
    if (!sc) return
    const { kind, id } = parseKey(selectedKey)
    if (kind === 'ai' && id) {
      removeAILayer(sceneId, id)
      void saveSceneHTML(sceneId)
    } else if (kind === 'svg' && id) {
      if (id !== MAIN_SCENE_SVG_LAYER_ID) {
        removeSvgObject(sceneId, id)
        void saveSceneHTML(sceneId)
      }
    } else if (kind === 'text' && id) {
      removeTextOverlay(sceneId, id)
      void saveSceneHTML(sceneId)
    } else if (kind === 'chart' && id) {
      removeChartLayerFor(sceneId, id)
    } else if (kind === 'physics' && id) {
      removePhysicsLayerFor(sceneId, id)
    } else if (kind === 'interaction' && id) {
      removeInteraction(sceneId, id)
      void saveSceneHTML(sceneId)
    }
    setSelection(null)
    const fb = buildDefaultOrder(sc)
    const orderedKeys = mergeOrder(sc.layerPanelOrder, fb)
    const nextOrder = orderedKeys.filter((k) => k !== selectedKey)
    updateScene(sceneId, { layerPanelOrder: [...nextOrder] })
  }, [
    selection,
    scenes,
    removeAILayer,
    removeSvgObject,
    removeTextOverlay,
    removeChartLayerFor,
    removePhysicsLayerFor,
    removeInteraction,
    updateScene,
    saveSceneHTML,
  ])

  const onAddText = () => {
    addTextOverlay(scene.id)
    void saveSceneHTML(scene.id)
    setAddOpen(false)
  }

  const onAddSvg = () => {
    addSvgObject(scene.id)
    void saveSceneHTML(scene.id)
    setAddOpen(false)
  }

  const onAddInteraction = (t: InteractionElement['type']) => {
    const el = createDefaultInteraction(t)
    addInteraction(scene.id, el)
    void saveSceneHTML(scene.id)
    setAddOpen(false)
  }

  const selKey = selection?.sceneId === scene.id ? selection.key : null
  const mainSceneSvgStackKey = `svg:${MAIN_SCENE_SVG_LAYER_ID}` as StackKey
  const deleteDisabled =
    !selection ||
    selection.key === 'audio' ||
    selection.key === 'video' ||
    selection.key === BG_STAGE_STACK_KEY ||
    selection.key === mainSceneSvgStackKey ||
    parseKey(selection.key).kind === 'scene'

  return (
    <div
      className="flex shrink-0 flex-col border-t bg-[var(--color-panel)]"
      style={{ borderTopColor: 'var(--color-hairline)' }}
      data-scene-layers-stack
    >
      {stackResizeDrag && <div className="fixed inset-0 z-[9998]" style={{ cursor: 'row-resize' }} aria-hidden />}

      {/* Match AgentChat header: conversation tabs row + New Chat–style controls (no tab ✕) */}
      <div
        className="flex flex-shrink-0 items-center bg-[var(--color-panel)] px-2 py-1 cursor-row-resize"
        onMouseDown={(e) => {
          // Only start drag from the bar background, not from interactive children
          if ((e.target as HTMLElement).closest('[role="tab"], [role="button"], button')) return
          e.preventDefault()
          layerStackDragRef.current = { startY: e.clientY, startH: stackBodyHeight }
          setStackResizeDrag(true)
          if (stackCollapsed) setStackCollapsed(false)
          document.body.style.cursor = 'row-resize'
          document.body.style.userSelect = 'none'
        }}
      >
        <span
          role="button"
          tabIndex={0}
          onClick={() => setStackCollapsed((c) => !c)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setStackCollapsed((c) => !c)
            }
          }}
          className="mr-1 flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--kbd-text)] transition-colors"
          aria-label={stackCollapsed ? 'Expand layers' : 'Collapse layers'}
        >
          <ChevronDown size={12} className={`transition-transform ${stackCollapsed ? '-rotate-90' : ''}`} />
        </span>
        <span className="flex-1 select-none text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Layers</span>

        {(
          <div className="relative ml-1 flex flex-shrink-0 items-center">
            <span
              role="button"
              tabIndex={0}
              onClick={() => setAddOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setAddOpen((o) => !o)
                }
              }}
              className="flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded text-[var(--color-text-muted)] outline-none transition-all hover:bg-[var(--color-panel)]/50 hover:text-[var(--kbd-text)]"
              aria-label="Add layer"
              data-tooltip="Add layer"
              data-tooltip-pos="bottom"
            >
              <Plus size={12} />
            </span>
            {addOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close add menu"
                  onClick={() => setAddOpen(false)}
                />
                <div
                  className="absolute bottom-full right-0 z-20 mb-1 min-w-[140px] rounded border border-[var(--color-border)] py-1 shadow-lg"
                  style={{ backgroundColor: 'var(--color-input-bg)' }}
                >
                  <button
                    type="button"
                    className="no-style flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-white/10"
                    onClick={onAddText}
                  >
                    <Type size={12} /> Text overlay
                  </button>
                  <button
                    type="button"
                    className="no-style flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-white/10"
                    onClick={onAddSvg}
                  >
                    <Layers size={12} /> SVG object
                  </button>
                  {project.outputMode === 'interactive' && (
                    <>
                      <div className="my-1 border-t border-[var(--color-border)]" role="separator" />
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                        Interaction
                      </p>
                      {(
                        [
                          ['hotspot', 'Hotspot'],
                          ['choice', 'Choice'],
                          ['quiz', 'Quiz'],
                          ['gate', 'Gate'],
                          ['tooltip', 'Tooltip'],
                          ['form', 'Form'],
                        ] as const
                      ).map(([t, lab]) => (
                        <button
                          key={t}
                          type="button"
                          className="no-style flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-white/10"
                          onClick={() => onAddInteraction(t)}
                        >
                          <MousePointerClick size={12} /> {lab}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      <div
        className="min-h-0 flex-shrink-0 overflow-y-auto overscroll-contain px-1 py-1"
        style={{ height: stackCollapsed ? 0 : stackBodyHeight, overflow: stackCollapsed ? 'hidden' : undefined }}
      >
        <div className="space-y-0.5">
          {scenes.map((s) => {
            const open = expandedScenes[s.id] ?? (s.id === selectedSceneId)
            const isCurrent = s.id === selectedSceneId
            return (
              <div
                key={s.id}
                className="rounded bg-[var(--color-bg)]/30"
              >
                <div className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] hover:bg-white/[0.04]">
                  <button
                    type="button"
                    className="no-style flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    aria-expanded={open}
                    aria-label={open ? 'Collapse scene layers' : 'Expand scene layers'}
                    onClick={() => setExpandedScenes((p) => ({ ...p, [s.id]: !open }))}
                  >
                    <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
                  </button>
                  <button
                    type="button"
                    className="no-style flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded py-1 pl-0.5 pr-2 text-left"
                    onClick={() => selectScene(s.id)}
                  >
                    <Film size={12} className="shrink-0 text-[var(--color-text-muted)]" />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-text-primary)]">
                      {s.name?.trim() || 'Untitled scene'}
                    </span>
                    {isCurrent && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-500/50" />}
                  </button>
                </div>
                {open && (
                  <div className="px-1 pb-1 pt-0.5">
                    <LayerStackRows
                      scene={s}
                      selectedKey={selection?.sceneId === s.id ? selection.key : null}
                      onToggleRow={onToggleRow(s.id)}
                      onOpenLayerProperties={handleOpenLayerProperties}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import type {
  Scene,
  TextOverlay,
  AILayer,
  D3ChartLayer,
  PhysicsLayer,
  InteractionElement,
  CameraMove,
  SceneStyleOverride,
  SceneVariable,
  WorldConfig,
  WorldObjectConfig,
  WorldPanelConfig,
  WorldAvatarConfig,
  WorldCameraKeyframe,
  WorldEnvironment,
  AvatarMood,
} from '@/lib/types'
import { BG_STAGE_STACK_KEY, type LayerStackKey, parseLayerStackKey, pinLayerStackTail } from '@/lib/layer-stack-keys'
import { useVideoStore } from '@/lib/store'
import { buildDefaultOrder, mergeOrder, labelForKey, iconForKey } from './SceneLayersStackPanel'
import type { NodeMapKey } from './NodeMapCanvas'
import type { SceneElement } from '@/lib/types/elements'
import { getElementPropertyMap } from '@/lib/types/elements'
import { patchElementInIframe } from '@/lib/scene-patcher'
import { TRANSITION_UI_GROUPS, type TransitionType } from '@/lib/transitions'
import { CENCH_THREE_ENVIRONMENTS } from '@/lib/three-environments/registry'
import { patchReactCodeText, readReactCodeText, type PatchableKind } from '@/lib/react-extract'
import { ColorPicker } from '@/components/inspector/controls/ColorPicker'
import { SliderInput } from '@/components/inspector/controls/SliderInput'
import { SelectInput as InspectorSelect } from '@/components/inspector/controls/SelectInput'
import { TextareaInput } from '@/components/inspector/controls/TextareaInput'

// ── Debounced save timer (module-level, mirrors inspector-actions pattern) ───

let _nodeMapSaveTimer: ReturnType<typeof setTimeout> | null = null
let _bgSaveTimer: ReturnType<typeof setTimeout> | null = null

// Virtual rows appended to the drilled node-map stack for scene-level properties.
const EXTRA_KINDS = new Set(['camera', 'transition', 'style', 'variables', 'tts', 'music', 'sfx', '3d'])

function isExtraKind(key: string): boolean {
  const i = key.indexOf(':')
  const kind = i < 0 ? key : key.slice(0, i)
  return EXTRA_KINDS.has(kind)
}

/** Send bgColor change to live scene iframe via postMessage (no HTML regeneration). */
function sendBgColorToIframe(sceneId: string, color: string) {
  const iframe = document.querySelector(`iframe[data-scene-id="${sceneId}"]`) as HTMLIFrameElement | null
  console.log('[NodeMap] sendBgColor', {
    sceneId: sceneId.slice(0, 8),
    color,
    iframeFound: !!iframe,
    hasContentWindow: !!iframe?.contentWindow,
  })
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage({ target: 'cench-scene', sceneId, type: 'set-bg', color }, '*')
    // Also update the iframe element's own background (visible during load)
    iframe.style.background = color
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

interface NodeMapControlsProps {
  scene: Scene
  selectedKey: NodeMapKey | null
  expandedKeys: Set<string>
  onToggleExpand: (key: string) => void
  registerRef: (key: string, el: HTMLDivElement | null) => void
  iframeElements?: Record<string, SceneElement>
}

// ── Main component ───────────────────────────────────────────────────────────

export default function NodeMapControls({
  scene,
  selectedKey,
  expandedKeys,
  onToggleExpand,
  registerRef,
  iframeElements = {},
}: NodeMapControlsProps) {
  const { updateScene, saveSceneHTML, saveProjectToDb } = useVideoStore()
  const sceneIdRef = useRef(scene.id)
  sceneIdRef.current = scene.id

  // Clean up timers on unmount
  useEffect(
    () => () => {
      if (_nodeMapSaveTimer) clearTimeout(_nodeMapSaveTimer)
      if (_bgSaveTimer) clearTimeout(_bgSaveTimer)
    },
    [],
  )

  // ── Sync bgColor to live iframe via postMessage (handles undo too) ──
  const lastBgRef = useRef(scene.bgColor)
  useEffect(() => {
    if (scene.bgColor === lastBgRef.current) return
    lastBgRef.current = scene.bgColor
    sendBgColorToIframe(scene.id, scene.bgColor)
  }, [scene.bgColor, scene.id])

  const upd = useCallback(
    (updates: Partial<Scene>) => {
      updateScene(sceneIdRef.current, updates)
      // Debounced save — regenerate HTML, reload preview, persist to DB
      if (_nodeMapSaveTimer) clearTimeout(_nodeMapSaveTimer)
      _nodeMapSaveTimer = setTimeout(() => {
        saveSceneHTML(sceneIdRef.current)
        saveProjectToDb()
      }, 600)
    },
    [updateScene, saveSceneHTML, saveProjectToDb],
  )

  // bgColor: update store + postMessage to iframe (no HTML regen), debounced DB save
  const updBgColor = useCallback(
    (color: string) => {
      updateScene(sceneIdRef.current, { bgColor: color })
      sendBgColorToIframe(sceneIdRef.current, color)
      if (_bgSaveTimer) clearTimeout(_bgSaveTimer)
      _bgSaveTimer = setTimeout(() => saveProjectToDb(), 1000)
    },
    [updateScene, saveProjectToDb],
  )

  const updAndDelete = useCallback(
    (updates: Partial<Scene>) => {
      updateScene(sceneIdRef.current, updates)
      // Immediate save for destructive operations
      setTimeout(() => saveSceneHTML(sceneIdRef.current), 50)
    },
    [updateScene, saveSceneHTML],
  )

  // ── Ordered keys (same logic as SceneLayersStackPanel) ──
  const fallbackOrder = useMemo(() => buildDefaultOrder(scene), [scene])
  const stackOrderedKeys = useMemo(
    () => mergeOrder(scene.layerPanelOrder, fallbackOrder),
    [scene.layerPanelOrder, fallbackOrder],
  )

  // ── Extra virtual rows for scene-level properties surfaced in the node map ──
  // These aren't part of the stack order but appear here so editors are reachable
  // when a user clicks the corresponding canvas node.
  const extraKeys = useMemo<LayerStackKey[]>(() => {
    const out: LayerStackKey[] = []
    if (scene.cameraMotion && scene.cameraMotion.length > 0) out.push('camera' as LayerStackKey)
    if (scene.transition && scene.transition !== 'none') out.push('transition' as LayerStackKey)
    const so = scene.styleOverride
    if (so && ((so.palette && so.palette.length > 0) || so.font || so.bgColor)) {
      out.push('style' as LayerStackKey)
    }
    if (scene.variables && scene.variables.length > 0) out.push('variables' as LayerStackKey)
    const a = scene.audioLayer
    if (a?.tts?.text?.trim() || a?.tts?.status === 'ready' || a?.tts?.status === 'generating') {
      out.push('tts' as LayerStackKey)
    }
    if (a?.music?.src) out.push('music' as LayerStackKey)
    for (const s of a?.sfx ?? []) out.push(`sfx:${s.id}` as LayerStackKey)
    // 3D world sub-elements — editors write back to scene.worldConfig
    const wc = scene.worldConfig
    if (wc) {
      out.push('3d:env' as LayerStackKey)
      ;(wc.objects ?? []).forEach((_, i) => out.push(`3d:obj:${i}` as LayerStackKey))
      ;(wc.panels ?? []).forEach((_, i) => out.push(`3d:panel:${i}` as LayerStackKey))
      ;(wc.avatars ?? []).forEach((_, i) => out.push(`3d:avatar:${i}` as LayerStackKey))
      if (wc.cameraPath && wc.cameraPath.length > 0) out.push('3d:camera' as LayerStackKey)
    }
    // Three.js preset (non-world scenes)
    if (scene.threeEnvironmentPresetId && !wc) out.push('3d:preset' as LayerStackKey)
    return out
  }, [
    scene.cameraMotion,
    scene.transition,
    scene.styleOverride,
    scene.variables,
    scene.audioLayer,
    scene.worldConfig,
    scene.threeEnvironmentPresetId,
  ])

  const orderedKeys = useMemo<LayerStackKey[]>(() => {
    if (extraKeys.length === 0) return stackOrderedKeys
    const have = new Set(stackOrderedKeys)
    const extras = extraKeys.filter((k) => !have.has(k))
    return [...stackOrderedKeys, ...extras]
  }, [stackOrderedKeys, extraKeys])

  const hidden = useMemo(() => new Set(scene.layerHiddenIds ?? []), [scene.layerHiddenIds])

  const toggleHidden = useCallback(
    (key: LayerStackKey) => {
      const h = new Set(scene.layerHiddenIds ?? [])
      if (h.has(key)) h.delete(key)
      else h.add(key)
      upd({ layerHiddenIds: Array.from(h) })
    },
    [scene.layerHiddenIds, upd],
  )

  const moveKey = useCallback(
    (index: number, dir: -1 | 1) => {
      const j = index + dir
      if (j < 0 || j >= orderedKeys.length) return
      const a = orderedKeys[index]
      const b = orderedKeys[j]
      if (a === 'audio' || b === 'audio') return
      if (a === BG_STAGE_STACK_KEY || b === BG_STAGE_STACK_KEY) return
      // Extra virtual rows aren't part of layerPanelOrder — skip them.
      if (isExtraKind(a) || isExtraKind(b)) return
      const next = [...stackOrderedKeys]
      const realI = next.indexOf(a)
      const realJ = next.indexOf(b)
      if (realI < 0 || realJ < 0) return
      ;[next[realI], next[realJ]] = [next[realJ], next[realI]]
      upd({ layerPanelOrder: [...pinLayerStackTail(next)] })
    },
    [orderedKeys, stackOrderedKeys, upd],
  )

  return (
    <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
      <ul className="space-y-0">
        {orderedKeys.map((key, index) => {
          const Icon = iconForKey(scene, key)
          const label = labelForKey(scene, key)
          const isHidden = hidden.has(key)
          const isExpanded = expandedKeys.has(key)
          const isSelected = selectedKey === key
          const { kind, id: rowId } = parseLayerStackKey(key)
          const isBgStage = key === BG_STAGE_STACK_KEY
          const isExtra = isExtraKind(key)

          return (
            <li key={key} ref={(el) => registerRef(key, el as HTMLDivElement | null)}>
              {/* ── Layer stack row (exact SceneLayersStackPanel pattern) ── */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onToggleExpand(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleExpand(key)
                  }
                }}
                className={`flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[11px] ${
                  isSelected
                    ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/40'
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                {/* Eye toggle */}
                <span
                  role="button"
                  tabIndex={0}
                  className={`no-style flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ${isBgStage || isExtra ? 'cursor-default opacity-40 pointer-events-none' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isBgStage && !isExtra) toggleHidden(key)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      if (!isBgStage && !isExtra) toggleHidden(key)
                    }
                  }}
                >
                  {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </span>

                {/* Expand chevron */}
                <span className="flex h-6 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)]">
                  <ChevronRight
                    size={14}
                    className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </span>

                {/* Icon */}
                <Icon size={12} className="shrink-0 text-[var(--color-text-muted)]" strokeWidth={2.25} />

                {/* Label */}
                <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{label}</span>

                {/* Reorder buttons */}
                <div className="flex shrink-0 items-center gap-0">
                  <span
                    role="button"
                    tabIndex={0}
                    className={`no-style flex h-6 w-5 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ${
                      key === 'audio' || isBgStage || isExtra || index === 0 ? 'opacity-25 pointer-events-none' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveKey(index, -1)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        moveKey(index, -1)
                      }
                    }}
                  >
                    <ChevronUp size={14} />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className={`no-style flex h-6 w-5 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ${
                      key === 'audio' || isBgStage || isExtra || index === orderedKeys.length - 1
                        ? 'opacity-25 pointer-events-none'
                        : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveKey(index, 1)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        moveKey(index, 1)
                      }
                    }}
                  >
                    <ChevronDown size={14} />
                  </span>
                </div>
              </div>

              {/* ── Expanded settings panel ── */}
              {isExpanded && (
                <div
                  className="ml-8 pl-2 pb-2 pt-1 space-y-2"
                  style={{ borderLeft: '1px solid var(--color-hairline)' }}
                >
                  <LayerSettings
                    scene={scene}
                    layerKey={key}
                    kind={kind}
                    rowId={rowId}
                    upd={upd}
                    updAndDelete={updAndDelete}
                    updBgColor={updBgColor}
                    iframeElements={iframeElements}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Settings panel per layer kind ────────────────────────────────────────────

function LayerSettings({
  scene,
  layerKey,
  kind,
  rowId,
  upd,
  updAndDelete,
  updBgColor,
  iframeElements,
}: {
  scene: Scene
  layerKey: LayerStackKey
  kind: string
  rowId: string | null
  upd: (updates: Partial<Scene>) => void
  updAndDelete: (updates: Partial<Scene>) => void
  updBgColor: (color: string) => void
  iframeElements: Record<string, SceneElement>
}) {
  switch (kind) {
    case 'bg':
      return (
        <div className="space-y-2">
          <FieldRow label="Color">
            <ColorInput value={scene.bgColor} onChange={(v) => updBgColor(v)} />
          </FieldRow>
        </div>
      )

    case 'text': {
      const overlay = scene.textOverlays.find((t) => t.id === rowId)
      if (!overlay) return <Muted>Text overlay not found</Muted>
      const updT = (changes: Partial<TextOverlay>) => {
        upd({ textOverlays: scene.textOverlays.map((t) => (t.id === rowId ? { ...t, ...changes } : t)) })
      }
      return (
        <div className="space-y-2">
          <FieldRow label="Content">
            <TextInput value={overlay.content} onChange={(v) => updT({ content: v })} multiline placeholder="Text" />
          </FieldRow>
          <FieldRow label="Font">
            <TextInput value={overlay.font ?? ''} onChange={(v) => updT({ font: v })} placeholder="Inter" />
          </FieldRow>
          <FieldRow label="Size">
            <NumberInput value={overlay.size ?? 24} onChange={(v) => updT({ size: v })} min={8} max={200} unit="px" />
          </FieldRow>
          <FieldRow label="Color">
            <ColorInput value={overlay.color ?? '#ffffff'} onChange={(v) => updT({ color: v })} />
          </FieldRow>
          <SectionLabel>Transform</SectionLabel>
          <TransformGrid
            values={{ x: overlay.x ?? 50, y: overlay.y ?? 50 }}
            onChange={(k, v) => updT({ [k]: v })}
            fields={['x', 'y']}
          />
          <SectionLabel>Animation</SectionLabel>
          <FieldRow label="Type">
            <SelectInput
              value={overlay.animation ?? 'fade-in'}
              onChange={(v) => updT({ animation: v as any })}
              options={[
                { value: 'fade-in', label: 'Fade In' },
                { value: 'slide-up', label: 'Slide Up' },
                { value: 'typewriter', label: 'Typewriter' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Duration">
            <NumberInput
              value={overlay.duration ?? 1}
              onChange={(v) => updT({ duration: v })}
              min={0}
              step={0.1}
              unit="s"
            />
          </FieldRow>
          <FieldRow label="Delay">
            <NumberInput value={overlay.delay ?? 0} onChange={(v) => updT({ delay: v })} min={0} step={0.1} unit="s" />
          </FieldRow>
          <DeleteRow
            onDelete={() => updAndDelete({ textOverlays: scene.textOverlays.filter((t) => t.id !== rowId) })}
            label="text overlay"
          />
        </div>
      )
    }

    case 'svg': {
      const obj = scene.svgObjects.find((o) => o.id === rowId)
      if (!obj) return <Muted>SVG object not found</Muted>
      const updO = (changes: Partial<typeof obj>) => {
        upd({ svgObjects: scene.svgObjects.map((o) => (o.id === rowId ? { ...o, ...changes } : o)) as any })
      }
      return (
        <div className="space-y-2">
          <FieldRow label="Prompt">
            <TextInput value={obj.prompt ?? ''} onChange={(v) => updO({ prompt: v })} placeholder="SVG description" />
          </FieldRow>
          <SectionLabel>Transform</SectionLabel>
          <TransformGrid
            values={{
              x: obj.x ?? 50,
              y: obj.y ?? 50,
              width: obj.width ?? 20,
              opacity: obj.opacity ?? 1,
              zIndex: obj.zIndex ?? 4,
            }}
            onChange={(k, v) => updO({ [k]: v })}
            fields={['x', 'y', 'width', 'opacity', 'zIndex']}
          />
          <DeleteRow
            onDelete={() => updAndDelete({ svgObjects: scene.svgObjects.filter((o) => o.id !== rowId) })}
            label="SVG object"
          />
        </div>
      )
    }

    case 'ai': {
      const layer = scene.aiLayers.find((l) => l.id === rowId)
      if (!layer) return <Muted>AI layer not found</Muted>
      const updL = (changes: Record<string, unknown>) => {
        upd({ aiLayers: scene.aiLayers.map((l) => (l.id === rowId ? ({ ...l, ...changes } as AILayer) : l)) })
      }
      const hasRotation = 'rotation' in layer
      const hasStartAt = 'startAt' in layer
      const hasAnimation = layer.type === 'image' || layer.type === 'sticker'
      const hasFilter = 'filter' in layer || layer.type === 'image' || layer.type === 'sticker'
      return (
        <div className="space-y-2">
          <FieldRow label="Label">
            <TextInput value={layer.label ?? ''} onChange={(v) => updL({ label: v })} placeholder="Layer name" />
          </FieldRow>
          <FieldRow label="Type">
            <Muted>{layer.type}</Muted>
          </FieldRow>
          {'prompt' in layer && (layer as any).prompt !== undefined && (
            <FieldRow label="Prompt">
              <TextInput
                value={(layer as any).prompt ?? ''}
                onChange={(v) => updL({ prompt: v })}
                multiline
                placeholder="Prompt"
              />
            </FieldRow>
          )}
          {'script' in layer && (
            <FieldRow label="Script">
              <TextInput
                value={(layer as any).script ?? ''}
                onChange={(v) => updL({ script: v })}
                multiline
                placeholder="Avatar script"
              />
            </FieldRow>
          )}
          <SectionLabel>Transform</SectionLabel>
          <TransformGrid
            values={{
              x: layer.x ?? 0,
              y: layer.y ?? 0,
              width: layer.width ?? 100,
              height: layer.height ?? 100,
              opacity: layer.opacity ?? 1,
              zIndex: layer.zIndex ?? 1,
              ...(hasRotation ? { rotation: (layer as any).rotation ?? 0 } : {}),
            }}
            onChange={(k, v) => updL({ [k]: v })}
            fields={['x', 'y', 'width', 'height', ...(hasRotation ? ['rotation' as const] : []), 'opacity', 'zIndex']}
          />
          {hasStartAt && (
            <FieldRow label="Start at">
              <NumberInput
                value={(layer as any).startAt ?? 0}
                onChange={(v) => updL({ startAt: v })}
                min={0}
                step={0.1}
                unit="s"
              />
            </FieldRow>
          )}
          {hasAnimation && (layer as any).animation && (
            <>
              <SectionLabel>Animation</SectionLabel>
              <FieldRow label="Type">
                <SelectInput
                  value={(layer as any).animation?.type ?? 'fade-in'}
                  onChange={(v) => updL({ animation: { ...((layer as any).animation ?? {}), type: v } })}
                  options={[
                    { value: 'fade-in', label: 'Fade In' },
                    { value: 'fade-out', label: 'Fade Out' },
                    { value: 'slide-up', label: 'Slide Up' },
                    { value: 'slide-down', label: 'Slide Down' },
                    { value: 'slide-left', label: 'Slide Left' },
                    { value: 'slide-right', label: 'Slide Right' },
                    { value: 'scale-in', label: 'Scale In' },
                    { value: 'spin-in', label: 'Spin In' },
                    { value: 'none', label: 'None' },
                  ]}
                />
              </FieldRow>
              <FieldRow label="Duration">
                <NumberInput
                  value={(layer as any).animation?.duration ?? 0.5}
                  onChange={(v) => updL({ animation: { ...((layer as any).animation ?? {}), duration: v } })}
                  min={0}
                  step={0.1}
                  unit="s"
                />
              </FieldRow>
            </>
          )}
          {hasFilter && (
            <FieldRow label="Filter">
              <TextInput
                value={(layer as any).filter ?? ''}
                onChange={(v) => updL({ filter: v })}
                placeholder="blur(2px) brightness(1.2)"
              />
            </FieldRow>
          )}
          <DeleteRow
            onDelete={() => updAndDelete({ aiLayers: scene.aiLayers.filter((l) => l.id !== rowId) })}
            label="AI layer"
          />
        </div>
      )
    }

    case 'chart': {
      const chart = (scene.chartLayers ?? []).find((c) => c.id === rowId)
      if (!chart) return <Muted>Chart not found</Muted>
      const updC = (changes: Partial<D3ChartLayer>) => {
        upd({ chartLayers: (scene.chartLayers ?? []).map((c) => (c.id === rowId ? { ...c, ...changes } : c)) })
      }
      return (
        <div className="space-y-2">
          <FieldRow label="Name">
            <TextInput value={chart.name ?? ''} onChange={(v) => updC({ name: v })} placeholder="Chart name" />
          </FieldRow>
          <FieldRow label="Type">
            <SelectInput
              value={chart.chartType ?? 'bar'}
              onChange={(v) => updC({ chartType: v as any })}
              options={[
                { value: 'bar', label: 'Bar' },
                { value: 'horizontalBar', label: 'Horizontal Bar' },
                { value: 'line', label: 'Line' },
                { value: 'area', label: 'Area' },
                { value: 'pie', label: 'Pie' },
                { value: 'donut', label: 'Donut' },
                { value: 'scatter', label: 'Scatter' },
                { value: 'number', label: 'Number' },
                { value: 'gauge', label: 'Gauge' },
                { value: 'funnel', label: 'Funnel' },
              ]}
            />
          </FieldRow>
          <SectionLabel>Layout</SectionLabel>
          <TransformGrid
            values={{
              x: chart.layout.x ?? 0,
              y: chart.layout.y ?? 0,
              width: chart.layout.width ?? 100,
              height: chart.layout.height ?? 100,
            }}
            onChange={(k, v) => updC({ layout: { ...chart.layout, [k]: v } })}
            fields={['x', 'y', 'width', 'height']}
          />
          <SectionLabel>Timing</SectionLabel>
          <FieldRow label="Start">
            <NumberInput
              value={chart.timing.startAt ?? 0}
              onChange={(v) => updC({ timing: { ...chart.timing, startAt: v } })}
              min={0}
              step={0.1}
              unit="s"
            />
          </FieldRow>
          <FieldRow label="Duration">
            <NumberInput
              value={chart.timing.duration ?? 5}
              onChange={(v) => updC({ timing: { ...chart.timing, duration: v } })}
              min={0.1}
              step={0.1}
              unit="s"
            />
          </FieldRow>
          <FieldRow label="Animated">
            <SelectInput
              value={chart.timing.animated ? 'yes' : 'no'}
              onChange={(v) => updC({ timing: { ...chart.timing, animated: v === 'yes' } })}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
          </FieldRow>
          <DeleteRow
            onDelete={() => updAndDelete({ chartLayers: (scene.chartLayers ?? []).filter((c) => c.id !== rowId) })}
            label="chart"
          />
        </div>
      )
    }

    case 'physics': {
      const phys = (scene.physicsLayers ?? []).find((p) => p.id === rowId)
      if (!phys) return <Muted>Physics layer not found</Muted>
      const updP = (changes: Partial<PhysicsLayer>) => {
        upd({ physicsLayers: (scene.physicsLayers ?? []).map((p) => (p.id === rowId ? { ...p, ...changes } : p)) })
      }
      return (
        <div className="space-y-2">
          <FieldRow label="Name">
            <TextInput value={phys.name ?? ''} onChange={(v) => updP({ name: v })} placeholder="Simulation name" />
          </FieldRow>
          <FieldRow label="Type">
            <SelectInput
              value={phys.simulation ?? 'pendulum'}
              onChange={(v) => updP({ simulation: v as any })}
              options={[
                { value: 'pendulum', label: 'Pendulum' },
                { value: 'double_pendulum', label: 'Double Pendulum' },
                { value: 'projectile', label: 'Projectile' },
                { value: 'orbital', label: 'Orbital' },
                { value: 'wave_interference', label: 'Wave Interference' },
                { value: 'double_slit', label: 'Double Slit' },
                { value: 'electric_field', label: 'Electric Field' },
                { value: 'harmonic_oscillator', label: 'Harmonic Oscillator' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Layout">
            <SelectInput
              value={phys.layout ?? 'split'}
              onChange={(v) => updP({ layout: v as any })}
              options={[
                { value: 'split', label: 'Split' },
                { value: 'fullscreen', label: 'Fullscreen' },
                { value: 'equation_focus', label: 'Equation Focus' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Title">
            <TextInput value={phys.title ?? ''} onChange={(v) => updP({ title: v })} placeholder="Title" />
          </FieldRow>
          <DeleteRow
            onDelete={() => updAndDelete({ physicsLayers: (scene.physicsLayers ?? []).filter((p) => p.id !== rowId) })}
            label="physics layer"
          />
        </div>
      )
    }

    case 'interaction': {
      const ix = scene.interactions.find((x) => x.id === rowId)
      if (!ix) return <Muted>Interaction not found</Muted>
      const updIx = (changes: Record<string, unknown>) => {
        upd({
          interactions: scene.interactions.map((x) =>
            x.id === rowId ? ({ ...x, ...changes } as InteractionElement) : x,
          ),
        })
      }
      return (
        <div className="space-y-2">
          <FieldRow label="Type">
            <Muted className="capitalize">{ix.type}</Muted>
          </FieldRow>
          {'label' in ix && (
            <FieldRow label="Label">
              <TextInput value={(ix as any).label ?? ''} onChange={(v) => updIx({ label: v })} placeholder="Label" />
            </FieldRow>
          )}
          {'question' in ix && (
            <FieldRow label="Question">
              <TextInput
                value={(ix as any).question ?? ''}
                onChange={(v) => updIx({ question: v })}
                multiline
                placeholder="Question"
              />
            </FieldRow>
          )}
          {'buttonLabel' in ix && (
            <FieldRow label="Button">
              <TextInput
                value={(ix as any).buttonLabel ?? ''}
                onChange={(v) => updIx({ buttonLabel: v })}
                placeholder="Button label"
              />
            </FieldRow>
          )}
          {'tooltipTitle' in ix && (
            <FieldRow label="Title">
              <TextInput
                value={(ix as any).tooltipTitle ?? ''}
                onChange={(v) => updIx({ tooltipTitle: v })}
                placeholder="Tooltip title"
              />
            </FieldRow>
          )}
          <SectionLabel>Transform</SectionLabel>
          <TransformGrid
            values={{ x: ix.x ?? 50, y: ix.y ?? 50, width: ix.width ?? 30, height: ix.height ?? 20 }}
            onChange={(k, v) => updIx({ [k]: v })}
            fields={['x', 'y', 'width', 'height']}
          />
          <SectionLabel>Timing</SectionLabel>
          <FieldRow label="Appears">
            <NumberInput
              value={ix.appearsAt ?? 0}
              onChange={(v) => updIx({ appearsAt: v })}
              min={0}
              step={0.1}
              unit="s"
            />
          </FieldRow>
          <FieldRow label="Hides">
            <NumberInput
              value={ix.hidesAt ?? 0}
              onChange={(v) => updIx({ hidesAt: v || null })}
              min={0}
              step={0.1}
              unit="s"
            />
          </FieldRow>
          <FieldRow label="Entrance">
            <SelectInput
              value={ix.entranceAnimation ?? 'fade'}
              onChange={(v) => updIx({ entranceAnimation: v })}
              options={[
                { value: 'fade', label: 'Fade' },
                { value: 'slide-up', label: 'Slide Up' },
                { value: 'pop', label: 'Pop' },
                { value: 'none', label: 'None' },
              ]}
            />
          </FieldRow>
          <DeleteRow
            onDelete={() => updAndDelete({ interactions: scene.interactions.filter((x) => x.id !== rowId) })}
            label="interaction"
          />
        </div>
      )
    }

    case 'video': {
      const vl = scene.videoLayer
      return (
        <div className="space-y-2">
          <FieldRow label="Enabled">
            <SelectInput
              value={vl.enabled ? 'yes' : 'no'}
              onChange={(v) => upd({ videoLayer: { ...vl, enabled: v === 'yes' } })}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
          </FieldRow>
          {vl.src && (
            <FieldRow label="Source">
              <Muted className="truncate block">{vl.src}</Muted>
            </FieldRow>
          )}
          <FieldRow label="Opacity">
            <NumberInput
              value={vl.opacity ?? 1}
              onChange={(v) => upd({ videoLayer: { ...vl, opacity: v } })}
              min={0}
              max={1}
              step={0.05}
            />
          </FieldRow>
          <FieldRow label="Trim start">
            <NumberInput
              value={vl.trimStart ?? 0}
              onChange={(v) => upd({ videoLayer: { ...vl, trimStart: v } })}
              min={0}
              step={0.1}
              unit="s"
            />
          </FieldRow>
          <FieldRow label="Trim end">
            <NumberInput
              value={vl.trimEnd ?? 0}
              onChange={(v) => upd({ videoLayer: { ...vl, trimEnd: v || null } })}
              min={0}
              step={0.1}
              unit="s"
            />
          </FieldRow>
        </div>
      )
    }

    case 'audio': {
      const a = scene.audioLayer
      return (
        <div className="space-y-2">
          {a.tts?.text?.trim() && (
            <FieldRow label="TTS">
              <TextInput
                value={a.tts?.text ?? ''}
                onChange={(v) => upd({ audioLayer: { ...a, tts: { ...a.tts!, text: v } } })}
                multiline
                placeholder="Narration text"
              />
            </FieldRow>
          )}
          {a.music?.src && (
            <>
              <FieldRow label="Music">
                <Muted>{a.music.name || 'Music track'}</Muted>
              </FieldRow>
              <FieldRow label="Volume">
                <NumberInput
                  value={a.music.volume ?? 0.5}
                  onChange={(v) => upd({ audioLayer: { ...a, music: { ...a.music!, volume: v } } })}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </FieldRow>
            </>
          )}
          {(a.sfx ?? []).map((s) => (
            <FieldRow key={s.id} label={s.name || 'SFX'}>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={s.triggerAt}
                  onChange={(v) => {
                    const sfx = (a.sfx ?? []).map((x) => (x.id === s.id ? { ...x, triggerAt: v } : x))
                    upd({ audioLayer: { ...a, sfx } })
                  }}
                  min={0}
                  step={0.1}
                  unit="s"
                />
                <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                  @ trigger
                </span>
              </div>
            </FieldRow>
          ))}
          {!a.tts?.text?.trim() && !a.music?.src && !a.sfx?.length && <Muted>No audio configured</Muted>}
        </div>
      )
    }

    case 'camera':
      return <CameraEditor scene={scene} upd={upd} updAndDelete={updAndDelete} />

    case 'transition':
      return <TransitionEditor scene={scene} upd={upd} />

    case 'style':
      return <StyleOverrideEditor scene={scene} upd={upd} />

    case 'variables':
      return <VariablesEditor scene={scene} upd={upd} />

    case 'tts': {
      const a = scene.audioLayer
      const t = a.tts
      if (!t) return <Muted>No narration configured</Muted>
      return (
        <div className="space-y-2">
          <FieldRow label="Text">
            <TextInput
              value={t.text ?? ''}
              onChange={(v) => upd({ audioLayer: { ...a, tts: { ...t, text: v } } })}
              multiline
              placeholder="Narration text"
            />
          </FieldRow>
          {t.voiceId && (
            <FieldRow label="Voice">
              <Muted>{t.voiceId}</Muted>
            </FieldRow>
          )}
          {t.status && (
            <FieldRow label="Status">
              <Muted>{t.status}</Muted>
            </FieldRow>
          )}
          <DeleteRow onDelete={() => updAndDelete({ audioLayer: { ...a, tts: null } })} label="narration" />
        </div>
      )
    }

    case 'music': {
      const a = scene.audioLayer
      const m = a.music
      if (!m) return <Muted>No music configured</Muted>
      return (
        <div className="space-y-2">
          <FieldRow label="Name">
            <TextInput
              value={m.name ?? ''}
              onChange={(v) => upd({ audioLayer: { ...a, music: { ...m, name: v } } })}
              placeholder="Track name"
            />
          </FieldRow>
          <FieldRow label="Volume">
            <NumberInput
              value={m.volume ?? 0.5}
              onChange={(v) => upd({ audioLayer: { ...a, music: { ...m, volume: v } } })}
              min={0}
              max={1}
              step={0.05}
            />
          </FieldRow>
          {m.src && (
            <FieldRow label="Source">
              <Muted className="truncate block">{m.src}</Muted>
            </FieldRow>
          )}
          <DeleteRow onDelete={() => updAndDelete({ audioLayer: { ...a, music: null } })} label="music track" />
        </div>
      )
    }

    case 'sfx': {
      const a = scene.audioLayer
      const sfx = a.sfx ?? []
      const item = sfx.find((s) => s.id === rowId)
      if (!item) return <Muted>SFX not found</Muted>
      const updSfx = (changes: Partial<typeof item>) => {
        upd({ audioLayer: { ...a, sfx: sfx.map((s) => (s.id === rowId ? { ...s, ...changes } : s)) } })
      }
      return (
        <div className="space-y-2">
          <FieldRow label="Name">
            <TextInput value={item.name ?? ''} onChange={(v) => updSfx({ name: v })} placeholder="SFX name" />
          </FieldRow>
          <FieldRow label="Trigger">
            <NumberInput
              value={item.triggerAt ?? 0}
              onChange={(v) => updSfx({ triggerAt: v })}
              min={0}
              step={0.1}
              unit="s"
            />
          </FieldRow>
          {typeof item.volume === 'number' && (
            <FieldRow label="Volume">
              <NumberInput
                value={item.volume ?? 1}
                onChange={(v) => updSfx({ volume: v })}
                min={0}
                max={1}
                step={0.05}
              />
            </FieldRow>
          )}
          {item.src && (
            <FieldRow label="Source">
              <Muted className="truncate block">{item.src}</Muted>
            </FieldRow>
          )}
          <DeleteRow
            onDelete={() => updAndDelete({ audioLayer: { ...a, sfx: sfx.filter((s) => s.id !== rowId) } })}
            label="sound effect"
          />
        </div>
      )
    }

    case '3d': {
      const parts = (rowId ?? '').split(':')
      const sub = parts[0] ?? ''
      const subIdx = parseInt(parts[1] ?? '0', 10)
      if (sub === 'preset') return <ThreePresetEditor scene={scene} upd={upd} />
      const wc = scene.worldConfig
      if (!wc) return <Muted>No 3D world configured</Muted>
      if (sub === 'env') return <WorldEnvEditor wc={wc} upd={upd} />
      if (sub === 'obj') return <WorldObjectEditor wc={wc} index={subIdx} upd={upd} updAndDelete={updAndDelete} />
      if (sub === 'panel') return <WorldPanelEditor wc={wc} index={subIdx} upd={upd} updAndDelete={updAndDelete} />
      if (sub === 'avatar') return <WorldAvatarEditor wc={wc} index={subIdx} upd={upd} updAndDelete={updAndDelete} />
      if (sub === 'camera') return <WorldCameraEditor wc={wc} upd={upd} updAndDelete={updAndDelete} />
      return <Muted>Unknown 3D sub-element</Muted>
    }

    case 'scene':
      return (
        <div className="space-y-1">
          <Muted>
            Scene renderer:{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{labelForKey(scene, layerKey)}</strong>
          </Muted>
          <Muted className="text-[9px]">Use the Code tab or Prompt tab to edit scene code.</Muted>
        </div>
      )

    case 'rx': {
      // Code-extracted elements — match to Inspector elements for property editing
      const rxKind = (rowId ?? '').split(':')[0] || 'element'
      const rxIdx = parseInt((rowId ?? '').split(':')[1] || '0', 10)
      const matchedElement = matchRxToInspectorElement(rxKind, rxIdx, iframeElements)

      if (!matchedElement) {
        // Source-level fallback: rewrite scene.reactCode / sceneCode directly for
        // plain-text elements (heading / paragraph / image alt). Keeps the node
        // editable when the runtime hasn't registered a matching DOM element.
        if (rxKind === 'heading' || rxKind === 'paragraph' || rxKind === 'image') {
          return <RxSourceTextEditor scene={scene} kind={rxKind} index={rxIdx} upd={upd} />
        }
        const rxLabels: Record<string, string> = {
          three: 'Three.js bridge',
          canvas2d: 'Canvas 2D bridge',
          d3: 'D3 bridge',
          svg: 'SVG element',
          lottie: 'Lottie bridge',
          text: 'Text element',
        }
        return (
          <div className="space-y-1.5">
            <FieldRow label="Type">
              <Muted>{rxLabels[rxKind] ?? rxKind}</Muted>
            </FieldRow>
            <Muted className="text-[9px]">
              Bridge component — click the element in the preview to edit via Inspector, or edit scene code directly.
            </Muted>
          </div>
        )
      }

      return <RxElementControls element={matchedElement} sceneId={scene.id} />
    }

    default:
      return <Muted>No editor available for &quot;{kind}&quot; yet.</Muted>
  }
}

// ── Camera editor ────────────────────────────────────────────────────────────

const CAMERA_PRESETS: { value: CameraMove['type']; label: string }[] = [
  { value: 'kenBurns', label: 'Ken Burns' },
  { value: 'dollyIn', label: 'Dolly In' },
  { value: 'dollyOut', label: 'Dolly Out' },
  { value: 'pan', label: 'Pan' },
  { value: 'rackFocus', label: 'Rack Focus' },
  { value: 'cut', label: 'Cut' },
  { value: 'shake', label: 'Shake' },
  { value: 'reset', label: 'Reset' },
  { value: 'orbit', label: 'Orbit (3D)' },
  { value: 'dolly3D', label: 'Dolly (3D)' },
  { value: 'rackFocus3D', label: 'Rack Focus (3D)' },
  { value: 'presetReveal', label: 'Preset · Reveal' },
  { value: 'presetEmphasis', label: 'Preset · Emphasis' },
  { value: 'presetCinematicPush', label: 'Preset · Cinematic Push' },
  { value: 'presetRackTransition', label: 'Preset · Rack Transition' },
]

function CameraEditor({
  scene,
  upd,
  updAndDelete,
}: {
  scene: Scene
  upd: (updates: Partial<Scene>) => void
  updAndDelete: (updates: Partial<Scene>) => void
}) {
  const moves: CameraMove[] = scene.cameraMotion ?? []
  const replace = (next: CameraMove[]) => upd({ cameraMotion: next.length > 0 ? next : null })
  const updMove = (idx: number, changes: Partial<CameraMove>) => {
    replace(
      moves.map((m, i) => {
        if (i !== idx) return m
        // When type changes, drop stale params so the new move type starts from its own defaults.
        // Preserve timing (startAt/duration) so the user doesn't have to re-enter it.
        if (changes.type && changes.type !== m.type) {
          const prior = (m.params ?? {}) as Record<string, unknown>
          const timing: Record<string, unknown> = {}
          if (typeof prior.startAt === 'number') timing.startAt = prior.startAt
          if (typeof prior.duration === 'number') timing.duration = prior.duration
          return { ...m, ...changes, params: timing }
        }
        return { ...m, ...changes }
      }),
    )
  }
  const updParam = (idx: number, key: string, value: unknown) => {
    const m = moves[idx]
    if (!m) return
    const params = { ...(m.params ?? {}), [key]: value }
    updMove(idx, { params })
  }
  const removeMove = (idx: number) => {
    const next = moves.filter((_, i) => i !== idx)
    updAndDelete({ cameraMotion: next.length > 0 ? next : null })
  }
  const addMove = () => {
    replace([...moves, { type: 'kenBurns', params: { duration: 2 } }])
  }

  return (
    <div className="space-y-2">
      {moves.length === 0 && <Muted>No camera moves. Add one below.</Muted>}
      {moves.map((m, i) => {
        const p = (m.params ?? {}) as Record<string, unknown>
        const duration = typeof p.duration === 'number' ? p.duration : 0
        const startAt = typeof p.startAt === 'number' ? p.startAt : 0
        return (
          <div
            key={i}
            className="space-y-1.5 rounded border px-2 py-1.5"
            style={{ borderColor: 'var(--color-hairline)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
              >
                Move {i + 1}
              </span>
              <span
                role="button"
                tabIndex={0}
                className="inline-flex items-center gap-1 text-[9px] cursor-pointer hover:opacity-80"
                style={{ color: '#ef4444' }}
                onClick={() => removeMove(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') removeMove(i)
                }}
              >
                <Trash2 size={9} /> Remove
              </span>
            </div>
            <FieldRow label="Type">
              <SelectInput
                value={m.type}
                onChange={(v) => updMove(i, { type: v as CameraMove['type'] })}
                options={CAMERA_PRESETS}
              />
            </FieldRow>
            <FieldRow label="Start">
              <NumberInput value={startAt} onChange={(v) => updParam(i, 'startAt', v)} min={0} step={0.1} unit="s" />
            </FieldRow>
            <FieldRow label="Duration">
              <NumberInput value={duration} onChange={(v) => updParam(i, 'duration', v)} min={0} step={0.1} unit="s" />
            </FieldRow>
          </div>
        )
      })}
      <div className="pt-1">
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center gap-1 text-[10px] cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-accent)' }}
          onClick={addMove}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addMove()
          }}
        >
          <Plus size={10} /> Add camera move
        </span>
      </div>
    </div>
  )
}

// ── Transition editor ────────────────────────────────────────────────────────

function TransitionEditor({ scene, upd }: { scene: Scene; upd: (updates: Partial<Scene>) => void }) {
  const options: { value: string; label: string }[] = []
  for (const group of TRANSITION_UI_GROUPS) {
    for (const item of group.items) {
      options.push({ value: item.id, label: `${group.category} · ${item.label}` })
    }
  }
  return (
    <div className="space-y-2">
      <FieldRow label="Style">
        <SelectInput
          value={scene.transition ?? 'none'}
          onChange={(v) => upd({ transition: v as TransitionType })}
          options={options}
        />
      </FieldRow>
      <Muted className="text-[9px]">
        Transition runs between this scene and the next. Duration is controlled per-project in Export settings.
      </Muted>
    </div>
  )
}

// ── Style override editor ────────────────────────────────────────────────────

function StyleOverrideEditor({ scene, upd }: { scene: Scene; upd: (updates: Partial<Scene>) => void }) {
  const so: SceneStyleOverride = scene.styleOverride ?? {}
  const palette = (so.palette ?? ['#2d2d2d', '#e84545', '#4a90d9', '#50c878']) as [string, string, string, string]
  const updSo = (changes: Partial<SceneStyleOverride>) => upd({ styleOverride: { ...so, ...changes } })
  const updPalette = (idx: number, color: string) => {
    const next = [...palette] as [string, string, string, string]
    next[idx] = color
    updSo({ palette: next })
  }
  return (
    <div className="space-y-2">
      <SectionLabel>Palette</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {palette.map((c, i) => (
          <ColorInput key={i} value={c} onChange={(v) => updPalette(i, v)} />
        ))}
      </div>
      <FieldRow label="Font">
        <TextInput value={so.font ?? ''} onChange={(v) => updSo({ font: v || null })} placeholder="e.g. Inter, serif" />
      </FieldRow>
      <FieldRow label="Body">
        <TextInput
          value={so.bodyFont ?? ''}
          onChange={(v) => updSo({ bodyFont: v || null })}
          placeholder="Body font (optional)"
        />
      </FieldRow>
      <FieldRow label="BG color">
        <ColorInput value={so.bgColor ?? '#ffffff'} onChange={(v) => updSo({ bgColor: v })} />
      </FieldRow>
      <FieldRow label="Roughness">
        <NumberInput
          value={so.roughnessLevel ?? 0}
          onChange={(v) => updSo({ roughnessLevel: v })}
          min={0}
          max={3}
          step={1}
        />
      </FieldRow>
      <FieldRow label="Stroke">
        <ColorInput value={so.strokeColorOverride ?? '#000000'} onChange={(v) => updSo({ strokeColorOverride: v })} />
      </FieldRow>
      <FieldRow label="Stroke W">
        <NumberInput
          value={so.strokeWidth ?? 2}
          onChange={(v) => updSo({ strokeWidth: v })}
          min={0}
          max={20}
          step={0.5}
          unit="px"
        />
      </FieldRow>
      <FieldRow label="Note">
        <TextInput
          value={so.styleNote ?? ''}
          onChange={(v) => updSo({ styleNote: v || null })}
          placeholder="Optional style note for the agent"
          multiline
        />
      </FieldRow>
    </div>
  )
}

// ── Variables editor ─────────────────────────────────────────────────────────

function renameVariableInInteractions(
  interactions: Scene['interactions'],
  oldName: string,
  newName: string,
): Scene['interactions'] {
  return interactions.map((ix) => {
    if (ix.type === 'slider' || ix.type === 'toggle') {
      if (ix.setsVariable !== oldName) return ix
      return { ...ix, setsVariable: newName }
    }
    if (ix.type === 'form') {
      const touched = ix.setsVariables.some((m) => m.variableName === oldName)
      if (!touched) return ix
      return {
        ...ix,
        setsVariables: ix.setsVariables.map((m) => (m.variableName === oldName ? { ...m, variableName: newName } : m)),
      }
    }
    return ix
  })
}

function VariablesEditor({ scene, upd }: { scene: Scene; upd: (updates: Partial<Scene>) => void }) {
  const vars: SceneVariable[] = scene.variables ?? []
  const replace = (next: SceneVariable[], extras: Partial<Scene> = {}) => upd({ variables: next, ...extras })
  const updVar = (idx: number, changes: Partial<SceneVariable>) => {
    const current = vars[idx]
    if (!current) return
    // Variables are keyed by name downstream (conditions, runtime evaluator, store actions).
    // Reject renames that collide with another variable's name.
    if (typeof changes.name === 'string' && changes.name !== current.name) {
      const collides = vars.some((v, i) => i !== idx && v.name === changes.name)
      if (collides) return
      // Rewrite scene-local references so slider/toggle/form bindings follow the rename.
      const nextVars = vars.map((v, i) => (i === idx ? { ...v, ...changes } : v))
      const nextInteractions = renameVariableInInteractions(scene.interactions, current.name, changes.name)
      replace(nextVars, { interactions: nextInteractions })
      return
    }
    replace(vars.map((v, i) => (i === idx ? { ...v, ...changes } : v)))
  }
  const removeVar = (idx: number) => {
    replace(vars.filter((_, i) => i !== idx))
  }
  const addVar = () => {
    let i = 1
    const taken = new Set(vars.map((v) => v.name))
    while (taken.has(`var${i}`)) i++
    replace([...vars, { name: `var${i}`, type: 'string', defaultValue: '' }])
  }
  const coerceDefault = (raw: string, type: SceneVariable['type']): SceneVariable['defaultValue'] => {
    if (type === 'number') {
      const n = parseFloat(raw)
      return Number.isFinite(n) ? n : 0
    }
    if (type === 'boolean') return raw === 'true'
    return raw
  }
  return (
    <div className="space-y-2">
      {vars.length === 0 && <Muted>No variables defined.</Muted>}
      {vars.map((v, i) => (
        <div key={i} className="space-y-1 rounded border px-2 py-1.5" style={{ borderColor: 'var(--color-hairline)' }}>
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
            >
              Variable {i + 1}
            </span>
            <span
              role="button"
              tabIndex={0}
              className="inline-flex items-center gap-1 text-[9px] cursor-pointer hover:opacity-80"
              style={{ color: '#ef4444' }}
              onClick={() => removeVar(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') removeVar(i)
              }}
            >
              <Trash2 size={9} /> Remove
            </span>
          </div>
          <FieldRow label="Name">
            <TextInput value={v.name} onChange={(val) => updVar(i, { name: val })} placeholder="name" />
          </FieldRow>
          <FieldRow label="Type">
            <SelectInput
              value={v.type ?? 'string'}
              onChange={(val) =>
                updVar(i, {
                  type: val as SceneVariable['type'],
                  defaultValue: coerceDefault(String(v.defaultValue ?? ''), val as SceneVariable['type']),
                })
              }
              options={[
                { value: 'string', label: 'String' },
                { value: 'number', label: 'Number' },
                { value: 'boolean', label: 'Boolean' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Default">
            {(v.type ?? 'string') === 'boolean' ? (
              <SelectInput
                value={String(Boolean(v.defaultValue))}
                onChange={(val) => updVar(i, { defaultValue: val === 'true' })}
                options={[
                  { value: 'true', label: 'true' },
                  { value: 'false', label: 'false' },
                ]}
              />
            ) : (v.type ?? 'string') === 'number' ? (
              <NumberInput value={Number(v.defaultValue ?? 0)} onChange={(val) => updVar(i, { defaultValue: val })} />
            ) : (
              <TextInput
                value={String(v.defaultValue ?? '')}
                onChange={(val) => updVar(i, { defaultValue: val })}
                placeholder="Default value"
              />
            )}
          </FieldRow>
        </div>
      ))}
      <div className="pt-1">
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center gap-1 text-[10px] cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-accent)' }}
          onClick={addVar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addVar()
          }}
        >
          <Plus size={10} /> Add variable
        </span>
      </div>
    </div>
  )
}

// ── 3D world editors ─────────────────────────────────────────────────────────

type WorldUpd = (updates: Partial<Scene>) => void

function updWorld(wc: WorldConfig, changes: Partial<WorldConfig>, upd: WorldUpd) {
  upd({ worldConfig: { ...wc, ...changes } })
}

function Vec3Row({
  label,
  value,
  onChange,
  step = 0.1,
  suffix,
}: {
  label: string
  value: [number, number, number]
  onChange: (v: [number, number, number]) => void
  step?: number
  suffix?: string
}) {
  return (
    <FieldRow label={label}>
      <div className="grid grid-cols-3 gap-1">
        {(['x', 'y', 'z'] as const).map((axis, i) => (
          <div key={axis} className="flex items-center gap-1">
            <span
              className="text-[9px] w-3 shrink-0 text-center font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {axis}
            </span>
            <input
              className="flex-1 min-w-0 rounded border px-1.5 py-0.5 text-[10px] bg-transparent outline-none focus:border-[#e84545]/50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              type="number"
              value={value[i]}
              step={step}
              onChange={(e) => {
                const next = [...value] as [number, number, number]
                next[i] = parseFloat(e.target.value) || 0
                onChange(next)
              }}
            />
            {suffix && (
              <span className="text-[8px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                {suffix}
              </span>
            )}
          </div>
        ))}
      </div>
    </FieldRow>
  )
}

const WORLD_ENVIRONMENTS: { value: WorldEnvironment; label: string }[] = [
  { value: 'meadow', label: 'Meadow' },
  { value: 'studio_room', label: 'Studio Room' },
  { value: 'void_space', label: 'Void Space' },
]

function WorldEnvEditor({ wc, upd }: { wc: WorldConfig; upd: WorldUpd }) {
  const set = (changes: Partial<WorldConfig>) => updWorld(wc, changes, upd)
  return (
    <div className="space-y-2">
      <FieldRow label="Preset">
        <SelectInput
          value={wc.environment}
          onChange={(v) => set({ environment: v as WorldEnvironment })}
          options={WORLD_ENVIRONMENTS}
        />
      </FieldRow>
      {wc.environment === 'meadow' && (
        <>
          <FieldRow label="Time">
            <SelectInput
              value={wc.timeOfDay ?? 'afternoon'}
              onChange={(v) => set({ timeOfDay: v as WorldConfig['timeOfDay'] })}
              options={[
                { value: 'morning', label: 'Morning' },
                { value: 'afternoon', label: 'Afternoon' },
                { value: 'sunset', label: 'Sunset' },
                { value: 'night', label: 'Night' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Wind">
            <NumberInput
              value={wc.windStrength ?? 0.5}
              onChange={(v) => set({ windStrength: v })}
              min={0}
              max={2}
              step={0.05}
            />
          </FieldRow>
          <FieldRow label="Grass">
            <NumberInput
              value={wc.grassDensity ?? 1}
              onChange={(v) => set({ grassDensity: v })}
              min={0}
              max={3}
              step={0.1}
            />
          </FieldRow>
        </>
      )}
      {wc.environment === 'studio_room' && (
        <FieldRow label="Style">
          <SelectInput
            value={wc.roomStyle ?? 'studio'}
            onChange={(v) => set({ roomStyle: v as WorldConfig['roomStyle'] })}
            options={[
              { value: 'classroom', label: 'Classroom' },
              { value: 'office', label: 'Office' },
              { value: 'studio', label: 'Studio' },
            ]}
          />
        </FieldRow>
      )}
      {wc.environment === 'void_space' && (
        <FieldRow label="Layout">
          <SelectInput
            value={wc.spaceLayout ?? 'grid'}
            onChange={(v) => set({ spaceLayout: v as WorldConfig['spaceLayout'] })}
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'arc', label: 'Arc' },
              { value: 'spiral', label: 'Spiral' },
              { value: 'random', label: 'Random' },
            ]}
          />
        </FieldRow>
      )}
    </div>
  )
}

function WorldObjectEditor({
  wc,
  index,
  upd,
  updAndDelete,
}: {
  wc: WorldConfig
  index: number
  upd: WorldUpd
  updAndDelete: WorldUpd
}) {
  const objs: WorldObjectConfig[] = wc.objects ?? []
  const obj = objs[index]
  if (!obj) return <Muted>Object not found</Muted>
  const updObj = (changes: Partial<WorldObjectConfig>) => {
    const next = objs.map((o, i) => (i === index ? { ...o, ...changes } : o))
    updWorld(wc, { objects: next }, upd)
  }
  const remove = () => {
    const next = objs.filter((_, i) => i !== index)
    updAndDelete({ worldConfig: { ...wc, objects: next } })
  }
  return (
    <div className="space-y-2">
      <FieldRow label="Asset">
        <TextInput
          value={obj.assetId ?? ''}
          onChange={(v) => updObj({ assetId: v })}
          placeholder="model.glb or builtin id"
        />
      </FieldRow>
      <SectionLabel>Transform</SectionLabel>
      <Vec3Row label="Pos" value={obj.position ?? [0, 0, 0]} onChange={(v) => updObj({ position: v })} />
      <Vec3Row
        label="Rot"
        value={obj.rotation ?? [0, 0, 0]}
        onChange={(v) => updObj({ rotation: v })}
        step={1}
        suffix="°"
      />
      <FieldRow label="Scale">
        <NumberInput value={obj.scale ?? 1} onChange={(v) => updObj({ scale: v })} min={0} step={0.05} />
      </FieldRow>
      <DeleteRow onDelete={remove} label="3D object" />
    </div>
  )
}

function WorldPanelEditor({
  wc,
  index,
  upd,
  updAndDelete,
}: {
  wc: WorldConfig
  index: number
  upd: WorldUpd
  updAndDelete: WorldUpd
}) {
  const panels: WorldPanelConfig[] = wc.panels ?? []
  const p = panels[index]
  if (!p) return <Muted>Panel not found</Muted>
  const updP = (changes: Partial<WorldPanelConfig>) => {
    const next = panels.map((x, i) => (i === index ? { ...x, ...changes } : x))
    updWorld(wc, { panels: next }, upd)
  }
  const remove = () => {
    const next = panels.filter((_, i) => i !== index)
    updAndDelete({ worldConfig: { ...wc, panels: next } })
  }
  return (
    <div className="space-y-2">
      <FieldRow label="HTML">
        <TextInput
          value={p.html ?? ''}
          onChange={(v) => updP({ html: v })}
          multiline
          placeholder="<div>Panel content</div>"
        />
      </FieldRow>
      <SectionLabel>Transform</SectionLabel>
      <Vec3Row label="Pos" value={p.position ?? [0, 0, 0]} onChange={(v) => updP({ position: v })} />
      <Vec3Row
        label="Rot"
        value={p.rotation ?? [0, 0, 0]}
        onChange={(v) => updP({ rotation: v })}
        step={1}
        suffix="°"
      />
      <FieldRow label="Width">
        <NumberInput value={p.width ?? 1} onChange={(v) => updP({ width: v })} min={0} step={0.1} />
      </FieldRow>
      <FieldRow label="Height">
        <NumberInput value={p.height ?? 1} onChange={(v) => updP({ height: v })} min={0} step={0.1} />
      </FieldRow>
      <FieldRow label="Anim in">
        <TextInput
          value={p.animateIn ?? ''}
          onChange={(v) => updP({ animateIn: v || undefined })}
          placeholder="fade | slide-up | pop | none"
        />
      </FieldRow>
      <FieldRow label="At">
        <NumberInput value={p.animateAt ?? 0} onChange={(v) => updP({ animateAt: v })} min={0} step={0.1} unit="s" />
      </FieldRow>
      <DeleteRow onDelete={remove} label="panel" />
    </div>
  )
}

const AVATAR_MOODS: { value: AvatarMood; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'fear', label: 'Fear' },
  { value: 'surprise', label: 'Surprise' },
]

function WorldAvatarEditor({
  wc,
  index,
  upd,
  updAndDelete,
}: {
  wc: WorldConfig
  index: number
  upd: WorldUpd
  updAndDelete: WorldUpd
}) {
  const avatars: WorldAvatarConfig[] = wc.avatars ?? []
  const av = avatars[index]
  if (!av) return <Muted>Avatar not found</Muted>
  const updAv = (changes: Partial<WorldAvatarConfig>) => {
    const next = avatars.map((x, i) => (i === index ? { ...x, ...changes } : x))
    updWorld(wc, { avatars: next }, upd)
  }
  const remove = () => {
    const next = avatars.filter((_, i) => i !== index)
    updAndDelete({ worldConfig: { ...wc, avatars: next } })
  }
  return (
    <div className="space-y-2">
      <FieldRow label="Mood">
        <SelectInput
          value={av.mood ?? 'neutral'}
          onChange={(v) => updAv({ mood: v as AvatarMood })}
          options={AVATAR_MOODS}
        />
      </FieldRow>
      <FieldRow label="GLB URL">
        <TextInput
          value={av.glbUrl ?? ''}
          onChange={(v) => updAv({ glbUrl: v || undefined })}
          placeholder="https://…/avatar.glb"
        />
      </FieldRow>
      <SectionLabel>Transform</SectionLabel>
      <Vec3Row label="Pos" value={av.position ?? [0, 0, 0]} onChange={(v) => updAv({ position: v })} />
      <Vec3Row
        label="Rot"
        value={av.rotation ?? [0, 0, 0]}
        onChange={(v) => updAv({ rotation: v })}
        step={1}
        suffix="°"
      />
      <FieldRow label="Scale">
        <NumberInput value={av.scale ?? 1} onChange={(v) => updAv({ scale: v })} min={0} step={0.05} />
      </FieldRow>
      <DeleteRow onDelete={remove} label="avatar" />
    </div>
  )
}

function WorldCameraEditor({ wc, upd, updAndDelete }: { wc: WorldConfig; upd: WorldUpd; updAndDelete: WorldUpd }) {
  const keys: WorldCameraKeyframe[] = wc.cameraPath ?? []
  const replace = (next: WorldCameraKeyframe[]) => {
    updWorld(wc, { cameraPath: next.length > 0 ? next : undefined }, upd)
  }
  const updKey = (idx: number, changes: Partial<WorldCameraKeyframe>) => {
    replace(keys.map((k, i) => (i === idx ? { ...k, ...changes } : k)))
  }
  const removeKey = (idx: number) => {
    const next = keys.filter((_, i) => i !== idx)
    updAndDelete({ worldConfig: { ...wc, cameraPath: next.length > 0 ? next : undefined } })
  }
  const addKey = () => {
    const last = keys[keys.length - 1]
    const nextT = last ? (last.t ?? 0) + 1 : 0
    replace([...keys, { t: nextT, pos: last?.pos ?? [0, 2, 5], lookAt: last?.lookAt ?? [0, 0, 0] }])
  }
  return (
    <div className="space-y-2">
      {keys.length === 0 && <Muted>No camera keyframes. Add one below.</Muted>}
      {keys.map((k, i) => (
        <div
          key={i}
          className="space-y-1.5 rounded border px-2 py-1.5"
          style={{ borderColor: 'var(--color-hairline)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
            >
              Keyframe {i + 1}
            </span>
            <span
              role="button"
              tabIndex={0}
              className="inline-flex items-center gap-1 text-[9px] cursor-pointer hover:opacity-80"
              style={{ color: '#ef4444' }}
              onClick={() => removeKey(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') removeKey(i)
              }}
            >
              <Trash2 size={9} /> Remove
            </span>
          </div>
          <FieldRow label="Time">
            <NumberInput value={k.t ?? 0} onChange={(v) => updKey(i, { t: v })} min={0} step={0.1} unit="s" />
          </FieldRow>
          <Vec3Row label="Pos" value={k.pos ?? [0, 0, 0]} onChange={(v) => updKey(i, { pos: v })} />
          <Vec3Row label="Look" value={k.lookAt ?? [0, 0, 0]} onChange={(v) => updKey(i, { lookAt: v })} />
        </div>
      ))}
      <div className="pt-1">
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center gap-1 text-[10px] cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-accent)' }}
          onClick={addKey}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addKey()
          }}
        >
          <Plus size={10} /> Add keyframe
        </span>
      </div>
    </div>
  )
}

function ThreePresetEditor({ scene, upd }: { scene: Scene; upd: WorldUpd }) {
  const current = scene.threeEnvironmentPresetId ?? ''
  return (
    <div className="space-y-2">
      <FieldRow label="Preset">
        <SelectInput
          value={current}
          onChange={(v) => upd({ threeEnvironmentPresetId: v || null })}
          options={[
            { value: '', label: 'None' },
            ...CENCH_THREE_ENVIRONMENTS.map((env) => ({ value: env.id, label: env.name })),
          ]}
        />
      </FieldRow>
      {current && (
        <Muted className="text-[9px]">
          {CENCH_THREE_ENVIRONMENTS.find((e) => e.id === current)?.description ?? ''}
        </Muted>
      )}
    </div>
  )
}

// ── rx:* source-level fallback editor (when no iframe element matched) ──────

function RxSourceTextEditor({
  scene,
  kind,
  index,
  upd,
}: {
  scene: Scene
  kind: PatchableKind
  index: number
  upd: (updates: Partial<Scene>) => void
}) {
  // Pick the best source to patch. reactCode is primary; fall back to sceneCode
  // for legacy Motion/Canvas2D scenes that also surface rx:* nodes.
  const pickSource = (): { code: string; field: 'reactCode' | 'sceneCode' } | null => {
    if (scene.reactCode?.trim()) return { code: scene.reactCode, field: 'reactCode' }
    if (scene.sceneCode?.trim()) return { code: scene.sceneCode, field: 'sceneCode' }
    return null
  }
  const source = pickSource()
  const current = source ? readReactCodeText(source.code, kind, index) : null

  const labels: Record<PatchableKind, string> = {
    heading: 'Heading',
    paragraph: 'Paragraph',
    image: 'Alt text',
  }

  if (!source || current == null) {
    return (
      <div className="space-y-1.5">
        <FieldRow label="Type">
          <Muted>{labels[kind]}</Muted>
        </FieldRow>
        <Muted className="text-[9px]">
          Couldn&apos;t locate this element in source code. Click it in the preview to edit via Inspector, or edit the
          scene code directly.
        </Muted>
      </div>
    )
  }

  const handleChange = (next: string) => {
    if (next === current) return
    const rewritten = patchReactCodeText(source.code, kind, index, next)
    if (rewritten == null) return
    upd({ [source.field]: rewritten } as Partial<Scene>)
  }

  return (
    <div className="space-y-2">
      <FieldRow label={labels[kind]}>
        <TextInput value={current} onChange={handleChange} multiline placeholder={labels[kind]} />
      </FieldRow>
      <Muted className="text-[9px]">
        Editing source at <strong>{source.field}</strong>. Characters like <code>&lt;</code>, <code>&#123;</code>,{' '}
        <code>&#125;</code> are escaped automatically.
      </Muted>
    </div>
  )
}

// ── Match rx: node to Inspector element ─────────────────────────────────────

/** Map rx node kind to Inspector element types for matching */
const RX_TO_INSPECTOR_TYPES: Record<string, string[]> = {
  heading: ['dom-text'],
  paragraph: ['dom-text'],
  text: ['dom-text'],
  svg: ['svg-path', 'svg-text', 'svg-shape'],
  image: ['dom-image'],
  three: ['dom-container'],
  canvas2d: ['dom-container'],
  d3: ['dom-container'],
  lottie: ['dom-container'],
}

/** Tag hints for more precise matching within same type */
const RX_TAG_HINTS: Record<string, RegExp> = {
  heading: /^(h[1-6]|auto-h[1-6])/i,
  paragraph: /^(p|auto-p)/i,
  image: /^(img|auto-img)/i,
}

function matchRxToInspectorElement(
  rxKind: string,
  rxIdx: number,
  elements: Record<string, SceneElement>,
): SceneElement | null {
  const targetTypes = RX_TO_INSPECTOR_TYPES[rxKind]
  if (!targetTypes) return null

  const tagHint = RX_TAG_HINTS[rxKind]
  const candidates = Object.values(elements).filter((el) => {
    if (!targetTypes.includes(el.type)) return false
    if (tagHint && !tagHint.test(el.id)) return false
    return true
  })

  return candidates[rxIdx] ?? candidates[0] ?? null
}

// ── Property controls for code-extracted (rx:) elements ─────────────────────

function RxElementControls({ element, sceneId }: { element: SceneElement; sceneId: string }) {
  const { patchInspectorElement, globalStyle } = useVideoStore()
  const palette = globalStyle.paletteOverride ?? ['#2d2d2d', '#e84545', '#4a90d9', '#50c878']
  const propertyMap = getElementPropertyMap()
  const properties = propertyMap[element.type] ?? []

  const handlePatch = useCallback(
    (property: string, value: unknown) => {
      patchInspectorElement(element.id, property, value)
      const iframe = document.querySelector(`iframe[data-scene-id="${sceneId}"]`) as HTMLIFrameElement | null
      patchElementInIframe(iframe, element.id, property, value)
    },
    [element.id, sceneId, patchInspectorElement],
  )

  if (properties.length === 0) {
    return <Muted>Element type "{element.type}" has no editable properties</Muted>
  }

  // Group properties
  const groups = new Map<string, typeof properties>()
  for (const prop of properties) {
    const group = prop.group ?? 'Properties'
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(prop)
  }

  return (
    <div className="space-y-2">
      <FieldRow label="Element">
        <Muted>{element.label}</Muted>
      </FieldRow>
      {[...groups.entries()].map(([groupName, groupProps]) => (
        <div key={groupName}>
          <SectionLabel>{groupName}</SectionLabel>
          <div className="space-y-1">
            {groupProps.map((prop) => {
              const value = (element as unknown as Record<string, unknown>)[prop.key]
              return (
                <RxPropertyControl
                  key={prop.key}
                  prop={prop}
                  value={value}
                  palette={palette}
                  onChange={(v) => handlePatch(prop.key, v)}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function RxPropertyControl({
  prop,
  value,
  palette,
  onChange,
}: {
  prop: {
    key: string
    label: string
    control: string
    min?: number
    max?: number
    step?: number
    suffix?: string
    options?: string[]
    optionLabels?: string[]
    allowNone?: boolean
  }
  value: unknown
  palette: string[]
  onChange: (value: unknown) => void
}) {
  switch (prop.control) {
    case 'color':
      return (
        <ColorPicker
          label={prop.label}
          value={String(value ?? 'none')}
          palette={palette}
          allowNone={prop.allowNone}
          onChange={(v) => onChange(v === 'none' ? null : v)}
        />
      )
    case 'slider':
      return (
        <SliderInput
          label={prop.label}
          value={Number(value ?? 0)}
          min={prop.min ?? 0}
          max={prop.max ?? 1}
          step={prop.step ?? 0.01}
          onChange={onChange}
        />
      )
    case 'select':
      return (
        <InspectorSelect
          label={prop.label}
          value={String(value ?? '')}
          options={prop.options ?? []}
          optionLabels={prop.optionLabels}
          onChange={onChange}
        />
      )
    case 'textarea':
      return <TextareaInput label={prop.label} value={String(value ?? '')} onChange={(v) => onChange(v)} />
    case 'number':
      return (
        <FieldRow label={prop.label}>
          <NumberInput
            value={Number(value ?? 0)}
            onChange={(v) => onChange(v)}
            min={prop.min}
            max={prop.max}
            step={prop.step ?? 1}
            unit={prop.suffix}
          />
        </FieldRow>
      )
    default:
      return null
  }
}

// ── Figma-style Transform Grid ──────────────────────────────────────────────

type TransformField = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'zIndex'

const FIELD_META: Record<TransformField, { label: string; unit?: string; min?: number; max?: number; step?: number }> =
  {
    x: { label: 'X', unit: '%', min: 0, max: 100 },
    y: { label: 'Y', unit: '%', min: 0, max: 100 },
    width: { label: 'W', unit: '%', min: 1, max: 100 },
    height: { label: 'H', unit: '%', min: 1, max: 100 },
    rotation: { label: 'R', unit: '\u00B0', min: -360, max: 360, step: 1 },
    opacity: { label: '\u03B1', min: 0, max: 1, step: 0.05 },
    zIndex: { label: 'Z', min: 0, max: 20, step: 1 },
  }

function TransformGrid({
  values,
  onChange,
  fields,
}: {
  values: Partial<Record<TransformField, number>>
  onChange: (field: string, value: number) => void
  fields: TransformField[]
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
      {fields.map((f) => {
        const meta = FIELD_META[f]
        const val = values[f] ?? 0
        return (
          <div key={f} className="flex items-center gap-1">
            <span
              className="text-[9px] w-3 shrink-0 text-center font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {meta.label}
            </span>
            <input
              className="flex-1 min-w-0 rounded border px-1.5 py-0.5 text-[10px] bg-transparent outline-none focus:border-[#e84545]/50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              type="number"
              value={val}
              min={meta.min}
              max={meta.max}
              step={meta.step}
              onChange={(e) => onChange(f, parseFloat(e.target.value) || 0)}
            />
            {meta.unit && (
              <span className="text-[8px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                {meta.unit}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Shared field components ──────────────────────────────────────────────────

function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] ${className ?? ''}`} style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-1.5 pb-0.5">
      <span
        className="text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
      >
        {children}
      </span>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-14 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const cls = 'w-full rounded border px-2 py-1 text-[11px] bg-transparent outline-none focus:border-[#e84545]/50'
  const style = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }
  if (multiline) {
    return (
      <textarea
        className={cls + ' resize-y min-h-[40px]'}
        style={style}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
      />
    )
  }
  return (
    <input
      className={cls}
      style={style}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        className="w-full rounded border px-2 py-1 text-[11px] bg-transparent outline-none focus:border-[#e84545]/50"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {unit && (
        <span className="text-[9px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {unit}
        </span>
      )}
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        className="w-5 h-5 rounded cursor-pointer border-0 p-0"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="flex-1 rounded border px-2 py-1 text-[11px] bg-transparent outline-none focus:border-[#e84545]/50"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
      />
    </div>
  )
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      className="w-full rounded border px-2 py-1 text-[11px] bg-transparent outline-none"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function DeleteRow({ onDelete, label }: { onDelete: () => void; label: string }) {
  return (
    <div className="pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <span
        role="button"
        tabIndex={0}
        className="inline-flex items-center gap-1 text-[10px] cursor-pointer hover:opacity-80"
        style={{ color: '#ef4444' }}
        onClick={onDelete}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onDelete()
        }}
      >
        <Trash2 size={10} /> Remove {label}
      </span>
    </div>
  )
}

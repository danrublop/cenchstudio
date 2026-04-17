'use client'

import { useCallback, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { Scene, TextOverlay, AILayer, D3ChartLayer, PhysicsLayer, InteractionElement } from '@/lib/types'
import { BG_STAGE_STACK_KEY, type LayerStackKey, parseLayerStackKey, pinLayerStackTail } from '@/lib/layer-stack-keys'
import { useVideoStore } from '@/lib/store'
import { buildDefaultOrder, mergeOrder, labelForKey, iconForKey } from './SceneLayersStackPanel'
import type { NodeMapKey } from './NodeMapCanvas'
import type { SceneElement } from '@/lib/types/elements'
import { getElementPropertyMap } from '@/lib/types/elements'
import { patchElementInIframe } from '@/lib/scene-patcher'
import { ColorPicker } from '@/components/inspector/controls/ColorPicker'
import { SliderInput } from '@/components/inspector/controls/SliderInput'
import { SelectInput as InspectorSelect } from '@/components/inspector/controls/SelectInput'
import { TextareaInput } from '@/components/inspector/controls/TextareaInput'

// ── Debounced save timer (module-level, mirrors inspector-actions pattern) ───

let _nodeMapSaveTimer: ReturnType<typeof setTimeout> | null = null
let _bgSaveTimer: ReturnType<typeof setTimeout> | null = null

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
  const orderedKeys = useMemo(
    () => mergeOrder(scene.layerPanelOrder, fallbackOrder),
    [scene.layerPanelOrder, fallbackOrder],
  )

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
      if (orderedKeys[index] === 'audio' || orderedKeys[j] === 'audio') return
      if (orderedKeys[index] === BG_STAGE_STACK_KEY || orderedKeys[j] === BG_STAGE_STACK_KEY) return
      const next = [...orderedKeys]
      ;[next[index], next[j]] = [next[j], next[index]]
      upd({ layerPanelOrder: [...pinLayerStackTail(next)] })
    },
    [orderedKeys, upd],
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
                  className={`no-style flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ${isBgStage ? 'cursor-default opacity-40 pointer-events-none' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isBgStage) toggleHidden(key)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      if (!isBgStage) toggleHidden(key)
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
                      key === 'audio' || isBgStage || index === 0 ? 'opacity-25 pointer-events-none' : ''
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
                      key === 'audio' || isBgStage || index === orderedKeys.length - 1
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
        const rxLabels: Record<string, string> = {
          three: 'Three.js bridge',
          canvas2d: 'Canvas 2D bridge',
          d3: 'D3 bridge',
          svg: 'SVG element',
          lottie: 'Lottie bridge',
          heading: 'Heading',
          paragraph: 'Text paragraph',
          text: 'Text element',
          image: 'Image',
        }
        return (
          <div className="space-y-1.5">
            <FieldRow label="Type">
              <Muted>{rxLabels[rxKind] ?? rxKind}</Muted>
            </FieldRow>
            <Muted className="text-[9px]">
              Loading element properties... If controls don't appear, try clicking the element in the preview to edit
              via Inspector.
            </Muted>
          </div>
        )
      }

      return <RxElementControls element={matchedElement} sceneId={scene.id} />
    }

    default:
      return <Muted>No editable properties</Muted>
  }
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

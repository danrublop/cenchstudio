'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Plus, Type } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { Scene, TextOverlay } from '@/lib/types'
import { compileD3SceneFromLayers } from '@/lib/charts/compile'
import { deriveChartLayersFromScene } from '@/lib/charts/extract'
import {
  applyTextSlotValue,
  collectTextSlots,
  getTextSlotValue,
  layerHiddenIdForTextSlot,
  parseChartTitleSlotKey,
  type TextSlot,
} from '@/lib/text-slots'

interface Props {
  scene: Scene
}

/** Bottom panel: matches `SceneLayersStackPanel` chrome (border-t, header bar, scroll list, row styling). */
function sceneHeading(scene: Scene): string {
  const n = scene.name?.trim()
  if (n) return n
  const p = scene.prompt?.trim()
  if (p) return p.length > 48 ? `${p.slice(0, 48)}…` : p
  return 'Untitled scene'
}

function AllTextStackPanel({
  scene,
  slots,
  selectedKey,
  addOverlayOpen,
  onAddOverlayClick,
  onSelectKey,
  onActivateKey,
  updateScene,
}: {
  scene: Scene
  slots: TextSlot[]
  selectedKey: string | null
  addOverlayOpen: boolean
  onAddOverlayClick: () => void
  onSelectKey: (key: string | null) => void
  onActivateKey: (key: string) => void
  updateScene: (sceneId: string, patch: Partial<Scene>) => void
}) {
  const sceneTitle = sceneHeading(scene)
  const hidden = new Set(scene.layerHiddenIds ?? [])

  const toggleTextSlotVisibility = (slotKey: string) => {
    const k = layerHiddenIdForTextSlot(slotKey)
    const h = new Set(scene.layerHiddenIds ?? [])
    if (h.has(k)) h.delete(k)
    else h.add(k)
    updateScene(scene.id, { layerHiddenIds: Array.from(h) })
  }

  return (
    <div
      className="flex shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-panel)]"
      data-text-all-stack
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border)] px-2 py-1.5">
        <span
          className="shrink-0 text-[var(--color-text-muted)]"
          data-tooltip={`Text · ${slots.length} item${slots.length === 1 ? '' : 's'}`}
          data-tooltip-pos="bottom-left"
        >
          <Type size={12} strokeWidth={2.25} aria-hidden />
        </span>
        <span
          className="chat-tab relative min-w-0 w-fit max-w-[min(240px,calc(100%-3.25rem))] overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 text-[11px] text-[var(--kbd-text)]"
          title={sceneTitle}
        >
          <span className="block truncate">{sceneTitle}</span>
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <button
            type="button"
            className="no-style kbd flex h-7 w-7 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            aria-expanded={addOverlayOpen}
            aria-label={addOverlayOpen ? 'Close new text overlay' : 'New text overlay'}
            onClick={onAddOverlayClick}
          >
            <Plus size={14} strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <div className="max-h-[min(45vh,360px)] min-h-0 overflow-y-auto overscroll-contain px-1 py-1">
        <ul className="space-y-0.5">
          {slots.length === 0 ? (
            <li className="px-1 py-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">No text in this scene yet.</p>
            </li>
          ) : (
            slots.map((s) => {
              const isSel = selectedKey === s.key
              const line = (s.preview || '').trim() || (s.label || '').trim() || '(empty)'
              const hid = layerHiddenIdForTextSlot(s.key)
              const isHidden = hidden.has(hid)
              return (
                <li key={s.key}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectKey(isSel ? null : s.key)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      onActivateKey(s.key)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectKey(isSel ? null : s.key)
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 ${
                      isSel
                        ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/40'
                        : 'hover:bg-white/[0.04]'
                    }`}
                    title={`${s.badge} — click to edit · double-click focuses`}
                  >
                    <button
                      type="button"
                      className="no-style flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      aria-label={isHidden ? 'Show layer' : 'Hide layer'}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTextSlotVisibility(s.key)
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <Type size={12} className="shrink-0 text-[var(--color-text-muted)]" strokeWidth={2.25} />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-text-primary)]">{line}</span>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}

export default function TextTab({ scene }: Props) {
  const updateScene = useVideoStore((s) => s.updateScene)
  const saveSceneHTML = useVideoStore((s) => s.saveSceneHTML)
  const textEditorSlotKey = useVideoStore((s) => s.textEditorSlotKey)
  const setTextEditorSlotKey = useVideoStore((s) => s.setTextEditorSlotKey)
  const openTextTabForSlot = useVideoStore((s) => s.openTextTabForSlot)
  const addTextOverlay = useVideoStore((s) => s.addTextOverlay)
  const updateTextOverlay = useVideoStore((s) => s.updateTextOverlay)

  const [slots, setSlots] = useState<TextSlot[]>([])
  useEffect(() => {
    setSlots(collectTextSlots(scene))
  }, [scene])

  const activeSlot = useMemo(
    () => (textEditorSlotKey ? slots.find((s) => s.key === textEditorSlotKey) : null),
    [slots, textEditorSlotKey],
  )

  const [draft, setDraft] = useState('')
  useEffect(() => {
    if (!textEditorSlotKey) {
      setDraft('')
      return
    }
    setDraft(getTextSlotValue(scene, textEditorSlotKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditorSlotKey])

  useEffect(() => {
    if (textEditorSlotKey && slots.length > 0 && !slots.some((s) => s.key === textEditorSlotKey)) {
      setTextEditorSlotKey(null)
    }
  }, [textEditorSlotKey, slots, setTextEditorSlotKey])

  const commitDraft = useCallback(() => {
    if (!textEditorSlotKey) return
    const { patch, saveHtml } = applyTextSlotValue(scene, textEditorSlotKey, draft)
    if (Object.keys(patch).length === 0) return
    updateScene(scene.id, patch)
    if (saveHtml) void saveSceneHTML(scene.id)
  }, [textEditorSlotKey, draft, scene, updateScene, saveSceneHTML])

  const overlay =
    textEditorSlotKey?.startsWith('overlay:') === true
      ? scene.textOverlays?.find((t) => t.id === textEditorSlotKey!.slice('overlay:'.length))
      : undefined

  const chartTitleLayerId = useMemo(
    () => (textEditorSlotKey ? (parseChartTitleSlotKey(textEditorSlotKey)?.layerId ?? null) : null),
    [textEditorSlotKey],
  )

  const chartTitleLayer = useMemo(() => {
    if (!chartTitleLayerId) return null
    return deriveChartLayersFromScene(scene).find((c) => c.id === chartTitleLayerId) ?? null
  }, [scene, chartTitleLayerId])

  const patchOverlay = useCallback(
    (updates: Partial<TextOverlay>) => {
      if (!overlay) return
      const next = (scene.textOverlays ?? []).map((t) => (t.id === overlay.id ? { ...t, ...updates } : t))
      updateScene(scene.id, { textOverlays: next })
      void saveSceneHTML(scene.id)
    },
    [overlay, scene.id, scene.textOverlays, updateScene, saveSceneHTML],
  )

  const patchChartTitleConfig = useCallback(
    (configUpdates: Record<string, unknown>) => {
      const id = parseChartTitleSlotKey(textEditorSlotKey ?? '')?.layerId
      if (!id) return
      const layers = deriveChartLayersFromScene(scene)
      const next = layers.map((c) => (c.id === id ? { ...c, config: { ...c.config, ...configUpdates } } : c))
      const compiled = compileD3SceneFromLayers(next)
      updateScene(scene.id, {
        chartLayers: next,
        sceneCode: compiled.sceneCode,
        d3Data: compiled.d3Data as Scene['d3Data'],
        sceneType: 'd3',
      })
      void saveSceneHTML(scene.id)
    },
    [textEditorSlotKey, scene, updateScene, saveSceneHTML],
  )

  const onSelectKey = useCallback(
    (key: string | null) => {
      setTextEditorSlotKey(key)
    },
    [setTextEditorSlotKey],
  )

  const onActivateKey = useCallback(
    (key: string) => {
      openTextTabForSlot(key)
    },
    [openTextTabForSlot],
  )

  const handleCreateTextOverlay = useCallback(
    (content: string) => {
      addTextOverlay(scene.id)
      const s = useVideoStore.getState().scenes.find((x) => x.id === scene.id)
      const last = s?.textOverlays?.slice(-1)[0]
      if (last) {
        const trimmed = content.trim()
        if (trimmed) updateTextOverlay(scene.id, last.id, { content: trimmed })
        void saveSceneHTML(scene.id)
        setTextEditorSlotKey(`overlay:${last.id}`)
      }
    },
    [scene.id, addTextOverlay, updateTextOverlay, saveSceneHTML, setTextEditorSlotKey],
  )

  const [addingOverlay, setAddingOverlay] = useState(false)
  const [newOverlayDraft, setNewOverlayDraft] = useState('')

  const toggleAddOverlay = useCallback(() => {
    setAddingOverlay((open) => {
      if (open) {
        setNewOverlayDraft('')
        return false
      }
      setTextEditorSlotKey(null)
      return true
    })
  }, [setTextEditorSlotKey])

  const cancelAddOverlay = useCallback(() => {
    setNewOverlayDraft('')
    setAddingOverlay(false)
  }, [])

  const submitNewOverlay = useCallback(() => {
    handleCreateTextOverlay(newOverlayDraft)
    setNewOverlayDraft('')
    setAddingOverlay(false)
  }, [handleCreateTextOverlay, newOverlayDraft])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Editor / hints — scrolls above the fixed bottom list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2">
        {addingOverlay ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Text overlay</div>
                <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">New overlay</div>
              </div>
              <button
                type="button"
                className="kbd shrink-0 px-2 py-0.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                onClick={cancelAddOverlay}
              >
                Cancel
              </button>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                Content
              </label>
              <textarea
                value={newOverlayDraft}
                onChange={(e) => setNewOverlayDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelAddOverlay()
                  }
                }}
                rows={4}
                placeholder="What should it say?"
                autoFocus
                className="w-full resize-y rounded border px-2 py-1.5 text-sm focus:border-[#e84545] focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  minHeight: 72,
                }}
              />
            </div>
            <div className="flex justify-end gap-1 border-t border-[var(--color-border)] pt-2">
              <button
                type="button"
                className="kbd h-8 px-3 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                onClick={cancelAddOverlay}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kbd h-8 px-3 text-[11px] border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                onClick={submitNewOverlay}
              >
                Add overlay
              </button>
            </div>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col gap-2 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
            <Type size={28} className="mx-auto opacity-40" strokeWidth={1.5} />
            <p>Add overlays, SVG &lt;text&gt;, chart titles, interactions, or physics copy.</p>
            <p className="text-[11px]">
              Use <span className="text-[var(--color-text-primary)]">+</span> below to add a text overlay.
            </p>
          </div>
        ) : !textEditorSlotKey || !activeSlot ? (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Select a row in <span className="text-[var(--color-text-primary)]">Text</span> below, or double-click
              under <span className="text-[var(--color-text-primary)]">Layer stack → Text in scene</span>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                  {activeSlot.badge}
                </div>
                <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">{activeSlot.label}</div>
              </div>
              <button
                type="button"
                className="kbd shrink-0 px-2 py-0.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                onClick={() => setTextEditorSlotKey(null)}
              >
                Clear
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                {activeSlot.kind === 'chart' ? 'Title' : 'Content'}
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                rows={overlay || activeSlot.kind === 'chart' ? 3 : 6}
                className="w-full resize-y rounded border px-2 py-1.5 text-sm focus:border-[#e84545] focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  minHeight: 72,
                }}
              />
            </div>

            {overlay && (
              <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
                <div className="col-span-2">
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Font
                  </label>
                  <input
                    type="text"
                    value={overlay.font}
                    onChange={(e) => patchOverlay({ font: e.target.value })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Size
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={overlay.size}
                    onChange={(e) => patchOverlay({ size: parseInt(e.target.value, 10) || 48 })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Color
                  </label>
                  <input
                    type="color"
                    value={overlay.color}
                    onChange={(e) => patchOverlay({ color: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    X %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={overlay.x}
                    onChange={(e) => patchOverlay({ x: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Y %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={overlay.y}
                    onChange={(e) => patchOverlay({ y: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Delay (s)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={overlay.delay}
                    onChange={(e) => patchOverlay({ delay: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Duration (s)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={overlay.duration}
                    onChange={(e) => patchOverlay({ duration: parseFloat(e.target.value) || 0.6 })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Animation
                  </label>
                  <select
                    value={overlay.animation}
                    onChange={(e) => patchOverlay({ animation: e.target.value as TextOverlay['animation'] })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <option value="fade-in">Fade in</option>
                    <option value="slide-up">Slide up</option>
                    <option value="typewriter">Typewriter</option>
                  </select>
                </div>
              </div>
            )}

            {activeSlot.kind === 'chart' && chartTitleLayer && (
              <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
                <div className="col-span-2">
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Font family
                  </label>
                  <input
                    type="text"
                    value={String((chartTitleLayer.config as Record<string, unknown>).fontFamily ?? '')}
                    onChange={(e) => patchChartTitleConfig({ fontFamily: e.target.value })}
                    placeholder="e.g. Inter, system-ui"
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Chart font size
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={48}
                    value={
                      Number.isFinite(Number((chartTitleLayer.config as Record<string, unknown>).fontSize))
                        ? Number((chartTitleLayer.config as Record<string, unknown>).fontSize)
                        : 18
                    }
                    onChange={(e) => patchChartTitleConfig({ fontSize: parseInt(e.target.value, 10) || 18 })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Title size
                  </label>
                  <input
                    type="number"
                    min={24}
                    max={120}
                    value={
                      Number.isFinite(Number((chartTitleLayer.config as Record<string, unknown>).titleSize))
                        ? Number((chartTitleLayer.config as Record<string, unknown>).titleSize)
                        : 64
                    }
                    onChange={(e) => patchChartTitleConfig({ titleSize: parseInt(e.target.value, 10) || 64 })}
                    className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
                <p className="col-span-2 text-[10px] text-[var(--color-text-muted)]">
                  Title size controls the chart heading; chart font size affects axis and data labels (CenchCharts).
                </p>
              </div>
            )}

            {activeSlot.kind === 'svg_text' && (
              <p className="text-[10px] text-[var(--color-text-muted)]">
                SVG &lt;text&gt; — font and position stay in the SVG; edit wording here.
              </p>
            )}
          </div>
        )}
      </div>

      <AllTextStackPanel
        scene={scene}
        slots={slots}
        selectedKey={textEditorSlotKey}
        addOverlayOpen={addingOverlay}
        onAddOverlayClick={toggleAddOverlay}
        onSelectKey={(key) => {
          if (key) setAddingOverlay(false)
          onSelectKey(key)
        }}
        onActivateKey={(key) => {
          setAddingOverlay(false)
          onActivateKey(key)
        }}
        updateScene={updateScene}
      />
    </div>
  )
}

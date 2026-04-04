'use client'

import { useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, ListOrdered, X, RotateCcw } from 'lucide-react'
import type { Storyboard, StoryboardScene } from '@/lib/agents/types'
import { useVideoStore } from '@/lib/store'
import { ALL_TRANSITION_IDS } from '@/lib/transitions'

const SCENE_TYPES = ['svg', 'canvas2d', 'd3', 'three', 'motion', 'lottie', 'zdog'] as const

function emptyScene(): StoryboardScene {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    id,
    name: 'New scene',
    purpose: '',
    sceneType: 'motion',
    duration: 8,
  }
}

function withTotals(sb: Storyboard): Storyboard {
  const total = sb.scenes.reduce((acc, x) => acc + Math.max(6, Math.min(30, Math.round(Number(x.duration) || 8))), 0)
  return { ...sb, totalDuration: total }
}

interface Props {
  disabled?: boolean
  onApprove: () => void
}

export default function StoryboardReviewCard({ disabled, onApprove }: Props) {
  const pendingStoryboard = useVideoStore((s) => s.pendingStoryboard)
  const setPendingStoryboard = useVideoStore((s) => s.setPendingStoryboard)
  const storyboardProposed = useVideoStore((s) => s.storyboardProposed)
  const setStoryboardProposed = useVideoStore((s) => s.setStoryboardProposed)
  const projectId = useVideoStore((s) => s.project.id)

  // Persist storyboard review state so it survives reloads.
  useEffect(() => {
    if (!projectId) return
    if (!pendingStoryboard) return

    const base = storyboardProposed ?? pendingStoryboard
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const t = setTimeout(() => {
      const payload = {
        storyboardProposed: base,
        storyboardEdited: pendingStoryboard,
      }

      const persist = async (attempt: number) => {
        try {
          const res = await fetch(`/api/projects/${projectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!res.ok && res.status === 409 && attempt < 1) {
            retryTimer = setTimeout(() => {
              void persist(attempt + 1)
            }, 150)
          }
        } catch {
          // ignore
        }
      }

      void persist(0)
    }, 500)

    return () => {
      clearTimeout(t)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [projectId, pendingStoryboard, storyboardProposed])

  if (!pendingStoryboard) return null

  const findProposedScene = (scene: StoryboardScene, idx: number): StoryboardScene | null => {
    if (!storyboardProposed) return null
    if (scene.id) return storyboardProposed.scenes.find((s) => s.id === scene.id) ?? null
    return storyboardProposed.scenes[idx] ?? null
  }

  const updateScene = (index: number, patch: Partial<StoryboardScene>) => {
    const scenes = pendingStoryboard.scenes.map((s, i) => (i === index ? { ...s, ...patch } : s))
    setPendingStoryboard(withTotals({ ...pendingStoryboard, scenes }))
  }

  const moveScene = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= pendingStoryboard.scenes.length) return
    const scenes = [...pendingStoryboard.scenes]
    ;[scenes[index], scenes[j]] = [scenes[j], scenes[index]]
    setPendingStoryboard(withTotals({ ...pendingStoryboard, scenes }))
  }

  const removeScene = (index: number) => {
    const scenes = pendingStoryboard.scenes.filter((_, i) => i !== index)
    setPendingStoryboard(withTotals({ ...pendingStoryboard, scenes }))
  }

  const addScene = () => {
    setPendingStoryboard(
      withTotals({
        ...pendingStoryboard,
        scenes: [...pendingStoryboard.scenes, emptyScene()],
      }),
    )
  }

  const updateTitle = (title: string) => {
    setPendingStoryboard({ ...pendingStoryboard, title })
  }

  const updateStyleNotes = (styleNotes: string) => {
    setPendingStoryboard({ ...pendingStoryboard, styleNotes })
  }

  const toggleFlag = (key: 'narration' | 'music' | 'sfx' | 'interactions') => {
    const cur = pendingStoryboard.featureFlags ?? {
      narration: true,
      music: false,
      sfx: false,
      interactions: false,
    }
    setPendingStoryboard({
      ...pendingStoryboard,
      featureFlags: { ...cur, [key]: !cur[key] },
    })
  }

  return (
    <div className="mx-2 mb-3 rounded-xl border border-cyan-500/35 bg-cyan-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-500/25 bg-cyan-500/10">
        <ListOrdered size={14} className="text-cyan-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-cyan-300">Storyboard review</span>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
          {pendingStoryboard.scenes.length} scenes · {pendingStoryboard.totalDuration}s
        </span>
      </div>

      <div className="p-3 space-y-3 max-h-[min(52vh,420px)] overflow-y-auto">
        <label className="block">
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Title</span>
          <input
            value={pendingStoryboard.title}
            onChange={(e) => updateTitle(e.target.value)}
            disabled={disabled}
            className="mt-0.5 w-full px-2 py-1.5 rounded-md bg-[var(--color-panel)] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)]"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            Style notes
          </span>
          <textarea
            value={pendingStoryboard.styleNotes ?? ''}
            onChange={(e) => updateStyleNotes(e.target.value)}
            disabled={disabled}
            rows={2}
            className="mt-0.5 w-full px-2 py-1.5 rounded-md bg-[var(--color-panel)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-primary)] resize-y min-h-[48px]"
          />
        </label>

        <div className="flex flex-wrap gap-3 text-[10px]">
          {(['narration', 'music', 'sfx', 'interactions'] as const).map((key) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pendingStoryboard.featureFlags?.[key] ?? key === 'narration'}
                onChange={() => toggleFlag(key)}
                disabled={disabled}
                className="rounded border-[var(--color-border)]"
              />
              <span className="text-[var(--color-text-primary)] capitalize">{key}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          {pendingStoryboard.scenes.map((sc, idx) => (
            <div
              key={sc.id ?? idx}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 space-y-1.5"
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--color-text-muted)] w-5">{idx + 1}</span>
                <input
                  value={sc.name}
                  onChange={(e) => updateScene(idx, { name: e.target.value })}
                  disabled={disabled}
                  className="flex-1 min-w-0 px-1.5 py-1 rounded text-[11px] font-medium bg-[var(--color-panel)] border border-[var(--color-border)]"
                  placeholder="Scene name"
                />
                {(() => {
                  const proposed = findProposedScene(sc, idx)
                  if (!proposed) return null
                  if (proposed.name === sc.name) return null
                  return (
                    <span
                      onClick={() => !disabled && updateScene(idx, { name: proposed.name })}
                      className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                      title="Revert scene name"
                    >
                      <RotateCcw size={14} />
                    </span>
                  )
                })()}
                <span
                  onClick={() => !disabled && moveScene(idx, -1)}
                  className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                >
                  <ChevronUp size={14} />
                </span>
                <span
                  onClick={() => !disabled && moveScene(idx, 1)}
                  className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                >
                  <ChevronDown size={14} />
                </span>
                <span
                  onClick={() => !disabled && removeScene(idx)}
                  className={`p-1 rounded text-red-400/80 ${disabled ? 'opacity-30' : 'hover:bg-red-500/15 cursor-pointer'}`}
                >
                  <X size={14} />
                </span>
                {(() => {
                  const proposed = findProposedScene(sc, idx)
                  if (!proposed) return null
                  const changed =
                    proposed.name !== sc.name ||
                    proposed.purpose !== sc.purpose ||
                    proposed.sceneType !== sc.sceneType ||
                    proposed.duration !== sc.duration ||
                    (proposed.transition ?? 'none') !== (sc.transition ?? 'none') ||
                    (proposed.narrationDraft ?? '') !== (sc.narrationDraft ?? '') ||
                    (proposed.visualElements ?? '') !== (sc.visualElements ?? '') ||
                    (proposed.audioNotes ?? '') !== (sc.audioNotes ?? '') ||
                    JSON.stringify(proposed.chartSpec ?? null) !== JSON.stringify(sc.chartSpec ?? null) ||
                    (proposed.mediaLayers ?? '') !== (sc.mediaLayers ?? '') ||
                    (proposed.cameraMovement ?? '') !== (sc.cameraMovement ?? '') ||
                    (proposed.physicsSimulation ?? '') !== (sc.physicsSimulation ?? '') ||
                    (proposed.worldEnvironment ?? '') !== (sc.worldEnvironment ?? '')
                  if (!changed) return null
                  return (
                    <span
                      onClick={() =>
                        !disabled &&
                        updateScene(idx, {
                          name: proposed.name,
                          purpose: proposed.purpose,
                          sceneType: proposed.sceneType,
                          duration: proposed.duration,
                          transition: proposed.transition,
                          narrationDraft: proposed.narrationDraft,
                          visualElements: proposed.visualElements,
                          audioNotes: proposed.audioNotes,
                          chartSpec: proposed.chartSpec,
                          mediaLayers: proposed.mediaLayers,
                          cameraMovement: proposed.cameraMovement,
                          physicsSimulation: proposed.physicsSimulation,
                          worldEnvironment: proposed.worldEnvironment,
                        })
                      }
                      className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                      title="Revert entire scene to proposed"
                    >
                      <RotateCcw size={14} />
                    </span>
                  )
                })()}
              </div>
              <textarea
                value={sc.purpose}
                onChange={(e) => updateScene(idx, { purpose: e.target.value })}
                disabled={disabled}
                rows={2}
                className="w-full px-1.5 py-1 rounded text-[10px] bg-[var(--color-panel)] border border-[var(--color-border)] resize-y"
                placeholder="Purpose / narrative beat"
              />
              {(() => {
                const proposed = findProposedScene(sc, idx)
                if (!proposed) return null
                if (proposed.purpose === sc.purpose) return null
                return (
                  <div className="flex justify-end">
                    <span
                      onClick={() => !disabled && updateScene(idx, { purpose: proposed.purpose })}
                      className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                      title="Revert purpose"
                    >
                      <RotateCcw size={12} />
                    </span>
                  </div>
                )
              })()}
              <div className="flex flex-wrap gap-2">
                <select
                  value={sc.sceneType}
                  onChange={(e) => updateScene(idx, { sceneType: e.target.value })}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded text-[10px] bg-[var(--color-panel)] border border-[var(--color-border)]"
                >
                  {SCENE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {(() => {
                  const proposed = findProposedScene(sc, idx)
                  if (!proposed) return null
                  if (proposed.sceneType === sc.sceneType) return null
                  return (
                    <span
                      onClick={() => !disabled && updateScene(idx, { sceneType: proposed.sceneType })}
                      className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                      title="Revert scene type"
                    >
                      <RotateCcw size={12} />
                    </span>
                  )
                })()}
                <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                  s
                  <input
                    type="number"
                    min={6}
                    max={30}
                    value={sc.duration}
                    onChange={(e) => updateScene(idx, { duration: Number(e.target.value) })}
                    disabled={disabled}
                    className="w-14 px-1 py-0.5 rounded text-[10px] bg-[var(--color-panel)] border border-[var(--color-border)]"
                  />
                  {(() => {
                    const proposed = findProposedScene(sc, idx)
                    if (!proposed) return null
                    if (proposed.duration === sc.duration) return null
                    return (
                      <span
                        onClick={() => !disabled && updateScene(idx, { duration: proposed.duration })}
                        className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                        title="Revert duration"
                      >
                        <RotateCcw size={12} />
                      </span>
                    )
                  })()}
                </label>
                <select
                  value={sc.transition ?? 'none'}
                  onChange={(e) => updateScene(idx, { transition: e.target.value })}
                  disabled={disabled}
                  className="flex-1 min-w-[100px] px-1 py-1 rounded text-[10px] bg-[var(--color-panel)] border border-[var(--color-border)]"
                >
                  {ALL_TRANSITION_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                {(() => {
                  const proposed = findProposedScene(sc, idx)
                  if (!proposed) return null
                  const p = proposed.transition ?? 'none'
                  const cur = sc.transition ?? 'none'
                  if (p === cur) return null
                  return (
                    <span
                      onClick={() => !disabled && updateScene(idx, { transition: proposed.transition })}
                      className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                      title="Revert transition"
                    >
                      <RotateCcw size={12} />
                    </span>
                  )
                })()}
              </div>
              <textarea
                value={sc.narrationDraft ?? ''}
                onChange={(e) => updateScene(idx, { narrationDraft: e.target.value })}
                disabled={disabled}
                rows={2}
                className="w-full px-1.5 py-1 rounded text-[10px] bg-[var(--color-panel)] border border-[var(--color-border)] resize-y"
                placeholder="Narration draft (optional)"
              />
              {(() => {
                const proposed = findProposedScene(sc, idx)
                if (!proposed) return null
                const p = proposed.narrationDraft ?? ''
                const cur = sc.narrationDraft ?? ''
                if (p === cur) return null
                return (
                  <div className="flex justify-end">
                    <span
                      onClick={() => !disabled && updateScene(idx, { narrationDraft: proposed.narrationDraft })}
                      className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                      title="Revert narration draft"
                    >
                      <RotateCcw size={12} />
                    </span>
                  </div>
                )
              })()}
              <textarea
                value={sc.visualElements ?? ''}
                onChange={(e) => updateScene(idx, { visualElements: e.target.value })}
                disabled={disabled}
                rows={1}
                className="w-full px-1.5 py-1 rounded text-[10px] bg-[var(--color-panel)] border border-[var(--color-border)] resize-y"
                placeholder="Visual elements"
              />
              {(() => {
                const proposed = findProposedScene(sc, idx)
                if (!proposed) return null
                const p = proposed.visualElements ?? ''
                const cur = sc.visualElements ?? ''
                if (p === cur) return null
                return (
                  <div className="flex justify-end">
                    <span
                      onClick={() => !disabled && updateScene(idx, { visualElements: proposed.visualElements })}
                      className={`p-1 rounded ${disabled ? 'opacity-30' : 'hover:bg-[var(--color-border)]/40 cursor-pointer'}`}
                      title="Revert visual elements"
                    >
                      <RotateCcw size={12} />
                    </span>
                  </div>
                )
              })()}
              {/* New storyboard fields — display as compact info badges */}
              {(sc.mediaLayers || sc.cameraMovement || sc.physicsSimulation || sc.worldEnvironment) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {sc.mediaLayers && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25"
                      title={sc.mediaLayers}
                    >
                      Media: {sc.mediaLayers.length > 40 ? sc.mediaLayers.slice(0, 40) + '…' : sc.mediaLayers}
                    </span>
                  )}
                  {sc.cameraMovement && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">
                      Camera: {sc.cameraMovement}
                    </span>
                  )}
                  {sc.physicsSimulation && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/25">
                      Sim: {sc.physicsSimulation}
                    </span>
                  )}
                  {sc.worldEnvironment && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      Env: {sc.worldEnvironment}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addScene}
          disabled={disabled}
          className="text-[10px] font-medium px-2 py-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-border)]/20 disabled:opacity-40"
        >
          + Add scene
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-cyan-500/25 bg-[var(--color-bg)]">
        <span
          onClick={() => {
            if (disabled) return
            setPendingStoryboard(null)
            setStoryboardProposed(null)
            if (projectId) {
              fetch(`/api/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  storyboardProposed: null,
                  storyboardEdited: null,
                }),
              }).catch(() => {})
            }
          }}
          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-[var(--color-border)] ${disabled ? 'opacity-40' : 'cursor-pointer hover:bg-[var(--color-border)]/25'}`}
        >
          Discard
        </span>
        <span
          onClick={() => !disabled && onApprove()}
          className={`ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 ${disabled ? 'opacity-40' : 'cursor-pointer hover:bg-cyan-500/30'}`}
        >
          <CheckCircle2 size={14} />
          Approve &amp; build
        </span>
      </div>
    </div>
  )
}

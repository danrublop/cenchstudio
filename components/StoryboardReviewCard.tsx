'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, ListOrdered, X, RotateCcw, MoreHorizontal } from 'lucide-react'
import type { Storyboard, StoryboardScene } from '@/lib/agents/types'
import { useVideoStore } from '@/lib/store'
import { ALL_TRANSITION_IDS } from '@/lib/transitions'
import { AUDIO_PROVIDERS } from '@/lib/audio/provider-registry'

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
  const audioProviderEnabled = useVideoStore((s) => s.audioProviderEnabled)

  const isAudioEnabled = (id: string) => audioProviderEnabled[id] ?? true
  const hasTTS = AUDIO_PROVIDERS.some((p) => p.category === 'tts' && isAudioEnabled(p.id))
  const hasSFX = AUDIO_PROVIDERS.some((p) => p.category === 'sfx' && isAudioEnabled(p.id))
  const hasMusic = AUDIO_PROVIDERS.some((p) => p.category === 'music' && isAudioEnabled(p.id))
  const featureAvailable: Record<string, boolean> = { narration: hasTTS, music: hasMusic, sfx: hasSFX, interactions: true }

  // Auto-correct feature flags when providers become unavailable
  useEffect(() => {
    if (!pendingStoryboard?.featureFlags) return
    const flags = pendingStoryboard.featureFlags
    const corrections: Partial<typeof flags> = {}
    if (!hasTTS && flags.narration) corrections.narration = false
    if (!hasMusic && flags.music) corrections.music = false
    if (!hasSFX && flags.sfx) corrections.sfx = false
    if (Object.keys(corrections).length > 0) {
      setPendingStoryboard({
        ...pendingStoryboard,
        featureFlags: { ...flags, ...corrections },
      })
    }
  }, [hasTTS, hasMusic, hasSFX]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null)

  const discardStoryboard = useCallback(() => {
    if (disabled) return
    setPendingStoryboard(null)
    setStoryboardProposed(null)
    if (projectId) {
      fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardProposed: null, storyboardEdited: null }),
      }).catch(() => {})
    }
  }, [disabled, projectId, setPendingStoryboard, setStoryboardProposed])

  useEffect(() => {
    if (!pendingStoryboard) return

    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
      const t = e.target as HTMLElement
      const tag = t.tagName
      const inTextarea = tag === 'TEXTAREA'
      const inSelect = tag === 'SELECT'
      const inputEl = tag === 'INPUT' ? (t as HTMLInputElement) : null
      const skipPlainEnterForCreate =
        inTextarea ||
        inSelect ||
        t.isContentEditable ||
        (inputEl != null && ['number', 'range'].includes(inputEl.type))

      if ((e.metaKey || e.ctrlKey) && (e.key === '.' || e.code === 'Period')) {
        e.preventDefault()
        discardStoryboard()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        discardStoryboard()
        return
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onApprove()
        return
      }
      if (e.key === 'Enter' && !skipPlainEnterForCreate) {
        e.preventDefault()
        onApprove()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingStoryboard, disabled, discardStoryboard, onApprove])

  if (!pendingStoryboard) return null

  const modKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '')
      ? '⌘'
      : 'Ctrl'

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

  const revertBtn = (onClick: () => void, title: string, size = 14) => (
    <span
      onClick={() => !disabled && onClick()}
      className={`p-0.5 rounded text-[var(--color-text-muted)] ${disabled ? 'opacity-30' : 'hover:text-[var(--color-text-primary)] cursor-pointer'}`}
      title={title}
    >
      <RotateCcw size={size} />
    </span>
  )

  const inputClass = 'w-full bg-transparent text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]/50 border-b border-transparent focus:border-[var(--color-border)] transition-colors'
  const textareaClass = inputClass + ' resize-none overflow-hidden'

  return (
    <div className="space-y-2.5">
      {/* ── Title card ── */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--color-panel)]">
          <ListOrdered size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">Storyboard</span>
          <span className="text-[12px] text-[var(--color-text-muted)] ml-auto">
            {pendingStoryboard.scenes.length} scenes · {pendingStoryboard.totalDuration}s
          </span>
        </div>
        <div className="border-t border-[var(--color-border)]" />
        <div className="p-3 space-y-2.5">
          <input
            value={pendingStoryboard.title}
            onChange={(e) => updateTitle(e.target.value)}
            disabled={disabled}
            placeholder="Title"
            className="w-full bg-transparent text-[14px] font-medium text-[var(--color-text-primary)] outline-none"
          />
          <textarea
            value={pendingStoryboard.styleNotes ?? ''}
            onChange={(e) => updateStyleNotes(e.target.value)}
            disabled={disabled}
            rows={1}
            placeholder="Style notes"
            className={textareaClass}
          />
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {(['narration', 'music', 'sfx', 'interactions'] as const).map((key) => {
              const available = featureAvailable[key] ?? true
              const checked = available && (pendingStoryboard.featureFlags?.[key] ?? key === 'narration')
              return (
                <div key={key} className="sb-toggle">
                  <label
                    title={!available ? `No ${key} providers enabled` : undefined}
                    className={`px-2.5 py-1.5 rounded-md text-[12px] border select-none transition-all ${
                      !available
                        ? 'opacity-40 cursor-not-allowed border-transparent'
                        : checked
                          ? 'bg-[var(--color-panel)] text-[var(--kbd-text)] border-[var(--color-border)] cursor-pointer'
                          : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--kbd-text)] hover:bg-[var(--color-panel)]/50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => available && toggleFlag(key)}
                      disabled={disabled || !available}
                    />
                    <span className="rdo" />
                    <span className="capitalize">{key}</span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Individual scene cards ── */}
      {pendingStoryboard.scenes.map((sc, idx) => {
        const sceneKey = sc.id ?? String(idx)
        const proposed = findProposedScene(sc, idx)
        const sceneChanged = proposed && (
          proposed.name !== sc.name || proposed.purpose !== sc.purpose ||
          proposed.sceneType !== sc.sceneType || proposed.duration !== sc.duration ||
          (proposed.transition ?? 'none') !== (sc.transition ?? 'none') ||
          (proposed.narrationDraft ?? '') !== (sc.narrationDraft ?? '') ||
          (proposed.visualElements ?? '') !== (sc.visualElements ?? '') ||
          (proposed.audioNotes ?? '') !== (sc.audioNotes ?? '') ||
          (proposed.mediaLayers ?? '') !== (sc.mediaLayers ?? '') ||
          (proposed.cameraMovement ?? '') !== (sc.cameraMovement ?? '') ||
          (proposed.physicsSimulation ?? '') !== (sc.physicsSimulation ?? '') ||
          (proposed.worldEnvironment ?? '') !== (sc.worldEnvironment ?? '') ||
          JSON.stringify(proposed.chartSpec ?? null) !== JSON.stringify(sc.chartSpec ?? null)
        )
        return (
          <div
            key={sc.id ?? idx}
            className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}
          >
            {/* Scene header row */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-panel)]">
              <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">{idx + 1}</span>
              <input
                value={sc.name}
                onChange={(e) => updateScene(idx, { name: e.target.value })}
                disabled={disabled}
                placeholder="Scene name"
                className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-[var(--color-text-primary)] outline-none"
              />
              {proposed && proposed.name !== sc.name && revertBtn(() => updateScene(idx, { name: proposed.name }), 'Revert name')}
              {sceneChanged && revertBtn(() => updateScene(idx, {
                name: proposed!.name, purpose: proposed!.purpose, sceneType: proposed!.sceneType,
                duration: proposed!.duration, transition: proposed!.transition,
                narrationDraft: proposed!.narrationDraft, visualElements: proposed!.visualElements,
                audioNotes: proposed!.audioNotes, chartSpec: proposed!.chartSpec,
                mediaLayers: proposed!.mediaLayers, cameraMovement: proposed!.cameraMovement,
                physicsSimulation: proposed!.physicsSimulation, worldEnvironment: proposed!.worldEnvironment,
              }), 'Revert all', 16)}
              <span
                onClick={() => !disabled && moveScene(idx, -1)}
                className={`p-0.5 rounded text-[var(--color-text-muted)] ${disabled ? 'opacity-30' : 'hover:text-[var(--color-text-primary)] cursor-pointer'}`}
              >
                <ChevronUp size={16} />
              </span>
              <span
                onClick={() => !disabled && moveScene(idx, 1)}
                className={`p-0.5 rounded text-[var(--color-text-muted)] ${disabled ? 'opacity-30' : 'hover:text-[var(--color-text-primary)] cursor-pointer'}`}
              >
                <ChevronDown size={16} />
              </span>
              <span
                onClick={() => !disabled && removeScene(idx)}
                className={`p-0.5 rounded text-red-400/60 ${disabled ? 'opacity-30' : 'hover:text-red-400 cursor-pointer'}`}
              >
                <X size={16} />
              </span>
            </div>
            <div className="border-t border-[var(--color-border)]" />

            {/* Card body */}
            <div className="p-3 space-y-1.5">
              <textarea
                value={sc.purpose}
                onChange={(e) => updateScene(idx, { purpose: e.target.value })}
                disabled={disabled}
                rows={1}
                placeholder="Purpose / narrative beat"
                className={textareaClass}
              />
              <div className="flex items-center">
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {sc.sceneType} · {sc.duration}s{sc.transition && sc.transition !== 'none' ? ` · ${sc.transition}` : ''}
                </span>
                <span
                  onClick={() => setExpandedSceneId(expandedSceneId === sceneKey ? null : sceneKey)}
                  className={`ml-auto p-0.5 rounded text-[var(--color-text-muted)] ${disabled ? 'opacity-30' : 'hover:text-[var(--color-text-primary)] cursor-pointer'}`}
                >
                  <MoreHorizontal size={16} />
                </span>
              </div>
            </div>

            {/* Expanded dropdown */}
            {expandedSceneId === sceneKey && (
              <>
                <div className="border-t border-[var(--color-border)]" />
                <div className="p-3 space-y-2.5">
                  {/* Timing */}
                  <div className="space-y-1.5">
                    <span className="text-[12px] text-[var(--color-text-muted)] uppercase tracking-wide">Timing</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={sc.sceneType}
                        onChange={(e) => updateScene(idx, { sceneType: e.target.value })}
                        disabled={disabled}
                        className="bg-transparent text-[12px] text-[var(--color-text-secondary)] outline-none cursor-pointer"
                      >
                        {SCENE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-[var(--color-text-muted)]/30">·</span>
                      <input
                        type="number"
                        min={6}
                        max={30}
                        value={sc.duration}
                        onChange={(e) => updateScene(idx, { duration: Number(e.target.value) })}
                        disabled={disabled}
                        className="w-9 bg-transparent text-[12px] text-[var(--color-text-secondary)] outline-none tabular-nums"
                      />
                      <span className="text-[12px] text-[var(--color-text-muted)]/50">s</span>
                      <span className="text-[var(--color-text-muted)]/30">·</span>
                      <select
                        value={sc.transition ?? 'none'}
                        onChange={(e) => updateScene(idx, { transition: e.target.value })}
                        disabled={disabled}
                        className="bg-transparent text-[12px] text-[var(--color-text-secondary)] outline-none cursor-pointer"
                      >
                        {ALL_TRANSITION_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <span className="text-[12px] text-[var(--color-text-muted)] uppercase tracking-wide">Content</span>
                    <textarea
                      value={sc.narrationDraft ?? ''}
                      onChange={(e) => updateScene(idx, { narrationDraft: e.target.value })}
                      disabled={disabled}
                      rows={1}
                      placeholder="Narration"
                      className={textareaClass}
                    />
                    <textarea
                      value={sc.visualElements ?? ''}
                      onChange={(e) => updateScene(idx, { visualElements: e.target.value })}
                      disabled={disabled}
                      rows={1}
                      placeholder="Visual elements"
                      className={textareaClass}
                    />
                    <textarea
                      value={sc.audioNotes ?? ''}
                      onChange={(e) => updateScene(idx, { audioNotes: e.target.value })}
                      disabled={disabled}
                      rows={1}
                      placeholder="Audio notes"
                      className={textareaClass}
                    />
                  </div>

                  {/* Advanced */}
                  <div className="space-y-1.5">
                    <span className="text-[12px] text-[var(--color-text-muted)] uppercase tracking-wide">Advanced</span>
                    <textarea
                      value={sc.mediaLayers ?? ''}
                      onChange={(e) => updateScene(idx, { mediaLayers: e.target.value })}
                      disabled={disabled}
                      rows={1}
                      placeholder="Media layers"
                      className={textareaClass}
                    />
                    <textarea
                      value={sc.cameraMovement ?? ''}
                      onChange={(e) => updateScene(idx, { cameraMovement: e.target.value })}
                      disabled={disabled}
                      rows={1}
                      placeholder="Camera movement"
                      className={textareaClass}
                    />
                    <textarea
                      value={sc.physicsSimulation ?? ''}
                      onChange={(e) => updateScene(idx, { physicsSimulation: e.target.value })}
                      disabled={disabled}
                      rows={1}
                      placeholder="Physics simulation"
                      className={textareaClass}
                    />
                    <textarea
                      value={sc.worldEnvironment ?? ''}
                      onChange={(e) => updateScene(idx, { worldEnvironment: e.target.value })}
                      disabled={disabled}
                      rows={1}
                      placeholder="World environment"
                      className={textareaClass}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}

      {/* ── Actions row ── */}
      <div className="flex items-center gap-2">
        <span
          role="button"
          tabIndex={0}
          title="Add scene"
          onClick={() => !disabled && addScene()}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              addScene()
            }
          }}
          className={`text-[12px] text-[var(--color-text-muted)] ${disabled ? 'opacity-40' : 'cursor-pointer hover:text-[var(--color-text-primary)]'}`}
        >
          + Scene
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={discardStoryboard}
            title={`Cancel (Esc or ${modKey}+.)`}
            className="no-style inline-flex items-center !h-auto !min-h-9 !max-h-none !py-1.5 !px-4 !leading-none !font-medium !gap-2.5 !rounded-xl !border !border-solid !border-[1px] !border-[var(--color-border)] !bg-[var(--color-panel)] !text-[var(--color-text-muted)] transition-colors enabled:hover:!text-[var(--color-text-primary)] enabled:hover:!bg-[var(--color-border)]/25 disabled:!cursor-not-allowed disabled:!opacity-40"
          >
            <span className="text-[14px]">Cancel</span>
            <span
              className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[var(--color-text-muted)] opacity-70"
              aria-hidden
            >
              <span>Esc</span>
              <span className="text-[var(--color-text-muted)] opacity-50">·</span>
              <span>{modKey}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApprove()}
            title="Create (Enter or ⌘↵)"
            className="storyboard-create-btn-glow no-style inline-flex items-center !h-auto !min-h-9 !max-h-none !py-1.5 !px-4 !leading-none !font-medium !gap-2.5 !rounded-xl !border !border-solid !border-[1px] !border-[#b8c9d9] !bg-[#94a3b8] !text-[#141820] transition-colors hover:!border-[#c9d8e6] hover:!bg-[#8699af] disabled:!cursor-not-allowed disabled:!opacity-40"
          >
            <span className="text-[14px] font-semibold">Create</span>
            <span
              className="inline-flex items-center gap-1 text-[15px] font-semibold tabular-nums text-[#141820]/80"
              aria-hidden
            >
              <span>{modKey}</span>
              <span>↵</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

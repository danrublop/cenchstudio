'use client'

import type { ComponentType, CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mic, Music, Plus, RefreshCw, Sparkles, Trash2, Volume2 } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { Scene } from '@/lib/types'
import type { MusicTrack, SFXTrack } from '@/lib/types/audio'
import { normalizeAudioLayer } from '@/lib/audio/normalize'
import { MusicSearchPopover } from '@/components/audio/MusicSearchPopover'
import { SfxLibraryPanel } from '@/components/audio/SfxLibraryPanel'

async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload failed')
  const { url } = await res.json()
  return url
}

function MixerLane({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number; style?: CSSProperties }>
  accent: string
  children: React.ReactNode
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border bg-[var(--color-card)]/35"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--color-border)', borderLeftWidth: 3, borderLeftColor: accent }}
      >
        <Icon size={14} className="shrink-0" style={{ color: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
          {title}
        </span>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  )
}

type Props = {
  scene: Scene
}

export default function AudioTabPanel({ scene }: Props) {
  const { updateScene, saveSceneHTML, generateNarration, addSFXToScene, removeSFXFromScene, setSceneMusic } =
    useVideoStore()

  const audioInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showMusicSearch, setShowMusicSearch] = useState(false)
  const [generatingTTS, setGeneratingTTS] = useState(false)

  const musicTriggerRef = useRef<HTMLButtonElement | null>(null)
  const musicPanelRef = useRef<HTMLDivElement | null>(null)
  const musicToolbarRef = useRef<HTMLButtonElement | null>(null)
  const musicReplaceRef = useRef<HTMLButtonElement | null>(null)

  const [musicDropdownStyle, setMusicDropdownStyle] = useState<CSSProperties | null>(null)

  const layoutMusicDropdown = useCallback(() => {
    const el = musicTriggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(380, window.innerWidth - 16)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8)
    const maxH = Math.min(window.innerHeight - r.bottom - 12, 360)
    setMusicDropdownStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left,
      width: w,
      maxHeight: maxH,
      zIndex: 200,
    })
  }, [])

  useLayoutEffect(() => {
    if (!showMusicSearch) {
      setMusicDropdownStyle(null)
      return
    }
    layoutMusicDropdown()
  }, [showMusicSearch, layoutMusicDropdown])

  useEffect(() => {
    if (!showMusicSearch) return
    const fn = () => {
      layoutMusicDropdown()
    }
    window.addEventListener('resize', fn)
    window.addEventListener('scroll', fn, true)
    return () => {
      window.removeEventListener('resize', fn)
      window.removeEventListener('scroll', fn, true)
    }
  }, [showMusicSearch, layoutMusicDropdown])

  useEffect(() => {
    if (!showMusicSearch) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (musicPanelRef.current?.contains(t)) return
      if (musicToolbarRef.current?.contains(t)) return
      if (musicReplaceRef.current?.contains(t)) return
      setShowMusicSearch(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showMusicSearch])

  const audio = normalizeAudioLayer(scene.audioLayer)
  const raw = scene.audioLayer

  const commitLayer = useCallback(async () => {
    await saveSceneHTML(scene.id)
  }, [scene.id, saveSceneHTML])

  const commitLayerDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void saveSceneHTML(scene.id)
    }, 150)
  }, [scene.id, saveSceneHTML])

  const handleAudioUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const url = await uploadFile(file)
        updateScene(scene.id, { audioLayer: { ...scene.audioLayer, src: url, enabled: true } })
        await saveSceneHTML(scene.id)
      } catch {
        alert('Upload failed')
      }
      e.target.value = ''
    },
    [scene.audioLayer, scene.id, updateScene, saveSceneHTML],
  )

  const handleGenerateVoiceover = useCallback(async () => {
    const text = scene.prompt
    if (!text) {
      alert('Add a scene prompt first to generate narration.')
      return
    }
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sceneId: scene.id }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const { url } = await res.json()
      updateScene(scene.id, { audioLayer: { ...scene.audioLayer, src: url, enabled: true } })
      await saveSceneHTML(scene.id)
    } catch {
      alert('TTS generation failed. Check your ElevenLabs API key.')
    }
  }, [scene, updateScene, saveSceneHTML])

  const patchAudioLayer = useCallback(
    (partial: Partial<typeof scene.audioLayer>) => {
      updateScene(scene.id, { audioLayer: { ...scene.audioLayer, ...partial } })
    },
    [scene.audioLayer, scene.id, updateScene],
  )

  const updateSfx = useCallback(
    (sfxId: string, patch: Partial<SFXTrack>) => {
      const al = normalizeAudioLayer(scene.audioLayer)
      const sfx = (al.sfx ?? []).map((s) => (s.id === sfxId ? { ...s, ...patch } : s))
      updateScene(scene.id, { audioLayer: { ...al, sfx } })
      commitLayerDebounced()
    },
    [scene.audioLayer, scene.id, updateScene, commitLayerDebounced],
  )

  const updateMusic = useCallback(
    (patch: Partial<MusicTrack>) => {
      const al = normalizeAudioLayer(scene.audioLayer)
      if (!al.music) return
      updateScene(scene.id, { audioLayer: { ...al, music: { ...al.music, ...patch } } })
      commitLayerDebounced()
    },
    [scene.audioLayer, scene.id, updateScene, commitLayerDebounced],
  )

  const clearNarrationAndFile = useCallback(() => {
    const al = normalizeAudioLayer(scene.audioLayer)
    updateScene(scene.id, {
      audioLayer: {
        ...al,
        src: null,
        tts: null,
      },
    })
    void saveSceneHTML(scene.id)
  }, [scene.audioLayer, scene.id, updateScene, saveSceneHTML])

  const hasTtsContent = !!(audio.tts && (audio.tts.text?.trim() || audio.tts.src?.trim() || audio.tts.status === 'generating'))

  return (
    <div className="relative space-y-4 px-3 py-3">
      <p className="text-[11px] leading-snug text-[var(--color-text-muted)]">
        Mix narration, music, and SFX for this scene. Levels and timing match export (FFmpeg) and preview.
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => audioInputRef.current?.click()}
          className="kbd flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] sm:flex-initial sm:px-3"
        >
          <Plus size={12} strokeWidth={2} />
          Upload
        </button>
        <button
          type="button"
          onClick={() => void handleGenerateVoiceover()}
          className="kbd flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] sm:flex-initial sm:px-3"
        >
          <Volume2 size={12} strokeWidth={2} />
          Narrate
        </button>
        <button
          ref={musicToolbarRef}
          type="button"
          onClick={(e) => {
            const btn = e.currentTarget
            if (showMusicSearch && musicTriggerRef.current === btn) {
              setShowMusicSearch(false)
              return
            }
            musicTriggerRef.current = btn
            if (!showMusicSearch) {
              setShowMusicSearch(true)
            } else {
              queueMicrotask(() => layoutMusicDropdown())
            }
          }}
          aria-expanded={showMusicSearch}
          aria-haspopup="listbox"
          className="kbd flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] sm:flex-initial sm:px-3"
        >
          <Music size={12} strokeWidth={2} />
          Music
        </button>
      </div>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mp3,audio/wav,audio/mpeg"
        onChange={handleAudioUpload}
        className="hidden"
      />

      {/* Master */}
      <MixerLane title="Master" icon={Volume2} accent="#c678dd">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--color-text-primary)]">Audio enabled</span>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="tgl"
              id="audio-tab-master"
              checked={raw.enabled}
              onChange={(e) => {
                patchAudioLayer({ enabled: e.target.checked })
                void commitLayer()
              }}
            />
            <label className="tgl-btn" htmlFor="audio-tab-master" />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-end justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Output volume</span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{Math.round(raw.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={raw.volume}
            onChange={(e) => {
              patchAudioLayer({ volume: parseFloat(e.target.value) })
              commitLayerDebounced()
            }}
            className="w-full accent-[#c678dd]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">Start offset (s)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={raw.startOffset ?? 0}
              onChange={(e) => {
                patchAudioLayer({ startOffset: parseFloat(e.target.value) || 0 })
                commitLayerDebounced()
              }}
              className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={raw.fadeIn}
                onChange={(e) => {
                  patchAudioLayer({ fadeIn: e.target.checked })
                  void commitLayer()
                }}
                className="h-3 w-3 accent-[#c678dd]"
              />
              <span className="text-[11px] text-[var(--color-text-primary)]">Fade in</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={raw.fadeOut}
                onChange={(e) => {
                  patchAudioLayer({ fadeOut: e.target.checked })
                  void commitLayer()
                }}
                className="h-3 w-3 accent-[#c678dd]"
              />
              <span className="text-[11px] text-[var(--color-text-primary)]">Fade out</span>
            </label>
          </div>
        </div>
      </MixerLane>

      {/* Narration / dialogue */}
      <MixerLane title="Narration & dialogue" icon={Mic} accent="#a78bfa">
        {!hasTtsContent && (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            No voice track yet. Use <strong className="text-[var(--color-text-primary)]">Upload</strong> for a file or{' '}
            <strong className="text-[var(--color-text-primary)]">Narrate</strong> from the scene prompt.
          </p>
        )}
        {audio.tts && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Voice
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
                {audio.tts.provider}
              </span>
              {audio.tts.status === 'ready' && <span className="text-[10px] text-green-500">Ready</span>}
              {audio.tts.status === 'generating' && <span className="text-[10px] text-amber-400">Generating…</span>}
              {audio.tts.status === 'error' && <span className="text-[10px] text-red-400">Error</span>}
            </div>
            {audio.tts.text?.trim() ? (
              <textarea
                readOnly
                value={audio.tts.text}
                rows={3}
                className="w-full resize-none rounded border px-2 py-1.5 text-[11px] leading-snug"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              />
            ) : audio.tts.src ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-2 py-1.5">
                <Volume2 size={12} className="shrink-0 text-[#a78bfa]" />
                <span className="flex-1 truncate text-[11px] text-[var(--color-text-primary)]">
                  {audio.tts.src.split('/').pop() || 'Audio file'}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-text-muted)]">No script or file yet.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generatingTTS || !audio.tts.text?.trim()}
                onClick={async () => {
                  if (generatingTTS || !audio.tts?.text) return
                  setGeneratingTTS(true)
                  try {
                    await generateNarration(scene.id, audio.tts.text, audio.tts.provider, audio.tts.voiceId || undefined)
                  } catch {
                    /* store sets error */
                  }
                  setGeneratingTTS(false)
                }}
                className="kbd flex h-8 items-center gap-1.5 px-3 text-[11px] disabled:opacity-40"
              >
                <RefreshCw size={12} className={generatingTTS ? 'animate-spin' : ''} />
                {generatingTTS ? 'Regenerating…' : 'Regenerate'}
              </button>
              <button
                type="button"
                onClick={clearNarrationAndFile}
                className="kbd flex h-8 items-center gap-1 px-3 text-[11px] text-[var(--color-text-muted)] hover:text-[#e84545]"
              >
                <Trash2 size={12} />
                Remove voice
              </button>
            </div>
          </div>
        )}
      </MixerLane>

      {/* Music */}
      <MixerLane title="Music" icon={Music} accent="#61afef">
        {!audio.music?.src?.trim() ? (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            No music bed. Open the <strong className="text-[var(--color-text-primary)]">Music</strong> dropdown in the toolbar
            to search and add a track.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">{audio.music!.name}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{audio.music!.provider}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  ref={musicReplaceRef}
                  type="button"
                  onClick={(e) => {
                    const btn = e.currentTarget
                    if (showMusicSearch && musicTriggerRef.current === btn) {
                      setShowMusicSearch(false)
                      return
                    }
                    musicTriggerRef.current = btn
                    if (!showMusicSearch) {
                      setShowMusicSearch(true)
                    } else {
                      queueMicrotask(() => layoutMusicDropdown())
                    }
                  }}
                  aria-expanded={showMusicSearch}
                  className="kbd h-7 px-2 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSceneMusic(scene.id, null)
                  }}
                  className="text-[var(--color-text-muted)] hover:text-[#e84545]"
                  aria-label="Remove music"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)]">Volume</span>
                <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  {Math.round((audio.music!.volume ?? 0.3) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audio.music!.volume ?? 0.3}
                onChange={(e) => updateMusic({ volume: parseFloat(e.target.value) })}
                className="w-full accent-[#61afef]"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={audio.music!.loop ?? true}
                onChange={(e) => {
                  updateMusic({ loop: e.target.checked })
                  void commitLayer()
                }}
                className="h-3 w-3 accent-[#61afef]"
              />
              <span className="text-[11px] text-[var(--color-text-primary)]">Loop to fill scene</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={audio.music!.duckDuringTTS ?? true}
                onChange={(e) => {
                  updateMusic({ duckDuringTTS: e.target.checked })
                  void commitLayer()
                }}
                className="h-3 w-3 accent-[#61afef]"
              />
              <span className="text-[11px] text-[var(--color-text-primary)]">Duck under narration</span>
            </label>
            {audio.music!.duckDuringTTS !== false && (
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-[10px] text-[var(--color-text-muted)]">Duck amount</span>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    {Math.round((audio.music!.duckLevel ?? 0.15) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.9}
                  step={0.05}
                  value={audio.music!.duckLevel ?? 0.15}
                  onChange={(e) => updateMusic({ duckLevel: parseFloat(e.target.value) })}
                  className="w-full accent-[#61afef]"
                />
              </div>
            )}
          </div>
        )}
      </MixerLane>

      {/* SFX */}
      <MixerLane title="Sound effects" icon={Sparkles} accent="#e5c07b">
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Pick a sound below to add it. Set trigger time and level under <strong className="text-[var(--color-text-primary)]">On timeline</strong>.
        </p>
        <div
          className="flex max-h-[min(420px,50vh)] min-h-[200px] flex-col overflow-hidden rounded-lg border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-panel)' }}
        >
          <SfxLibraryPanel
            className="min-h-0 flex-1 rounded-none border-0 shadow-none"
            style={{ backgroundColor: 'var(--color-panel)' }}
            onSelect={(r, at) => {
              addSFXToScene(scene.id, {
                id: r.id,
                name: r.name,
                provider: r.provider ?? 'freesound',
                src: r.previewUrl ?? r.audioUrl ?? '',
                triggerAt: at,
                volume: 1,
                duration: r.duration,
                license: r.license ?? null,
              })
            }}
          />
        </div>
        <div className="border-t border-[var(--color-border)] pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            On timeline
          </p>
          {(audio.sfx ?? []).length === 0 ? (
            <p className="text-[11px] text-[var(--color-text-muted)]">No clips yet — choose sounds above.</p>
          ) : (
            <ul className="space-y-2">
              {(audio.sfx ?? []).map((sfx) => (
                <li
                  key={sfx.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)]/50 p-2.5"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-[var(--color-text-primary)]">{sfx.name}</div>
                      {sfx.license && (
                        <div className="mt-0.5 line-clamp-2 text-[9px] text-[var(--color-text-muted)]">{sfx.license}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSFXFromScene(scene.id, sfx.id)}
                      className="shrink-0 text-[var(--color-text-muted)] hover:text-[#e84545]"
                      aria-label="Remove SFX"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">Trigger at (s)</label>
                      <input
                        type="number"
                        min={0}
                        max={scene.duration}
                        step={0.1}
                        value={sfx.triggerAt}
                        onChange={(e) => updateSfx(sfx.id, { triggerAt: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full rounded border px-2 py-1 text-[11px] focus:border-[#e84545] focus:outline-none"
                        style={{
                          backgroundColor: 'var(--color-input-bg)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">Level</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={sfx.volume ?? 1}
                        onChange={(e) => updateSfx(sfx.id, { volume: parseFloat(e.target.value) })}
                        className="w-full accent-[#e5c07b]"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </MixerLane>

      {/* Music dropdown (portaled so it is not clipped by the scrollable Layers panel) */}
      {showMusicSearch &&
        musicDropdownStyle &&
        createPortal(
          <div
            ref={musicPanelRef}
            role="listbox"
            className="flex min-h-0 flex-col overflow-hidden rounded-lg border shadow-lg"
            style={{
              ...musicDropdownStyle,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-panel)',
              borderColor: 'var(--color-border)',
            }}
          >
            <MusicSearchPopover
              onSelect={(r) => {
                setSceneMusic(scene.id, {
                  name: r.name,
                  provider: 'pixabay-music',
                  src: r.previewUrl ?? r.audioUrl ?? '',
                  volume: 0.3,
                  loop: true,
                  duckDuringTTS: true,
                  duckLevel: 0.15,
                })
                setShowMusicSearch(false)
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}

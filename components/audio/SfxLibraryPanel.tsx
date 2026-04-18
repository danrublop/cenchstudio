'use client'

import type { CSSProperties } from 'react'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Search,
  Play,
  Pause,
  Plus,
  Loader2,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Volume2,
  MousePointerClick,
  Hammer,
  Flame,
  Gift,
  Bell,
  Orbit,
  Laugh,
  Disc3,
  ArrowLeftRight,
  Wand2,
  Gamepad2,
  Wind,
} from 'lucide-react'
import { ZZFX_SFX_CATEGORIES, allZzfxPresetsFlat } from '@/lib/audio/sfx-zzfx-presets'
import { licenseBadgeLabel } from '@/lib/audio/sfx-license'
import type { SfxLocalManifest } from '@/lib/audio/sfx-local-manifest'
import { getLocalSoundsForCategory, manifestSoundToResult } from '@/lib/audio/sfx-local-manifest'
import type { SFXResult } from '@/lib/audio/types'
import type { ZzfxSfxPreset } from '@/lib/audio/sfx-zzfx-presets'
import { buildZzfxWavObjectUrl, playZzfxPreview, uploadAudioBlob } from '@/lib/audio/sfx-zzfx-client'

export type SFXSearchResult = SFXResult

const LOCAL_PAGE_SIZE = 12

function hashSeed(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return String(Math.abs(h))
}

function picsumThumb(provider: string | undefined, id: string): string {
  return `https://picsum.photos/seed/${hashSeed(`sfx-${provider ?? 'x'}-${id}`)}/480/270`
}

export interface SfxLibraryPanelProps {
  onSelect: (result: SFXSearchResult, triggerAt: number) => void
  className?: string
  style?: CSSProperties
}

const CATEGORY_ALL_ID = 'all'

/** Category icons — same visual language as Layers tab icons (lucide, size 11). */
const ZZFX_CATEGORY_ICONS: Record<string, LucideIcon> = {
  [CATEGORY_ALL_ID]: LayoutGrid,
  ui: MousePointerClick,
  impacts: Hammer,
  explosions: Flame,
  pickups: Gift,
  alarms: Bell,
  'sci-fi': Orbit,
  cartoon: Laugh,
  percussion: Disc3,
  transitions: ArrowLeftRight,
  sfxr: Gamepad2,
  ambient: Wind,
  misc: Wand2,
}

export function SfxLibraryPanel({ onSelect, className = '', style: rootStyle }: SfxLibraryPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SFXSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [triggerAt, setTriggerAt] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [libraryCategoryId, setLibraryCategoryId] = useState(CATEGORY_ALL_ID)
  const [libraryPage, setLibraryPage] = useState(1)
  const [localManifest, setLocalManifest] = useState<SfxLocalManifest | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/sfx-library/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SfxLocalManifest | null) => {
        if (!cancelled && data?.categories?.length) setLocalManifest(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const nativeForCategory = useMemo(() => {
    if (libraryCategoryId === CATEGORY_ALL_ID) {
      if (!localManifest?.categories?.length) return []
      return localManifest.categories.flatMap((c) => c.sounds.map((s) => manifestSoundToResult(s)))
    }
    return getLocalSoundsForCategory(localManifest, libraryCategoryId)
  }, [localManifest, libraryCategoryId])

  const zzfxEntries = useMemo(() => {
    if (libraryCategoryId === CATEGORY_ALL_ID) {
      return allZzfxPresetsFlat()
    }
    const cat = ZZFX_SFX_CATEGORIES.find((c) => c.id === libraryCategoryId)
    const label = cat?.label ?? ''
    return (cat?.presets ?? []).map((p) => ({ ...p, categoryId: libraryCategoryId, categoryLabel: label }))
  }, [libraryCategoryId])

  const libraryPageCount = Math.max(1, Math.ceil(zzfxEntries.length / LOCAL_PAGE_SIZE))
  const librarySlice = useMemo(() => {
    const start = (libraryPage - 1) * LOCAL_PAGE_SIZE
    return zzfxEntries.slice(start, start + LOCAL_PAGE_SIZE)
  }, [zzfxEntries, libraryPage])

  useEffect(() => {
    setLibraryPage(1)
  }, [libraryCategoryId])

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.sfx : undefined
      const payload = { query, limit: 48, commercialOnly: true }
      const data = ipc
        ? await ipc.search(payload)
        : await (
            await fetch('/api/sfx', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          ).json()
      setResults((data.results as typeof results) || [])
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        /* ignore */
      }
      audioRef.current = null
    }
    setPlaying(null)
  }, [])

  const playPreview = useCallback(
    (result: SFXSearchResult) => {
      stopPreview()
      const url = result.previewUrl || result.audioUrl
      if (!url) return
      const audio = new Audio(url)
      audio.onended = () => setPlaying(null)
      audio.play().catch(() => {})
      audioRef.current = audio
      setPlaying(result.id)
    },
    [stopPreview],
  )

  useEffect(() => () => stopPreview(), [stopPreview])

  const handleZzfxPick = useCallback(
    async (preset: ZzfxSfxPreset) => {
      stopPreview()
      setAddingId(preset.id)
      try {
        const { url, durationSec, revoke } = await buildZzfxWavObjectUrl(preset)
        const blob = await fetch(url).then((r) => r.blob())
        revoke()
        const uploaded = await uploadAudioBlob(blob, `zzfx-${preset.id}.wav`)
        onSelect(
          {
            id: `zzfx-${preset.id}`,
            name: preset.name,
            provider: 'zzfx',
            audioUrl: uploaded,
            previewUrl: uploaded,
            duration: durationSec,
            license: 'MIT (ZzFX)',
          },
          triggerAt,
        )
      } catch {
        /* ignore */
      } finally {
        setAddingId(null)
      }
    },
    [onSelect, stopPreview, triggerAt],
  )

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border ${className}`.trim()}
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-card)',
        ...rootStyle,
      }}
    >
      <div
        className="flex shrink-0 items-center gap-1 border-b px-2 py-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search Pixabay / Freesound…"
          className="min-w-0 flex-1 rounded border px-2 py-1.5 text-[12px]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          className="kbd flex h-8 w-8 shrink-0 items-center justify-center"
          aria-label="Search remote sounds"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
        </button>
      </div>

      {/* Categories — Layers-style strip; All = every bundled + every ZzFX preset */}
      <div
        className="flex shrink-0 items-center gap-1 border-b px-2 pt-1.5 pb-1 scrollbar-none overflow-x-auto"
        style={{ borderColor: 'var(--color-border)' }}
        role="tablist"
        aria-label="Sound categories"
      >
        {[{ id: CATEGORY_ALL_ID, label: 'All' }, ...ZZFX_SFX_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))].map(
          (c) => {
            const isActive = libraryCategoryId === c.id
            const Icon = ZZFX_CATEGORY_ICONS[c.id] ?? Volume2
            return (
              <span
                key={c.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => {
                  setLibraryCategoryId(c.id)
                  setLibraryPage(1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setLibraryCategoryId(c.id)
                    setLibraryPage(1)
                  }
                }}
                className={`flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors select-none whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--agent-chat-user-surface)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Icon size={11} className="shrink-0" />
                {c.label}
              </span>
            )
          },
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          <span>Trigger at:</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={triggerAt}
            onChange={(e) => setTriggerAt(parseFloat(e.target.value) || 0)}
            className="w-16 rounded border px-1.5 py-0.5 text-[11px]"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)',
            }}
          />
          <span>s</span>
        </div>

        <p className="text-[10px] leading-snug text-[var(--color-text-muted)]">
          Built-in library uses{' '}
          <a
            href="https://github.com/KilledByAPixel/ZzFX"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent)] underline"
          >
            ZzFX
          </a>{' '}
          (MIT) and bundled WAVs under <code className="rounded bg-white/5 px-0.5 text-[9px]">/sfx-library/</code>.
          Remote search needs API keys (commercial-friendly Freesound filters when enabled).
        </p>

        {zzfxEntries.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Library page {libraryPage} / {libraryPageCount}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={libraryPage <= 1}
                onClick={() => setLibraryPage((p) => Math.max(1, p - 1))}
                className="kbd flex h-7 w-7 items-center justify-center disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={libraryPage >= libraryPageCount}
                onClick={() => setLibraryPage((p) => p + 1)}
                className="kbd flex h-7 w-7 items-center justify-center disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {loading && results.length === 0 && query.trim() && (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        )}

        {nativeForCategory.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Native library (offline WAV)
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {nativeForCategory.map((r) => {
                const key = `local-${r.id}`
                const thumb = picsumThumb(r.provider, r.id)
                const isPlaying = playing === r.id
                return (
                  <div key={key} className="group sfx-card text-left">
                    <button
                      type="button"
                      className="w-full rounded-lg text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                      onMouseEnter={() => playPreview(r)}
                      onMouseLeave={() => stopPreview()}
                      onClick={() => {
                        stopPreview()
                        onSelect(r, triggerAt)
                      }}
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#0d0d0f] shadow-inner ring-1 ring-white/10">
                        <img
                          src={thumb}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                          draggable={false}
                        />
                        <div
                          className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity ${
                            isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25">
                            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/95 ring-1 ring-white/20">
                          <Plus size={14} strokeWidth={2.5} />
                        </div>
                        {r.duration != null && (
                          <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white/95">
                            {r.duration.toFixed(2)}s
                          </span>
                        )}
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90">
                          {licenseBadgeLabel(r.license, r.provider)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-start gap-1 px-0.5">
                        <Volume2 size={12} className="mt-0.5 shrink-0 text-[#c678dd] opacity-80" />
                        <span className="line-clamp-2 min-h-[2.25rem] text-[11px] font-medium leading-tight text-[var(--color-text-primary)]">
                          {r.name}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {zzfxEntries.length > 0 && librarySlice.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Procedural (live ZzFX)
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {librarySlice.map((preset) => {
                const key = `zzfx-${preset.id}`
                const thumb = picsumThumb('zzfx', preset.id)
                const isAdding = addingId === preset.id
                const catLabel = 'categoryLabel' in preset ? preset.categoryLabel : undefined
                return (
                  <div key={key} className="group sfx-card text-left">
                    <button
                      type="button"
                      disabled={isAdding}
                      className="w-full rounded-lg text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] disabled:opacity-50"
                      onMouseEnter={() => {
                        playZzfxPreview(preset)
                      }}
                      onClick={() => void handleZzfxPick(preset)}
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#0d0d0f] shadow-inner ring-1 ring-white/10">
                        <img
                          src={thumb}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                          draggable={false}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25">
                            {isAdding ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Play size={18} className="ml-0.5" />
                            )}
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/95 ring-1 ring-white/20">
                          <Plus size={14} strokeWidth={2.5} />
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90">
                          {licenseBadgeLabel('MIT (ZzFX)', 'zzfx')}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-col gap-0.5 px-0.5">
                        <div className="flex items-start gap-1">
                          <Volume2 size={12} className="mt-0.5 shrink-0 text-[#c678dd] opacity-80" />
                          <span className="line-clamp-2 min-h-[2.25rem] text-[11px] font-medium leading-tight text-[var(--color-text-primary)]">
                            {preset.name}
                          </span>
                        </div>
                        {libraryCategoryId === CATEGORY_ALL_ID && catLabel && (
                          <span className="pl-[18px] text-[9px] text-[var(--color-text-muted)]">{catLabel}</span>
                        )}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {nativeForCategory.length === 0 && zzfxEntries.length === 0 && (
          <p className="py-2 text-center text-[11px] text-[var(--color-text-muted)]">
            No sounds in this category. Run <code className="rounded bg-white/5 px-1">npm run sfx-library:zzfx</code> to
            build the native library.
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Remote results
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {results.map((r) => {
                const key = `${r.provider ?? 'x'}-${r.id}`
                const thumb = picsumThumb(r.provider, r.id)
                const isPlaying = playing === r.id
                return (
                  <div key={key} className="group sfx-card text-left">
                    <button
                      type="button"
                      className="w-full rounded-lg text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                      onMouseEnter={() => playPreview(r)}
                      onMouseLeave={() => stopPreview()}
                      onClick={() => {
                        stopPreview()
                        onSelect(r, triggerAt)
                      }}
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#0d0d0f] shadow-inner ring-1 ring-white/10">
                        <img
                          src={thumb}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                          draggable={false}
                        />
                        <div
                          className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity ${
                            isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25">
                            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/95 ring-1 ring-white/20">
                          <Plus size={14} strokeWidth={2.5} />
                        </div>
                        {r.duration != null && (
                          <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white/95">
                            {r.duration.toFixed(1)}s
                          </span>
                        )}
                        <span className="absolute left-1.5 bottom-1.5 rounded bg-black/50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90">
                          {licenseBadgeLabel(r.license, r.provider)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-start gap-1 px-0.5">
                        <Volume2 size={12} className="mt-0.5 shrink-0 text-[#c678dd] opacity-80" />
                        <span className="line-clamp-2 min-h-[2.25rem] text-[11px] font-medium leading-tight text-[var(--color-text-primary)]">
                          {r.name}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <p className="py-2 text-center text-[11px] text-[var(--color-text-muted)]">No results</p>
        )}
      </div>
    </div>
  )
}

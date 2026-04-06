'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** CC0 sample (MDN) — replace per tile when real assets exist. */
const PLACEHOLDER_SRC =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const PLACEHOLDER_CLIPS = [
  { id: '1', title: 'Studio overview', src: PLACEHOLDER_SRC },
  { id: '2', title: 'Agent workflow', src: PLACEHOLDER_SRC },
  { id: '3', title: 'Scene builder', src: PLACEHOLDER_SRC },
  { id: '4', title: 'Export & publish', src: PLACEHOLDER_SRC },
  { id: '5', title: 'Motion templates', src: PLACEHOLDER_SRC },
  { id: '6', title: 'API quickstart', src: PLACEHOLDER_SRC },
] as const

type VideoFileTileProps = {
  title: string
  src: string
  index: number
  onOpen: () => void
}

/** Desktop-style clip: dark 16:9 tile + thin stroke, bold label underneath (no folder). */
function VideoFileTile({ title, src, index, onOpen }: VideoFileTileProps) {
  const fileLabel = `${title.toLowerCase().replace(/\s+/g, '-')}.mp4`
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${50 + index * 55}ms` }}
      className="hero-library-pop group flex w-[5.85rem] flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:w-[7.25rem]"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-sky-200/25 bg-[#0c0f14] shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-[transform,box-shadow] duration-200 group-hover:scale-[1.04] group-hover:border-sky-200/40 sm:rounded-[10px]">
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover opacity-85 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <span className="mt-1.5 max-w-full px-0.5 text-center font-sans text-[10px] font-bold leading-tight tracking-tight text-white sm:text-[11px] [text-shadow:_0_1px_3px_rgba(0,0,0,0.95),_0_2px_8px_rgba(0,0,0,0.65)]">
        <span className="line-clamp-2">{fileLabel}</span>
      </span>
    </button>
  )
}

type HeroLibraryGridProps = {
  open: boolean
  onClose: () => void
}

export function HeroLibraryGrid({ open, onClose }: HeroLibraryGridProps) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const modalVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) setPlayingId(null)
  }, [open])

  useEffect(() => {
    if (!playingId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setPlayingId(null)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [playingId])

  useEffect(() => {
    const el = modalVideoRef.current
    if (!el || !playingId) return
    el.play().catch(() => {})
    return () => {
      el.pause()
    }
  }, [playingId])

  const playingClip = playingId ? PLACEHOLDER_CLIPS.find((c) => c.id === playingId) : null

  const stopModal = useCallback(() => setPlayingId(null), [])

  if (!open) return null

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[4]">
        <span className="sr-only">Video library on canvas</span>
        <button
          type="button"
          onClick={onClose}
          className="hero-library-pop pointer-events-auto absolute top-3 right-3 z-[5] rounded-full border border-white/30 bg-black/40 px-3 py-1.5 font-sans text-[11px] font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/55 sm:top-5 sm:right-5 sm:px-3.5 sm:text-xs"
          style={{ animationDelay: '0ms' }}
        >
          Close
        </button>

        <div className="flex h-full w-full flex-col justify-end pb-[clamp(6.75rem,19vw,9.75rem)] pt-8 sm:pb-[clamp(7.25rem,17vw,10rem)] sm:pt-12">
          <div className="pointer-events-auto mx-auto grid grid-cols-3 justify-items-center gap-x-5 gap-y-6 px-1.5 sm:max-w-3xl sm:gap-x-10 sm:gap-y-8 sm:px-3">
            {PLACEHOLDER_CLIPS.map((clip, i) => (
              <VideoFileTile
                key={clip.id}
                title={clip.title}
                src={clip.src}
                index={i}
                onOpen={() => setPlayingId(clip.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {playingClip ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={stopModal}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-white/20 bg-[#0a0a0b] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={playingClip.title}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
              <p className="truncate font-sans text-sm font-medium text-white">{playingClip.title}</p>
              <button
                type="button"
                onClick={stopModal}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            <video
              ref={modalVideoRef}
              key={playingClip.id}
              src={playingClip.src}
              className="aspect-video w-full bg-black"
              controls
              playsInline
              autoPlay
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

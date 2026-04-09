'use client'

/**
 * Static transport row — same structure as `PreviewPlayer` transportBar (above `Timeline`).
 */
import { SkipBack, Play, SkipForward } from 'lucide-react'

function formatTransportTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`
}

export function HeroTransportBarMock() {
  const mockCurrentTime = 12
  const mockDurationSec = 28
  const scrubPct = Math.min(100, (mockCurrentTime / mockDurationSec) * 100)

  return (
    <div
      className="w-full flex-shrink-0 px-0 py-1.5 select-none"
      style={{ background: 'var(--tl-bg)', borderTop: '1px solid var(--tl-border)' }}
      aria-hidden
    >
      <div className="flex cursor-default items-center gap-2 px-2">
        <div className="flex items-center gap-0.5">
          <span
            className="flex h-6 w-6 items-center justify-center transition-colors"
            style={{ color: 'var(--tl-toolbar-text)' }}
            title="Step back"
          >
            <SkipBack size={12} fill="currentColor" />
          </span>
          <span
            className="flex h-7 w-7 items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            title="Play"
          >
            <Play size={14} fill="currentColor" />
          </span>
          <span
            className="flex h-6 w-6 items-center justify-center transition-colors"
            style={{ color: 'var(--tl-toolbar-text)' }}
            title="Step forward"
          >
            <SkipForward size={12} fill="currentColor" />
          </span>
        </div>

        <div
          className="relative h-1.5 min-w-[48px] flex-1 cursor-default rounded-full"
          style={{ background: 'var(--tl-border)' }}
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
            style={{ background: 'var(--tl-playhead)', width: `${scrubPct}%` }}
          />
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-md"
            style={{ left: `calc(${scrubPct}% - 6px)` }}
          />
        </div>

        <div
          className="flex items-center justify-center whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {formatTransportTime(mockCurrentTime)} / {formatTransportTime(mockDurationSec)}
        </div>
      </div>
    </div>
  )
}

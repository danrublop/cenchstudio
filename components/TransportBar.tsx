'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, AlignStartVertical, Minus, Plus, Maximize, SkipBack, SkipForward } from 'lucide-react'
import { useVideoStore } from '@/lib/store'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const ZOOM_BTN_STEP = 0.25

function sendPreviewCommand(action: string, payload?: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('cench-preview-command', { detail: { action, ...payload } }))
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`
}

export default function TransportBar() {
  const { timelineTransport, timelineView, setTimelineView } = useVideoStore()
  const { globalTime, totalDuration, isPlaying } = timelineTransport

  // Local zoom state for preview zoom display (mirrors PreviewPlayer's zoom)
  // We use the command system rather than reading zoom from store
  const [zoom, setZoom] = useState(1)

  // Scrub state
  const scrubBarRef = useRef<HTMLDivElement>(null)
  const isScrubbing = useRef(false)
  const [visualScrubTime, setVisualScrubTime] = useState<number | null>(null)

  const scrubPct = totalDuration > 0 ? ((visualScrubTime ?? globalTime) / totalDuration) * 100 : 0

  const getScrubTime = useCallback(
    (clientX: number) => {
      const rect = scrubBarRef.current?.getBoundingClientRect()
      if (!rect) return 0
      return Math.max(0, Math.min(totalDuration, ((clientX - rect.left) / rect.width) * totalDuration))
    },
    [totalDuration],
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isScrubbing.current) return
      setVisualScrubTime(getScrubTime(e.clientX))
    }
    const onUp = (e: MouseEvent) => {
      if (!isScrubbing.current) return
      isScrubbing.current = false
      document.body.style.userSelect = ''
      setVisualScrubTime(null)
      sendPreviewCommand('seek', { time: getScrubTime(e.clientX) })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [getScrubTime])

  const zoomIn = () =>
    setZoom((z) => {
      const nz = Math.min(ZOOM_MAX, z + ZOOM_BTN_STEP)
      sendPreviewCommand('zoom_in')
      return nz
    })
  const zoomOut = () =>
    setZoom((z) => {
      const nz = Math.max(ZOOM_MIN, z - ZOOM_BTN_STEP)
      sendPreviewCommand('zoom_out')
      return nz
    })
  const resetZoom = () => {
    setZoom(1)
    sendPreviewCommand('zoom_reset')
  }

  return (
    <div
      className="w-full flex-shrink-0 px-0 py-1.5"
      style={{ background: 'var(--tl-bg)', borderTop: '1px solid var(--tl-border)' }}
    >
      <div className="flex items-center gap-2 px-2">
        <div className="flex items-center gap-0.5">
          <span
            onClick={() => sendPreviewCommand('step_back')}
            className="flex h-6 w-6 items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--tl-toolbar-text)' }}
            data-tooltip="Step back"
          >
            <SkipBack size={12} fill="currentColor" />
          </span>
          <span
            onClick={() => sendPreviewCommand('toggle_play')}
            className="flex h-7 w-7 items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </span>
          <span
            onClick={() => sendPreviewCommand('step_forward')}
            className="flex h-6 w-6 items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--tl-toolbar-text)' }}
            data-tooltip="Step forward"
          >
            <SkipForward size={12} fill="currentColor" />
          </span>
        </div>

        {/* Scrub bar */}
        <div
          ref={scrubBarRef}
          className="flex-1 h-1.5 rounded-full cursor-pointer relative"
          style={{ background: 'var(--tl-border)' }}
          onMouseDown={(e) => {
            isScrubbing.current = true
            document.body.style.userSelect = 'none'
            const t = getScrubTime(e.clientX)
            setVisualScrubTime(t)
            sendPreviewCommand('seek', { time: t })
            e.preventDefault()
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
            style={{ background: 'var(--tl-playhead)', width: `${scrubPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
            style={{ left: `calc(${scrubPct}% - 6px)` }}
          />
        </div>

        {/* Timecode */}
        <div
          className="px-1.5 py-0.5 flex items-center justify-center text-[10px] font-mono tabular-nums whitespace-nowrap"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {formatTime(visualScrubTime ?? globalTime)} / {formatTime(totalDuration)}
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'var(--tl-border)' }} />

        {/* Zoom controls */}
        <span
          onClick={zoomOut}
          className="w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
          style={{ color: 'var(--tl-toolbar-text)' }}
          data-tooltip="Zoom out"
        >
          <Minus size={12} />
        </span>
        <span
          className="text-[10px] font-mono tabular-nums w-8 text-center select-none cursor-pointer transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          onClick={resetZoom}
          data-tooltip="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </span>
        <span
          onClick={zoomIn}
          className="w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
          style={{ color: 'var(--tl-toolbar-text)' }}
          data-tooltip="Zoom in"
        >
          <Plus size={12} />
        </span>
        <span
          onClick={() => sendPreviewCommand('zoom_reset')}
          className="w-6 h-6 flex items-center justify-center cursor-pointer transition-colors rounded"
          style={{ color: 'var(--tl-toolbar-text)' }}
          data-tooltip="Fit to viewport"
        >
          <Maximize size={12} />
        </span>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'var(--tl-border)' }} />

        {/* Timeline view toggle */}
        <span
          onClick={() => setTimelineView(timelineView === 'track' ? 'graph' : 'track')}
          data-tooltip={timelineView === 'track' ? 'Switch to node graph' : 'Switch to track timeline'}
          data-tooltip-pos="top"
          className="w-6 h-6 flex items-center justify-center cursor-pointer transition-colors rounded"
          style={{ color: 'var(--tl-toolbar-text)' }}
        >
          {timelineView === 'track' ? (
            <AlignStartVertical size={12} strokeWidth={2.5} />
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
            </svg>
          )}
        </span>
      </div>
    </div>
  )
}

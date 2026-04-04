'use client'

import { useCallback, useRef, useState, useMemo, memo } from 'react'
import { useVideoStore } from '@/lib/store'
import type { Clip, Track } from '@/lib/types'
import { CLIP_TRIM_HANDLE_WIDTH, SNAP_THRESHOLD, MIN_CLIP_DURATION } from './constants'
import { collectSnapTargets, findSnap, getTrackClipBounds } from './SnapEngine'
import type { TimelineTool } from './TimelineToolbar'
import { useWaveform } from './useWaveform'

/** Colors per clip sourceType */
const CLIP_COLORS: Record<string, string> = {
  scene: '#3b82f6',
  audio: '#a78bfa',
  video: '#65a30d',
  image: '#f59e0b',
  title: '#ec4899',
}

interface Props {
  track: Track
  pps: number
  scrollX: number
  containerWidth: number
  height: number
  totalDuration: number
  currentTime: number
  activeTool: TimelineTool
  /** ID of clip currently being dragged (to show ghost opacity) */
  draggingClipId?: string | null
  onClipDragStart?: (clipId: string, trackId: string, e: React.PointerEvent) => void
  /** Called when a trim operation snaps, so parent can render snap guide */
  onTrimSnap?: (time: number | null) => void
}

export default function TrackRow({
  track,
  pps,
  scrollX,
  containerWidth,
  height,
  totalDuration,
  currentTime,
  activeTool,
  draggingClipId,
  onClipDragStart,
  onTrimSnap,
}: Props) {
  const { selectedClipIds, toggleClipSelection, updateClip, getTimeline, splitClip } = useVideoStore()

  return (
    <div
      className="relative border-b border-[var(--color-border)]"
      style={{
        height,
        minHeight: height,
        minWidth: totalDuration * pps,
        background: track.muted ? 'rgba(255,255,255,0.02)' : 'transparent',
      }}
    >
      <div className="absolute top-0 bottom-0 left-0" style={{ width: totalDuration * pps }}>
        {track.clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            track={track}
            pps={pps}
            scrollX={scrollX}
            containerWidth={containerWidth}
            height={height}
            currentTime={currentTime}
            activeTool={activeTool}
            isDragging={draggingClipId === clip.id}
            isSelected={selectedClipIds.includes(clip.id)}
            onSelect={toggleClipSelection}
            onUpdate={updateClip}
            onSplit={splitClip}
            getTimeline={getTimeline}
            onDragStart={onClipDragStart}
            onTrimSnap={onTrimSnap}
          />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════

interface ClipBlockProps {
  clip: Clip
  track: Track
  pps: number
  scrollX: number
  containerWidth: number
  height: number
  currentTime: number
  activeTool: TimelineTool
  isDragging: boolean
  isSelected: boolean
  onSelect: (clipId: string, multi?: boolean) => void
  onUpdate: (clipId: string, updates: Partial<Clip>) => void
  onSplit: (clipId: string, atTime: number) => { leftId: string; rightId: string } | null
  getTimeline: () => import('@/lib/types').Timeline | null
  onDragStart?: (clipId: string, trackId: string, e: React.PointerEvent) => void
  onTrimSnap?: (time: number | null) => void
}

type TrimSide = 'left' | 'right' | null

/** Mirrored waveform path rendered as filled SVG */
const WaveformSVG = memo(function WaveformSVG({ peaks }: { peaks: number[] }) {
  const n = peaks.length
  if (n === 0) return null

  // Build a mirrored filled path: top half goes left→right, bottom half right→left
  const mid = 50
  const amp = 42 // max deviation from center (out of 100 viewBox height)
  const xScale = 1000 / n // spread across 1000-wide viewBox

  let d = `M 0 ${mid}`
  // Top edge (left to right)
  for (let i = 0; i < n; i++) {
    const x = i * xScale
    const y = mid - peaks[i] * amp
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  d += ` L ${(1000).toFixed(0)} ${mid}`
  // Bottom edge (right to left, mirrored)
  for (let i = n - 1; i >= 0; i--) {
    const x = i * xScale
    const y = mid + peaks[i] * amp
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  d += ' Z'

  return (
    <svg
      className="absolute inset-0"
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <path d={d} fill="rgba(255,255,255,0.35)" />
      {/* Center line */}
      <line x1="0" y1={mid} x2="1000" y2={mid} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
    </svg>
  )
})

/** Resolve an audio clip's sourceId to its actual audio file URL */
function useAudioUrl(clip: Clip): string | null {
  const scenes = useVideoStore((s) => s.scenes)
  return useMemo(() => {
    if (clip.sourceType !== 'audio') return null
    const sid = clip.sourceId
    if (sid.startsWith('aud-')) {
      const sceneId = sid.slice(4)
      return scenes.find((s) => s.id === sceneId)?.audioLayer?.src ?? null
    }
    if (sid.startsWith('tts-')) {
      const sceneId = sid.slice(4)
      return scenes.find((s) => s.id === sceneId)?.audioLayer?.tts?.src ?? null
    }
    if (sid.startsWith('mus-')) {
      const sceneId = sid.slice(4)
      return scenes.find((s) => s.id === sceneId)?.audioLayer?.music?.src ?? null
    }
    // SFX: sourceId is the sfx.id directly
    for (const scene of scenes) {
      const sfx = scene.audioLayer?.sfx?.find((s) => s.id === sid)
      if (sfx?.src) return sfx.src
    }
    return null
  }, [clip.sourceType, clip.sourceId, scenes])
}

function ClipBlock({
  clip,
  track,
  pps,
  scrollX,
  containerWidth,
  height,
  currentTime,
  activeTool,
  isDragging,
  isSelected,
  onSelect,
  onUpdate,
  onSplit,
  getTimeline,
  onDragStart,
  onTrimSnap,
}: ClipBlockProps) {
  const [trimActive, setTrimActive] = useState(false)
  const [hoverSide, setHoverSide] = useState<TrimSide>(null)
  const clipRef = useRef<HTMLDivElement>(null)

  // Waveform for audio clips (hooks must be called before early returns)
  const audioUrl = useAudioUrl(clip)
  const peaks = useWaveform(audioUrl)

  const left = clip.startTime * pps
  const width = Math.max(2, clip.duration * pps)

  // Cull clips outside visible range
  if (left + width < scrollX - 50 || left > scrollX + containerWidth + 50) return null

  const color = CLIP_COLORS[clip.sourceType] ?? '#64748b'
  const isMuted = track.muted
  const isLocked = track.locked
  const isRazor = activeTool === 'razor'

  // ── Trim ──
  const handleTrimStart = useCallback(
    (side: 'left' | 'right', e: React.PointerEvent) => {
      if (isLocked) return
      e.stopPropagation()
      e.preventDefault()
      setTrimActive(true)
      document.body.style.cursor = 'ew-resize'

      // Get adjacent clip bounds for overlap prevention
      const bounds = getTrackClipBounds(track, clip.id)
      const prevClipEnd = bounds.filter((b) => b.end <= clip.startTime + 0.001).pop()?.end ?? 0
      const nextClipStart = bounds.find((b) => b.start >= clip.startTime + clip.duration - 0.001)?.start ?? Infinity

      const snapTargets = collectSnapTargets(getTimeline(), currentTime, clip.id)

      const handleMove = (ev: PointerEvent) => {
        const deltaTime = (ev.clientX - e.clientX) / pps

        if (side === 'left') {
          let newStart = clip.startTime + deltaTime
          newStart = findSnap(newStart, pps, SNAP_THRESHOLD, snapTargets)
          // Clamp: can't go before previous clip end, can't make duration < min
          newStart = Math.max(prevClipEnd, newStart)
          newStart = Math.min(clip.startTime + clip.duration - MIN_CLIP_DURATION, newStart)
          const shift = newStart - clip.startTime
          const newDuration = clip.duration - shift
          const newTrimStart = Math.max(0, clip.trimStart + shift * clip.speed)
          onUpdate(clip.id, { startTime: newStart, duration: newDuration, trimStart: newTrimStart })
          // Report snap
          onTrimSnap?.(
            Math.abs(newStart - findSnap(newStart, pps, SNAP_THRESHOLD, snapTargets)) < 0.01 ? newStart : null,
          )
        } else {
          let newEnd = clip.startTime + clip.duration + deltaTime
          newEnd = findSnap(newEnd, pps, SNAP_THRESHOLD, snapTargets)
          // Clamp: can't go past next clip start, min duration
          newEnd = Math.min(nextClipStart, newEnd)
          newEnd = Math.max(clip.startTime + MIN_CLIP_DURATION, newEnd)
          const newDuration = newEnd - clip.startTime
          const newTrimEnd = clip.trimStart + newDuration * clip.speed
          onUpdate(clip.id, { duration: newDuration, trimEnd: newTrimEnd })
          onTrimSnap?.(Math.abs(newEnd - findSnap(newEnd, pps, SNAP_THRESHOLD, snapTargets)) < 0.01 ? newEnd : null)
        }
      }

      const handleUp = () => {
        setTrimActive(false)
        document.body.style.cursor = ''
        onTrimSnap?.(null)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [clip, track, pps, isLocked, currentTime, getTimeline, onUpdate, onTrimSnap],
  )

  // ── Hover detection ──
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (trimActive || isLocked || isRazor) return
      const rect = clipRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      if (x < CLIP_TRIM_HANDLE_WIDTH) setHoverSide('left')
      else if (x > rect.width - CLIP_TRIM_HANDLE_WIDTH) setHoverSide('right')
      else setHoverSide(null)
    },
    [trimActive, isLocked, isRazor],
  )

  // ── Click ──
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isRazor) {
        // Razor: split at click position
        const rect = clipRef.current?.getBoundingClientRect()
        if (!rect) return
        const clickX = e.clientX - rect.left
        const relTime = clickX / pps
        if (relTime > 0.01 && relTime < clip.duration - 0.01) {
          onSplit(clip.id, relTime)
        }
        return
      }
      onSelect(clip.id, e.metaKey || e.ctrlKey)
    },
    [clip.id, clip.duration, pps, isRazor, onSelect, onSplit],
  )

  // ── Pointer down (trim or drag) ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isLocked || isRazor) return
      const rect = clipRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      if (x < CLIP_TRIM_HANDLE_WIDTH) {
        handleTrimStart('left', e)
        return
      }
      if (x > rect.width - CLIP_TRIM_HANDLE_WIDTH) {
        handleTrimStart('right', e)
        return
      }
      if (onDragStart) {
        onDragStart(clip.id, track.id, e)
      }
    },
    [clip.id, track.id, isLocked, isRazor, handleTrimStart, onDragStart],
  )

  // Cursor logic
  let cursor: string
  if (isRazor) cursor = 'crosshair'
  else if (hoverSide) cursor = 'ew-resize'
  else if (isLocked) cursor = 'default'
  else cursor = 'grab'

  // Opacity: fade when being dragged
  let opacity = isMuted ? 0.5 : 1
  if (isDragging) opacity = 0.3

  return (
    <div
      ref={clipRef}
      className="absolute overflow-hidden rounded-[3px] flex items-center"
      style={{
        left,
        width,
        top: 2,
        bottom: 2,
        background: isMuted ? `${color}44` : `${color}cc`,
        border: trimActive ? '2px solid #22d3ee' : isSelected ? '2px solid #fff' : `1px solid ${color}`,
        cursor,
        opacity,
        transition: isDragging ? 'opacity 0.15s' : 'border-color 0.1s',
      }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverSide(null)}
    >
      {/* Left trim handle */}
      {(hoverSide === 'left' || trimActive) && !isRazor && (
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{
            width: CLIP_TRIM_HANDLE_WIDTH,
            background: hoverSide === 'left' || trimActive ? '#ffffff33' : 'transparent',
            borderRight: '1px solid #fff6',
          }}
        />
      )}
      {/* Right trim handle */}
      {(hoverSide === 'right' || trimActive) && !isRazor && (
        <div
          className="absolute right-0 top-0 bottom-0"
          style={{
            width: CLIP_TRIM_HANDLE_WIDTH,
            background: hoverSide === 'right' || trimActive ? '#ffffff33' : 'transparent',
            borderLeft: '1px solid #fff6',
          }}
        />
      )}

      {/* Waveform for audio clips */}
      {clip.sourceType === 'audio' && peaks.length > 0 && <WaveformSVG peaks={peaks} />}

      {/* Clip label */}
      {width > 30 && (
        <span
          className="relative z-10 truncate px-1.5"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        >
          {clip.label}
        </span>
      )}

      {/* Duration badge */}
      {width > 60 && (
        <span
          className="absolute z-10"
          style={{
            right: 4,
            bottom: 1,
            fontSize: 8,
            fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.7)',
            pointerEvents: 'none',
          }}
        >
          {clip.duration.toFixed(1)}s
        </span>
      )}
    </div>
  )
}

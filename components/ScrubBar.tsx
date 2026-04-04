'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import type { Scene } from '@/lib/types'

const SCENE_COLORS = ['#e84545', '#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

interface ScrubBarProps {
  totalDuration: number
  scenes: Scene[]
  currentTime: number
  isPlaying: boolean
  onSeek: (time: number) => void
  onPlayPause: () => void
  onStepFrame: (direction: -1 | 1) => void
  onJumpScene: (direction: -1 | 1) => void
}

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * 30) // frame number at 30fps
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export default function ScrubBar({
  totalDuration,
  scenes,
  currentTime,
  isPlaying,
  onSeek,
  onPlayPause,
  onStepFrame,
  onJumpScene,
}: ScrubBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  function pixelToTime(clientX: number): number {
    const bar = barRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * totalDuration
  }

  // Debounced seek — only fire after 50ms of no movement
  const debouncedSeek = useCallback(
    (time: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSeek(time)
      }, 50)
    },
    [onSeek],
  )

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true)
    onSeek(pixelToTime(e.clientX))
  }

  function handleMouseMove(e: React.MouseEvent) {
    const t = pixelToTime(e.clientX)
    setHoverTime(t)
    if (isDragging) {
      debouncedSeek(t)
    }
  }

  // Global mouseup to stop drag
  useEffect(() => {
    if (!isDragging) return
    const handleUp = () => {
      setIsDragging(false)
      // Cancel any pending debounced seek
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = undefined
      }
    }
    window.addEventListener('mouseup', handleUp)
    return () => window.removeEventListener('mouseup', handleUp)
  }, [isDragging])

  // Scene boundary offsets (for marker rendering)
  const sceneOffsets = useMemo(() => {
    let t = 0
    return scenes.map((s) => {
      const offset = totalDuration > 0 ? t / totalDuration : 0
      t += s.duration
      return offset
    })
  }, [scenes, totalDuration])

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  return (
    <div className="select-none">
      {/* Transport controls */}
      <div className="flex items-center gap-1 mb-2">
        {/* Jump to previous scene */}
        <button
          onClick={() => onJumpScene(-1)}
          className="kbd w-6 h-6 p-0 flex items-center justify-center text-[10px]"
          title="Previous scene boundary"
        >
          |◀
        </button>

        {/* Step back 1 frame */}
        <button
          onClick={() => onStepFrame(-1)}
          className="kbd w-6 h-6 p-0 flex items-center justify-center text-[10px]"
          title="Step back 1 frame (←)"
        >
          ◀
        </button>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className="kbd w-7 h-7 p-0 flex items-center justify-center text-[11px]"
          title="Play/Pause (Space)"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Step forward 1 frame */}
        <button
          onClick={() => onStepFrame(1)}
          className="kbd w-6 h-6 p-0 flex items-center justify-center text-[10px]"
          title="Step forward 1 frame (→)"
        >
          ▶
        </button>

        {/* Jump to next scene */}
        <button
          onClick={() => onJumpScene(1)}
          className="kbd w-6 h-6 p-0 flex items-center justify-center text-[10px]"
          title="Next scene boundary"
        >
          ▶|
        </button>

        {/* Timecodes */}
        <div className="flex-1 flex items-center justify-between px-2">
          <span className="text-[10px] font-mono text-[#6b6b7a]">{formatTimecode(currentTime)}</span>
          {hoverTime !== null && (
            <span className="text-[10px] font-mono text-[#e84545]">▼ {formatTimecode(hoverTime)}</span>
          )}
          <span className="text-[10px] font-mono text-[#6b6b7a]">{formatTimecode(totalDuration)}</span>
        </div>
      </div>

      {/* Main scrub bar */}
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverTime(null)}
        className="relative cursor-pointer"
        style={{ height: 8, overflow: 'visible' }}
      >
        {/* Track background */}
        <div className="absolute inset-0 rounded" style={{ background: '#2a2a32' }} />

        {/* Scene color blocks */}
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            className="absolute top-0 bottom-0"
            style={{
              left: `${sceneOffsets[i] * 100}%`,
              width: totalDuration > 0 ? `${(scene.duration / totalDuration) * 100}%` : '0%',
              background: SCENE_COLORS[i % SCENE_COLORS.length],
              opacity: 0.3,
              borderRadius: i === 0 ? '4px 0 0 4px' : i === scenes.length - 1 ? '0 4px 4px 0' : 0,
            }}
          />
        ))}

        {/* Progress fill */}
        <div
          className="absolute top-0 bottom-0 left-0 rounded"
          style={{
            width: `${progress}%`,
            background: '#e84545',
            opacity: 0.8,
          }}
        />

        {/* Scene boundary markers */}
        {sceneOffsets.slice(1).map((offset, i) => (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${offset * 100}%`,
              top: -4,
              width: 2,
              height: 16,
              background: '#4a4a52',
            }}
          />
        ))}

        {/* Playhead */}
        <div
          className="absolute"
          style={{
            left: `${progress}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            background: '#e84545',
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            zIndex: 10,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        />

        {/* Hover time indicator */}
        {hoverTime !== null && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: totalDuration > 0 ? `${(hoverTime / totalDuration) * 100}%` : '0%',
              top: -24,
              transform: 'translateX(-50%)',
              background: '#1a1a2e',
              color: '#f0ece0',
              padding: '2px 6px',
              borderRadius: 3,
              fontSize: 10,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {formatTimecode(hoverTime)}
          </div>
        )}
      </div>

      {/* Scene labels below bar */}
      <div className="relative" style={{ height: 16, marginTop: 2 }}>
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            className="absolute text-center overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              left: `${sceneOffsets[i] * 100}%`,
              width: totalDuration > 0 ? `${(scene.duration / totalDuration) * 100}%` : '0%',
              fontSize: 9,
              color: '#6b6b7a',
              paddingInline: 2,
            }}
          >
            {scene.name || `Scene ${i + 1}`}
          </div>
        ))}
      </div>
    </div>
  )
}

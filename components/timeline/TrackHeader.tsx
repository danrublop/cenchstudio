'use client'

import { useCallback, useState, useRef } from 'react'
import { useVideoStore } from '@/lib/store'
import type { Track } from '@/lib/types'
import { TRACK_HEADER_WIDTH } from './constants'

interface Props {
  track: Track
  height: number
}

export default function TrackHeader({ track, height }: Props) {
  const { updateTrack, removeTrack, addTrack } = useVideoStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(track.name)
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDoubleClick = useCallback(() => {
    setEditName(track.name)
    setIsEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }, [track.name])

  const commitName = useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== track.name) {
      updateTrack(track.id, { name: trimmed })
    }
    setIsEditing(false)
  }, [editName, track.id, track.name, updateTrack])

  const typeIcon = track.type === 'audio' ? '♪' : track.type === 'overlay' ? '◆' : '▶'
  const typeColor = track.type === 'audio' ? '#a78bfa' : track.type === 'overlay' ? '#f59e0b' : '#3b82f6'

  return (
    <div
      className="relative flex items-center gap-1 border-b border-r border-[var(--color-border)] bg-[var(--color-panel)] select-none"
      style={{ width: TRACK_HEADER_WIDTH, height, minHeight: height }}
      onContextMenu={(e) => {
        e.preventDefault()
        setShowMenu(!showMenu)
      }}
    >
      {/* Type indicator */}
      <span className="flex-shrink-0 text-center" style={{ width: 18, fontSize: 10, color: typeColor }}>
        {typeIcon}
      </span>

      {/* Track name */}
      {isEditing ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 bg-transparent border-b border-[var(--color-accent)] text-[var(--color-text-primary)] outline-none"
          style={{ fontSize: 11, padding: '0 2px' }}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') setIsEditing(false)
          }}
        />
      ) : (
        <span
          className="flex-1 min-w-0 truncate cursor-default"
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)' }}
          onDoubleClick={handleDoubleClick}
        >
          {track.name}
        </span>
      )}

      {/* Controls */}
      <div className="flex items-center gap-0.5 pr-1 flex-shrink-0">
        {/* Mute */}
        <span
          className="cursor-pointer px-0.5 rounded hover:bg-white/10"
          style={{
            fontSize: 10,
            color: track.muted ? '#ef4444' : 'var(--color-text-muted)',
            opacity: track.muted ? 1 : 0.6,
          }}
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          {track.muted ? 'M' : 'M'}
        </span>
        {/* Lock */}
        <span
          className="cursor-pointer px-0.5 rounded hover:bg-white/10"
          style={{
            fontSize: 10,
            color: track.locked ? '#f59e0b' : 'var(--color-text-muted)',
            opacity: track.locked ? 1 : 0.6,
          }}
          onClick={() => updateTrack(track.id, { locked: !track.locked })}
          title={track.locked ? 'Unlock' : 'Lock'}
        >
          {track.locked ? '🔒' : '🔓'}
        </span>
      </div>

      {/* Context menu */}
      {showMenu && (
        <div
          className="absolute left-full top-0 z-50 bg-[var(--color-panel)] border border-[var(--color-border)] rounded shadow-lg py-1"
          style={{ minWidth: 140 }}
          onMouseLeave={() => setShowMenu(false)}
        >
          <div
            className="px-3 py-1 text-xs cursor-pointer hover:bg-white/10 text-[var(--color-text-primary)]"
            onClick={() => {
              addTrack(track.type, track.type === 'audio' ? 'A' : 'V')
              setShowMenu(false)
            }}
          >
            Add {track.type} track
          </div>
          <div
            className="px-3 py-1 text-xs cursor-pointer hover:bg-white/10 text-red-400"
            onClick={() => {
              removeTrack(track.id)
              setShowMenu(false)
            }}
          >
            Delete track
          </div>
        </div>
      )}
    </div>
  )
}

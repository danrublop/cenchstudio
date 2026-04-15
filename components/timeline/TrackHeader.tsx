'use client'

import { useCallback, useState, useRef } from 'react'
import { useVideoStore } from '@/lib/store'
import type { Track } from '@/lib/types'
import { TRACK_HEADER_WIDTH } from './constants'
import { Lock, Eye, EyeOff, Mic } from 'lucide-react'

interface Props {
  track: Track
  height: number
}

export default function TrackHeader({ track, height }: Props) {
  const { updateTrack, removeTrack, addTrack, isAgentRunning } = useVideoStore()
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

  const isAudio = track.type === 'audio'

  return (
    <div
      className="relative flex items-center select-none"
      style={{
        width: TRACK_HEADER_WIDTH,
        height,
        minHeight: height,
        background: 'var(--tl-header-bg)',
        borderBottom: '1px solid var(--tl-border)',
        borderRight: '1px solid var(--tl-border)',
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!isAgentRunning) setShowMenu(!showMenu)
      }}
    >
      {/* Track label */}
      <span
        className="flex-shrink-0 font-bold ml-2"
        style={{
          fontSize: 12,
          color: 'var(--color-text-primary)',
        }}
        onDoubleClick={() => !isAgentRunning && handleDoubleClick()}
      >
        {track.name}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-0 ml-1.5 flex-shrink-0" style={{ opacity: isAgentRunning ? 0.4 : 1, pointerEvents: isAgentRunning ? 'none' : 'auto' }}>
        {/* Lock */}
        <span
          className="cursor-pointer w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
          style={{
            color: track.locked ? 'var(--tl-ruler-bar)' : 'var(--tl-ctrl-dim)',
          }}
          onClick={() => updateTrack(track.id, { locked: !track.locked })}
          title={track.locked ? 'Unlock' : 'Lock'}
        >
          <Lock size={11} />
        </span>

        {/* Source patch indicator */}
        <span
          className="w-5 h-5 flex items-center justify-center"
          style={{ fontSize: 9, color: 'var(--tl-ctrl-dim)' }}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <line x1="5" y1="8" x2="11" y2="8" />
          </svg>
        </span>

        {isAudio ? (
          <>
            {/* Mute */}
            <span
              className="cursor-pointer w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 font-bold"
              style={{
                fontSize: 10,
                color: track.muted ? '#ef4444' : 'var(--tl-toolbar-text)',
              }}
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              title={track.muted ? 'Unmute' : 'Mute'}
            >
              M
            </span>
            {/* Solo */}
            <span
              className="cursor-pointer w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 font-bold"
              style={{
                fontSize: 10,
                color: 'var(--tl-toolbar-text)',
              }}
              title="Solo"
            >
              S
            </span>
            {/* Mic */}
            <span
              className="w-5 h-5 flex items-center justify-center"
              style={{ color: 'var(--tl-ctrl-dim)' }}
            >
              <Mic size={11} />
            </span>
          </>
        ) : (
          <>
            {/* Visibility */}
            <span
              className="cursor-pointer w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
              style={{
                color: track.muted ? '#ef4444' : 'var(--tl-toolbar-text)',
              }}
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              title={track.muted ? 'Show' : 'Hide'}
            >
              {track.muted ? <EyeOff size={11} /> : <Eye size={11} />}
            </span>
          </>
        )}
      </div>

      {/* Editable name (double-click) */}
      {isEditing && (
        <input
          ref={inputRef}
          className="absolute inset-0 outline-none px-2 z-10"
          style={{ fontSize: 11, background: 'var(--tl-bg)', border: '1px solid var(--tl-playhead)', color: 'var(--color-text-primary)' }}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') setIsEditing(false)
          }}
        />
      )}

      {/* Context menu */}
      {showMenu && (
        <div
          className="absolute left-full top-0 z-50 rounded shadow-lg py-1"
          style={{ minWidth: 140, background: 'var(--tl-header-bg)', border: '1px solid var(--tl-border)' }}
          onMouseLeave={() => setShowMenu(false)}
        >
          <div
            className="px-3 py-1 text-sm cursor-pointer hover:bg-white/10"
            style={{ color: 'var(--color-text-primary)' }}
            onClick={() => {
              addTrack(track.type, track.type === 'audio' ? 'A' : 'V')
              setShowMenu(false)
            }}
          >
            Add {track.type} track
          </div>
          <div
            className="px-3 py-1 text-sm cursor-pointer hover:bg-white/10 text-red-400"
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

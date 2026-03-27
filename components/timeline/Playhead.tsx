'use client'

import React from 'react'

interface Props {
  currentTime: number
  pps: number
  scrollX: number
  containerWidth: number
  isDragging: boolean
  dragTime: number
  onPointerDown: (e: React.PointerEvent) => void
}

function formatTimeFull(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`
}

export default function Playhead({
  currentTime, pps, scrollX, containerWidth,
  isDragging, dragTime, onPointerDown,
}: Props) {
  const displayTime = isDragging ? dragTime : currentTime
  const x = displayTime * pps - scrollX

  // Only render if visible
  if (x < -10 || x > containerWidth + 10) return null

  return (
    <div
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: x, width: 0 }}
    >
      {/* Drag handle — triangle */}
      <div
        className="pointer-events-auto cursor-col-resize"
        style={{
          position: 'absolute',
          top: 0,
          left: -5,
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '8px solid #e84545',
        }}
        onPointerDown={onPointerDown}
      />
      {/* Time tooltip */}
      {isDragging && (
        <div
          className="absolute whitespace-nowrap"
          style={{
            top: -18,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 9,
            fontFamily: 'monospace',
            background: '#e84545',
            color: '#fff',
            padding: '1px 4px',
            borderRadius: 3,
            lineHeight: '14px',
          }}
        >
          {formatTimeFull(dragTime)}
        </div>
      )}
      {/* Vertical line */}
      <div
        className="absolute"
        style={{
          top: 0,
          bottom: 0,
          left: -1,
          width: 2,
          background: '#e84545',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

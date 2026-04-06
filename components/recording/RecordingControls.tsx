'use client'

import React from 'react'

const LEVEL_BARS = 5

// ── Shared recording UI primitives ──────────────────────────────

export function AudioLevelBars({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-px h-3.5 ml-0.5">
      {Array.from({ length: LEVEL_BARS }, (_, i) => {
        const threshold = Math.pow((i + 1) / LEVEL_BARS, 2)
        const active = level >= threshold
        let color: string
        if (i >= LEVEL_BARS - 1) color = '#e05252'
        else if (i >= LEVEL_BARS - 2) color = '#e0a852'
        else color = '#52e087'
        return (
          <div
            key={i}
            className="rounded-sm transition-all"
            style={{
              width: 2.5,
              height: 4 + i * 2,
              background: active ? color : 'rgba(255,255,255,0.08)',
            }}
          />
        )
      })}
    </div>
  )
}

export function RecordingTimer({
  elapsed,
  isRecording,
  isPaused,
  isSaving,
}: {
  elapsed: number
  isRecording: boolean
  isPaused: boolean
  isSaving: boolean
}) {
  const totalSec = Math.floor(elapsed / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  const time = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`

  return (
    <div className="flex items-center gap-2">
      {isRecording && (
        <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#e05252' }} />
      )}
      {isPaused && (
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#e0a852' }} />
      )}
      {isSaving && (
        <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#52a8e0' }} />
      )}
      <span
        className="text-sm font-mono tabular-nums"
        style={{ color: isRecording ? '#e05252' : '#f0ece0', minWidth: 52 }}
      >
        {isSaving ? 'Saving...' : time}
      </span>
    </div>
  )
}

export function ControlButton({
  onClick,
  title,
  children,
  active,
  variant,
  size = 'sm',
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
  active?: boolean
  variant?: 'stop' | 'record'
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = size === 'lg' ? 'w-10 h-10' : size === 'md' ? 'w-8 h-8' : 'w-7 h-7'
  return (
    <span
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center ${dims} rounded-md cursor-pointer transition-colors`}
      style={{
        color:
          variant === 'stop' ? '#e05252' :
          variant === 'record' ? '#e05252' :
          active === false ? '#4a4a55' : '#c0bdb0',
        background: variant === 'record' ? 'rgba(224,82,82,0.15)' : 'transparent',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background =
        variant === 'record' ? 'rgba(224,82,82,0.25)' : 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background =
        variant === 'record' ? 'rgba(224,82,82,0.15)' : 'transparent')}
    >
      {children}
    </span>
  )
}

export function DevicePicker({
  devices,
  selectedId,
  onSelect,
  onClose,
}: {
  devices: Array<{ id: string; label: string }>
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className="absolute bottom-full mb-2 left-0 z-20 rounded-lg py-1 min-w-[200px] shadow-xl"
        style={{
          background: 'rgba(24, 24, 28, 0.96)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {devices.map((d) => (
          <div
            key={d.id}
            onClick={() => onSelect(d.id)}
            className="px-3 py-1.5 text-sm cursor-pointer transition-colors truncate"
            style={{
              color: d.id === selectedId ? '#f0ece0' : '#8a8a95',
              background: d.id === selectedId ? 'rgba(255,255,255,0.06)' : 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = d.id === selectedId ? 'rgba(255,255,255,0.06)' : 'transparent'
            }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </>
  )
}

export function Divider() {
  return <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.08)' }} />
}

'use client'

import { TOOLBAR_WIDTH } from './constants'

export type TimelineTool = 'select' | 'razor' | 'slip' | 'slide' | 'ripple' | 'hand'

const TOOLS: { id: TimelineTool; label: string; icon: string; shortcut: string }[] = [
  { id: 'select', label: 'Selection', icon: '↖', shortcut: 'V' },
  { id: 'razor', label: 'Razor', icon: '✂', shortcut: 'C' },
  { id: 'ripple', label: 'Ripple Edit', icon: '⇔', shortcut: 'B' },
  { id: 'slip', label: 'Slip', icon: '⇹', shortcut: 'Y' },
  { id: 'hand', label: 'Hand', icon: '✋', shortcut: 'H' },
]

interface Props {
  activeTool: TimelineTool
  onToolChange: (tool: TimelineTool) => void
  height: number
}

export default function TimelineToolbar({ activeTool, onToolChange, height }: Props) {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center gap-0.5 border-r border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden py-1"
      style={{ width: TOOLBAR_WIDTH, height }}
    >
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id
        return (
          <div
            key={tool.id}
            className="flex items-center justify-center rounded cursor-pointer select-none"
            style={{
              width: TOOLBAR_WIDTH - 6,
              height: TOOLBAR_WIDTH - 8,
              fontSize: 14,
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
              transition: 'all 0.1s',
            }}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => onToolChange(tool.id)}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            {tool.icon}
          </div>
        )
      })}
    </div>
  )
}

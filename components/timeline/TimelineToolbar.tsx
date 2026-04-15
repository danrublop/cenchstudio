'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Hand } from 'lucide-react'
import { TOOLBAR_WIDTH } from './constants'
import { useVideoStore } from '@/lib/store'

export type TimelineTool = 'select' | 'razor' | 'slip' | 'slide' | 'ripple' | 'hand'

const TOOLS: { id: TimelineTool; label: string; icon: ReactNode; shortcut: string }[] = [
  { id: 'select', label: 'Selection', icon: '↖', shortcut: 'V' },
  { id: 'razor', label: 'Razor', icon: '✂', shortcut: 'C' },
  { id: 'ripple', label: 'Ripple Edit', icon: '⇔', shortcut: 'B' },
  { id: 'slip', label: 'Slip', icon: '⇹', shortcut: 'Y' },
  {
    id: 'hand',
    label: 'Hand',
    icon: <Hand size={15} strokeWidth={2} aria-hidden />,
    shortcut: 'H',
  },
]

interface Props {
  activeTool: TimelineTool
  onToolChange: (tool: TimelineTool) => void
  height: number
}

export default function TimelineToolbar({ activeTool, onToolChange, height }: Props) {
  const { addTrack, project, isAgentRunning } = useVideoStore()
  const [showAddMenu, setShowAddMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showAddMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [showAddMenu])

  const handleAddTrack = (type: 'video' | 'audio') => {
    const tracks = project.timeline?.tracks ?? []
    const count = tracks.filter((t) => t.type === type).length + 1
    const prefix = type === 'video' ? 'V' : 'A'
    addTrack(type, `${prefix}${count}`)
    setShowAddMenu(false)
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center gap-0.5 overflow-visible py-1"
      style={{ width: TOOLBAR_WIDTH, height, position: 'relative', background: 'var(--tl-track-bg)', borderRight: '1px solid var(--tl-border)' }}
    >
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id
        const isEditTool = tool.id !== 'select' && tool.id !== 'hand'
        const isDisabled = isAgentRunning && isEditTool
        return (
          <div
            key={tool.id}
            className="flex items-center justify-center rounded select-none"
            style={{
              width: TOOLBAR_WIDTH - 6,
              height: TOOLBAR_WIDTH - 8,
              fontSize: 14,
              background: isActive ? 'var(--tl-toolbar-active)' : 'transparent',
              color: isActive ? '#fff' : 'var(--tl-toolbar-text)',
              border: isActive ? '1px solid var(--tl-toolbar-active)' : '1px solid transparent',
              borderRadius: 3,
              transition: 'all 0.1s',
              opacity: isDisabled ? 0.3 : 1,
              cursor: isDisabled ? 'default' : 'pointer',
              pointerEvents: isDisabled ? 'none' : 'auto',
            }}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => !isDisabled && onToolChange(tool.id)}
            onMouseEnter={(e) => {
              if (!isActive && !isDisabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            {tool.icon}
          </div>
        )
      })}

      <div className="w-[80%] h-[1px] my-1" style={{ background: 'var(--tl-border)' }} />

      {/* Add Track Button */}
      <div
        className="flex items-center justify-center rounded select-none hover:bg-white/10"
        style={{
          width: TOOLBAR_WIDTH - 6,
          height: TOOLBAR_WIDTH - 8,
          fontSize: 16,
          color: 'var(--tl-ctrl-text)',
          background: showAddMenu ? 'rgba(255,255,255,0.12)' : 'transparent',
          opacity: isAgentRunning ? 0.3 : 1,
          cursor: isAgentRunning ? 'default' : 'pointer',
          pointerEvents: isAgentRunning ? 'none' : 'auto',
        }}
        title="Add Track"
        onClick={() => !isAgentRunning && setShowAddMenu(!showAddMenu)}
      >
        +
      </div>

      {showAddMenu && (
        <div
          ref={menuRef}
          className="absolute left-[calc(100%+4px)] top-0 z-[100] rounded shadow-2xl py-1 transform translate-y-10"
          style={{ minWidth: 140, background: 'var(--tl-header-bg)', border: '1px solid var(--tl-border)' }}
        >
          <div
            className="px-3 py-2 text-xs font-bold mb-1"
            style={{ color: 'var(--tl-toolbar-text)', borderBottom: '1px solid var(--tl-border)' }}
          >
            Add New Track
          </div>
          <div
            className="px-3 py-1.5 text-sm cursor-pointer hover:bg-white/10 flex items-center justify-between"
            style={{ color: 'var(--color-text-primary)' }}
            onClick={() => handleAddTrack('video')}
          >
            <span>Video Track</span>
            <span className="text-[10px] opacity-50" style={{ color: 'var(--tl-toolbar-text)' }}>V</span>
          </div>
          <div
            className="px-3 py-1.5 text-sm cursor-pointer hover:bg-white/10 flex items-center justify-between"
            style={{ color: 'var(--color-text-primary)' }}
            onClick={() => handleAddTrack('audio')}
          >
            <span>Audio Track</span>
            <span className="text-[10px] opacity-50" style={{ color: 'var(--tl-toolbar-text)' }}>A</span>
          </div>
        </div>
      )}
    </div>
  )
}

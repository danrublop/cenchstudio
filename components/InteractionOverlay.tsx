'use client'

import { useCallback, useRef, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import type { Scene, InteractionElement } from '@/lib/types'

interface InteractionOverlayProps {
  scene: Scene
  mode: 'edit' | 'preview'
  currentTime: number
  onElementClick?: (elementId: string) => void
  onElementMove?: (elementId: string, x: number, y: number) => void
}

const TYPE_COLORS: Record<string, string> = {
  hotspot: '#f59e0b',
  choice: '#3b82f6',
  quiz: '#8b5cf6',
  gate: '#10b981',
  tooltip: '#06b6d4',
  form: '#ec4899',
}

const TYPE_LABELS: Record<string, string> = {
  hotspot: 'Hotspot',
  choice: 'Choice',
  quiz: 'Quiz',
  gate: 'Gate',
  tooltip: 'Tooltip',
  form: 'Form',
}

interface DragState {
  elementId: string
  startX: number
  startY: number
  origX: number
  origY: number
  containerRect: DOMRect
}

export default function InteractionOverlay({
  scene,
  mode,
  currentTime,
  onElementClick,
  onElementMove,
}: InteractionOverlayProps) {
  const { updateInteraction } = useVideoStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const interactions: InteractionElement[] = scene.interactions ?? []

  const isVisible = (el: InteractionElement) => {
    if (mode === 'edit') return true
    if (currentTime < el.appearsAt) return false
    if (el.hidesAt !== null && currentTime > el.hidesAt) return false
    return true
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, el: InteractionElement) => {
      if (mode !== 'edit') return
      e.stopPropagation()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      dragRef.current = {
        elementId: el.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.x,
        origY: el.y,
        containerRect: rect,
      }
      setSelectedId(el.id)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [mode]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = ((e.clientX - d.startX) / d.containerRect.width) * 100
      const dy = ((e.clientY - d.startY) / d.containerRect.height) * 100
      const newX = Math.max(0, Math.min(100, d.origX + dx))
      const newY = Math.max(0, Math.min(100, d.origY + dy))
      updateInteraction(scene.id, d.elementId, { x: newX, y: newY } as any)
      onElementMove?.(d.elementId, newX, newY)
    },
    [scene.id, updateInteraction, onElementMove]
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {interactions.filter(isVisible).map((el) => {
        const color = TYPE_COLORS[el.type] ?? '#e84545'
        const isSelected = mode === 'edit' && selectedId === el.id

        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              border: `2px solid ${color}`,
              borderRadius: el.type === 'hotspot' ? (
                (el as any).shape === 'circle' ? '50%' : (el as any).shape === 'pill' ? '999px' : '6px'
              ) : '6px',
              background: `${color}22`,
              cursor: mode === 'edit' ? 'move' : 'pointer',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
              animation: el.type === 'hotspot' && (el as any).style === 'pulse'
                ? 'cench-studio-pulse 2s infinite'
                : undefined,
            }}
            onPointerDown={(e) => handlePointerDown(e, el)}
            onClick={() => {
              if (mode === 'edit') {
                onElementClick?.(el.id)
                setSelectedId(el.id)
              }
            }}
          >
            {/* Type badge */}
            <div
              style={{
                position: 'absolute',
                top: -18,
                left: 0,
                background: color,
                color: 'white',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                display: mode === 'edit' ? 'block' : 'none',
              }}
            >
              {TYPE_LABELS[el.type] ?? el.type}
            </div>

            {/* Label for hotspot */}
            {el.type === 'hotspot' && (el as any).label && (
              <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>
                {(el as any).label}
              </span>
            )}

            {/* Resize handle (edit mode, selected) */}
            {isSelected && (
              <>
                {/* Corner resize handles */}
                {['nw', 'ne', 'sw', 'se'].map((corner) => (
                  <div
                    key={corner}
                    style={{
                      position: 'absolute',
                      width: 8,
                      height: 8,
                      background: 'white',
                      border: `2px solid ${color}`,
                      borderRadius: 2,
                      ...(corner.includes('n') ? { top: -4 } : { bottom: -4 }),
                      ...(corner.includes('w') ? { left: -4 } : { right: -4 }),
                      cursor: `${corner}-resize`,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )
      })}

      {/* Pulse animation style */}
      <style>{`
        @keyframes cench-studio-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { ChevronRight, Pin, X, Trash2 } from 'lucide-react'

export interface ConversationContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onRename: () => void
  onPin: () => void
  onClear: () => void
  onDelete: () => void
}

export function ConversationContextMenu({
  x,
  y,
  onClose,
  onRename,
  onPin,
  onClear,
  onDelete,
}: ConversationContextMenuProps) {
  useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [onClose])

  const items = [
    { label: 'Rename', action: onRename, icon: <ChevronRight size={11} /> },
    { label: 'Pin / Unpin', action: onPin, icon: <Pin size={11} /> },
    { label: 'Clear messages', action: onClear, icon: <X size={11} /> },
    { type: 'divider' as const },
    { label: 'Delete', action: onDelete, icon: <Trash2 size={11} />, danger: true },
  ]

  return (
    <div
      className="fixed z-[1000] rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] py-1 min-w-[140px]"
      style={{ top: y, left: x, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        'type' in item && item.type === 'divider' ? (
          <div key={i} className="h-px bg-[var(--color-border)] my-1" />
        ) : (
          <span
            key={i}
            onClick={item.action}
            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] cursor-pointer transition-colors hover:bg-[var(--color-border)]/30 ${
              'danger' in item && item.danger ? 'text-red-400' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {'icon' in item && item.icon}
            {'label' in item && item.label}
          </span>
        ),
      )}
    </div>
  )
}

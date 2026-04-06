'use client'

import { useState, useRef, useEffect } from 'react'
import { ControlRow } from './ControlRow'

interface Props {
  label: string
  value: string
  palette?: string[]
  allowNone?: boolean
  onChange: (value: string) => void
}

export function ColorPicker({ label, value, palette = [], allowNone, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [customHex, setCustomHex] = useState(value === 'none' ? '' : value)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value !== 'none') setCustomHex(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <ControlRow label={label}>
      <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
        <span
          role="button"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          className="w-6 h-6 rounded cursor-pointer flex-shrink-0 border border-[#2a2a32]"
          style={{
            background:
              value === 'none' ? 'repeating-conic-gradient(#3a3a42 0% 25%, transparent 0% 50%) 50% / 8px 8px' : value,
          }}
        />

        <input
          value={customHex}
          onChange={(e) => setCustomHex(e.target.value)}
          onBlur={() => {
            if (/^#[0-9a-fA-F]{3,8}$/.test(customHex)) {
              onChange(customHex)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && /^#[0-9a-fA-F]{3,8}$/.test(customHex)) {
              onChange(customHex)
            }
          }}
          className="w-[72px] bg-[var(--color-input-bg,#1a1a1f)] border border-[var(--color-border,#2a2a32)] rounded text-[var(--color-text-primary,#f0ece0)] text-[11px] font-mono px-1.5 py-0.5"
        />

        {open && (
          <div className="absolute top-full right-0 mt-1 z-50 bg-[var(--color-panel,#1a1a1f)] border border-[var(--color-border,#2a2a32)] rounded-md p-2 flex flex-wrap gap-1 w-[152px] shadow-lg">
            {palette.map((color) => (
              <span
                key={color}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChange(color)
                  setCustomHex(color)
                  setOpen(false)
                }}
                className="w-6 h-6 rounded cursor-pointer border-2 hover:scale-110 transition-transform"
                style={{
                  background: color,
                  borderColor: color === value ? '#fff' : 'transparent',
                }}
              />
            ))}
            {allowNone && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChange('none')
                  setOpen(false)
                }}
                className="w-6 h-6 rounded cursor-pointer border-2 border-dashed border-[#4a4a52] flex items-center justify-center text-[8px] text-[#6b6b7a] hover:border-[#6b6b7a] transition-colors"
              >
                /
              </span>
            )}
            <input
              type="color"
              value={customHex || '#000000'}
              onChange={(e) => {
                setCustomHex(e.target.value)
                onChange(e.target.value)
              }}
              className="w-6 h-6 p-0 border-none cursor-pointer rounded"
            />
          </div>
        )}
      </div>
    </ControlRow>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const OPTION_COLORS = [
  '#e8a849', // amber
  '#5ec4b6', // teal
  '#e06c75', // coral
  '#61afef', // sky blue
  '#c678dd', // lavender
  '#98c379', // sage green
  '#d19a66', // sand
  '#56b6c2', // cyan
  '#be5046', // rust
  '#e5c07b', // gold
]

function colorForLabel(label: string): string {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0
  return OPTION_COLORS[((h % OPTION_COLORS.length) + OPTION_COLORS.length) % OPTION_COLORS.length]
}

export interface ColorSelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: ColorSelectOption[]
  className?: string
  size?: 'sm' | 'md'
  /** Optional label rendered above the dropdown, colored to match the selected value */
  label?: string
}

export default function ColorSelect({ value, onChange, options, className = '', size = 'sm', label }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => o.value === String(value))
  const selectedColor = selected ? colorForLabel(selected.label) : 'var(--color-text-primary)'
  const textSize = size === 'md' ? 'text-sm' : 'text-[11px]'
  const labelSize = size === 'md' ? 'text-[11px]' : 'text-[10px]'

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && (
        <div className={`flex items-center gap-1.5 ${labelSize} mb-0.5`}>
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="font-medium" style={{ color: selectedColor }}>
            {label}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-1.5 border rounded px-2 py-1 ${textSize} transition-colors cursor-pointer no-style`}
        style={{
          backgroundColor: 'var(--color-input-bg)',
          borderColor: open ? '#e84545' : 'var(--color-border)',
        }}
      >
        <span className="truncate font-medium" style={{ color: selectedColor }}>
          {selected?.label ?? value}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: selectedColor }}
          />
          <ChevronDown
            size={12}
            className="transition-transform"
            style={{
              color: 'var(--color-text-muted)',
              transform: open ? 'rotate(180deg)' : undefined,
            }}
          />
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[200] border rounded-lg shadow-xl p-1 flex flex-col gap-0.5 max-h-[240px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
          style={{
            backgroundColor: 'var(--color-panel)',
            borderColor: 'var(--color-border)',
          }}
        >
          {options.map((opt) => {
            const color = colorForLabel(opt.label)
            const isActive = String(opt.value) === String(value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md ${textSize} no-style cursor-pointer transition-colors ${
                  isActive ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                }`}
              >
                <span className="truncate font-medium" style={{ color }}>
                  {opt.label}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0 ml-2"
                  style={{ backgroundColor: color, opacity: isActive ? 1 : 0.4 }}
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

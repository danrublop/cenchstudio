'use client'

import { ControlRow } from './ControlRow'

interface Props {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

export function NumberInput({ label, value, min, max, step = 1, suffix, onChange }: Props) {
  const clamp = (v: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v))

  return (
    <ControlRow label={label}>
      <div className="flex items-center gap-0.5">
        <span
          role="button"
          tabIndex={0}
          onClick={() => onChange(clamp(value - step))}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-[#6b6b7a] hover:text-[var(--color-text-primary,#f0ece0)] hover:bg-[#2a2a32] cursor-pointer select-none transition-colors"
        >
          -
        </span>
        <input
          type="number"
          value={Math.round(value * 1000) / 1000}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(clamp(v))
          }}
          className="w-[56px] bg-[var(--color-input-bg,#1a1a1f)] border border-[var(--color-border,#2a2a32)] rounded text-[var(--color-text-primary,#f0ece0)] text-[10px] font-mono px-1.5 py-0.5 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span
          role="button"
          tabIndex={0}
          onClick={() => onChange(clamp(value + step))}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-[#6b6b7a] hover:text-[var(--color-text-primary,#f0ece0)] hover:bg-[#2a2a32] cursor-pointer select-none transition-colors"
        >
          +
        </span>
        {suffix && <span className="text-[9px] text-[#4a4a52] ml-0.5">{suffix}</span>}
      </div>
    </ControlRow>
  )
}

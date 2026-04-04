'use client'

import { ControlRow } from './ControlRow'

interface Props {
  label: string
  value: string
  options: string[]
  optionLabels?: string[]
  onChange: (value: string) => void
}

export function SelectInput({ label, value, options, optionLabels, onChange }: Props) {
  return (
    <ControlRow label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[var(--color-input-bg,#1a1a1f)] border border-[var(--color-border,#2a2a32)] rounded text-[var(--color-text-primary,#f0ece0)] text-[10px] font-mono px-1.5 py-1 cursor-pointer min-w-[80px]"
      >
        {options.map((opt, i) => (
          <option key={opt} value={opt}>
            {optionLabels?.[i] ?? opt}
          </option>
        ))}
      </select>
    </ControlRow>
  )
}

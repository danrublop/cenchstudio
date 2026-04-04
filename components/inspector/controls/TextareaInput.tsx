'use client'

import { useState, useEffect } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
}

export function TextareaInput({ label, value, onChange }: Props) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-[#6b6b7a] uppercase tracking-wider">{label}</span>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onChange(local)
        }}
        rows={2}
        className="w-full bg-[var(--color-input-bg,#1a1a1f)] border border-[var(--color-border,#2a2a32)] rounded text-[var(--color-text-primary,#f0ece0)] text-[11px] font-mono px-2 py-1.5 resize-y min-h-[40px]"
      />
    </div>
  )
}

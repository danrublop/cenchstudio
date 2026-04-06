'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function Section({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[var(--color-border,#2a2a32)] last:border-b-0">
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-3 py-2 cursor-pointer select-none text-[11px] uppercase tracking-wider text-[#6b6b7a] hover:text-[var(--color-text-primary,#f0ece0)] transition-colors"
      >
        <ChevronDown size={10} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        {title}
      </span>
      {open && <div className="px-3 pb-3 space-y-1.5">{children}</div>}
    </div>
  )
}

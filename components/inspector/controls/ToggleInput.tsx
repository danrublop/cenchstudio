'use client'

import { ControlRow } from './ControlRow'

interface Props {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

export function ToggleInput({ label, value, onChange }: Props) {
  return (
    <ControlRow label={label}>
      <span
        role="switch"
        tabIndex={0}
        aria-checked={value}
        onClick={() => onChange(!value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onChange(!value)
        }}
        className={`w-8 h-[18px] rounded-full cursor-pointer transition-colors relative flex-shrink-0 ${
          value ? 'bg-[#e84545]' : 'bg-[#2a2a32]'
        }`}
      >
        <span
          className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
            value ? 'translate-x-[16px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </ControlRow>
  )
}

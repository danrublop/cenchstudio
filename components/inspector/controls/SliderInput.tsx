'use client'

import { ControlRow } from './ControlRow'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

export function SliderInput({ label, value, min, max, step = 0.01, onChange }: Props) {
  return (
    <ControlRow label={label}>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1 appearance-none bg-[#2a2a32] rounded-full cursor-pointer accent-[#e84545] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#e84545] [&::-webkit-slider-thumb]:rounded-full"
        />
        <span className="text-[10px] font-mono text-[#6b6b7a] w-8 text-right">{Math.round(value * 100)}%</span>
      </div>
    </ControlRow>
  )
}

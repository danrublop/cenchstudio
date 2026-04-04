'use client'

interface Props {
  label: string
  children: React.ReactNode
}

export function ControlRow({ label, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 min-h-[28px]">
      <span className="text-[10px] text-[#6b6b7a] uppercase tracking-wider flex-shrink-0 w-[72px]">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  )
}

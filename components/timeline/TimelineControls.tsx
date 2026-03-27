'use client'

interface Props {
  pps?: number
  minPPS?: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitAll: () => void
}

export default function TimelineControls({ onZoomIn, onZoomOut, onFitAll }: Props) {
  return (
    <div className="absolute top-1 right-2 z-10 flex items-center gap-1">
      <button onClick={onZoomOut} className="kbd h-6 w-6 p-0 flex items-center justify-center text-white font-bold">
        <span className="text-sm leading-none">-</span>
      </button>
      <button onClick={onZoomIn} className="kbd h-6 w-6 p-0 flex items-center justify-center text-white font-bold">
        <span className="text-sm leading-none">+</span>
      </button>
      <button onClick={onFitAll} className="kbd h-6 px-2 flex items-center justify-center text-white text-[9px] font-bold">
        Fit
      </button>
    </div>
  )
}

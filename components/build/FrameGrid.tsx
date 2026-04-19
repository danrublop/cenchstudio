'use client'

import { Loader2 } from 'lucide-react'
import type { FrameState } from '@/lib/build/types'

interface Props {
  frames: FrameState[]
  templateUrl?: string
  onSelectFrame: (frameIndex: number) => void
}

export default function FrameGrid({ frames, templateUrl, onSelectFrame }: Props) {
  if (frames.length === 0 && !templateUrl) return null

  return (
    <div className="space-y-2">
      {templateUrl && (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-input-bg)] border border-[var(--color-border)]">
            ControlNet
          </span>
          <span className="truncate">{templateUrl.split('/').pop()}</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {frames.map((frame) => (
          <div
            key={frame.index}
            className={`relative aspect-video rounded overflow-hidden bg-[var(--color-input-bg)] border border-[var(--color-border)] transition-colors ${
              frame.status === 'done' ? 'cursor-pointer hover:border-blue-500/50' : ''
            }`}
            onClick={() => frame.status === 'done' && onSelectFrame(frame.index)}
          >
            {frame.status === 'active' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={16} className="text-blue-400 animate-spin" />
              </div>
            )}
            {frame.status === 'done' && frame.thumbnailUrl && (
              <img
                src={frame.thumbnailUrl}
                alt={`Frame ${frame.index + 1}`}
                className="w-full h-full object-cover opacity-0 animate-[fadeIn_0.5s_ease_forwards]"
              />
            )}
            {frame.status === 'pending' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-1 rounded bg-[var(--color-border)]" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 px-1 text-[10px] text-[var(--color-text-muted)] bg-black/40 rounded-tl">
              {frame.index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

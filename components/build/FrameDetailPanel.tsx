'use client'

import { X } from 'lucide-react'
import type { FrameState } from '@/lib/build/types'

interface Props {
  frame: FrameState
  templateUrl?: string
  onClose: () => void
}

export default function FrameDetailPanel({ frame, templateUrl, onClose }: Props) {
  return (
    <div className="absolute inset-y-0 right-0 w-80 bg-[var(--color-panel)] border-l border-[var(--color-border)] flex flex-col z-20 animate-[slideInRight_0.2s_ease]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Frame {frame.index + 1}</span>
        <span
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 cursor-pointer transition-colors"
          onClick={onClose}
        >
          <X size={12} className="text-[var(--color-text-muted)]" />
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Prompt */}
        {frame.prompt && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Prompt</div>
            <div className="text-sm text-[var(--color-text-primary)] leading-relaxed bg-[var(--color-input-bg)] rounded p-2 border border-[var(--color-border)]">
              {frame.prompt}
            </div>
          </div>
        )}

        {/* Template vs Output */}
        {(templateUrl || frame.outputUrl) && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Comparison</div>
            <div className="grid grid-cols-2 gap-2">
              {templateUrl && (
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Template</div>
                  <div className="aspect-video rounded overflow-hidden border border-[var(--color-border)] bg-[var(--color-input-bg)]">
                    <img src={templateUrl} alt="Template" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              {frame.outputUrl && (
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Output</div>
                  <div className="aspect-video rounded overflow-hidden border border-[var(--color-border)] bg-[var(--color-input-bg)]">
                    <img src={frame.outputUrl} alt="Output" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generation details */}
        {frame.durationMs != null && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Details</div>
            <div className="text-sm text-[var(--color-text-muted)] space-y-0.5">
              <div>Duration: {(frame.durationMs / 1000).toFixed(1)}s</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

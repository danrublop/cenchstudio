'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
}

export function ThinkingBlock({ thinking, isStreaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)

  const wordCount = thinking.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="my-1.5 rounded-md border border-[var(--color-border)] overflow-hidden text-[11px] font-mono">
      {/* Header — always visible */}
      <button
        onClick={() => !isStreaming && setExpanded((e) => !e)}
        className="no-style w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-bg)] text-[var(--color-text-muted)] text-left"
        style={{ borderRadius: 0, border: 'none', boxShadow: 'none', padding: '6px 10px' }}
      >
        <span className="flex-1 text-[var(--color-text-muted)]">
          {isStreaming ? 'Thinking...' : `Reasoning (${wordCount} words)`}
        </span>
        {!isStreaming &&
          (expanded ? (
            <ChevronDown size={11} className="flex-shrink-0" />
          ) : (
            <ChevronRight size={11} className="flex-shrink-0" />
          ))}
      </button>

      {/* Expanded content */}
      {expanded && !isStreaming && (
        <div
          className="px-3 py-2 border-t border-[var(--color-border)] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap overflow-y-auto"
          style={{ maxHeight: 320, fontSize: 11, background: 'var(--color-bg)' }}
        >
          {thinking}
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && (
        <div
          className="px-3 py-1.5 border-t border-[var(--color-border)] flex gap-1 items-center"
          style={{ background: 'var(--color-bg)' }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 4,
                height: 4,
                background: '#f59e0b',
                opacity: 0.6,
                animation: `thinkingBounce 1s ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

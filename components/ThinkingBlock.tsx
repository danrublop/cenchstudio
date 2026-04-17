'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

function ThinkingDotsInline() {
  const [frame, setFrame] = useState(0)
  const patterns = ['.', '..', '...', '..', '.', '']
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % patterns.length), 400)
    return () => clearInterval(id)
  }, [])
  return <span className="inline-block w-[1.2em] text-left">{patterns[frame]}</span>
}

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
}

export function ThinkingBlock({ thinking, isStreaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)

  const wordCount = thinking.trim().split(/\s+/).filter(Boolean).length

  // While streaming, use the same flat style as the default thinking indicator
  if (isStreaming) {
    return (
      <div>
        <span className="text-sm text-[var(--color-text-muted)]">
          Thinking
          <ThinkingDotsInline />
        </span>
      </div>
    )
  }

  return (
    <div>
      <span
        onClick={() => setExpanded((e) => !e)}
        className="text-sm text-[var(--color-text-muted)] cursor-pointer inline-flex items-center gap-1"
      >
        Reasoning ({wordCount} words)
        {expanded ? (
          <ChevronDown size={11} className="flex-shrink-0" />
        ) : (
          <ChevronRight size={11} className="flex-shrink-0" />
        )}
      </span>
      {expanded && (
        <div
          className="mt-1 text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap overflow-y-auto"
          style={{ maxHeight: 320 }}
        >
          {thinking}
        </div>
      )}
    </div>
  )
}

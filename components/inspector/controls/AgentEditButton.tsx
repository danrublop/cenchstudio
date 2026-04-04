'use client'

import { useVideoStore } from '@/lib/store'

interface AgentEditContext {
  type: 'element' | 'layer'
  elementId?: string
  elementType?: string
  layerId?: string
  sceneId?: string
  prompt?: string
  code?: string | null
  elementDefinition?: unknown
}

interface Props {
  label: string
  context: AgentEditContext
}

export function AgentEditButton({ label, context }: Props) {
  const { openAgentWithContext } = useVideoStore()

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => openAgentWithContext(context)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openAgentWithContext(context)
      }}
      className="w-full flex items-center gap-1.5 px-3 py-2 bg-[var(--color-input-bg,#1a1a1f)] border border-[var(--color-border,#2a2a32)] rounded-md text-[#9a9aa8] text-[11px] font-mono cursor-pointer transition-colors hover:border-[#e84545] hover:text-[var(--color-text-primary,#f0ece0)]"
    >
      <span className="text-[#e84545]">&#10022;</span>
      {label}
    </span>
  )
}

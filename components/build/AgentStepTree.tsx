'use client'

import { Circle, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { AgentStep } from '@/lib/build/types'

interface Props {
  steps: AgentStep[]
}

function StepIcon({ status }: { status: AgentStep['status'] }) {
  switch (status) {
    case 'pending':
      return <Circle size={14} className="text-[var(--color-text-muted)]" />
    case 'active':
      return <Loader2 size={14} className="text-blue-400 animate-spin" />
    case 'done':
      return <CheckCircle2 size={14} className="text-emerald-400" />
    case 'error':
      return <XCircle size={14} className="text-red-400" />
  }
}

export default function AgentStepTree({ steps }: Props) {
  return (
    <div className="relative pl-4 py-1">
      {/* Vertical connecting line */}
      <div className="absolute left-[10px] top-3 bottom-3 w-px bg-[var(--color-border)]" />
      <div className="flex flex-col gap-1.5">
        {steps.map((step) => (
          <div key={step.name} className="flex items-center gap-2 relative z-10">
            <div className="flex-shrink-0 bg-[var(--color-panel)]">
              <StepIcon status={step.status} />
            </div>
            <span
              className={`text-sm ${
                step.status === 'active' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              {step.name}
            </span>
            {step.detail && (
              <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[150px]">{step.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

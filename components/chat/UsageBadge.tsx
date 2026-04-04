import type { UsageStats } from '@/lib/agents/types'

export interface UsageBadgeProps {
  usage: UsageStats
}

export function UsageBadge({ usage }: UsageBadgeProps) {
  const formatCost = (cost: number) => {
    if (cost < 0.001) return `$${(cost * 1000).toFixed(2)}m`
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(3)}`
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] font-mono">
      <span title="Input tokens">{usage.inputTokens.toLocaleString()} in</span>
      <span className="opacity-40">/</span>
      <span title="Output tokens">{usage.outputTokens.toLocaleString()} out</span>
      <span className="opacity-40">|</span>
      <span title="Estimated cost" className="text-[var(--color-accent)]">
        {formatCost(usage.costUsd)}
      </span>
      {usage.apiCalls > 1 && (
        <>
          <span className="opacity-40">|</span>
          <span title="API calls">{usage.apiCalls} calls</span>
        </>
      )}
      <span className="opacity-40">|</span>
      <span title="Duration">{(usage.totalDurationMs / 1000).toFixed(1)}s</span>
    </div>
  )
}

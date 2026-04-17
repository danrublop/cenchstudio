import type { UsageStats } from '@/lib/agents/types'

export interface RunProgress {
  toolCallsUsed: number
  toolCallsMax: number
  costUsd: number
  costMax?: number
  iteration: number
  iterationMax?: number
}

export interface UsageBadgeProps {
  usage?: UsageStats
  progress?: RunProgress
  live?: boolean
}

export function UsageBadge({ usage, progress, live }: UsageBadgeProps) {
  const formatCost = (cost: number) => {
    if (cost < 0.001) return `<$0.001`
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(3)}`
  }

  const isCli = usage?.provider === 'claude-code' || usage?.provider === 'codex-cli'

  // Live mode: show real-time progress during streaming
  if (live && progress) {
    return (
      <div className="flex items-center gap-2 px-3 pt-0.5 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] font-mono">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"
          style={{ animation: 'cursorPulse 1.2s ease-in-out infinite' }}
        />
        <span title="Iteration">
          iter {progress.iteration}
          {progress.iterationMax ? `/${progress.iterationMax}` : ''}
        </span>
        <span className="opacity-40">|</span>
        <span title="Tool calls used">
          {progress.toolCallsUsed}
          {progress.toolCallsMax ? `/${progress.toolCallsMax}` : ''} tools
        </span>
        {progress.costMax > 0 && (
          <>
            <span className="opacity-40">|</span>
            <span title="Estimated cost" className="text-[var(--color-accent)]">
              {formatCost(progress.costUsd)}
            </span>
          </>
        )}
      </div>
    )
  }

  // Final mode: show completed usage stats
  if (!usage) return null

  return (
    <div className="flex items-center gap-2 px-3 pt-0.5 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] font-mono">
      <span title="Input tokens">{usage.inputTokens.toLocaleString()} in</span>
      <span className="opacity-40">/</span>
      <span title="Output tokens">{usage.outputTokens.toLocaleString()} out</span>
      <span className="opacity-40">|</span>
      {isCli ? (
        <span title="Claude Code subscription" className="text-[var(--color-accent)]">
          Plan
        </span>
      ) : (
        <span title="Estimated cost" className="text-[var(--color-accent)]">
          {formatCost(usage.costUsd)}
        </span>
      )}
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

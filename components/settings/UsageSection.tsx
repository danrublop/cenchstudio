'use client'

import { useEffect, useState } from 'react'

interface UsageSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  totalApiCalls: number
  totalToolCalls: number
  byAgent: Record<
    string,
    {
      inputTokens: number
      outputTokens: number
      costUsd: number
      count: number
    }
  >
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`
}

export default function UsageSection() {
  const [data, setData] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadUsage = async (): Promise<UsageSummary> => {
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.usage : undefined
      if (ipc?.getSummary) {
        return (await ipc.getSummary()) as unknown as UsageSummary
      }
      const res = await fetch('/api/usage')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as UsageSummary
    }
    loadUsage()
      .then((summary) => setData(summary))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-sm text-[var(--color-text-muted)] py-1">Loading usage data...</div>
  }

  if (error) {
    return <div className="text-sm text-red-400 py-1">Failed to load usage data.</div>
  }

  if (!data) {
    return <div className="text-sm text-[var(--color-text-muted)] py-1">No usage data yet.</div>
  }

  const totalTokens = data.totalInputTokens + data.totalOutputTokens
  const hasData = totalTokens > 0 || data.totalApiCalls > 0

  if (!hasData) {
    return <div className="text-sm text-[var(--color-text-muted)] py-1">No usage data yet.</div>
  }

  const agentEntries = Object.entries(data.byAgent)

  return (
    <div className="space-y-3">
      {/* Totals grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Total tokens</div>
          <div className="text-sm text-[var(--color-text-primary)] font-medium tabular-nums">
            {formatNumber(totalTokens)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Total cost</div>
          <div className="text-sm text-[var(--color-text-primary)] font-medium tabular-nums">
            {formatCost(data.totalCostUsd)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">API calls</div>
          <div className="text-sm text-[var(--color-text-primary)] font-medium tabular-nums">
            {formatNumber(data.totalApiCalls)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Tool calls</div>
          <div className="text-sm text-[var(--color-text-primary)] font-medium tabular-nums">
            {formatNumber(data.totalToolCalls)}
          </div>
        </div>
      </div>

      {/* Per-agent breakdown */}
      {agentEntries.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">By agent</div>
          <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-panel)' }}>
                  <th className="text-left px-2 py-1 font-normal text-[var(--color-text-muted)]">Agent</th>
                  <th className="text-right px-2 py-1 font-normal text-[var(--color-text-muted)]">Calls</th>
                  <th className="text-right px-2 py-1 font-normal text-[var(--color-text-muted)]">Tokens</th>
                  <th className="text-right px-2 py-1 font-normal text-[var(--color-text-muted)]">Cost</th>
                </tr>
              </thead>
              <tbody>
                {agentEntries.map(([agentType, stats], i) => (
                  <tr
                    key={agentType}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--color-border)' : undefined,
                    }}
                  >
                    <td className="px-2 py-1 text-[var(--color-text-primary)] capitalize">{agentType}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-[var(--color-text-muted)]">
                      {formatNumber(stats.count)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-[var(--color-text-muted)]">
                      {formatNumber(stats.inputTokens + stats.outputTokens)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-[var(--color-text-muted)]">
                      {formatCost(stats.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useVideoStore } from '@/lib/store'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[11px] uppercase tracking-widest text-[#6b6b7a] font-bold px-1 mb-2">{children}</h4>
}

export function ListContainer({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--color-border)] mb-3 pr-1">{children}</div>
}

export function KeyInputRow({
  provider,
  label,
  envVar: envVarOverride,
  extraAction,
}: {
  provider: string
  label: string
  envVar?: string
  extraAction?: React.ReactNode
}) {
  const { providerConfigs, updateProviderConfig } = useVideoStore()
  const cfg = providerConfigs.find((p) => p.provider === provider) ?? { provider, apiKey: '', baseUrl: '' }
  const [showKey, setShowKey] = useState(false)
  const isLocal = provider === 'local' || provider === 'openai-edge-tts'
  const envVar = envVarOverride ?? `${provider.toUpperCase()}_API_KEY`

  return (
    <div className="flex flex-col gap-1.5 mb-2 px-1">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[#6b6b7a] uppercase font-bold tracking-tight">{label}</label>
        <code className="text-[8px] text-[#6b6b7a]/60 font-mono">{envVar}</code>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type={isLocal || showKey ? 'text' : 'password'}
          value={isLocal ? (cfg.baseUrl ?? '') : cfg.apiKey}
          onChange={(e) =>
            updateProviderConfig(provider, isLocal ? { baseUrl: e.target.value } : { apiKey: e.target.value })
          }
          placeholder={isLocal ? 'http://localhost:5050' : envVar}
          className="flex-1 text-sm px-3 py-1.5 rounded border focus:outline-none bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] font-mono"
        />
        <div className="flex items-center gap-1.5">
          {!isLocal && (
            <button
              onClick={() => setShowKey((s) => !s)}
              className="no-style p-1 text-[#6b6b7a] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          {extraAction}
        </div>
      </div>
    </div>
  )
}

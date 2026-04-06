'use client'

import { useVideoStore } from '@/lib/store'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import type { APIName, PermissionMode, PermissionConfig } from '@/lib/types'
import { ShieldCheck, Key, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

const API_LIST: APIName[] = ['heygen', 'veo3', 'imageGen', 'backgroundRemoval', 'elevenLabs', 'unsplash']

const MODE_OPTIONS: { value: PermissionMode; label: string }[] = [
  { value: 'always_ask', label: 'Always ask' },
  { value: 'always_allow', label: 'Always allow' },
  { value: 'always_deny', label: 'Always deny' },
  { value: 'ask_once', label: 'Ask once per session' },
]

function ProviderKeyInput({ provider }: { provider: 'anthropic' | 'openai' | 'local' }) {
  const { providerConfigs, updateProviderConfig } = useVideoStore()
  const cfg = providerConfigs.find((p) => p.provider === provider) ?? { provider, apiKey: '', baseUrl: '' }
  const [showKey, setShowKey] = useState(false)

  const label = provider === 'anthropic' ? 'Anthropic API Key' : provider === 'openai' ? 'OpenAI API Key' : 'Local / Ollama Endpoint'
  const isLocal = provider === 'local'

  return (
    <div className="p-3 rounded-lg border mb-2" style={{ backgroundColor: 'var(--color-input-bg, #161622)', borderColor: 'var(--color-border, #2a2a3a)' }}>
      <label className="block text-[10px] text-[#6b6b7a] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          type={isLocal || showKey ? 'text' : 'password'}
          value={isLocal ? (cfg.baseUrl ?? 'http://localhost:11434') : cfg.apiKey}
          onChange={(e) => updateProviderConfig(provider, isLocal ? { baseUrl: e.target.value } : { apiKey: e.target.value })}
          placeholder={isLocal ? "http://localhost:11434" : `${label}`}
          className="flex-1 text-sm px-2 py-1.5 rounded border focus:outline-none"
          style={{ backgroundColor: 'var(--color-panel-bg, #1e1e2e)', borderColor: 'var(--color-border, #2a2a3a)', color: 'var(--color-text-primary, #e0e0e0)' }}
        />
        {!isLocal && (
          <button
            onClick={() => setShowKey((s) => !s)}
            className="p-1.5 border rounded hover:opacity-80 transition-colors text-[#6b6b7a]"
            style={{ borderColor: 'var(--color-border, #2a2a3a)' }}
          >
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
      {!isLocal && !cfg.apiKey && (
        <p className="flex items-center gap-1 mt-1.5 text-[11px] text-yellow-500/80">
          <AlertCircle size={10} /> Key stored locally
        </p>
      )}
    </div>
  )
}

export default function APIPermissionsSettings() {
  const { project, updateAPIPermissions } = useVideoStore()
  const permissions = project.apiPermissions ?? ({} as Record<string, any>)
  const [spendData, setSpendData] = useState<Record<string, { sessionSpend: number; monthlySpend: number }>>({})

  // Fetch spend data on mount
  useEffect(() => {
    fetch('/api/permissions')
      .then((r) => r.json())
      .then(setSpendData)
      .catch(() => {})
  }, [])

  const updateConfig = (api: APIName, updates: Partial<PermissionConfig>) => {
    const current = permissions[api]
    updateAPIPermissions({
      [api]: { ...current, ...updates },
    } as any)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Key size={16} className="text-blue-400" />
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary, #6b6b7a)' }}>
          LLM Providers
        </span>
      </div>
      
      <ProviderKeyInput provider="anthropic" />
      <ProviderKeyInput provider="openai" />
      <ProviderKeyInput provider="local" />

      <div className="flex items-center gap-2 mb-2 mt-6">
        <ShieldCheck size={16} className="text-amber-400" />
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary, #6b6b7a)' }}>
          External API Permissions
        </span>
      </div>

      {API_LIST.map((api) => {
        const config = permissions[api] ?? { mode: 'always_ask' as PermissionMode, spendLimitSession: null, spendLimitMonthly: null }
        const spend = spendData[api]

        return (
          <div
            key={api}
            className="p-3 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-input-bg, #161622)',
              borderColor: 'var(--color-border, #2a2a3a)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{API_DISPLAY_NAMES[api]}</span>
              <div
                className={`text-[11px] px-1.5 py-0.5 rounded ${
                  config.mode === 'always_allow'
                    ? 'bg-green-500/20 text-green-400'
                    : config.mode === 'always_deny'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {MODE_OPTIONS.find((m) => m.value === config.mode)?.label}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Mode select */}
              <div>
                <label className="text-[10px] text-[#6b6b7a] uppercase tracking-wider block mb-1">Mode</label>
                <select
                  value={config.mode}
                  onChange={(e) => updateConfig(api, { mode: e.target.value as PermissionMode })}
                  className="w-full text-sm px-2 py-1.5 rounded border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--color-panel-bg, #1e1e2e)',
                    borderColor: 'var(--color-border, #2a2a3a)',
                    color: 'var(--color-text-primary, #e0e0e0)',
                  }}
                >
                  {MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monthly limit */}
              <div>
                <label className="text-[10px] text-[#6b6b7a] uppercase tracking-wider block mb-1">Monthly limit</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#6b6b7a]">$</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="∞"
                    value={config.monthlyLimit ?? ''}
                    onChange={(e) =>
                      updateConfig(api, {
                        monthlyLimit: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="w-full text-sm pl-5 pr-2 py-1.5 rounded border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-panel-bg, #1e1e2e)',
                      borderColor: 'var(--color-border, #2a2a3a)',
                      color: 'var(--color-text-primary, #e0e0e0)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Spend tracking */}
            <div className="flex gap-4 mt-2 text-[11px] text-[#6b6b7a]">
              <span>This session: ${(spend?.sessionSpend ?? config.sessionSpend ?? 0).toFixed(2)}</span>
              <span>This month: ${(spend?.monthlySpend ?? config.monthlySpend ?? 0).toFixed(2)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

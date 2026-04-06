'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, Loader2, Wifi, WifiOff } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { ModelConfig, ModelProvider, ModelTierName } from '@/lib/agents/model-config'

// ── Tier badge ─────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<ModelTierName, string> = {
  budget: 'text-green-400 bg-green-400/10 border-green-400/30',
  balanced: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  performance: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  custom: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
}

function TierBadge({ tier }: { tier: ModelTierName }) {
  return <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${TIER_COLORS[tier]}`}>{tier}</span>
}

// ── Model row ──────────────────────────────────────────────────────────────────

function ModelRow({ model, onToggle }: { model: ModelConfig; onToggle: () => void }) {
  const { removeCustomModel } = useVideoStore()

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-border)] first:border-0 hover:bg-[var(--color-bg)]/40 transition-colors">
      <button onClick={onToggle} className="flex-shrink-0" title={model.enabled ? 'Disable model' : 'Enable model'}>
        {model.enabled ? (
          <div className="w-4 h-4 rounded bg-[var(--color-accent)] flex items-center justify-center">
            <Check size={10} className="text-white" />
          </div>
        ) : (
          <div className="w-4 h-4 rounded border border-[var(--color-border)]" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-primary)] font-medium">{model.displayName}</span>
          <TierBadge tier={model.tier} />
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">{model.modelId}</p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-[11px] text-[var(--color-text-muted)]">
          ${model.costPer1MInput}
          <span className="opacity-50"> / </span>${model.costPer1MOutput}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]/60">per 1M in/out</p>
      </div>

      {!model.isDefault && (
        <button
          onClick={() => removeCustomModel(model.id)}
          className="p-1 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
          title="Remove custom model"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

// ── Add custom model form ──────────────────────────────────────────────────────

function AddCustomModelForm({ onClose }: { onClose: () => void }) {
  const { addCustomModel } = useVideoStore()
  const [form, setForm] = useState<Partial<ModelConfig>>({
    provider: 'anthropic',
    tier: 'custom',
    enabled: true,
    isDefault: false,
    supportsTools: true,
    supportsStreaming: true,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    maxTokens: 128000,
  })

  const handleSubmit = () => {
    if (!form.id || !form.modelId || !form.displayName) return
    addCustomModel(form as ModelConfig)
    onClose()
  }

  const field = (label: string, key: keyof ModelConfig, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm text-[var(--color-text-muted)] mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ''}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
          }))
        }
        placeholder={placeholder}
        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  )

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-panel)] space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Add Custom Model</h3>

      <div className="grid grid-cols-2 gap-3">
        {field('ID (unique)', 'id', 'text', 'my-custom-model')}
        {field('Display Name', 'displayName', 'text', 'My Model')}
        {field('API Model ID', 'modelId', 'text', 'model-id-from-provider')}

        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">Provider</label>
          <select
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as ModelProvider }))}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google</option>
            <option value="local">Local / Ollama</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">Tier</label>
          <select
            value={form.tier}
            onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as ModelTierName }))}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            <option value="budget">Budget</option>
            <option value="balanced">Balanced</option>
            <option value="performance">Performance</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {field('Cost / 1M input ($)', 'costPer1MInput', 'number', '0.00')}
        {field('Cost / 1M output ($)', 'costPer1MOutput', 'number', '0.00')}
        {field('Max Tokens', 'maxTokens', 'number', '128000')}
      </div>

      {form.provider === 'local' && (
        <div className="grid grid-cols-2 gap-3">
          {field('Endpoint', 'endpoint', 'text', 'http://localhost:11434')}
          {field('Local Model Name', 'localModelName', 'text', 'llama3.1:8b')}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!form.id || !form.modelId || !form.displayName}
          className="flex-1 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Add Model
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-border)]/30 transition-colors text-[var(--color-text-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export default function ModelsSettingsTab() {
  const { modelConfigs, toggleModelEnabled, providerConfigs, localMode, setLocalMode, localModelId, setLocalModelId, addCustomModel } = useVideoStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [detectingModels, setDetectingModels] = useState(false)
  const [detectedModels, setDetectedModels] = useState<string[]>([])
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')

  const localModels = modelConfigs.filter((m) => m.provider === 'local')

  // Auto-detect Ollama status when local mode is toggled on
  useEffect(() => {
    if (!localMode) return
    const localCfg = providerConfigs.find((p) => p.provider === 'local')
    const endpoint = localCfg?.baseUrl ?? 'http://localhost:11434'
    fetch(`${endpoint}/api/tags`)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        setOllamaStatus('online')
        const names: string[] = (data.models ?? []).map((m: { name: string }) => m.name)
        // Auto-add discovered models that aren't already in config
        for (const name of names) {
          const exists = modelConfigs.some((m) => m.localModelName === name || m.modelId === name)
          if (!exists) {
            addCustomModel({
              id: `ollama-${name.replace(/[:.]/g, '-')}`,
              provider: 'local',
              modelId: name,
              displayName: name,
              tier: 'custom',
              enabled: true,
              isDefault: false,
              costPer1MInput: 0,
              costPer1MOutput: 0,
              maxTokens: 32768,
              supportsTools: true,
              supportsStreaming: true,
              endpoint,
              localModelName: name,
            })
          }
        }
        // Auto-select first local model if none selected
        if (!localModelId && names.length > 0) {
          const firstLocal = modelConfigs.find((m) => m.provider === 'local') ??
            { id: `ollama-${names[0].replace(/[:.]/g, '-')}` }
          setLocalModelId(firstLocal.id)
        }
      })
      .catch(() => setOllamaStatus('offline'))
  }, [localMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDetectOllama = async () => {
    setDetectingModels(true)
    try {
      const localCfg = providerConfigs.find((p) => p.provider === 'local')
      const endpoint = localCfg?.baseUrl ?? 'http://localhost:11434'
      const res = await fetch(`${endpoint}/api/tags`)
      if (!res.ok) throw new Error('Ollama not reachable')
      const data = await res.json()
      const names: string[] = (data.models ?? []).map((m: { name: string }) => m.name)
      setDetectedModels(names)
      setOllamaStatus('online')
    } catch {
      setDetectedModels([])
      setOllamaStatus('offline')
    } finally {
      setDetectingModels(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Local Mode Toggle ─────────────────────────────────────────── */}
      <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-panel)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${localMode ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-[var(--color-text-muted)]/30'}`} />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Local Mode</h3>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Use Ollama for all generation — free, no API keys needed
              </p>
            </div>
          </div>
          <span
            role="switch"
            aria-checked={localMode}
            tabIndex={0}
            onClick={() => setLocalMode(!localMode)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLocalMode(!localMode) } }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${localMode ? 'bg-green-500' : 'bg-[var(--color-border)]'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${localMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </span>
        </div>

        {localMode && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-[11px]">
              {ollamaStatus === 'online' ? (
                <><Wifi size={12} className="text-green-400" /><span className="text-green-400">Ollama connected</span></>
              ) : ollamaStatus === 'offline' ? (
                <><WifiOff size={12} className="text-red-400" /><span className="text-red-400">Ollama not reachable — run `ollama serve`</span></>
              ) : (
                <><Loader2 size={12} className="animate-spin text-[var(--color-text-muted)]" /><span className="text-[var(--color-text-muted)]">Checking...</span></>
              )}
            </div>

            {localModels.length > 0 && (
              <div>
                <label className="text-[11px] text-[var(--color-text-muted)] mb-1 block">Model</label>
                <select
                  value={localModelId ?? ''}
                  onChange={(e) => setLocalModelId(e.target.value || null)}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-green-500"
                >
                  <option value="">Select a model...</option>
                  {localModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName} ({m.localModelName ?? m.modelId})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-[10px] text-[var(--color-text-muted)]/60 space-y-0.5">
              <p>All generation routes through Ollama. TTS uses free providers (Edge TTS / native / browser).</p>
              <p>Cost: $0.00 — everything runs locally.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Models</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Enable or disable individual models</p>
        </div>
      </div>

      <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-panel)] divide-y divide-[var(--color-border)] max-h-[400px] overflow-y-auto">
        {modelConfigs.map((model) => (
          <ModelRow key={model.id} model={model} onToggle={() => toggleModelEnabled(model.id)} />
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-border)]/30 transition-colors text-[var(--color-text-primary)] flex font-medium"
        >
          <Plus size={14} />
          Add Custom Model
        </button>
        <button
          onClick={handleDetectOllama}
          disabled={detectingModels}
          className="flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-border)]/30 transition-colors text-[var(--color-text-primary)] flex font-medium disabled:opacity-50"
        >
          {detectingModels ? <Loader2 size={12} className="animate-spin" /> : null}
          Detect Ollama Models
        </button>
      </div>

      {detectedModels.length > 0 && (
        <div className="mt-3 p-3 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg">
          <p className="text-sm text-[var(--color-text-muted)] mb-1.5">Detected ({detectedModels.length})</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {detectedModels.map((name) => (
              <label
                key={name}
                className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer hover:bg-[var(--color-bg)]/40 p-1 rounded"
              >
                <input type="checkbox" className="rounded accent-[var(--color-accent)]" />
                <span className="font-mono">{name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="pt-2">
          <AddCustomModelForm onClose={() => setShowAddForm(false)} />
        </div>
      )}
    </div>
  )
}

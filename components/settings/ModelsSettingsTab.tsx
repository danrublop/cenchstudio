'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, Loader2 } from 'lucide-react'
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
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TIER_COLORS[tier]}`}>{tier}</span>
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
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">{model.modelId}</p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-[10px] text-[var(--color-text-muted)]">
          ${model.costPer1MInput}
          <span className="opacity-50"> / </span>${model.costPer1MOutput}
        </p>
        <p className="text-[9px] text-[var(--color-text-muted)]/60">per 1M in/out</p>
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
      <label className="block text-xs text-[var(--color-text-muted)] mb-1">{label}</label>
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
        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
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
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Provider</label>
          <select
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as ModelProvider }))}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google</option>
            <option value="local">Local / Ollama</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Tier</label>
          <select
            value={form.tier}
            onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as ModelTierName }))}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
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
          className="flex-1 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Add Model
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-border)]/30 transition-colors text-[var(--color-text-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export default function ModelsSettingsTab() {
  const { modelConfigs, toggleModelEnabled, providerConfigs } = useVideoStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [detectingModels, setDetectingModels] = useState(false)
  const [detectedModels, setDetectedModels] = useState<string[]>([])

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
    } catch {
      setDetectedModels([])
    } finally {
      setDetectingModels(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Models</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Enable or disable individual models</p>
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
          className="flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-border)]/30 transition-colors text-[var(--color-text-primary)] flex font-medium"
        >
          <Plus size={14} />
          Add Custom Model
        </button>
        <button
          onClick={handleDetectOllama}
          disabled={detectingModels}
          className="flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-border)]/30 transition-colors text-[var(--color-text-primary)] flex font-medium disabled:opacity-50"
        >
          {detectingModels ? <Loader2 size={12} className="animate-spin" /> : null}
          Detect Ollama Models
        </button>
      </div>

      {detectedModels.length > 0 && (
        <div className="mt-3 p-3 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg">
          <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Detected ({detectedModels.length})</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {detectedModels.map((name) => (
              <label
                key={name}
                className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer hover:bg-[var(--color-bg)]/40 p-1 rounded"
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

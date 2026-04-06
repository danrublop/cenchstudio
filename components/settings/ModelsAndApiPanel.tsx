'use client'

import { useState, useEffect } from 'react'
import { ToggleLeft, ToggleRight, Loader2, X, Eye, EyeOff, Search, Plus } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { ModelProvider, ModelTierName } from '@/lib/agents/model-config'
import { DEFAULT_MODELS } from '@/lib/agents/model-config'

// ── Shared Subcomponents ─────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: ModelTierName }) {
  const colors: Record<ModelTierName, string> = {
    budget: 'text-green-400 bg-green-400/10 border-green-400/30',
    balanced: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    performance: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    custom: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors[tier]} uppercase tracking-tighter`}>
      {tier}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[11px] uppercase tracking-widest text-[#6b6b7a] font-bold px-1 mb-2">{children}</h4>
}

function ListContainer({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--color-border)] mb-3 pr-1">{children}</div>
}

const ENV_VAR_NAMES: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_AI_KEY',
  openai: 'OPENAI_API_KEY',
  fal: 'FAL_KEY',
  heygen: 'HEYGEN_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
  local: 'OLLAMA_ENDPOINT',
}

function KeyInputRow({
  provider,
  label,
  extraAction,
}: {
  provider: string
  label: string
  extraAction?: React.ReactNode
}) {
  const { providerConfigs, updateProviderConfig } = useVideoStore()
  const cfg = providerConfigs.find((p) => p.provider === provider) ?? { provider, apiKey: '', baseUrl: '' }
  const [showKey, setShowKey] = useState(false)
  const isLocal = provider === 'local'
  const envVar = ENV_VAR_NAMES[provider] ?? `${provider.toUpperCase()}_API_KEY`

  return (
    <div className="flex flex-col gap-1.5 mb-2 px-1">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[#6b6b7a] uppercase font-bold tracking-tight">{label}</label>
        <code className="text-[8px] text-[#6b6b7a]/60 font-mono">{envVar}</code>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type={isLocal || showKey ? 'text' : 'password'}
          value={isLocal ? (cfg.baseUrl ?? 'http://localhost:11434') : cfg.apiKey}
          onChange={(e) =>
            updateProviderConfig(provider, isLocal ? { baseUrl: e.target.value } : { apiKey: e.target.value })
          }
          placeholder={isLocal ? 'http://localhost:11434' : `${envVar}`}
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

// ── Main Component ───────────────────────────────────────────────────────────

export default function ModelsAndApiPanel() {
  const { modelConfigs, toggleModelEnabled, providerConfigs, removeCustomModel, addCustomModel } = useVideoStore()
  // Sync default models on mount: ensures DEFAULT_MODELS are always current,
  // removes stale defaults, preserves user's enabled/disabled prefs and custom models.
  useEffect(() => {
    const defaultIds = new Set(DEFAULT_MODELS.map((m) => m.id))
    const enabledMap = new Map(modelConfigs.map((m) => [m.id, m.enabled]))
    // Custom models = anything NOT in current defaults AND NOT a known old default
    // (old defaults added via addCustomModel have isDefault:false but known provider+id patterns)
    const customModels = modelConfigs.filter(
      (m) =>
        !defaultIds.has(m.id) &&
        !m.id.startsWith('gemini-') &&
        !m.id.startsWith('claude-') &&
        !m.id.startsWith('gpt-') &&
        m.id !== 'o1' &&
        !m.id.startsWith('ollama-'),
    )
    const merged = [
      ...DEFAULT_MODELS.map((m) => ({ ...m, enabled: enabledMap.has(m.id) ? enabledMap.get(m.id)! : m.enabled })),
      ...customModels,
    ]
    const currentIds = modelConfigs.map((m) => m.id).join(',')
    const mergedIds = merged.map((m) => m.id).join(',')
    if (currentIds !== mergedIds) {
      useVideoStore.setState({ modelConfigs: merged })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [detectingModels, setDetectingModels] = useState(false)
  const [detectedOllamaModels, setDetectedOllamaModels] = useState<string[]>([])
  const [showAddModel, setShowAddModel] = useState(false)
  const [newModel, setNewModel] = useState({
    provider: 'anthropic' as ModelProvider,
    modelId: '',
    displayName: '',
    tier: 'custom' as ModelTierName,
  })

  const handleDetectOllama = async () => {
    if (detectingModels) return
    setDetectingModels(true)
    try {
      const endpoint = providerConfigs.find((p) => p.provider === 'local')?.baseUrl ?? 'http://localhost:11434'
      const res = await fetch(`${endpoint}/api/tags`).catch(() => null)
      if (!res || !res.ok) {
        setDetectedOllamaModels([])
        return
      }
      const data = await res.json()
      const models: any[] = data.models ?? []
      setDetectedOllamaModels(models.map((m) => m.name))
    } catch (e) {
      console.error(e)
    } finally {
      setDetectingModels(false)
    }
  }

  const handleAddLocalModel = (name: string) => {
    const id = `local-${name.replace(':', '-')}`
    const endpoint = providerConfigs.find((p) => p.provider === 'local')?.baseUrl ?? 'http://localhost:11434'
    if (!modelConfigs.find((cfg) => cfg.id === id || cfg.modelId === name)) {
      addCustomModel({
        id,
        provider: 'local',
        modelId: name,
        displayName: name.split(':')[0],
        tier: 'custom',
        enabled: true,
        isDefault: false,
        costPer1MInput: 0,
        costPer1MOutput: 0,
        maxTokens: 8192,
        supportsTools: true,
        supportsStreaming: true,
        endpoint,
        localModelName: name,
      })
    }
    setDetectedOllamaModels((prev) => prev.filter((m) => m !== name))
  }

  return (
    <div className="space-y-10">
      {/* 1. INFERENCE MODELS */}
      <div>
        <SectionLabel>Inference Models</SectionLabel>
        <ListContainer>
          {modelConfigs
            .filter((m) => m.provider !== 'local')
            .map((model) => (
              <div key={model.id} className="flex items-center justify-between gap-3 py-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                    {model.displayName}
                  </span>
                  <TierBadge tier={model.tier} />
                </div>
                <button
                  onClick={() => toggleModelEnabled(model.id)}
                  className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all"
                >
                  {model.enabled ? (
                    <ToggleRight size={22} className="text-[var(--color-accent)]" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                </button>
              </div>
            ))}
        </ListContainer>
      </div>

      {/* 2. API KEYS */}
      <div>
        <SectionLabel>API Keys</SectionLabel>
        <p className="text-[11px] text-[#6b6b7a] px-1 mb-2 -mt-1">
          Set in{' '}
          <code className="text-[10px] px-1 py-0.5 rounded bg-white/5 border border-[var(--color-border)]">.env</code> —
          shown here for reference.
        </p>
        <div className="grid grid-cols-1 gap-1">
          <KeyInputRow provider="anthropic" label="Anthropic" />
          <KeyInputRow provider="google" label="Google AI" />
          <KeyInputRow provider="openai" label="OpenAI" />
        </div>
      </div>

      {/* 3. LOCAL MODELS (OLLAMA) */}
      <div>
        <SectionLabel>Local Models</SectionLabel>
        <ListContainer>
          {modelConfigs
            .filter((m) => m.provider === 'local')
            .map((model) => (
              <div key={model.id} className="flex items-center justify-between gap-3 py-2 px-1">
                <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                  {model.displayName}
                </span>
                <div className="flex items-center gap-3">
                  {!model.isDefault && (
                    <button
                      onClick={() => removeCustomModel(model.id)}
                      className="no-style p-1 text-[#6b6b7a] hover:text-red-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleModelEnabled(model.id)}
                    className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all"
                  >
                    {model.enabled ? (
                      <ToggleRight size={22} className="text-[var(--color-accent)]" />
                    ) : (
                      <ToggleLeft size={22} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          {modelConfigs.filter((m) => m.provider === 'local').length === 0 && (
            <div className="py-6 text-center text-[12px] text-[#6b6b7a] italic">No local models configured.</div>
          )}
        </ListContainer>

        <div className="space-y-4 px-1">
          <KeyInputRow
            provider="local"
            label="Ollama Endpoint"
            extraAction={
              <button
                onClick={handleDetectOllama}
                disabled={detectingModels}
                className="no-style p-1 text-[var(--color-accent)] hover:opacity-80 transition-all disabled:opacity-40"
              >
                {detectingModels ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            }
          />

          {detectedOllamaModels.length > 0 && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-1 duration-200">
              <h5 className="text-[10px] uppercase tracking-wider text-[#6b6b7a] font-bold mb-3 px-1">
                Discovered on System
              </h5>
              <ListContainer>
                {detectedOllamaModels.map((name) => {
                  const alreadySaved = modelConfigs.some((m) => m.modelId === name && m.provider === 'local')
                  if (alreadySaved) return null
                  return (
                    <div key={name} className="flex items-center justify-between px-1 py-2">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-none">
                        {name.split(':')[0]}
                      </span>
                      <button
                        onClick={() => handleAddLocalModel(name)}
                        className="no-style text-[var(--color-accent)] hover:opacity-80 transition-all"
                      >
                        <Plus size={22} />
                      </button>
                    </div>
                  )
                })}
              </ListContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

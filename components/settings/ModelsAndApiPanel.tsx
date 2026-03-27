'use client'

import { useState, useEffect } from 'react'
import {
  ToggleLeft, ToggleRight, Loader2, X, Eye, EyeOff, Search, Plus
} from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import type { APIName, PermissionMode } from '@/lib/types'
import type { ModelConfig, ModelProvider, ModelTierName } from '@/lib/agents/model-config'

// ── Shared Subcomponents ─────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: ModelTierName }) {
  const colors: Record<ModelTierName, string> = {
    budget: 'text-green-400 bg-green-400/10 border-green-400/30',
    balanced: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    performance: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    custom: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  }
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${colors[tier]} uppercase tracking-tighter`}>
      {tier}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] uppercase tracking-widest text-[#6b6b7a] font-bold px-1 mb-2">
      {children}
    </h4>
  )
}

function ListContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[var(--color-border)] mb-3 pr-1">
      {children}
    </div>
  )
}

function KeyInputRow({ 
  provider, label, extraAction 
}: { 
  provider: string; 
  label: string; 
  extraAction?: React.ReactNode 
}) {
  const { providerConfigs, updateProviderConfig } = useVideoStore()
  const cfg = providerConfigs.find((p) => p.provider === provider) ?? { provider, apiKey: '', baseUrl: '' }
  const [showKey, setShowKey] = useState(false)
  const isLocal = provider === 'local'

  return (
    <div className="flex flex-col gap-1.5 mb-2 px-1">
      <label className="text-[9px] text-[#6b6b7a] uppercase font-bold tracking-tight">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type={isLocal || showKey ? 'text' : 'password'}
          value={isLocal ? (cfg.baseUrl ?? 'http://localhost:11434') : cfg.apiKey}
          onChange={(e) => updateProviderConfig(provider, isLocal ? { baseUrl: e.target.value } : { apiKey: e.target.value })}
          placeholder={isLocal ? "http://localhost:11434" : `${label} Key`}
          className="flex-1 text-xs px-3 py-1.5 rounded border focus:outline-none bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] font-mono"
        />
        <div className="flex items-center gap-1.5">
          {!isLocal && (
            <button onClick={() => setShowKey((s) => !s)} className="no-style p-1 text-[#6b6b7a] hover:text-[var(--color-text-primary)] transition-colors">
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
  const { 
    modelConfigs, toggleModelEnabled, providerConfigs, 
    project, updateAPIPermissions, removeCustomModel, addCustomModel
  } = useVideoStore()
  const [detectingModels, setDetectingModels] = useState(false)
  const [detectedOllamaModels, setDetectedOllamaModels] = useState<string[]>([])
  
  const permissions = project.apiPermissions ?? {}
  const externalApis: APIName[] = ['heygen', 'veo3', 'imageGen', 'backgroundRemoval', 'elevenLabs', 'unsplash']

  const handleToggleApi = (api: APIName) => {
    const current = permissions[api]
    const nextMode: PermissionMode = (current?.mode === 'always_deny') ? 'always_ask' : 'always_deny'
    updateAPIPermissions({ [api]: { ...(current ?? {}), mode: nextMode } } as any)
  }

  const handleDetectOllama = async () => {
    if (detectingModels) return
    setDetectingModels(true)
    try {
      const endpoint = providerConfigs.find(p => p.provider === 'local')?.baseUrl ?? 'http://localhost:11434'
      const res = await fetch(`${endpoint}/api/tags`).catch(() => null)
      if (!res || !res.ok) { setDetectedOllamaModels([]); return }
      const data = await res.json()
      const models: any[] = data.models ?? []
      setDetectedOllamaModels(models.map(m => m.name))
    } catch (e) { console.error(e) } finally { setDetectingModels(false) }
  }

  const handleAddLocalModel = (name: string) => {
    const id = `local-${name.replace(':', '-')}`
    const endpoint = providerConfigs.find(p => p.provider === 'local')?.baseUrl ?? 'http://localhost:11434'
    if (!modelConfigs.find(cfg => cfg.id === id || cfg.modelId === name)) {
      addCustomModel({
        id, provider: 'local', modelId: name, displayName: name.split(':')[0],
        tier: 'custom', enabled: true, isDefault: false, costPer1MInput: 0, costPer1MOutput: 0,
        maxTokens: 8192, supportsTools: true, supportsStreaming: true, endpoint, localModelName: name
      })
    }
    setDetectedOllamaModels(prev => prev.filter(m => m !== name))
  }

  return (
    <div className="space-y-10">
      
      {/* 1. AI MODULES */}
      <div>
        <SectionLabel>AI Modules</SectionLabel>
        <ListContainer>
          {externalApis.map((api) => {
            const isEnabled = permissions[api]?.mode !== 'always_deny'
            return (
              <div key={api} className="flex items-center justify-between gap-3 py-2 px-1">
                <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                  {API_DISPLAY_NAMES[api]}
                </span>
                <button onClick={() => handleToggleApi(api)} className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all">
                  {isEnabled ? <ToggleRight size={22} className="text-[var(--color-accent)]" /> : <ToggleLeft size={22} />}
                </button>
              </div>
            )
          })}
        </ListContainer>
        <div className="grid grid-cols-1 gap-1">
          <KeyInputRow provider="heygen" label="HeyGen API Key" />
          <KeyInputRow provider="elevenlabs" label="ElevenLabs API Key" />
          <KeyInputRow provider="veo3" label="Veo 3 API Key" />
        </div>
      </div>

      {/* 2. INFERENCE MODELS */}
      <div>
        <SectionLabel>Inference Models</SectionLabel>
        <ListContainer>
          {modelConfigs.filter(m => m.provider !== 'local').map((model) => (
            <div key={model.id} className="flex items-center justify-between gap-3 py-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">{model.displayName}</span>
                <TierBadge tier={model.tier} />
              </div>
              <div className="flex items-center gap-3">
                {!model.isDefault && (
                  <button onClick={() => removeCustomModel(model.id)} className="no-style p-1 text-[#6b6b7a] hover:text-red-400 transition-colors"><X size={13} /></button>
                )}
                <button onClick={() => toggleModelEnabled(model.id)} className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all">
                  {model.enabled ? <ToggleRight size={22} className="text-[var(--color-accent)]" /> : <ToggleLeft size={22} />}
                </button>
              </div>
            </div>
          ))}
        </ListContainer>
        <div className="grid grid-cols-1 gap-1">
          <KeyInputRow provider="anthropic" label="Anthropic API Key" />
          <KeyInputRow provider="openai" label="OpenAI API Key" />
        </div>
      </div>

      {/* 3. LOCAL MODELS (OLLAMA) */}
      <div>
        <SectionLabel>Local Models</SectionLabel>
        <ListContainer>
          {modelConfigs.filter(m => m.provider === 'local').map((model) => (
            <div key={model.id} className="flex items-center justify-between gap-3 py-2 px-1">
              <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">{model.displayName}</span>
              <div className="flex items-center gap-3">
                {!model.isDefault && (
                  <button onClick={() => removeCustomModel(model.id)} className="no-style p-1 text-[#6b6b7a] hover:text-red-400 transition-colors"><X size={13} /></button>
                )}
                <button onClick={() => toggleModelEnabled(model.id)} className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all">
                  {model.enabled ? <ToggleRight size={22} className="text-[var(--color-accent)]" /> : <ToggleLeft size={22} />}
                </button>
              </div>
            </div>
          ))}
          {modelConfigs.filter(m => m.provider === 'local').length === 0 && (
            <div className="py-6 text-center text-[11px] text-[#6b6b7a] italic">No local models configured.</div>
          )}
        </ListContainer>
        
        <div className="space-y-4 px-1">
          <KeyInputRow 
            provider="local" 
            label="Ollama Endpoint" 
            extraAction={(
              <button 
                onClick={handleDetectOllama} 
                disabled={detectingModels} 
                className="no-style p-1 text-[var(--color-accent)] hover:opacity-80 transition-all disabled:opacity-40"
              >
                {detectingModels ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            )}
          />

          {detectedOllamaModels.length > 0 && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-1 duration-200">
              <h5 className="text-[9px] uppercase tracking-wider text-[#6b6b7a] font-bold mb-3 px-1">Discovered on System</h5>
              <ListContainer>
                {detectedOllamaModels.map(name => {
                  const alreadySaved = modelConfigs.some(m => m.modelId === name && m.provider === 'local')
                  if (alreadySaved) return null
                  return (
                    <div key={name} className="flex items-center justify-between px-1 py-2">
                       <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-none">
                        {name.split(':')[0]}
                       </span>
                       <button onClick={() => handleAddLocalModel(name)} className="no-style text-[var(--color-accent)] hover:opacity-80 transition-all">
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

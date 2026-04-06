'use client'

import { useState } from 'react'
import { useVideoStore } from '@/lib/store'
import type { AgentType, ModelId, ModelTier, ThinkingMode } from '@/lib/agents/types'
import { AGENT_COLORS, AGENT_LABELS } from '@/lib/agents/prompts'
import { TOOL_FILTER_CHIPS, TOOL_PRESETS } from '@/lib/agent-tools'
import { AUDIO_PROVIDERS } from '@/lib/audio/provider-registry'
import { MEDIA_PROVIDERS } from '@/lib/media/provider-registry'

// ── Constants ──────────────────────────────────────────────────────────────────

const AGENT_PILLS: { id: AgentType | null; label: string; desc: string }[] = [
  { id: null, label: 'Auto', desc: 'Router picks the best agent for your request' },
  { id: 'director', label: 'Director', desc: 'Plans multi-scene videos, narrative arc' },
  { id: 'scene-maker', label: 'Scene Maker', desc: 'Generates content for individual scenes' },
  { id: 'editor', label: 'Editor', desc: 'Surgical edits to existing elements' },
  { id: 'dop', label: 'DoP', desc: 'Global style, palette, transitions' },
]

const MODEL_TIER_OPTIONS: { id: ModelTier; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto', desc: 'Balanced — good for most things' },
  { id: 'premium', label: 'Premium', desc: 'Most capable models' },
  { id: 'budget', label: 'Budget', desc: 'Cheapest models' },
]

// Model override options are built dynamically from enabled models in store

const SCENE_CONTEXT_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto', desc: 'Director sees all scenes, Editor sees selected scene' },
  { id: 'selected', label: 'Selected scene', desc: 'Agent gets full detail of the selected scene only' },
  { id: 'all', label: 'All scenes', desc: 'Agent sees summaries of every scene' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function AgentControlPanel() {
  const {
    agentOverride,
    setAgentOverride,
    modelOverride,
    setModelOverride,
    modelTier,
    setModelTier,
    thinkingMode,
    setThinkingMode,
    sceneContext,
    setSceneContext,
    activeTools,
    setActiveTools,
    toggleActiveTool,
    scenes,
    selectedSceneId,
    modelConfigs,
    audioProviderEnabled,
    mediaGenEnabled,
    audioSettings,
    updateAudioSettings,
    setSettingsTab,
  } = useVideoStore()

  // Build model override options from enabled models.
  // Use modelId (the full API model string) as the value, displayName as the label.
  const modelOverrideOptions: { id: string; label: string }[] = [
    { id: '', label: 'Use tier default' },
    ...modelConfigs.filter((m) => m.enabled).map((m) => ({ id: m.modelId, label: m.displayName })),
  ]

  const [showTools, setShowTools] = useState(false)
  const [showAudioConfig, setShowAudioConfig] = useState(false)
  const [showMediaConfig, setShowMediaConfig] = useState(false)
  const [showAnimConfig, setShowAnimConfig] = useState(false)

  // Filter to only enabled providers
  const enabledAudioProviders = AUDIO_PROVIDERS.filter((p) => audioProviderEnabled[p.id] ?? p.defaultEnabled)
  const enabledMediaProviders = MEDIA_PROVIDERS.filter((p) => mediaGenEnabled[p.id] ?? p.defaultEnabled)
  const animationChips = TOOL_FILTER_CHIPS.filter((c) =>
    ['canvas2d', 'svg', 'd3', 'three', 'motion', 'lottie', 'zdog', 'html', 'interactions'].includes(c.id),
  )
  const enabledAnimations = animationChips.filter((c) => activeTools.includes(c.id))

  const applyPreset = (presetName: string) => {
    const preset = TOOL_PRESETS.find((p) => p.name === presetName)
    if (preset) setActiveTools(preset.enabledTools)
  }

  return (
    <div className="px-3 py-2.5 space-y-3 bg-[var(--color-bg)]/50 border-b border-[var(--color-border)]">
      {/* Agent selector */}
      <div>
        <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 font-medium">
          Agent
        </label>
        <div className="flex flex-wrap gap-1">
          {AGENT_PILLS.map((pill) => {
            const isActive = pill.id === agentOverride
            const color = pill.id ? AGENT_COLORS[pill.id] : '#6b7280'
            return (
              <button
                key={pill.id ?? 'auto'}
                onClick={() => setAgentOverride(pill.id)}
                title={pill.desc}
                className={`px-2 py-0.5 rounded text-[12px] font-medium border transition-all ${
                  isActive
                    ? 'text-white'
                    : 'text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-current hover:text-[var(--color-text-primary)]'
                }`}
                style={isActive ? { background: color, borderColor: color } : {}}
              >
                {pill.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Model tier selector */}
      <div>
        <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 font-medium">
          Model Tier
        </label>
        <div className="flex flex-wrap gap-1">
          {MODEL_TIER_OPTIONS.map((tier) => {
            const isActive = modelTier === tier.id
            return (
              <button
                key={tier.id}
                onClick={() => {
                  setModelTier(tier.id)
                  // Clear explicit override when changing tier
                  setModelOverride(null)
                }}
                title={tier.desc}
                className={`px-2 py-0.5 rounded text-[12px] font-medium border transition-all ${
                  isActive
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                    : 'text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {tier.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Thinking mode selector */}
      <div>
        <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 font-medium">
          Thinking
        </label>
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: 'off' as ThinkingMode, label: 'Off', desc: 'Fastest. No reasoning shown.' },
              { id: 'adaptive' as ThinkingMode, label: 'Auto', desc: 'Claude decides when to think deeply.' },
              { id: 'deep' as ThinkingMode, label: 'Deep', desc: 'Always thinks. Best for complex scenes.' },
            ] as const
          ).map((opt) => {
            const isActive = thinkingMode === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setThinkingMode(opt.id)}
                title={opt.desc}
                className={`px-2 py-0.5 rounded text-[12px] font-medium border transition-all ${
                  isActive
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                    : 'text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Model override + Scene context row */}
      <div className="flex gap-2">
        {/* Model override */}
        <div className="flex-1">
          <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 font-medium">
            Model Override
          </label>
          <select
            value={modelOverride ?? ''}
            onChange={(e) => setModelOverride(e.target.value ? (e.target.value as ModelId) : null)}
            className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-[12px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            {modelOverrideOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Scene context */}
        <div className="flex-1">
          <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 font-medium">
            Context
          </label>
          <select
            value={sceneContext}
            onChange={(e) => setSceneContext(e.target.value as 'all' | 'selected' | 'auto')}
            className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-[12px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            {SCENE_CONTEXT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} title={o.desc}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preset buttons */}
      <div>
        <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 font-medium">
          Tool Preset
        </label>
        <div className="flex flex-wrap gap-1">
          {TOOL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset.name)}
              className="px-2 py-0.5 rounded text-[12px] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tool filter chips */}
      <div>
        <button
          onClick={() => setShowTools((o) => !o)}
          className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span>{showTools ? '▾' : '▸'}</span>
          <span>Tool Filters</span>
          <span className="ml-1 text-[var(--color-accent)]">
            {activeTools.length}/{TOOL_FILTER_CHIPS.length}
          </span>
        </button>

        {showTools && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {TOOL_FILTER_CHIPS.map((chip) => {
              const isOn = activeTools.includes(chip.id)
              return (
                <button
                  key={chip.id}
                  onClick={() => toggleActiveTool(chip.id)}
                  className={`px-1.5 py-0.5 rounded text-[11px] border transition-all ${
                    isOn
                      ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Audio config */}
      <div>
        <button
          onClick={() => setShowAudioConfig((o) => !o)}
          className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span>{showAudioConfig ? '▾' : '▸'}</span>
          <span>Audio</span>
          <span className="ml-1 text-[var(--color-accent)]">{enabledAudioProviders.length}</span>
        </button>

        {showAudioConfig && (
          <div className="mt-1.5 space-y-2">
            <div className="flex flex-wrap gap-1">
              {enabledAudioProviders.map((p) => (
                <span
                  key={p.id}
                  className="px-1.5 py-0.5 rounded text-[11px] border bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]"
                >
                  {p.name}
                </span>
              ))}
            </div>
            {enabledAudioProviders.length === 0 && (
              <p className="text-[11px] text-[var(--color-text-muted)] italic">No audio providers enabled.</p>
            )}
            <button
              onClick={() => setSettingsTab('models')}
              className="text-[11px] text-[var(--color-accent)] hover:underline"
            >
              + Add audio model
            </button>
          </div>
        )}
      </div>

      {/* Media config — all media gen providers */}
      <div>
        <button
          onClick={() => setShowMediaConfig((o) => !o)}
          className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span>{showMediaConfig ? '▾' : '▸'}</span>
          <span>Media</span>
          <span className="ml-1 text-[var(--color-accent)]">{enabledMediaProviders.length}</span>
        </button>

        {showMediaConfig && (
          <div className="mt-1.5 space-y-2">
            <div className="flex flex-wrap gap-1">
              {enabledMediaProviders.map((p) => (
                <span
                  key={p.id}
                  className="px-1.5 py-0.5 rounded text-[11px] border bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]"
                >
                  {p.name}
                </span>
              ))}
            </div>
            {enabledMediaProviders.length === 0 && (
              <p className="text-[11px] text-[var(--color-text-muted)] italic">No media providers enabled.</p>
            )}
            <span
              onClick={() => setSettingsTab('models')}
              className="inline-block text-[11px] text-[var(--color-accent)] hover:underline cursor-pointer"
            >
              + Add media model
            </span>
          </div>
        )}
      </div>

      {/* Animation config — scene rendering styles */}
      <div>
        <button
          onClick={() => setShowAnimConfig((o) => !o)}
          className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span>{showAnimConfig ? '▾' : '▸'}</span>
          <span>Animation</span>
          <span className="ml-1 text-[var(--color-accent)]">
            {enabledAnimations.length}/{animationChips.length}
          </span>
        </button>

        {showAnimConfig && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {animationChips.map((chip) => {
              const isOn = activeTools.includes(chip.id)
              return (
                <button
                  key={chip.id}
                  onClick={() => toggleActiveTool(chip.id)}
                  className={`px-1.5 py-0.5 rounded text-[11px] border transition-all ${
                    isOn
                      ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

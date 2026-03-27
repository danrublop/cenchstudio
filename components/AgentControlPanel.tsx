'use client'

import { useState } from 'react'
import { useVideoStore } from '@/lib/store'
import type { AgentType, ModelId, ModelTier } from '@/lib/agents/types'
import { AGENT_COLORS, AGENT_LABELS } from '@/lib/agents/prompts'
import { TOOL_FILTER_CHIPS, TOOL_PRESETS } from '@/lib/agent-tools'

// ── Constants ──────────────────────────────────────────────────────────────────

const AGENT_PILLS: { id: AgentType | null; label: string; desc: string }[] = [
  { id: null, label: 'Auto', desc: 'Router picks the best agent for your request' },
  { id: 'director', label: 'Director', desc: 'Plans multi-scene videos, narrative arc' },
  { id: 'scene-maker', label: 'Scene Maker', desc: 'Generates content for individual scenes' },
  { id: 'editor', label: 'Editor', desc: 'Surgical edits to existing elements' },
  { id: 'dop', label: 'DoP', desc: 'Global style, palette, transitions' },
]

const MODEL_TIER_OPTIONS: { id: ModelTier; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto', desc: 'Each agent picks its default model' },
  { id: 'fast', label: 'Fast', desc: 'All Haiku — cheapest, quickest' },
  { id: 'balanced', label: 'Balanced', desc: 'Sonnet for all — good quality' },
  { id: 'performance', label: 'Performance', desc: 'Opus for creative, Sonnet for edits — best results' },
]

const MODEL_OVERRIDE_OPTIONS: { id: ModelId | ''; label: string }[] = [
  { id: '', label: 'Use tier default' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { id: 'claude-sonnet-4-5-20250514', label: 'Sonnet 4.5' },
  { id: 'claude-opus-4-5-20250514', label: 'Opus 4.5' },
]

const SCENE_CONTEXT_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto', desc: 'Director sees all scenes, Editor sees selected scene' },
  { id: 'selected', label: 'Selected scene', desc: 'Agent gets full detail of the selected scene only' },
  { id: 'all', label: 'All scenes', desc: 'Agent sees summaries of every scene' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function AgentControlPanel() {
  const {
    agentOverride, setAgentOverride,
    modelOverride, setModelOverride,
    modelTier, setModelTier,
    sceneContext, setSceneContext,
    activeTools, setActiveTools, toggleActiveTool,
    scenes, selectedSceneId,
  } = useVideoStore()

  const [showTools, setShowTools] = useState(false)

  const selectedSceneName = scenes.find(s => s.id === selectedSceneId)?.name || 'Scene'

  const applyPreset = (presetName: string) => {
    const preset = TOOL_PRESETS.find(p => p.name === presetName)
    if (preset) setActiveTools(preset.enabledTools)
  }

  return (
    <div className="px-3 py-2.5 space-y-3 bg-[var(--color-bg)]/50 border-b border-[var(--color-border)]">

      {/* Agent selector */}
      <div>
        <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 font-medium">
          Agent
        </label>
        <div className="flex flex-wrap gap-1">
          {AGENT_PILLS.map(pill => {
            const isActive = pill.id === agentOverride
            const color = pill.id ? AGENT_COLORS[pill.id] : '#6b7280'
            return (
              <button
                key={pill.id ?? 'auto'}
                onClick={() => setAgentOverride(pill.id)}
                title={pill.desc}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
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
        <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 font-medium">
          Model Tier
        </label>
        <div className="flex flex-wrap gap-1">
          {MODEL_TIER_OPTIONS.map(tier => {
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
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
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

      {/* Model override + Scene context row */}
      <div className="flex gap-2">
        {/* Model override */}
        <div className="flex-1">
          <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 font-medium">
            Model Override
          </label>
          <select
            value={modelOverride ?? ''}
            onChange={e => setModelOverride(e.target.value ? e.target.value as ModelId : null)}
            className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            {MODEL_OVERRIDE_OPTIONS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Scene context */}
        <div className="flex-1">
          <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 font-medium">
            Context
          </label>
          <select
            value={sceneContext}
            onChange={e => setSceneContext(e.target.value as 'all' | 'selected' | 'auto')}
            className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            {SCENE_CONTEXT_OPTIONS.map(o => (
              <option key={o.id} value={o.id} title={o.desc}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preset buttons */}
      <div>
        <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 font-medium">
          Tool Preset
        </label>
        <div className="flex flex-wrap gap-1">
          {TOOL_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset.name)}
              className="px-2 py-0.5 rounded text-[11px] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
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
          onClick={() => setShowTools(o => !o)}
          className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span>{showTools ? '▾' : '▸'}</span>
          <span>Tool Filters</span>
          <span className="ml-1 text-[var(--color-accent)]">
            {activeTools.length}/{TOOL_FILTER_CHIPS.length}
          </span>
        </button>

        {showTools && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {TOOL_FILTER_CHIPS.map(chip => {
              const isOn = activeTools.includes(chip.id)
              return (
                <button
                  key={chip.id}
                  onClick={() => toggleActiveTool(chip.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
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

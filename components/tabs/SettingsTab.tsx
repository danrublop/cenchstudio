'use client'

import { useState, useEffect } from 'react'
import { useVideoStore } from '@/lib/store'
import type { Scene, TransitionType } from '@/lib/types'
import { Sun, Moon, FlaskConical, Trash2, ChevronLeft, Cpu, Bot } from 'lucide-react'
import APIPermissionsSettings from '@/components/APIPermissionsSettings'
import ModelsSettingsTab from '@/components/settings/ModelsSettingsTab'
import AgentsSettingsTab from '@/components/settings/AgentsSettingsTab'

interface Props {
  scene: Scene
}

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'wipe-left', label: 'Wipe Left' },
  { value: 'wipe-right', label: 'Wipe Right' },
]

export default function SettingsTab({ scene }: Props) {
  const { updateScene, saveSceneHTML, globalStyle, updateGlobalStyle, seedTestScenes, seedInteractiveTestScenes, project, deleteProjectFromDb, settingsTab, setSettingsTab } = useVideoStore()
  const [isSeeding, setIsSeeding] = useState(false)
  const [isSeedingInteractive, setIsSeedingInteractive] = useState(false)

  // If settingsTab is 'models' or 'agents', show that sub-page
  if (settingsTab === 'models') {
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setSettingsTab(null)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border-b border-[var(--color-border)] transition-colors"
        >
          <ChevronLeft size={12} />
          <span>Back to Settings</span>
        </button>
        <div className="flex-1 overflow-y-auto">
          <ModelsSettingsTab />
        </div>
      </div>
    )
  }

  if (settingsTab === 'agents') {
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setSettingsTab(null)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border-b border-[var(--color-border)] transition-colors"
        >
          <ChevronLeft size={12} />
          <span>Back to Settings</span>
        </button>
        <div className="flex-1 overflow-y-auto">
          <AgentsSettingsTab />
        </div>
      </div>
    )
  }

  const handleSeed = async () => {
    setIsSeeding(true)
    await seedTestScenes()
    setIsSeeding(false)
  }

  const handleSeedInteractive = async () => {
    setIsSeedingInteractive(true)
    await seedInteractiveTestScenes()
    setIsSeedingInteractive(false)
  }

  const commit = async (updates: Partial<Scene>) => {
    updateScene(scene.id, updates)
    await saveSceneHTML(scene.id)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Scene name */}
      <div>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
          Scene Name
        </label>
        <input
          type="text"
          placeholder="Untitled scene"
          value={scene.name}
          onChange={(e) => updateScene(scene.id, { name: e.target.value })}
          onBlur={() => saveSceneHTML(scene.id)}
          className="w-full border rounded px-3 py-2 text-sm placeholder-[#6b6b7a] focus:outline-none focus:border-[#e84545] transition-colors"
          style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        />
      </div>

      {/* Duration */}
      <div>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
          Duration: {scene.duration}s
        </label>
        <input
          type="range"
          min={3}
          max={20}
          step={1}
          value={scene.duration}
          onChange={(e) => updateScene(scene.id, { duration: parseInt(e.target.value) })}
          onMouseUp={() => saveSceneHTML(scene.id)}
          className="w-full"
        />
        <div className="flex justify-between text-[9px] text-[#6b6b7a] mt-0.5">
          <span>3s</span>
          <span>20s</span>
        </div>
      </div>

      {/* Background color */}
      <div>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
          Background Color
        </label>
        <div className="flex items-center gap-2">
          <label className="relative cursor-pointer group flex-shrink-0">
            <div
                  className="w-10 h-10 rounded-lg border-2 transition-all overflow-hidden group-hover:border-[#e84545]"
                  style={{ background: scene.bgColor, borderColor: 'var(--color-border)' }}
                />
            <input
              type="color"
              value={scene.bgColor}
              onChange={(e) => updateScene(scene.id, { bgColor: e.target.value })}
              onBlur={() => saveSceneHTML(scene.id)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
          <input
            type="text"
            value={scene.bgColor}
            onChange={(e) => {
              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                updateScene(scene.id, { bgColor: e.target.value })
              }
            }}
            onBlur={() => saveSceneHTML(scene.id)}
            className="flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#e84545] transition-colors"
            style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
      </div>

      {/* Transition */}
      <div>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
          Transition to Next Scene
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {TRANSITIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => commit({ transition: t.value })}
              className={`kbd h-8 text-xs ${
                scene.transition === t.value
                  ? 'border-[#e84545] text-[#e84545] shadow-[#800]'
                  : 'text-[#6b6b7a] hover:text-[#f0ece0]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global Style Divider */}
      <div className="pt-4 pb-2 border-t border-[#2a2a32]">
        <h3 className="text-[#6b6b7a] text-[9px] uppercase font-bold tracking-[0.2em]">Global Design</h3>
      </div>

      {/* Theme Toggle */}
      <div>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
          Workspace Theme
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => updateGlobalStyle({
              theme: 'light',
              palette: ['#ffffff', '#ffffff', '#e84545', 'transparent', '#666675']
            })}
            className={`kbd flex-1 h-8 text-[10px] uppercase tracking-wider ${
              globalStyle.theme === 'light'
                ? 'bg-[var(--color-text-primary)] text-[var(--color-bg)] border-[var(--color-text-primary)] shadow-none'
                : 'text-[#6b6b7a] hover:text-[#f0ece0] shadow-black/40'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => updateGlobalStyle({
              theme: 'dark',
              palette: ['#181818', '#121212', '#e84545', '#151515', '#f0ece0']
            })}
            className={`kbd flex-1 h-8 text-[10px] uppercase tracking-wider ${
              globalStyle.theme === 'dark'
                ? 'bg-[var(--color-text-primary)] text-[var(--color-bg)] border-[var(--color-text-primary)] shadow-none'
                : 'text-[#6b6b7a] hover:text-[#f0ece0] shadow-black/40'
            }`}
          >
            Dark
          </button>
        </div>
      </div>



      {/* Font */}
      <div>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
          Typography
        </label>
        <select
          value={globalStyle.font}
          onChange={(e) => updateGlobalStyle({ font: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-[#e84545] appearance-none cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          {['Caveat', 'DM Mono', 'Georgia', 'monospace', 'serif', 'sans-serif'].map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Stroke width */}
      <div>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
          Stroke Weight: {globalStyle.strokeWidth}px
        </label>
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={globalStyle.strokeWidth}
          onChange={(e) => updateGlobalStyle({ strokeWidth: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Scene ID (debug) */}
      <div className="text-[9px] text-[#6b6b7a] border-t pt-4 font-mono" style={{ borderColor: 'var(--color-border)' }}>
        scene_id: {scene.id}
      </div>

      {/* AI Configuration */}
      <div className="pt-4 pb-2 border-t border-[#2a2a32]">
        <h3 className="text-[#6b6b7a] text-[9px] uppercase font-bold tracking-[0.2em]">AI Configuration</h3>
      </div>

      <button
        onClick={() => setSettingsTab('models')}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors hover:border-[var(--color-accent)]/50"
        style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)' }}
      >
        <Cpu size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
        <div className="flex flex-col items-start text-left">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">Models</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">API keys, providers & local LLMs</span>
        </div>
      </button>

      <button
        onClick={() => setSettingsTab('agents')}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors hover:border-[var(--color-accent)]/50"
        style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)' }}
      >
        <Bot size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
        <div className="flex flex-col items-start text-left">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">Agents</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">Configure & create custom agents</span>
        </div>
      </button>

      {/* API Permissions */}
      <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <APIPermissionsSettings />
      </div>

      {/* Test seed */}
      <div className="border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
        <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">Dev</label>
        <button
          onClick={handleSeed}
          disabled={isSeeding}
          className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40"
        >
          <FlaskConical size={13} />
          {isSeeding ? 'Loading test scenes...' : 'Load 6 Test Scenes (one per type)'}
        </button>
        <button
          onClick={handleSeedInteractive}
          disabled={isSeedingInteractive}
          className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40 mt-1.5"
        >
          <FlaskConical size={13} />
          {isSeedingInteractive ? 'Loading...' : 'Load 6 Interactive Scenes (one per interaction)'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="border-t pt-4 mt-6" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-red-400/80 text-[10px] uppercase font-bold tracking-[0.2em] mb-3 text-center">Danger</h3>
        <button
          onClick={async () => {
            if (confirm(`Permanently delete project "${project.name}"?`)) {
              await deleteProjectFromDb(project.id)
            }
          }}
          className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] font-medium text-red-400 hover:text-white border border-red-900/50 bg-red-950/20 hover:bg-red-500/80 transition-all shadow-none"
        >
          <Trash2 size={13} />
          Delete Project
        </button>
      </div>
    </div>
  )
}

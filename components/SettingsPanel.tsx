'use client'

import { useState } from 'react'
import { useVideoStore } from '@/lib/store'
import { ChevronDown, FlaskConical, Trash2, Sun, Moon } from 'lucide-react'
import AgentsSettingsTab from './settings/AgentsSettingsTab'
import ModelsAndApiPanel from './settings/ModelsAndApiPanel'
import PermissionsPanel from './settings/PermissionsPanel'
import UsageSection from './settings/UsageSection'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const {
    globalStyle, updateGlobalStyle,
    seedTestScenes, seedInteractiveTestScenes,
    project, deleteProjectFromDb,
  } = useVideoStore()

  const [isSeeding, setIsSeeding] = useState(false)
  const [isSeedingInteractive, setIsSeedingInteractive] = useState(false)

  return (
    <div className="flex flex-col h-full text-[var(--color-text-primary)] bg-transparent">
      <div className="flex-1 overflow-y-auto">

        {/* General section */}
        <details className="group border-b border-[var(--color-border)]" open>
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            General
            <ChevronDown size={14} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 pb-4 space-y-4">
            <div>
              <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5 font-bold">Theme</label>
              <button 
                onClick={() => {
                  const isDark = globalStyle.theme === 'dark';
                  if (isDark) {
                    updateGlobalStyle({ theme: 'light', palette: ['#ffffff', '#ffffff', '#e84545', 'transparent', '#666675'] });
                  } else {
                    updateGlobalStyle({ theme: 'dark', palette: ['#181818', '#121212', '#e84545', '#151515', '#f0ece0'] });
                  }
                }}
                className="kbd w-full h-8 flex items-center justify-between px-3 group hover:border-[var(--color-accent)] transition-all shadow-black/40"
              >
                <div className="flex items-center gap-2">
                  <div className={`transition-all duration-300 ${globalStyle.theme === 'light' ? 'text-amber-400 rotate-0' : 'text-[var(--color-text-muted)] -rotate-90 opacity-0 absolute'}`}>
                    <Sun size={15} fill="currentColor" />
                  </div>
                  <div className={`transition-all duration-300 ${globalStyle.theme === 'dark' ? 'text-blue-400 rotate-0' : 'text-[var(--color-text-muted)] rotate-90 opacity-0 absolute'}`}>
                    <Moon size={15} fill="currentColor" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-primary)]">
                    {globalStyle.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <div className={`w-8 h-4 rounded-full border border-[var(--color-border)] relative transition-colors ${globalStyle.theme === 'dark' ? 'bg-[var(--color-accent)] border-[var(--color-accent)] shadow-[0_0_10px_rgba(232,69,69,0.3)]' : 'bg-[var(--color-input-bg)]'}`}>
                  <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all duration-300 ${globalStyle.theme === 'dark' ? 'left-4.5' : 'left-0.5'}`} />
                </div>
              </button>
            </div>

            {/* Font */}
            <div>
              <label className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider block mb-1.5">Typography</label>
              <select value={globalStyle.font} onChange={(e) => updateGlobalStyle({ font: e.target.value })}
                className="w-full border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--color-accent)] appearance-none cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                {['Caveat', 'DM Mono', 'Georgia', 'monospace', 'serif', 'sans-serif'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Stroke */}
            <div>
              <label className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider block mb-1.5">
                Stroke: {globalStyle.strokeWidth}px
              </label>
              <input type="range" min={1} max={5} step={0.5} value={globalStyle.strokeWidth}
                onChange={(e) => updateGlobalStyle({ strokeWidth: parseFloat(e.target.value) })} className="w-full" />
            </div>
          </div>
        </details>

        {/* Usage section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Usage
            <ChevronDown size={14} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 pb-4">
            <UsageSection />
          </div>
        </details>

        {/* Agents section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Agents
            <ChevronDown size={14} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 pb-4">
            <AgentsSettingsTab />
          </div>
        </details>

        {/* Models & API section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Models & APIs
            <ChevronDown size={14} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 pb-4">
            <ModelsAndApiPanel />
          </div>
        </details>

        {/* Permissions section */}
        <details className="group border-b border-[var(--color-border)]">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Permissions
            <ChevronDown size={14} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 pb-4">
            <PermissionsPanel />
          </div>
        </details>

        {/* Dev section */}
        <details className="group border-b border-[var(--color-border)] last:border-b-0">
          <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-semibold transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            Dev
            <ChevronDown size={14} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <button onClick={async () => { setIsSeeding(true); await seedTestScenes(); setIsSeeding(false) }}
              disabled={isSeeding}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[var(--color-text-muted)] hover:text-[#f0ece0] disabled:opacity-40">
              <FlaskConical size={13} />
              {isSeeding ? 'Loading test scenes...' : 'Load Test Scenes'}
            </button>
            <button onClick={async () => { setIsSeedingInteractive(true); await seedInteractiveTestScenes(); setIsSeedingInteractive(false) }}
              disabled={isSeedingInteractive}
              className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] disabled:opacity-40">
              <FlaskConical size={13} />
              {isSeedingInteractive ? 'Loading...' : 'Load Interactive Scenes'}
            </button>
            <div className="pt-3 border-t border-[var(--color-border)] mt-3">
              <button onClick={async () => { if (confirm(`Delete project "${project.name}"?`)) await deleteProjectFromDb(project.id) }}
                className="kbd w-full h-8 flex items-center justify-center gap-2 text-[11px] font-medium text-red-400 hover:text-white border border-red-900/50 bg-red-950/20 hover:bg-red-500/80 transition-all shadow-none">
                <Trash2 size={13} />
                Delete Project
              </button>
            </div>
          </div>
        </details>

      </div>
    </div>
  )
}

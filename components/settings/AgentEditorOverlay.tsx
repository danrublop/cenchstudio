'use client'

import { useState, useEffect } from 'react'
import {
  X, Check, Film, Scissors, Palette, Zap, Infinity, PenLine,
  Paintbrush, Sparkles, Box, BarChart2, Plus, ArrowLeft, Cpu, ShieldCheck
} from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { AgentConfig, AgentCategory } from '@/lib/agents/agent-config'
import type { LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import { CATEGORY_LABELS, ICON_MAP, AgentIcon } from './AgentsSettingsTab'

export default function AgentEditorOverlay() {
  const { 
    agentConfigs, setAgentConfigs, addCustomAgent,
    editingAgentId, setEditingAgentId, 
    isCreatingAgent, setIsCreatingAgent 
  } = useVideoStore()

  const [draft, setDraft] = useState<Partial<AgentConfig> | null>(null)

  useEffect(() => {
    if (editingAgentId) {
      const existing = agentConfigs.find(a => a.id === editingAgentId)
      if (existing) setDraft({ ...existing })
    } else if (isCreatingAgent) {
      setDraft({
        id: '', name: '', description: '', icon: 'zap', color: '#6b7280',
        defaultModelTier: 'balanced', toolAccess: [], isBuiltIn: false,
        isEnabled: true, category: 'custom', systemPrompt: ''
      })
    } else {
      setDraft(null)
    }
  }, [editingAgentId, isCreatingAgent, agentConfigs])

  if (!draft) return null

  const handleSave = () => {
    if (isCreatingAgent) {
      if (!draft.id || !draft.name || !draft.description || !draft.systemPrompt) return
      addCustomAgent(draft as AgentConfig)
    } else {
      const updated = agentConfigs.map((a) => (a.id === draft.id ? (draft as AgentConfig) : a))
      setAgentConfigs(updated)
    }
    handleClose()
  }

  const handleClose = () => {
    setEditingAgentId(null)
    setIsCreatingAgent(false)
  }

  const isBuiltIn = draft.isBuiltIn

  return (
    <div className="absolute inset-0 z-[500] bg-[var(--color-bg)] animate-in fade-in duration-300 flex flex-col">
      <div className="w-full h-full flex flex-col bg-[var(--color-panel)] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]/40">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
              style={{ backgroundColor: draft.color + '22', color: draft.color, border: `1px solid ${draft.color}44` }}
            >
              <AgentIcon icon={draft.icon ?? 'zap'} size={16} />
            </div>
            <h2 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
              {isCreatingAgent ? 'Forge New Agent' : `Refining ${draft.name}`}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* Identity Section */}
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 lg:col-span-4 space-y-6">
               <SectionLabel>Identity & Appearance</SectionLabel>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-[9px] uppercase font-bold text-[#6b6b7a] tracking-widest block mb-2">Internal Identifier</label>
                   <input 
                    type="text" value={draft.id} readOnly={!isCreatingAgent}
                    onChange={(e) => setDraft(d => ({ ...d, id: e.target.value }))}
                    className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none disabled:opacity-50"
                  />
                 </div>
                 <div>
                   <label className="text-[9px] uppercase font-bold text-[#6b6b7a] tracking-widest block mb-2">Display Name</label>
                   <input 
                    type="text" value={draft.name} 
                    onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[var(--color-accent)]"
                  />
                 </div>
                 <div>
                   <label className="text-[9px] uppercase font-bold text-[#6b6b7a] tracking-widest block mb-2">Objective</label>
                   <input 
                    type="text" value={draft.description} 
                    onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                  />
                 </div>
               </div>
            </div>

            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              <SectionLabel>Cognitive Protocol (System Prompt)</SectionLabel>
              <div className="flex-1 relative">
                <textarea
                  value={draft.systemPrompt}
                  onChange={(e) => setDraft(d => ({ ...d, systemPrompt: e.target.value }))}
                  className="w-full h-[320px] bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-xl px-5 py-4 text-[13px] font-mono leading-relaxed text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="Define the agent's behavior, expertise, and constraints..."
                />
                <div className="absolute top-4 right-4 text-[var(--color-accent)]/20 pointer-events-none">
                  <ShieldCheck size={40} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-10">
             <div className="col-span-12 lg:col-span-4 space-y-6">
               <SectionLabel>Intelligence Tier</SectionLabel>
               <div className="bg-[var(--color-input-bg)] p-1 rounded-xl border border-[var(--color-border)] flex gap-1">
                 {['budget', 'balanced', 'performance'].map((tier) => (
                   <button
                    key={tier}
                    onClick={() => setDraft(d => ({ ...d, defaultModelTier: tier as any }))}
                    className={`flex-1 py-3 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all ${
                      draft.defaultModelTier === tier 
                        ? 'bg-[var(--color-accent)] text-white shadow-lg' 
                        : 'text-[#6b6b7a] hover:text-[var(--color-text-primary)]'
                    }`}
                   >
                     {tier}
                   </button>
                 ))}
               </div>
             </div>

             <div className="col-span-12 lg:col-span-8 space-y-6">
               <SectionLabel>Appearance Customization</SectionLabel>
               <div className="flex items-center gap-10">
                 <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <label className="text-[9px] uppercase font-bold text-[#6b6b7a] tracking-widest">Aura Color</label>
                    <input 
                      type="color" value={draft.color} 
                      onChange={(e) => setDraft(d => ({ ...d, color: e.target.value }))}
                      className="w-12 h-12 rounded-full cursor-pointer border-4 border-[var(--color-border)] bg-transparent overflow-hidden"
                    />
                 </div>
                 <div className="flex-1 space-y-3">
                    <label className="text-[9px] uppercase font-bold text-[#6b6b7a] tracking-widest block px-1">Specialized Glyph</label>
                    <div className="flex flex-wrap gap-2">
                       {Object.keys(ICON_MAP).map(name => (
                         <button 
                          key={name}
                          onClick={() => setDraft(d => ({ ...d, icon: name }))}
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all ${
                            draft.icon === name 
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)] scale-110' 
                              : 'border-[var(--color-border)] text-[#6b6b7a] hover:border-[#6b6b7a]'
                          }`}
                         >
                            <AgentIcon icon={name} size={18} />
                         </button>
                       ))}
                    </div>
                 </div>
               </div>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-8 py-[8.5px] border-t border-[var(--color-border)] bg-[var(--color-bg)]/40 flex items-center justify-end gap-3">
           <button onClick={handleClose} className="px-5 py-2 text-xs font-bold text-[#6b6b7a] hover:text-[var(--color-text-primary)] transition-colors">
             Discard
           </button>
           <button onClick={handleSave} className="flex items-center gap-3 px-8 py-2 bg-[var(--color-accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-[var(--color-accent)]/10">
             Finalize
           </button>
        </div>

      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-black">
      {children}
    </h4>
  )
}

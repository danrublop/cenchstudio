'use client'

import { useState } from 'react'
import {
  Film, Scissors, Palette, Zap, PenLine,
  Paintbrush, Sparkles, Box, BarChart2, Plus, X,
  Edit2, ToggleLeft, ToggleRight, Search
} from 'lucide-react'
import { CenchLogo as AgentIconLogo } from '../icons/CenchLogo'
import { useVideoStore } from '@/lib/store'
import type { AgentConfig, AgentCategory } from '@/lib/agents/agent-config'
import { getAgentsByCategory } from '@/lib/agents/agent-config'
import type { LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>

export const ICON_MAP: Record<string, any> = {
  'infinity': AgentIconLogo,
  'film': Film,
  'zap': Zap,
  'scissors': Scissors,
  'palette': Palette,
  'pen-line': PenLine,
  'paintbrush': Paintbrush,
  'sparkles': Sparkles,
  'box': Box,
  'bar-chart-2': BarChart2,
}

export const CATEGORY_LABELS: Record<AgentCategory, string> = {
  general: 'General',
  animation: 'Animation Specialists',
  style: 'Style',
  data: 'Data',
  custom: 'Custom Agents',
}

// ── Shared Subcomponents ─────────────────────────────────────────────────────

export function AgentIcon({ icon, size = 14, className }: { icon: string; size?: number; className?: string }) {
  const Icon = (ICON_MAP[icon] ?? Zap) as LucideIcon
  return <Icon size={size} className={className} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] uppercase tracking-widest text-[#6b6b7a] font-bold px-1 mb-2">
      {children}
    </h4>
  )
}

function ListContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[var(--color-border)] mb-6 pr-1">
      {children}
    </div>
  )
}

// ── Main Agent Row ─────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentConfig }) {
  const { toggleAgentEnabled, removeCustomAgent, setEditingAgentId } = useVideoStore()

  return (
    <div className="flex items-center justify-between gap-3 py-3 px-1 hover:bg-[var(--color-bg)]/20 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: agent.color + '15', color: agent.color }}
        >
          <AgentIcon icon={agent.icon} size={15} />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-none">{agent.name}</span>
            {!agent.isBuiltIn && <span className="text-[8px] px-1 font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 rounded uppercase tracking-tighter">Custom</span>}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] truncate">{agent.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => setEditingAgentId(agent.id)} className="no-style text-[#6b6b7a] hover:text-[var(--color-text-primary)] transition-colors" title="Edit agent">
          <Edit2 size={13} />
        </button>
        
        {!agent.isBuiltIn && (
          <button onClick={() => removeCustomAgent(agent.id)} className="no-style text-[#6b6b7a] hover:text-red-400 transition-colors">
            <X size={13} />
          </button>
        )}

        <button onClick={() => toggleAgentEnabled(agent.id)} className="no-style text-[#6b6b7a] hover:text-[var(--color-accent)] transition-all">
          {agent.isEnabled ? <ToggleRight size={22} className="text-[var(--color-accent)]" /> : <ToggleLeft size={22} />}
        </button>
      </div>
    </div>
  )
}

// ── Main Tab Component ────────────────────────────────────────────────────────

export default function AgentsSettingsTab() {
  const { agentConfigs, setIsCreatingAgent } = useVideoStore()
  
  const byCategory = getAgentsByCategory(agentConfigs)
  const categories: AgentCategory[] = ['general', 'animation', 'style', 'data', 'custom']

  return (
    <div className="space-y-6">
      
      {/* Create / Import Agent Buttons */}
      <div className="px-1 flex gap-1.5">
        <button 
          onClick={() => setIsCreatingAgent(true)}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 rounded hover:bg-[var(--color-accent)]/20 transition-all shadow-none"
        >
          <Plus size={11} />
          Create
        </button>
        <button 
          className="flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] transition-all shadow-none"
        >
          Import
        </button>
      </div>

      <div className="space-y-6">
        {categories.map((cat) => {
          const agents = byCategory[cat]
          if (!agents || agents.length === 0) return null
          
          return (
            <div key={cat}>
              <SectionLabel>{CATEGORY_LABELS[cat]}</SectionLabel>
              <ListContainer>
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                  />
                ))}
              </ListContainer>
            </div>
          )
        })}
      </div>
    </div>
  )
}

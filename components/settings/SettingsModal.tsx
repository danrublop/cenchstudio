'use client'

import { useEffect, useRef } from 'react'
import { X, Cpu, Bot, Settings, type LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import { useVideoStore } from '@/lib/store'
import ModelsSettingsTab from './ModelsSettingsTab'
import AgentsSettingsTab from './AgentsSettingsTab'
import GeneralSettingsTab from './GeneralSettingsTab'

type Tab = 'models' | 'agents' | 'general'
type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'general', label: 'General', icon: Settings },
]

export default function SettingsModal() {
  const { settingsTab, setSettingsTab } = useVideoStore()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsTab(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSettingsTab])

  if (!settingsTab) return null

  const activeTab = settingsTab

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) setSettingsTab(null)
      }}
    >
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <h1 className="text-base font-bold text-[var(--color-text-primary)]">Settings</h1>
          <button
            onClick={() => setSettingsTab(null)}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/40 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] flex-shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSettingsTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === id
                  ? 'bg-[var(--color-panel)] text-[var(--color-text-primary)] font-medium shadow-sm border border-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'models' && <ModelsSettingsTab />}
          {activeTab === 'agents' && <AgentsSettingsTab />}
          {activeTab === 'general' && <GeneralSettingsTab />}
        </div>
      </div>
    </div>
  )
}

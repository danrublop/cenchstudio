'use client'

import { useVideoStore } from '@/lib/store'
import PromptTab from './tabs/PromptTab'
import LayersTab from './tabs/LayersTab'
import InteractTab from './tabs/InteractTab'
import { Infinity as AiIcon } from 'lucide-react'

type Tab = 'prompt' | 'layers' | 'interact'

export default function SceneEditor() {
  const { scenes, selectedSceneId, rightPanelTab, setRightPanelTab } = useVideoStore()
  // Map store tab to our local type (ignore 'settings' — that's in the left panel now)
  const activeTab: Tab = (rightPanelTab === 'settings' ? 'prompt' : rightPanelTab) as Tab
  const setActiveTab = (tab: Tab) => setRightPanelTab(tab)

  const selectedScene = scenes.find((s) => s.id === selectedSceneId)

  if (!selectedScene) {
    return (
      <div className="flex items-center justify-center h-32 text-[#6b6b7a] text-xs p-4 text-center">
        Select or create a scene to edit
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon?: any }[] = [
    { key: 'layers', label: 'Layers' },
    { key: 'interact', label: 'Interact' },
    { key: 'prompt', label: 'Agent', icon: AiIcon },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-3 pt-3 pb-2 flex-shrink-0 bg-[var(--color-panel)] border-b border-black">
        {tabs.map((tab) => {
          const isIconOnly = tab.key === 'prompt'
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`kbd h-7 transition-all duration-200 ${
                isIconOnly ? 'w-7 px-0 flex-shrink-0' : 'flex-1 px-0 text-xs'
              } ${
                activeTab === tab.key
                  ? 'bg-[#e84545] border-[#e84545] text-white shadow-[#800]'
                  : 'text-[#6b6b7a] hover:text-[#f0ece0] shadow-black/40'
              }`}
              data-tooltip={isIconOnly ? tab.label : undefined}
              data-tooltip-pos={isIconOnly ? 'bottom-left' : undefined}
            >
              {isIconOnly && Icon ? <Icon size={14} strokeWidth={2.5} /> : tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'prompt' && <PromptTab scene={selectedScene} />}
        {activeTab === 'layers' && <LayersTab scene={selectedScene} />}
        {activeTab === 'interact' && <InteractTab scene={selectedScene} />}
      </div>
    </div>
  )
}

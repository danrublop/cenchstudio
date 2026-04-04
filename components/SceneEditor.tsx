'use client'

import { useVideoStore } from '@/lib/store'
import PromptTab from './tabs/PromptTab'
import LayersTab from './tabs/LayersTab'
import MediaLibrary from './MediaLibrary'
import { Infinity as AiIcon } from 'lucide-react'
type Tab = 'prompt' | 'layers' | 'media'

export default function SceneEditor() {
  const useElectronLayout = true
  const { scenes, selectedSceneId, rightPanelTab, setRightPanelTab } = useVideoStore()
  const activeTab: Tab = rightPanelTab
  const setActiveTab = (tab: Tab) => setRightPanelTab(tab)

  const selectedScene = scenes.find((s) => s.id === selectedSceneId)

  if (!selectedScene && activeTab !== 'media') {
    return (
      <div className="flex items-center justify-center h-32 text-[#6b6b7a] text-xs p-4 text-center">
        Select or create a scene to edit
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon?: any }[] = [
    { key: 'layers', label: 'Layers' },
    { key: 'media', label: 'Media' },
    { key: 'prompt', label: 'Agent', icon: AiIcon },
  ]

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      {!useElectronLayout && (
        <div className="flex shrink-0 gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3 pb-2 pt-3">
          {tabs.map((tab) => {
            const isIconOnly = tab.key === 'prompt'
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`kbd h-7 transition-all duration-200 ${
                  isIconOnly ? 'w-7 px-0 flex-shrink-0' : 'flex-1 px-0 text-xs'
                } ${
                  activeTab === tab.key
                    ? 'bg-[#e84545] border-[#e84545] text-white shadow-[#800]'
                    : 'text-[#6b6b7a] hover:text-[#f0ece0] shadow-black/40'
                } relative`}
                data-tooltip={isIconOnly ? tab.label : undefined}
                data-tooltip-pos={isIconOnly ? 'bottom-left' : undefined}
              >
                {isIconOnly && Icon ? <Icon size={14} strokeWidth={2.5} /> : tab.label}
              </button>
            )
          })}
        </div>
      )}
      {/* Tab content: Layers fills height and scrolls internally so layer stack stays at bottom */}
      <div className={`flex min-h-0 flex-1 flex-col ${activeTab === 'layers' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {activeTab === 'prompt' && selectedScene && <PromptTab scene={selectedScene} />}
        {activeTab === 'layers' && selectedScene && <LayersTab scene={selectedScene} />}
        {activeTab === 'media' && <MediaLibrary />}
      </div>
    </div>
  )
}

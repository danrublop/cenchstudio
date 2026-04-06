'use client'

interface HeaderTabSwitcherProps {
  activeTab: 'project' | 'studio' | 'record'
  onTabChange: (tab: 'project' | 'studio' | 'record') => void
  projectName: string
}

const tabs = [
  { id: 'project' as const, getLabel: (name: string) => name },
  { id: 'studio' as const, getLabel: () => 'Studio' },
  { id: 'record' as const, getLabel: () => 'Record' },
]

export default function HeaderTabSwitcher({ activeTab, onTabChange, projectName }: HeaderTabSwitcherProps) {
  return (
    <div
      className="flex items-center h-8 rounded-lg bg-[var(--color-input-bg)] p-0.5 gap-0.5"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const label = tab.getLabel(projectName)
        return (
          <span
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors select-none ${
              tab.id === 'project' ? 'max-w-[120px] truncate' : ''
            } ${
              isActive
                ? 'bg-[var(--color-panel)] text-[var(--color-text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
            title={tab.id === 'project' ? projectName : undefined}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

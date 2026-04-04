'use client'

import { useState } from 'react'
import { MoreHorizontal, ToggleLeft, ToggleRight } from 'lucide-react'
import { type LayersTabSectionId, LAYERS_TAB_META, layersTabLabel } from '@/lib/layers-tab-header'

interface Props {
  visibleTabIds: LayersTabSectionId[]
  onVisibleTabIdsChange: (ids: LayersTabSectionId[]) => void
  activeTabId: LayersTabSectionId
  onActiveTabChange: (id: LayersTabSectionId) => void
  hasInteractTab: boolean
}

export default function LayersTabSubheader({
  visibleTabIds,
  onVisibleTabIdsChange,
  activeTabId,
  onActiveTabChange,
  hasInteractTab,
}: Props) {
  const [configOpen, setConfigOpen] = useState(false)

  const catalogIds = LAYERS_TAB_META.map((m) => m.id).filter((id) => id !== 'interact' || hasInteractTab)

  const setTabVisible = (id: LayersTabSectionId, on: boolean) => {
    if (on) {
      if (visibleTabIds.includes(id)) return
      onVisibleTabIdsChange([...visibleTabIds, id])
      return
    }
    if (visibleTabIds.length <= 1 && visibleTabIds.includes(id)) return
    const next = visibleTabIds.filter((x) => x !== id)
    if (next.length === 0) return
    onVisibleTabIdsChange(next)
    if (id === activeTabId) onActiveTabChange(next[0])
  }

  const label = (id: LayersTabSectionId) => layersTabLabel(id)

  return (
    <>
      <div
        className="flex flex-shrink-0 items-center gap-0.5 border-b bg-[var(--color-bg)] px-1 py-1"
        style={{ borderBottomColor: 'var(--color-hairline)' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {visibleTabIds.map((id) => {
            const active = id === activeTabId
            return (
              <span
                key={id}
                role="tab"
                aria-selected={active}
                tabIndex={0}
                onClick={() => onActiveTabChange(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onActiveTabChange(id)
                  }
                }}
                className={`chat-tab max-w-[120px] flex-shrink-0 cursor-pointer select-none overflow-hidden rounded px-2 py-1 text-[10px] outline-none transition-all ${
                  active
                    ? 'border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--kbd-text)]'
                    : 'border border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]/50 hover:text-[var(--kbd-text)]'
                } whitespace-nowrap`}
                style={
                  {
                    '--tab-bg': active ? 'var(--color-panel)' : 'var(--color-bg)',
                  } as React.CSSProperties
                }
              >
                <span className="inline-block max-w-[108px] truncate align-bottom">{label(id)}</span>
              </span>
            )
          })}
        </div>

        <div className="relative ml-0.5 flex flex-shrink-0">
          <button
            type="button"
            onClick={() => setConfigOpen((o) => !o)}
            className="no-style flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]/50 hover:text-[var(--kbd-text)]"
            aria-haspopup="dialog"
            aria-expanded={configOpen}
            data-tooltip="Configure tabs"
            data-tooltip-pos="bottom-left"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {configOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setConfigOpen(false)} />
          <div
            className="fixed top-[62px] right-4 z-[9999] max-h-[min(520px,calc(100vh-80px))] w-[min(200px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            <div className="space-y-1">
              {catalogIds.map((id) => {
                const on = visibleTabIds.includes(id)
                const onlyOne = on && visibleTabIds.length <= 1
                return (
                  <span
                    key={id}
                    role="button"
                    tabIndex={onlyOne ? -1 : 0}
                    onClick={() => {
                      if (onlyOne) return
                      setTabVisible(id, !on)
                    }}
                    onKeyDown={(e) => {
                      if (onlyOne) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setTabVisible(id, !on)
                      }
                    }}
                    className={`flex items-center justify-between py-1.5 select-none ${
                      onlyOne ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-medium ${on ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}
                    >
                      {label(id)}
                    </span>
                    {on ? (
                      <ToggleRight size={18} className="text-[var(--color-accent)]" />
                    ) : (
                      <ToggleLeft size={18} className="text-[var(--color-text-muted)]" />
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}

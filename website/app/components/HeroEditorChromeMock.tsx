'use client'

import Image from 'next/image'
import { HeroAgentPanelMock } from './HeroAgentPanelMock'
import { HeroTimelineMock } from './HeroTimelineMock'
import {
  Home,
  Expand,
  PanelLeft,
  Search,
  Undo2,
  Redo2,
  Minus,
  Plus,
  RotateCcw,
  Settings,
  Infinity as AgentIcon,
  GitBranch,
  RefreshCw,
  XCircle,
  AlertTriangle,
  ZoomIn,
  Bell,
  PanelBottomOpen,
} from 'lucide-react'

type HeroEditorChromeMockProps = {
  className?: string
}

/**
 * Static replica of the electron `Editor` chrome: real PNG toolbar icons, Lucide glyphs,
 * and Tailwind classes aligned with `components/Editor.tsx` + `EditorStatusBar.tsx`.
 */
export function HeroEditorChromeMock({ className = '' }: HeroEditorChromeMockProps) {
  const itemClass =
    'flex items-center gap-1 rounded px-1.5 py-0.5 max-w-[140px]'

  return (
    <div
      className={`hero-editor-mock relative w-[920px] shrink-0 max-w-none select-none [font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif] ${className}`}
      aria-label="Editor preview (illustration)"
    >
      <div className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:rounded-xl">
        {/* Titlebar — class names from Editor `useElectronLayout` header */}
        <header
          className="grid h-12 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3"
          style={{ color: '#8a8a8a' }}
        >
          <div className="flex items-center gap-1.5">
            <div className="mock-tb-btn electron-titlebar-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
              <PanelLeft size={20} strokeWidth={1.5} />
            </div>
          </div>

          <div className="flex min-w-0 max-w-full items-center justify-center gap-2 justify-self-center h-full">
            <div className="mock-tb-btn electron-titlebar-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
              <Search size={16} strokeWidth={2} />
            </div>
            <div className="flex items-center h-8 rounded-lg bg-[var(--color-input-bg)] p-0.5 gap-0.5">
              <span className="px-3 py-1 text-[10.5px] font-medium rounded-md text-[var(--color-text-muted)]">Project</span>
              <span className="px-3 py-1 text-[10.5px] font-medium rounded-md bg-[var(--color-panel)] text-[var(--color-text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]">Studio</span>
              <span className="px-3 py-1 text-[10.5px] font-medium rounded-md text-[var(--color-text-muted)]">Record</span>
            </div>
          </div>

          <div className="flex items-center justify-self-end gap-1.5">
            <div className="mock-tb-btn electron-titlebar-icon flex h-8 w-8 items-center justify-center rounded-md transition-colors">
              <PanelBottomOpen size={20} strokeWidth={1.5} />
            </div>
            <div className="mock-tb-btn electron-titlebar-icon electron-titlebar-icon-active flex h-8 w-8 items-center justify-center rounded-md transition-colors">
              <AgentIcon size={18} strokeWidth={2.5} />
            </div>
            <div className="mock-tb-btn electron-titlebar-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
              <Settings size={20} />
            </div>
          </div>
        </header>

        {/* Three-panel body — fixed height so left-rail content (scenes + layer stack) scrolls inside, like the real editor */}
        <div className="flex h-[520px] max-h-[520px] shrink-0 items-stretch overflow-hidden sm:h-[580px] sm:max-h-[580px] lg:h-[620px] lg:max-h-[620px]">
          <div className="relative z-[90] flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-panel)]">
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--color-bg)] p-2">
              <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[#0d0d0f] shadow-inner">
                <div
                  className="absolute inset-0 opacity-90"
                  style={{
                    background:
                      'linear-gradient(145deg, #1a1f2e 0%, #252030 40%, #1a2535 70%, #12161f 100%)',
                  }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:12px_12px] opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src="/blacklogo.png"
                    alt=""
                    width={64}
                    height={64}
                    className="h-[20%] w-auto max-h-16 opacity-[0.22]"
                  />
                </div>
                <div className="absolute right-1 bottom-1 rounded bg-black/50 px-1 py-0.5 font-mono text-[9px] text-white/70">
                  1920×1080
                </div>
              </div>
            </div>

            {/* Timeline — nested in center column like real app */}
            <div className="h-[140px] shrink-0 border-t border-[var(--color-border)] overflow-hidden">
              <HeroTimelineMock />
            </div>
          </div>

          <aside className="flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <HeroAgentPanelMock />
            </div>
          </aside>
        </div>

        {/* Status bar — `EditorStatusBar` */}
        <footer className="relative z-[120] flex h-[26px] shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-2 text-[12px] text-[var(--color-text-muted)] select-none [font-variant-numeric:tabular-nums]">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
            <span className={`${itemClass} shrink-0 cursor-default`} title="main">
              <GitBranch size={12} className="shrink-0 opacity-80" strokeWidth={2} />
              <span className="truncate font-medium">main</span>
            </span>

            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-40">
              <RefreshCw size={12} strokeWidth={2} />
            </span>

            <div className="mx-1 h-3 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />

            <span className="truncate px-1 font-medium text-[var(--color-text-primary)]/80" title="Cench">
              Cench
            </span>

            <div className="mx-1 h-3 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />

            <span className={`${itemClass} shrink-0 cursor-default`} title="No errors" role="status">
              <XCircle size={12} className="shrink-0 text-[var(--color-text-muted)] opacity-80" strokeWidth={2} />
              <span>0</span>
            </span>

            <span className={`${itemClass} shrink-0 cursor-default`} title="No warnings" role="status">
              <AlertTriangle size={12} className="shrink-0 text-[var(--color-text-muted)] opacity-80" strokeWidth={2} />
              <span>0</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded opacity-80">
              <ZoomIn size={13} strokeWidth={2} />
            </span>

            <span className="flex h-6 w-6 items-center justify-center rounded opacity-80">
              <Bell size={13} strokeWidth={2} />
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

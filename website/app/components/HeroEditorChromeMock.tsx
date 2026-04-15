'use client'

import Image from 'next/image'
import { HeroAgentPanelMock } from './HeroAgentPanelMock'
import { HeroTransportBarMock } from './HeroTransportBarMock'
import { HeroTimelineMock } from './HeroTimelineMock'
import { CenchLogo as AgentIcon } from '../../../components/icons/CenchLogo'
import { Search } from 'lucide-react'

type HeroEditorChromeMockProps = {
  className?: string
}

/**
 * Static replica of the electron `Editor` chrome: titlebar with search + project title,
 * agent icon only (top right). No bottom status bar (marketing hero).
 */
export function HeroEditorChromeMock({ className = '' }: HeroEditorChromeMockProps) {
  return (
    <div
      className={`hero-editor-mock relative w-[min(1080px,calc(100vw-2rem))] shrink-0 max-w-none select-none [font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif] ${className}`}
      aria-label="Editor preview (illustration)"
    >
      <div className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:rounded-xl">
        {/* Titlebar — class names from Editor `useElectronLayout` header */}
        <header
          className="grid h-9 grid-cols-[auto_1fr_auto] items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <div className="flex items-center gap-1.5 pl-0.5" aria-hidden>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-text-muted)]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-black/20" />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-text-muted)]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-black/20" />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-text-muted)]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-black/20" />
          </div>

          {/* Mirrors `Editor` titlebar center: search + project title (no tab strip) */}
          <div className="flex h-full min-w-0 max-w-[min(60vw,360px)] items-center justify-center justify-self-center gap-1.5 px-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)]"
              aria-hidden
            >
              <Search size={14} strokeWidth={2} />
            </span>
            <span
              className="min-w-0 truncate text-[11px] font-normal text-[var(--color-text-muted)]"
              title="Untitled project"
            >
              Untitled project
            </span>
          </div>

          <div className="flex items-center justify-self-end">
            <div className="mock-tb-btn electron-titlebar-icon electron-titlebar-icon-active flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-accent)] transition-colors">
              <AgentIcon size={28} />
            </div>
          </div>
        </header>

        {/* Three-panel body — fixed height so left-rail content (scenes + layer stack) scrolls inside, like the real editor */}
        <div className="flex h-[460px] max-h-[460px] shrink-0 items-stretch overflow-hidden sm:h-[510px] sm:max-h-[510px] lg:h-[550px] lg:max-h-[550px]">
          <div className="relative z-[90] flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-panel)]">
            {/* min-h-0 + overflow so aspect preview cannot eat the transport/timeline stack */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg)] p-2">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                <div className="relative aspect-video h-auto max-h-full w-full max-w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] shadow-inner">
                <div
                  className="absolute inset-0 opacity-95"
                  style={{
                    background:
                      'linear-gradient(145deg, #1c2433 0%, #1a2230 38%, #161b26 72%, #12151c 100%)',
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
            </div>

            {/* Same stack as app: `PreviewPlayer` transportBar, then `Timeline` — above preview in paint order */}
            <div className="relative z-[2] flex shrink-0 flex-col overflow-visible">
              <HeroTransportBarMock />
              <div className="h-[160px] shrink-0 overflow-hidden">
                <HeroTimelineMock />
              </div>
            </div>
          </div>

          <aside className="flex h-full min-h-0 w-[340px] shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <HeroAgentPanelMock />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

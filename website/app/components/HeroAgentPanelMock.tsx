'use client'

import type { CSSProperties } from 'react'
import { Plus, MoreHorizontal, ChevronUp, Infinity, Mic, ThumbsUp, ThumbsDown } from 'lucide-react'

/** Same mark as `AgentChat` composer footer (idle state) — not the generic “brain” glyph. */
function SessionUsageIcon({ className }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.92377 10.2064C2.80976 10.7866 2.75 11.3863 2.75 12C2.75 12.2264 2.75814 12.451 2.77413 12.6733C2.79516 12.6904 2.81728 12.7083 2.84044 12.7268C3.06058 12.9028 3.37094 13.1369 3.73188 13.3698C4.4894 13.8584 5.33178 14.25 6 14.25C6.43561 14.25 6.9638 14.0813 7.51796 13.8023C7.85469 13.6327 8.17653 13.435 8.46068 13.2423C8.32421 12.8535 8.25 12.4354 8.25 12C8.25 9.92893 9.92893 8.25 12 8.25C14.0711 8.25 15.75 9.92893 15.75 12C15.75 12.7595 15.5242 13.4662 15.1361 14.0568C15.1836 14.0826 15.2334 14.1095 15.2856 14.1377C15.3054 14.1484 15.3255 14.1592 15.3459 14.1703C15.6383 14.3283 16.013 14.5325 16.3261 14.7866C16.9868 14.6782 17.6623 14.7793 18.216 15.1298C18.4093 14.7699 18.6888 14.4463 19.0327 14.1919C19.6351 13.7465 20.3998 13.5477 21.0993 13.6723C21.1983 13.1303 21.25 12.5715 21.25 12C21.25 11.5465 21.2174 11.1007 21.1543 10.6647L19.4953 12.1257C19.1845 12.3995 18.7106 12.3694 18.4368 12.0586C18.163 11.7477 18.1931 11.2738 18.504 11L20.182 9.52217C20.3764 9.351 20.6345 9.29861 20.8676 9.35938C20.6364 8.58192 20.3058 7.84726 19.8905 7.17018L19.5303 7.53033C19.2374 7.82322 18.7626 7.82322 18.4697 7.53033C18.1768 7.23744 18.1768 6.76256 18.4697 6.46967L18.9936 5.94571C17.2976 3.98821 14.7934 2.75 12 2.75C10.2299 2.75 8.57597 3.24718 7.17018 4.10952L7.53033 4.46967C7.82322 4.76256 7.82322 5.23744 7.53033 5.53033C7.23744 5.82322 6.76256 5.82322 6.46967 5.53033L5.94571 5.00637C4.94041 5.87741 4.12481 6.9616 3.56922 8.18863C3.97992 8.16934 4.33019 8.48475 4.3531 8.89609L4.43177 10.3081C4.45481 10.7217 4.13822 11.0756 3.72465 11.0987C3.31107 11.1217 2.95713 10.8051 2.93409 10.3916L2.92377 10.2064ZM14.7095 15.5316C14.6844 15.5179 14.6587 15.5039 14.6326 15.4898C14.5981 15.4712 14.5623 15.4519 14.5252 15.4321C14.3717 15.3497 14.1982 15.2567 14.0279 15.1549C13.4433 15.5315 12.7472 15.75 12 15.75C10.9043 15.75 9.91838 15.2801 9.23274 14.5308C8.92219 14.7382 8.56885 14.9526 8.19255 15.142C7.55133 15.4649 6.77639 15.75 6 15.75C4.98743 15.75 3.95347 15.2623 3.1792 14.7932C4.31219 18.3744 7.56585 21.013 11.4663 21.2349C11.4162 20.421 11.77 19.563 12.498 19.0246C12.8438 18.7689 13.2344 18.5971 13.6339 18.5182C13.3438 17.4575 13.8257 16.275 14.7095 15.5316ZM1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 13.0111 22.6102 13.9907 22.3484 14.9201C22.2792 15.1662 22.0893 15.36 21.8447 15.4343C21.6002 15.5087 21.3346 15.4534 21.14 15.2876C20.9259 15.105 20.4213 15.0306 19.9246 15.398C19.5124 15.7028 19.3792 16.1229 19.4251 16.3974C19.4651 16.6365 19.3871 16.8801 19.2157 17.0515L19.1143 17.153C18.9599 17.3073 18.746 17.3868 18.5283 17.3706C18.3106 17.3544 18.1107 17.2441 17.9809 17.0686L17.6465 16.6163C17.351 16.2168 16.5445 16.0321 15.7654 16.6083C14.9862 17.1845 14.9266 18.0097 15.2221 18.4092L15.4074 18.6598C15.6282 18.9583 15.5973 19.3735 15.3347 19.6361L15.1494 19.8213C14.9517 20.019 14.6605 20.0904 14.3938 20.0064C14.1352 19.9249 13.747 19.9665 13.3899 20.2306C12.9028 20.5909 12.8699 21.2389 13.103 21.554C13.2677 21.7768 13.2963 22.0721 13.1772 22.3222C13.0582 22.5724 12.811 22.7365 12.5343 22.7492C12.4074 22.755 12.2412 22.7528 12.1175 22.7512C12.0709 22.7505 12.0302 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 9.75C10.7574 9.75 9.75 10.7574 9.75 12C9.75 13.2426 10.7574 14.25 12 14.25C13.2426 14.25 14.25 13.2426 14.25 12C14.25 10.7574 13.2426 9.75 12 9.75Z"
      />
    </svg>
  )
}

/**
 * Static snapshot of `PromptTab` → `AgentChat` (electron layout: no in-panel tabs).
 * Matches layout, typography, and chrome from `components/AgentChat.tsx`.
 */
export function HeroAgentPanelMock() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[var(--color-bg)]">
      {/* Conversation tabs — AgentChat header */}
      <div className="flex flex-shrink-0 items-center bg-[var(--color-bg)] px-2 py-1">
        <div
          className="agent-mock-scrollbar-hide flex flex-1 items-center gap-0.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          <span
            className="chat-tab-mock relative flex-shrink-0 cursor-default overflow-hidden rounded px-2 py-1 text-[11px] whitespace-nowrap text-[var(--color-text-primary)] outline-none select-none transition-all"
            style={{
              maxWidth: 120,
              backgroundColor: 'var(--agent-chat-user-surface)',
              '--tab-bg': 'var(--agent-chat-user-surface)',
            } as CSSProperties}
          >
            <span
              className="inline-block overflow-hidden whitespace-nowrap align-bottom"
              style={{
                maxWidth: '90px',
                WebkitMaskImage: 'linear-gradient(to right, black 70px, transparent 90px)',
                maskImage: 'linear-gradient(to right, black 70px, transparent 90px)',
              }}
            >
              Scene 2 — Motion
            </span>
          </span>
        </div>
        <span
          className="ml-1 flex h-5 w-5 flex-shrink-0 cursor-default items-center justify-center rounded text-[var(--color-text-muted)] outline-none transition-all"
          aria-hidden
        >
          <Plus size={12} />
        </span>
        <div className="relative ml-1 mr-1 flex-shrink-0">
          <span className="flex h-6 w-6 cursor-default items-center justify-center rounded text-[var(--color-text-muted)] outline-none transition-all">
            <MoreHorizontal size={14} />
          </span>
        </div>
      </div>

      {/* Messages — full panel width (right rail; not a centered column) */}
      <div className="agent-mock-scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="w-full space-y-4">
          <div
            className="w-full rounded-lg px-3.5 py-2.5 text-sm leading-relaxed text-[var(--color-text-primary)]"
            style={{ backgroundColor: 'var(--agent-chat-user-surface)' }}
          >
            <span className="whitespace-pre-wrap break-words">
              Add a title card and animate the logo in.
            </span>
          </div>

          {/* Agent reply: no bubble — text sits on canvas, left-aligned */}
          <div className="relative flex w-full flex-col items-stretch space-y-2 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold" style={{ color: '#a855f7' }}>
                Director
              </span>
              <span className="rounded bg-[var(--color-panel)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                Sonnet 4.6
              </span>
            </div>
            <p className="w-full text-sm leading-relaxed break-words text-[var(--color-text-primary)]">
              On it — I&apos;ll add a Motion title card and ease the logo in on scene 2. One moment.
            </p>
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 pt-0.5" aria-hidden>
              <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-muted)] opacity-60">
                <span>1.2k in</span>
                <span className="opacity-40">/</span>
                <span>480 out</span>
                <span className="opacity-40">|</span>
                <span className="text-[var(--color-accent)]">$0.01</span>
              </div>
              <div className="flex gap-0.5 opacity-40">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)]">
                  <ThumbsUp size={14} strokeWidth={2} />
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)]">
                  <ThumbsDown size={14} strokeWidth={2} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Composer — AgentChat input area */}
      <div className="flex-shrink-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent px-3 pb-4 pt-8 sm:px-4">
        <div className="w-full">
          <div
            className="relative rounded-xl border border-[var(--color-border)] p-1 transition-all"
            style={{ backgroundColor: 'var(--agent-chat-user-surface)' }}
          >
            <textarea
              readOnly
              tabIndex={-1}
              rows={1}
              placeholder="Talk to Agent..."
              className="agent-mock-textarea scrollbar-hide w-full min-h-[44px] max-h-[200px] resize-none border-none bg-transparent px-4 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-0"
            />
            <div className="mt-1 flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center p-1"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-hidden
                >
                  <Plus size={14} strokeWidth={2.5} />
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="agent-mock-no-style box-border flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-transparent px-1.5 transition-all"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <span className="text-sm font-semibold leading-none">Auto</span>
                    <ChevronUp size={10} strokeWidth={2.5} className="ml-0.5 opacity-70" />
                  </div>
                  <div
                    className="agent-mock-no-style box-border flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-border)]/30 bg-[var(--color-bg)]/50 px-2.5 transition-all"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Infinity size={14} strokeWidth={2.5} />
                    <ChevronUp size={10} strokeWidth={2.5} className="translate-y-px opacity-70" />
                  </div>
                </div>
              </div>
              <div className="relative flex flex-shrink-0 items-center gap-2">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: '#2f2f2f',
                  }}
                  aria-hidden
                >
                  <Mic size={20} strokeWidth={2.25} style={{ color: '#9a9a9a', opacity: 0.9 }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5 px-1 text-[12px] text-[var(--color-text-muted)]">
            <SessionUsageIcon className="shrink-0 opacity-60" />
            <span className="opacity-60">$0.0000 session usage</span>
          </div>
        </div>
      </div>
    </div>
  )
}

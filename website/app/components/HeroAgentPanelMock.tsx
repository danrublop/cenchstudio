'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Mic,
  X,
  CheckCircle2,
  Check,
} from 'lucide-react'
import { CenchLogo as AgentAutoIcon } from '../../components/icons/CenchLogo'

/** `AgentChat` attach-image control (same paths as app). */
function AttachImageIcon() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.1935 16.793C20.8437 19.2739 20.6689 20.5143 19.7717 21.2572C18.8745 22 17.5512 22 14.9046 22H9.09536C6.44881 22 5.12553 22 4.22834 21.2572C3.33115 20.5143 3.15626 19.2739 2.80648 16.793L2.38351 13.793C1.93748 10.6294 1.71447 9.04765 2.66232 8.02383C3.61017 7 5.29758 7 8.67239 7H15.3276C18.7024 7 20.3898 7 21.3377 8.02383C22.0865 8.83268 22.1045 9.98979 21.8592 12" />
      <path d="M19.5617 7C19.7904 5.69523 18.7863 4.5 17.4617 4.5H6.53788C5.21323 4.5 4.20922 5.69523 4.43784 7" />
      <path d="M17.4999 4.5C17.5283 4.24092 17.5425 4.11135 17.5427 4.00435C17.545 2.98072 16.7739 2.12064 15.7561 2.01142C15.6497 2 15.5194 2 15.2588 2H8.74099C8.48035 2 8.35002 2 8.24362 2.01142C7.22584 2.12064 6.45481 2.98072 6.45704 4.00434C6.45727 4.11135 6.47146 4.2409 6.49983 4.5" />
      <circle cx="16.5" cy="11.5" r="1.5" />
      <path d="M19.9999 20L17.1157 17.8514C16.1856 17.1586 14.8004 17.0896 13.7766 17.6851L13.5098 17.8403C12.7984 18.2542 11.8304 18.1848 11.2156 17.6758L7.37738 14.4989C6.6113 13.8648 5.38245 13.8309 4.5671 14.4214L3.24316 15.3803" />
    </svg>
  )
}

/** Visual scale for the hero mock (aside is narrow; matches app density at ~85%). */
const HERO_AGENT_CHAT_SCALE = 0.85

const HERO_MODEL_MENU_W = 188

const HERO_MODEL_OPTIONS = [
  {
    id: 'auto',
    label: 'Auto',
    desc: 'Balanced — picks the best model per task',
  },
  { id: 'sonnet', label: 'Sonnet 4.6' },
  { id: 'opus', label: 'Opus 4.6' },
  { id: 'gpt', label: 'GPT-5.1' },
] as const

type HeroModelId = (typeof HERO_MODEL_OPTIONS)[number]['id']

/**
 * Static snapshot matching `components/AgentChat.tsx`: conversation tabs, centered
 * `max-w-2xl` message column, and composer (agent + model pills, attach, mic).
 */
export function HeroAgentPanelMock() {
  const [selectedModelId, setSelectedModelId] = useState<HeroModelId>('auto')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null)
  const modelMenuBtnRef = useRef<HTMLButtonElement>(null)
  const inv = 1 / HERO_AGENT_CHAT_SCALE
  const selectedModelLabel =
    HERO_MODEL_OPTIONS.find((o) => o.id === selectedModelId)?.label ?? 'Auto'

  useLayoutEffect(() => {
    if (!showModelMenu) {
      setMenuPos(null)
      return
    }
    const el = modelMenuBtnRef.current
    if (!el) return
    const sync = () => {
      const r = el.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - HERO_MODEL_MENU_W - 8))
      const bottom = window.innerHeight - r.top + 8
      setMenuPos({ left, bottom })
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [showModelMenu])
  return (
    <div className="relative h-full min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-hidden bg-[var(--color-bg)]">
      <div
        className="absolute top-0 left-1/2 flex min-h-0 min-w-0 flex-col bg-[var(--color-bg)]"
        style={{
          width: `${inv * 100}%`,
          height: `${inv * 100}%`,
          transform: `translateX(-50%) scale(${HERO_AGENT_CHAT_SCALE})`,
          transformOrigin: 'top center',
        }}
      >
      {/* Chat header — conversation tabs (`AgentChat`) */}
      <div className="flex flex-shrink-0 items-center bg-[var(--color-bg)] px-2 py-1">
        <div
          className="agent-mock-scrollbar-hide flex flex-1 items-center gap-0.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          <span
            className="chat-tab text-[var(--color-text-primary)] relative flex-shrink-0 cursor-default select-none overflow-hidden rounded-md bg-[var(--agent-chat-user-surface)] px-3 py-1.5 text-sm whitespace-nowrap outline-none transition-all"
            style={
              {
                maxWidth: 200,
                '--tab-bg': 'var(--agent-chat-user-surface)',
              } as CSSProperties
            }
          >
            <span
              className="inline-block overflow-hidden whitespace-nowrap align-bottom"
              style={{
                maxWidth: 140,
                WebkitMaskImage: 'linear-gradient(to right, black 110px, transparent 150px)',
                maskImage: 'linear-gradient(to right, black 110px, transparent 150px)',
              }}
            >
              Scene 2 — Motion
            </span>
            <span className="chat-tab-x pointer-events-none" aria-hidden>
              <X size={14} />
            </span>
          </span>
        </div>
        <span
          className="ml-1 flex h-8 w-8 flex-shrink-0 cursor-default items-center justify-center rounded text-[var(--color-text-muted)] outline-none transition-all"
          aria-hidden
        >
          <Plus size={20} />
        </span>
        <div className="relative ml-1 mr-1 flex-shrink-0">
          <span className="flex h-8 w-8 cursor-default items-center justify-center rounded text-[var(--color-text-muted)] outline-none transition-all">
            <MoreHorizontal size={20} />
          </span>
        </div>
      </div>

      {/* Messages — `mx-auto max-w-2xl` like `AgentChat` */}
      <div className="agent-mock-scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div
            className="w-full rounded-lg px-3.5 py-2.5 text-sm leading-relaxed text-[var(--color-text-primary)]"
            style={{ backgroundColor: 'var(--agent-chat-user-surface)' }}
          >
            <span className="whitespace-pre-wrap break-words">Add a title card and animate the logo in.</span>
          </div>

          <div className="relative flex w-full flex-col items-stretch space-y-2 text-left">
            {/* Agent activity trace (Cursor-style), not Auto/Balanced chips */}
            <div className="space-y-1 font-sans text-[12px] leading-snug">
              <div className="text-left">
                <span className="text-[var(--color-text-primary)]">Read </span>
                <span className="text-[var(--color-text-muted)]">scene-2-setup.md</span>
              </div>
              <div className="text-left">
                <span className="text-[var(--color-text-primary)]">Read </span>
                <span className="text-[var(--color-text-muted)]">project-style.json</span>
              </div>
              <div className="text-left">
                <span className="text-[var(--color-text-primary)]">Thought </span>
                <span className="text-[var(--color-text-muted)]">6s</span>
              </div>
            </div>
            <p className="w-full text-sm leading-relaxed break-words text-[var(--color-text-primary)]">
              On it — I&apos;ll add a Motion title card and ease the logo in on scene 2. One moment.
            </p>

            {/* Two tool calls — mirrors `ToolCallItem` collapsed row in `AgentChat` */}
            <div className="mt-2 space-y-1" aria-hidden>
              <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[12px]">
                <div className="flex w-full cursor-default items-center gap-2 px-2.5 py-1.5 text-left select-none">
                  <span className="flex-1 truncate font-mono text-[var(--color-text-primary)]">add_layer</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={10} aria-hidden />
                    <span className="text-[11px]">Done</span>
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">380ms</span>
                  <ChevronRight size={10} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[12px]">
                <div className="flex w-full cursor-default items-center gap-2 px-2.5 py-1.5 text-left select-none">
                  <span className="flex-1 truncate font-mono text-[var(--color-text-primary)]">patch_layer_code</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={10} aria-hidden />
                    <span className="text-[11px]">Done</span>
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">1.2s</span>
                  <ChevronRight size={10} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                </div>
              </div>
            </div>

            <p className="mt-2 w-full text-sm leading-relaxed break-words text-[var(--color-text-primary)]">
              Done — title card is in and the logo eases in over about 0.8s on scene 2. Say if you want different copy or
              timing.
            </p>
          </div>
        </div>
      </div>

      {/* Input area — `AgentChat` */}
      <div className="flex-shrink-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent p-4 pt-8">
        <div className="mx-auto w-full max-w-2xl">
          <div
            className="relative rounded-xl border border-[var(--color-border)] p-1 transition-all"
            style={{ backgroundColor: 'var(--agent-chat-user-surface)' }}
          >
            <textarea
              readOnly
              tabIndex={-1}
              rows={1}
              placeholder="Talk to Cench..."
              className="scrollbar-hide w-full min-h-0 max-h-[200px] resize-none border-none bg-transparent px-4 pt-2 pb-0 text-sm text-[var(--color-text-primary)] outline-none focus:ring-0"
            />
            <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-1">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    tabIndex={-1}
                    className="agent-mock-no-style box-border flex h-7 items-center gap-1 rounded-full border border-[var(--color-border)]/30 bg-[var(--color-bg)]/80 px-2.5 whitespace-nowrap transition-all"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <AgentAutoIcon size={18} className="shrink-0" />
                    <ChevronDown size={10} strokeWidth={2.5} className="opacity-70" />
                  </button>
                  {/* Model menu — parity with `AgentChat` model picker (`showModelMenu`) */}
                  <div className="relative">
                    <button
                      ref={modelMenuBtnRef}
                      type="button"
                      className="hero-mock-clickable no-style box-border flex h-7 max-w-[min(200px,42vw)] items-center gap-1 rounded-md border border-transparent px-1.5 transition-all"
                      style={{
                        color: showModelMenu ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      }}
                      aria-expanded={showModelMenu}
                      aria-haspopup="dialog"
                      aria-label={`Model: ${selectedModelLabel}`}
                      onClick={() => {
                        setShowModelMenu((o) => !o)
                      }}
                    >
                      <span className="truncate text-sm font-semibold leading-none">
                        {selectedModelLabel}
                      </span>
                      <ChevronDown size={10} strokeWidth={2.5} className="opacity-70" />
                    </button>
                    {showModelMenu &&
                      menuPos &&
                      typeof document !== 'undefined' &&
                      createPortal(
                        <>
                          <div
                            className="fixed inset-0 z-[9990]"
                            aria-hidden
                            onClick={() => setShowModelMenu(false)}
                          />
                          <div
                            className="hero-editor-mock fixed z-[10000] overflow-hidden rounded-xl shadow-2xl"
                            role="dialog"
                            aria-label="Model"
                            style={{
                              left: menuPos.left,
                              bottom: menuPos.bottom,
                              width: HERO_MODEL_MENU_W,
                              background: 'var(--color-panel)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <div className="p-1.5">
                              {HERO_MODEL_OPTIONS.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  className="hero-mock-clickable no-style flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                                  onClick={() => {
                                    setSelectedModelId(opt.id)
                                    setShowModelMenu(false)
                                  }}
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                                      {opt.label}
                                    </span>
                                    {'desc' in opt && opt.desc ? (
                                      <span className="mt-0.5 block text-[10px] leading-snug text-[var(--color-text-muted)]">
                                        {opt.desc}
                                      </span>
                                    ) : null}
                                  </span>
                                  {opt.id === selectedModelId ? (
                                    <Check
                                      size={14}
                                      strokeWidth={2}
                                      className="shrink-0 self-center text-[var(--color-accent)]"
                                      aria-hidden
                                    />
                                  ) : null}
                                </button>
                              ))}
                            </div>
                            <div className="border-t border-[var(--color-border)] p-1.5 pt-1">
                              <button
                                type="button"
                                className="hero-mock-clickable no-style flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                                onClick={() => setShowModelMenu(false)}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                                    Add Model
                                  </span>
                                  <span className="mt-0.5 block text-[10px] leading-snug text-[var(--color-text-muted)]">
                                    Connect API keys, Ollama, and choose which models appear here.
                                  </span>
                                </span>
                              </button>
                            </div>
                          </div>
                        </>,
                        document.body,
                      )}
                  </div>
                </div>
              </div>
              <div className="relative flex flex-shrink-0 items-center gap-1.5 text-[var(--color-text-muted)]">
                <span
                  className="flex cursor-default items-center justify-center"
                  style={{ width: 26, height: 26 }}
                  aria-hidden
                >
                  <AttachImageIcon />
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  className="agent-mock-no-style flex cursor-default items-center justify-center rounded-full"
                  style={{
                    width: 26,
                    height: 26,
                    backgroundColor: 'color-mix(in srgb, var(--color-text-muted) 28%, var(--color-bg))',
                    padding: 0,
                    color: 'var(--color-text-muted)',
                  }}
                  aria-hidden
                >
                  <Mic size={16} strokeWidth={2} className="opacity-90" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

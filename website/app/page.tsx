'use client'

import { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import Image from 'next/image'
import { TiltImage } from './components/TiltImage'
import { UseCasesScroll } from './components/UseCasesScroll'
import { HomeScrollAnimations } from './components/HomeScrollAnimations'
import { HeroClaudeTerminal } from './components/HeroClaudeTerminal'
import { HeroCodeCard } from './components/HeroCodeCard'
import { HeroDesktopAgentIcons, type HeroToolbarId } from './components/HeroDesktopAgentIcons'
import { HeroLibraryGrid } from './components/HeroLibraryGrid'
import { ebGaramond } from './fonts'
import { getHomeModelsList } from '../lib/home-models'

const homeModels = getHomeModelsList()

/* Shared toast state — single toast for all ComingSoon triggers */
let toastTimer: ReturnType<typeof setTimeout> | null = null
let setGlobalToast: ((v: boolean) => void) | null = null

function ComingSoonToast() {
  const [show, setShow] = useState(false)
  setGlobalToast = setShow
  return show ? (
    <div className="fixed bottom-6 left-1/2 z-[999] -translate-x-1/2 animate-[fadeInOut_1.8s_ease] rounded-lg bg-[#0a0a0b] px-5 py-3 text-[13px] font-medium text-white shadow-2xl">
      Coming soon
    </div>
  ) : null
}

function ComingSoon({ children, className }: { children: React.ReactNode; className?: string }) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (toastTimer) clearTimeout(toastTimer)
    setGlobalToast?.(true)
    toastTimer = setTimeout(() => setGlobalToast?.(false), 1800)
  }, [])
  return (
    <span className={`inline-block ${className ?? ''}`} onClick={handleClick} style={{ cursor: 'pointer' }}>
      {children}
    </span>
  )
}

const agents = [
  { name: 'Director', desc: 'Multi-scene planning and narrative arc.', color: '#a855f7' },
  { name: 'Scene Maker', desc: 'Creates and regenerates full scenes.', color: '#3b82f6' },
  { name: 'Editor', desc: 'Surgical edits to timing, copy, and layers.', color: '#22c55e' },
  { name: 'DoP', desc: 'Global look: palette, type, transitions.', color: '#f97316' },
  { name: 'Specialists', desc: 'SVG, Canvas2D, D3, Three.js, Motion.', color: '#64748b' },
]

const heroLogos = [
  { src: '/logos/elevenlabs.svg', alt: 'ElevenLabs' },
  { src: '/logos/heygen.svg', alt: 'HeyGen' },
  { src: '/logos/openai.svg', alt: 'OpenAI', size: 'lg' as const },
  { src: '/logos/gemini.png', alt: 'Google Gemini', size: 'xl' as const },
  { src: '/logos/fal.svg', alt: 'Fal' },
  { src: '/logos/claude.png', alt: 'Anthropic Claude', size: 'xl' as const },
  { src: '/logos/kling.svg', alt: 'Kling AI' },
] as const

/** `public/bettecc.png` — intrinsic size keeps layout 1:1 with asset (full width, no side letterboxing). */
const studioShowcaseImageWidth = 2812
const studioShowcaseImageHeight = 1582

function StudioShowcaseImage({ variant = 'hero' }: { variant?: 'hero' | 'footer' }) {
  const isFooter = variant === 'footer'
  const [heroPanel, setHeroPanel] = useState<'api' | 'claude' | 'library' | null>(null)

  useEffect(() => {
    if (isFooter || !heroPanel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeroPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFooter, heroPanel])

  const onToolbarActivate = useCallback((id: HeroToolbarId) => {
    if (id === 'cench') {
      setHeroPanel(null)
      return
    }
    if (id === 'library') {
      setHeroPanel((p) => (p === 'library' ? null : 'library'))
      return
    }
    setHeroPanel((p) => (p === id ? null : id))
  }, [])

  return (
    <div
      className={
        isFooter
          ? 'relative w-full overflow-hidden bg-gray-100'
          : /* overflow-visible so hero code card shadow is not clipped */
            'relative w-full overflow-visible bg-gray-100'
      }
      {...(!isFooter ? { 'data-parallax-wrap': '' } : {})}
    >
      <Image
        src="/bettecc.png"
        alt="Cench Studio"
        width={studioShowcaseImageWidth}
        height={studioShowcaseImageHeight}
        className={`h-auto w-full ${isFooter ? '' : 'home-parallax-img'}`}
        sizes="(max-width: 1152px) 100vw, 1152px"
      />
      {!isFooter && (
        <div className="absolute inset-0 z-[2]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
            }}
            aria-hidden
          />
          <HeroLibraryGrid open={heroPanel === 'library'} onClose={() => setHeroPanel(null)} />
          <HeroDesktopAgentIcons activePanel={heroPanel} onActivate={onToolbarActivate} />
          <div
            className={`relative z-[2] flex min-h-0 items-center justify-center px-[5%] py-[8%] sm:px-[6%] sm:py-[10%] ${
              heroPanel === 'api' || heroPanel === 'claude' ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            {heroPanel === 'api' ? <HeroCodeCard className="pointer-events-auto" /> : null}
            {heroPanel === 'claude' ? <HeroClaudeTerminal className="pointer-events-auto" /> : null}
          </div>
        </div>
      )}
    </div>
  )
}

function HeroLogoImg({
  src,
  alt,
  size,
}: {
  src: string
  alt: string
  size?: 'lg' | 'xl'
}) {
  const cls =
    size === 'xl'
      ? 'hero-logo-img h-11 w-auto max-h-11 max-w-[min(14rem,48vw)] object-contain object-center sm:h-[3.25rem] sm:max-h-[3.25rem] sm:max-w-[min(15rem,42vw)]'
      : size === 'lg'
        ? 'hero-logo-img h-9 w-auto max-h-9 max-w-[min(11.5rem,40vw)] object-contain object-center sm:h-10 sm:max-h-10 sm:max-w-[min(12.5rem,38vw)]'
        : 'hero-logo-img h-5 w-auto max-h-5 max-w-[min(5.5rem,22vw)] object-contain object-center sm:h-5 sm:max-h-5 sm:max-w-[min(6rem,20vw)]'
  return <img src={src} alt={alt} className={cls} loading="lazy" />
}

const headerNavLinkClass =
  'font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-[#0a0a0b] transition-opacity hover:opacity-70 sm:text-xs sm:tracking-[0.14em]'

const agentsModelsMdQuery = '(min-width: 768px)'

/** Inline with Models. title — assets in public/logos/models-title */
const modelsTitleLogos = [
  { src: '/logos/models-title/claude.svg', alt: 'Anthropic Claude' },
  { src: '/logos/models-title/gemini.svg', alt: 'Google Gemini' },
  { src: '/logos/models-title/openai.svg', alt: 'OpenAI' },
  { src: '/logos/models-title/fal.svg', alt: 'Fal' },
  { src: '/logos/models-title/heygen.svg', alt: 'HeyGen' },
  { src: '/logos/models-title/kling.png', alt: 'Kling AI' },
] as const

function AgentsModelsSection() {
  const agentsRef = useRef<HTMLDivElement>(null)
  const modelsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const agentsEl = agentsRef.current
    const modelsEl = modelsRef.current
    if (!agentsEl || !modelsEl) return

    const media = window.matchMedia(agentsModelsMdQuery)

    const syncHeights = () => {
      if (!media.matches) {
        modelsEl.style.height = ''
        return
      }
      modelsEl.style.height = `${agentsEl.offsetHeight}px`
    }

    syncHeights()
    const ro = new ResizeObserver(syncHeights)
    ro.observe(agentsEl)
    media.addEventListener('change', syncHeights)
    return () => {
      ro.disconnect()
      media.removeEventListener('change', syncHeights)
    }
  }, [])

  const cardClass =
    'border border-[#e0d9cc]/60 bg-[#e8e4db] px-7 py-8 sm:px-9 sm:py-10'

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8 md:items-start">
      <div ref={agentsRef} className={cardClass}>
        <h2 className="text-2xl font-bold text-[#0a0a0b] mb-1.5">Agents.</h2>
        <p className="text-neutral-500 text-sm mb-7">
          Five built-in agents orchestrate every video. Or bring your own via the open API.
        </p>
        <div className="flex flex-col">
          {agents.map((a) => (
            <div key={a.name} className="flex items-start gap-3 border-b border-[#d5cfc4]/60 py-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
              <div>
                <span className="text-sm font-semibold text-[#0a0a0b]">{a.name}</span>
                <span className="ml-2 text-sm text-neutral-500">{a.desc}</span>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3 py-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
            <div>
              <span className="text-sm font-semibold text-neutral-400">Your agent</span>
              <span className="ml-2 text-sm text-neutral-400">
                Connect any MCP-compatible agent via the open API.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div ref={modelsRef} className={`flex min-h-0 flex-col ${cardClass}`}>
        <div className="mb-1.5 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
          <h2 className="text-2xl font-bold text-[#0a0a0b]">Models.</h2>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-2.5 sm:justify-end">
            {modelsTitleLogos.map((logo) => (
              <img
                key={logo.src}
                src={logo.src}
                alt={logo.alt}
                className="h-5 w-auto max-h-5 object-contain opacity-90 sm:h-[1.375rem] sm:max-h-[1.375rem]"
                loading="lazy"
              />
            ))}
          </div>
        </div>
        <p className="shrink-0 text-neutral-500 text-sm mb-7">
          Same stack as the app: agent LLMs, video and image generation, avatars, TTS, SFX, and music.
        </p>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="models-list-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain pr-1 -mr-1">
            {homeModels.map((m) => (
              <div key={m.key} className="flex items-center justify-between border-b border-[#d5cfc4]/60 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#0a0a0b]/20" />
                  <span className="text-sm font-semibold text-[#0a0a0b] truncate">{m.name}</span>
                </div>
                <span className="text-xs text-neutral-500 shrink-0 pl-2">{m.tag}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
                <span className="text-sm font-semibold text-neutral-400">Any OpenAI-compatible endpoint</span>
              </div>
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-14 bg-linear-to-t from-[#e8e4db] via-[#e8e4db]/70 to-transparent"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}

export default function Home() {

  return (
    <div className="min-h-screen bg-bone">
      <HomeScrollAnimations />
      <ComingSoonToast />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bone/80 backdrop-blur-sm transition-[box-shadow] duration-200">
        <div className="max-w-6xl mx-auto px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            <a href="/" className="shrink-0 transition-opacity hover:opacity-70">
              <Image src="/blacklogo.png" alt="Cench" width={40} height={40} />
            </a>
            <nav className="hidden sm:flex items-center gap-8">
              <a href="#animations" className={headerNavLinkClass}>
                Animations
              </a>
              <a href="#agents" className={headerNavLinkClass}>
                Agents
              </a>
              <a href="/docs" className={headerNavLinkClass}>
                Docs
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ComingSoon>
              <span className={headerNavLinkClass}>Sign up</span>
            </ComingSoon>
            <ComingSoon>
              <span className="button-59">
                <span className="button-59__text">Get started</span>
              </span>
            </ComingSoon>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8">
        {/* Hero */}
        <section className="pt-10 pb-16 sm:pt-12 sm:pb-20" data-sr-hero-section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div data-sr-hero>
              <h1
                className={`${ebGaramond.className} text-5xl font-bold tracking-tight leading-[1.08] sm:text-6xl sm:leading-[1.05]`}
              >
                Create videos<br />with prompts.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-gray-500 sm:mt-5 sm:text-base">
                AI-powered animated video creation. From prompt to MP4, powered by agents.
              </p>
            </div>
            <div className="flex justify-center lg:justify-end" data-sr-hero>
              <TiltImage src="/cenchdisk.png" alt="Cench" />
            </div>
          </div>
          <div
            className="mt-8 flex w-full flex-col gap-6 sm:mt-10 sm:flex-row sm:items-center sm:gap-8 lg:gap-12"
            data-sr-hero
          >
            <p className="shrink-0 text-[12px] leading-snug tracking-tight text-neutral-400 sm:max-w-[9rem] lg:text-[13px] lg:leading-tight">
              <span className="block font-medium">Powered by the best</span>
              <span className="block font-medium">models.</span>
            </p>
            <div className="logo-marquee min-w-0 flex-1 py-0">
              <span className="logo-marquee__fade logo-marquee__fade--left" aria-hidden />
              <span className="logo-marquee__fade logo-marquee__fade--right" aria-hidden />
              <div className="logo-marquee__track">
                {[0, 1].map((dup) => (
                  <div
                    key={dup}
                    className="logo-marquee__segment flex shrink-0 items-center gap-x-10 sm:gap-x-14 lg:gap-x-16"
                    aria-hidden={dup === 1 ? true : undefined}
                  >
                    {heroLogos.map((logo) => (
                      <div key={`${dup}-${logo.src}`} className="flex shrink-0 items-center justify-center">
                        <HeroLogoImg
                          src={logo.src}
                          alt={dup === 0 ? logo.alt : ''}
                          size={'size' in logo ? logo.size : undefined}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8 w-full sm:mt-10" data-sr-hero>
            <StudioShowcaseImage />
          </div>
        </section>

        {/* Use it your way */}
        <UseCasesScroll />

        {/* Agents & Models */}
        <section id="agents" className="py-24 scroll-mt-24" data-sr>
          <AgentsModelsSection />
        </section>
      </main>

      {/* CTA + footer */}
      <div className="bg-bone text-[#0a0a0b]">
        <section id="get-started" className="max-w-6xl mx-auto px-8 pb-12">
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <a
              href="https://github.com"
              className="flex items-center justify-between border border-[#e0d9cc]/60 bg-[#e8e4db] px-7 py-8 transition-colors hover:bg-[#e2ded4] sm:px-9 sm:py-10"
              data-sr
            >
              <div>
                <h2 className="text-2xl font-bold text-[#0a0a0b] mb-1.5">GitHub.</h2>
                <p className="text-neutral-500 text-sm">API docs, integrations, and collaboration.</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-[#0a0a0b]/70" fill="currentColor" aria-hidden>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <a
              href="#"
              className="flex items-center justify-between border border-[#e0d9cc]/60 bg-[#e8e4db] px-7 py-8 transition-colors hover:bg-[#e2ded4] sm:px-9 sm:py-10"
              data-sr
            >
              <div>
                <h2 className="text-2xl font-bold text-[#0a0a0b] mb-1.5">Download.</h2>
                <p className="text-neutral-500 text-sm">Get the latest release for macOS and Windows.</p>
              </div>
              <div className="flex shrink-0 items-center gap-4" aria-hidden>
                {/* macOS */}
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#0a0a0b]/70" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                {/* Windows */}
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#0a0a0b]/70" fill="currentColor">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
              </div>
            </a>
          </div>
        </section>

        <footer className="text-[#0a0a0b]">
          <div className="max-w-6xl mx-auto px-8 pt-10 pb-6 sm:pt-14">
          {/* Top tier */}
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-3 sm:gap-6" data-sr>
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <Image src="/blacklogo.png" alt="Cench" width={28} height={28} />
              <span className="text-lg font-semibold tracking-tight">Cench</span>
            </div>
            <nav
              className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#0a0a0b]/75 sm:gap-x-10"
              aria-label="Footer"
            >
              <a href="/docs" className="hover:text-[#0a0a0b] transition-colors">
                Docs
              </a>
              <ComingSoon>
                <span className="hover:text-[#0a0a0b] transition-colors">GitHub</span>
              </ComingSoon>
              <ComingSoon>
                <span className="hover:text-[#0a0a0b] transition-colors">Email us</span>
              </ComingSoon>
            </nav>
            <div className="flex items-center justify-center gap-5 sm:justify-end">
              <ComingSoon>
                <span className="text-[#0a0a0b]/70 hover:text-[#0a0a0b] transition-colors">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </span>
              </ComingSoon>
              <ComingSoon>
                <span className="text-[#0a0a0b]/70 hover:text-[#0a0a0b] transition-colors">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </span>
              </ComingSoon>
            </div>
          </div>

          <div className="my-8 h-px bg-[#0a0a0b]/10" aria-hidden />

          {/* Bottom tier */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-sr>
            <p className="text-sm text-[#0a0a0b]/55">Copyright &copy; 2026 Cench</p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-[#0a0a0b]/55">
              <ComingSoon>
                <span className="hover:text-[#0a0a0b] transition-colors">Status</span>
              </ComingSoon>
              <ComingSoon>
                <span className="hover:text-[#0a0a0b] transition-colors">Terms of Use</span>
              </ComingSoon>
              <ComingSoon>
                <span className="hover:text-[#0a0a0b] transition-colors">Privacy Policy</span>
              </ComingSoon>
            </div>
          </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

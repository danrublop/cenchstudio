'use client'

import { useState, useCallback, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import { Box, ChevronDown, Globe, MousePointerClick, Sparkles, Volume2 } from 'lucide-react'
import { HomeScrollAnimations } from './components/HomeScrollAnimations'
import { ebGaramond, sairaStencil } from './fonts'
import { getHomeModelsList } from '../lib/home-models'
import { CenchLogo } from '../../components/icons/CenchLogo'

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
  {
    name: 'Main agent',
    desc: 'One agent builds the whole project, backed by a massive library of skills.',
    color: '#a855f7',
  },
  {
    name: 'Explainer',
    desc: 'Specialized for explainer videos—motion, type, cards, and step-by-step story.',
    color: '#3b82f6',
  },
  {
    name: '3D',
    desc: 'Specialized for 3D videos—depth, cameras, and Three.js-style scenes.',
    color: '#f97316',
  },
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

const trustLogos = [
  { src: '/logos/openai.svg', alt: 'OpenAI' },
  { src: '/logos/gemini.png', alt: 'Google Gemini' },
  { src: '/logos/claude.png', alt: 'Anthropic Claude' },
  { src: '/logos/elevenlabs.svg', alt: 'ElevenLabs' },
  { src: '/logos/heygen.svg', alt: 'HeyGen' },
  { src: '/logos/kling.svg', alt: 'Kling' },
  { src: '/logos/fal.svg', alt: 'Fal' },
] as const

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

function ReactAtomIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
    </svg>
  )
}

function HeroPromptInputMock() {
  const [promptText, setPromptText] = useState('')
  return (
    <div className="mx-auto mt-5 w-full max-w-3xl px-2 sm:mt-6" data-sr-hero>
      <div className="hero-prompt-input">
        <div className="hero-prompt-content">
          <textarea
            className="hero-prompt-typed"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={2}
            placeholder="Create a 45-second launch video for Cench Studio: bold intro, 3 feature beats, clean 3D motion, and a final CTA to start free."
          />
        </div>
        <div className="hero-prompt-toolbar" aria-hidden>
          <div className="hero-prompt-toolbar-left">
            <button type="button" className="hero-pill-btn">
              <CenchLogo size={15} />
              <span>Agent</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="hero-pill-btn hero-pill-btn--ghost">
              <span>Auto</span>
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="hero-prompt-toolbar-right">
            <span className="hero-media-attach" aria-label="Attach media">
              <AttachImageIcon />
            </span>
            <button type="button" className="hero-send-btn" aria-label="Create for free">
              Create for free
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroWordFlowLoop() {
  const terminalBlock = [
    "console.log('final_video.mp4', out.path)",
    '  _____  ______ _   _  _____ _    _ ',
    ' / ____||  ____| \\ | |/ ____| |  | |',
    "| |     | |__  |  \\| | |    | |__| |",
    "| |     |  __| | . ` | |    |  __  |",
    '| |____ | |____| |\\  | |____| |  | |',
    ' \\_____||______|_| \\_|\\_____|_|  |_|',
    '[====================] 100%',
    '✓ export complete: final_video.mp4',
  ] as const
  const renderStaticLine = (line: string) => {
    if (line.startsWith('console.log')) {
      const parts = line.match(/'[^']*'|\bconsole\b|\blog\b|[A-Za-z_]\w*(?=\()|./g) ?? [line]
      return parts.map((token, i) => {
        if (/^'[^']*'$/.test(token)) {
          return (
            <span key={`${token}-${i}`} className="hero-code-str">
              {token}
            </span>
          )
        }
        if (/^(console|log)$/.test(token)) {
          return (
            <span key={`${token}-${i}`} className="hero-code-fn">
              {token}
            </span>
          )
        }
        return (
          <span key={`${token}-${i}`} className="hero-code-dim">
            {token}
          </span>
        )
      })
    }
    if (line.startsWith('✓')) return <span className="hero-code-accent">{line}</span>
    if (line.startsWith('[')) return <span className="hero-code-accent">{line}</span>
    if (/^[\s_|/\\-]+$/.test(line)) return <span className="hero-code-accent">{line}</span>
    return <span className="hero-code-terminal">{line}</span>
  }

  return (
    <div className="relative z-20 mt-8 w-full sm:mt-10" data-sr-hero>
      <HeroPromptInputMock />
      <div className="hero-build-seq mx-auto w-full max-w-3xl px-2">
        <div className="hero-scene-row" aria-hidden>
          {[
            { label: 'React', icon: <ReactAtomIcon /> },
            { label: '3D', icon: <Box size={14} strokeWidth={1.9} /> },
            { label: 'Interactive', icon: <MousePointerClick size={14} strokeWidth={1.9} /> },
            { label: 'Animations', icon: <Sparkles size={14} strokeWidth={1.9} /> },
            { label: 'Audio', icon: <Volume2 size={14} strokeWidth={1.9} /> },
          ].map((item) => (
            <div key={item.label} className="hero-scene-card hero-scene-card--visible">
              <div className="hero-scene-thumb" />
              <div className="hero-scene-title">
                <span>{item.label}</span>
                <span className="hero-scene-title-icon">{item.icon}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hero-build-script hero-build-script--visible">
          <div className="hero-code-stage">
            <pre className="hero-code-pre hero-code-pre--viewport">
              <code className="hero-code-scroll">
                {terminalBlock.map((line, i) => (
                  <span className="hero-code-line" key={`${i}-${line}`}>
                    {renderStaticLine(line)}
                  </span>
                ))}
              </code>
            </pre>
          </div>
          <span className="hero-build-fade" aria-hidden />
        </div>
      </div>
    </div>
  )
}

/** Centered column + horizontal inset that grows on large viewports */
const homePageShellClass =
  'mx-auto w-full max-w-screen-2xl px-12 sm:px-16 md:px-20 lg:px-28 xl:px-36 2xl:px-44'

/** Header: same max-width and right inset as shell; slightly tighter left so logo sits closer to edge */
const homeHeaderShellClass =
  'mx-auto w-full max-w-screen-2xl pl-12 pr-12 sm:pl-14 sm:pr-16 md:pl-18 md:pr-20 lg:pl-28 lg:pr-28 xl:pl-32 xl:pr-36 2xl:pl-40 2xl:pr-44'

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
          The product starts with one agent that can build everything, plus a deep skill library. Explainer and 3D agents
          focus those workflows; add custom agents whenever you want a different style or pipeline.
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
              <span className="text-sm font-semibold text-neutral-400">Custom agents</span>
              <span className="ml-2 text-sm text-neutral-400">
                Create your own agents for the style, brand voice, and workflow you want.
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

function FlowingCodeBackground() {
  const lines = [
    'const scene = generateScene({ style: "clean", pace: "fast" })',
    'await refine({ note: "tighten transitions, boost contrast" })',
    'const media = upload(["brand.mp4", "voiceover.wav"])',
    'exportMp4({ timeline, audio: mix, fps: 30 })',
  ] as const
  return (
    <div className="code-flow-bg" aria-hidden>
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <path id="flow-path-1" d="M -320 210 C 120 40, 420 90, 760 260 S 1380 430, 1760 230 S 2460 120, 2920 260" />
          <path id="flow-path-2" d="M -340 560 C 80 640, 420 500, 760 560 S 1380 660, 1760 540 S 2460 430, 3000 520" />
          <path id="flow-path-3" d="M -300 880 C 180 700, 560 980, 920 860 S 1520 700, 1960 900 S 2580 1040, 3040 820" />
        </defs>

        {[0, 1, 2].map((row) => {
          const segment = `${lines[row]} · ${lines[(row + 1) % lines.length]} · ${lines[(row + 2) % lines.length]}`
          const repeated = Array.from({ length: 8 }, () => segment).join(' · ')
          const dur = `${30 + row * 4}s`
          return (
            <text key={row} className={`code-flow-text code-flow-text--${row + 1}`}>
              <textPath href={`#flow-path-${row + 1}`} startOffset="0%" method="align" spacing="auto">
                {repeated}
                <animate
                  attributeName="startOffset"
                  from="0"
                  by="-2200"
                  dur={dur}
                  calcMode="linear"
                  begin={`${-row * 3}s`}
                  additive="sum"
                  accumulate="sum"
                  repeatCount="indefinite"
                />
              </textPath>
            </text>
          )
        })}
      </svg>
    </div>
  )
}

export default function Home() {

  return (
    <div className="min-h-screen w-full bg-bone">
      <HomeScrollAnimations />
      <ComingSoonToast />
      <header className="sticky top-0 z-50 border-b border-[#0a0a0b]/10 bg-bone">
        <div className={`relative flex items-center justify-between py-2.5 ${homeHeaderShellClass}`}>
          <span className="pointer-events-none absolute inset-y-0 left-12 w-px bg-[#0a0a0b]/10 sm:left-16 md:left-20 lg:left-28 xl:left-36 2xl:left-44" />
          <span className="pointer-events-none absolute inset-y-0 right-12 w-px bg-[#0a0a0b]/10 sm:right-16 md:right-20 lg:right-28 xl:right-36 2xl:right-44" />
          <a
            href="/"
            className="relative z-10 flex shrink-0 items-center gap-0 transition-opacity hover:opacity-70 group"
          >
            <Image src="/cench2.0.svg" alt="Cench" width={46} height={46} className="shrink-0" />
            <span
              className={`${sairaStencil.className} text-[24px] font-semibold tracking-tight text-[#0a0a0b] uppercase ml-[-4px] leading-none`}
            >
              Cench
            </span>
          </a>
          <nav
            className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-7 md:flex"
            aria-label="Primary"
          >
            <a
              href="#animations"
              className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-[#0a0a0b] transition-colors"
            >
              Animations
            </a>
            <a
              href="/docs"
              className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-[#0a0a0b] transition-colors"
            >
              Docs
            </a>
          </nav>
          <div className="relative z-10 flex shrink-0 items-center gap-2.5 sm:gap-3">
            <ComingSoon>
              <span
                className="inline-flex h-7 cursor-pointer select-none items-center justify-center rounded-full border border-[#0a0a0b]/22 bg-transparent px-4 text-[11px] font-semibold leading-none text-[#0a0a0b] transition-[border-color,background-color] hover:border-[#0a0a0b]/40 hover:bg-[#0a0a0b]/[0.04] sm:px-5 sm:text-[12px]"
              >
                Book a demo
              </span>
            </ComingSoon>
            <ComingSoon>
              <span className="inline-flex h-7 cursor-pointer select-none items-center justify-center rounded-full border border-[#0a0a0b] bg-[#0a0a0b] px-4 text-[11px] font-semibold leading-none text-white transition-colors hover:bg-[#252528] sm:px-5 sm:text-[12px]">
                Waitlist
              </span>
            </ComingSoon>
          </div>
        </div>
      </header>

      <main className={`relative ${homePageShellClass}`}>
        <span className="pointer-events-none absolute inset-y-0 left-12 w-px bg-[#0a0a0b]/10 sm:left-16 md:left-20 lg:left-28 xl:left-36 2xl:left-44" />
        <span className="pointer-events-none absolute inset-y-0 right-12 w-px bg-[#0a0a0b]/10 sm:right-16 md:right-20 lg:right-28 xl:right-36 2xl:right-44" />
        {/* Hero */}
        <section
          id="animations"
          className="relative overflow-hidden pt-10 pb-16 scroll-mt-24 sm:pt-12 sm:pb-20"
          data-sr-hero-section
        >
          <FlowingCodeBackground />
          <div className="relative z-10" data-sr-hero>
            <h1
              className={`${ebGaramond.className} text-center text-[3rem] font-semibold leading-[1.05] tracking-tight text-[#0a0a0b] sm:text-[3.9rem] lg:text-[5rem]`}
            >
              From prompt <span className="text-[#7b7b78]">to MP4.</span>
            </h1>
          </div>
          <div className="relative z-10">
            <HeroWordFlowLoop />
          </div>
        </section>

        <section id="workflow-cards" className="pb-14 sm:pb-18" data-sr>
          <div className="mx-auto max-w-6xl grid gap-y-12 md:grid-cols-2 md:gap-x-14">
            {[
              {
                title: 'Describe it. Get it.',
                desc: 'Write your idea in plain language and Cench turns it into a full first cut.',
                align: 'left',
              },
              {
                title: 'Make it yours.',
                desc: 'Refine pacing, visuals, copy, and media until it matches your style and brand.',
                align: 'right',
              },
              {
                title: 'Post it.',
                desc: 'Export MP4, embed on your website, or share with a custom link.',
                align: 'left',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`${item.align === 'right' ? 'md:col-start-2' : 'md:col-start-1'} ${i === 1 ? 'md:translate-y-10' : ''}`}
              >
                <div className="w-full">
                  <h3 className={`${ebGaramond.className} mb-2 text-[2rem] leading-tight text-[#0a0a0b] sm:text-[2.4rem]`}>
                    {item.title}
                  </h3>
                  <p className="mb-2 text-sm leading-relaxed text-[#0a0a0b]/62 sm:text-[15px]">{item.desc}</p>
                  <div className="rounded-[1.75rem] border border-[#d9d4c4] bg-[#f4f1de] px-6 py-6 sm:px-8 sm:py-7">
                    {item.title === 'Describe it. Get it.' ? (
                      <div className="rounded-xl border border-[#d5d0bf] bg-[#ffffeb] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-md bg-[#fff4ad] px-2 py-1 text-[11px] font-semibold text-[#3b351b]">Idea board</span>
                          <span className="text-[11px] text-[#0a0a0b]/45">v1 notes</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-[#fff4ad] p-2.5 text-[11px] leading-snug text-[#3b351b]">
                            Hook: “From prompt to MP4”
                          </div>
                          <div className="rounded-lg bg-[#ffd9c2] p-2.5 text-[11px] leading-snug text-[#4a2b1f]">
                            Keep pacing under 45s
                          </div>
                          <div className="h-16 rounded-lg border border-[#cdc8b8] bg-[linear-gradient(135deg,#ece8d8,#d7d1bf)]" />
                          <div className="rounded-lg border border-dashed border-[#b7b09d] p-2.5 text-[11px] leading-snug text-[#5d5645]">
                            Sketch: scene flow + transition arrows
                          </div>
                        </div>
                      </div>
                    ) : item.title === 'Make it yours.' ? (
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            logo: 'brightness(0) saturate(100%) invert(17%) sepia(92%) saturate(1976%) hue-rotate(210deg) brightness(95%) contrast(98%)',
                            bg: 'linear-gradient(145deg,#e6eefb,#c8dbfb)',
                            tag: 'Clean cinematic',
                            title: 'Cench Studio',
                            line: 'From prompt to polished MP4',
                            titleClass: `${ebGaramond.className} text-[18px] font-semibold tracking-tight text-[#173f7a]`,
                            lineClass: 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2458a6]',
                          },
                          {
                            logo: 'brightness(0) saturate(100%) invert(37%) sepia(81%) saturate(1189%) hue-rotate(123deg) brightness(95%) contrast(95%)',
                            bg: 'linear-gradient(145deg,#dcf8ee,#bfead8)',
                            id: 'neon',
                            title: 'Cench Neon',
                            line: 'Fast cuts. Bold motion. Clear story.',
                            titleClass: `${sairaStencil.className} text-[16px] font-semibold uppercase tracking-wide text-[#0e6a48]`,
                            lineClass: 'text-[11px] font-semibold text-[#1f7f59]',
                            multiLogo: true,
                          },
                          {
                            logo: 'brightness(0) saturate(100%) invert(16%) sepia(11%) saturate(603%) hue-rotate(335deg) brightness(91%) contrast(86%)',
                            bg: 'linear-gradient(145deg,#ebe9e4,#d5d2c9)',
                            id: 'editorial',
                            title: 'Cench Editorial',
                            line: 'Designed for sharp brand explainers',
                            titleClass: `${ebGaramond.className} text-[17px] font-semibold tracking-tight text-[#3f3c35]`,
                            lineClass: 'text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e584d]',
                          },
                          {
                            logo: 'brightness(0) saturate(100%) invert(37%) sepia(66%) saturate(805%) hue-rotate(306deg) brightness(95%) contrast(98%)',
                            bg: 'linear-gradient(145deg,#f8e3ed,#f3cddf)',
                            id: 'pastel',
                            title: 'Cench Creators',
                            line: 'Your vision. Your voice. Your style.',
                            titleClass: `${ebGaramond.className} text-[17px] font-semibold tracking-tight text-[#8a2e62]`,
                            lineClass: 'text-[11px] font-semibold text-[#a24178]',
                          },
                        ].map((frame) => (
                          <div key={frame.id} className="rounded-lg border border-[#d5d0bf] bg-[#ffffeb] p-2">
                            <div
                              className="aspect-video rounded-md border border-[#cec9b9] px-3 py-2.5 flex flex-col items-center justify-center text-center"
                              style={{ background: frame.bg }}
                            >
                              {frame.multiLogo ? (
                                <>
                                  <p className={`leading-none ${frame.titleClass}`}>{frame.title}</p>
                                  <div className="mt-2 flex items-center justify-center gap-2">
                                    {[0, 1, 2].map((logoIdx) => (
                                      <img
                                        key={logoIdx}
                                        src="/cench2.0.svg"
                                        alt="Cench logo"
                                        className="h-9 w-auto"
                                        style={{ filter: frame.logo }}
                                        loading="lazy"
                                      />
                                    ))}
                                  </div>
                                  <p className={`mt-2 leading-tight ${frame.lineClass}`}>{frame.line}</p>
                                </>
                              ) : (
                                <>
                                  <img
                                    src="/cench2.0.svg"
                                    alt="Cench logo"
                                    className="h-12 w-auto"
                                    style={{ filter: frame.logo }}
                                    loading="lazy"
                                  />
                                  <p className={`mt-2 leading-none ${frame.titleClass}`}>{frame.title}</p>
                                  <p className={`mt-1 leading-tight ${frame.lineClass}`}>{frame.line}</p>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : item.title === 'Post it.' ? (
                      <div className="relative px-2 py-2 sm:px-3">
                        <div className="mx-auto flex w-full max-w-[420px] flex-col items-center">
                          <Image src="/mp4.png" alt="MP4" width={58} height={58} className="relative z-10 h-[58px] w-auto rounded-md" />

                          <svg
                            viewBox="0 0 420 210"
                            className="-mt-1 h-[210px] w-full"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                          >
                            <path d="M210 12 L210 62" stroke="#171717" strokeWidth="3.5" strokeLinecap="round" />
                            <path d="M210 62 C190 102 122 108 72 132" stroke="#171717" strokeWidth="3.5" strokeLinecap="round" />
                            <path d="M210 62 L210 132" stroke="#171717" strokeWidth="3.5" strokeLinecap="round" />
                            <path d="M210 62 C230 102 298 108 348 132" stroke="#171717" strokeWidth="3.5" strokeLinecap="round" />
                          </svg>

                          <div className="-mt-[110px] grid w-full grid-cols-3 gap-3">
                            {[
                              { label: 'Instagram', src: '/instagram-liquid.png' },
                              { label: 'YouTube', src: '/youtube-liquid.png' },
                              { label: 'Website', icon: <Globe className="h-5 w-5 text-[#e8e4cf]" strokeWidth={2.1} /> },
                            ].map((platform) => (
                              <div key={platform.label} className="flex flex-col items-center">
                                <div className="flex h-14 w-14 items-center justify-center">
                                  {platform.src ? (
                                    <Image src={platform.src} alt={platform.label} width={48} height={48} className="h-12 w-12" />
                                  ) : (
                                    platform.icon
                                  )}
                                </div>
                                <p className="mt-2 text-center text-[12px] font-semibold tracking-tight text-[#e8e4cf]">{platform.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-[#0a0a0b]/68 sm:text-[15px]">{item.desc}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* CTA + footer */}
      <div className="relative bg-bone text-[#0a0a0b]">
        <span className="pointer-events-none absolute inset-y-0 left-12 w-px bg-[#0a0a0b]/10 sm:left-16 md:left-20 lg:left-28 xl:left-36 2xl:left-44" />
        <span className="pointer-events-none absolute inset-y-0 right-12 w-px bg-[#0a0a0b]/10 sm:right-16 md:right-20 lg:right-28 xl:right-36 2xl:right-44" />
        <section id="get-started" className={`${homePageShellClass} pb-12`}>
          <a
            href="https://github.com"
            className="flex w-full items-center justify-between border border-[#e0d9cc]/60 bg-[#e8e4db] px-7 py-8 transition-colors hover:bg-[#e2ded4] sm:px-9 sm:py-10"
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
        </section>

        <footer className="text-[#0a0a0b]">
          <div className={`${homePageShellClass} pt-10 pb-6 sm:pt-14`}>
          {/* Top tier */}
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-3 sm:gap-6" data-sr>
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <Image src="/cench2.0.svg" alt="Cench" width={32} height={32} />
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

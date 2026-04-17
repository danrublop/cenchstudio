'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { Box, ChevronDown, Image as ImageIcon, MousePointerClick, Sparkles, Volume2 } from 'lucide-react'
import { HomeScrollAnimations } from './components/HomeScrollAnimations'
import { ebGaramond, sairaStencil } from './fonts'
import { CenchLogo } from '../components/icons/CenchLogo'

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

const animationTypeItems = [
  { title: 'Charts', line: 'Animated axes, series, and chart storytelling beats', ratio: '16:9' },
  { title: 'Data', line: 'KPIs, tables, and live numbers on the canvas', ratio: '9:16' },
  { title: 'Avatar', line: 'Talking presenters, hosts, and lip-sync takes', ratio: '4:3' },
  { title: 'SFX', line: 'Hits, whooshes, UI ticks, and scene punctuation', ratio: '1:1' },
  { title: 'Music', line: 'Beds, stingers, and scored mood under the edit', ratio: '4:5' },
  { title: 'TTS', line: 'Voiceover from script with pacing and emphasis', ratio: '21:9' },
  { title: 'Media Gen', line: 'AI images, clips, and generated b-roll in the flow', ratio: '3:2' },
  { title: 'Tutoring', line: 'Lesson steps, hints, and guided practice beats', ratio: '2:3' },
  { title: 'Research', line: 'Citations, quotes, and source-forward callouts', ratio: '5:4' },
  { title: 'Docs', line: 'Specs, references, and slide-friendly structured copy', ratio: '16:10' },
  { title: 'Text', line: 'Titles, bullets, captions, and on-screen typography', ratio: '3:4' },
] as const

function AnimationTypeMarqueeTrack({ reverse }: { reverse?: boolean }) {
  const rowId = reverse ? 'b' : 'a'
  return (
    <div
      className={`animation-type-marquee__track${reverse ? ' animation-type-marquee__track--reverse' : ''}`}
    >
      {([0, 1] as const).map((dup) => (
        <div
          key={`${rowId}-${dup}`}
          className="animation-type-marquee__segment shrink-0"
          {...(dup === 1 ? { 'aria-hidden': true as const } : {})}
        >
          {animationTypeItems.map((item) => (
            <article
              key={`${item.title}-${rowId}-${dup}`}
              className="group w-[6.5rem] shrink-0 overflow-hidden border border-[#e6e4df] bg-white shadow-[0_1px_0_rgba(10,10,11,0.04)] transition-[border-color,box-shadow] sm:w-28 md:w-[7.25rem] hover:border-[#0a0a0b]/14 hover:shadow-[0_6px_24px_-8px_rgba(10,10,11,0.1)]"
            >
              <div className="relative aspect-square min-h-0 bg-white">
                <div
                  className="absolute inset-1.5 border border-dashed border-[#0a0a0b]/14 bg-[#f0eeea]/95"
                  aria-hidden
                />
                <div className="relative flex h-full items-center justify-center text-[#0a0a0b]/22">
                  <ImageIcon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.2} aria-hidden />
                </div>
                <span className="pointer-events-none absolute bottom-0.5 left-0.5 text-[7px] font-medium tabular-nums tracking-wide text-[#0a0a0b]/45 sm:bottom-1 sm:left-1 sm:text-[8px]">
                  {item.ratio}
                </span>
              </div>
              <div className="flex h-[2.25rem] min-h-[2.25rem] items-center border-t border-[#e0dcd4] bg-[#f0eeea] px-1.5 text-left sm:h-9 sm:min-h-9 sm:px-2">
                <p className="min-w-0 truncate text-[9px] leading-tight text-[#0a0a0b]/65 sm:text-[10px]">
                  <span className="font-semibold text-[#0a0a0b]">{item.title}</span>
                  <span className="text-[#0a0a0b]/35"> · </span>
                  {item.line}
                </p>
              </div>
            </article>
          ))}
          <span className="h-0 w-0 shrink-0 overflow-hidden" aria-hidden />
        </div>
      ))}
    </div>
  )
}

const makeItYoursStyleFrames = [
  {
    id: 'clean-cinematic',
    logo: 'brightness(0) saturate(100%) invert(17%) sepia(92%) saturate(1976%) hue-rotate(210deg) brightness(95%) contrast(98%)',
    bg: 'linear-gradient(145deg,#e6eefb,#c8dbfb)',
    title: 'Cench Studio',
    line: 'From prompt to polished MP4',
    titleClass: `${ebGaramond.className} text-[18px] font-semibold tracking-tight text-[#173f7a]`,
    lineClass: 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2458a6]',
  },
  {
    id: 'neon',
    logo: 'brightness(0) saturate(100%) invert(37%) sepia(81%) saturate(1189%) hue-rotate(123deg) brightness(95%) contrast(95%)',
    bg: 'linear-gradient(145deg,#dcf8ee,#bfead8)',
    title: 'Cench Neon',
    line: 'Fast cuts. Bold motion. Clear story.',
    titleClass: `${sairaStencil.className} text-[16px] font-semibold uppercase tracking-wide text-[#0e6a48]`,
    lineClass: 'text-[11px] font-semibold text-[#1f7f59]',
    multiLogo: true,
  },
  {
    id: 'editorial',
    logo: 'brightness(0) saturate(100%) invert(16%) sepia(11%) saturate(603%) hue-rotate(335deg) brightness(91%) contrast(86%)',
    bg: 'linear-gradient(145deg,#ebe9e4,#d5d2c9)',
    title: 'Cench Editorial',
    line: 'Designed for sharp brand explainers',
    titleClass: `${ebGaramond.className} text-[17px] font-semibold tracking-tight text-[#3f3c35]`,
    lineClass: 'text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e584d]',
  },
  {
    id: 'pastel',
    logo: 'brightness(0) saturate(100%) invert(37%) sepia(66%) saturate(805%) hue-rotate(306deg) brightness(95%) contrast(98%)',
    bg: 'linear-gradient(145deg,#f8e3ed,#f3cddf)',
    title: 'Cench Creators',
    line: 'Your vision. Your voice. Your style.',
    titleClass: `${ebGaramond.className} text-[17px] font-semibold tracking-tight text-[#8a2e62]`,
    lineClass: 'text-[11px] font-semibold text-[#a24178]',
  },
] as const

function MarketingAppWindow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 max-w-3xl overflow-hidden rounded-xl border border-[#d9d4c4] bg-[#f4f1de] shadow-[0_20px_50px_-12px_rgba(10,10,11,0.12)]">
      <div className="flex items-center gap-2 border-b border-[#d9d4c4]/80 bg-[#ece8dc] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6157]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffc130]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2acb42]" />
        </span>
        <span className="flex-1 text-center font-sans text-[11px] font-medium text-[#0a0a0b]/45">Cench Studio</span>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
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
          <span className="pointer-events-none absolute inset-y-0 left-10 w-px bg-[#0a0a0b]/10 sm:left-14 md:left-18 lg:left-24 xl:left-32 2xl:left-40" />
          <span className="pointer-events-none absolute inset-y-0 right-10 w-px bg-[#0a0a0b]/10 sm:right-14 md:right-18 lg:right-24 xl:right-32 2xl:right-40" />
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
              href="#agents"
              className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-[#0a0a0b] transition-colors"
            >
              Agents
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
        <span className="pointer-events-none absolute inset-y-0 left-10 w-px bg-[#0a0a0b]/10 sm:left-14 md:left-18 lg:left-24 xl:left-32 2xl:left-40" />
        <span className="pointer-events-none absolute inset-y-0 right-10 w-px bg-[#0a0a0b]/10 sm:right-14 md:right-18 lg:right-24 xl:right-32 2xl:right-40" />
        {/* Hero */}
        <section
          className="relative pt-10 pb-16 sm:pt-12 sm:pb-20"
          data-sr-hero-section
        >
          <div className="relative overflow-hidden">
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
          </div>
          {/* Spans main’s vertical guide insets (left-10 … / right-10 …), not the padded content box */}
          <div
            className="pointer-events-none absolute bottom-0 -inset-x-2 h-px bg-[#0a0a0b]/10 lg:-inset-x-4"
            aria-hidden
          />
        </section>

        <section className="pb-14 pt-4 sm:pb-18 sm:pt-6" data-sr>
          <div className="mx-auto max-w-6xl text-left">
            <h2 className={`${ebGaramond.className} mb-2 text-[2rem] leading-tight text-[#0a0a0b] sm:text-[2.4rem]`}>
              Describe it. Get it.
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-[#0a0a0b]/62 sm:text-[15px]">
              Write your idea in plain language and Cench turns it into a full first cut.
            </p>
            <MarketingAppWindow>
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
            </MarketingAppWindow>
          </div>
        </section>

        <section className="pb-14 sm:pb-18" data-sr>
          <div className="mx-auto max-w-6xl text-right">
            <h2 className={`${ebGaramond.className} mb-2 text-[2rem] leading-tight text-[#0a0a0b] sm:text-[2.4rem]`}>
              Make it yours.
            </h2>
            <p className="mb-8 ml-auto max-w-xl text-sm leading-relaxed text-[#0a0a0b]/62 sm:text-[15px]">
              Refine pacing, visuals, copy, and media until it matches your style and brand.
            </p>
            <div className="ml-auto max-w-3xl rounded-[1.75rem] border border-[#d9d4c4] bg-[#f4f1de] px-6 py-6 text-left sm:px-8 sm:py-7">
              <div className="grid grid-cols-2 gap-3">
                {makeItYoursStyleFrames.map((frame) => (
                  <div key={frame.id} className="rounded-lg border border-[#d5d0bf] bg-[#ffffeb] p-2">
                    <div
                      className="flex aspect-video flex-col items-center justify-center rounded-md border border-[#cec9b9] px-3 py-2.5 text-center"
                      style={{ background: frame.bg }}
                    >
                      {'multiLogo' in frame && frame.multiLogo ? (
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
            </div>
          </div>
        </section>

        <section id="animations" className="scroll-mt-24 pb-14 sm:pb-18" data-sr>
          <div className="mx-auto max-w-6xl">
            <div className="text-right">
              <h2
                className={`${ebGaramond.className} text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-[#0a0a0b] sm:text-[3rem] lg:text-[3.35rem]`}
              >
                See what you can create
              </h2>
              <p className="mb-0 ml-auto mt-3 max-w-xl text-sm leading-relaxed text-[#0a0a0b]/62 sm:mt-4 sm:text-[15px]">
                Every renderer in one timeline—mix scenes without juggling tools or exports.
              </p>
            </div>
            <div className="animation-type-marquee mt-6 flex flex-col gap-2 sm:mt-8 sm:gap-2.5">
              <span className="animation-type-marquee__fade animation-type-marquee__fade--left" aria-hidden />
              <span className="animation-type-marquee__fade animation-type-marquee__fade--right" aria-hidden />
              <AnimationTypeMarqueeTrack />
              <AnimationTypeMarqueeTrack reverse />
            </div>
          </div>
        </section>

        <section id="agents" className="scroll-mt-24 pb-14 sm:pb-18" data-sr>
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start md:gap-10 lg:gap-14">
              <div className="text-left">
                <h2
                  className={`${ebGaramond.className} text-[2.25rem] font-semibold leading-[1.08] tracking-tight text-[#0a0a0b] sm:text-[2.65rem]`}
                >
                  Agents
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[#0a0a0b]/62 sm:mt-4 sm:text-[15px]">
                  One agent can build the whole project, with focused specialists when you want a tighter workflow.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-[#d9d4c4] bg-[#f4f1de] px-7 py-8 sm:px-9 sm:py-10">
                <div className="flex flex-col">
                  {agents.map((a) => (
                    <div key={a.name} className="flex items-start gap-3 border-b border-[#d5d0bf]/80 py-3 first:pt-0">
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
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <div className="relative bg-bone text-[#0a0a0b]">
        <span className="pointer-events-none absolute inset-y-0 left-10 w-px bg-[#0a0a0b]/10 sm:left-14 md:left-18 lg:left-24 xl:left-32 2xl:left-40" />
        <span className="pointer-events-none absolute inset-y-0 right-10 w-px bg-[#0a0a0b]/10 sm:right-14 md:right-18 lg:right-24 xl:right-32 2xl:right-40" />

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

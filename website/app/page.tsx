'use client'

import { useState, useCallback, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import { Globe, PencilLine } from 'lucide-react'
import { HomeScrollAnimations } from './components/HomeScrollAnimations'
import DomeGallery, { DEFAULT_DOME_IMAGES, type DomeGalleryImageItem } from './components/DomeGallery'
import { ebGaramond, sairaStencil } from './fonts'
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

function ReactBrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <ellipse cx="12" cy="12" fill="none" stroke="currentColor" strokeWidth="1.2" rx="11" ry="4.2" />
      <ellipse cx="12" cy="12" fill="none" stroke="currentColor" strokeWidth="1.2" rx="11" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" fill="none" stroke="currentColor" strokeWidth="1.2" rx="11" ry="4.2" transform="rotate(120 12 12)" />
    </svg>
  )
}

function ThreeJsBrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L21 7v10l-9 5-9-5V7l9-5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M12 22V12M12 12L3 7M12 12l9-5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

function SvgFormatMark({ className }: { className?: string }) {
  return <PencilLine className={className} strokeWidth={2} aria-hidden />
}

/** Centered column + horizontal inset that grows on large viewports */
const homePageShellClass =
  'mx-auto w-full max-w-screen-2xl px-12 sm:px-16 md:px-20 lg:px-28 xl:px-36 2xl:px-44'

/** Header: same max-width and right inset as shell; slightly tighter left so logo sits closer to edge */
const homeHeaderShellClass =
  'w-full pl-1.5 pr-1.5 sm:pl-2 sm:pr-2 md:pl-2.5 md:pr-2.5 lg:pl-3 lg:pr-3 xl:pl-3.5 xl:pr-3.5 2xl:pl-4 2xl:pr-4'

const agentsModelsMdQuery = '(min-width: 768px)'

const heroDomeImages: DomeGalleryImageItem[] = [
  { src: '/hero-desk.jpg', alt: 'Cench Studio' },
  ...DEFAULT_DOME_IMAGES,
]

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
    'border border-white/10 bg-[#141414] px-7 py-8 sm:px-9 sm:py-10'

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8 md:items-start">
      <div ref={agentsRef} className={cardClass}>
        <h2 className="text-2xl font-bold text-[#f5f4ef] mb-1.5">Agents.</h2>
        <p className="text-neutral-400 text-sm mb-7">
          The product starts with one agent that can build everything, plus a deep skill library. Explainer and 3D agents
          focus those workflows; add custom agents whenever you want a different style or pipeline.
        </p>
        <div className="flex flex-col">
          {agents.map((a) => (
            <div key={a.name} className="flex items-start gap-3 border-b border-white/10 py-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
              <div>
                <span className="text-sm font-semibold text-[#f5f4ef]">{a.name}</span>
                <span className="ml-2 text-sm text-neutral-400">{a.desc}</span>
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
          <h2 className="text-2xl font-bold text-[#f5f4ef]">Models.</h2>
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
        <p className="shrink-0 text-neutral-400 text-sm mb-7">
          Same stack as the app: agent LLMs, video and image generation, avatars, TTS, SFX, and music.
        </p>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="models-list-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain pr-1 -mr-1">
            {homeModels.map((m) => (
              <div key={m.key} className="flex items-center justify-between border-b border-white/10 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-white/20" />
                  <span className="text-sm font-semibold text-[#f5f4ef] truncate">{m.name}</span>
                </div>
                <span className="text-xs text-neutral-400 shrink-0 pl-2">{m.tag}</span>
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
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-14 bg-linear-to-t from-[#141414] via-[#141414]/70 to-transparent"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}

export default function Home() {

  return (
    <div className="min-h-screen w-full bg-[#0a0a0b]">
      <HomeScrollAnimations />
      <ComingSoonToast />

      {/* Full-viewport cinematic hero + dark glass header */}
      <section
        id="animations"
        className="relative min-h-screen w-full overflow-hidden scroll-mt-0 bg-black"
        data-sr-hero-section
      >
        <div className="absolute inset-0 z-0 min-h-[100dvh] min-h-[100vh] w-full bg-black" aria-hidden>
          <DomeGallery
            images={heroDomeImages}
            fit={0.68}
            fitBasis="width"
            heightGuardFactor={1.55}
            minRadius={320}
            padFactor={0.22}
            overlayBlurColor="#000000"
            grayscale
            openedImageWidth="400px"
            openedImageHeight="400px"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-linear-to-b from-black/20 via-transparent to-black/35"
          aria-hidden
        />
        <header className="fixed top-0 right-0 left-0 z-50">
          <div
            className="pointer-events-none absolute inset-0 bg-white/[0.02] backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_0%,black_68%,transparent_100%)]"
            aria-hidden
          />
          <div className={`relative z-10 flex items-center justify-between py-2.5 ${homeHeaderShellClass}`}>
            <div className="relative z-10 flex items-center gap-4 sm:gap-6 md:gap-8">
              <a
                href="/"
                className="flex shrink-0 items-center gap-0 transition-opacity hover:opacity-85 group"
              >
                <Image src="/cench2.0.svg" alt="Cench" width={46} height={46} className="shrink-0 brightness-0 invert" />
                <span
                  className={`${sairaStencil.className} ml-[-4px] text-[24px] leading-none font-semibold tracking-tight text-white uppercase`}
                >
                  Cench
                </span>
              </a>
              <nav className="hidden items-center gap-4 sm:gap-5 md:flex md:gap-6" aria-label="Primary">
                <a
                  href="#animations"
                  className="font-sans text-[16px] font-normal tracking-normal text-white transition-colors hover:text-white"
                >
                  Animations
                </a>
                <a
                  href="#videos"
                  className="font-sans text-[16px] font-normal tracking-normal text-white transition-colors hover:text-white"
                >
                  Videos
                </a>
                <a
                  href="#agents"
                  className="font-sans text-[16px] font-normal tracking-normal text-white transition-colors hover:text-white"
                >
                  Agents
                </a>
                <a
                  href="/docs"
                  className="font-sans text-[16px] font-normal tracking-normal text-white transition-colors hover:text-white"
                >
                  Docs
                </a>
              </nav>
            </div>
            <div className="relative z-10 flex shrink-0 items-center gap-2.5 sm:gap-3">
              <ComingSoon>
                <span className="cursor-pointer font-sans text-[16px] font-normal tracking-normal text-white transition-colors hover:text-white">
                  Book a demo
                </span>
              </ComingSoon>
              <ComingSoon>
                <span
                  className="button-7-black px-5 sm:px-6"
                  style={{ height: '2.5rem', minHeight: '2.5rem' }}
                >
                  <span className="text">Waitlist</span>
                </span>
              </ComingSoon>
            </div>
          </div>
        </header>

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 pt-24 pb-28 text-center sm:px-10 sm:pt-28 sm:pb-32 md:px-12">
          <h1
            className={`cinematic-hero-enter ${ebGaramond.className} max-w-[20ch] text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-white sm:max-w-none sm:text-[4.2rem] md:text-[5.1rem] lg:text-[5.8rem]`}
          >
            <span className="sm:hidden">Turn anything into a interactive video</span>
            <span className="hidden sm:inline">Create interactive videos with AI</span>
          </h1>
          <p className="cinematic-hero-enter cinematic-hero-enter--1 mx-auto mt-5 max-w-xl text-[20px] leading-relaxed font-semibold text-white/90 sm:mt-6 sm:max-w-2xl sm:text-[20px]">
            Create interactive videos programticly with engaging animtiosn, AI image, video, music, voiceovers, and 3D
            scences.
          </p>
          <div className="cinematic-hero-enter cinematic-hero-enter--2 mt-8 sm:mt-10">
            <ComingSoon>
              <span className="button-7-black">
                <span className="text">Join The Waitlist</span>
              </span>
            </ComingSoon>
          </div>

          <div className="cinematic-hero-enter cinematic-hero-enter--3 mt-12 w-full px-3 sm:mt-14 sm:px-5">
            <div className="mx-auto w-full max-w-[72rem] rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.58)_1.3%,rgba(255,255,255,0.18)_3%,transparent_9%,transparent_91%,rgba(255,255,255,0.18)_97%,rgba(255,255,255,0.58)_98.7%,rgba(255,255,255,0.92)_100%)] py-4 px-4 shadow-[0_0_10px_rgba(255,255,255,0.2),inset_0_0_0_1px_rgba(255,255,255,0.78),inset_0_0_18px_rgba(255,255,255,0.14)] backdrop-blur-[10px] sm:py-5 sm:px-5 xl:w-fit xl:max-w-full xl:rounded-[999px]">
              <div className="grid w-full grid-cols-2 items-center justify-items-center gap-x-4 gap-y-2.5 sm:grid-cols-3 md:grid-cols-4 lg:gap-x-6 xl:flex xl:w-auto xl:flex-nowrap xl:items-center xl:justify-center xl:gap-x-6 xl:gap-y-0">
                {(
                  [
                    {
                      key: 'react',
                      label: 'React',
                      node: <ReactBrandMark className="h-[92%] w-[92%] text-white" />,
                    },
                    {
                      key: 'veo',
                      label: 'Veo',
                      node: (
                        <img
                          src="/logos/google-g-logo.svg"
                          alt=""
                          className="h-[86%] w-[86%] object-contain brightness-0 invert"
                          loading="lazy"
                        />
                      ),
                    },
                    {
                      key: 'nano',
                      label: 'Nano Banana',
                      node: (
                        <img
                          src="/logos/google-g-logo.svg"
                          alt=""
                          className="h-[86%] w-[86%] object-contain brightness-0 invert"
                          loading="lazy"
                        />
                      ),
                    },
                    {
                      key: 'gpt',
                      label: 'GPT image',
                      node: (
                        <img
                          src="/logos/openai-white-monoblossom.svg"
                          alt=""
                          className="h-[88%] w-[88%] object-contain"
                          loading="lazy"
                        />
                      ),
                    },
                    {
                      key: 'eleven',
                      label: 'Elevenlabs',
                      node: (
                        <img
                          src="/logos/elevenlabs-symbol-white.svg"
                          alt=""
                          className="h-[72%] w-[72%] object-contain"
                          loading="lazy"
                        />
                      ),
                    },
                    {
                      key: 'kling',
                      label: 'Kling',
                      node: (
                        <img
                          src="/logos/kling-ai-icon.svg"
                          alt=""
                          className="h-[86%] w-[86%] object-contain brightness-0 invert"
                          loading="lazy"
                        />
                      ),
                    },
                    {
                      key: 'three',
                      label: '3D',
                      node: (
                        <ThreeJsBrandMark className="h-full w-full text-white" />
                      ),
                    },
                    {
                      key: 'svg',
                      label: 'SVG',
                      node: (
                        <SvgFormatMark className="h-[90%] w-[90%] text-white" />
                      ),
                    },
                  ] as const
                ).map((item) => (
                      <div
                        key={item.key}
                        className={`flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          item.key === 'gpt'
                            ? 'order-7 xl:order-none'
                            : item.key === 'three'
                              ? 'order-4 xl:order-none'
                              : ''
                        }`}
                      >
                    {item.node ? (
                      <span
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center sm:h-5 sm:w-5 md:h-5 md:w-5 ${
                          item.key === 'veo' || item.key === 'nano'
                            ? '-translate-y-px sm:-translate-y-[1.5px]'
                            : item.key === 'react'
                              ? '-translate-y-px'
                              : item.key === 'gpt'
                                ? '-translate-y-px'
                                : item.key === 'eleven'
                                  ? '-translate-y-px'
                                  : item.key === 'kling'
                                    ? '-translate-y-px'
                                    : item.key === 'three'
                                      ? '-translate-y-px'
                                      : ''
                        }`}
                      >
                        {item.node}
                      </span>
                    ) : null}
                    <span className="text-sm leading-none font-semibold tracking-tight text-white sm:text-base lg:text-lg">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div
            className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-36 bg-linear-to-b from-transparent via-[#0a0a0b]/55 to-[#0a0a0b] sm:h-44"
            aria-hidden
          />
        </div>
      </section>

      <main className={`relative ${homePageShellClass}`}>
        <span className="pointer-events-none absolute inset-y-0 left-10 w-px bg-white/[0.08] sm:left-12 md:left-16 lg:left-20 xl:left-24 2xl:left-28" />
        <span className="pointer-events-none absolute inset-y-0 right-10 w-px bg-white/[0.08] sm:right-12 md:right-16 lg:right-20 xl:right-24 2xl:right-28" />

        <section id="workflow-cards" className="relative z-10 pt-8 pb-14 sm:pt-10 sm:pb-18" data-sr>
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-x-14">
            {(
              [
                [
                  {
                    title: 'Describe it. Get it.',
                    desc: 'Write your idea in plain language and Cench turns it into a full first cut.',
                  },
                  {
                    title: 'Post it.',
                    desc: 'Export MP4, embed on your website, or share with a custom link.',
                  },
                ],
                [
                  {
                    title: 'Make it yours.',
                    desc: 'Refine pacing, visuals, copy, and media until it matches your style and brand.',
                  },
                  {
                    title: 'Atuomate.',
                    desc: 'For workflows. Make researched videos at scale.',
                  },
                ],
              ]
            ).map((column, columnIdx) => (
              <div key={`workflow-col-${columnIdx}`} className="flex flex-col gap-12">
                {column.map((item) => (
                  <div key={item.title}>
                <div className="w-full">
                  <h3 className={`${ebGaramond.className} mb-2 text-[2rem] leading-tight text-[#f5f4ef] sm:text-[2.4rem]`}>
                    {item.title}
                  </h3>
                  {item.desc ? (
                    <p className="mb-2 text-sm leading-relaxed text-[#a3a39a] sm:text-[15px]">{item.desc}</p>
                  ) : null}
                  <div className="rounded-[1.75rem] border border-white/10 bg-[#121212] px-6 py-6 sm:px-8 sm:py-7">
                    {item.title === 'Describe it. Get it.' ? (
                      <div className="rounded-xl border border-white/10 bg-[#181818] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-md bg-[#3d3520] px-2 py-1 text-[11px] font-semibold text-[#e8d89a]">Idea board</span>
                          <span className="text-[11px] text-neutral-500">v1 notes</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-[#2a2618] p-2.5 text-[11px] leading-snug text-[#e8d89a]">
                            Hook: “From prompt to MP4”
                          </div>
                          <div className="rounded-lg bg-[#3d2418] p-2.5 text-[11px] leading-snug text-[#f0c4a8]">
                            Keep pacing under 45s
                          </div>
                          <div className="h-16 rounded-lg border border-white/10 bg-[linear-gradient(135deg,#252520,#1a1a16)]" />
                          <div className="rounded-lg border border-dashed border-white/15 p-2.5 text-[11px] leading-snug text-[#a3a39a]">
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
                          <div key={frame.id} className="rounded-lg border border-white/10 bg-[#16160f] p-2">
                            <div
                              className="aspect-video rounded-md border border-white/10 px-3 py-2.5 flex flex-col items-center justify-center text-center"
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
                            <path d="M210 12 L210 62" stroke="#a3a39a" strokeWidth="3.5" strokeLinecap="round" />
                            <path d="M210 62 C190 102 122 108 72 132" stroke="#a3a39a" strokeWidth="3.5" strokeLinecap="round" />
                            <path d="M210 62 L210 132" stroke="#a3a39a" strokeWidth="3.5" strokeLinecap="round" />
                            <path d="M210 62 C230 102 298 108 348 132" stroke="#a3a39a" strokeWidth="3.5" strokeLinecap="round" />
                          </svg>

                          <div className="-mt-[110px] grid w-full grid-cols-3 gap-3">
                            {[
                              { label: 'Instagram', src: '/instagram-liquid.png' },
                              { label: 'YouTube', src: '/youtube-liquid.png' },
                              { label: 'Website', icon: <Globe className="h-5 w-5 text-[#c4c4bc]" strokeWidth={2.1} /> },
                            ].map((platform) => (
                              <div key={platform.label} className="flex flex-col items-center">
                                <div className="flex h-14 w-14 items-center justify-center">
                                  {platform.src ? (
                                    <Image src={platform.src} alt={platform.label} width={48} height={48} className="h-12 w-12" />
                                  ) : (
                                    platform.icon
                                  )}
                                </div>
                                <p className="mt-2 text-center text-[12px] font-semibold tracking-tight text-[#d4d4cc]">{platform.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : item.title === 'Atuomate.' ? (
                      <div className="space-y-4">
                        <pre className="overflow-x-auto font-mono text-[10px] leading-[1.12] tracking-tight text-[#93c5fd] sm:text-[11px]">
{`██████╗ ███████╗███╗   ██╗ ██████╗██╗  ██╗      █████╗ ██████╗ ██╗
██╔════╝██╔════╝████╗  ██║██╔════╝██║  ██║      ██╔══██╗██╔══██╗██║
██║     █████╗  ██╔██╗ ██║██║     ███████║      ███████║██████╔╝██║
██║     ██╔══╝  ██║╚██╗██║██║     ██╔══██║      ██╔══██║██╔═══╝ ██║
╚██████╗███████╗██║ ╚████║╚██████╗██║  ██║      ██║  ██║██║     ██║
 ╚═════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝      ╚═╝  ╚═╝╚═╝     ╚═╝`}
                        </pre>
                        <p className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[#a3a39a] sm:text-[12px]">
                          <span className="text-neutral-500">{'{'}</span>
                          <span className="text-[#7dd3fc]">{` "job"`}</span>
                          <span className="text-neutral-500">{`: `}</span>
                          <span className="text-[#86efac]">&quot;batch_render&quot;</span>
                          <span className="text-neutral-500">{`, `}</span>
                          <span className="text-[#7dd3fc]">{`"total"`}</span>
                          <span className="text-neutral-500">{`: `}</span>
                          <span className="text-[#c4b5fd]">100</span>
                          <span className="text-neutral-500">{`, `}</span>
                          <span className="text-[#7dd3fc]">{`"completed"`}</span>
                          <span className="text-neutral-500">{`: `}</span>
                          <span className="text-[#c4b5fd]">45</span>
                          <span className="text-neutral-500">{` `}</span>
                          <span className="text-neutral-500">{'}'}</span>
                        </p>
                        <div className="space-y-1.5 font-mono text-[11px] leading-relaxed text-[#a3a39a] sm:text-[12px]">
                          <p className="overflow-x-auto">
                            <span className="text-neutral-500">user@cench:~$ </span>
                            <span className="text-[#7dd3fc]">batch status</span>
                          </p>
                          <p className="overflow-x-auto">
                            <span className="text-neutral-500">│ </span>
                            <span className="text-[#7dd3fc]">[</span>
                            <span className="text-[#86efac]">█████████░░░░░░░░░░░</span>
                            <span className="text-[#7dd3fc]">]</span>
                            <span className="text-neutral-500"> </span>
                            <span className="text-[#c4b5fd]">45</span>
                            <span className="text-neutral-500">/</span>
                            <span className="text-[#c4b5fd]">100</span>
                            <span className="text-[#d4d4cc]"> videos created</span>
                          </p>
                          <p className="overflow-x-auto">
                            <span className="text-neutral-500">│ $ </span>
                            <a
                              href="/docs"
                              className="text-[#7dd3fc] underline decoration-[#7dd3fc]/35 underline-offset-2 transition-colors hover:text-[#bae6fd] hover:decoration-[#7dd3fc]/55"
                            >
                              open docs
                            </a>
                            <span className="text-neutral-500"> — GET /docs</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-[#a3a39a] sm:text-[15px]">{item.desc}</p>
                    )}
                  </div>
                </div>
              </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

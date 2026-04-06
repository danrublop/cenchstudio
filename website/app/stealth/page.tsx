'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const navLinks = [
  { label: 'Generate', href: '#generate' },
  { label: 'Features', href: '#features' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '#docs' },
]

/* Pixel-art scene block — little animated squares that look like mini video scenes */
function PixelScene({ size, hue }: { size: number; hue: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = 2
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const grid = 8
    const cellSize = size / grid

    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const draw = Math.random() > 0.35
        if (draw) {
          const lightness = 65 + Math.random() * 20
          const sat = 55 + Math.random() * 30
          ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lightness}%)`
          ctx.fillRect(c * cellSize, r * cellSize, cellSize - 0.5, cellSize - 0.5)
        }
      }
    }
  }, [size, hue])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block"
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}

const stackingPanels = [
  {
    title: 'Describe it. Get it.',
    desc: 'Type what you imagine, get a production-ready video. No animation skills needed — just your ideas.',
    hue: 270,
  },
  {
    title: 'Make it yours',
    desc: 'Tweak colors, fix details, add your touch. Simple tools that feel like magic.',
    hue: 45,
  },
  {
    title: 'Ship it everywhere',
    desc: 'Export as MP4, publish as an interactive embed, or share a link. One click to go live.',
    hue: 160,
  },
]

/* Height of each collapsed title row (py-5 + text + divider) */
const TITLE_ROW_H = 80

function StackingSections({ accent }: { accent: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const panels = panelRefs.current.filter(Boolean) as HTMLElement[]

    panels.forEach((panel, i) => {
      // Each panel pins offset below previous titles so they stay visible
      const topOffset = i * TITLE_ROW_H
      ScrollTrigger.create({
        trigger: panel,
        start: `top ${topOffset}px`,
        pin: true,
        pinSpacing: false,
        endTrigger: panels[panels.length - 1],
        end: 'bottom bottom',
      })
    })

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [])

  return (
    <div ref={containerRef} id="features">
      {stackingPanels.map((panel, i) => (
        <section
          key={panel.title}
          ref={(el) => { panelRefs.current[i] = el }}
          className="relative bg-white"
          style={{ zIndex: i + 1, minHeight: `calc(100vh - ${i * TITLE_ROW_H}px)` }}
        >
          <div className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8">
            <div className="border-x border-neutral-200">
              <div className="-mx-px h-px bg-neutral-200" />
              {/* Title row — fixed height so stacking math works */}
              <div className="px-3" style={{ height: TITLE_ROW_H, display: 'flex', alignItems: 'center' }}>
                <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.1] tracking-tight text-[#1a1a1a]">
                  {panel.title}
                </h2>
              </div>
              <div className="-mx-px h-px bg-neutral-200" />
              {/* Content */}
              <div className="px-3 py-12 sm:py-16">
                <div className="grid items-end gap-10 sm:grid-cols-2">
                  <p className="max-w-sm text-lg leading-relaxed text-neutral-500">
                    {panel.desc}
                  </p>
                  <div className="flex justify-center sm:justify-end">
                    <PixelScene size={160} hue={panel.hue} />
                  </div>
                </div>
              </div>
              <div className="-mx-px h-px bg-neutral-200" />
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

export default function StealthPage() {
  const [prompt, setPrompt] = useState('')
  const accent = '#c94277' // rose/pink accent like the screenshot

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center px-3 py-3 sm:px-5">
          {/* Left — logo */}
          <a href="/stealth" className="flex shrink-0 items-center gap-2.5 text-[#1a1a1a]">
            <Image src="/blacklogo.png" alt="Cench" width={26} height={26} />
            <span className="text-base font-semibold tracking-tight">Cench</span>
          </a>

          {/* Center — nav */}
          <nav className="hidden flex-1 items-center justify-center gap-9 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[14px] font-medium text-neutral-500 transition-colors hover:text-[#1a1a1a]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right — auth */}
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="#"
              className="rounded-md border border-neutral-300 px-4 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-[#1a1a1a]"
            >
              Log in
            </a>
            <a
              href="#"
              className="rounded-md px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              Sign up
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — bordered column layout with vertical divider lines */}
        <section className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8">
          <div className="border-x border-neutral-200">
            {/* Pixel art area */}
            <div className="relative overflow-hidden bg-[#f7f7f7] px-3 pt-10 pb-6">
              {/* Row 1 */}
              <div className="flex items-end justify-center gap-8 sm:gap-12">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={`r1-${i}`} className="shrink-0">
                    <PixelScene size={72 + (i % 3) * 8} hue={340} />
                  </div>
                ))}
              </div>
              {/* Row 2 — fewer, offset */}
              <div className="mt-5 flex items-end justify-between">
                <div className="flex items-end gap-8 sm:gap-12">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`r2l-${i}`} className="shrink-0">
                      <PixelScene size={68 + (i % 2) * 12} hue={340} />
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-8">
                  <PixelScene size={76} hue={340} />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-3 pb-16 pt-10 sm:pb-24">
              <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-light leading-[1.05] tracking-tight text-[#1a1a1a]">
                AI video generator
              </h1>
              <p className="mt-3 max-w-lg text-lg text-neutral-500">
                Create animated explainer videos in seconds
              </p>

              {/* Divider — full width edge to edge */}
              <div className="-mx-3 my-8 h-px bg-neutral-200" />

              {/* Prompt input */}
              <div className="flex max-w-2xl items-center gap-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="product launch, 3D, energetic"
                  className="min-w-0 flex-1 bg-transparent px-5 py-4 text-[15px] text-neutral-800 outline-none placeholder:text-neutral-400"
                />
                <a
                  href="#"
                  className="mr-2 flex shrink-0 items-center gap-2 rounded-md px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Create for Free
                </a>
              </div>

              {/* Counter */}
              <div className="-mx-3 mt-4 border-t border-neutral-200 px-3 pt-4">
                <p className="text-[14px] text-neutral-400">
                  <span className="font-semibold text-neutral-500">2,847</span> + videos generated
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stacking feature sections */}
        <StackingSections accent={accent} />

        {/* Renderers */}
        <section className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8">
          <div className="border-x border-neutral-200">
            <div className="-mx-px h-px bg-neutral-200" />
            <div className="px-3 py-20 sm:py-28">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Six renderers, one studio</h2>
              <p className="mt-3 max-w-lg text-[15px] text-neutral-500">
                The agent picks the right engine for each scene — or you choose.
              </p>
              <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: 'Motion / Anime.js', desc: 'Layouts, typography, cards, smooth transitions.', tag: 'Default' },
                  { title: 'Canvas 2D', desc: 'Hand-drawn and procedural animations.', tag: 'Expressive' },
                  { title: 'D3.js', desc: 'Charts, graphs, and data stories.', tag: 'Data' },
                  { title: 'Three.js', desc: '3D scenes and WebGL rendering.', tag: '3D' },
                  { title: 'SVG', desc: 'Crisp vectors at any resolution.', tag: 'Vector' },
                  { title: 'Lottie', desc: 'Import and play Lottie animations.', tag: 'Import' },
                ].map((r) => (
                  <div
                    key={r.title}
                    className="group rounded-xl border border-neutral-100 bg-white p-6 transition-all hover:border-neutral-200 hover:shadow-sm"
                  >
                    <span
                      className="mb-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                      style={{ backgroundColor: accent, opacity: 0.85 }}
                    >
                      {r.tag}
                    </span>
                    <h3 className="text-[15px] font-semibold">{r.title}</h3>
                    <p className="mt-1.5 text-sm text-neutral-500">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Agents */}
        <section id="agents" className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8">
          <div className="border-x border-neutral-200">
            <div className="-mx-px h-px bg-neutral-200" />
            <div className="px-3 py-20 sm:py-28">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Agent system</h2>
              <p className="mt-3 max-w-lg text-[15px] text-neutral-500">
                Five built-in agents orchestrate every video. Or bring your own via the open API.
              </p>
              <div className="mt-14 flex flex-col gap-3">
                {[
                  { name: 'Director', desc: 'Multi-scene planning and narrative arc.', color: '#a855f7' },
                  { name: 'Scene Maker', desc: 'Creates and regenerates full scenes.', color: '#3b82f6' },
                  { name: 'Editor', desc: 'Surgical edits to timing, copy, and layers.', color: '#22c55e' },
                  { name: 'DoP', desc: 'Global look: palette, type, transitions.', color: '#f97316' },
                  { name: 'Specialists', desc: 'SVG, Canvas2D, D3, Three.js, Motion.', color: '#64748b' },
                ].map((a) => (
                  <div key={a.name} className="flex items-center gap-4 rounded-xl border border-neutral-100 bg-white px-6 py-4">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="text-[15px] font-semibold">{a.name}</span>
                    <span className="text-sm text-neutral-500">{a.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8">
          <div className="border-x border-neutral-200">
            <div className="-mx-px h-px bg-neutral-200" />
            <div className="px-3 py-20 sm:py-28">
              <div className="flex flex-col items-center text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Start creating for free
                </h2>
                <p className="mt-4 max-w-md text-[15px] text-neutral-500">
                  Open Cench Studio, describe your scene, and export — agents handle the rest.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <a
                    href="/"
                    className="group inline-flex items-center gap-2 rounded-lg px-7 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: accent }}
                  >
                    Open Studio
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5">
                      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                  <a
                    href="mailto:hello@cench.io"
                    className="rounded-lg border border-neutral-200 px-6 py-3 text-[14px] font-semibold text-neutral-700 transition-colors hover:border-neutral-300"
                  >
                    Get a Demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8">
        <div className="border-x border-neutral-200">
          <div className="-mx-px h-px bg-neutral-200" />
          <div className="px-3 py-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Image src="/blacklogo.png" alt="Cench" width={22} height={22} />
                <span className="text-sm font-semibold tracking-tight text-neutral-500">Cench</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-neutral-400">
                <a href="#" className="transition-colors hover:text-neutral-600">Docs</a>
                <a href="https://github.com" className="transition-colors hover:text-neutral-600">GitHub</a>
                <a href="mailto:hello@cench.io" className="transition-colors hover:text-neutral-600">Contact</a>
                <a href="#" className="transition-colors hover:text-neutral-600">Privacy</a>
                <a href="#" className="transition-colors hover:text-neutral-600">Terms</a>
              </div>
            </div>
            <p className="mt-6 text-xs text-neutral-400">&copy; 2026 Cench. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}

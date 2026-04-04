'use client'

import { useEffect, useRef } from 'react'
import { createLayout, stagger } from 'animejs'

const steps = [
  {
    id: 'studio',
    title: 'Cench Studio',
    desc: 'Download the desktop app: full visual editor, timelines, layers, previews, MP4 export, and hosted embeds.',
  },
  {
    id: 'ide',
    title: 'From your IDE',
    desc: 'Use agent skills with Claude Code, Antigravity, and Cursor—same tools and orchestration as the in-app chat.',
  },
  {
    id: 'api',
    title: 'API',
    desc: 'Generate videos programmatically—rewrite scene code, automate pipelines, or build on top of the platform from your own stack.',
  },
  {
    id: 'onthego',
    title: 'On the go',
    desc: 'Create on the go—integrate with Slack, Telegram, and iMessage so prompts meet your team where they work.',
  },
] as const

const icons: Record<string, JSX.Element> = {
  studio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[#546a9e]">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  ide: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[#546a9e]">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  api: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[#546a9e]">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  onthego: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[#546a9e]">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  ),
}

export function UseCasesScroll() {
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    const section = sectionRef.current
    if (!container || !section) return

    const layout = createLayout(container)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true

          layout.update(
            ({ root }) => {
              root.dataset.revealed = 'true'
            },
            {
              duration: 900,
              delay: stagger(120),
              ease: 'outExpo',
            }
          )

          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="docs" className="mt-36 scroll-mt-36 sm:mt-40 sm:scroll-mt-40">
      <div className="flex flex-col items-start">
        <h2 className="mb-2 text-3xl font-bold tracking-tight text-[#0a0a0b]">Use it your way.</h2>
        <p className="mb-8 max-w-md pl-8 text-[15px] leading-relaxed text-neutral-500 sm:mb-10">
          API, desktop app, IDE agents, or chat integrations—one product, whichever surface fits your
          workflow.
        </p>

        <div
          ref={containerRef}
          data-revealed="false"
          className="w-full grid gap-4 sm:gap-5"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          }}
        >
          {steps.map((step) => (
            <div
              key={step.id}
              className="layout-item flex flex-col gap-3 border border-[#e0d9cc] p-6 transition-shadow hover:shadow-md"
              style={{
                opacity: 0,
                transform: 'translateY(40px) scale(0.92)',
              }}
            >
              <div className="flex items-center gap-3">
                {icons[step.id]}
                <h3 className="text-lg font-bold leading-tight text-[#0a0a0b]">
                  {step.title}
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed text-neutral-500">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none shrink-0 border-t border-[#e0d9cc] mt-16 mb-16 sm:mt-20 sm:mb-20" />

      <style jsx>{`
        [data-revealed='true'] .layout-item {
          opacity: 1 !important;
          transform: translateY(0) scale(1) !important;
        }
      `}</style>
    </section>
  )
}

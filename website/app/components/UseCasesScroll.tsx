'use client'

import Image from 'next/image'
import { useEffect, useLayoutEffect, useRef, type ReactElement } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Download row: fire as soon as the card enters the viewport (Mac/Windows pop first). */
const DOWNLOAD_CARD_SCROLL_START = 'top bottom'

/**
 * Pinned scroll track per step (lg+). Wheel advances one step at a time; this length only reserves
 * spacer while pinned so the page can scroll past after the last step.
 */
const SCROLL_PER_STEP_MIN_PX = 720
const SCROLL_PER_STEP_VH_RATIO = 1.02

/** Accumulated wheel delta before one burst can count as a single step intent. */
const WHEEL_STEP_THRESHOLD = 110

/** After a step change, ignore further step advances (still trap momentum in the pin). */
const STEP_ADVANCE_COOLDOWN_MS = 600

/** If native scroll drifts inside the pin, snap back to the scroll position for the current step. */
const SCROLL_CLAMP_TOLERANCE_PX = 28

const DESC_EXPAND = { duration: 0.58, ease: 'power3.out' as const }
const DESC_COLLAPSE = { duration: 0.42, ease: 'power2.inOut' as const }

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
] as const

const STEP_COUNT = steps.length

/** IDE step: three folder icons in a row (exported from user icns → PNG in public/ide-agents). */
const IDE_FOLDER_ROW = [
  { name: 'Cursor', src: '/ide-agents/folder-cursor.png' },
  { name: 'Claude Code', src: '/ide-agents/folder-claude-code.png' },
  { name: 'VS Code', src: '/ide-agents/folder-vscode.png' },
] as const

/** Duration (s) for studio pop-out / folder pop-in time-based tweens. */
const STUDIO_POP_OUT_DUR = 0.5
const FOLDER_POP_IN_DUR = 0.48
const FOLDER_POP_IN_STAGGER = 0.09

/** Text typed in the code line when IDE step activates. */
const CODE_LINE_TEXT = 'npx cench install --agent-skill'
const TYPE_CHAR_DELAY = 0.04

/** API code lines — each line is an array of inline tokens [{text, cls}]. */
type Token = { text: string; cls: string }
const API_TOKEN_COLORS: Record<string, string> = {
  kw: '#d4b882',
  fn: '#7faaab',
  str: '#7faaab',
  id: '#7faaab',
  num: '#7faaab',
}
const API_CODE_LINES: Token[][] = [
  [{ text: 'import ', cls: 'kw' }, { text: 'Cench', cls: 'fn' }, { text: ' ', cls: '' }, { text: 'from ', cls: 'kw' }, { text: "'cench-sdk'", cls: 'str' }],
  [],
  [{ text: 'const ', cls: 'kw' }, { text: 'project', cls: 'id' }, { text: ' = ', cls: '' }, { text: 'await ', cls: 'kw' }, { text: 'Cench', cls: 'fn' }, { text: '.create', cls: 'id' }, { text: '({', cls: '' }],
  [{ text: '  prompt', cls: 'id' }, { text: ': ', cls: '' }, { text: "'Explain how neural networks learn'", cls: 'str' }, { text: ',', cls: '' }],
  [{ text: '  style', cls: 'id' }, { text: ':  ', cls: '' }, { text: "'whiteboard'", cls: 'str' }, { text: ',', cls: '' }],
  [{ text: '  scenes', cls: 'id' }, { text: ': ', cls: '' }, { text: '4', cls: 'num' }, { text: ',', cls: '' }],
  [{ text: '})', cls: '' }],
  [],
  [{ text: 'await ', cls: 'kw' }, { text: 'project', cls: 'id' }, { text: '.export', cls: 'fn' }, { text: '(', cls: '' }, { text: "'mp4'", cls: 'str' }, { text: ')', cls: '' }],
]
const API_LINE_DELAY = 0.07

function computeStepIndex(progress01: number) {
  return Math.min(STEP_COUNT - 1, Math.max(0, Math.floor(progress01 * STEP_COUNT + 1e-6)))
}

function collapseStepDesc(el: HTMLElement) {
  gsap.killTweensOf(el)
  const h = el.offsetHeight
  if (h <= 0) {
    gsap.set(el, { height: 0, opacity: 0, marginTop: 0, overflow: 'hidden' })
    return
  }
  gsap.set(el, { overflow: 'hidden', height: h })
  gsap.to(el, {
    height: 0,
    opacity: 0,
    marginTop: 0,
    ...DESC_COLLAPSE,
    overwrite: 'auto',
  })
}

function expandStepDesc(el: HTMLElement) {
  gsap.killTweensOf(el)
  gsap.set(el, { overflow: 'hidden', height: 0, opacity: 0, marginTop: 0 })
  gsap.to(el, {
    height: 'auto',
    opacity: 1,
    marginTop: 8,
    ...DESC_EXPAND,
    overwrite: 'auto',
  })
}

function setDescStatesInstant(descEls: HTMLElement[], activeIdx: number) {
  descEls.forEach((el, i) => {
    gsap.killTweensOf(el)
    if (i === activeIdx) {
      gsap.set(el, { height: 'auto', opacity: 1, marginTop: 8, overflow: 'visible' })
    } else {
      gsap.set(el, { height: 0, opacity: 0, marginTop: 0, overflow: 'hidden' })
    }
  })
}

const icons: Record<string, ReactElement> = {
  studio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-[#546a9e]">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  ide: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-[#546a9e]">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  api: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-[#546a9e]">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function WindowsGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 5.45l7.28-1.12v7.09H3V5.45zm0 8.62l7.28.98v7.05H3v-8.03zm8.72.98L21 13.5v7.2h-9.28v-8.03zM21 3.5v7.2h-9.28V4.53L21 3.5z" />
    </svg>
  )
}

export function UseCasesScroll() {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const stepperRef = useRef<HTMLDivElement>(null)
  const lineTrackRef = useRef<HTMLDivElement>(null)
  const downloadCardRef = useRef<HTMLDivElement>(null)
  const downloadIconRef = useRef<HTMLDivElement>(null)
  const downloadBtnsRef = useRef<HTMLDivElement>(null)
  const downloadIdeFoldersRef = useRef<HTMLDivElement>(null)
  const codeLineRef = useRef<HTMLDivElement>(null)
  const apiCodeRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const card = downloadCardRef.current
    if (!card) return

    const iconEl = card.querySelector<HTMLElement>('[data-download-pop-icon]')
    const btnEls = card.querySelectorAll<HTMLElement>('[data-download-os-btn]')
    if (!iconEl || btnEls.length === 0) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    gsap.set(btnEls, { opacity: 0, y: 22, scale: 0.82 })
    gsap.set(iconEl, { opacity: 0, y: 14, scale: 0.9 })

    const st = ScrollTrigger.create({
      trigger: card,
      start: DOWNLOAD_CARD_SCROLL_START,
      once: true,
      onEnter: () => {
        gsap.to(btnEls, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: 'back.out(2.1)',
          stagger: 0.04,
          overwrite: 'auto',
        })
        gsap.to(iconEl, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.72,
          delay: 0.08,
          ease: 'elastic.out(1, 0.52)',
          overwrite: 'auto',
        })
      },
    })

    return () => {
      st.kill()
      gsap.killTweensOf([iconEl, ...btnEls])
      gsap.set([iconEl, ...btnEls], { clearProps: 'opacity,transform' })
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    const pin = pinRef.current
    const stepper = stepperRef.current
    const lineTrack = lineTrackRef.current
    if (!section || !pin || !stepper || !lineTrack) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const setLineHeight = (progress01: number) => {
      const h = lineTrack.offsetHeight
      if (h <= 0) return
      stepper.style.setProperty('--stepper-fill-px', `${Math.max(0, Math.min(1, progress01)) * h}px`)
    }

    if (reduced) {
      stepper.dataset.activeIndex = String(STEP_COUNT - 1)
      stepper.classList.add('use-case-stepper--static')
      requestAnimationFrame(() => setLineHeight(1))
      return
    }

    const mm = gsap.matchMedia()

    mm.add('(min-width: 1024px)', () => {
      const scrollPerStep = () =>
        Math.max(SCROLL_PER_STEP_MIN_PX, Math.round(window.innerHeight * SCROLL_PER_STEP_VH_RATIO))
      const descEls = Array.from(stepper.querySelectorAll<HTMLElement>('.step-desc'))

      let lastIdx = -1

      /** Pop the studio icon + buttons out (time-based, not scroll-scrubbed). */
      const popOutStudio = () => {
        const icon = downloadIconRef.current
        const btns = downloadBtnsRef.current
        if (!icon || !btns) return

        // Kill any running entrance tweens on individual buttons
        btns.querySelectorAll<HTMLElement>('[data-download-os-btn]').forEach((el) => gsap.killTweensOf(el))
        gsap.killTweensOf(icon)
        gsap.killTweensOf(btns)

        gsap.to(icon, {
          opacity: 0,
          scale: 0.65,
          y: -28,
          duration: STUDIO_POP_OUT_DUR,
          ease: 'power2.inOut',
          force3D: true,
        })
        gsap.to(btns, {
          opacity: 0,
          scale: 0.65,
          y: -20,
          duration: STUDIO_POP_OUT_DUR,
          ease: 'power2.inOut',
          force3D: true,
          onComplete: () => { btns.style.pointerEvents = 'none' },
        })
      }

      /** Pop the studio icon + buttons back in (reverse of pop-out). */
      const popInStudio = () => {
        const icon = downloadIconRef.current
        const btns = downloadBtnsRef.current
        if (!icon || !btns) return

        gsap.killTweensOf(icon)
        gsap.killTweensOf(btns)

        btns.style.pointerEvents = ''
        gsap.to(icon, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: STUDIO_POP_OUT_DUR,
          ease: 'power2.out',
          force3D: true,
        })
        gsap.to(btns, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: STUDIO_POP_OUT_DUR,
          ease: 'power2.out',
          force3D: true,
        })
      }

      /** Pop folder icons in with staggered timing. */
      const popInFolders = () => {
        const ideStage = downloadIdeFoldersRef.current
        if (!ideStage) return
        const folders = ideStage.querySelectorAll<HTMLElement>('[data-ide-folder]')
        folders.forEach((el) => gsap.killTweensOf(el))
        gsap.fromTo(
          folders,
          { opacity: 0, scale: 0.3, y: 40, rotation: 0 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            rotation: 0,
            duration: FOLDER_POP_IN_DUR,
            ease: 'back.out(1.4)',
            stagger: FOLDER_POP_IN_STAGGER,
            force3D: true,
            transformOrigin: '50% 100%',
          },
        )
      }

      /** Pop folder icons out (reverse). */
      const popOutFolders = () => {
        const ideStage = downloadIdeFoldersRef.current
        if (!ideStage) return
        const folders = ideStage.querySelectorAll<HTMLElement>('[data-ide-folder]')
        folders.forEach((el) => gsap.killTweensOf(el))
        gsap.to(folders, {
          opacity: 0,
          scale: 0.3,
          y: 40,
          duration: 0.32,
          ease: 'power2.in',
          stagger: 0.04,
          force3D: true,
        })
      }

      let typeTimeline: gsap.core.Timeline | null = null

      /** Reveal the code line and type out the command character by character. */
      const showCodeLine = () => {
        const el = codeLineRef.current
        if (!el) return
        const textEl = el.querySelector<HTMLElement>('[data-typed-text]')
        const cursorEl = el.querySelector<HTMLElement>('[data-cursor-blink]')
        if (!textEl || !cursorEl) return

        // Kill previous typing
        if (typeTimeline) { typeTimeline.kill(); typeTimeline = null }
        textEl.textContent = ''

        const tl = gsap.timeline()
        typeTimeline = tl

        // Fade in the code line
        tl.to(el, { opacity: 1, duration: 0.3, ease: 'power2.out' })
        // Show blinking cursor
        tl.set(cursorEl, { opacity: 1 }, '<+=0.1')
        // Type each character
        for (let i = 0; i < CODE_LINE_TEXT.length; i++) {
          tl.call(
            () => { textEl.textContent = CODE_LINE_TEXT.slice(0, i + 1) },
            [],
            `>+=${TYPE_CHAR_DELAY}`,
          )
        }
        // Hide inline cursor, show loading block on next line
        const loadingEl = el.querySelector<HTMLElement>('[data-loading-line]')
        tl.to(cursorEl, { opacity: 0, duration: 0.15 }, '>+=0.15')
        if (loadingEl) {
          tl.to(loadingEl, { opacity: 1, duration: 0.2, ease: 'power2.out' }, '<')
        }
      }

      /** Hide the code line (collapse). */
      const hideCodeLine = () => {
        const el = codeLineRef.current
        if (!el) return
        if (typeTimeline) { typeTimeline.kill(); typeTimeline = null }
        const textEl = el.querySelector<HTMLElement>('[data-typed-text]')
        const cursorEl = el.querySelector<HTMLElement>('[data-cursor-blink]')
        gsap.to(el, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            if (textEl) textEl.textContent = ''
            if (cursorEl) gsap.set(cursorEl, { opacity: 0 })
            const loadingEl = el.querySelector<HTMLElement>('[data-loading-line]')
            if (loadingEl) gsap.set(loadingEl, { opacity: 0 })
          },
        })
      }

      let apiTimeline: gsap.core.Timeline | null = null

      /** Shrink folders to bottom and type API code into the card. */
      const transitionToApi = () => {
        const ideStage = downloadIdeFoldersRef.current
        const apiEl = apiCodeRef.current
        if (!ideStage || !apiEl) return
        const folders = ideStage.querySelectorAll<HTMLElement>('[data-ide-folder]')

        // Shrink folders to small icons at the bottom
        folders.forEach((el) => gsap.killTweensOf(el))
        gsap.to(folders, {
          scale: 0.65,
          y: 60,
          opacity: 0.35,
          duration: 0.5,
          ease: 'power2.inOut',
          stagger: 0.03,
          force3D: true,
        })

        // Hide the terminal code line
        hideCodeLine()

        // Build API code lines and type them in
        if (apiTimeline) { apiTimeline.kill(); apiTimeline = null }
        const container = apiEl.querySelector<HTMLElement>('[data-api-code-lines]')
        if (!container) return
        // Clear previous lines safely
        while (container.firstChild) container.removeChild(container.firstChild)

        const tl = gsap.timeline()
        apiTimeline = tl

        tl.to(apiEl, { opacity: 1, duration: 0.25, ease: 'power2.out' })

        API_CODE_LINES.forEach((tokens) => {
          const lineDiv = document.createElement('div')
          lineDiv.style.opacity = '0'
          lineDiv.style.transform = 'translateY(4px)'
          lineDiv.style.whiteSpace = 'pre'

          if (tokens.length === 0) {
            lineDiv.textContent = '\u00A0'
          } else {
            tokens.forEach((tok) => {
              const s = document.createElement('span')
              s.textContent = tok.text
              const color = API_TOKEN_COLORS[tok.cls]
              if (color) s.style.color = color
              lineDiv.appendChild(s)
            })
          }

          container.appendChild(lineDiv)

          tl.to(lineDiv, {
            opacity: 1,
            y: 0,
            duration: 0.18,
            ease: 'power2.out',
          }, `>+=${API_LINE_DELAY}`)
        })
      }

      /** Reverse API transition — restore folders, hide code. */
      const transitionFromApi = () => {
        const ideStage = downloadIdeFoldersRef.current
        const apiEl = apiCodeRef.current
        if (!ideStage || !apiEl) return
        const folders = ideStage.querySelectorAll<HTMLElement>('[data-ide-folder]')

        if (apiTimeline) { apiTimeline.kill(); apiTimeline = null }

        // Fade out API code
        gsap.to(apiEl, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            const container = apiEl.querySelector<HTMLElement>('[data-api-code-lines]')
            if (container) while (container.firstChild) container.removeChild(container.firstChild)
          },
        })

        // Restore folders to full size
        folders.forEach((el) => gsap.killTweensOf(el))
        gsap.to(folders, {
          scale: 1,
          y: 0,
          opacity: 1,
          duration: 0.45,
          ease: 'power2.out',
          stagger: 0.03,
          force3D: true,
        })

        // Re-show the terminal code line
        showCodeLine()
      }

      /** Set download card state instantly (no animation) for initial layout / resize. */
      const setCardStateInstant = (idx: number) => {
        const icon = downloadIconRef.current
        const btns = downloadBtnsRef.current
        const ideStage = downloadIdeFoldersRef.current
        const codeEl = codeLineRef.current
        const apiEl = apiCodeRef.current
        if (!icon || !btns || !ideStage) return
        const folders = ideStage.querySelectorAll<HTMLElement>('[data-ide-folder]')

        // Always hide studio
        gsap.set(icon, { opacity: 0, scale: 0.65, y: -28, force3D: true })
        gsap.set(btns, { opacity: 0, scale: 0.65, y: -20, force3D: true })
        btns.style.pointerEvents = 'none'

        if (idx === 0) {
          // Studio visible, folders hidden, code line hidden, api hidden
          gsap.set(icon, { opacity: 1, scale: 1, y: 0, force3D: true })
          gsap.set(btns, { opacity: 1, scale: 1, y: 0, force3D: true })
          btns.style.pointerEvents = ''
          gsap.set(folders, { opacity: 0, scale: 0.3, y: 40 })
          if (codeEl) gsap.set(codeEl, { opacity: 0 })
          if (apiEl) gsap.set(apiEl, { opacity: 0 })
        } else if (idx === 1) {
          // IDE: folders full, code line shown, api hidden
          gsap.set(folders, { opacity: 1, scale: 1, y: 0, rotation: 0, transformOrigin: '50% 100%' })
          if (codeEl) {
            gsap.set(codeEl, { opacity: 1 })
            const textEl = codeEl.querySelector<HTMLElement>('[data-typed-text]')
            if (textEl) textEl.textContent = CODE_LINE_TEXT
          }
          if (apiEl) gsap.set(apiEl, { opacity: 0 })
        } else {
          // API: folders shrunk at bottom, code line hidden, api code shown
          gsap.set(folders, { opacity: 0.35, scale: 0.65, y: 60, transformOrigin: '50% 100%' })
          if (codeEl) gsap.set(codeEl, { opacity: 0 })
          if (apiEl) gsap.set(apiEl, { opacity: 1 })
        }
      }

      const syncFromProgress = (progress01: number, animateDesc: boolean) => {
        const idx = computeStepIndex(progress01)
        stepper.dataset.activeIndex = String(idx)
        setLineHeight(progress01)

        if (!animateDesc) {
          lastIdx = idx
          setDescStatesInstant(descEls, idx)
          setCardStateInstant(idx)
          return
        }

        if (idx === lastIdx) return

        const prevIdx = lastIdx
        lastIdx = idx
        descEls.forEach((el, i) => {
          if (i === idx) expandStepDesc(el)
          else collapseStepDesc(el)
        })

        // Studio → IDE or API
        if (prevIdx === 0 && idx >= 1) {
          popOutStudio()
          if (idx === 1) {
            showCodeLine()
            gsap.delayedCall(0.18, popInFolders)
          } else {
            // Jump straight to API
            gsap.delayedCall(0.18, () => {
              popInFolders()
              gsap.delayedCall(0.2, transitionToApi)
            })
          }
        }
        // Back to Studio
        if (idx === 0 && prevIdx >= 1) {
          if (apiTimeline) { apiTimeline.kill(); apiTimeline = null }
          const apiEl = apiCodeRef.current
          if (apiEl) gsap.set(apiEl, { opacity: 0 })
          popOutFolders()
          hideCodeLine()
          gsap.delayedCall(0.14, popInStudio)
        }
        // IDE ↔ API
        if (prevIdx === 1 && idx === 2) {
          transitionToApi()
        } else if (prevIdx === 2 && idx === 1) {
          transitionFromApi()
        }
      }

      const clearMorphDownloads = () => {
        const icon = downloadIconRef.current
        const btns = downloadBtnsRef.current
        const ideStage = downloadIdeFoldersRef.current
        if (icon) {
          gsap.killTweensOf(icon)
          gsap.set(icon, { clearProps: 'top,left,xPercent,yPercent,scale,opacity,transform,filter' })
        }
        if (btns) {
          gsap.killTweensOf(btns)
          gsap.set(btns, { clearProps: 'opacity,scale,transform,filter,x,y' })
          btns.style.pointerEvents = ''
          btns.style.filter = ''
        }
        if (ideStage) {
          ideStage.querySelectorAll<HTMLElement>('[data-ide-folder]').forEach((el) => {
            gsap.killTweensOf(el)
            gsap.set(el, { clearProps: 'opacity,scale,y,rotation,transform,transformOrigin' })
          })
        }
        if (typeTimeline) { typeTimeline.kill(); typeTimeline = null }
        if (apiTimeline) { apiTimeline.kill(); apiTimeline = null }
        const codeEl = codeLineRef.current
        if (codeEl) {
          gsap.killTweensOf(codeEl)
          gsap.set(codeEl, { clearProps: 'opacity' })
        }
        const apiEl = apiCodeRef.current
        if (apiEl) {
          gsap.killTweensOf(apiEl)
          gsap.set(apiEl, { clearProps: 'opacity' })
          const container = apiEl.querySelector<HTMLElement>('[data-api-code-lines]')
          if (container) while (container.firstChild) container.removeChild(container.firstChild)
        }
      }

      const proxy = { p: 0 }
      const scrollTweenProxy = { y: 0 }
      const currentStepRef = { current: 0 }
      let stepTweening = false
      let wheelAcc = 0
      let lockedUntil = 0
      let clampRaf = 0

      const stepToProgress = (step: number) => (STEP_COUNT <= 1 ? 1 : step / (STEP_COUNT - 1))

      const scrollYForStep = (st: ScrollTrigger, step: number) => {
        const span = st.end - st.start
        return st.start + stepToProgress(step) * span
      }

      const pinHolder: { current: ScrollTrigger | null } = { current: null }

      const scrollIsInPinRange = (st: ScrollTrigger, y: number = window.scrollY) =>
        y >= st.start - 1 && y <= st.end + 1

      /** True when we should hijack wheel to block native momentum through the pin. */
      const shouldTrapWheel = (e: WheelEvent) => {
        const st = pinHolder.current
        if (!st) return false
        if (!scrollIsInPinRange(st)) return false
        const cur = currentStepRef.current
        if (e.deltaY < 0 && cur <= 0) return false
        if (e.deltaY > 0 && cur >= STEP_COUNT - 1) return false
        return true
      }

      const goToStep = (step: number, onDone?: () => void) => {
        const st = pinHolder.current
        if (!st) {
          onDone?.()
          return
        }
        const clamped = Math.max(0, Math.min(STEP_COUNT - 1, step))
        currentStepRef.current = clamped
        const targetP = stepToProgress(clamped)
        const y = scrollYForStep(st, clamped)

        gsap.killTweensOf(scrollTweenProxy)
        scrollTweenProxy.y = window.scrollY

        gsap.set(proxy, { p: targetP })
        syncFromProgress(targetP, true)

        gsap.to(scrollTweenProxy, {
          y,
          duration: 0.42,
          ease: 'power2.out',
          onUpdate: () => window.scrollTo(0, scrollTweenProxy.y),
          onComplete: () => {
            stepTweening = false
            lockedUntil = Date.now() + STEP_ADVANCE_COOLDOWN_MS
            onDone?.()
          },
        })
      }

      const onWheel = (e: WheelEvent) => {
        const st = pinHolder.current
        if (!st) return

        const now = Date.now()
        const busy = stepTweening || now < lockedUntil

        if (busy) {
          if (shouldTrapWheel(e)) e.preventDefault()
          wheelAcc = 0
          return
        }

        if (!scrollIsInPinRange(st)) {
          wheelAcc = 0
          return
        }

        const cur = currentStepRef.current

        if (e.deltaY < 0 && cur <= 0) {
          wheelAcc = 0
          return
        }
        if (e.deltaY > 0 && cur >= STEP_COUNT - 1) {
          wheelAcc = 0
          return
        }

        e.preventDefault()
        wheelAcc += e.deltaY
        if (Math.abs(wheelAcc) < WHEEL_STEP_THRESHOLD) return

        const dir = wheelAcc > 0 ? 1 : -1
        wheelAcc = 0

        if (dir > 0 && cur < STEP_COUNT - 1) {
          stepTweening = true
          goToStep(cur + 1)
        } else if (dir < 0 && cur > 0) {
          stepTweening = true
          goToStep(cur - 1)
        }
      }

      const onScrollClamp = () => {
        if (clampRaf) return
        clampRaf = requestAnimationFrame(() => {
          clampRaf = 0
          const st = pinHolder.current
          if (!st || stepTweening) return
          const y = window.scrollY
          if (!scrollIsInPinRange(st, y)) return
          const expected = scrollYForStep(st, currentStepRef.current)
          if (Math.abs(y - expected) > SCROLL_CLAMP_TOLERANCE_PX) {
            window.scrollTo(0, expected)
          }
        })
      }

      pinHolder.current = ScrollTrigger.create({
        trigger: pin,
        start: 'top 8%',
        end: () => `+=${scrollPerStep() * STEP_COUNT}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        id: 'use-cases-pin',
        onEnter: () => {
          currentStepRef.current = 0
          requestAnimationFrame(() => {
            const st = pinHolder.current
            if (!st) return
            const y0 = scrollYForStep(st, 0)
            if (window.scrollY > y0 + 28) {
              window.scrollTo(0, y0)
            }
            gsap.set(proxy, { p: 0 })
            lastIdx = -1
            syncFromProgress(0, true)
            // Swallow tail of the same scroll gesture that entered the pin
            lockedUntil = Date.now() + 380
          })
        },
        onEnterBack: () => {
          currentStepRef.current = 0
          requestAnimationFrame(() => {
            const st = pinHolder.current
            if (!st) return
            const y0 = scrollYForStep(st, 0)
            window.scrollTo(0, y0)
            gsap.set(proxy, { p: 0 })
            lastIdx = -1
            syncFromProgress(0, false)
            lockedUntil = Date.now() + 380
          })
        },
      })

      window.addEventListener('wheel', onWheel, { passive: false, capture: true })
      window.addEventListener('scroll', onScrollClamp, { passive: true })

      const onRefreshLayout = () => {
        const st = pinHolder.current
        if (st && scrollIsInPinRange(st)) {
          proxy.p = stepToProgress(currentStepRef.current)
        }
        syncFromProgress(proxy.p, false)
        setLineHeight(proxy.p)
      }

      ScrollTrigger.addEventListener('refreshInit', onRefreshLayout)

      requestAnimationFrame(() => {
        gsap.set(proxy, { p: 0 })
        currentStepRef.current = 0
        lastIdx = -1
        stepper.dataset.activeIndex = '0'
        setLineHeight(0)
        descEls.forEach((el) => {
          gsap.set(el, { height: 0, opacity: 0, marginTop: 0, overflow: 'hidden' })
        })
        ScrollTrigger.refresh()
        syncFromProgress(0, true)
      })

      return () => {
        window.removeEventListener('wheel', onWheel, { capture: true })
        window.removeEventListener('scroll', onScrollClamp)
        if (clampRaf) cancelAnimationFrame(clampRaf)
        ScrollTrigger.removeEventListener('refreshInit', onRefreshLayout)
        pinHolder.current?.kill()
        pinHolder.current = null
        gsap.killTweensOf(descEls)
        gsap.set(descEls, { clearProps: 'height,maxHeight,opacity,marginTop,overflow' })
        clearMorphDownloads()
      }
    })

    mm.add('(max-width: 1023px)', () => {
      stepper.classList.add('use-case-stepper--static')
      stepper.dataset.activeIndex = String(STEP_COUNT - 1)
      requestAnimationFrame(() => setLineHeight(1))

      return () => {
        stepper.classList.remove('use-case-stepper--static')
      }
    })

    return () => {
      mm.revert()
    }
  }, [])

  return (
    <section ref={sectionRef} id="animations" className="mt-36 scroll-mt-36 sm:mt-40 sm:scroll-mt-40">
      <div
        ref={pinRef}
        className="use-cases-pin mx-auto flex max-w-6xl flex-col gap-10 px-8 lg:min-h-[min(60vh,520px)] lg:flex-row lg:items-start lg:justify-between lg:gap-14 lg:pt-4 xl:gap-20"
      >
        <div className="flex min-w-0 flex-1 flex-col lg:max-w-xl">
          <div className="shrink-0">
            <h2
              id="docs"
              className="mb-3 scroll-mt-28 text-3xl font-bold tracking-tight text-[#0a0a0b] sm:scroll-mt-32 lg:text-[2rem] lg:leading-tight"
            >
              Use it your way.
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-neutral-500">
              API, desktop app, and IDE agents—one product, whichever surface fits your workflow.
            </p>
          </div>

          <div
            ref={stepperRef}
            className="use-case-stepper mt-10 pl-1"
            data-active-index="0"
            style={
              {
                ['--stepper-fill-px' as string]: '0px',
              } as React.CSSProperties
            }
          >
            <div ref={lineTrackRef} className="stepper-track-scope relative">
              <div
                className="stepper-line-track pointer-events-none absolute bottom-0 left-[11px] top-2 w-0 border-l border-dotted border-neutral-300"
                aria-hidden
              />
              <div
                className="stepper-line-fill pointer-events-none absolute left-[11px] top-2 w-0 border-l-2 border-[#546a9e]"
                style={{
                  height: 'var(--stepper-fill-px, 0px)',
                  maxHeight: '100%',
                }}
                aria-hidden
              />

              <ul className="relative m-0 list-none p-0">
                {steps.map((step, i) => (
                  <li
                    key={step.id}
                    className="step-item relative pb-11 pl-10 last:pb-2"
                    data-step-index={i}
                  >
                    <span
                      className="step-dot pointer-events-none absolute left-[5px] top-[0.35rem] z-[1] h-3.5 w-3.5 rounded-full border-2 border-[#e0d9cc] bg-bone transition-colors duration-500 ease-out"
                      aria-hidden
                    />
                    <div className="flex items-start gap-2.5">
                      <span className="step-icon mt-0.5 shrink-0 opacity-60 transition-opacity duration-500 ease-out">
                        {icons[step.id]}
                      </span>
                      <div className="min-w-0">
                        <h3 className="step-title m-0 text-[17px] font-normal leading-snug tracking-tight text-neutral-400 transition-colors duration-500 ease-out">
                          {step.title}
                        </h3>
                        <p className="step-desc mt-0 overflow-hidden text-[14px] leading-relaxed text-neutral-500">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="-mt-6 flex w-full shrink-0 justify-center sm:-mt-8 lg:mt-3 lg:w-[min(50%,400px)] lg:justify-end lg:self-start">
          <div
            ref={downloadCardRef}
            className="relative flex min-h-[18.5rem] w-full max-w-[380px] flex-col border border-white/[0.08] bg-[#141416] pb-6 sm:min-h-[21.5rem] sm:max-w-[400px] sm:pb-8"
          >
            <div
              className="flex shrink-0 items-center gap-1.5 py-1.5 pl-3 pr-8 sm:gap-2 sm:py-2 sm:pl-4 sm:pr-10"
              aria-hidden
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#5c5c5e] ring-1 ring-black/25" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#5c5c5e] ring-1 ring-black/25" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#5c5c5e] ring-1 ring-black/25" />
            </div>
            <div className="shrink-0 border-b border-[#3a3a3c]" aria-hidden />
            <div className="relative flex min-h-0 flex-1 flex-col px-8 pt-3 sm:px-10 sm:pt-4">
            <div
              ref={codeLineRef}
              className="pointer-events-none absolute inset-x-0 top-0 z-40 hidden overflow-hidden whitespace-nowrap px-4 py-2.5 font-mono text-[13px] leading-relaxed text-[#9a9a9e] sm:px-5 lg:block"
              style={{ opacity: 0 }}
              aria-hidden
            >
              <span className="select-none text-[#6e6e72]">$&nbsp;</span>
              <span data-typed-text className="text-[#c5c5c7]" />
              <span data-cursor-blink className="inline-block w-[2px] translate-y-[1px] bg-[#546a9e]" style={{ height: '1.1em', opacity: 0 }} />
              <div data-loading-line className="mt-1.5 flex items-center gap-[3px]" style={{ opacity: 0 }}>
                <span className="inline-block h-[14px] w-[8px] rounded-[2px] bg-[#9a9a9e] terminal-block-blink" />
              </div>
            </div>
            <div
              ref={apiCodeRef}
              className="pointer-events-none absolute inset-x-0 top-0 z-40 hidden overflow-hidden px-4 py-2.5 font-mono text-[13px] leading-relaxed text-[#c5c5c7] motion-reduce:hidden sm:px-5 lg:block"
              style={{ opacity: 0 }}
              aria-hidden
            >
              <div data-api-code-lines />
            </div>
            <div className="relative min-h-[14rem] flex-1 sm:min-h-[16rem] lg:min-h-[17rem]">
              <div
                ref={downloadIconRef}
                data-download-pop-icon
                className="absolute left-1/2 z-20 w-[180px] -translate-x-1/2 -translate-y-1/2 sm:w-[210px] lg:z-[18] lg:will-change-transform"
                style={{ top: '50%' }}
              >
                <div
                  className="relative h-[180px] w-[180px] overflow-hidden sm:h-[210px] sm:w-[210px]"
                  style={{
                    borderRadius: '22%',
                    boxShadow: '0 20px 50px -8px rgba(0,0,0,0.5), 0 8px 16px -4px rgba(0,0,0,0.3), 0 -2px 0 0 rgba(255,255,255,0.15) inset, 0 4px 0 0 rgba(0,0,0,0.25)',
                    transform: 'perspective(600px) rotateX(2deg)',
                  }}
                  aria-hidden
                >
                  <Image
                    src="/cench-app-icon-bg.png"
                    alt=""
                    fill
                    className="object-cover"
                    sizes="210px"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 z-[1]"
                    style={{
                      borderRadius: '22%',
                      border: '1.5px solid rgba(255,255,255,0.45)',
                      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.15), inset 0 0 0 1.5px rgba(255,255,255,0.08), 0 0 0 3px rgba(0,0,0,0.12)',
                    }}
                    aria-hidden
                  />
                  <div className="relative z-10 flex h-full w-full items-center justify-center p-2 sm:p-3">
                    <Image
                      src="/blacklogo.png"
                      alt=""
                      width={200}
                      height={200}
                      className="h-[140px] w-[140px] object-contain drop-shadow-[0_3px_12px_rgba(0,0,0,0.25)] sm:h-[164px] sm:w-[164px]"
                    />
                  </div>
                </div>
              </div>

              <div
                ref={downloadIdeFoldersRef}
                className="pointer-events-none absolute inset-0 z-30 hidden items-end justify-center gap-4 px-3 pb-1 motion-reduce:hidden sm:gap-5 sm:pb-2 lg:flex"
                aria-hidden
              >
                {IDE_FOLDER_ROW.map((row) => (
                  <div
                    key={row.name}
                    data-ide-folder
                    className="flex w-[5.5rem] flex-col items-center gap-2 sm:w-24 lg:will-change-transform"
                  >
                    <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] sm:h-[5rem] sm:w-[5rem]">
                      <Image
                        src={row.src}
                        alt=""
                        fill
                        className="object-contain object-bottom"
                        sizes="(min-width: 640px) 80px, 72px"
                      />
                    </div>
                    <span className="max-w-full text-center text-[10px] font-medium leading-tight tracking-tight text-[#9a9a9e] sm:text-[11px]">
                      {row.name}
                    </span>
                  </div>
                ))}
              </div>

            </div>

            <div
              ref={downloadBtnsRef}
              className="relative z-30 flex w-full shrink-0 flex-row flex-wrap items-center justify-center gap-3 pt-10 sm:pt-12 lg:will-change-transform"
            >
              <a
                href="#"
                data-download-os-btn
                aria-label="Download for Mac"
                className="inline-flex items-center justify-center gap-2 rounded-none border border-white/[0.2] bg-[#fbfbf3] px-4 py-2.5 text-sm font-medium text-[#0a0a0b] transition-colors hover:border-[#fbfbf3] hover:bg-white"
              >
                <AppleGlyph className="h-[18px] w-[18px] shrink-0" />
                Mac
              </a>
              <a
                href="#"
                data-download-os-btn
                aria-label="Download for Windows"
                className="inline-flex items-center justify-center gap-2 rounded-none border border-white/[0.2] bg-[#fbfbf3] px-4 py-2.5 text-sm font-medium text-[#0a0a0b] transition-colors hover:border-[#fbfbf3] hover:bg-white"
              >
                <WindowsGlyph className="h-[18px] w-[18px] shrink-0" />
                Windows
              </a>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none mt-16 shrink-0 border-t border-[#e0d9cc] sm:mt-20" />

      <style jsx>{`
        .use-case-stepper[data-active-index='0'] .step-item[data-step-index='0'] .step-title,
        .use-case-stepper[data-active-index='1'] .step-item[data-step-index='1'] .step-title,
        .use-case-stepper[data-active-index='2'] .step-item[data-step-index='2'] .step-title {
          color: #0a0a0b;
          font-weight: 600;
        }

        .use-case-stepper[data-active-index='0'] .step-item[data-step-index='0'] .step-dot,
        .use-case-stepper[data-active-index='1'] .step-item[data-step-index='1'] .step-dot,
        .use-case-stepper[data-active-index='2'] .step-item[data-step-index='2'] .step-dot {
          border-color: #546a9e;
          background-color: #fbfbf3;
        }

        .use-case-stepper[data-active-index='0'] .step-item[data-step-index='0'] .step-icon,
        .use-case-stepper[data-active-index='1'] .step-item[data-step-index='1'] .step-icon,
        .use-case-stepper[data-active-index='2'] .step-item[data-step-index='2'] .step-icon {
          opacity: 1;
        }

        /* Mobile / reduced motion: show full story */
        .use-case-stepper--static .step-title {
          color: #0a0a0b;
          font-weight: 600;
        }
        .use-case-stepper--static .step-desc {
          margin-top: 0.5rem;
          max-height: 12rem;
          opacity: 1;
        }
        .use-case-stepper--static .step-dot {
          border-color: #546a9e;
        }
        .use-case-stepper--static .step-icon {
          opacity: 1;
        }


        @keyframes terminal-block-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .terminal-block-blink {
          animation: terminal-block-blink 1s steps(1) infinite;
        }
      `}</style>
    </section>
  )
}

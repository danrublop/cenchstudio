'use client'

import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Homepage scroll polish: hero stagger, section reveals, showcase parallax, header edge on scroll.
 * Skipped when prefers-reduced-motion is set.
 */
export function HomeScrollAnimations() {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onLoad = () => ScrollTrigger.refresh()

    const ctx = gsap.context(() => {
      const header = document.querySelector<HTMLElement>('header')
      if (header) {
        ScrollTrigger.create({
          start: 'top -2',
          end: 999999,
          toggleClass: { className: 'site-header-scrolled', targets: header },
        })
      }

      const heroSection = document.querySelector<HTMLElement>('[data-sr-hero-section]')
      if (heroSection) {
        const heroEls = heroSection.querySelectorAll<HTMLElement>('[data-sr-hero]')
        if (heroEls.length) {
          gsap.from(heroEls, {
            y: 40,
            autoAlpha: 0,
            duration: 0.88,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: heroSection,
              start: 'top 90%',
              once: true,
            },
            immediateRender: false,
          })
        }
      }

      const sr = gsap.utils.toArray<HTMLElement>('[data-sr]')
      if (sr.length) {
        gsap.set(sr, { autoAlpha: 0, y: 48 })
        ScrollTrigger.batch('[data-sr]', {
          start: 'top 90%',
          once: true,
          onEnter: (batch) => {
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              duration: 0.84,
              stagger: 0.08,
              ease: 'power3.out',
              overwrite: true,
            })
          },
        })
      }

      document.querySelectorAll<HTMLElement>('[data-parallax-wrap]').forEach((wrap) => {
        const inner = wrap.querySelector<HTMLElement>('.home-parallax-img')
        if (!inner) return
        gsap.fromTo(
          inner,
          { yPercent: -4 },
          {
            yPercent: 4,
            ease: 'none',
            scrollTrigger: {
              trigger: wrap,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.5,
            },
          },
        )
      })

      requestAnimationFrame(() => ScrollTrigger.refresh())
      window.addEventListener('load', onLoad, { once: true })
    })

    return () => {
      window.removeEventListener('load', onLoad)
      ctx.revert()
    }
  }, [])

  return null
}

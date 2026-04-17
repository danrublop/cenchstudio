/**
 * CenchMotion — GSAP-powered animation component library for Cench Studio.
 *
 * All functions add tweens to a provided GSAP timeline (opts.tl) so that
 * WVC (the render server) can seek to any frame and get the correct state.
 *
 * Usage:
 *   const tl = gsap.timeline({ paused: true })
 *   CenchMotion.textReveal('.title', { tl, delay: 0 })
 *   CenchMotion.countUp('#metric', { to: 42000, format: ',.0f', prefix: '$', tl, delay: 1 })
 *   window.__tl = tl
 */
;(function (global) {
  'use strict'

  // ── Utilities ────────────────────────────────────────────────────────────────

  function el(selector) {
    if (typeof selector === 'string') return document.querySelector(selector)
    return selector
  }

  function els(selector) {
    if (typeof selector === 'string') return gsap.utils.toArray(selector)
    if (selector instanceof NodeList) return Array.from(selector)
    if (Array.isArray(selector)) return selector
    return [selector]
  }

  // Seeded PRNG (mulberry32) — deterministic randomness for reproducible renders
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }
  // SI suffixes for formatNumber
  var SI = [
    { v: 1e12, s: 'T' },
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'K' },
  ]

  /**
   * Lightweight number formatter.
   * Supports d3-style format strings:
   *   ','    — comma grouping (1000 → 1,000)
   *   '.Nf'  — fixed N decimals (1234.5 → 1234.50)
   *   ',.0f' — comma + integer
   *   '$,.2f'— dollar + comma + 2 decimals (prefix handled separately)
   *   '.Ns'  — SI notation (1200000 → 1.2M)
   *   '.N%'  — percentage (0.47 → 47.0%)
   */
  function formatNumber(value, fmt) {
    if (!fmt) return String(Math.round(value))

    // Percentage: multiply by 100
    var pctMatch = fmt.match(/\.(\d+)%/)
    if (pctMatch) {
      var pctDec = parseInt(pctMatch[1])
      return addCommas((value * 100).toFixed(pctDec), fmt) + '%'
    }

    // SI notation: .2s → 1.2M
    var siMatch = fmt.match(/\.(\d+)s/)
    if (siMatch) {
      var siDec = parseInt(siMatch[1])
      for (var i = 0; i < SI.length; i++) {
        if (Math.abs(value) >= SI[i].v) {
          return (value / SI[i].v).toFixed(siDec) + SI[i].s
        }
      }
      return value.toFixed(siDec)
    }

    // Fixed decimal: .2f
    var fixedMatch = fmt.match(/\.(\d+)f/)
    var str
    if (fixedMatch) {
      str = value.toFixed(parseInt(fixedMatch[1]))
    } else {
      str = String(Math.round(value))
    }

    return addCommas(str, fmt)
  }

  function addCommas(str, fmt) {
    if (fmt.indexOf(',') === -1) return str
    var parts = str.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.join('.')
  }

  // ── Components ───────────────────────────────────────────────────────────────

  var CenchMotion = {

    // ── 1. textReveal ──────────────────────────────────────────────────────────
    /**
     * Animated text reveal using GSAP SplitText.
     * @param {string|Element} selector
     * @param {Object} opts
     * @param {string} opts.style — 'chars'|'words'|'lines'|'mask'|'typewriter'|'scatter'
     * @param {gsap.core.Timeline} opts.tl — timeline to add to
     * @param {number} [opts.delay=0]
     * @param {number} [opts.duration]
     * @param {number} [opts.stagger]
     * @param {string} [opts.ease]
     */
    textReveal: function (selector, opts) {
      opts = opts || {}
      var target = el(selector)
      if (!target) return
      var tl = opts.tl
      if (!tl) return
      var style = opts.style || 'words'
      var delay = opts.delay || 0

      // typewriter uses TextPlugin — no SplitText needed
      if (style === 'typewriter') {
        var originalText = target.textContent || ''
        target.textContent = ''
        tl.to(target, {
          duration: opts.duration || (originalText.length * 0.04),
          text: { value: originalText, delimiter: '' },
          ease: 'none',
        }, delay)
        return
      }

      // All other styles require SplitText
      if (typeof SplitText === 'undefined') {
        // Fallback: simple fade up
        gsap.set(target, { opacity: 0, y: 30 })
        tl.to(target, {
          opacity: 1, y: 0,
          duration: opts.duration || 0.6,
          ease: opts.ease || 'power2.out',
        }, delay)
        return
      }

      if (style === 'mask') {
        // GSAP 3.13+ mask feature: cinematic reveal from left
        var maskSplit = SplitText.create(target, { type: 'words', mask: 'words' })
        gsap.set(maskSplit.words, { y: '100%' })
        tl.to(maskSplit.words, {
          y: '0%',
          duration: opts.duration || 0.8,
          stagger: opts.stagger || 0.06,
          ease: opts.ease || 'power3.out',
        }, delay)
        return
      }

      if (style === 'scatter') {
        var scatterSplit = SplitText.create(target, { type: 'chars' })
        var rng = mulberry32(opts.seed || 42)
        scatterSplit.chars.forEach(function (c) {
          gsap.set(c, {
            opacity: 0,
            x: (rng() - 0.5) * 400,
            y: (rng() - 0.5) * 300,
            rotation: (rng() - 0.5) * 90,
            scale: 0.3,
          })
        })
        tl.to(scatterSplit.chars, {
          opacity: 1, x: 0, y: 0, rotation: 0, scale: 1,
          duration: opts.duration || 0.8,
          stagger: opts.stagger || 0.02,
          ease: opts.ease || 'back.out(1.4)',
        }, delay)
        return
      }

      // chars, words, lines
      var splitType = style === 'chars' ? 'chars' : style === 'lines' ? 'lines' : 'words'
      var split = SplitText.create(target, { type: splitType })
      var targets = split[splitType]

      var defaultStagger = style === 'chars' ? 0.03 : style === 'lines' ? 0.12 : 0.08

      if (style === 'lines') {
        // Lines slide up from below
        gsap.set(targets, { opacity: 0, y: 50 })
        tl.to(targets, {
          opacity: 1, y: 0,
          duration: opts.duration || 0.7,
          stagger: opts.stagger || defaultStagger,
          ease: opts.ease || 'power3.out',
        }, delay)
      } else if (style === 'chars') {
        gsap.set(targets, { opacity: 0, y: 20, scale: 0.8 })
        tl.to(targets, {
          opacity: 1, y: 0, scale: 1,
          duration: opts.duration || 0.6,
          stagger: opts.stagger || defaultStagger,
          ease: opts.ease || 'power2.out',
        }, delay)
      } else {
        // words (default)
        gsap.set(targets, { opacity: 0, y: 25 })
        tl.to(targets, {
          opacity: 1, y: 0,
          duration: opts.duration || 0.6,
          stagger: opts.stagger || defaultStagger,
          ease: opts.ease || 'power2.out',
        }, delay)
      }
    },

    // ── 2. fadeUp ──────────────────────────────────────────────────────────────
    fadeUp: function (selector, opts) {
      opts = opts || {}
      var targets = els(selector)
      if (!targets.length || !opts.tl) return
      gsap.set(targets, { opacity: 0, y: opts.distance || 30 })
      opts.tl.to(targets, {
        opacity: 1, y: 0,
        duration: opts.duration || 0.8,
        stagger: opts.stagger || 0,
        ease: opts.ease || 'power3.out',
      }, opts.delay || 0)
    },

    // ── 3. staggerIn ──────────────────────────────────────────────────────────
    /**
     * @param {string} opts.from — 'first'|'last'|'center'|'random'
     * @param {string} opts.direction — 'up'|'down'|'left'|'right'|'scale'
     */
    staggerIn: function (selector, opts) {
      opts = opts || {}
      var targets = els(selector)
      if (!targets.length || !opts.tl) return
      var dir = opts.direction || 'up'
      var fromVars = { opacity: 0 }

      if (dir === 'up') fromVars.y = 40
      else if (dir === 'down') fromVars.y = -40
      else if (dir === 'left') fromVars.x = -60
      else if (dir === 'right') fromVars.x = 60
      else if (dir === 'scale') { fromVars.scale = 0; fromVars.transformOrigin = 'center center' }

      gsap.set(targets, fromVars)

      var toVars = {
        opacity: 1, x: 0, y: 0, scale: 1,
        duration: opts.duration || 0.6,
        stagger: {
          each: opts.stagger || 0.1,
          from: opts.from || 'start',
        },
        ease: opts.ease || 'power2.out',
      }
      opts.tl.to(targets, toVars, opts.delay || 0)
    },

    // ── 4. countUp ────────────────────────────────────────────────────────────
    countUp: function (selector, opts) {
      opts = opts || {}
      var target = el(selector)
      if (!target || !opts.tl) return
      var from = opts.from != null ? opts.from : 0
      var to = opts.to != null ? opts.to : 100
      var prefix = opts.prefix || ''
      var suffix = opts.suffix || ''
      var fmt = opts.format || null

      var proxy = { value: from }
      target.textContent = prefix + formatNumber(from, fmt) + suffix

      opts.tl.to(proxy, {
        value: to,
        duration: opts.duration || 1.5,
        ease: opts.ease || 'power2.out',
        snap: { value: (function () {
          if (!fmt) return 1
          var m = fmt.match(/\.(\d+)f/)
          if (m) { var d = parseInt(m[1]); return d > 0 ? Math.pow(10, -d) : 1 }
          return 1
        })() },
        onUpdate: function () {
          target.textContent = prefix + formatNumber(proxy.value, fmt) + suffix
        },
      }, opts.delay || 0)
    },

    // ── 5. drawPath ───────────────────────────────────────────────────────────
    drawPath: function (selector, opts) {
      opts = opts || {}
      var targets = els(selector)
      if (!targets.length || !opts.tl) return
      if (typeof DrawSVGPlugin === 'undefined') return

      gsap.set(targets, { drawSVG: opts.from || '0%' })
      opts.tl.to(targets, {
        drawSVG: opts.to || '100%',
        duration: opts.duration || 1.2,
        stagger: opts.stagger || 0,
        ease: opts.ease || 'power2.inOut',
      }, opts.delay || 0)
    },

    // ── 6. morphShape ─────────────────────────────────────────────────────────
    morphShape: function (selector, opts) {
      opts = opts || {}
      var target = el(selector)
      if (!target || !opts.tl || !opts.to) return
      if (typeof MorphSVGPlugin === 'undefined') return

      opts.tl.to(target, {
        morphSVG: opts.to,
        duration: opts.duration || 1,
        ease: opts.ease || 'power2.inOut',
      }, opts.delay || 0)
    },

    // ── 7. scaleIn ────────────────────────────────────────────────────────────
    scaleIn: function (selector, opts) {
      opts = opts || {}
      var targets = els(selector)
      if (!targets.length || !opts.tl) return

      gsap.set(targets, {
        scale: opts.from != null ? opts.from : 0,
        opacity: 0,
        transformOrigin: opts.transformOrigin || 'center center',
      })
      opts.tl.to(targets, {
        scale: 1, opacity: 1,
        duration: opts.duration || 0.6,
        stagger: opts.stagger || 0,
        ease: opts.ease || 'back.out(1.7)',
      }, opts.delay || 0)
    },

    // ── 8. slideIn ────────────────────────────────────────────────────────────
    slideIn: function (selector, opts) {
      opts = opts || {}
      var target = el(selector)
      if (!target || !opts.tl) return
      var from = opts.from || 'left'
      var dist = opts.distance || '100%'
      var startVars = { opacity: 0 }

      if (from === 'left') startVars.x = typeof dist === 'number' ? -dist : '-' + dist
      else if (from === 'right') startVars.x = dist
      else if (from === 'top') startVars.y = typeof dist === 'number' ? -dist : '-' + dist
      else if (from === 'bottom') startVars.y = dist

      gsap.set(target, startVars)
      opts.tl.to(target, {
        x: 0, y: 0, opacity: 1,
        duration: opts.duration || 0.8,
        ease: opts.ease || 'power3.out',
      }, opts.delay || 0)
    },

    // ── 9. progressBar ────────────────────────────────────────────────────────
    progressBar: function (selector, opts) {
      opts = opts || {}
      var target = el(selector)
      if (!target || !opts.tl) return
      var to = opts.to != null ? opts.to : 100

      gsap.set(target, { scaleX: 0, transformOrigin: 'left center' })
      if (opts.color) gsap.set(target, { backgroundColor: opts.color })

      opts.tl.to(target, {
        scaleX: to / 100,
        duration: opts.duration || 1,
        ease: opts.ease || 'power2.out',
      }, opts.delay || 0)
    },

    // ── 10. highlightReveal ───────────────────────────────────────────────────
    /**
     * @param {string} opts.style — 'underline'|'background'|'box'
     * @param {string} opts.color — highlight color
     */
    highlightReveal: function (selector, opts) {
      opts = opts || {}
      var target = el(selector)
      if (!target || !opts.tl) return

      var hlStyle = opts.style || 'background'
      var color = opts.color || '#FFE066'

      // Ensure target is positioned for the highlight
      var computed = getComputedStyle(target)
      if (computed.position === 'static') target.style.position = 'relative'
      if (computed.display === 'inline') target.style.display = 'inline-block'

      var highlight = document.createElement('span')
      highlight.setAttribute('aria-hidden', 'true')

      if (hlStyle === 'underline') {
        highlight.style.cssText =
          'position:absolute;bottom:0;left:0;right:0;height:4px;background:' + color +
          ';transform-origin:left;transform:scaleX(0);pointer-events:none;'
      } else if (hlStyle === 'box') {
        highlight.style.cssText =
          'position:absolute;inset:-4px -6px;border:3px solid ' + color +
          ';border-radius:4px;transform-origin:left;transform:scaleX(0);pointer-events:none;'
      } else {
        // background (default)
        highlight.style.cssText =
          'position:absolute;inset:0;z-index:-1;background:' + color +
          ';opacity:0.35;transform-origin:left;transform:scaleX(0);pointer-events:none;border-radius:3px;'
      }

      target.appendChild(highlight)

      opts.tl.to(highlight, {
        scaleX: 1,
        duration: opts.duration || 0.6,
        ease: opts.ease || 'power2.inOut',
      }, opts.delay || 0)
    },

    // ── 11. floatIn ───────────────────────────────────────────────────────────
    floatIn: function (selector, opts) {
      opts = opts || {}
      var targets = els(selector)
      if (!targets.length || !opts.tl) return
      var dir = opts.direction || 'up'
      var dist = opts.distance || 60
      var startVars = { opacity: 0 }

      if (dir === 'up') startVars.y = dist
      else if (dir === 'down') startVars.y = -dist
      else if (dir === 'left') startVars.x = -dist
      else if (dir === 'right') startVars.x = dist

      gsap.set(targets, startVars)
      opts.tl.to(targets, {
        x: 0, y: 0, opacity: 1,
        duration: opts.duration || 1,
        stagger: opts.stagger || 0,
        ease: opts.ease || 'back.out(1.4)',
      }, opts.delay || 0)
    },

    // ── 12. pathFollow ────────────────────────────────────────────────────────
    pathFollow: function (selector, opts) {
      opts = opts || {}
      var target = el(selector)
      if (!target || !opts.tl || !opts.path) return
      if (typeof MotionPathPlugin === 'undefined') return

      opts.tl.to(target, {
        motionPath: {
          path: opts.path,
          autoRotate: opts.align != null ? opts.align : (opts.autoRotate != null ? opts.autoRotate : true),
          alignOrigin: [0.5, 0.5],
        },
        duration: opts.duration || 2,
        ease: opts.ease || 'power1.inOut',
      }, opts.delay || 0)
    },

    // ── 13. flipReveal ────────────────────────────────────────────────────────
    flipReveal: function (selector, opts) {
      opts = opts || {}
      var targets = els(selector)
      if (!targets.length || !opts.tl) return
      var axis = (opts.axis || 'Y').toUpperCase()
      var prop = axis === 'X' ? 'rotationX' : 'rotationY'
      var setVars = { opacity: 0, transformPerspective: 800 }
      setVars[prop] = -90

      gsap.set(targets, setVars)

      var toVars = {
        opacity: 1,
        duration: opts.duration || 0.8,
        stagger: opts.stagger || 0,
        ease: opts.ease || 'power3.out',
      }
      toVars[prop] = 0

      opts.tl.to(targets, toVars, opts.delay || 0)
    },

    // ── 14. lottieSync ────────────────────────────────────────────────────────
    /**
     * Loads a Lottie animation and syncs it to the GSAP timeline via proxy.
     * WVC seeking works because GSAP fires onUpdate at any seeked time,
     * which calls anim.goToAndStop(frame, true) — perfect frame accuracy.
     *
     * @param {string|Element} selector — container element
     * @param {Object} opts
     * @param {string} opts.src — lottie.host URL (or any JSON URL)
     * @param {Object} [opts.animationData] — inline Lottie JSON (alternative to src)
     * @param {gsap.core.Timeline} opts.tl — timeline to add to
     * @param {number} [opts.delay=0]
     * @param {number} [opts.duration] — playback duration (default: Lottie's natural duration)
     * @param {string} [opts.renderer='svg']
     */
    lottieSync: function (selector, opts) {
      opts = opts || {}
      var container = el(selector)
      if (!container || !opts.tl) return
      if (typeof lottie === 'undefined') {
        console.warn('[CenchMotion] lottie-web not loaded — lottieSync skipped')
        return
      }

      var animConfig = {
        container: container,
        renderer: opts.renderer || 'svg',
        loop: false,
        autoplay: false,
      }
      if (opts.src) animConfig.path = opts.src
      else if (opts.animationData) animConfig.animationData = opts.animationData
      else return

      var anim = lottie.loadAnimation(animConfig)
      var delay = opts.delay || 0
      var tl = opts.tl
      var estDuration = opts.duration || (typeof DURATION !== 'undefined' ? DURATION : 8)

      // Drive Lottie via a normalized progress proxy (0→1).
      // The tween is placed on the timeline immediately so WVC sees the
      // correct time slot even before the Lottie JSON finishes loading.
      // Once DOMLoaded fires we store totalFrames and onUpdate starts
      // calling goToAndStop with the real frame number.
      var state = { progress: 0, totalFrames: 0, loaded: false }
      tl.to(state, {
        progress: 1,
        duration: estDuration,
        ease: 'none',
        onUpdate: function () {
          if (state.loaded) {
            anim.goToAndStop(state.progress * (state.totalFrames - 1), true)
          }
        },
      }, delay)

      anim.addEventListener('DOMLoaded', function () {
        state.totalFrames = anim.totalFrames || 1
        state.loaded = true
        anim.goToAndStop(0, true)
      })
    },
  }

  // ── Easing Presets ─────────────────────────────────────────────────────────
  // Named easing presets as GSAP-compatible strings. Generated scene code can
  // reference CenchMotion.easing.entrance.premium instead of magic strings.

  CenchMotion.easing = {
    entrance: {
      playful:    'back.out(1.4)',
      premium:    'power3.out',
      corporate:  'power2.inOut',
      energetic:  'back.out(2.0)',
    },
    exit: {
      playful:    'back.in(1.4)',
      premium:    'power2.in',
      corporate:  'power2.in',
      energetic:  'power3.in',
    },
    emphasis: {
      playful:    'back.out(1.7)',
      premium:    'expo.out',
      corporate:  'expo.out',
      energetic:  'back.out(2.5)',
    },
    ambient: {
      playful:    'sine.inOut',
      premium:    'sine.inOut',
      corporate:  'sine.inOut',
      energetic:  'sine.inOut',
    },
    // Standard curves as CSS cubic-bezier strings (for CustomEase or CSS transitions)
    css: {
      cenchEntrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
      cenchExit:     'cubic-bezier(0.7, 0, 0.84, 0)',
      md3Standard:   'cubic-bezier(0.2, 0, 0, 1)',
      md3Emphasized: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
      apple:         'cubic-bezier(0.28, 0, 0.1, 1)',
    },
  }

  global.CenchMotion = CenchMotion
})(typeof window !== 'undefined' ? window : globalThis)

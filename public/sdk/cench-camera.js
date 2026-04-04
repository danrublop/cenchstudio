/**
 * CenchCamera — Cinematic camera motion library for Cench Studio.
 *
 * All moves operate on #scene-camera (CSS/HTML scenes) or window.__threeCamera
 * (Three.js scenes) and are registered on window.__tl so WVC can seek them.
 *
 * Usage:
 *   CenchCamera.kenBurns({ duration: 8, endScale: 1.06 })
 *   CenchCamera.dollyIn({ targetSelector: '#title', at: 2 })
 *   CenchCamera.presetReveal()
 */
;(function (global) {
  'use strict'

  // ─── UTILITY ───────────────────────────────────────────────────────

  function getCamera() {
    return document.getElementById('scene-camera')
  }

  function addToTimeline(tween, startTime) {
    if (global.__tl) {
      global.__tl.add(tween, startTime != null ? startTime : '>')
    }
    return tween
  }

  function getSceneMetrics(cam) {
    var rect = cam.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width || 1920,
      height: rect.height || 1080,
    }
  }

  function resolveTargetRect(cam, opts) {
    if (!opts) return null
    var m = getSceneMetrics(cam)
    if (opts.targetRect && typeof opts.targetRect === 'object') {
      var tr = opts.targetRect
      if (
        tr.x != null && tr.y != null &&
        tr.width != null && tr.height != null
      ) {
        return {
          x: Number(tr.x),
          y: Number(tr.y),
          width: Math.max(1, Number(tr.width)),
          height: Math.max(1, Number(tr.height)),
        }
      }
    }
    if (opts.targetSelector) {
      var el = document.querySelector(opts.targetSelector)
      if (!el) return null
      var r = el.getBoundingClientRect()
      return {
        x: r.left - m.left,
        y: r.top - m.top,
        width: Math.max(1, r.width),
        height: Math.max(1, r.height),
      }
    }
    return null
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n))
  }

  function computeFitTransform(cam, rect, opts) {
    var m = getSceneMetrics(cam)
    var padding = opts && opts.padding != null ? opts.padding : 0.12
    var minScale = opts && opts.minScale != null ? opts.minScale : 1
    var maxScale = opts && opts.maxScale != null ? opts.maxScale : 2.2
    var extraScale = opts && opts.extraScale != null ? opts.extraScale : 1
    var padPxX = m.width * padding
    var padPxY = m.height * padding
    var fitW = Math.max(1, rect.width + padPxX * 2)
    var fitH = Math.max(1, rect.height + padPxY * 2)
    var scale = Math.min(m.width / fitW, m.height / fitH) * extraScale
    scale = clamp(scale, minScale, maxScale)
    var cx = rect.x + rect.width / 2
    var cy = rect.y + rect.height / 2
    var x = m.width / 2 - cx * scale
    var y = m.height / 2 - cy * scale
    var minX = m.width - m.width * scale
    var minY = m.height - m.height * scale
    x = clamp(x, minX, 0)
    y = clamp(y, minY, 0)
    return { x: x, y: y, scale: scale }
  }

  // ─── HTML/CSS CAMERA MOVES ─────────────────────────────────────────

  /**
   * Ken Burns — slow pan + zoom on static image/scene
   * Classic documentary zoom: very slow, almost imperceptible until you notice it
   */
  function kenBurns(opts) {
    opts = opts || {}
    var duration   = opts.duration   != null ? opts.duration   : 8
    var startScale = opts.startScale != null ? opts.startScale : 1.0
    var endScale   = opts.endScale   != null ? opts.endScale   : 1.08
    var startX     = opts.startX     != null ? opts.startX     : 0
    var startY     = opts.startY     != null ? opts.startY     : 0
    var endX       = opts.endX       != null ? opts.endX       : -1.5
    var endY       = opts.endY       != null ? opts.endY       : -0.8
    var ease       = opts.ease       || 'none'
    var at         = opts.at         != null ? opts.at         : 0

    var cam = getCamera()
    if (!cam) return

    gsap.set(cam, {
      scale: startScale,
      xPercent: startX,
      yPercent: startY,
    })

    var tween = gsap.to(cam, {
      scale: endScale,
      xPercent: endX,
      yPercent: endY,
      duration: duration,
      ease: ease,
    })

    return addToTimeline(tween, at)
  }

  /**
   * Dolly in — push toward a specific element or point as it's revealed
   */
  function dollyIn(opts) {
    opts = opts || {}
    var targetSelector = opts.targetSelector || null
    var fromScale      = opts.fromScale != null ? opts.fromScale : 1.0
    var toScale        = opts.toScale   != null ? opts.toScale   : 1.12
    var fromXPercent   = opts.fromX != null ? opts.fromX : 0
    var fromYPercent   = opts.fromY != null ? opts.fromY : 0
    var toXPercent     = opts.toX != null ? opts.toX : (opts.endX != null ? opts.endX : 0)
    var toYPercent     = opts.toY != null ? opts.toY : (opts.endY != null ? opts.endY : 0)
    var duration       = opts.duration  != null ? opts.duration  : 0.8
    var ease           = opts.ease      || 'power2.inOut'
    var at             = opts.at        != null ? opts.at        : '>'

    var cam = getCamera()
    if (!cam) return

    var targetRect = resolveTargetRect(cam, {
      targetSelector: targetSelector,
      targetRect: opts.targetRect,
    })
    var tween

    // Bounds-based framing is deterministic and keeps chart content centered.
    if (targetRect) {
      var fit = computeFitTransform(cam, targetRect, {
        padding: opts.padding,
        minScale: opts.minScale,
        maxScale: opts.maxScale,
        extraScale: opts.extraScale,
      })
      gsap.set(cam, {
        x: opts.fromX != null ? opts.fromX : 0,
        y: opts.fromY != null ? opts.fromY : 0,
        scale: opts.fromScale != null ? opts.fromScale : 1,
        transformOrigin: '0% 0%',
      })
      tween = gsap.to(cam, {
        x: fit.x,
        y: fit.y,
        scale: opts.toScale != null ? opts.toScale : fit.scale,
        duration: duration,
        ease: ease,
      })
    } else {
      gsap.set(cam, {
        scale: fromScale,
        xPercent: fromXPercent,
        yPercent: fromYPercent,
        transformOrigin: '50% 50%',
      })
      tween = gsap.to(cam, {
        scale: toScale,
        xPercent: toXPercent,
        yPercent: toYPercent,
        duration: duration,
        ease: ease,
      })
    }

    return addToTimeline(tween, at)
  }

  /**
   * Dolly out — pull back to reveal context
   */
  function dollyOut(opts) {
    opts = opts || {}
    var fromScale = opts.fromScale != null ? opts.fromScale : 1.12
    var toScale   = opts.toScale   != null ? opts.toScale   : 1.0
    var fromXPercent = opts.fromX != null ? opts.fromX : 0
    var fromYPercent = opts.fromY != null ? opts.fromY : 0
    var toXPercent = opts.toX != null ? opts.toX : (opts.endX != null ? opts.endX : 0)
    var toYPercent = opts.toY != null ? opts.toY : (opts.endY != null ? opts.endY : 0)
    var duration  = opts.duration  != null ? opts.duration  : 1.0
    var ease      = opts.ease      || 'power2.inOut'
    var at        = opts.at        != null ? opts.at        : '>'

    var cam = getCamera()
    if (!cam) return

    gsap.set(cam, {
      scale: fromScale,
      xPercent: fromXPercent,
      yPercent: fromYPercent,
      transformOrigin: '50% 50%',
    })

    var tween = gsap.to(cam, {
      scale: toScale,
      xPercent: toXPercent,
      yPercent: toYPercent,
      duration: duration,
      ease: ease,
    })

    return addToTimeline(tween, at)
  }

  /**
   * Pan — move the camera left/right/up/down
   */
  function pan(opts) {
    opts = opts || {}
    var fromX    = opts.fromX    != null ? opts.fromX    : 0
    var fromY    = opts.fromY    != null ? opts.fromY    : 0
    var toX      = opts.toX      != null ? opts.toX      : (opts.endX != null ? opts.endX : -5)
    var toY      = opts.toY      != null ? opts.toY      : (opts.endY != null ? opts.endY : 0)
    var duration = opts.duration != null ? opts.duration : 1.2
    var ease     = opts.ease     || 'power1.inOut'
    var at       = opts.at       != null ? opts.at       : '>'

    var cam = getCamera()
    if (!cam) return

    gsap.set(cam, { xPercent: fromX, yPercent: fromY })

    var tween = gsap.to(cam, {
      xPercent: toX,
      yPercent: toY,
      duration: duration,
      ease: ease,
    })

    return addToTimeline(tween, at)
  }

  /**
   * Rack focus — blur out current focus, snap to new subject, pull focus
   * Simulates lens rack focus using CSS blur
   */
  function rackFocus(opts) {
    opts = opts || {}
    var blurOut    = opts.blurOut    != null ? opts.blurOut    : 6
    var duration   = opts.duration   != null ? opts.duration   : 0.6
    var at         = opts.at         != null ? opts.at         : '>'
    var onMidpoint = opts.onMidpoint || null

    var cam = getCamera()
    if (!cam) return

    var tl = gsap.timeline()

    tl.to(cam, {
      filter: 'blur(' + blurOut + 'px)',
      duration: duration * 0.5,
      ease: 'power2.in',
      onComplete: onMidpoint,
    })

    tl.to(cam, {
      filter: 'blur(0px)',
      duration: duration * 0.5,
      ease: 'power2.out',
    })

    return addToTimeline(tl, at)
  }

  /**
   * Cut — instant frame recomposition
   * Jumps the camera to a new position/scale with no transition
   */
  function cut(opts) {
    opts = opts || {}
    var scale    = opts.scale    != null ? opts.scale    : 1.0
    var xPercent = opts.xPercent != null ? opts.xPercent : 0
    var yPercent = opts.yPercent != null ? opts.yPercent : 0
    var at       = opts.at       != null ? opts.at       : '>'

    var cam = getCamera()
    if (!cam) return

    var tween = gsap.to(cam, {
      scale: scale,
      xPercent: xPercent,
      yPercent: yPercent,
      filter: 'blur(0px)',
      duration: 0.001,
      ease: 'none',
    })

    return addToTimeline(tween, at)
  }

  /**
   * Shake — quick camera shake for impact moments
   */
  function shake(opts) {
    opts = opts || {}
    var intensity = opts.intensity != null ? opts.intensity : 6
    var duration  = opts.duration  != null ? opts.duration  : 0.4
    var at        = opts.at        != null ? opts.at        : '>'

    var cam = getCamera()
    if (!cam) return

    var shakeTimeline = gsap.timeline()
    for (var i = 0; i < 6; i++) {
      var sx = (Math.random() * 2 - 1) * intensity
      var sy = (Math.random() * 2 - 1) * (intensity / 2)
      shakeTimeline.to(cam, { x: sx, y: sy, duration: duration / 12, ease: 'none' })
      shakeTimeline.to(cam, { x: -sx * 0.5, y: -sy * 0.5, duration: duration / 12, ease: 'none' })
    }
    shakeTimeline.set(cam, { x: 0, y: 0 })

    return addToTimeline(shakeTimeline, at)
  }

  /**
   * Reset — return camera to neutral position
   */
  function reset(opts) {
    opts = opts || {}
    var duration = opts.duration != null ? opts.duration : 0.6
    var ease     = opts.ease     || 'power2.inOut'
    var at       = opts.at       != null ? opts.at       : '>'

    var cam = getCamera()
    if (!cam) return

    var tween = gsap.to(cam, {
      scale: 1,
      x: 0,
      y: 0,
      xPercent: 0,
      yPercent: 0,
      filter: 'blur(0px)',
      transformOrigin: '50% 50%',
      duration: duration,
      ease: ease,
    })

    return addToTimeline(tween, at)
  }

  // ─── THREE.JS CAMERA MOVES ─────────────────────────────────────────

  /**
   * Orbit — animate camera around a target point
   */
  function orbit(opts) {
    opts = opts || {}
    var radius     = opts.radius     != null ? opts.radius     : 5
    var startAngle = opts.startAngle != null ? opts.startAngle : 0
    var endAngle   = opts.endAngle   != null ? opts.endAngle   : Math.PI * 2
    var height     = opts.height     != null ? opts.height     : 2
    var targetX    = opts.targetX    != null ? opts.targetX    : 0
    var targetY    = opts.targetY    != null ? opts.targetY    : 0
    var targetZ    = opts.targetZ    != null ? opts.targetZ    : 0
    var duration   = opts.duration   != null ? opts.duration   : 6
    var ease       = opts.ease       || 'none'
    var at         = opts.at         != null ? opts.at         : 0

    var camera = global.__threeCamera
    if (!camera) {
      console.warn('[CenchCamera] orbit: window.__threeCamera not found.')
      return
    }

    var proxy = { angle: startAngle }

    var tween = gsap.to(proxy, {
      angle: endAngle,
      duration: duration,
      ease: ease,
      onUpdate: function () {
        camera.position.x = targetX + Math.cos(proxy.angle) * radius
        camera.position.z = targetZ + Math.sin(proxy.angle) * radius
        camera.position.y = height
        camera.lookAt(targetX, targetY, targetZ)
      },
    })

    return addToTimeline(tween, at)
  }

  /**
   * Dolly3D — move Three.js camera forward/backward along its view axis
   */
  function dolly3D(opts) {
    opts = opts || {}
    var from     = opts.from     || { x: 0, y: 2, z: 8 }
    var to       = opts.to       || { x: 0, y: 1.5, z: 5 }
    var lookAt   = opts.lookAt   || { x: 0, y: 0, z: 0 }
    var duration = opts.duration != null ? opts.duration : 1.5
    var ease     = opts.ease     || 'power2.inOut'
    var at       = opts.at       != null ? opts.at       : '>'

    var camera = global.__threeCamera
    if (!camera) {
      console.warn('[CenchCamera] dolly3D: window.__threeCamera not found.')
      return
    }

    var proxy = { x: from.x, y: from.y, z: from.z }

    var tween = gsap.to(proxy, {
      x: to.x,
      y: to.y,
      z: to.z,
      duration: duration,
      ease: ease,
      onUpdate: function () {
        camera.position.set(proxy.x, proxy.y, proxy.z)
        camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
      },
    })

    return addToTimeline(tween, at)
  }

  /**
   * RackFocus3D — animate Three.js camera FOV (focal length change)
   */
  function rackFocus3D(opts) {
    opts = opts || {}
    var fromFov  = opts.fromFov  != null ? opts.fromFov  : 60
    var toFov    = opts.toFov    != null ? opts.toFov    : 35
    var duration = opts.duration != null ? opts.duration : 1.0
    var ease     = opts.ease     || 'power2.inOut'
    var at       = opts.at       != null ? opts.at       : '>'

    var camera = global.__threeCamera
    if (!camera) {
      console.warn('[CenchCamera] rackFocus3D: window.__threeCamera not found.')
      return
    }

    camera.fov = fromFov
    camera.updateProjectionMatrix()

    var proxy = { fov: fromFov }

    var tween = gsap.to(proxy, {
      fov: toFov,
      duration: duration,
      ease: ease,
      onUpdate: function () {
        camera.fov = proxy.fov
        camera.updateProjectionMatrix()
      },
    })

    return addToTimeline(tween, at)
  }

  // ─── PRESET SEQUENCES ──────────────────────────────────────────────

  /**
   * Reveal sequence — Ken Burns while content animates in
   */
  function presetReveal(opts) {
    opts = opts || {}
    var duration = opts.duration != null ? opts.duration : 8
    kenBurns({ duration: duration, startScale: 1.0, endScale: 1.06, endX: -1, endY: -0.5 })
  }

  /**
   * Emphasis sequence — dolly in to emphasize a key stat or element
   */
  function presetEmphasis(opts) {
    opts = opts || {}
    var targetSelector = opts.targetSelector || null
    var at = opts.at != null ? opts.at : '>'
    dollyIn({ targetSelector: targetSelector, toScale: 1.15, duration: 0.7, at: at })
    reset({ duration: 0.8, at: '>+1.5' })
  }

  /**
   * Cinematic push — slow broadcast-style push, good for avatar scenes
   */
  function presetCinematicPush(opts) {
    opts = opts || {}
    var duration = opts.duration != null ? opts.duration : 10
    kenBurns({
      duration: duration,
      startScale: 1.05,
      endScale: 1.0,
      startX: 0.5,
      startY: 0.3,
      endX: 0,
      endY: 0,
      ease: 'power1.inOut',
    })
  }

  /**
   * Rack focus transition — blur out, swap content, pull focus
   */
  function presetRackTransition(opts) {
    opts = opts || {}
    var at = opts.at != null ? opts.at : '>'
    rackFocus({ blurOut: 8, duration: 0.7, at: at })
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────

  global.CenchCamera = {
    // CSS/HTML camera
    kenBurns: kenBurns,
    dollyIn: dollyIn,
    dollyOut: dollyOut,
    pan: pan,
    rackFocus: rackFocus,
    cut: cut,
    shake: shake,
    reset: reset,
    // Three.js camera
    orbit: orbit,
    dolly3D: dolly3D,
    rackFocus3D: rackFocus3D,
    // Presets
    presetReveal: presetReveal,
    presetEmphasis: presetEmphasis,
    presetCinematicPush: presetCinematicPush,
    presetRackTransition: presetRackTransition,
  }
})(window)

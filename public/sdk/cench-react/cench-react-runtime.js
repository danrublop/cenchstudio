/**
 * CenchReact Runtime — Remotion-style React API for Cench Studio scenes.
 *
 * Provides: CenchComposition, useCurrentFrame, useVideoConfig,
 *           interpolate, spring, Sequence, AbsoluteFill
 *
 * Exposed on window.CenchReact (IIFE, no module bundler needed).
 * Requires React 18+ and GSAP (window.__tl) to be loaded first.
 */
;(function () {
  'use strict'

  var React = window.React
  if (!React) throw new Error('CenchReact: React 18+ must be loaded before cench-react-runtime.js')

  // ── Context ──────────────────────────────────────────────────────────────

  var FrameContext = React.createContext({ frame: 0, fps: 30, width: 1920, height: 1080, durationInFrames: 240 })

  function useCurrentFrame() {
    return React.useContext(FrameContext).frame
  }

  function useVideoConfig() {
    var ctx = React.useContext(FrameContext)
    return { fps: ctx.fps, width: ctx.width, height: ctx.height, durationInFrames: ctx.durationInFrames }
  }

  // ── CenchComposition ─────────────────────────────────────────────────────

  function CenchComposition(props) {
    var fps = props.fps || 30
    var width = props.width || 1920
    var height = props.height || 1080
    var durationInFrames = props.durationInFrames || Math.round((window.DURATION || 8) * fps)

    var frameRef = React.useRef(0)
    var _a = React.useState(0), frame = _a[0], setFrame = _a[1]

    React.useEffect(function () {
      function updateFrame(f) {
        if (f !== frameRef.current) {
          frameRef.current = f
          setFrame(f)
        }
      }

      // Bridge from GSAP timeline -> React frame
      function hookTimeline() {
        var tl = window.__tl
        if (!tl) return false
        var prevCb = tl.eventCallback('onUpdate')
        tl.eventCallback('onUpdate', function () {
          if (prevCb) prevCb()
          updateFrame(Math.round(tl.time() * fps))
        })
        return true
      }

      // Try immediately; if __tl isn't ready yet, poll briefly
      if (!hookTimeline()) {
        var attempts = 0
        var poll = setInterval(function () {
          attempts++
          if (hookTimeline() || attempts > 50) clearInterval(poll)
        }, 50)
      }

      // Direct frame control for Puppeteer export
      window.__cenchSetFrame = function (f) { updateFrame(f) }

      // Hook into __advanceFrame (virtual time export mode)
      var origAdvance = window.__advanceFrame
      window.__advanceFrame = function (ms) {
        if (origAdvance) origAdvance(ms)
        updateFrame(Math.round((ms / 1000) * fps))
      }

      return function () {
        delete window.__cenchSetFrame
        if (origAdvance) window.__advanceFrame = origAdvance
      }
    }, [fps])

    var ctx = React.useMemo(function () {
      return { frame: frame, fps: fps, width: width, height: height, durationInFrames: durationInFrames }
    }, [frame, fps, width, height, durationInFrames])

    return React.createElement(FrameContext.Provider, { value: ctx }, props.children)
  }

  // ── interpolate ──────────────────────────────────────────────────────────

  function interpolate(value, inputRange, outputRange, options) {
    if (inputRange.length !== outputRange.length) {
      throw new Error('interpolate: inputRange and outputRange must have the same length')
    }
    if (inputRange.length < 2) {
      throw new Error('interpolate: ranges must have at least 2 values')
    }

    var opts = options || {}
    var extrapolateLeft = opts.extrapolateLeft || 'clamp'
    var extrapolateRight = opts.extrapolateRight || 'clamp'
    var easing = opts.easing || function (t) { return t }

    // Find the correct segment
    var segIdx = inputRange.length - 2 // default to last segment
    for (var i = 1; i < inputRange.length; i++) {
      if (value <= inputRange[i]) { segIdx = i - 1; break }
    }

    var inMin = inputRange[segIdx]
    var inMax = inputRange[segIdx + 1]
    var outMin = outputRange[segIdx]
    var outMax = outputRange[segIdx + 1]

    // Normalize to 0-1 (guard against identical input values)
    var t = inMax === inMin ? 1 : (value - inMin) / (inMax - inMin)

    // Clamping
    if (t < 0) t = extrapolateLeft === 'clamp' ? 0 : t
    if (t > 1) t = extrapolateRight === 'clamp' ? 1 : t

    // Apply easing only within 0-1 range
    var easedT = (t >= 0 && t <= 1) ? easing(t) : t

    return outMin + (outMax - outMin) * easedT
  }

  // ── spring ───────────────────────────────────────────────────────────────

  function spring(params) {
    var frame = params.frame
    var fps = params.fps || 30
    var from = params.from !== undefined ? params.from : 0
    var to = params.to !== undefined ? params.to : 1
    var config = params.config || {}

    // Clamp negative frames to 0 (before spring starts)
    if (frame < 0) return from

    var damping = config.damping !== undefined ? config.damping : 10
    var mass = config.mass !== undefined ? config.mass : 1
    var stiffness = config.stiffness !== undefined ? config.stiffness : 100
    var overshootClamping = config.overshootClamping || false

    var t = frame / fps
    var omega0 = Math.sqrt(stiffness / mass)
    var zeta = damping / (2 * Math.sqrt(stiffness * mass))

    var value
    if (zeta < 1 - 1e-8) {
      // Underdamped (with epsilon guard against floating-point edge)
      var omega1 = omega0 * Math.sqrt(1 - zeta * zeta)
      value = 1 - Math.exp(-zeta * omega0 * t) * (
        Math.cos(omega1 * t) + (zeta * omega0 / omega1) * Math.sin(omega1 * t)
      )
    } else if (zeta < 1 + 1e-8) {
      // Critically damped (covers floating-point zone around zeta=1)
      value = 1 - Math.exp(-omega0 * t) * (1 + omega0 * t)
    } else {
      // Overdamped
      var disc = Math.sqrt(zeta * zeta - 1)
      var s1 = -omega0 * (zeta - disc)
      var s2 = -omega0 * (zeta + disc)
      var denom = s2 - s1
      if (Math.abs(denom) < 1e-10) {
        value = 1 - Math.exp(-omega0 * t) * (1 + omega0 * t)
      } else {
        value = 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / denom
      }
    }

    if (overshootClamping) {
      value = Math.min(Math.max(value, 0), 1)
    }

    return from + (to - from) * value
  }

  // ── Sequence ─────────────────────────────────────────────────────────────

  function Sequence(props) {
    var parentFrame = useCurrentFrame()
    var parentConfig = useVideoConfig()

    var from = Math.max(0, props.from || 0) // No negative from
    var durationInFrames = props.durationInFrames || Infinity

    var localFrame = parentFrame - from
    if (localFrame < 0 || (durationInFrames !== Infinity && localFrame >= durationInFrames)) return null

    var localCtx = {
      frame: localFrame,
      fps: parentConfig.fps,
      width: parentConfig.width,
      height: parentConfig.height,
      durationInFrames: durationInFrames === Infinity ? parentConfig.durationInFrames - from : durationInFrames,
    }

    return React.createElement(
      FrameContext.Provider,
      { value: localCtx },
      props.children
    )
  }

  // ── AbsoluteFill ─────────────────────────────────────────────────────────

  function AbsoluteFill(props) {
    var baseStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }

    var mergedStyle = props.style ? Object.assign({}, baseStyle, props.style) : baseStyle

    return React.createElement(
      'div',
      { style: mergedStyle, className: props.className || '' },
      props.children
    )
  }

  // ── Easing helpers ───────────────────────────────────────────────────────

  var Easing = {
    linear: function (t) { return t },
    ease: function (t) { return t * t * (3 - 2 * t) },
    easeIn: function (t) { return t * t },
    easeOut: function (t) { return t * (2 - t) },
    easeInOut: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t },
    bezier: function (x1, y1, x2, y2) {
      return function (t) {
        // Clamp t for bezier (only valid in 0-1)
        var ct = Math.max(0, Math.min(1, t))
        var lo = 0, hi = 1, mid
        for (var i = 0; i < 20; i++) {
          mid = (lo + hi) / 2
          var x = 3 * (1 - mid) * (1 - mid) * mid * x1 + 3 * (1 - mid) * mid * mid * x2 + mid * mid * mid
          if (x < ct) lo = mid; else hi = mid
        }
        return 3 * (1 - mid) * (1 - mid) * mid * y1 + 3 * (1 - mid) * mid * mid * y2 + mid * mid * mid
      }
    },
  }

  // ── Spring config presets ─────────────────────────────────────────────────

  spring.config = {
    default: { damping: 10, mass: 1, stiffness: 100 },
    gentle: { damping: 15, mass: 1, stiffness: 80 },
    wobbly: { damping: 8, mass: 1, stiffness: 120 },
    stiff: { damping: 20, mass: 1, stiffness: 200 },
    molasses: { damping: 25, mass: 1, stiffness: 60 },
    snappy: { damping: 12, mass: 0.8, stiffness: 160 },
  }

  // ── Variable Context ──────────────────────────────────────────────────────

  var VariableContext = React.createContext({})

  // ── useVariable ──────────────────────────────────────────────────────────
  // Reactive state synced with parent via postMessage.
  // Usage: var [count, setCount] = useVariable('count', 0)

  function useVariable(name, defaultValue) {
    var initial = (window.__CENCH_VARIABLES && window.__CENCH_VARIABLES[name] !== undefined)
      ? window.__CENCH_VARIABLES[name]
      : defaultValue
    var _s = React.useState(initial), value = _s[0], _setValue = _s[1]

    // Listen for parent pushing variable updates
    React.useEffect(function () {
      function onChanged(e) {
        if (e.detail && e.detail.name === name) {
          _setValue(e.detail.value)
        }
      }
      window.addEventListener('cench:variable-changed', onChanged)
      return function () { window.removeEventListener('cench:variable-changed', onChanged) }
    }, [name])

    var setValue = React.useCallback(function (newValue) {
      // Resolve function updaters
      var resolved = typeof newValue === 'function' ? newValue(value) : newValue
      _setValue(resolved)
      // Persist to global store
      if (!window.__CENCH_VARIABLES) window.__CENCH_VARIABLES = {}
      window.__CENCH_VARIABLES[name] = resolved
      // Notify parent
      if (window.__cenchPostToParent) {
        window.__cenchPostToParent({ type: 'variable_changed', name: name, value: resolved })
      }
    }, [name, value])

    return [value, setValue]
  }

  // ── useInteraction ───────────────────────────────────────────────────────
  // Returns event handler props for interactive elements.
  // Usage: var btn = useInteraction('my-button')
  //        <div {...btn.handlers} style={{ opacity: btn.isHovered ? 1 : 0.7 }}>

  function useInteraction(elementId) {
    var _h = React.useState(false), isHovered = _h[0], setHovered = _h[1]
    var _c = React.useState(false), isClicked = _c[0], setClicked = _c[1]

    var notify = React.useCallback(function (type, data) {
      if (window.__cenchPostToParent) {
        window.__cenchPostToParent({ type: type, elementId: elementId, data: data || {} })
      }
    }, [elementId])

    var handlers = React.useMemo(function () {
      return {
        onClick: function (e) {
          setClicked(true)
          notify('element_clicked', { x: e?.clientX, y: e?.clientY })
          // Reset click state after animation
          setTimeout(function () { setClicked(false) }, 300)
        },
        onMouseEnter: function () {
          setHovered(true)
          notify('element_hovered', { hovered: true })
        },
        onMouseLeave: function () {
          setHovered(false)
          notify('element_hovered', { hovered: false })
        },
        onTouchStart: function () {
          setHovered(true)
        },
        onTouchEnd: function () {
          setHovered(false)
          setClicked(true)
          notify('element_clicked')
          setTimeout(function () { setClicked(false) }, 300)
        },
        style: { cursor: 'pointer' },
      }
    }, [notify])

    return {
      handlers: handlers,
      isHovered: isHovered,
      isClicked: isClicked,
      // Convenience: spread these directly on an element
      onClick: handlers.onClick,
      onMouseEnter: handlers.onMouseEnter,
      onMouseLeave: handlers.onMouseLeave,
      onTouchStart: handlers.onTouchStart,
      onTouchEnd: handlers.onTouchEnd,
    }
  }

  // ── useTrigger ───────────────────────────────────────────────────────────
  // Named events that cross the iframe boundary.
  // Usage: var details = useTrigger('show-details')
  //        details.fire({ itemId: 42 })
  //        details.onFired(function(payload) { ... })

  function useTrigger(name) {
    var callbackRef = React.useRef(null)

    // Listen for triggers from parent
    React.useEffect(function () {
      function onTrigger(e) {
        if (e.detail && e.detail.name === name && callbackRef.current) {
          callbackRef.current(e.detail.payload)
        }
      }
      window.addEventListener('cench:trigger', onTrigger)
      return function () { window.removeEventListener('cench:trigger', onTrigger) }
    }, [name])

    var fire = React.useCallback(function (payload) {
      if (window.__cenchPostToParent) {
        window.__cenchPostToParent({ type: 'interaction_event', name: name, payload: payload })
      }
    }, [name])

    var onFired = React.useCallback(function (cb) {
      callbackRef.current = cb
    }, [])

    return { fire: fire, onFired: onFired }
  }

  // ── useCenchSeek ─────────────────────────────────────────────────────────
  // Fires on every timeline seek/scrub with the target time in seconds.
  // Use this for React components that animate outside the GSAP timeline
  // and need to reflect the scrubbed position.
  // Usage: useCenchSeek(function(t) { setPosition(t * 100) })

  function useCenchSeek(cb) {
    var cbRef = React.useRef(cb)
    React.useEffect(function () { cbRef.current = cb }, [cb])
    React.useEffect(function () {
      if (!window.__cench || typeof window.__cench.onSeek !== 'function') return
      var off = window.__cench.onSeek(function (t) {
        if (cbRef.current) cbRef.current(t)
      })
      return off
    }, [])
  }

  // ── useCenchTime ─────────────────────────────────────────────────────────
  // Returns current scene time in seconds, kept in sync with playback AND scrub.
  // Piggybacks on the GSAP master timeline's onUpdate (fires on both play tick
  // and seek re-eval) and also subscribes to explicit seek events for safety.
  // Usage: var t = useCenchTime(); var x = interpolate(t, [0, 1, 2], [0, 50, 100])

  function useCenchTime() {
    var _s = React.useState(function () {
      return window.__tl && typeof window.__tl.time === 'function' ? window.__tl.time() : 0
    })
    var time = _s[0]
    var setTime = _s[1]
    var timeRef = React.useRef(time)

    React.useEffect(function () {
      function update(t) {
        if (t === timeRef.current) return
        timeRef.current = t
        setTime(t)
      }

      // Hook GSAP master timeline onUpdate (covers play + seek)
      function hookTimeline() {
        var tl = window.__tl
        if (!tl || typeof tl.eventCallback !== 'function') return false
        var prevCb = tl.eventCallback('onUpdate')
        tl.eventCallback('onUpdate', function () {
          if (prevCb) prevCb()
          update(tl.time())
        })
        return true
      }
      var pollId = null
      if (!hookTimeline()) {
        var attempts = 0
        pollId = setInterval(function () {
          attempts++
          if (hookTimeline() || attempts > 50) {
            clearInterval(pollId)
            pollId = null
          }
        }, 50)
      }

      // Also subscribe to the scrub registry for scenes where GSAP onUpdate is absent
      var off = (window.__cench && typeof window.__cench.onSeek === 'function')
        ? window.__cench.onSeek(update)
        : null

      return function () {
        if (pollId) clearInterval(pollId)
        if (off) off()
      }
    }, [])

    return time
  }

  // ── Enhanced CenchComposition (wraps with VariableContext) ───────────────

  var _OriginalComposition = CenchComposition
  CenchComposition = function CenchCompositionWithVariables(props) {
    var varsRef = React.useRef(window.__CENCH_VARIABLES || {})
    return React.createElement(
      VariableContext.Provider,
      { value: varsRef.current },
      React.createElement(_OriginalComposition, props)
    )
  }

  // ── Export ────────────────────────────────────────────────────────────────

  window.CenchReact = {
    CenchComposition: CenchComposition,
    useCurrentFrame: useCurrentFrame,
    useVideoConfig: useVideoConfig,
    interpolate: interpolate,
    spring: spring,
    Sequence: Sequence,
    AbsoluteFill: AbsoluteFill,
    Easing: Easing,
    // Interactivity hooks
    useVariable: useVariable,
    useInteraction: useInteraction,
    useTrigger: useTrigger,
    // Scrub hooks
    useCenchSeek: useCenchSeek,
    useCenchTime: useCenchTime,
    // Internal contexts
    _FrameContext: FrameContext,
    _VariableContext: VariableContext,
  }
})()

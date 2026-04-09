/**
 * CenchReact Bridge Components — wrap imperative renderers in React components.
 *
 * Provides: Canvas2DLayer, ThreeJSLayer, D3Layer, SVGLayer, LottieLayer
 *
 * Each bridge uses useCurrentFrame() to drive per-frame updates via refs,
 * avoiding React re-renders for the heavy imperative work.
 *
 * Requires cench-react-runtime.js to be loaded first.
 */
;(function () {
  'use strict'

  var React = window.React
  var CR = window.CenchReact
  if (!CR) throw new Error('CenchReact bridges: cench-react-runtime.js must be loaded first')

  var useCurrentFrame = CR.useCurrentFrame
  var useVideoConfig = CR.useVideoConfig

  // ── Canvas2DLayer ────────────────────────────────────────────────────────

  var Canvas2DLayer = React.memo(function Canvas2DLayer(props) {
    var canvasRef = React.useRef(null)
    var drawRef = React.useRef(props.draw)
    drawRef.current = props.draw

    var frame = useCurrentFrame()
    var config = useVideoConfig()
    var w = props.width || config.width
    var h = props.height || config.height

    React.useEffect(function () {
      var canvas = canvasRef.current
      if (!canvas) return
      var ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      try {
        if (drawRef.current) {
          drawRef.current(ctx, frame, {
            width: w,
            height: h,
            fps: config.fps,
            PALETTE: window.PALETTE,
            FONT: window.FONT,
            DURATION: window.DURATION,
          })
        }
      } catch (e) {
        console.error('Canvas2DLayer draw error:', e)
      } finally {
        ctx.restore()
      }
    }, [frame, w, h, config.fps])

    return React.createElement('canvas', {
      ref: canvasRef,
      width: w,
      height: h,
      style: Object.assign({ display: 'block', width: '100%', height: '100%' }, props.style || {}),
    })
  })

  // ── ThreeJSLayer ─────────────────────────────────────────────────────────

  var ThreeJSLayer = React.memo(function ThreeJSLayer(props) {
    var containerRef = React.useRef(null)
    var stateRef = React.useRef(null)
    var updateRef = React.useRef(props.update)
    updateRef.current = props.update

    var frame = useCurrentFrame()
    var config = useVideoConfig()

    React.useEffect(function () {
      var THREE = window.THREE
      if (!THREE || !containerRef.current) {
        if (!THREE) console.warn('ThreeJSLayer: window.THREE not loaded')
        return
      }

      var w = config.width
      var h = config.height
      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(1)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      containerRef.current.appendChild(renderer.domElement)

      var scene = new THREE.Scene()
      var camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
      camera.position.z = 5

      stateRef.current = { scene: scene, camera: camera, renderer: renderer }

      if (props.setup) {
        try {
          props.setup(THREE, scene, camera, renderer)
        } catch (e) {
          console.error('ThreeJSLayer setup error:', e)
        }
      }

      return function () {
        // Dispose geometries, materials, AND textures to prevent GPU memory leaks
        var texKeys = ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','envMap','aoMap','bumpMap','displacementMap','lightMap','alphaMap']
        if (stateRef.current && stateRef.current.scene) {
          stateRef.current.scene.traverse(function (obj) {
            if (obj.geometry) obj.geometry.dispose()
            if (obj.material) {
              var mats = Array.isArray(obj.material) ? obj.material : [obj.material]
              mats.forEach(function (m) {
                texKeys.forEach(function (key) {
                  if (m[key] && typeof m[key].dispose === 'function') m[key].dispose()
                })
                m.dispose()
              })
            }
          })
          // Dispose environment map if set on scene
          if (stateRef.current.scene.environment && typeof stateRef.current.scene.environment.dispose === 'function') {
            stateRef.current.scene.environment.dispose()
          }
        }
        renderer.dispose()
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement)
        }
        stateRef.current = null
      }
    }, [])

    React.useEffect(function () {
      var s = stateRef.current
      if (!s) return
      try {
        if (updateRef.current) {
          updateRef.current(s.scene, s.camera, frame, {
            fps: config.fps,
            width: config.width,
            height: config.height,
            PALETTE: window.PALETTE,
            DURATION: window.DURATION,
          })
        }
      } catch (e) {
        console.error('ThreeJSLayer update error:', e)
      }
      s.renderer.render(s.scene, s.camera)
    }, [frame])

    return React.createElement('div', {
      ref: containerRef,
      style: Object.assign({
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }, props.style || {}),
    })
  })

  // ── D3Layer ──────────────────────────────────────────────────────────────

  var D3Layer = React.memo(function D3Layer(props) {
    var containerRef = React.useRef(null)
    var setupRef = React.useRef(props.setup)
    var updateRef = React.useRef(props.update)
    setupRef.current = props.setup
    updateRef.current = props.update

    var frame = useCurrentFrame()
    var config = useVideoConfig()
    var initDone = React.useRef(false)

    React.useEffect(function () {
      var d3 = window.d3
      if (!d3) {
        console.warn('D3Layer: window.d3 not loaded — include D3 CDN in your scene')
        return
      }
      if (!containerRef.current) return
      if (!initDone.current && setupRef.current) {
        try {
          setupRef.current(d3, containerRef.current, {
            fps: config.fps,
            width: config.width,
            height: config.height,
            PALETTE: window.PALETTE,
            DURATION: window.DURATION,
            DATA: window.DATA,
          })
        } catch (e) {
          console.error('D3Layer setup error:', e)
        }
        initDone.current = true
      }

      return function () { initDone.current = false }
    }, [])

    React.useEffect(function () {
      var d3 = window.d3
      if (!d3 || !containerRef.current || !initDone.current) return
      if (updateRef.current) {
        try {
          updateRef.current(d3, containerRef.current, frame, {
            fps: config.fps,
            width: config.width,
            height: config.height,
            PALETTE: window.PALETTE,
            DURATION: window.DURATION,
            DATA: window.DATA,
          })
        } catch (e) {
          console.error('D3Layer update error:', e)
        }
      }
    }, [frame])

    return React.createElement('div', {
      ref: containerRef,
      style: Object.assign({ width: '100%', height: '100%' }, props.style || {}),
    })
  })

  // ── SVGLayer ─────────────────────────────────────────────────────────────

  var SVGLayer = React.memo(function SVGLayer(props) {
    var svgRef = React.useRef(null)
    var config = useVideoConfig()
    var initDone = React.useRef(false)

    React.useEffect(function () {
      if (!svgRef.current || initDone.current) return
      if (props.setup) {
        try {
          props.setup(svgRef.current, window.gsap || null, window.__tl || null)
        } catch (e) {
          console.error('SVGLayer setup error:', e)
        }
        initDone.current = true
      }

      return function () { initDone.current = false }
    }, [])

    return React.createElement(
      'svg',
      {
        ref: svgRef,
        viewBox: props.viewBox || '0 0 ' + config.width + ' ' + config.height,
        xmlns: 'http://www.w3.org/2000/svg',
        style: Object.assign({
          width: '100%',
          height: '100%',
          display: 'block',
        }, props.style || {}),
      },
      props.children
    )
  })

  // ── LottieLayer ──────────────────────────────────────────────────────────

  var LottieLayer = React.memo(function LottieLayer(props) {
    var containerRef = React.useRef(null)
    var animRef = React.useRef(null)

    var frame = useCurrentFrame()
    var config = useVideoConfig()

    React.useEffect(function () {
      var lottie = window.lottie
      if (!lottie) {
        console.warn('LottieLayer: window.lottie not loaded — include lottie-web CDN')
        return
      }
      if (!containerRef.current || !props.data) return

      var animData
      try {
        animData = typeof props.data === 'string' ? JSON.parse(props.data) : props.data
      } catch (e) {
        console.error('LottieLayer: Invalid JSON data', e)
        return
      }

      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: animData,
      })

      return function () {
        if (animRef.current) {
          animRef.current.destroy()
          animRef.current = null
        }
      }
    }, [props.data])

    React.useEffect(function () {
      if (!animRef.current) return
      var totalFrames = animRef.current.totalFrames
      var lottieFps = animRef.current.frameRate || 30
      var time = frame / config.fps
      var lottieFrame = Math.max(0, Math.min(time * lottieFps, totalFrames - 1))
      animRef.current.goToAndStop(lottieFrame, true)
    }, [frame, config.fps])

    return React.createElement('div', {
      ref: containerRef,
      style: Object.assign({ width: '100%', height: '100%' }, props.style || {}),
    })
  })

  // ── Export ────────────────────────────────────────────────────────────────

  Object.assign(window.CenchReact, {
    Canvas2DLayer: Canvas2DLayer,
    ThreeJSLayer: ThreeJSLayer,
    D3Layer: D3Layer,
    SVGLayer: SVGLayer,
    LottieLayer: LottieLayer,
  })
})()

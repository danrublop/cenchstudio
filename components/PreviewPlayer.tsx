'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play, Pause, RotateCcw, Layers,
  SquareDashedMousePointer, Expand, Shrink,
  AlignStartVertical,
} from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import Timeline from './timeline'
import SvgObjectEditor from './SvgObjectEditor'
import SvgElementEditor from './SvgElementEditor'
import SceneGraphEditor from './SceneGraphEditor'
import InteractionOverlay from './InteractionOverlay'
import type { Scene } from '@/lib/types'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const ZOOM_BTN_STEP = 0.25

export default function PreviewPlayer() {
  const {
    scenes, selectedSceneId, isGenerating, generatingSceneId,
    captureSceneThumbnail, timelineHeight, setTimelineHeight, sceneHtmlVersion,
    saveSceneHTML, project,
  } = useVideoStore()
  const outputMode = project.outputMode

  const selectedScene    = scenes.find(s => s.id === selectedSceneId)
  const viewportRef      = useRef<HTMLDivElement>(null)
  const canvasRef        = useRef<HTMLDivElement>(null)
  const iframeMapRef     = useRef<Record<string, HTMLIFrameElement | null>>({})
  const lastWheelTs      = useRef(0)
  const dragOrigin       = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const animFrameRef     = useRef<number>()
  const startTimeRef     = useRef(0)
  const scenesRef        = useRef(scenes)
  const selectedIdRef    = useRef(selectedSceneId)
  const isPlayingRef     = useRef(false)
  const currentTimeRef   = useRef(0)
  const isTickAdvancing  = useRef(false)   // set true when tick calls selectScene

  // ── State ─────────────────────────────────────────────────────────────────
  const [isPlaying,        setIsPlaying]        = useState(false)
  const [currentTime,      setCurrentTime]      = useState(0)
  const [seekTimes,        setSeekTimes]        = useState<Record<string, number>>({})
  const [sceneVersions,    setSceneVersions]    = useState<Record<string, number>>({})
  const [loadedScenes,     setLoadedScenes]     = useState<Set<string>>(new Set())
  const [timelineView, setTimelineView] = useState<'track' | 'graph'>('track')
  const [zoom,             setZoom]             = useState(1)
  const [panX,             setPanX]             = useState(0)
  const [panY,             setPanY]             = useState(0)
  const [isDragging,       setIsDragging]       = useState(false)
  const [isFullscreen,     setIsFullscreen]     = useState(false)
  const [showObjectEditor, setShowObjectEditor] = useState(false)
  const [showSelectMode,   setShowSelectMode]   = useState(false)
  const [visualScrubTime,  setVisualScrubTime]  = useState<number | null>(null)

  const timelineDrag = useRef<{ startY: number; startH: number } | null>(null)
  const scrubBarRef  = useRef<HTMLDivElement>(null)
  const isScrubbing  = useRef(false)

  // ── One-time: resave HTML for any non-SVG scenes already in the store ──────
  useEffect(() => {
    scenes.filter(s => {
      if (s.sceneType === 'canvas2d') return !!s.canvasCode
      if (s.sceneType === 'motion' || s.sceneType === 'd3' || s.sceneType === 'three') return !!s.sceneCode
      if (s.sceneType === 'lottie') return !!s.lottieSource
      return false
    }).forEach(s => saveSceneHTML(s.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep refs in sync with state
  useEffect(() => { scenesRef.current = scenes },              [scenes])
  useEffect(() => { selectedIdRef.current = selectedSceneId }, [selectedSceneId])
  useEffect(() => { isPlayingRef.current = isPlaying },        [isPlaying])
  useEffect(() => { currentTimeRef.current = currentTime },    [currentTime])

  const totalDuration    = scenes.reduce((a, s) => a + s.duration, 0)
  const isThisGenerating = isGenerating && generatingSceneId === selectedSceneId

  // ── Auto-reload when scene HTML file changes on disk ──────────────────────
  const prevHtmlVersion = useRef(sceneHtmlVersion)
  useEffect(() => {
    if (sceneHtmlVersion !== prevHtmlVersion.current) {
      prevHtmlVersion.current = sceneHtmlVersion
      if (selectedSceneId) {
        setSceneVersions(prev => ({ ...prev, [selectedSceneId]: (prev[selectedSceneId] ?? 0) + 1 }))
        setLoadedScenes(prev => { const n = new Set(prev); n.delete(selectedSceneId); return n })
      }
    }
  }, [sceneHtmlVersion, selectedSceneId])

  // ── Manual scene selection (from scene list click) ────────────────────────
  useEffect(() => {
    if (isTickAdvancing.current) {
      // Auto-advance from tick — don't interrupt playback
      isTickAdvancing.current = false
      return
    }
    // User manually picked a scene — stop playback, go to start of scene
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setIsPlaying(false)
    setCurrentTime(0)
    // Pause the newly displayed scene (it was already paused, but enforce it)
    if (selectedSceneId) {
      setTimeout(() => pauseScene(selectedSceneId), 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneId])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat(z.toFixed(3))))
  const resetView = useCallback(() => { setZoom(1); setPanX(0); setPanY(0) }, [])
  const zoomIn    = () => setZoom(z => clampZoom(z + ZOOM_BTN_STEP))
  const zoomOut   = () => setZoom(z => clampZoom(z - ZOOM_BTN_STEP))

  // ── Per-scene animation control ───────────────────────────────────────────
  const getDoc = (sceneId: string) => iframeMapRef.current[sceneId]?.contentDocument ?? null

  const pauseScene = useCallback((sceneId: string | null) => {
    if (!sceneId) return
    const iframe = iframeMapRef.current[sceneId]
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    const scene = scenesRef.current.find(s => s.id === sceneId)
    const type = scene?.sceneType ?? 'svg'
    if (type === 'canvas2d' || type === 'd3' || type === 'three' || type === 'lottie') {
      try { (iframe.contentWindow as any).__pause?.() } catch {}
      doc.querySelectorAll<HTMLAudioElement>('audio').forEach(a => a.pause())
      return
    }
    // svg and motion: CSS pause
    let s = doc.getElementById('__ppctrl') as HTMLStyleElement | null
    if (!s) { s = doc.createElement('style'); s.id = '__ppctrl'; doc.head?.appendChild(s) }
    s.textContent = '*, *::before, *::after { animation-play-state: paused !important; }'
    doc.querySelectorAll<SVGSVGElement>('svg').forEach(svg => (svg as any).pauseAnimations?.())
    doc.querySelectorAll<HTMLVideoElement>('video').forEach(v => v.pause())
    const audio = doc.getElementById('scene-audio') as HTMLAudioElement | null
    if (audio) audio.pause()
  }, [])

  const resumeScene = useCallback((sceneId: string | null) => {
    if (!sceneId) return
    const iframe = iframeMapRef.current[sceneId]
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    const scene = scenesRef.current.find(s => s.id === sceneId)
    const type = scene?.sceneType ?? 'svg'
    if (type === 'canvas2d' || type === 'd3' || type === 'three' || type === 'lottie') {
      try { (iframe.contentWindow as any).__resume?.() } catch {}
      doc.querySelectorAll<HTMLAudioElement>('audio').forEach(a => a.play().catch(() => {}))
      return
    }
    // svg and motion: CSS resume
    let s = doc.getElementById('__ppctrl') as HTMLStyleElement | null
    if (!s) { s = doc.createElement('style'); s.id = '__ppctrl'; doc.head?.appendChild(s) }
    s.textContent = '*, *::before, *::after { animation-play-state: running !important; }'
    doc.querySelectorAll<SVGSVGElement>('svg').forEach(svg => (svg as any).unpauseAnimations?.())
    doc.querySelectorAll<HTMLVideoElement>('video').forEach(v => v.play().catch(() => {}))
    const audio = doc.getElementById('scene-audio') as HTMLAudioElement | null
    if (audio && audio.paused) audio.play().catch(() => {})
  }, [])

  // ── Global rAF tick ───────────────────────────────────────────────────────
  const startTick = useCallback((fromGlobalTime: number = 0) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    startTimeRef.current = performance.now() - fromGlobalTime * 1000

    const tick = () => {
      const elapsed  = (performance.now() - startTimeRef.current) / 1000
      const allScenes = scenesRef.current
      const totalDur  = allScenes.reduce((a, s) => a + s.duration, 0)

      if (elapsed >= totalDur || allScenes.length === 0) {
        const last = allScenes[allScenes.length - 1]
        setCurrentTime(last?.duration ?? 0)
        setIsPlaying(false)
        if (last) pauseScene(last.id)
        return
      }

      // Find scene at elapsed global time
      let acc = 0, targetScene = allScenes[0], localTime = elapsed
      for (const s of allScenes) {
        if (elapsed < acc + s.duration) { targetScene = s; localTime = elapsed - acc; break }
        acc += s.duration
      }

      // Scene boundary crossed — instant switch, no iframe reload
      if (targetScene.id !== selectedIdRef.current) {
        pauseScene(selectedIdRef.current)
        resumeScene(targetScene.id)
        isTickAdvancing.current = true
        useVideoStore.getState().selectScene(targetScene.id)
      }

      setCurrentTime(localTime)
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }, [pauseScene, resumeScene])

  // ── Playback controls ─────────────────────────────────────────────────────
  const pause = useCallback(() => {
    setIsPlaying(false)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    pauseScene(selectedIdRef.current)
  }, [pauseScene])

  const play = useCallback(() => {
    if (scenesRef.current.length === 0) return
    setIsPlaying(true)
    resumeScene(selectedIdRef.current)
    const idx = scenesRef.current.findIndex(s => s.id === selectedIdRef.current)
    const off = scenesRef.current.slice(0, Math.max(0, idx)).reduce((a, s) => a + s.duration, 0)
    startTick(off + currentTimeRef.current)
  }, [resumeScene, startTick])

  const restart = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setIsPlaying(false)
    setCurrentTime(0)
    setSeekTimes({})
    // Bump all scene versions so their iframes reload at t=0
    setSceneVersions(prev => {
      const next: Record<string, number> = {}
      for (const s of scenesRef.current) next[s.id] = (prev[s.id] ?? 0) + 1
      return next
    })
    setLoadedScenes(new Set())
    const first = scenesRef.current[0]
    if (first) {
      useVideoStore.getState().selectScene(first.id)
      setTimeout(() => {
        resumeScene(first.id)
        startTick(0)
        setIsPlaying(true)
      }, 150)
    }
  }, [resumeScene, startTick])

  const handleSeek = useCallback((globalT: number) => {
    pause()
    let acc = 0
    for (const scene of scenesRef.current) {
      if (globalT <= acc + scene.duration) {
        const localT = Math.max(0, globalT - acc)
        useVideoStore.getState().selectScene(scene.id)
        setCurrentTime(localT)
        // Bump version (changes URL even when t=0) → forces iframe reload at new position
        setSeekTimes(prev => ({ ...prev, [scene.id]: localT }))
        setSceneVersions(prev => ({ ...prev, [scene.id]: (prev[scene.id] ?? 0) + 1 }))
        setLoadedScenes(prev => { const n = new Set(prev); n.delete(scene.id); return n })
        return
      }
      acc += scene.duration
    }
  }, [pause])

  // ── Scene load handler ────────────────────────────────────────────────────
  const handleSceneLoad = useCallback((sceneId: string) => {
    setLoadedScenes(prev => new Set([...prev, sceneId]))
    // Always start paused; resume only if this is the active scene while playing
    pauseScene(sceneId)
    if (sceneId === selectedIdRef.current && isPlayingRef.current) {
      resumeScene(sceneId)
    }
    // Capture thumbnail for the active scene
    if (sceneId === selectedIdRef.current) {
      setTimeout(() => {
        const iframe = iframeMapRef.current[sceneId]
        if (!iframe?.contentDocument) return
        const scene = scenesRef.current.find(s => s.id === sceneId)
        import('html2canvas').then(({ default: html2canvas }) => {
          html2canvas(iframe.contentDocument!.body, {
            scale: 0.2, useCORS: true, allowTaint: true,
            backgroundColor: scene?.bgColor ?? '#fffef9',
          }).then(canvas => {
            captureSceneThumbnail(sceneId, canvas.toDataURL('image/jpeg', 0.6))
          }).catch(() => {})
        })
      }, 800)
    }
  }, [pauseScene, resumeScene, captureSceneThumbnail])

  // ── Scrub drag ────────────────────────────────────────────────────────────
  const getScrubTime = useCallback((clientX: number) => {
    const rect = scrubBarRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(totalDuration, ((clientX - rect.left) / rect.width) * totalDuration))
  }, [totalDuration])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isScrubbing.current) return
      setVisualScrubTime(getScrubTime(e.clientX))
    }
    const onUp = (e: MouseEvent) => {
      if (!isScrubbing.current) return
      isScrubbing.current = false
      document.body.style.userSelect = ''
      setVisualScrubTime(null)
      handleSeek(getScrubTime(e.clientX))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [getScrubTime, handleSeek])

  // ── Timeline resize drag ──────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = timelineDrag.current
      if (!d) return
      setTimelineHeight(Math.max(48, Math.min(240, d.startH + (d.startY - e.clientY))))
    }
    const onUp = () => {
      if (!timelineDrag.current) return
      timelineDrag.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Non-passive wheel for zoom ────────────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation()
      const now = Date.now()
      if (now - lastWheelTs.current < 30) return
      lastWheelTs.current = now
      setZoom(z => clampZoom(z + Math.max(-0.6, Math.min(0.6, -e.deltaY * 0.025))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); resetView() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullscreen, resetView])

  // ── Drag-to-pan ───────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    setIsDragging(true)
    dragOrigin.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
    e.preventDefault()
  }, [panX, panY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPanX(dragOrigin.current.px + e.clientX - dragOrigin.current.x)
    setPanY(dragOrigin.current.py + e.clientY - dragOrigin.current.y)
  }, [isDragging])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // ── Computed values ───────────────────────────────────────────────────────
  const sceneIndex       = scenes.findIndex(s => s.id === selectedSceneId)
  const sceneStartOffset = scenes.slice(0, Math.max(0, sceneIndex)).reduce((a, s) => a + s.duration, 0)
  const globalTime       = sceneStartOffset + currentTime
  const scrubPct         = totalDuration > 0 ? ((visualScrubTime ?? globalTime) / totalDuration) * 100 : 0
  const hasAnyScene      = scenes.some(s => {
    if (s.sceneType === 'lottie') return !!s.lottieSource
    if (s.sceneType === 'canvas2d') return !!s.canvasCode
    if (s.sceneType === 'motion' || s.sceneType === 'd3' || s.sceneType === 'three') return !!s.sceneCode
    return !!s.svgContent
  })

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60), ms = Math.floor((s % 1) * 10)
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`
  }

  const getSceneSrc = (scene: Scene): string | null => {
    const hasContent = ({
      svg:      !!scene.svgContent,
      canvas2d: !!scene.canvasCode,
      motion:   !!scene.sceneCode,
      d3:       !!scene.sceneCode,
      three:    !!scene.sceneCode,
      lottie:   !!scene.lottieSource,
    } as Record<string, boolean>)[scene.sceneType ?? 'svg'] ?? false
    if (!hasContent) return null
    const t = seekTimes[scene.id] ?? 0
    const v = sceneVersions[scene.id] ?? 0
    const params: string[] = []
    if (t > 0) params.push(`t=${t.toFixed(3)}`)
    if (v > 0) params.push(`v=${v}`)
    return `/scenes/${scene.id}.html${params.length ? `?${params.join('&')}` : ''}`
  }

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvas = (
    <div style={{
      transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
      transformOrigin: 'center center',
      transition: isDragging ? 'none' : 'transform 0.12s ease',
      willChange: 'transform', flexShrink: 0,
    }}>
      <div
        ref={canvasRef}
        className="relative rounded-lg overflow-hidden shadow-2xl film-grain"
        style={{ aspectRatio: '16/9', width: isFullscreen ? 'min(1280px, 88vw)' : 'min(780px, 62vw)' }}
      >
        {/* All scene iframes — always in DOM, switch by display */}
        {scenes.map(scene => {
          const src = getSceneSrc(scene)
          if (!src) return null
          return (
            <iframe
              key={scene.id}
              ref={el => { iframeMapRef.current[scene.id] = el }}
              src={src}
              className="scene-iframe absolute inset-0 w-full h-full"
              style={{ display: scene.id === selectedSceneId ? 'block' : 'none', background: scene.bgColor ?? '#fffef9' }}
              onLoad={() => handleSceneLoad(scene.id)}
              sandbox="allow-scripts allow-same-origin"
              title={`Scene ${scene.id}`}
            />
          )
        })}

        {/* Generating overlay */}
        {isThisGenerating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-6"
            style={{ background: selectedScene?.bgColor ?? '#fffef9' }}>
            {selectedScene?.sceneType === 'canvas2d'
              ? <>
                  <span className="text-[var(--color-accent)] text-xs font-mono uppercase tracking-widest animate-pulse">drawing...</span>
                  <span className="text-[#3a3a45] text-[10px] text-center max-w-[200px]">Generating Canvas animation...</span>
                </>
              : selectedScene?.sceneType === 'motion'
              ? <>
                  <span className="text-[var(--color-accent)] text-xs font-mono uppercase tracking-widest animate-pulse">animating...</span>
                  <span className="text-[#3a3a45] text-[10px] text-center max-w-[200px]">Generating Motion animation...</span>
                </>
              : selectedScene?.sceneType === 'd3'
              ? <>
                  <span className="text-[var(--color-accent)] text-xs font-mono uppercase tracking-widest animate-pulse">charting...</span>
                  <span className="text-[#3a3a45] text-[10px] text-center max-w-[200px]">Generating D3 visualization...</span>
                </>
              : selectedScene?.sceneType === 'three'
              ? <>
                  <span className="text-[var(--color-accent)] text-xs font-mono uppercase tracking-widest animate-pulse">rendering...</span>
                  <span className="text-[#3a3a45] text-[10px] text-center max-w-[200px]">Generating Three.js scene...</span>
                </>
              : selectedScene?.sceneType === 'lottie'
              ? <>
                  <span className="text-[var(--color-accent)] text-xs font-mono uppercase tracking-widest animate-pulse">drawing...</span>
                  <span className="text-[#3a3a45] text-[10px] text-center max-w-[200px]">Generating SVG overlay...</span>
                </>
              : selectedScene?.svgContent
                ? <div className="w-full h-full" style={{ pointerEvents: 'none' }}
                    dangerouslySetInnerHTML={{ __html: selectedScene.svgContent }} />
                : <>
                    <span className="text-[var(--color-accent)] text-xs font-mono uppercase tracking-widest animate-pulse">drawing...</span>
                    <span className="text-[#3a3a45] text-[10px] text-center max-w-[200px]">Generating SVG elements and animations...</span>
                  </>
            }
          </div>
        )}

        {/* Empty state for selected scene */}
        {!selectedScene?.svgContent && !selectedScene?.canvasCode && !selectedScene?.sceneCode && !selectedScene?.lottieSource && !isThisGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: selectedScene?.bgColor ?? 'var(--color-input-bg)' }}>
            <p className="text-[#6b6b7a] text-sm">{selectedScene ? 'No content yet' : 'Select a scene'}</p>
            {selectedScene && <p className="text-[#3a3a45] text-xs">Write a prompt and click Generate</p>}
          </div>
        )}

        {/* Loading indicator */}
        {selectedSceneId && (selectedScene?.svgContent || selectedScene?.canvasCode || selectedScene?.sceneCode || selectedScene?.lottieSource) && !loadedScenes.has(selectedSceneId) && !isThisGenerating && (
          <div className="absolute inset-0 z-10 bg-[#0d0d0f]/80 flex items-center justify-center pointer-events-none">
            <div className="text-[#6b6b7a] text-xs">Loading preview...</div>
          </div>
        )}

        {/* Object/Text overlay handles */}
        {(showObjectEditor || showSelectMode) && !isFullscreen && selectedSceneId && (
          <SvgObjectEditor sceneId={selectedSceneId} canvasRef={canvasRef} />
        )}
        {showSelectMode && !isFullscreen && selectedSceneId && selectedScene?.svgContent && (
          <SvgElementEditor sceneId={selectedSceneId} />
        )}

        {/* Interaction overlay for interactive mode */}
        {outputMode === 'interactive' && selectedSceneId && selectedScene && (
          <InteractionOverlay
            scene={selectedScene}
            mode="edit"
            currentTime={currentTime}
          />
        )}
      </div>
    </div>
  )

  const viewport = (
    <div
      ref={viewportRef}
      className="w-full h-full flex items-center justify-center overflow-hidden select-none"
      style={{ cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {canvas}
    </div>
  )

  // ── View controls ─────────────────────────────────────────────────────────
  const viewControls = (
    <div className="flex items-center gap-1.5 z-[999] pointer-events-auto">
      <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} data-tooltip="Zoom Out"
        className={`kbd w-7 h-7 p-0 flex items-center justify-center text-white font-bold ${zoom <= ZOOM_MIN ? 'opacity-30' : ''}`}>
        <span className="text-xl leading-none -mt-0.5">−</span>
      </button>
      <button onClick={() => setZoom(1)} data-tooltip="Reset Zoom"
        className="kbd h-7 px-1.5 flex items-center justify-center font-mono text-[11px] font-bold min-w-[42px] text-white">
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} data-tooltip="Zoom In"
        className="kbd w-7 h-7 p-0 flex items-center justify-center text-white font-bold">
        <span className="text-xl leading-none -mt-0.5">+</span>
      </button>
      <button onClick={resetView} data-tooltip="Reset Viewport"
        className={`kbd w-7 h-7 p-0 flex items-center justify-center text-white font-bold ${zoom === 1 && panX === 0 && panY === 0 ? 'opacity-30' : ''}`}>
        <RotateCcw />
      </button>
      <button onClick={() => { setShowObjectEditor(v => !v); setShowSelectMode(false) }} data-tooltip="Toggle Layers"
        className={`kbd w-7 h-7 p-0 flex items-center justify-center text-white font-bold ${showObjectEditor ? 'border-[#e84545]' : ''}`}>
        <Layers />
      </button>
      <button onClick={() => { setShowSelectMode(v => !v); setShowObjectEditor(false) }} data-tooltip="Select Mode"
        className={`kbd w-7 h-7 p-0 flex items-center justify-center text-white font-bold ${showSelectMode ? 'border-[#e84545]' : ''}`}>
        <SquareDashedMousePointer size={18} strokeWidth={2.5} />
      </button>
      <button onClick={() => { setIsFullscreen(!isFullscreen); resetView() }} data-tooltip="Toggle Fullscreen"
        className="kbd w-7 h-7 p-0 flex items-center justify-center text-white font-bold">
        {isFullscreen ? <Shrink /> : <Expand />}
      </button>
    </div>
  )

  // ── Playback bar ──────────────────────────────────────────────────────────
  const playbackBar = scenes.length > 0 && (
    <div className="w-full flex-shrink-0 border-t border-[var(--color-border)] px-0 py-1.5 bg-[var(--color-panel)]">
      <div className="flex items-center gap-3 px-2">
        <button onClick={isPlaying ? pause : play} data-tooltip={isPlaying ? 'Pause' : 'Play'} data-tooltip-pos="top"
          className="p-1.5 flex items-center justify-center text-[var(--color-accent)] hover:scale-110 active:scale-95 transition-transform no-style">
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>
        <button onClick={restart} data-tooltip="Restart" data-tooltip-pos="top"
          className="p-1.5 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:scale-110 active:scale-95 transition-all no-style">
          <RotateCcw size={18} />
        </button>
        <div
          ref={scrubBarRef}
          className="flex-1 h-1.5 rounded-full cursor-pointer relative"
          style={{ backgroundColor: 'var(--color-border)' }}
          onMouseDown={e => {
            isScrubbing.current = true
            document.body.style.userSelect = 'none'
            const t = getScrubTime(e.clientX)
            setVisualScrubTime(t)
            handleSeek(t)
            e.preventDefault()
          }}
        >
          <div className="absolute inset-y-0 left-0 bg-[#e84545] rounded-full" style={{ width: `${scrubPct}%` }} />
        </div>
        <div className="px-2 py-0.5 flex items-center justify-center bg-[var(--color-panel)] rounded border border-[var(--color-border)] shadow-sm text-[10.5px] font-bold text-[var(--color-text-primary)] tabular-nums whitespace-nowrap">
          {formatTime(visualScrubTime ?? globalTime)} / {formatTime(totalDuration)}
        </div>
        <div className="flex items-center gap-0.5 ml-1 rounded border border-[var(--color-border)] p-0.5 bg-[var(--color-bg)]">
          <button
            onClick={() => setTimelineView('track')}
            data-tooltip="Track Timeline" data-tooltip-pos="top"
            className={`kbd w-6 h-6 p-0 flex items-center justify-center text-[9px] ${timelineView === 'track' ? 'bg-[#e84545] border-[#e84545] text-white' : 'text-[var(--color-text-muted)]'}`}
          >
            <AlignStartVertical size={12} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setTimelineView('graph')}
            data-tooltip="Node Graph" data-tooltip-pos="top"
            className={`kbd w-6 h-6 p-0 flex items-center justify-center text-[9px] ${timelineView === 'graph' ? 'bg-[#e84545] border-[#e84545] text-white' : 'text-[var(--color-text-muted)]'}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>
          </button>
        </div>
      </div>
    </div>
  )

  const timelineResizeHandle = (
    <div
      className="h-1 flex-shrink-0 hover:bg-[var(--color-border)] cursor-row-resize z-50"
      onMouseDown={e => {
        e.preventDefault()
        timelineDrag.current = { startY: e.clientY, startH: timelineHeight }
        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
      }}
    />
  )

  // ── Render ────────────────────────────────────────────────────────────────

  if (isFullscreen) {
    return (
      <>
        <div className="flex flex-col flex-1 overflow-hidden" style={{ visibility: 'hidden', pointerEvents: 'none' }} />
        <div className="fixed inset-0 z-40 bg-[var(--color-bg)] flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-muted)] text-xs font-mono leading-none">
              Scene {scenes.findIndex(s => s.id === selectedSceneId) + 1} / {scenes.length}
            </span>
            {viewControls}
          </div>
          <div className="flex-1 overflow-hidden">{viewport}</div>
          {timelineResizeHandle}
          {playbackBar}
          {timelineView === 'graph' ? (
            <div style={{ height: timelineHeight }} className="border-t border-[var(--color-border)]">
              <SceneGraphEditor />
            </div>
          ) : (
            <Timeline currentTime={globalTime} totalDuration={totalDuration} onSeek={handleSeek} trackHeight={timelineHeight} />
          )}
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 relative overflow-hidden">
        {viewport}
        <div className="absolute top-3 right-3 z-50 pointer-events-auto">{viewControls}</div>
        {selectedScene && (
          <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
            <span className="text-[var(--color-text-muted)] text-[11px] font-medium">
              {selectedScene.name || selectedScene.prompt.slice(0, 50) || 'Untitled Scene'}
            </span>
          </div>
        )}
      </div>
      {timelineResizeHandle}
      {playbackBar}
      {timelineView === 'graph' ? (
        <div style={{ height: timelineHeight }} className="border-t border-[var(--color-border)]">
          <SceneGraphEditor />
        </div>
      ) : (
        <Timeline currentTime={globalTime} totalDuration={totalDuration} onSeek={handleSeek} trackHeight={timelineHeight} />
      )}
    </div>
  )
}

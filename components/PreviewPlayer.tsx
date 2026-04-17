'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Layers, SquareDashedMousePointer } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { resolveProjectDimensions } from '@/lib/dimensions'
import StudioRecordPreview from './recording/StudioRecordPreview'
import ZdogViewport from './zdog-studio/ZdogViewport'
import ZdogProperties from './zdog-studio/ZdogProperties'
import SvgObjectEditor from './SvgObjectEditor'
import SvgElementEditor from './SvgElementEditor'
import InteractionOverlay from './InteractionOverlay'
import GridOverlay from './GridOverlay'
import { ScenePlayer } from '@/lib/scene-player'
import type { Scene, InteractionElement } from '@/lib/types'
import type { InteractionCallbacks } from '@/components/interactions/InteractionRenderer'

const PixiPreviewCanvas = dynamic(() => import('./PixiPreviewCanvas'), { ssr: false })

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const ZOOM_BTN_STEP = 0.25

/** CenchCharts + GSAP keep bars at height 0 until several seconds in; paused @ t=0 looks like an empty chart. */
const D3_PEEK_MAX_S = 6
function d3PausedPreviewTime(scene: Scene | undefined): number {
  if (!scene || scene.sceneType !== 'd3') return 0
  const d = Math.max(0.05, scene.duration ?? 8)
  return Math.min(d, D3_PEEK_MAX_S)
}

export default function PreviewPlayer() {
  const {
    scenes,
    selectedSceneId,
    isGenerating,
    generatingSceneId,
    captureSceneThumbnail,
    timelineHeight,
    setTimelineHeight,
    sceneHtmlVersion,
    saveSceneHTML,
    project,
    gridConfig,
    updateGridConfig,
    undo,
    redo,
    _undoStack,
    _redoStack,
    isAgentRunning,
    isPreviewFullscreen,
    setPreviewFullscreen,
    setPreviewZoom,
    zdogStudioMode,
    studioRecordMode,
    compositorPreview,
    setTimelineTransport,
    timelineView,
  } = useVideoStore()
  const outputMode = project.outputMode
  const projectDims = resolveProjectDimensions(project.mp4Settings?.aspectRatio, project.mp4Settings?.resolution)
  const previewAspect = `${projectDims.width}/${projectDims.height}`

  const selectedScene = scenes.find((s) => s.id === selectedSceneId)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const iframeMapRef = useRef<Record<string, HTMLIFrameElement | null>>({})
  const playerMapRef = useRef<Record<string, ScenePlayer>>({})
  const dragOrigin = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const animFrameRef = useRef<number>()
  const scenesRef = useRef(scenes)
  const selectedIdRef = useRef(selectedSceneId)
  const isPlayingRef = useRef(false)
  const currentTimeRef = useRef(0)
  const isAutoAdvancing = useRef(false) // set true when onEnded auto-advances to next scene
  const isSeeking = useRef(false) // set true when handleSeek/stepFrame changes scenes
  const pendingPlayRef = useRef<string | null>(null) // queued play for unloaded scene

  // ── State ─────────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  // seekTimes removed — GSAP seek via postMessage replaces ?t= URL params
  const [sceneVersions, setSceneVersions] = useState<Record<string, number>>({})
  const [loadedScenes, setLoadedScenes] = useState<Set<string>>(new Set())
  const [failedScenes, setFailedScenes] = useState<Set<string>>(new Set())
  const sceneWriteErrors = useVideoStore((s) => s.sceneWriteErrors)
  const setTimelineView = useVideoStore((s) => s.setTimelineView)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const panXRef = useRef(0)
  const panYRef = useRef(0)
  useEffect(() => {
    zoomRef.current = zoom
    setPreviewZoom(zoom)
  }, [zoom, setPreviewZoom])
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  useEffect(() => {
    panXRef.current = panX
  }, [panX])
  useEffect(() => {
    panYRef.current = panY
  }, [panY])
  const [isDragging, setIsDragging] = useState(false)
  const isFullscreen = isPreviewFullscreen
  const setIsFullscreen = setPreviewFullscreen
  const [showObjectEditor, setShowObjectEditor] = useState(false)
  const [showSelectMode, setShowSelectMode] = useState(false)
  const preFullscreenTimelineHeightRef = useRef<number>(200)
  const wasFullscreenRef = useRef(false)

  useEffect(() => {
    if (isFullscreen && !wasFullscreenRef.current) {
      if (timelineHeight > 0) preFullscreenTimelineHeightRef.current = timelineHeight
      setTimelineHeight(0)
    } else if (!isFullscreen && wasFullscreenRef.current) {
      const restoreHeight = preFullscreenTimelineHeightRef.current > 0 ? preFullscreenTimelineHeightRef.current : 200
      setTimelineHeight(restoreHeight)
    }
    wasFullscreenRef.current = isFullscreen
  }, [isFullscreen, timelineHeight, setTimelineHeight])

  // ── One-time: resave HTML for any non-SVG scenes already in the store ──────
  useEffect(() => {
    scenes
      .filter((s) => {
        if (s.sceneType === 'react') return !!s.reactCode
        if (s.sceneType === 'canvas2d') return !!s.canvasCode
        if (s.sceneType === 'motion' || s.sceneType === 'd3' || s.sceneType === 'three' || s.sceneType === 'physics') {
          return !!s.sceneCode || !!s.canvasBackgroundCode?.trim()
        }
        if (s.sceneType === 'lottie') return !!s.lottieSource
        if (s.sceneType === '3d_world') return !!s.worldConfig
        return !!s.svgContent || !!s.canvasBackgroundCode?.trim()
      })
      .forEach((s) => saveSceneHTML(s.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep refs in sync with state
  useEffect(() => {
    scenesRef.current = scenes
  }, [scenes])
  useEffect(() => {
    selectedIdRef.current = selectedSceneId
  }, [selectedSceneId])
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  // ── Register frame capturer for agent visual feedback ──────────────────────
  useEffect(() => {
    const capturer = async (sceneId: string, time: number): Promise<string | null> => {
      const iframe = iframeMapRef.current[sceneId]
      if (!iframe?.contentWindow || !iframe.contentDocument) return null

      // Seek the scene to the requested time
      iframe.contentWindow.postMessage({ target: 'cench-scene', sceneId, type: 'seek', time }, '*')

      // Wait for seeked ack, then one more frame for render
      await new Promise<void>((resolve) => {
        const onAck = (ev: MessageEvent) => {
          const d = ev.data
          if (!d || d.source !== 'cench-scene' || d.type !== 'seeked') return
          if (d.sceneId && d.sceneId !== sceneId) return
          window.removeEventListener('message', onAck)
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }
        window.addEventListener('message', onAck)
        // Fallback if seeked never fires
        setTimeout(() => {
          window.removeEventListener('message', onAck)
          resolve()
        }, 500)
      })

      // Capture via html2canvas
      try {
        const { default: html2canvas } = await import('html2canvas')
        const scene = scenesRef.current.find((s) => s.id === sceneId)
        const canvas = await html2canvas(iframe.contentDocument.body, {
          scale: 0.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: scene?.bgColor ?? '#000000',
          logging: false,
        })
        return canvas.toDataURL('image/jpeg', 0.7)
      } catch {
        return null
      }
    }

    useVideoStore.getState().registerFrameCapturer(capturer)
    return () => {
      useVideoStore.getState().registerFrameCapturer(null)
    }
  }, [])

  const totalDuration = scenes.reduce((a, s) => a + s.duration, 0)
  const isThisGenerating = isGenerating && generatingSceneId === selectedSceneId

  // ── Auto-reload when scene HTML file changes on disk ──────────────────────
  const prevHtmlVersion = useRef(sceneHtmlVersion)
  useEffect(() => {
    if (sceneHtmlVersion !== prevHtmlVersion.current) {
      prevHtmlVersion.current = sceneHtmlVersion
      if (selectedSceneId) {
        setSceneVersions((prev) => ({ ...prev, [selectedSceneId]: (prev[selectedSceneId] ?? 0) + 1 }))
        setLoadedScenes((prev) => {
          const n = new Set(prev)
          n.delete(selectedSceneId)
          return n
        })
      }
    }
  }, [sceneHtmlVersion, selectedSceneId])

  // ── Manual scene selection (from scene list click) ────────────────────────
  useEffect(() => {
    if (isAutoAdvancing.current) {
      // Auto-advance from onEnded — don't interrupt playback
      isAutoAdvancing.current = false
      return
    }
    if (isSeeking.current) {
      // Seek/step already handled time and pause — don't reset
      isSeeking.current = false
      return
    }
    // User manually picked a scene — stop playback; D3 charts need t>0 while paused or bars stay hidden (GSAP)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setIsPlaying(false)
    const picked = useVideoStore.getState().scenes.find((s) => s.id === selectedSceneId)
    const idleT = d3PausedPreviewTime(picked)
    setCurrentTime(idleT)
    if (selectedSceneId) {
      const sid = selectedSceneId
      setTimeout(() => {
        pauseAllScenes()
        const pl = playerMapRef.current[sid]
        if (pl) {
          requestAnimationFrame(() => {
            try {
              pl.seek(idleT)
            } catch {}
          })
        }
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneId])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat(z.toFixed(3))))
  const resetView = useCallback(() => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [])
  const zoomIn = () => setZoom((z) => clampZoom(z + ZOOM_BTN_STEP))
  const zoomOut = () => setZoom((z) => clampZoom(z - ZOOM_BTN_STEP))
  const fitToViewport = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const { clientWidth: vw, clientHeight: vh } = vp
    const padding = 32
    const availW = vw - padding * 2
    const availH = vh - padding * 2
    // preview matches project aspect ratio
    const previewW = isFullscreen ? Math.min(1280, window.innerWidth * 0.88) : Math.min(780, window.innerWidth * 0.62)
    const previewH = previewW * (projectDims.height / projectDims.width)
    const scaleW = availW / previewW
    const scaleH = availH / previewH
    const fitZoom = clampZoom(Math.min(scaleW, scaleH))
    setZoom(fitZoom)
    setPanX(0)
    setPanY(0)
  }, [isFullscreen]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-scene animation control (via ScenePlayer postMessage) ─────────────
  const getDoc = (sceneId: string) => iframeMapRef.current[sceneId]?.contentDocument ?? null

  const getPlayer = useCallback((sceneId: string | null): ScenePlayer | null => {
    if (!sceneId) return null
    return playerMapRef.current[sceneId] ?? null
  }, [])

  const pauseScene = useCallback(
    (sceneId: string | null) => {
      if (!sceneId) return
      const player = getPlayer(sceneId)
      if (player) {
        player.pause()
        return
      }
      // Fallback for iframes without GSAP (legacy)
      const iframe = iframeMapRef.current[sceneId]
      if (iframe)
        try {
          ;(iframe.contentWindow as any).__pause?.()
        } catch {}
    },
    [getPlayer],
  )

  const resumeScene = useCallback(
    (sceneId: string | null) => {
      if (!sceneId) return
      const player = getPlayer(sceneId)
      if (player) {
        player.play()
        return
      }
      // Fallback for iframes without GSAP (legacy)
      const iframe = iframeMapRef.current[sceneId]
      if (iframe)
        try {
          ;(iframe.contentWindow as any).__resume?.()
        } catch {}
    },
    [getPlayer],
  )

  /** Stop every loaded scene (avoids ghost audio from display:none / hidden iframes still playing). */
  const pauseAllScenes = useCallback(() => {
    const ids = new Set<string>()
    for (const id of Object.keys(playerMapRef.current)) ids.add(id)
    for (const id of Object.keys(iframeMapRef.current)) {
      if (iframeMapRef.current[id]) ids.add(id)
    }
    ids.forEach((id) => pauseScene(id))
  }, [pauseScene])

  // ── Interaction callbacks for preview mode ──────────────────────────────────

  // Track which gates have been triggered to avoid re-triggering
  const triggeredGatesRef = useRef<Set<string>>(new Set())

  /** Resume current scene and restart the tick loop */
  const resumeAndTick = useCallback(() => {
    pauseAllScenes()
    resumeScene(selectedIdRef.current)
    setIsPlaying(true)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    const tick = () => {
      if (!isPlayingRef.current) return
      const sid = selectedIdRef.current
      const p = sid ? playerMapRef.current[sid] : null
      if (p) {
        const t = p.currentTime
        setCurrentTime(t)
        const scene = scenesRef.current.find((s) => s.id === sid)
        if (scene?.interactions) {
          for (const el of scene.interactions) {
            if (el.type === 'gate' && !triggeredGatesRef.current.has(el.id)) {
              if (t >= el.appearsAt) {
                triggeredGatesRef.current.add(el.id)
                pauseAllScenes()
                setIsPlaying(false)
                return
              }
            }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [resumeScene, pauseScene, pauseAllScenes])

  const goToSceneAndPlay = useCallback(
    (sceneId: string) => {
      if (!sceneId) return
      pauseAllScenes()
      triggeredGatesRef.current.clear()
      // Mark as auto-advancing so the selectedSceneId effect doesn't kill playback
      isAutoAdvancing.current = true
      useVideoStore.getState().selectScene(sceneId)
      setCurrentTime(0)
      const player = playerMapRef.current[sceneId]
      if (player) {
        player.seek(0)
        // postMessages are processed in order — one rAF is enough for the seek
        // to land before resume. 50ms was a pessimistic guess that added 300ms
        // of accumulated dead air over a 7-scene video; rAF is ~16ms.
        requestAnimationFrame(() => resumeAndTick())
      } else {
        pendingPlayRef.current = sceneId
      }
    },
    [pauseAllScenes, resumeAndTick],
  )

  const interactionCallbacks: InteractionCallbacks = {
    brandColor: project.interactiveSettings?.brandColor ?? '#e84545',
    onHotspotClick: useCallback(
      (el) => {
        if (el.jumpsToSceneId) goToSceneAndPlay(el.jumpsToSceneId)
      },
      [goToSceneAndPlay],
    ),
    onChoiceSelect: useCallback(
      (_el, _optionId, jumpsToSceneId) => {
        if (jumpsToSceneId) goToSceneAndPlay(jumpsToSceneId)
      },
      [goToSceneAndPlay],
    ),
    onQuizAnswer: useCallback(
      (el, _selectedOptionId, correct) => {
        if (correct && el.onCorrect === 'jump' && el.onCorrectSceneId) {
          setTimeout(() => goToSceneAndPlay(el.onCorrectSceneId!), 1500)
        } else if (!correct && el.onWrong === 'jump' && el.onWrongSceneId) {
          setTimeout(() => goToSceneAndPlay(el.onWrongSceneId!), 1500)
        } else if (!correct && el.onWrong === 'retry') {
          // Don't resume — quiz resets and waits for another answer
        } else {
          // continue: resume playback after delay
          setTimeout(() => resumeAndTick(), 1500)
        }
      },
      [goToSceneAndPlay, resumeAndTick],
    ),
    onGateContinue: useCallback(
      (_el) => {
        resumeAndTick()
      },
      [resumeAndTick],
    ),
    onFormSubmit: useCallback(
      (el, _values) => {
        if (el.jumpsToSceneId) {
          goToSceneAndPlay(el.jumpsToSceneId)
        } else {
          resumeAndTick()
        }
      },
      [goToSceneAndPlay, resumeAndTick],
    ),
    onSliderChange: useCallback((el: any, value: number) => {
      const sceneId = selectedIdRef.current
      if (!sceneId) return
      useVideoStore.getState().setRuntimeVariable(sceneId, el.setsVariable, value)
      const player = playerMapRef.current[sceneId]
      player?.setVariable(el.setsVariable, value)
    }, []),
    onToggleChange: useCallback((el: any, value: boolean) => {
      const sceneId = selectedIdRef.current
      if (!sceneId) return
      useVideoStore.getState().setRuntimeVariable(sceneId, el.setsVariable, value)
      const player = playerMapRef.current[sceneId]
      player?.setVariable(el.setsVariable, value)
    }, []),
    onResume: useCallback(() => {
      resumeAndTick()
    }, [resumeAndTick]),
  }

  // ── Playback controls ─────────────────────────────────────────────────────
  // GSAP inside the iframe is the single source of truth for time.
  // The parent polls player.currentTime (updated by iframe postMessages)
  // to sync the playhead — no independent clock.

  const pause = useCallback(() => {
    setIsPlaying(false)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    pauseAllScenes()
  }, [pauseAllScenes])

  const play = useCallback(() => {
    if (scenesRef.current.length === 0) return
    setIsPlaying(true)
    pauseAllScenes()
    resumeScene(selectedIdRef.current)

    // Lightweight polling loop — reads player.currentTime (set by iframe timeupdate messages)
    // This is NOT a dual clock; the iframe's GSAP timeline is the sole time source.
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    const tick = () => {
      if (!isPlayingRef.current) return
      const sceneId = selectedIdRef.current
      const player = sceneId ? playerMapRef.current[sceneId] : null
      if (player) {
        const t = player.currentTime
        setCurrentTime(t)

        // Gate detection: pause when a gate's appearsAt is reached
        const scene = scenesRef.current.find((s) => s.id === sceneId)
        if (scene?.interactions) {
          for (const el of scene.interactions) {
            if (el.type === 'gate' && !triggeredGatesRef.current.has(el.id)) {
              if (t >= el.appearsAt) {
                triggeredGatesRef.current.add(el.id)
                pauseAllScenes()
                setIsPlaying(false)
                return // stop the tick loop; onGateContinue resumes
              }
            }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [resumeScene, pauseScene, pauseAllScenes])

  const restart = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setIsPlaying(false)
    setCurrentTime(0)
    triggeredGatesRef.current.clear()
    // Reset all loaded scenes (seeks to 0 + pauses, no iframe reload)
    Object.values(playerMapRef.current).forEach((p) => p.reset())
    // Select first scene and auto-play after iframe processes the reset
    const first = scenesRef.current[0]
    if (first) {
      if (first.id !== selectedIdRef.current) {
        useVideoStore.getState().selectScene(first.id)
      }
      setTimeout(() => {
        resumeScene(first.id)
        setIsPlaying(true)
        // Start polling loop
        const tick = () => {
          if (!isPlayingRef.current) return
          const sceneId = selectedIdRef.current
          const player = sceneId ? playerMapRef.current[sceneId] : null
          if (player) setCurrentTime(player.currentTime)
          animFrameRef.current = requestAnimationFrame(tick)
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }, 150)
    }
  }, [resumeScene])

  // ── Frame stepping ──────────────────────────────────────────────────────
  const stepFrame = useCallback((direction: -1 | 1) => {
    const allScenes = scenesRef.current
    if (allScenes.length === 0) return

    const idx = allScenes.findIndex((s) => s.id === selectedIdRef.current)
    if (idx === -1) return

    const offset = allScenes.slice(0, idx).reduce((a, s) => a + s.duration, 0)
    const globalT = offset + currentTimeRef.current
    const totalDur = allScenes.reduce((a, s) => a + s.duration, 0)
    const newGlobal = Math.max(0, Math.min(totalDur, globalT + direction * (1 / 30)))

    let acc = 0
    for (const scene of allScenes) {
      if (newGlobal <= acc + scene.duration) {
        const localT = Math.max(0, newGlobal - acc)
        if (scene.id !== selectedIdRef.current) {
          isSeeking.current = true
        }
        useVideoStore.getState().selectScene(scene.id)
        setCurrentTime(localT)
        const player = playerMapRef.current[scene.id]
        if (player) player.seek(localT)
        return
      }
      acc += scene.duration
    }

    // Fallback: clamp to last scene at end
    const lastScene = allScenes[allScenes.length - 1]
    if (lastScene.id !== selectedIdRef.current) {
      isSeeking.current = true
    }
    useVideoStore.getState().selectScene(lastScene.id)
    setCurrentTime(lastScene.duration)
    const player = playerMapRef.current[lastScene.id]
    if (player) player.seek(lastScene.duration)
  }, [])

  const jumpScene = useCallback((direction: -1 | 1) => {
    const idx = scenesRef.current.findIndex((s) => s.id === selectedIdRef.current)
    const targetIdx = Math.max(0, Math.min(scenesRef.current.length - 1, idx + direction))
    const targetScene = scenesRef.current[targetIdx]
    if (!targetScene) return
    if (targetScene.id !== selectedIdRef.current) {
      isSeeking.current = true
    }
    useVideoStore.getState().selectScene(targetScene.id)
    const idleT = d3PausedPreviewTime(targetScene)
    setCurrentTime(idleT)
    const player = playerMapRef.current[targetScene.id]
    if (player) player.seek(idleT)
  }, [])

  const handleSeek = useCallback(
    (globalT: number) => {
      // Cancel polling loop immediately to prevent stale time overwriting the seek
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      setIsPlaying(false)
      pauseAllScenes()

      const allScenes = scenesRef.current
      if (allScenes.length === 0) return

      let acc = 0
      for (const scene of allScenes) {
        if (globalT <= acc + scene.duration) {
          const localT = Math.max(0, globalT - acc)
          if (scene.id !== selectedIdRef.current) {
            isSeeking.current = true
            useVideoStore.getState().selectScene(scene.id)
          }
          setCurrentTime(localT)
          const player = playerMapRef.current[scene.id]
          if (player) player.seek(localT)
          return
        }
        acc += scene.duration
      }

      // Fallback: seek past total duration — clamp to last scene at end
      const lastScene = allScenes[allScenes.length - 1]
      if (lastScene.id !== selectedIdRef.current) {
        isSeeking.current = true
        useVideoStore.getState().selectScene(lastScene.id)
      }
      setCurrentTime(lastScene.duration)
      const player = playerMapRef.current[lastScene.id]
      if (player) player.seek(lastScene.duration)
    },
    [pauseAllScenes],
  )

  // Commands from app header controls and TransportBar
  useEffect(() => {
    const onPreviewCommand = (event: Event) => {
      const custom = event as CustomEvent<{ action?: string; time?: number }>
      const action = custom.detail?.action
      if (!action) return
      if (action === 'undo') {
        undo()
        return
      }
      if (action === 'redo') {
        redo()
        return
      }
      if (action === 'zoom_in') {
        zoomIn()
        return
      }
      if (action === 'zoom_out') {
        zoomOut()
        return
      }
      if (action === 'zoom_reset') {
        resetView()
        return
      }
      if (action === 'toggle_play') {
        if (isPlayingRef.current) pause()
        else play()
        return
      }
      if (action === 'seek' && typeof custom.detail?.time === 'number') {
        handleSeek(custom.detail.time)
        return
      }
      if (action === 'step_back') {
        stepFrame(-1)
        return
      }
      if (action === 'step_forward') {
        stepFrame(1)
        return
      }
    }
    window.addEventListener('cench-preview-command', onPreviewCommand as EventListener)
    return () => window.removeEventListener('cench-preview-command', onPreviewCommand as EventListener)
  }, [undo, redo, zoomIn, zoomOut, resetView, play, pause, handleSeek, stepFrame])

  // ── Scene load handler ────────────────────────────────────────────────────
  const handleSceneLoad = useCallback(
    (sceneId: string) => {
      setLoadedScenes((prev) => new Set([...prev, sceneId]))

      // Create ScenePlayer for this iframe
      const iframe = iframeMapRef.current[sceneId]
      if (iframe) {
        // Destroy old player if exists
        playerMapRef.current[sceneId]?.destroy()
        const player = new ScenePlayer(iframe, sceneId)
        playerMapRef.current[sceneId] = player

        player.onTimeUpdate = (t) => {
          if (sceneId === selectedIdRef.current) {
            setCurrentTime(t)
          }
        }
        player.onEnded = () => {
          // Auto-advance to next scene
          const allScenes = scenesRef.current
          const idx = allScenes.findIndex((s) => s.id === sceneId)
          if (idx < allScenes.length - 1) {
            const nextScene = allScenes[idx + 1]
            goToSceneAndPlay(nextScene.id)
          } else {
            pauseAllScenes()
            setIsPlaying(false)
          }
        }

        // In-scene interactivity events (from CenchReact hooks)
        player.onVariableChanged = (name, value) => {
          useVideoStore.getState().setRuntimeVariable(sceneId, name, value)
        }
        player.onElementClicked = (_elementId, _data) => {
          // Element clicks from scene code — can be used for scene graph navigation
          // Currently tracked for analytics; extend as needed
        }
      }

      // Always start paused; resume only if this is the active scene while playing
      pauseScene(sceneId)
      const loadedScene = scenesRef.current.find((s) => s.id === sceneId)
      const idleT = d3PausedPreviewTime(loadedScene)
      // Paused scenes still need one rendered frame (3d_world / Three use RAF, which playback blocks until play)
      const p = playerMapRef.current[sceneId]
      if (p) {
        requestAnimationFrame(() => {
          try {
            p.seek(idleT)
          } catch {}
        })
      }
      if (sceneId === selectedIdRef.current && idleT > 0) {
        setCurrentTime(idleT)
      }
      if (sceneId === selectedIdRef.current && isPlayingRef.current) {
        resumeScene(sceneId)
      }
      // Check if this scene was queued for auto-play (from onEnded)
      if (pendingPlayRef.current === sceneId) {
        pendingPlayRef.current = null
        const p = playerMapRef.current[sceneId]
        if (p) {
          p.seek(0)
          p.play()
        }
      }
      // Capture thumbnail for the active scene
      if (sceneId === selectedIdRef.current) {
        setTimeout(() => {
          const iframe = iframeMapRef.current[sceneId]
          if (!iframe?.contentDocument) return
          const scene = scenesRef.current.find((s) => s.id === sceneId)
          import('html2canvas').then(({ default: html2canvas }) => {
            html2canvas(iframe.contentDocument!.body, {
              scale: 0.2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: scene?.bgColor ?? '#fffef9',
              logging: false,
            })
              .then((canvas) => {
                captureSceneThumbnail(sceneId, canvas.toDataURL('image/jpeg', 0.6))
              })
              .catch(() => {})
          })
        }, 800)
      }
    },
    [pauseAllScenes, pauseScene, resumeScene, captureSceneThumbnail],
  )

  // ── Element selection from iframe (inspector integration) ─────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data) return

      // Audio error from scene iframe — surface to user
      if (e.data.type === 'cench:audio-error') {
        console.warn('[PreviewPlayer] Audio playback error:', e.data.error, e.data.track)
        // TODO: wire to toast notification system when available
        return
      }

      if (e.data.source !== 'cench-scene') return
      const store = useVideoStore.getState()

      if (e.data.type === 'element_selected') {
        const el = e.data.element
        if (el?.type === 'physics-card') {
          store.openLayersSection('elements')
        }
        store.selectInspectorElement(el, null)
      }

      if (e.data.type === 'element_deselected') {
        store.selectInspectorElement(null)
      }

      if (e.data.type === 'elements_list') {
        store.setInspectorElements(e.data.elements ?? {})
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // ── Non-passive wheel for zoom-to-cursor ──────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = el.getBoundingClientRect()
      const vpCenterX = rect.width / 2
      const vpCenterY = rect.height / 2
      // Mouse position in viewport space
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const oldZoom = zoomRef.current
      const delta = Math.max(-0.6, Math.min(0.6, -e.deltaY * 0.025))
      const newZoom = clampZoom(oldZoom + delta)
      const ratio = newZoom / oldZoom

      // Offset from content center (viewport center + pan) to cursor
      const dx = mouseX - vpCenterX - panXRef.current
      const dy = mouseY - vpCenterY - panYRef.current

      // Adjust pan so the point under the cursor stays fixed
      const newPanX = panXRef.current + dx * (1 - ratio)
      const newPanY = panYRef.current + dy * (1 - ratio)

      setZoom(newZoom)
      setPanX(newPanX)
      setPanY(newPanY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        resetView()
      }

      if (inInput) return

      // Undo/Redo — Cmd+Z / Cmd+Shift+Z (only when not in text inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      // Toggle grid overlay with G key
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        updateGridConfig({ showGrid: !gridConfig.showGrid })
      }
      // Space: Play/Pause
      if (e.key === ' ') {
        e.preventDefault()
        if (isPlayingRef.current) pause()
        else play()
      }
      // Arrow keys: frame stepping
      if (e.key === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault()
        stepFrame(-1)
      }
      if (e.key === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault()
        stepFrame(1)
      }
      // Shift+Arrow: 1 second jumps
      if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault()
        const idx = scenesRef.current.findIndex((s) => s.id === selectedIdRef.current)
        const off = scenesRef.current.slice(0, Math.max(0, idx)).reduce((a, s) => a + s.duration, 0)
        handleSeek(Math.max(0, off + currentTimeRef.current - 1))
      }
      if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault()
        const idx = scenesRef.current.findIndex((s) => s.id === selectedIdRef.current)
        const off = scenesRef.current.slice(0, Math.max(0, idx)).reduce((a, s) => a + s.duration, 0)
        const totalDur = scenesRef.current.reduce((a, s) => a + s.duration, 0)
        handleSeek(Math.min(totalDur, off + currentTimeRef.current + 1))
      }
      // Home/End: jump to start/end
      if (e.key === 'Home') {
        e.preventDefault()
        handleSeek(0)
      }
      if (e.key === 'End') {
        e.preventDefault()
        handleSeek(scenesRef.current.reduce((a, s) => a + s.duration, 0))
      }
      // [ ] : jump to scene boundaries
      if (e.key === '[') {
        e.preventDefault()
        jumpScene(-1)
      }
      if (e.key === ']') {
        e.preventDefault()
        jumpScene(1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    isFullscreen,
    resetView,
    gridConfig.showGrid,
    updateGridConfig,
    pause,
    play,
    stepFrame,
    jumpScene,
    handleSeek,
    undo,
    redo,
  ])

  // ── Drag-to-pan ───────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 && e.button !== 1) return
      setIsDragging(true)
      dragOrigin.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
      e.preventDefault()
    },
    [panX, panY],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      setPanX(dragOrigin.current.px + e.clientX - dragOrigin.current.x)
      setPanY(dragOrigin.current.py + e.clientY - dragOrigin.current.y)
    },
    [isDragging],
  )

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // ── Computed values ───────────────────────────────────────────────────────
  const sceneIndex = scenes.findIndex((s) => s.id === selectedSceneId)
  const sceneStartOffset = scenes.slice(0, Math.max(0, sceneIndex)).reduce((a, s) => a + s.duration, 0)
  const globalTime = sceneStartOffset + currentTime

  // Sync transport state to store so Editor/TransportBar can read it
  useEffect(() => {
    setTimelineTransport({ globalTime, totalDuration, isPlaying })
  }, [globalTime, totalDuration, isPlaying, setTimelineTransport])
  const hasAnyScene = scenes.some((s) => {
    if (s.sceneType === 'react') return !!s.reactCode
    if (s.sceneType === 'lottie') return !!s.lottieSource
    if (s.sceneType === 'canvas2d') return !!s.canvasCode
    if (s.sceneType === 'motion' || s.sceneType === 'd3' || s.sceneType === 'three' || s.sceneType === 'physics') {
      return !!s.sceneCode || !!s.canvasBackgroundCode?.trim()
    }
    if (s.sceneType === '3d_world') return !!s.worldConfig
    if (s.sceneType === 'avatar_scene') return !!s.aiLayers?.some((l) => l.type === 'avatar')
    return !!s.svgContent || !!s.canvasBackgroundCode?.trim()
  })

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60),
      sec = Math.floor(s % 60),
      ms = Math.floor((s % 1) * 10)
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`
  }

  const getSceneSrc = (scene: Scene): string | null => {
    const byType: Record<string, boolean> = {
      react: !!scene.reactCode,
      svg: !!scene.svgContent,
      canvas2d: !!scene.canvasCode,
      motion: !!scene.sceneHTML || !!scene.sceneCode || !!scene.canvasBackgroundCode?.trim(),
      d3: !!scene.sceneCode || !!scene.canvasBackgroundCode?.trim(),
      three: !!scene.sceneCode,
      lottie: !!scene.lottieSource,
      zdog: !!scene.sceneCode,
      physics: !!scene.sceneCode,
      '3d_world': !!scene.worldConfig || !!scene.sceneHTML,
      avatar_scene: !!scene.aiLayers?.some((l) => l.type === 'avatar'),
    }
    const st = scene.sceneType ?? 'svg'
    let hasRenderable = byType[st] ?? false
    if (st === 'svg') hasRenderable = hasRenderable || !!scene.canvasBackgroundCode?.trim()
    if (!hasRenderable) {
      // Persist middleware can clobber in-memory code fields after DB load while the HTML
      // file on disk is valid. If the scene has a sceneType set (meaning it was generated
      // at some point) and there's no recorded write error, assume the HTML file exists.
      if (scene.sceneType && scene.sceneType !== 'svg' && !sceneWriteErrors[scene.id]) {
        hasRenderable = true
      }
    }
    if (!hasRenderable) {
      console.log(
        `[Preview] No content for ${scene.id.slice(0, 8)}… type=${scene.sceneType} svg=${!!scene.svgContent} canvas=${!!scene.canvasCode} code=${!!scene.sceneCode} lottie=${!!scene.lottieSource} html=${!!scene.sceneHTML} world=${!!scene.worldConfig}`,
      )
      return null
    }
    const v = sceneVersions[scene.id] ?? 0
    return `/scenes/${scene.id}.html${v > 0 ? `?v=${v}` : ''}`
  }

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvas = (
    <div
      style={{
        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        transformOrigin: 'center center',
        transition: isDragging ? 'none' : 'transform 0.12s ease',
        willChange: 'transform',
        flexShrink: 0,
      }}
    >
      <div
        ref={canvasRef}
        className={`preview-frame relative ${outputMode === 'interactive' ? 'overflow-visible' : 'overflow-hidden'}`}
        style={{
          aspectRatio: previewAspect,
          ...(projectDims.width >= projectDims.height
            ? { width: isFullscreen ? 'min(1280px, 88vw)' : 'min(780px, 62vw)' }
            : {
                height: isFullscreen ? 'min(85vh, 900px)' : 'min(70vh, 700px)',
                maxWidth: isFullscreen ? '88vw' : '62vw',
              }),
        }}
      >
        {/* Compositor preview (Pixi canvas) — continuous timeline rendering */}
        {compositorPreview && (
          <div className="absolute inset-0 z-[3]">
            <PixiPreviewCanvas
              scenes={scenes}
              globalStyle={useVideoStore.getState().globalStyle}
              timeline={useVideoStore.getState().project.timeline}
              isPlaying={isPlaying}
              onPlayingChange={setIsPlaying}
              currentTime={globalTime}
              onTimeUpdate={(t) => {
                // Convert global time back to scene-local for UI sync
                let acc = 0
                for (const s of scenes) {
                  if (t < acc + s.duration) {
                    setCurrentTime(t - acc)
                    return
                  }
                  acc += s.duration
                }
                setCurrentTime(0)
              }}
              onSceneChange={(idx) => {
                if (idx >= 0 && idx < scenes.length) {
                  // Pause previous scene's iframe audio
                  pauseAllScenes()
                  isAutoAdvancing.current = true
                  useVideoStore.getState().selectScene(scenes[idx].id)
                  // Resume new scene's iframe audio (for TTS/music/SFX playback)
                  const newId = scenes[idx].id
                  const player = playerMapRef.current[newId]
                  if (player) {
                    player.seek(0)
                    player.play()
                  }
                }
              }}
              onEnded={() => {
                pauseAllScenes()
                setIsPlaying(false)
              }}
            />
          </div>
        )}

        {/* All scene iframes — always in DOM, switch by display */}
        {scenes.map((scene) => {
          const src = getSceneSrc(scene)
          if (!src) return null
          const isSelected = !compositorPreview && scene.id === selectedSceneId
          const hasError = failedScenes.has(scene.id) || !!sceneWriteErrors[scene.id]
          return (
            <div
              key={scene.id}
              className="absolute inset-0"
              style={{
                visibility: isSelected ? 'visible' : 'hidden',
                zIndex: scene.id === selectedSceneId ? 2 : 1,
              }}
            >
              <iframe
                ref={(el) => {
                  iframeMapRef.current[scene.id] = el
                }}
                data-scene-id={scene.id}
                src={src}
                className="scene-iframe absolute inset-0 h-full w-full max-h-full max-w-full border-0 outline-none ring-0"
                style={{
                  pointerEvents: isSelected ? 'auto' : 'none',
                  background: scene.bgColor ?? '#fffef9',
                }}
                onLoad={() => {
                  setFailedScenes((prev) => {
                    if (!prev.has(scene.id)) return prev
                    const next = new Set(prev)
                    next.delete(scene.id)
                    return next
                  })
                  handleSceneLoad(scene.id)
                }}
                onError={() => {
                  setFailedScenes((prev) => new Set(prev).add(scene.id))
                }}
                allow="autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-autoplay"
                title={`Scene ${scene.id}`}
              />
              {/* Error overlay — shown when scene HTML failed to load or write */}
              {isSelected && hasError && (
                <div
                  className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2"
                  style={{ background: scene.bgColor ?? '#fffef9' }}
                >
                  <span className="text-sm text-red-500 font-medium">
                    {sceneWriteErrors[scene.id] || 'Scene failed to load'}
                  </span>
                  <span
                    className="text-sm text-neutral-500 hover:text-neutral-700 cursor-pointer underline"
                    onClick={() => {
                      setFailedScenes((prev) => {
                        const next = new Set(prev)
                        next.delete(scene.id)
                        return next
                      })
                      // Clear store error and bump version to force iframe reload
                      const { [scene.id]: _, ...rest } = useVideoStore.getState().sceneWriteErrors
                      useVideoStore.setState({ sceneWriteErrors: rest })
                      setSceneVersions((prev) => ({ ...prev, [scene.id]: (prev[scene.id] ?? 0) + 1 }))
                    }}
                  >
                    Click to retry
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {/* Grid overlay */}
        <GridOverlay grid={gridConfig} />

        {/* Generating overlay */}
        {isThisGenerating && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-6"
            style={{ background: selectedScene?.bgColor ?? '#fffef9' }}
          >
            {selectedScene?.sceneType === 'canvas2d' ? (
              <>
                <span className="text-[var(--color-accent)] text-sm font-mono uppercase tracking-widest animate-pulse">
                  drawing...
                </span>
                <span className="text-[#3a3a45] text-[11px] text-center max-w-[200px]">
                  Generating Canvas animation...
                </span>
              </>
            ) : selectedScene?.sceneType === 'motion' ? (
              <>
                <span className="text-[var(--color-accent)] text-sm font-mono uppercase tracking-widest animate-pulse">
                  animating...
                </span>
                <span className="text-[#3a3a45] text-[11px] text-center max-w-[200px]">
                  Generating Motion animation...
                </span>
              </>
            ) : selectedScene?.sceneType === 'd3' ? (
              <>
                <span className="text-[var(--color-accent)] text-sm font-mono uppercase tracking-widest animate-pulse">
                  charting...
                </span>
                <span className="text-[#3a3a45] text-[11px] text-center max-w-[200px]">
                  Generating D3 visualization...
                </span>
              </>
            ) : selectedScene?.sceneType === 'three' ? (
              <>
                <span className="text-[var(--color-accent)] text-sm font-mono uppercase tracking-widest animate-pulse">
                  rendering...
                </span>
                <span className="text-[#3a3a45] text-[11px] text-center max-w-[200px]">
                  Generating Three.js scene...
                </span>
              </>
            ) : selectedScene?.sceneType === 'lottie' ? (
              <>
                <span className="text-[var(--color-accent)] text-sm font-mono uppercase tracking-widest animate-pulse">
                  drawing...
                </span>
                <span className="text-[#3a3a45] text-[11px] text-center max-w-[200px]">Generating SVG overlay...</span>
              </>
            ) : selectedScene?.svgContent ? (
              <div
                className="w-full h-full"
                style={{ pointerEvents: 'none' }}
                dangerouslySetInnerHTML={{ __html: selectedScene.svgContent }}
              />
            ) : (
              <>
                <span className="text-[var(--color-accent)] text-sm font-mono uppercase tracking-widest animate-pulse">
                  drawing...
                </span>
                <span className="text-[#3a3a45] text-[11px] text-center max-w-[200px]">
                  Generating SVG elements and animations...
                </span>
              </>
            )}
          </div>
        )}

        {/* Empty state for selected scene */}
        {!selectedScene?.svgContent &&
          !selectedScene?.canvasCode &&
          !selectedScene?.sceneCode &&
          !selectedScene?.lottieSource &&
          !selectedScene?.sceneHTML &&
          !selectedScene?.canvasBackgroundCode?.trim() &&
          !(selectedScene?.sceneType === '3d_world' && selectedScene?.worldConfig) &&
          !(selectedScene?.sceneType === 'avatar_scene' && selectedScene?.aiLayers?.some((l) => l.type === 'avatar')) &&
          !isThisGenerating && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background: selectedScene ? (selectedScene.bgColor ?? 'var(--color-input-bg)') : '#000' }}
            >
              {selectedScene && (
                <>
                  <p className="text-[#6b6b7a] text-sm">No content yet</p>
                  <p className="text-[#3a3a45] text-sm">Write a prompt and click Generate</p>
                </>
              )}
            </div>
          )}

        {/* Loading indicator */}
        {selectedSceneId &&
          (selectedScene?.svgContent ||
            selectedScene?.canvasCode ||
            selectedScene?.sceneCode ||
            selectedScene?.lottieSource ||
            selectedScene?.sceneHTML ||
            !!selectedScene?.canvasBackgroundCode?.trim() ||
            (selectedScene?.sceneType === '3d_world' && !!selectedScene?.worldConfig) ||
            (selectedScene?.sceneType === 'avatar_scene' &&
              !!selectedScene?.aiLayers?.some((l) => l.type === 'avatar'))) &&
          !loadedScenes.has(selectedSceneId) &&
          !isThisGenerating && (
            <div className="absolute inset-0 z-10 bg-[#0d0d0f]/80 flex items-center justify-center pointer-events-none">
              <div className="text-[#6b6b7a] text-sm">Loading preview...</div>
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
            mode={isPlaying ? 'preview' : 'edit'}
            currentTime={currentTime}
            interactionCallbacks={interactionCallbacks}
          />
        )}
      </div>
    </div>
  )

  const viewport = (
    <div
      ref={viewportRef}
      className="w-full h-full flex items-center justify-center select-none overflow-hidden"
      style={{
        cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
        background: 'var(--color-input-bg)',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {canvas}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  // Zdog Studio mode: replace entire preview+timeline with Zdog viewport + properties
  if (zdogStudioMode) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <ZdogViewport />
        <div className="border-t border-[var(--color-border)]" style={{ height: Math.max(timelineHeight, 140) }}>
          <ZdogProperties />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-visible relative">
      <div className="flex-1 relative">
        {studioRecordMode ? (
          <div className="absolute inset-0 overflow-hidden">
            <StudioRecordPreview />
          </div>
        ) : (
          <div className={`absolute inset-0 ${outputMode === 'interactive' ? 'overflow-visible' : 'overflow-hidden'}`}>
            {viewport}
          </div>
        )}
      </div>
    </div>
  )
}

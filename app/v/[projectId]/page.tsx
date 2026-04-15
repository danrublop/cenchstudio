'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import type { InteractionElement } from '@/lib/types'
import type { TransitionType } from '@/lib/transitions'
import { transitionUsesBlendInPlayer } from '@/lib/transitions'
import { InteractionRenderer, InteractionStyles } from '@/components/interactions/InteractionRenderer'
import type { InteractionCallbacks } from '@/components/interactions/InteractionRenderer'
import { evaluateEdgeCondition } from '@/lib/variables/evaluator'

// ── Types (inline to avoid importing full lib/types) ─────────────────────────

interface PlayerOptions {
  theme: string
  showProgressBar: boolean
  showSceneNav: boolean
  allowFullscreen: boolean
  brandColor: string
  autoplay: boolean
}

interface SceneEdge {
  fromSceneId: string
  toSceneId: string
  condition: {
    type: 'auto' | 'hotspot' | 'choice' | 'quiz' | 'gate' | 'variable' | 'slider' | 'toggle'
    interactionId?: string | null
    variableName?: string | null
    variableValue?: string | null
    variableCondition?: import('@/lib/types/interaction').VariableCondition | null
  }
}

interface PublishedScene {
  id: string
  type: string
  duration: number
  htmlUrl: string
  htmlContent: string | null
  interactions: InteractionElement[]
  variables: { name: string; defaultValue?: string | number | boolean; type?: 'string' | 'number' | 'boolean' }[]
  transition: TransitionType
}

interface PublishedProject {
  id: string
  version: number
  name: string
  playerOptions: PlayerOptions
  sceneGraph: { nodes: any[]; edges: SceneEdge[]; startSceneId: string }
  scenes: PublishedScene[]
}

// ── ScenePlayer (inline — postMessage sync with GSAP iframe) ─────────────────

class ScenePlayer {
  private iframe: HTMLIFrameElement
  private sceneId: string
  private handler: (e: MessageEvent) => void

  public currentTime = 0
  public duration = 0
  public status: 'loading' | 'ready' | 'playing' | 'paused' | 'ended' = 'loading'

  onTimeUpdate?: (t: number) => void
  onEnded?: () => void
  onReady?: (duration: number) => void
  /** Fired when scene code calls useVariable setValue */
  onVariableChanged?: (name: string, value: unknown) => void
  /** Fired when scene code calls useInteraction onClick/onHover */
  onElementClicked?: (elementId: string, data?: Record<string, unknown>) => void
  /** Fired when scene code calls useTrigger fire() */
  onInteractionEvent?: (name: string, payload?: unknown) => void

  constructor(iframe: HTMLIFrameElement, sceneId: string) {
    this.iframe = iframe
    this.sceneId = sceneId
    this.handler = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.source !== 'cench-scene') return
      if (d.sceneId !== this.sceneId) return
      switch (d.type) {
        case 'ready':
          this.duration = d.duration ?? 0
          this.status = 'paused'
          this.onReady?.(this.duration)
          break
        case 'timeupdate':
          this.currentTime = d.currentTime ?? 0
          this.onTimeUpdate?.(this.currentTime)
          break
        case 'ended':
          this.status = 'ended'
          this.onEnded?.()
          break
        case 'playing':
          this.status = 'playing'
          break
        case 'paused':
          this.status = 'paused'
          this.currentTime = d.currentTime ?? this.currentTime
          break
        // ── New: in-scene interaction events ──
        case 'variable_changed':
          this.onVariableChanged?.(d.name, d.value)
          break
        case 'element_clicked':
          this.onElementClicked?.(d.elementId, d.data)
          break
        case 'interaction_event':
          this.onInteractionEvent?.(d.name, d.payload)
          break
      }
    }
    window.addEventListener('message', this.handler)
  }

  private send(msg: Record<string, unknown>) {
    try {
      this.iframe.contentWindow?.postMessage({ target: 'cench-scene', sceneId: this.sceneId, ...msg }, '*')
    } catch {}
  }

  play() {
    this.send({ type: 'play' })
  }
  pause() {
    this.send({ type: 'pause' })
  }
  seek(time: number) {
    this.send({ type: 'seek', time })
  }
  reset() {
    this.send({ type: 'reset' })
  }
  /** Push a variable value into the scene iframe */
  setVariable(name: string, value: unknown) {
    this.send({ type: 'set_variable', name, value })
  }
  /** Fire a named trigger into the scene */
  fireTrigger(name: string, payload?: unknown) {
    this.send({ type: 'fire_trigger', name, payload })
  }
  destroy() {
    window.removeEventListener('message', this.handler)
  }
}

// ── Published viewer ─────────────────────────────────────────────────────────

export default function ViewerPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [manifest, setManifest] = useState<PublishedProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [variables, setVariables] = useState<Record<string, unknown>>({})
  const [transitioning, setTransitioning] = useState(false)
  const [showChapters, setShowChapters] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<ScenePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'no-crypto')
  const triggeredGatesRef = useRef<Set<string>>(new Set())
  const appearedRef = useRef<Set<string>>(new Set())
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null)

  // ── Track analytics ──

  const track = useCallback(
    (event: string, data: Record<string, unknown> = {}) => {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, event, data, sessionId: sessionId.current }),
      }).catch(() => {})
    },
    [projectId],
  )

  // ── Load manifest ──

  useEffect(() => {
    fetch(`/published/${projectId}/manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error('Project not found')
        return r.json()
      })
      .then((data: PublishedProject) => {
        setManifest(data)
        if (data.scenes.length > 0) {
          const startId = data.sceneGraph.startSceneId || data.scenes[0].id
          setCurrentSceneId(startId)
          track('project_started')
        }
      })
      .catch((err) => setError(err.message))
  }, [projectId, track])

  const currentScene = useMemo(
    () => manifest?.scenes.find((s) => s.id === currentSceneId) ?? null,
    [manifest, currentSceneId],
  )

  const totalDuration = useMemo(() => manifest?.scenes.reduce((a, s) => a + s.duration, 0) ?? 0, [manifest])

  const sceneOffset = useMemo(() => {
    if (!manifest || !currentSceneId) return 0
    const idx = manifest.scenes.findIndex((s) => s.id === currentSceneId)
    return manifest.scenes.slice(0, idx).reduce((a, s) => a + s.duration, 0)
  }, [manifest, currentSceneId])

  const currentIdx = useMemo(() => manifest?.scenes.findIndex((s) => s.id === currentSceneId) ?? -1, [manifest, currentSceneId])

  // ── Load scene into iframe ──

  useEffect(() => {
    if (!currentScene || !iframeRef.current) return

    const loadScene = async () => {
      // Clean up previous player
      playerRef.current?.destroy()
      playerRef.current = null

      let html: string
      if (currentScene.htmlContent) {
        html = currentScene.htmlContent
      } else {
        const res = await fetch(currentScene.htmlUrl)
        html = await res.text()
      }

      // Variable interpolation
      for (const [name, value] of Object.entries(variables)) {
        html = html.replaceAll(`{${name}}`, String(value ?? ''))
      }

      // Approximate blend handoff (full xfade parity only in MP4 export)
      if (transitionUsesBlendInPlayer(currentScene.transition)) {
        setTransitioning(true)
        setTimeout(() => setTransitioning(false), 500)
      }

      iframeRef.current!.srcdoc = html
      setPlayhead(0)
      triggeredGatesRef.current.clear()
      appearedRef.current.clear()

      // Create ScenePlayer for GSAP sync
      const player = new ScenePlayer(iframeRef.current!, currentScene.id)
      playerRef.current = player

      player.onTimeUpdate = (t) => {
        setPlayhead(t)
      }

      player.onReady = () => {
        if (manifest?.playerOptions.autoplay || isPlaying) {
          player.play()
          setIsPlaying(true)
        }
      }

      player.onEnded = () => {
        handleSceneEnd()
      }

      // In-scene interaction events (from CenchReact hooks)
      player.onVariableChanged = (name, value) => {
        setVariables((prev) => ({ ...prev, [name]: value }))
        track('variable_set', { name, value, source: 'scene' })
      }

      player.onElementClicked = (elementId, data) => {
        track('interaction_fired', {
          sceneId: currentScene.id,
          interactionId: elementId,
          type: 'in-scene',
          ...data,
        })
        // Check if any edge is triggered by this element
        if (manifest) {
          const edges = manifest.sceneGraph.edges.filter(
            (e) => e.fromSceneId === currentScene.id && e.condition.interactionId === elementId,
          )
          for (const edge of edges) {
            goToScene(edge.toSceneId, 'element-click')
            return
          }
        }
      }

      player.onInteractionEvent = (name, payload) => {
        track('interaction_fired', {
          sceneId: currentScene.id,
          type: 'trigger',
          triggerName: name,
          payload,
        })
      }

      track('scene_viewed', { sceneId: currentScene.id, type: currentScene.type })
    }

    loadScene()

    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [currentSceneId, currentScene?.id])

  // ── Gate detection via RAF polling ──

  useEffect(() => {
    if (!isPlaying || !currentScene) return
    let rafId: number

    const checkGates = () => {
      if (!playerRef.current) return
      const t = playerRef.current.currentTime

      for (const el of currentScene.interactions) {
        if (el.type === 'gate' && !triggeredGatesRef.current.has(el.id)) {
          const minWatch = (el as any).minimumWatchTime ?? 0
          if (t >= el.appearsAt && t < el.appearsAt + 0.3 && t >= minWatch) {
            triggeredGatesRef.current.add(el.id)
            playerRef.current?.pause()
            setIsPlaying(false)
            return
          }
        }
      }
      rafId = requestAnimationFrame(checkGates)
    }

    rafId = requestAnimationFrame(checkGates)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, currentScene])

  // ── Scene end handling ──

  const handleSceneEnd = useCallback(() => {
    if (!manifest || !currentSceneId) return

    // Check variable-condition edges first (supports both legacy and rich conditions)
    const edges = manifest.sceneGraph.edges.filter((e) => e.fromSceneId === currentSceneId)
    for (const edge of edges) {
      if (edge.condition.type === 'variable') {
        if (evaluateEdgeCondition(variables, edge.condition)) {
          track('path_taken', { fromSceneId: currentSceneId, toSceneId: edge.toSceneId, edgeCondition: 'variable' })
          setCurrentSceneId(edge.toSceneId)
          return
        }
      }
    }

    // Fall back to auto edge
    const autoEdge = edges.find((e) => e.condition.type === 'auto')
    if (autoEdge) {
      track('path_taken', { fromSceneId: currentSceneId, toSceneId: autoEdge.toSceneId, edgeCondition: 'auto' })
      setCurrentSceneId(autoEdge.toSceneId)
    } else {
      // No more scenes
      setIsPlaying(false)
      track('project_completed')
    }
  }, [manifest, currentSceneId, variables, track])

  // ── Navigation helpers ──

  const goToScene = useCallback(
    (sceneId: string, reason = 'interaction') => {
      track('path_taken', { fromSceneId: currentSceneId, toSceneId: sceneId, edgeCondition: reason })
      setCurrentSceneId(sceneId)
    },
    [currentSceneId, track],
  )

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      playerRef.current?.pause()
      setIsPlaying(false)
    } else {
      playerRef.current?.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!manifest) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight': {
          e.preventDefault()
          const idx = manifest.scenes.findIndex((s) => s.id === currentSceneId)
          if (idx < manifest.scenes.length - 1) goToScene(manifest.scenes[idx + 1].id, 'keyboard')
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const idx2 = manifest.scenes.findIndex((s) => s.id === currentSceneId)
          if (idx2 > 0) goToScene(manifest.scenes[idx2 - 1].id, 'keyboard')
          break
        }
        case 'f':
        case 'F':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            if (document.fullscreenElement) {
              document.exitFullscreen()
            } else {
              containerRef.current?.requestFullscreen?.()
            }
          }
          break
        case 'Escape':
          if (document.fullscreenElement) document.exitFullscreen()
          break
        default:
          if (e.key >= '1' && e.key <= '9') {
            const sceneIdx = parseInt(e.key) - 1
            if (manifest.scenes[sceneIdx]) {
              goToScene(manifest.scenes[sceneIdx].id, 'keyboard')
            }
          }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [manifest, currentSceneId, togglePlay, goToScene])

  // ── URL deep linking (hash-based scene routing) ──

  useEffect(() => {
    if (!manifest) return
    const hash = window.location.hash.slice(1)
    if (!hash) return

    const sceneNumMatch = hash.match(/^scene-(\d+)$/)
    if (sceneNumMatch) {
      const idx = parseInt(sceneNumMatch[1]) - 1
      if (manifest.scenes[idx]) setCurrentSceneId(manifest.scenes[idx].id)
    } else {
      const scene = manifest.scenes.find((s) => s.id === hash)
      if (scene) setCurrentSceneId(scene.id)
    }
  }, [manifest])

  useEffect(() => {
    if (!manifest || !currentSceneId) return
    const idx = manifest.scenes.findIndex((s) => s.id === currentSceneId)
    if (idx >= 0) {
      window.history.replaceState(null, '', `#scene-${idx + 1}`)
    }
  }, [currentSceneId, manifest])

  // ── Interaction callbacks ──

  const setVariable = useCallback(
    (name: string, value: unknown) => {
      setVariables((prev) => ({ ...prev, [name]: value }))
      // Push variable into the scene iframe so React hooks update
      playerRef.current?.setVariable(name, value)
      track('variable_set', { name, value })
    },
    [track],
  )

  const interactionCallbacks: InteractionCallbacks = useMemo(
    () => ({
      brandColor: manifest?.playerOptions.brandColor || '#e84545',
      onHotspotClick: (el) => {
        track('interaction_fired', { sceneId: currentSceneId, interactionId: el.id, type: 'hotspot' })
        if (el.jumpsToSceneId) goToScene(el.jumpsToSceneId, 'hotspot')
      },
      onChoiceSelect: (el, optionId, jumpsToSceneId) => {
        track('interaction_fired', { sceneId: currentSceneId, interactionId: el.id, type: 'choice', optionId })
        if (jumpsToSceneId) goToScene(jumpsToSceneId, 'choice')
      },
      onQuizAnswer: (el, selectedOptionId, correct) => {
        track('interaction_fired', {
          sceneId: currentSceneId,
          interactionId: el.id,
          type: 'quiz',
          correct,
          selectedOptionId,
        })
        setTimeout(() => {
          if (correct) {
            if (el.onCorrect === 'jump' && el.onCorrectSceneId) {
              goToScene(el.onCorrectSceneId, 'quiz-correct')
            } else {
              // Continue playback
              playerRef.current?.play()
              setIsPlaying(true)
            }
          } else {
            if (el.onWrong === 'retry') {
              // Reset handled inside QuizRenderer
            } else if (el.onWrong === 'jump' && el.onWrongSceneId) {
              goToScene(el.onWrongSceneId, 'quiz-wrong')
            } else {
              playerRef.current?.play()
              setIsPlaying(true)
            }
          }
        }, 1500)
      },
      onGateContinue: (_el) => {
        track('interaction_fired', { sceneId: currentSceneId, interactionId: _el.id, type: 'gate' })
        playerRef.current?.play()
        setIsPlaying(true)
      },
      onFormSubmit: (el, values) => {
        track('interaction_fired', { sceneId: currentSceneId, interactionId: el.id, type: 'form' })
        // Set variables from mapping
        for (const mapping of el.setsVariables) {
          const val = values[mapping.fieldId] ?? ''
          setVariable(mapping.variableName, val)
        }
        if (el.jumpsToSceneId) {
          goToScene(el.jumpsToSceneId, 'form')
        } else {
          playerRef.current?.play()
          setIsPlaying(true)
        }
      },
      onResume: () => {
        playerRef.current?.play()
        setIsPlaying(true)
      },
      onSliderChange: (el, value) => {
        track('interaction_fired', { sceneId: currentSceneId, interactionId: el.id, type: 'slider', value })
        setVariable(el.setsVariable, value)
      },
      onToggleChange: (el, value) => {
        track('interaction_fired', { sceneId: currentSceneId, interactionId: el.id, type: 'toggle', value })
        setVariable(el.setsVariable, value)
      },
      variables,
      setVariable,
    }),
    [manifest, currentSceneId, goToScene, track, variables, setVariable],
  )

  // ── Controls & gestures ──

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false)
    }, 3000)
  }, [isPlaying])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !manifest) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    const dt = Date.now() - touchStartRef.current.t
    touchStartRef.current = null

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 400) {
      if (dx < 0 && currentIdx < (manifest?.scenes.length ?? 0) - 1) {
        goToScene(manifest.scenes[currentIdx + 1].id, 'swipe')
      } else if (dx > 0 && currentIdx > 0) {
        goToScene(manifest.scenes[currentIdx - 1].id, 'swipe')
      }
    }
  }, [manifest, currentIdx, goToScene])

  // ── Render ──

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Project not found</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!manifest || !currentScene) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="animate-pulse text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  const brandColor = manifest?.playerOptions.brandColor || '#e84545'
  const totalProgress = totalDuration > 0 ? ((sceneOffset + playhead) / totalDuration) * 100 : 0
  const totalElapsed = sceneOffset + playhead

  return (
    <div className="flex h-screen bg-black" onMouseMove={showControls}>
      <InteractionStyles />

      {/* Chapter sidebar (toggleable) */}
      {showChapters && (
        <div
          className="flex-shrink-0 w-64 bg-black/95 border-r border-white/10 overflow-y-auto"
          style={{ zIndex: 30 }}
          style={{ animation: 'fadeIn 0.2s ease' }}
        >
          <div className="p-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white/90 truncate">{manifest.name}</h2>
            <p className="text-[10px] text-white/40 mt-1">{manifest.scenes.length} scenes</p>
          </div>
          {manifest.scenes.map((s, i) => {
            const isActive = s.id === currentSceneId
            const isPast = i < currentIdx
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => goToScene(s.id, 'chapter')}
                onKeyDown={(e) => { if (e.key === 'Enter') goToScene(s.id, 'chapter') }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-white/5"
                style={{
                  borderLeft: `3px solid ${isActive ? brandColor : 'transparent'}`,
                  background: isActive ? `rgba(255,255,255,0.05)` : undefined,
                }}
              >
                {/* Scene number */}
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: isPast ? brandColor : isActive ? `${brandColor}33` : 'rgba(255,255,255,0.08)',
                    color: isPast || isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {isPast ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" /></svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80 truncate">Scene {i + 1}</p>
                  <p className="text-[10px] text-white/30">{s.duration.toFixed(1)}s</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Main player area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Player container */}
        <div
          ref={containerRef}
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="relative w-full h-full"
            style={{
              maxWidth: '100vw',
              maxHeight: '100vh',
              aspectRatio: '16/9',
            }}
          >
            {/* Scene iframe */}
            <iframe
              ref={iframeRef}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-autoplay"
              title="Scene"
              style={{
                opacity: transitioning ? 0 : 1,
                transition: 'opacity 0.5s ease',
              }}
            />

            {/* Interaction overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
              {currentScene.interactions
                .filter((el) => {
                  if (playhead < el.appearsAt) return false
                  if (el.hidesAt !== null && playhead >= el.hidesAt) return false
                  return true
                })
                .map((el) => {
                  const firstAppearance = !appearedRef.current.has(el.id)
                  if (firstAppearance) appearedRef.current.add(el.id)
                  return (
                    <InteractionRenderer
                      key={el.id}
                      element={el}
                      callbacks={interactionCallbacks}
                      firstAppearance={firstAppearance}
                    />
                  )
                })}
            </div>

            {/* Scene indicator (top-right, fades with controls) */}
            <div
              className="absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-300"
              style={{ opacity: controlsVisible ? 1 : 0, zIndex: 20 }}
            >
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)' }}
              >
                {currentIdx + 1} / {manifest.scenes.length}
              </span>
            </div>
          </div>
        </div>

        {/* Controls bar */}
        {manifest.playerOptions.showProgressBar && (
          <div
            className="flex-shrink-0 px-4 py-2.5 transition-opacity duration-300"
            style={{
              opacity: controlsVisible ? 1 : 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6))',
              zIndex: 30,
              position: 'relative',
            }}
          >
            {/* Segmented progress bar */}
            <div className="flex gap-0.5 mb-2">
              {manifest.scenes.map((s, i) => {
                const scenePct = s.duration / totalDuration
                let fillPct = 0
                if (i < currentIdx) fillPct = 100
                else if (i === currentIdx) fillPct = Math.min((playhead / s.duration) * 100, 100)
                return (
                  <div
                    key={s.id}
                    className="h-1 rounded-full cursor-pointer hover:h-1.5 transition-all"
                    style={{
                      flex: scenePct,
                      background: `rgba(255,255,255,0.12)`,
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToScene(s.id, 'progress')}
                    onKeyDown={(e) => { if (e.key === 'Enter') goToScene(s.id, 'progress') }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{
                        width: `${fillPct}%`,
                        background: brandColor,
                      }}
                    />
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Chapters toggle */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowChapters((p) => !p)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setShowChapters((p) => !p) }}
                  className="text-white/50 hover:text-white transition-colors cursor-pointer"
                  title="Chapters"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </span>

                {/* Play/pause */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={togglePlay}
                  onKeyDown={(e) => { if (e.key === 'Enter') togglePlay() }}
                  className="text-white hover:opacity-80 transition-opacity cursor-pointer"
                >
                  {isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </span>

                {/* Prev/Next */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (currentIdx > 0) goToScene(manifest.scenes[currentIdx - 1].id, 'nav') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && currentIdx > 0) goToScene(manifest.scenes[currentIdx - 1].id, 'nav') }}
                  className="text-white/50 hover:text-white transition-colors cursor-pointer"
                  style={{ opacity: currentIdx > 0 ? 1 : 0.3 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                  </svg>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (currentIdx < manifest.scenes.length - 1) goToScene(manifest.scenes[currentIdx + 1].id, 'nav') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && currentIdx < manifest.scenes.length - 1) goToScene(manifest.scenes[currentIdx + 1].id, 'nav') }}
                  className="text-white/50 hover:text-white transition-colors cursor-pointer"
                  style={{ opacity: currentIdx < manifest.scenes.length - 1 ? 1 : 0.3 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </span>

                <span className="text-[11px] text-white/50 font-mono">
                  {formatTime(totalElapsed)} / {formatTime(totalDuration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Scene nav dots */}
                {manifest.playerOptions.showSceneNav && (
                  <div className="flex items-center gap-1">
                    {manifest.scenes.map((s, i) => (
                      <span
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => goToScene(s.id, 'nav')}
                        onKeyDown={(e) => { if (e.key === 'Enter') goToScene(s.id, 'nav') }}
                        className="w-2 h-2 rounded-full transition-all cursor-pointer"
                        style={{
                          background: s.id === currentSceneId ? brandColor : 'rgba(255,255,255,0.2)',
                          transform: s.id === currentSceneId ? 'scale(1.3)' : 'scale(1)',
                        }}
                        title={`Scene ${i + 1}`}
                      />
                    ))}
                  </div>
                )}

                {/* Fullscreen */}
                {manifest.playerOptions.allowFullscreen && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen()
                      else containerRef.current?.requestFullscreen?.()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (document.fullscreenElement) document.exitFullscreen()
                        else containerRef.current?.requestFullscreen?.()
                      }
                    }}
                    className="text-white/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import type { InteractionElement } from '@/lib/types'
import type { TransitionType } from '@/lib/transitions'
import { transitionUsesBlendInPlayer } from '@/lib/transitions'
import { InteractionRenderer, InteractionStyles } from '@/components/interactions/InteractionRenderer'
import type { InteractionCallbacks } from '@/components/interactions/InteractionRenderer'

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
    type: 'auto' | 'hotspot' | 'choice' | 'quiz' | 'gate' | 'variable'
    interactionId?: string | null
    variableName?: string | null
    variableValue?: string | null
  }
}

interface PublishedScene {
  id: string
  type: string
  duration: number
  htmlUrl: string
  htmlContent: string | null
  interactions: InteractionElement[]
  variables: { name: string; defaultValue: string }[]
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
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [transitioning, setTransitioning] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<ScenePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'no-crypto')
  const triggeredGatesRef = useRef<Set<string>>(new Set())
  const appearedRef = useRef<Set<string>>(new Set())

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
        html = html.replaceAll(`{${name}}`, value)
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

    // Check variable-condition edges first
    const edges = manifest.sceneGraph.edges.filter((e) => e.fromSceneId === currentSceneId)
    for (const edge of edges) {
      if (edge.condition.type === 'variable') {
        const val = variables[edge.condition.variableName!]
        if (val === edge.condition.variableValue) {
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

  // ── Interaction callbacks ──

  const setVariable = useCallback(
    (name: string, value: string) => {
      setVariables((prev) => ({ ...prev, [name]: value }))
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
      variables,
      setVariable,
    }),
    [manifest, currentSceneId, goToScene, track, variables, setVariable],
  )

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

  const brandColor = manifest.playerOptions.brandColor || '#e84545'
  const totalProgress = totalDuration > 0 ? ((sceneOffset + playhead) / totalDuration) * 100 : 0
  const totalElapsed = sceneOffset + playhead

  return (
    <div className="flex flex-col h-screen bg-black">
      <InteractionStyles />

      {/* Player container */}
      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div
          className="relative w-full h-full"
          style={{
            maxWidth: '100vw',
            maxHeight: '100vh',
            aspectRatio: '16/9',
          }}
        >
          {/* Scene iframe with optional blend-in between scenes */}
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
        </div>
      </div>

      {/* Controls bar */}
      {manifest.playerOptions.showProgressBar && (
        <div className="flex-shrink-0 px-4 py-2 bg-black/80 border-t border-white/10">
          {/* Total progress bar */}
          <div className="w-full h-1 bg-white/10 rounded-full mb-2 cursor-pointer">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{ width: `${Math.min(totalProgress, 100)}%`, background: brandColor }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                role="button"
                tabIndex={0}
                onClick={togglePlay}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') togglePlay()
                }}
                className="text-white hover:opacity-80 transition-opacity cursor-pointer"
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </span>
              <span className="text-[11px] text-white/50 font-mono">
                {formatTime(totalElapsed)} / {formatTime(totalDuration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Scene nav dots (optional, default off) */}
              {manifest.playerOptions.showSceneNav && (
                <div className="flex items-center gap-1">
                  {manifest.scenes.map((s, i) => (
                    <span
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToScene(s.id, 'nav')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') goToScene(s.id, 'nav')
                      }}
                      className="w-2 h-2 rounded-full transition-all cursor-pointer"
                      style={{
                        background: s.id === currentSceneId ? brandColor : 'rgba(255,255,255,0.2)',
                      }}
                      title={`Scene ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {manifest.playerOptions.allowFullscreen && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => containerRef.current?.requestFullscreen?.()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') containerRef.current?.requestFullscreen?.()
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
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { PublishedProject, PublishedScene, InteractionElement, SceneEdge } from '@/lib/types'

interface PlayerState {
  currentSceneId: string | null
  playhead: number       // seconds into current scene
  isPlaying: boolean
  variables: Record<string, string>
}

export default function ViewerPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [manifest, setManifest] = useState<PublishedProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<PlayerState>({
    currentSceneId: null,
    playhead: 0,
    isPlaying: false,
    variables: {},
  })
  const [gateActive, setGateActive] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionId = useRef(crypto.randomUUID())
  const containerRef = useRef<HTMLDivElement>(null)

  // Track event
  const track = useCallback(
    (event: string, data: Record<string, unknown> = {}) => {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, event, data, sessionId: sessionId.current }),
      }).catch(() => {})
    },
    [projectId]
  )

  // Load manifest
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
          setState((s) => ({ ...s, currentSceneId: startId }))
          track('project_started')
        }
      })
      .catch((err) => setError(err.message))
  }, [projectId, track])

  const currentScene = manifest?.scenes.find((s) => s.id === state.currentSceneId) ?? null

  // Load scene HTML into iframe
  useEffect(() => {
    if (!currentScene || !iframeRef.current) return

    const loadScene = async () => {
      let html: string
      if (currentScene.htmlContent) {
        html = currentScene.htmlContent
      } else {
        const res = await fetch(currentScene.htmlUrl)
        html = await res.text()
      }

      // Variable interpolation
      for (const [name, value] of Object.entries(state.variables)) {
        html = html.replaceAll(`{${name}}`, value)
      }

      iframeRef.current!.srcdoc = html
      setState((s) => ({ ...s, playhead: 0, isPlaying: true }))
      setGateActive(false)

      track('scene_viewed', { sceneId: currentScene.id, type: currentScene.type })
    }

    loadScene()
  }, [state.currentSceneId, currentScene?.id])

  // Playhead timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (state.isPlaying && currentScene && !gateActive) {
      timerRef.current = setInterval(() => {
        setState((s) => {
          const next = s.playhead + 0.1
          // Check for gate interactions
          const gate = currentScene.interactions.find(
            (i) => i.type === 'gate' && i.appearsAt <= next && next < i.appearsAt + 0.2
          )
          if (gate) {
            setGateActive(true)
            // Pause iframe
            try {
              ;(iframeRef.current?.contentWindow as any)?.__pause?.()
            } catch {}
            return { ...s, playhead: next, isPlaying: false }
          }

          if (next >= currentScene.duration) {
            handleSceneEnd()
            return { ...s, playhead: currentScene.duration, isPlaying: false }
          }
          return { ...s, playhead: next }
        })
      }, 100)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state.isPlaying, currentScene, gateActive])

  const handleSceneEnd = useCallback(() => {
    if (!manifest || !state.currentSceneId) return
    const edge = manifest.sceneGraph.edges.find(
      (e) => e.fromSceneId === state.currentSceneId && e.condition.type === 'auto'
    )
    if (edge) {
      track('path_taken', {
        fromSceneId: state.currentSceneId,
        toSceneId: edge.toSceneId,
        edgeCondition: 'auto',
      })
      setState((s) => ({ ...s, currentSceneId: edge.toSceneId }))
    } else {
      track('project_completed')
    }
  }, [manifest, state.currentSceneId, track])

  const goToScene = useCallback(
    (sceneId: string, reason = 'interaction') => {
      track('path_taken', {
        fromSceneId: state.currentSceneId,
        toSceneId: sceneId,
        edgeCondition: reason,
      })
      setState((s) => ({ ...s, currentSceneId: sceneId }))
    },
    [state.currentSceneId, track]
  )

  const handleGateContinue = useCallback(() => {
    setGateActive(false)
    setState((s) => ({ ...s, isPlaying: true }))
    try {
      ;(iframeRef.current?.contentWindow as any)?.__resume?.()
    } catch {}
  }, [])

  const handleInteraction = useCallback(
    (el: InteractionElement) => {
      track('interaction_fired', { sceneId: state.currentSceneId, interactionId: el.id, type: el.type })

      if (el.type === 'hotspot') {
        if (el.jumpsToSceneId) goToScene(el.jumpsToSceneId, 'hotspot')
      } else if (el.type === 'choice') {
        // Choices handled per-option
      } else if (el.type === 'gate') {
        handleGateContinue()
      }
    },
    [state.currentSceneId, track, goToScene, handleGateContinue]
  )

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
  const progress = currentScene.duration > 0 ? (state.playhead / currentScene.duration) * 100 : 0

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Player container */}
      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Scene iframe */}
        <div className="relative w-full h-full" style={{ maxWidth: '100vw', maxHeight: '100vh', aspectRatio: '16/9' }}>
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-same-origin"
            title="Scene"
          />

          {/* Interaction overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {currentScene.interactions
              .filter((el) => {
                if (state.playhead < el.appearsAt) return false
                if (el.hidesAt !== null && state.playhead > el.hidesAt) return false
                return true
              })
              .map((el) => (
                <InteractionRenderer
                  key={el.id}
                  element={el}
                  brandColor={brandColor}
                  onInteraction={handleInteraction}
                  onChoiceSelect={(optionSceneId) => goToScene(optionSceneId, 'choice')}
                  onGateContinue={handleGateContinue}
                  variables={state.variables}
                  setVariable={(name, value) => {
                    setState((s) => ({ ...s, variables: { ...s.variables, [name]: value } }))
                    track('variable_set', { name, value })
                  }}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      {manifest.playerOptions.showProgressBar && (
        <div className="flex-shrink-0 px-4 py-2 bg-black/80 border-t border-white/10">
          {/* Progress bar */}
          <div className="w-full h-1 bg-white/10 rounded-full mb-2 cursor-pointer">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{ width: `${progress}%`, background: brandColor }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (state.isPlaying) {
                    try { (iframeRef.current?.contentWindow as any)?.__pause?.() } catch {}
                  } else {
                    try { (iframeRef.current?.contentWindow as any)?.__resume?.() } catch {}
                  }
                  setState((s) => ({ ...s, isPlaying: !s.isPlaying }))
                }}
                className="text-white hover:opacity-80 transition-opacity"
              >
                {state.isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                )}
              </button>
              <span className="text-[11px] text-white/50 font-mono">
                {Math.floor(state.playhead)}s / {currentScene.duration}s
              </span>
            </div>

            {manifest.playerOptions.showSceneNav && (
              <div className="flex items-center gap-1">
                {manifest.scenes.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => goToScene(s.id, 'nav')}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: s.id === state.currentSceneId ? brandColor : 'rgba(255,255,255,0.2)',
                    }}
                    title={`Scene ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {manifest.playerOptions.allowFullscreen && (
              <button
                onClick={() => containerRef.current?.requestFullscreen?.()}
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Interaction renderers ─────────────────────────────────────────────────────

function InteractionRenderer({
  element: el,
  brandColor,
  onInteraction,
  onChoiceSelect,
  onGateContinue,
  variables,
  setVariable,
}: {
  element: InteractionElement
  brandColor: string
  onInteraction: (el: InteractionElement) => void
  onChoiceSelect: (sceneId: string) => void
  onGateContinue: () => void
  variables: Record<string, string>
  setVariable: (name: string, value: string) => void
}) {
  if (el.type === 'hotspot') {
    return (
      <div
        className="pointer-events-auto cursor-pointer"
        style={{
          position: 'absolute',
          left: `${el.x}%`, top: `${el.y}%`,
          width: `${el.width}%`, height: `${el.height}%`,
          borderRadius: el.shape === 'circle' ? '50%' : el.shape === 'pill' ? '999px' : '8px',
          background: `${el.color}33`,
          border: `2px solid ${el.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: el.style === 'pulse' ? 'cench-studio-pulse 2s infinite' : undefined,
        }}
        onClick={() => onInteraction(el)}
      >
        {el.label && <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{el.label}</span>}
      </div>
    )
  }

  if (el.type === 'choice') {
    return (
      <div
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          left: `${el.x}%`, top: `${el.y}%`,
          width: `${el.width}%`,
          background: 'rgba(0,0,0,0.85)',
          borderRadius: 12,
          padding: 20,
          backdropFilter: 'blur(8px)',
        }}
      >
        {el.question && (
          <p style={{ color: 'white', fontSize: 16, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            {el.question}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: el.layout === 'vertical' ? 'column' : 'row', gap: 8 }}>
          {el.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onChoiceSelect(opt.jumpsToSceneId)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                border: `2px solid ${opt.color || brandColor}`,
                background: 'transparent',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = `${opt.color || brandColor}33` }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
            >
              {opt.icon && <span style={{ marginRight: 6 }}>{opt.icon}</span>}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (el.type === 'quiz') {
    return <QuizRenderer element={el} brandColor={brandColor} onInteraction={onInteraction} />
  }

  if (el.type === 'gate') {
    return (
      <div
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <button
          onClick={onGateContinue}
          style={{
            padding: '12px 32px',
            borderRadius: 8,
            background: brandColor,
            color: 'white',
            fontSize: 16,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {el.buttonLabel || 'Continue →'}
        </button>
      </div>
    )
  }

  if (el.type === 'tooltip') {
    return (
      <div
        className="pointer-events-auto group"
        style={{
          position: 'absolute',
          left: `${el.x}%`, top: `${el.y}%`,
          width: `${el.width}%`, height: `${el.height}%`,
        }}
      >
        <div
          style={{
            width: '100%', height: '100%',
            borderRadius: el.triggerShape === 'circle' ? '50%' : '6px',
            border: `2px solid ${el.triggerColor}`,
            background: `${el.triggerColor}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'help',
            animation: 'cench-studio-pulse 3s infinite',
          }}
        >
          {el.triggerLabel && (
            <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>{el.triggerLabel}</span>
          )}
        </div>
        {/* Tooltip card - shown on hover via CSS */}
        <div
          style={{
            position: 'absolute',
            ...(el.tooltipPosition === 'top' ? { bottom: '110%', left: '50%', transform: 'translateX(-50%)' } :
              el.tooltipPosition === 'bottom' ? { top: '110%', left: '50%', transform: 'translateX(-50%)' } :
              el.tooltipPosition === 'left' ? { right: '110%', top: '50%', transform: 'translateY(-50%)' } :
              { left: '110%', top: '50%', transform: 'translateY(-50%)' }),
            maxWidth: el.tooltipMaxWidth,
            background: 'rgba(0,0,0,0.9)',
            borderRadius: 8,
            padding: '10px 14px',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.2s',
            backdropFilter: 'blur(8px)',
          }}
          className="group-hover:!opacity-100"
        >
          <p style={{ color: 'white', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{el.tooltipTitle}</p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.4 }}>{el.tooltipBody}</p>
        </div>
      </div>
    )
  }

  // Form
  if (el.type === 'form') {
    return <FormRenderer element={el} brandColor={brandColor} setVariable={setVariable} />
  }

  return null
}

function QuizRenderer({
  element: el,
  brandColor,
  onInteraction,
}: {
  element: InteractionElement & { type: 'quiz' }
  brandColor: string
  onInteraction: (el: InteractionElement) => void
}) {
  const [answered, setAnswered] = useState<string | null>(null)
  const isCorrect = answered === el.correctOptionId

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: 'absolute',
        left: `${el.x}%`, top: `${el.y}%`,
        width: `${el.width}%`,
        background: 'rgba(0,0,0,0.9)',
        borderRadius: 12,
        padding: 20,
        backdropFilter: 'blur(8px)',
      }}
    >
      <p style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{el.question}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {el.options.map((opt) => {
          const selected = answered === opt.id
          const correct = opt.id === el.correctOptionId
          let bg = 'transparent'
          let border = `2px solid ${brandColor}`
          if (answered) {
            if (correct) { bg = '#22c55e33'; border = '2px solid #22c55e' }
            else if (selected) { bg = '#ef444433'; border = '2px solid #ef4444' }
          }
          return (
            <button
              key={opt.id}
              disabled={!!answered}
              onClick={() => setAnswered(opt.id)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border,
                background: bg,
                color: 'white',
                fontSize: 14,
                cursor: answered ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {answered && el.explanation && (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 12, lineHeight: 1.4 }}>
          {el.explanation}
        </p>
      )}
      {answered && (
        <p style={{ color: isCorrect ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 700, marginTop: 8 }}>
          {isCorrect ? 'Correct!' : 'Incorrect'}
        </p>
      )}
    </div>
  )
}

function FormRenderer({
  element: el,
  brandColor,
  setVariable,
}: {
  element: InteractionElement & { type: 'form' }
  brandColor: string
  setVariable: (name: string, value: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})

  const handleSubmit = () => {
    for (const mapping of el.setsVariables) {
      const val = values[mapping.fieldId] ?? ''
      setVariable(mapping.variableName, val)
    }
  }

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: 'absolute',
        left: `${el.x}%`, top: `${el.y}%`,
        width: `${el.width}%`,
        background: 'rgba(0,0,0,0.9)',
        borderRadius: 12,
        padding: 20,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {el.fields.map((field) => (
          <div key={field.id}>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>
              {field.label} {field.required && '*'}
            </label>
            {field.type === 'text' && (
              <input
                type="text"
                placeholder={field.placeholder ?? ''}
                value={values[field.id] ?? ''}
                onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            )}
            {field.type === 'select' && (
              <select
                value={values[field.id] ?? ''}
                onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  fontSize: 14,
                }}
              >
                <option value="">Select...</option>
                {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {field.type === 'radio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {field.options.map((opt) => (
                  <label key={opt} style={{ color: 'white', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={values[field.id] === opt}
                      onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '10px',
          borderRadius: 8,
          background: brandColor,
          color: 'white',
          fontSize: 14,
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {el.submitLabel || 'Continue'}
      </button>
    </div>
  )
}

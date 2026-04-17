'use client'

import { useRef, useEffect } from 'react'
import { WifiOff, Hammer } from 'lucide-react'
import { useBuildStream } from '@/lib/build/useBuildStream'
import SceneCard from './SceneCard'
import FrameDetailPanel from './FrameDetailPanel'

interface Props {
  projectId: string
}

export default function BuildPanel({ projectId }: Props) {
  const { state, dispatch, start, stop } = useBuildStream(projectId)
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll active scene card into view
  const activeSceneId = state.scenes.find((s) => s.status === 'active')?.sceneId
  useEffect(() => {
    if (!listRef.current || !activeSceneId) return
    const el = listRef.current.querySelector(`[data-scene-id="${activeSceneId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSceneId])

  // Find the selected frame data for the detail panel
  const selectedFrameData = (() => {
    const sel = state.selectedFrame
    if (!sel) return null
    const scene = state.scenes.find((s) => s.sceneId === sel.sceneId)
    if (!scene) return null
    const frame = scene.frames.find((f) => f.index === sel.frameIndex)
    if (!frame) return null
    return { frame, templateUrl: scene.selectedTemplate?.templateUrl }
  })()

  const sceneCount = state.scenes.length
  const doneCount = state.scenes.filter((s) => s.status === 'done').length

  return (
    <div className="relative flex flex-col h-full bg-[var(--color-panel)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        <Hammer size={14} className="text-[var(--color-text-muted)]" />
        <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1">Build</span>

        {state.isReconnecting && (
          <span className="flex items-center gap-1 text-[11px] text-amber-400">
            <WifiOff size={12} />
            Reconnecting...
          </span>
        )}

        {state.status === 'running' && sceneCount > 0 && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {doneCount}/{sceneCount}
          </span>
        )}

        {state.status === 'idle' && (
          <span
            className="text-[11px] px-2 py-0.5 rounded cursor-pointer bg-[var(--kbd-bg)] border border-[var(--kbd-border)] text-[var(--kbd-text)] hover:brightness-110 transition-all"
            onClick={start}
          >
            Start Build
          </span>
        )}

        {state.status === 'running' && (
          <span
            className="text-[11px] px-2 py-0.5 rounded cursor-pointer text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-all"
            onClick={stop}
          >
            Stop
          </span>
        )}

        {(state.status === 'done' || state.status === 'error') && (
          <span
            className="text-[11px] px-2 py-0.5 rounded cursor-pointer bg-[var(--kbd-bg)] border border-[var(--kbd-border)] text-[var(--kbd-text)] hover:brightness-110 transition-all"
            onClick={start}
          >
            Rebuild
          </span>
        )}
      </div>

      {/* Scene list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {state.status === 'idle' && (
          <div className="flex items-center justify-center h-32 text-sm text-[var(--color-text-muted)]">
            Press Start Build to begin
          </div>
        )}

        {state.scenes.map((scene) => (
          <div key={scene.sceneId} data-scene-id={scene.sceneId}>
            <SceneCard scene={scene} dispatch={dispatch} />
          </div>
        ))}

        {state.status === 'error' && state.error && (
          <div className="px-3 py-2 rounded border border-red-400/30 bg-red-400/5 text-sm text-red-400">
            {state.error}
          </div>
        )}

        {state.status === 'done' && (
          <div className="px-3 py-2 text-sm text-emerald-400 text-center">Build complete</div>
        )}
      </div>

      {/* Frame detail side panel */}
      {selectedFrameData && (
        <FrameDetailPanel
          frame={selectedFrameData.frame}
          templateUrl={selectedFrameData.templateUrl}
          onClose={() => dispatch({ type: 'DESELECT_FRAME' })}
        />
      )}
    </div>
  )
}

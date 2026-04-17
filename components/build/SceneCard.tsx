'use client'

import { Circle, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import AgentStepTree from './AgentStepTree'
import FrameGrid from './FrameGrid'
import type { SceneCardState, BuildAction } from '@/lib/build/types'

interface Props {
  scene: SceneCardState
  dispatch: React.Dispatch<BuildAction>
}

function StatusIcon({ status }: { status: SceneCardState['status'] }) {
  switch (status) {
    case 'queued':
      return <Circle size={14} className="text-[var(--color-text-muted)]" />
    case 'active':
      return <Loader2 size={14} className="text-blue-400 animate-spin" />
    case 'done':
      return <CheckCircle2 size={14} className="text-emerald-400" />
    case 'error':
      return <XCircle size={14} className="text-red-400" />
  }
}

export default function SceneCard({ scene, dispatch }: Props) {
  const isActive = scene.status === 'active'

  return (
    <div
      className={`rounded-lg border transition-all ${
        isActive
          ? 'border-l-2 border-l-blue-500 border-t-[var(--color-border)] border-r-[var(--color-border)] border-b-[var(--color-border)] animate-[buildPulse_2s_ease-in-out_infinite]'
          : 'border-[var(--color-border)]'
      } bg-[var(--color-panel)]`}
    >
      {/* Header — always visible */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => dispatch({ type: 'TOGGLE_EXPAND', sceneId: scene.sceneId })}
      >
        <StatusIcon status={scene.status} />
        <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">{scene.title}</span>
        {scene.status === 'done' && scene.durationMs != null && (
          <span className="text-[11px] text-[var(--color-text-muted)]">{(scene.durationMs / 1000).toFixed(1)}s</span>
        )}
        <ChevronDown
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform ${scene.isExpanded ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Expandable content */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          scene.isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--color-border)]">
          {/* Agent steps tree */}
          <AgentStepTree steps={scene.agentSteps} />

          {/* Frame grid */}
          <FrameGrid
            frames={scene.frames}
            templateUrl={scene.selectedTemplate?.templateUrl}
            onSelectFrame={(frameIndex) => dispatch({ type: 'SELECT_FRAME', sceneId: scene.sceneId, frameIndex })}
          />

          {/* Animation indicator */}
          {scene.isAnimating && (
            <div className="flex items-center gap-1.5 text-sm text-blue-400">
              <Loader2 size={12} className="animate-spin" />
              <span>Animating...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

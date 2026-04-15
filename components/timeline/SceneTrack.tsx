'use client'

import { useCallback } from 'react'
import { useVideoStore } from '@/lib/store'
import type { SceneType } from '@/lib/types'

/** Shared with OverlayTracks for GEN lane */
export const TYPE_BADGE_COLORS: Record<SceneType, string> = {
  svg: '#e84545',
  canvas2d: '#f97316',
  motion: '#3b82f6',
  d3: '#22c55e',
  three: '#a855f7',
  lottie: '#f59e0b',
  zdog: '#14b8a6',
  physics: '#06b6d4',
  avatar_scene: '#ec4899',
  '3d_world': '#8b5cf6',
  react: '#06d6a0',
}

interface Props {
  pps: number
  scrollX: number
  containerWidth: number
  trackHeight: number
  onZoomToScene: (sceneIndex: number) => void
}

export default function SceneTrack({ pps, scrollX, containerWidth, trackHeight, onZoomToScene }: Props) {
  const { scenes, selectedSceneId, selectScene } = useVideoStore()

  const handleDoubleClick = useCallback(
    (idx: number) => {
      onZoomToScene(idx)
    },
    [onZoomToScene],
  )

  let accumulated = 0
  const blocks = scenes.map((scene, i) => {
    const start = accumulated
    accumulated += scene.duration
    return { scene, start, index: i }
  })

  return (
    <div className="relative" style={{ height: trackHeight, width: accumulated * pps }}>
      {blocks.map(({ scene, start, index }) => {
        const left = start * pps
        const width = scene.duration * pps
        // Check if visible
        if (left + width < scrollX || left > scrollX + containerWidth) return null

        const isSelected = scene.id === selectedSceneId
        const type = scene.sceneType ?? 'svg'
        const showThumbnail = width > 60 && !!scene.thumbnail
        const bg = index % 2 === 0 ? 'var(--tl-track-bg)' : 'var(--tl-track-alt)'

        return (
          <div
            key={scene.id}
            className="absolute top-0 bottom-0 overflow-hidden cursor-pointer"
            style={{
              left,
              width,
              background: bg,
              borderRight: '1px solid var(--tl-border)',
              border: isSelected ? '2px solid var(--tl-playhead)' : undefined,
              boxSizing: 'border-box',
            }}
            onClick={() => selectScene(scene.id)}
            onDoubleClick={() => handleDoubleClick(index)}
          >
            {showThumbnail && (
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `url(${scene.thumbnail})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            )}
            {/* Scene number */}
            <span
              className="absolute z-10"
              style={{ top: 2, left: 3, fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)' }}
            >
              {index + 1}
            </span>
            {/* Scene name */}
            {width > 50 && (
              <span
                className="absolute z-10 truncate"
                style={{
                  top: '50%',
                  left: 4,
                  right: 4,
                  transform: 'translateY(-50%)',
                  fontSize: 10,
                  color: 'var(--color-text-primary)',
                  textAlign: 'center',
                }}
              >
                {scene.name || scene.prompt.slice(0, 30)}
              </span>
            )}
            {/* Type badge */}
            {width > 40 && (
              <span
                className="absolute z-10 rounded-sm px-1"
                style={{
                  bottom: 2,
                  left: 3,
                  fontSize: 8,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: '#fff',
                  background: TYPE_BADGE_COLORS[type] ?? '#666',
                  lineHeight: '14px',
                }}
              >
                {type}
              </span>
            )}
            {/* Duration label */}
            {width > 50 && (
              <span
                className="absolute z-10"
                style={{
                  bottom: 2,
                  right: 3,
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: 'var(--color-text-muted)',
                }}
              >
                {scene.duration.toFixed(1)}s
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

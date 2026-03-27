'use client'

import { useVideoStore } from '@/lib/store'

interface Props {
  pps: number
  scrollX: number
  containerWidth: number
  trackHeight: number
}

export default function OverlayTracks({ pps, scrollX, containerWidth, trackHeight }: Props) {
  const { scenes } = useVideoStore()

  if (trackHeight <= 120) return null

  // Determine which tracks to show based on height
  const showAll = trackHeight > 180
  // Always show text + audio when > 120
  const trackLabels: { key: string; label: string; color: string }[] = [
    { key: 'txt', label: 'TXT', color: '#4a9eff' },
    { key: 'aud', label: 'AUD', color: '#a78bfa' },
  ]
  if (showAll) {
    trackLabels.push({ key: 'vid', label: 'VID', color: '#22c55e' })
    trackLabels.push({ key: 'int', label: 'INT', color: '#f97316' })
  }

  const stripHeight = Math.min(16, Math.floor(trackHeight / trackLabels.length))
  const totalHeight = stripHeight * trackLabels.length

  // Precompute scene starts
  let acc = 0
  const sceneStarts = scenes.map(s => { const start = acc; acc += s.duration; return start })
  const totalDuration = acc

  return (
    <div className="relative" style={{ height: totalHeight }}>
      {trackLabels.map((track, ti) => (
        <div
          key={track.key}
          className="relative"
          style={{
            height: stripHeight,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {/* Gutter label */}
          <span
            className="absolute z-10"
            style={{
              left: Math.max(2, scrollX + 2),
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 8,
              fontWeight: 600,
              color: track.color,
              opacity: 0.7,
              pointerEvents: 'none',
            }}
          >
            {track.label}
          </span>

          {/* Content area */}
          <div
            className="absolute top-0 bottom-0"
            style={{ width: totalDuration * pps, transform: `translateX(${-scrollX}px)` }}
          >
            {scenes.map((scene, si) => {
              const sceneStart = sceneStarts[si]

              if (track.key === 'txt') {
                return scene.textOverlays?.map(t => {
                  const x = (sceneStart + t.delay) * pps
                  const w = t.duration * pps
                  return (
                    <div
                      key={t.id}
                      className="absolute rounded-sm"
                      style={{
                        left: x,
                        width: w,
                        top: 2,
                        bottom: 2,
                        background: `${track.color}99`,
                      }}
                    />
                  )
                })
              }

              if (track.key === 'aud' && scene.audioLayer?.enabled) {
                const x = (sceneStart + (scene.audioLayer.startOffset ?? 0)) * pps
                const w = (scene.duration - (scene.audioLayer.startOffset ?? 0)) * pps
                return (
                  <div
                    key={`aud-${scene.id}`}
                    className="absolute rounded-sm"
                    style={{
                      left: x,
                      width: Math.max(0, w),
                      top: 2,
                      bottom: 2,
                      background: `${track.color}99`,
                    }}
                  />
                )
              }

              if (track.key === 'vid' && scene.videoLayer?.enabled) {
                const x = sceneStart * pps
                const w = scene.duration * pps
                return (
                  <div
                    key={`vid-${scene.id}`}
                    className="absolute rounded-sm"
                    style={{
                      left: x,
                      width: w,
                      top: 2,
                      bottom: 2,
                      background: `${track.color}99`,
                    }}
                  />
                )
              }

              if (track.key === 'int') {
                return scene.interactions?.map(inter => {
                  const x = (sceneStart + inter.appearsAt) * pps
                  return (
                    <div
                      key={inter.id}
                      className="absolute"
                      style={{
                        left: x - 4,
                        top: 1,
                        bottom: 1,
                        width: 8,
                        height: 8,
                        background: track.color,
                        transform: 'rotate(45deg)',
                        borderRadius: 1,
                      }}
                    />
                  )
                })
              }

              return null
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

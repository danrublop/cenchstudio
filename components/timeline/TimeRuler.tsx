'use client'

import { useCallback } from 'react'
import { RULER_HEIGHT } from './constants'

interface Props {
  pps: number
  totalWidth: number
  scrollX: number
  containerWidth: number
  onSeek: (time: number) => void
  contentDuration?: number
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function getTickInterval(pps: number): { major: number; minor: number } {
  if (pps >= 60) return { major: 1, minor: 0.25 }
  if (pps >= 30) return { major: 2, minor: 0.5 }
  if (pps >= 15) return { major: 5, minor: 1 }
  if (pps >= 6) return { major: 10, minor: 2 }
  if (pps >= 3) return { major: 30, minor: 5 }
  return { major: 60, minor: 10 }
}

export default function TimeRuler({ pps, totalWidth, scrollX, containerWidth, onSeek, contentDuration }: Props) {
  const { major, minor } = getTickInterval(pps)
  const totalDuration = totalWidth / pps

  const startTime = Math.max(0, Math.floor((scrollX / pps) / minor) * minor)
  const endTime = Math.min(totalDuration, ((scrollX + containerWidth) / pps) + minor)

  const ticks: { time: number; isMajor: boolean }[] = []
  for (let t = startTime; t <= endTime; t += minor) {
    ticks.push({ time: t, isMajor: Math.abs(t % major) < 0.001 || Math.abs(t % major - major) < 0.001 })
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const time = (scrollX + (e.clientX - rect.left)) / pps
    onSeek(Math.max(0, Math.min(totalDuration, time)))
  }, [scrollX, pps, totalDuration, onSeek])

  const barWidth = contentDuration ? contentDuration * pps : 0

  return (
    <div
      className="relative flex-shrink-0 cursor-pointer select-none overflow-hidden"
      style={{
        height: RULER_HEIGHT,
        background: 'var(--tl-ruler-bg)',
        borderBottom: '1px solid var(--tl-border)',
      }}
      onClick={handleClick}
    >
      <div
        className="relative"
        style={{ width: totalWidth, transform: `translateX(${-scrollX}px)`, height: '100%' }}
      >
        {barWidth > 0 && (
          <div
            className="absolute"
            style={{
              left: 0,
              top: 0,
              width: barWidth,
              height: 3,
              background: 'var(--tl-ruler-bar)',
              borderRadius: '0 0 1px 0',
            }}
          />
        )}

        {ticks.map((tick, i) => {
          const x = tick.time * pps
          return (
            <div key={i} className="absolute" style={{ left: x, bottom: 0 }}>
              <div
                style={{
                  width: 1,
                  height: tick.isMajor ? 14 : 7,
                  background: tick.isMajor ? 'var(--tl-ruler-tick)' : 'var(--tl-ruler-tick-minor)',
                }}
              />
              {tick.isMajor && (
                <span
                  className="absolute whitespace-nowrap"
                  style={{
                    bottom: 15,
                    left: 3,
                    fontSize: 9,
                    fontWeight: 500,
                    fontFamily: 'monospace',
                    color: 'var(--tl-ruler-label)',
                    lineHeight: '1',
                  }}
                >
                  {formatTime(tick.time)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

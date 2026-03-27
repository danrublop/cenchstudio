'use client'

import { useCallback } from 'react'
import { RULER_HEIGHT } from './constants'

interface Props {
  pps: number
  totalWidth: number
  scrollX: number
  containerWidth: number
  onSeek: (time: number) => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function getTickInterval(pps: number): { major: number; minor: number } {
  // At low zoom, use wider intervals; at high zoom, narrower
  if (pps >= 60) return { major: 1, minor: 0.25 }
  if (pps >= 30) return { major: 2, minor: 0.5 }
  if (pps >= 15) return { major: 5, minor: 1 }
  if (pps >= 6) return { major: 10, minor: 2 }
  if (pps >= 3) return { major: 30, minor: 5 }
  return { major: 60, minor: 10 }
}

export default function TimeRuler({ pps, totalWidth, scrollX, containerWidth, onSeek }: Props) {
  const { major, minor } = getTickInterval(pps)
  const totalDuration = totalWidth / pps

  // Only render ticks in the visible range
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

  return (
    <div
      className="relative flex-shrink-0 cursor-pointer select-none overflow-hidden"
      style={{
        height: RULER_HEIGHT,
        borderBottom: '1px solid var(--color-border)',
      }}
      onClick={handleClick}
    >
      <div
        className="relative"
        style={{ width: totalWidth, transform: `translateX(${-scrollX}px)` }}
      >
        {ticks.map((tick, i) => {
          const x = tick.time * pps
          return (
            <div key={i} className="absolute top-0" style={{ left: x }}>
              <div
                style={{
                  width: 1,
                  height: tick.isMajor ? 12 : 6,
                  background: '#3a3a45',
                }}
              />
              {tick.isMajor && (
                <span
                  className="absolute whitespace-nowrap"
                  style={{
                    top: 2,
                    left: 4,
                    fontSize: 9,
                    color: '#6b6b7a',
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

'use client'

import React from 'react'
import {
  RULER_HEIGHT,
  TOOLBAR_WIDTH,
  TRACK_HEADER_WIDTH,
  TRACK_ROW_HEIGHT,
} from '../../../components/timeline/constants'
import { Lock, Eye, Mic, Hand } from 'lucide-react'

const LEFT_GUTTER = TOOLBAR_WIDTH + TRACK_HEADER_WIDTH
const SCROLLBAR_WIDTH = 14
const DIVIDER_HEIGHT = 6
const MIN_SECTION_HEIGHT = TRACK_ROW_HEIGHT + 4

const MOCK_TOOLS = [
  { id: 'select' as const, icon: '↖', label: 'Selection (V)', active: true },
  { id: 'razor' as const, icon: '✂', label: 'Razor (C)', active: false },
  { id: 'ripple' as const, icon: '⇔', label: 'Ripple Edit (B)', active: false },
  { id: 'slip' as const, icon: '⇹', label: 'Slip (Y)', active: false },
  {
    id: 'hand' as const,
    icon: <Hand size={14} strokeWidth={2} aria-hidden />,
    label: 'Hand (H)',
    active: false,
  },
]

function formatRulerTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function formatGutterTimecode(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const fr = Math.floor((s % 1) * 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${fr}`
}

function MockScrollbarStrip({ sectionHeight }: { sectionHeight: number }) {
  const thumbH = Math.max(24, Math.floor(sectionHeight * 0.45))
  const thumbTop = Math.floor((sectionHeight - thumbH) * 0.35)
  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: SCROLLBAR_WIDTH,
        height: sectionHeight,
        background: 'var(--tl-scrollbar-bg)',
      }}
      aria-hidden
    >
      <div
        className="absolute flex flex-col items-center justify-between"
        style={{
          left: 1,
          right: 1,
          top: thumbTop,
          height: thumbH,
          background: 'var(--tl-scrollbar-thumb)',
          borderRadius: 3,
        }}
      >
        <div
          className="mt-0.5 flex-shrink-0 rounded-full border border-[rgba(255,255,255,0.35)]"
          style={{
            width: 10,
            height: 10,
            background: 'rgba(80,80,80,0.9)',
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.12)',
          }}
        />
        <div
          className="mb-0.5 flex-shrink-0 rounded-full border border-[rgba(255,255,255,0.35)]"
          style={{
            width: 10,
            height: 10,
            background: 'rgba(80,80,80,0.9)',
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.12)',
          }}
        />
      </div>
    </div>
  )
}

function MockTrackHeader({
  name,
  height,
  isAudio,
}: {
  name: string
  height: number
  isAudio: boolean
}) {
  return (
    <div
      className="relative flex select-none items-center"
      style={{
        width: TRACK_HEADER_WIDTH,
        height,
        minHeight: height,
        background: 'var(--tl-header-bg)',
        borderBottom: '1px solid var(--tl-border)',
        borderRight: '1px solid var(--tl-border)',
      }}
    >
      <span
        className="ml-2 flex-shrink-0 font-bold"
        style={{ fontSize: 12, color: 'var(--color-text-primary)' }}
      >
        {name}
      </span>
      <div className="ml-1.5 flex flex-shrink-0 items-center gap-0">
        <span
          className="flex h-5 w-5 items-center justify-center rounded"
          style={{ color: 'var(--tl-ctrl-dim)' }}
          title="Lock"
        >
          <Lock size={11} />
        </span>
        <span className="flex h-5 w-5 items-center justify-center" style={{ fontSize: 9, color: 'var(--tl-ctrl-dim)' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <line x1="5" y1="8" x2="11" y2="8" />
          </svg>
        </span>
        {isAudio ? (
          <>
            <span
              className="flex h-5 w-5 cursor-default items-center justify-center rounded font-bold"
              style={{ fontSize: 10, color: 'var(--tl-toolbar-text)' }}
              title="Mute"
            >
              M
            </span>
            <span
              className="flex h-5 w-5 cursor-default items-center justify-center rounded font-bold"
              style={{ fontSize: 10, color: 'var(--tl-toolbar-text)' }}
              title="Solo"
            >
              S
            </span>
            <span className="flex h-5 w-5 items-center justify-center" style={{ color: 'var(--tl-ctrl-dim)' }}>
              <Mic size={11} />
            </span>
          </>
        ) : (
          <span
            className="flex h-5 w-5 cursor-default items-center justify-center rounded"
            style={{ color: 'var(--tl-toolbar-text)' }}
            title="Hide"
          >
            <Eye size={11} />
          </span>
        )}
      </div>
    </div>
  )
}

/** Static timeline only — `PreviewPlayer` renders transport above; see `HeroTransportBarMock`. */
export function HeroTimelineMock() {
  const trackHeight = 160
  const contentHeight = trackHeight - RULER_HEIGHT
  const videoSectionHeight = Math.max(
    MIN_SECTION_HEIGHT,
    Math.floor((contentHeight - DIVIDER_HEIGHT) * 0.55),
  )
  const audioSectionHeight = Math.max(
    MIN_SECTION_HEIGHT,
    contentHeight - DIVIDER_HEIGHT - videoSectionHeight,
  )

  const videoBottomOffset = Math.max(0, videoSectionHeight - TRACK_ROW_HEIGHT)
  const mockCurrentTime = 12
  const mockPps = 18
  const playheadX = mockCurrentTime * mockPps

  const majorTicks = [0, 5, 10, 15, 20, 25, 30]
  const mockDurationSec = 28
  const barPct = Math.min(100, (mockDurationSec / 35) * 100)

  return (
    <div
      className="relative flex w-full min-h-0 flex-col overflow-hidden"
      style={{
        height: trackHeight,
        background: 'var(--tl-bg)',
        borderTop: '1px solid var(--tl-border)',
      }}
      aria-hidden
    >
      {/* Ruler row — time gutter + ruler (see `TimeRuler` + `Timeline`) */}
      <div className="flex shrink-0" style={{ marginRight: SCROLLBAR_WIDTH }}>
        <div
          className="flex flex-shrink-0 select-none items-center justify-center font-mono tabular-nums"
          style={{
            width: LEFT_GUTTER,
            height: RULER_HEIGHT,
            fontSize: 10,
            color: 'var(--tl-ruler-tick)',
            background: 'var(--tl-ruler-bg)',
            borderBottom: '1px solid var(--tl-border)',
          }}
        >
          {formatGutterTimecode(mockCurrentTime)}
        </div>
        <div
          className="relative min-w-0 flex-1 cursor-default overflow-hidden select-none"
          style={{
            height: RULER_HEIGHT,
            background: 'var(--tl-ruler-bg)',
            borderBottom: '1px solid var(--tl-border)',
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: `${barPct}%`,
              height: 3,
              background: 'var(--tl-ruler-bar)',
              borderRadius: '0 0 1px 0',
            }}
          />
          {majorTicks.map((t) => {
            const leftPct = (t / 35) * 100
            return (
              <div key={t} className="absolute bottom-0" style={{ left: `${leftPct}%` }}>
                <div
                  style={{
                    width: 1,
                    height: t % 5 === 0 ? 14 : 7,
                    background: t % 5 === 0 ? 'var(--tl-ruler-tick)' : 'var(--tl-ruler-tick-minor)',
                  }}
                />
                {t % 5 === 0 && (
                  <span
                    className="absolute whitespace-nowrap"
                    style={{
                      bottom: 15,
                      left: 3,
                      fontSize: 9,
                      fontWeight: 500,
                      fontFamily: 'monospace',
                      color: 'var(--tl-ruler-label)',
                      lineHeight: 1,
                    }}
                  >
                    {formatRulerTime(t)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Toolbar + track sections */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* `TimelineToolbar` */}
        <div
          className="flex flex-shrink-0 flex-col items-center gap-0.5 overflow-visible py-1"
          style={{
            width: TOOLBAR_WIDTH,
            height: contentHeight,
            background: 'var(--tl-track-bg)',
            borderRight: '1px solid var(--tl-border)',
          }}
        >
          {MOCK_TOOLS.map((tool) => (
            <div
              key={tool.id}
              className="flex cursor-default select-none items-center justify-center rounded"
              title={tool.label}
              style={{
                width: TOOLBAR_WIDTH - 6,
                height: TOOLBAR_WIDTH - 8,
                fontSize: 14,
                background: tool.active ? 'var(--tl-toolbar-active)' : 'transparent',
                color: tool.active ? '#fff' : 'var(--tl-toolbar-text)',
                border: tool.active ? '1px solid var(--tl-toolbar-active)' : '1px solid transparent',
                borderRadius: 3,
              }}
            >
              {tool.icon}
            </div>
          ))}
          <div className="my-1 h-px w-[80%]" style={{ background: 'var(--tl-border)' }} />
          <div
            className="flex cursor-default select-none items-center justify-center rounded hover:bg-white/10"
            style={{
              width: TOOLBAR_WIDTH - 6,
              height: TOOLBAR_WIDTH - 8,
              fontSize: 16,
              color: 'var(--tl-ctrl-text)',
            }}
            title="Add Track"
          >
            +
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Video section (`TrackSection` video) */}
          <div className="relative flex shrink-0 flex-row overflow-hidden" style={{ height: videoSectionHeight }}>
            <div className="flex-shrink-0 overflow-hidden" style={{ width: TRACK_HEADER_WIDTH }}>
              <div style={{ transform: `translateY(${videoBottomOffset}px)` }}>
                <MockTrackHeader name="V1" height={TRACK_ROW_HEIGHT} isAudio={false} />
              </div>
            </div>
            <div
              className="relative min-h-0 flex-1 overflow-hidden"
              style={{ background: 'var(--tl-track-bg)' }}
            >
              <div
                className="absolute left-0 right-0"
                style={{
                  height: TRACK_ROW_HEIGHT,
                  bottom: 0,
                  borderBottom: '1px solid var(--tl-border)',
                }}
              >
                <div className="relative h-full px-0">
                  <div
                    className="absolute overflow-hidden rounded-[2px]"
                    style={{
                      left: '4%',
                      width: '28%',
                      top: 3,
                      bottom: 3,
                      background: 'var(--tl-clip-video)',
                      border: '1px solid var(--tl-clip-border)',
                    }}
                  >
                    <span
                      className="flex h-full items-center truncate px-1.5 text-[10px] font-medium"
                      style={{ color: 'var(--tl-clip-label)' }}
                    >
                      Scene 1
                    </span>
                  </div>
                  <div
                    className="absolute overflow-hidden rounded-[2px]"
                    style={{
                      left: '34%',
                      width: '38%',
                      top: 3,
                      bottom: 3,
                      background: 'var(--tl-clip-video)',
                      border: '1px solid #fff',
                      opacity: 0.95,
                    }}
                  >
                    <span
                      className="flex h-full items-center truncate px-1.5 text-[10px] font-semibold"
                      style={{ color: 'var(--tl-clip-label)' }}
                    >
                      Scene 2
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <MockScrollbarStrip sectionHeight={videoSectionHeight} />
          </div>

          {/* Section divider */}
          <div
            className="flex shrink-0 select-none items-center justify-center"
            style={{
              height: DIVIDER_HEIGHT,
              background: 'var(--tl-border)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 2,
                borderRadius: 1,
                background: 'var(--tl-toolbar-text)',
                opacity: 0.5,
              }}
            />
          </div>

          {/* Audio section */}
          <div className="relative flex shrink-0 flex-row overflow-hidden" style={{ height: audioSectionHeight }}>
            <div className="flex-shrink-0 overflow-hidden" style={{ width: TRACK_HEADER_WIDTH }}>
              <MockTrackHeader name="A1" height={TRACK_ROW_HEIGHT} isAudio />
            </div>
            <div
              className="relative min-h-0 flex-1 overflow-hidden"
              style={{ background: 'var(--tl-track-bg)' }}
            >
              <div
                className="relative"
                style={{
                  height: TRACK_ROW_HEIGHT,
                  borderBottom: '1px solid var(--tl-border)',
                }}
              >
                <div
                  className="absolute overflow-hidden rounded-[2px]"
                  style={{
                    left: '4%',
                    width: '72%',
                    top: 3,
                    bottom: 3,
                    background: 'var(--tl-clip-audio)',
                    border: '1px solid var(--tl-clip-border)',
                  }}
                >
                  <div className="flex h-full items-center gap-px px-1 opacity-50">
                    {[1, 2, 1, 3, 2, 1, 4, 2, 1, 0, 2, 3, 1, 2, 1, 4, 5, 2, 3, 1].map((h, i) => (
                      <div key={i} className="w-px shrink-0 bg-[var(--tl-waveform)]" style={{ height: `${22 + h * 12}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <MockScrollbarStrip sectionHeight={audioSectionHeight} />
          </div>
        </div>
      </div>

      {/* Playhead overlay (`Playhead` + `Timeline`) */}
      <div
        className="pointer-events-none absolute z-20"
        style={{
          top: 0,
          bottom: 0,
          left: LEFT_GUTTER,
          right: SCROLLBAR_WIDTH,
        }}
      >
        <div className="relative h-full w-full">
          <div className="absolute top-0 bottom-0" style={{ left: playheadX, width: 0 }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: -7,
                width: 14,
                height: 10,
                background: 'var(--tl-playhead)',
                borderRadius: '0 0 3px 3px',
              }}
            />
            <div
              className="absolute"
              style={{
                top: 0,
                bottom: 0,
                left: -0.5,
                width: 1,
                background: 'var(--tl-playhead)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

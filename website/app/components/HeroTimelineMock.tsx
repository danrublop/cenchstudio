'use client'

import React from 'react'
import {
  Scissors,
  MousePointer2,
  Hand,
  ChevronRight,
  Plus,
  Play,
} from 'lucide-react'

/**
 * Mock of the Editor's `Timeline` component for the website hero.
 * Matches `components/timeline/Timeline.tsx` layout and styling.
 */
export function HeroTimelineMock() {
  const TOOLBAR_WIDTH = 32
  const TRACK_HEADER_WIDTH = 120
  const RULER_HEIGHT = 20
  const TRACK_ROW_HEIGHT = 32

  return (
    <div className="flex w-full flex-col border-t border-[var(--color-border)] bg-[var(--color-panel)] font-sans select-none overflow-hidden">
      {/* Time Ruler */}
      <div className="flex h-5 items-stretch bg-[var(--color-panel)]" style={{ marginLeft: TOOLBAR_WIDTH + TRACK_HEADER_WIDTH }}>
        <div className="relative flex-1 border-b border-[var(--color-border)]">
          {/* Ticks */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
             <div
               key={i}
               className="absolute top-0 h-full border-l border-[var(--color-border)]/40"
               style={{ left: `${i * 10}%` }}
             >
               <span className="ml-1 text-[9px] tabular-nums text-[var(--color-text-muted)] opacity-60">
                 00:0{i}
               </span>
             </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-stretch overflow-hidden">
        {/* Toolbar */}
        <div 
          className="flex flex-col items-center gap-1 border-r border-[var(--color-border)] py-1.5"
          style={{ width: TOOLBAR_WIDTH }}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded bg-white/[0.08] text-[var(--color-text-primary)] shadow-sm ring-1 ring-inset ring-white/10">
            <MousePointer2 size={13} strokeWidth={2.5} />
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-white/[0.04]">
            <Scissors size={13} strokeWidth={2} />
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-white/[0.04]">
             <Hand size={13} strokeWidth={2} />
          </div>
        </div>

        {/* Tracks Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Video Track 1 (V1) */}
          <div className="flex items-stretch border-b border-[var(--color-border)]/60" style={{ height: TRACK_ROW_HEIGHT }}>
            <div 
              className="flex items-center gap-1.5 border-r border-[var(--color-border)]/60 px-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase"
              style={{ width: TRACK_HEADER_WIDTH }}
            >
              <div className="h-3 w-3 rounded-full bg-blue-500/30" />
              <span>V1</span>
            </div>
            <div className="relative flex-1 overflow-hidden bg-white/[0.01]">
              {/* Scene 1 Clip */}
              <div 
                className="absolute inset-y-1 rounded-[3px] border border-blue-400/40 bg-blue-500/20 px-2 shadow-sm"
                style={{ left: '5%', width: '35%' }}
              >
                <span className="text-[10px] font-medium text-blue-200/90 leading-6 truncate block">Scene 1 — Overview</span>
              </div>
              {/* Scene 2 Clip (Current) */}
               <div 
                className="absolute inset-y-1 rounded-[3px] border border-blue-500/80 bg-blue-600/35 px-2 shadow-sm ring-1 ring-blue-400/30"
                style={{ left: '42%', width: '40%' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/[0.05] to-transparent pointer-events-none" />
                <span className="text-[10px] font-bold text-blue-100 leading-6 truncate block">Scene 2 — Motion</span>
              </div>
            </div>
          </div>

          {/* Audio Track 1 (A1) */}
          <div className="flex items-stretch border-b border-[var(--color-border)]/60" style={{ height: TRACK_ROW_HEIGHT }}>
             <div 
              className="flex items-center gap-1.5 border-r border-[var(--color-border)]/60 px-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase"
              style={{ width: TRACK_HEADER_WIDTH }}
            >
              <div className="h-3 w-3 rounded-full bg-emerald-500/30" />
              <span>A1</span>
            </div>
            <div className="relative flex-1 overflow-hidden bg-white/[0.01]">
               <div 
                className="absolute inset-y-1 rounded-[3px] border border-emerald-400/40 bg-emerald-500/20 px-2 shadow-sm"
                style={{ left: '5%', width: '80%' }}
              >
                 <div className="flex items-center gap-1 h-full opacity-40">
                    {[1,2,1,3,2,1,4,2,1,0,2,3,1,2,1,4,5,2].map((h, i) => (
                       <div key={i} className="w-[2px] bg-emerald-200" style={{ height: `${20 + h * 15}%` }} />
                    ))}
                 </div>
              </div>
            </div>
          </div>

          {/* Add Track row */}
          <div className="flex h-5 items-center border-b border-[var(--color-border)]/40 bg-[var(--color-bg)]/20 px-2 text-[9px] text-[var(--color-text-muted)]/60">
             <div style={{ width: TRACK_HEADER_WIDTH }} className="flex items-center gap-1">
                <Plus size={10} />
                <span>ADD TRACK</span>
             </div>
          </div>
        </div>
      </div>

      {/* Playhead */}
      <div 
        className="absolute top-0 bottom-0 z-50 pointer-events-none"
        style={{ left: TOOLBAR_WIDTH + TRACK_HEADER_WIDTH + 342 }} // Positioned around the middle
      >
        <div className="relative h-full w-[1px] bg-red-500">
          <div 
            className="absolute -left-1.5 -top-1 h-4 w-3 rounded-b-sm bg-red-500 shadow-sm" 
            style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)' }}
          />
        </div>
      </div>
    </div>
  )
}

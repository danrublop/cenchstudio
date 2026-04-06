'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import { useTimelineZoom } from './useTimelineZoom'
import { usePlayheadDrag } from './usePlayheadDrag'
import {
  RULER_HEIGHT,
  TOOLBAR_WIDTH,
  TRACK_HEADER_WIDTH,
  TRACK_ROW_HEIGHT,
  SNAP_THRESHOLD,
  DRAG_DEAD_ZONE,
} from './constants'
import { collectSnapTargets, findSnap, getTrackClipBounds, clampToAvoidOverlap } from './SnapEngine'
import TimeRuler from './TimeRuler'
import TimelineToolbar, { type TimelineTool } from './TimelineToolbar'
import TrackHeader from './TrackHeader'
import TrackRow from './TrackRow'
import Playhead from './Playhead'
import type { Track } from '@/lib/types'

const DIVIDER_HEIGHT = 6
const SCROLLBAR_WIDTH = 14
const LEFT_GUTTER = TOOLBAR_WIDTH + TRACK_HEADER_WIDTH
const MIN_SECTION_HEIGHT = TRACK_ROW_HEIGHT + 4
const MIN_ROW_HEIGHT = 20
const MAX_ROW_HEIGHT = 80
const DOT_SIZE = 10

interface Props {
  currentTime: number
  totalDuration: number
  onSeek: (time: number) => void
  trackHeight?: number
}

export default function Timeline({ currentTime, totalDuration, onSeek, trackHeight = 200 }: Props) {
  const {
    scenes,
    project,
    timelineScrollX,
    timelineAutoScroll,
    setTimelineScrollX,
    initTimeline,
    syncTimelineFromScenes,
    moveClip,
    getTimeline,
    selectedClipIds,
    setSelectedClipIds,
  } = useVideoStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const { pps, totalWidth, maxScrollX, usableWidth, zoomIn, zoomOut, fitAll } = useTimelineZoom(
    containerRef,
    totalDuration,
    LEFT_GUTTER + SCROLLBAR_WIDTH,
  )

  useEffect(() => {
    if (scenes.length > 0 && !project.timeline) initTimeline()
  }, [scenes.length, project.timeline, initTimeline])

  const prevScenesSigRef = useRef('')
  useEffect(() => {
    const sig = scenes.map((s) => `${s.id}:${s.duration}`).join(',')
    if (prevScenesSigRef.current && sig !== prevScenesSigRef.current && project.timeline) {
      syncTimelineFromScenes()
    }
    prevScenesSigRef.current = sig
  }, [scenes, project.timeline, syncTimelineFromScenes])

  const sceneBoundaries = useMemo(() => {
    const bounds: number[] = []
    let acc = 0
    for (const scene of scenes) {
      bounds.push(acc)
      acc += scene.duration
    }
    bounds.push(acc)
    return bounds
  }, [scenes])

  const {
    isDragging: isPlayheadDragging,
    dragTime,
    onPointerDown: onPlayheadPointerDown,
  } = usePlayheadDrag({
    pps,
    scrollX: timelineScrollX,
    containerRef,
    sceneBoundaries,
    onSeek,
  })

  useEffect(() => {
    if (!timelineAutoScroll || isPlayheadDragging) return
    const playheadX = currentTime * pps
    const viewLeft = timelineScrollX
    if (playheadX >= viewLeft && playheadX <= viewLeft + usableWidth) {
      const relPos = (playheadX - viewLeft) / usableWidth
      if (relPos > 0.8) {
        setTimelineScrollX(Math.min(maxScrollX, Math.max(0, playheadX - usableWidth * 0.25)))
      }
    }
  }, [
    currentTime,
    pps,
    usableWidth,
    timelineAutoScroll,
    isPlayheadDragging,
    timelineScrollX,
    maxScrollX,
    setTimelineScrollX,
  ])

  const timeline = project.timeline
  const { videoTracks, audioTracks, allTracks } = useMemo(() => {
    if (!timeline) return { videoTracks: [], audioTracks: [], allTracks: [] }
    const sorted = [...timeline.tracks].sort((a, b) => a.position - b.position)
    return {
      videoTracks: sorted.filter((t) => t.type === 'video' || t.type === 'overlay'),
      audioTracks: sorted.filter((t) => t.type === 'audio'),
      allTracks: sorted,
    }
  }, [timeline])

  // ── Divider ──
  const contentHeight = trackHeight - RULER_HEIGHT
  const [dividerRatio, setDividerRatio] = useState(0.55)
  const [isDividerDragging, setIsDividerDragging] = useState(false)
  const videoSectionHeight = Math.max(MIN_SECTION_HEIGHT, Math.floor((contentHeight - DIVIDER_HEIGHT) * dividerRatio))
  const audioSectionHeight = Math.max(MIN_SECTION_HEIGHT, contentHeight - DIVIDER_HEIGHT - videoSectionHeight)

  const handleDividerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setIsDividerDragging(true)
      const startY = e.clientY
      const startRatio = dividerRatio
      const handleMove = (ev: PointerEvent) => {
        const available = contentHeight - DIVIDER_HEIGHT
        setDividerRatio(Math.max(0.15, Math.min(0.85, startRatio + (ev.clientY - startY) / available)))
      }
      const handleUp = () => {
        setIsDividerDragging(false)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [dividerRatio, contentHeight],
  )

  // ── Tool state ──
  const [activeTool, setActiveTool] = useState<TimelineTool>('select')

  // ── Per-section state ──
  const [videoScrollY, setVideoScrollY] = useState(0)
  const [audioScrollY, setAudioScrollY] = useState(0)
  const [videoRowHeight, setVideoRowHeight] = useState(TRACK_ROW_HEIGHT)
  const [audioRowHeight, setAudioRowHeight] = useState(TRACK_ROW_HEIGHT)

  // Trim snap guide (shared across sections)
  const [trimSnapTime, setTrimSnapTime] = useState<number | null>(null)

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        setSelectedClipIds([])
        const rect = e.currentTarget.getBoundingClientRect()
        const time = (timelineScrollX + (e.clientX - rect.left)) / pps
        onSeek(Math.max(0, Math.min(totalDuration, time)))
      }
    },
    [timelineScrollX, pps, totalDuration, onSeek, setSelectedClipIds],
  )

  // ── Clip Drag ──
  const dragStateRef = useRef<typeof dragState>(null)
  const [dragState, setDragState] = useState<{
    clipId: string
    sourceTrackId: string
    startX: number
    startY: number
    origStartTime: number
    active: boolean
    ghostLeft: number
    targetTrackId: string | null
    newStartTime: number
    /** IDs of all clips being dragged (multi-select) */
    allClipIds: string[]
  } | null>(null)

  // Keep ref in sync for use in event handlers
  const setDragStateAndRef = useCallback((val: typeof dragState | ((prev: typeof dragState) => typeof dragState)) => {
    if (typeof val === 'function') {
      setDragState((prev) => {
        const next = val(prev)
        dragStateRef.current = next
        return next
      })
    } else {
      dragStateRef.current = val
      setDragState(val)
    }
  }, [])

  const handleClipDragStart = useCallback(
    (clipId: string, trackId: string, e: React.PointerEvent) => {
      const clip = timeline?.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId)
      if (!clip) return
      e.preventDefault()
      document.body.style.cursor = 'grabbing'

      // Multi-clip: if dragging a selected clip, drag all selected; otherwise just this one
      const allIds = selectedClipIds.includes(clipId) && selectedClipIds.length > 1 ? selectedClipIds : [clipId]

      setDragStateAndRef({
        clipId,
        sourceTrackId: trackId,
        startX: e.clientX,
        startY: e.clientY,
        origStartTime: clip.startTime,
        active: false,
        ghostLeft: clip.startTime * pps,
        targetTrackId: trackId,
        newStartTime: clip.startTime,
        allClipIds: allIds,
      })
      const snapTargets = collectSnapTargets(timeline ?? null, currentTime, clipId)
      const handleMove = (ev: PointerEvent) => {
        const dx = ev.clientX - e.clientX
        const dy = ev.clientY - e.clientY
        setDragStateAndRef((prev) => {
          if (!prev) return null
          const isActive = prev.active || Math.abs(dx) > DRAG_DEAD_ZONE || Math.abs(dy) > DRAG_DEAD_ZONE
          let newTime = Math.max(0, prev.origStartTime + dx / pps)
          newTime = findSnap(newTime, pps, SNAP_THRESHOLD, snapTargets)
          // Also snap end of clip
          const clipEnd = newTime + clip.duration
          const snappedEnd = findSnap(clipEnd, pps, SNAP_THRESHOLD, snapTargets)
          if (snappedEnd !== clipEnd) newTime = snappedEnd - clip.duration

          const sourceTrack = allTracks.find((t) => t.id === prev.sourceTrackId)
          let targetTrackId = prev.sourceTrackId
          if (sourceTrack) {
            const section = sourceTrack.type === 'audio' ? audioTracks : videoTracks
            const srcIdx = section.indexOf(sourceTrack)
            const rowH = sourceTrack.type === 'audio' ? audioRowHeight : videoRowHeight
            const idx = Math.max(0, Math.min(section.length - 1, srcIdx + Math.round(dy / rowH)))
            targetTrackId = section[idx].id
          }
          return {
            ...prev,
            active: isActive,
            ghostLeft: Math.max(0, newTime) * pps,
            targetTrackId,
            newStartTime: Math.max(0, newTime),
          }
        })
      }
      const handleUp = () => {
        document.body.style.cursor = ''
        // Read final drag state before clearing it
        const finalState = dragStateRef.current
        setDragStateAndRef(null)

        if (finalState?.active) {
          const targetId = finalState.targetTrackId ?? finalState.sourceTrackId
          const timeDelta = finalState.newStartTime - finalState.origStartTime

          if (finalState.allClipIds.length > 1) {
            // Multi-clip drag: apply same time delta to all
            const { updateClip: uc } = useVideoStore.getState()
            const allClips = (useVideoStore.getState().project.timeline?.tracks ?? []).flatMap((t) => t.clips)
            for (const cid of finalState.allClipIds) {
              const c = allClips.find((cl) => cl.id === cid)
              if (c) uc(cid, { startTime: Math.max(0, c.startTime + timeDelta) })
            }
          } else {
            // Single clip: overlap prevention
            const currentTl = useVideoStore.getState().project.timeline
            const targetTrack = currentTl?.tracks.find((t) => t.id === targetId)
            if (targetTrack) {
              const bounds = getTrackClipBounds(targetTrack, finalState.clipId)
              const safeSt = clampToAvoidOverlap(finalState.newStartTime, clip.duration, bounds)
              moveClip(finalState.clipId, targetId, safeSt)
            } else {
              moveClip(finalState.clipId, targetId, finalState.newStartTime)
            }
          }

          // Scene reorder: if we moved scene clips on V1, sync scene order
          if (clip.sourceType === 'scene') {
            setTimeout(() => {
              const tl = useVideoStore.getState().project.timeline
              if (!tl) return
              const v1 = tl.tracks.find((t) => t.type === 'video')
              if (!v1) return
              const sceneClips = v1.clips
                .filter((c) => c.sourceType === 'scene')
                .sort((a, b) => a.startTime - b.startTime)
              const { scenes, reorderScenes } = useVideoStore.getState()
              for (let i = 0; i < sceneClips.length; i++) {
                const currentIdx = scenes.findIndex((s) => s.id === sceneClips[i].sourceId)
                if (currentIdx >= 0 && currentIdx !== i) {
                  reorderScenes(currentIdx, i)
                }
              }
            }, 0)
          }
        }

        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [
      timeline,
      pps,
      currentTime,
      allTracks,
      videoTracks,
      audioTracks,
      videoRowHeight,
      audioRowHeight,
      moveClip,
      selectedClipIds,
    ],
  )

  // ── Keyboard ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIds.length > 0) {
        e.preventDefault()
        const { removeClip } = useVideoStore.getState()
        for (const id of selectedClipIds) removeClip(id)
        setSelectedClipIds([])
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey && selectedClipIds.length > 0) {
        e.preventDefault()
        const { splitClip } = useVideoStore.getState()
        for (const id of selectedClipIds) {
          const clip = timeline?.tracks.flatMap((t) => t.clips).find((c) => c.id === id)
          if (clip) {
            const rel = currentTime - clip.startTime
            if (rel > 0 && rel < clip.duration) splitClip(id, rel)
          }
        }
        setSelectedClipIds([])
      }
      // Tool shortcuts
      const toolMap: Record<string, TimelineTool> = { v: 'select', c: 'razor', b: 'ripple', y: 'slip', h: 'hand' }
      if (!e.metaKey && !e.ctrlKey && toolMap[e.key]) {
        setActiveTool(toolMap[e.key])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedClipIds, currentTime, timeline, setSelectedClipIds])

  if (scenes.length === 0 || totalDuration === 0) return null

  return (
    <div
      className="w-full border-t border-[var(--color-border)] bg-[var(--color-timeline-bg,var(--color-panel))] flex flex-col"
      style={{ height: trackHeight, position: 'relative', overflow: 'hidden' }}
      ref={containerRef}
    >
      {/* Ruler - offset by toolbar + headers */}
      <div className="flex-shrink-0" style={{ marginLeft: LEFT_GUTTER, marginRight: SCROLLBAR_WIDTH }}>
        <TimeRuler
          pps={pps}
          totalWidth={totalWidth}
          scrollX={timelineScrollX}
          containerWidth={usableWidth}
          onSeek={onSeek}
        />
      </div>

      {/* Main content row: toolbar | sections */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar column */}
        <TimelineToolbar activeTool={activeTool} onToolChange={setActiveTool} height={contentHeight} />

        {/* Sections column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video section */}
          <TrackSection
            tracks={videoTracks}
            sectionType="video"
            height={videoSectionHeight}
            scrollY={videoScrollY}
            onScrollY={setVideoScrollY}
            rowHeight={videoRowHeight}
            onRowHeightChange={setVideoRowHeight}
            pps={pps}
            scrollX={timelineScrollX}
            usableWidth={usableWidth}
            totalDuration={totalDuration}
            currentTime={currentTime}
            activeTool={activeTool}
            dragState={dragState}
            onClipDragStart={handleClipDragStart}
            onContentClick={handleContentClick}
            getTimeline={getTimeline}
            trimSnapTime={trimSnapTime}
            onTrimSnap={setTrimSnapTime}
          />

          {/* Divider */}
          <div
            className="flex-shrink-0 flex items-center justify-center select-none"
            style={{
              height: DIVIDER_HEIGHT,
              cursor: 'row-resize',
              position: 'relative',
              zIndex: 30,
              background: isDividerDragging ? 'var(--color-accent)' : 'var(--color-border)',
              transition: isDividerDragging ? 'none' : 'background 0.15s',
            }}
            onPointerDown={handleDividerPointerDown}
          >
            <div
              style={{ width: 30, height: 2, borderRadius: 1, background: 'var(--color-text-muted)', opacity: 0.5 }}
            />
          </div>

          {/* Audio section */}
          <TrackSection
            tracks={audioTracks}
            sectionType="audio"
            height={audioSectionHeight}
            scrollY={audioScrollY}
            onScrollY={setAudioScrollY}
            rowHeight={audioRowHeight}
            onRowHeightChange={setAudioRowHeight}
            pps={pps}
            scrollX={timelineScrollX}
            usableWidth={usableWidth}
            totalDuration={totalDuration}
            currentTime={currentTime}
            activeTool={activeTool}
            dragState={dragState}
            onClipDragStart={handleClipDragStart}
            onContentClick={handleContentClick}
            getTimeline={getTimeline}
            trimSnapTime={trimSnapTime}
            onTrimSnap={setTrimSnapTime}
          />
        </div>
        {/* end sections column */}
      </div>
      {/* end main content row */}

      {/* Playhead */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: LEFT_GUTTER,
          right: SCROLLBAR_WIDTH,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <Playhead
          currentTime={currentTime}
          pps={pps}
          scrollX={timelineScrollX}
          containerWidth={usableWidth}
          isDragging={isPlayheadDragging}
          dragTime={dragTime}
          onPointerDown={onPlayheadPointerDown}
        />
      </div>

      {/* Zoom controls */}
      <div className="absolute top-0 flex items-center gap-1 z-20 p-0.5" style={{ right: SCROLLBAR_WIDTH }}>
        <span
          className="cursor-pointer px-1.5 py-0.5 rounded text-sm hover:bg-white/10 text-[var(--color-text-muted)]"
          onClick={zoomOut}
        >
          −
        </span>
        <span
          className="cursor-pointer px-1.5 py-0.5 rounded text-sm hover:bg-white/10 text-[var(--color-text-muted)]"
          onClick={fitAll}
        >
          Fit
        </span>
        <span
          className="cursor-pointer px-1.5 py-0.5 rounded text-sm hover:bg-white/10 text-[var(--color-text-muted)]"
          onClick={zoomIn}
        >
          +
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Premiere-style vertical scrollbar with zoom dot handles
// ═══════════════════════════════════════════════════════════════════

function VerticalScrollbar({
  scrollY,
  onScrollY,
  contentHeight,
  viewHeight,
  width,
  rowHeight,
  onRowHeightChange,
}: {
  scrollY: number
  onScrollY: (y: number) => void
  contentHeight: number
  viewHeight: number
  width: number
  rowHeight: number
  onRowHeightChange: (h: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  // The thumb represents the visible window within the content.
  // Dot handles at top/bottom resize the thumb = vertical zoom (row height change).
  const maxScroll = Math.max(0, contentHeight - viewHeight)
  const canScroll = contentHeight > viewHeight

  // Thumb sizing: ratio of viewHeight to contentHeight, clamped
  const ratio = contentHeight > 0 ? Math.min(1, viewHeight / contentHeight) : 1
  const minThumb = DOT_SIZE * 2 + 8
  const thumbHeight = Math.max(minThumb, Math.floor(viewHeight * ratio))
  const trackSpace = viewHeight - thumbHeight
  const thumbTop = canScroll && trackSpace > 0 ? (scrollY / maxScroll) * trackSpace : 0

  // ── Scroll (drag middle of thumb) ──
  const handleThumbPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startScroll = scrollY
    const handleMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      if (trackSpace > 0) {
        onScrollY(Math.max(0, Math.min(maxScroll, startScroll + (dy / trackSpace) * maxScroll)))
      }
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  // ── Zoom (drag top dot = shrink rows, drag bottom dot = grow rows) ──
  const handleDotDrag = (edge: 'top' | 'bottom', e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startRowHeight = rowHeight

    const handleMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      // Dragging top dot down or bottom dot up = zoom in (bigger rows)
      // Dragging top dot up or bottom dot down = zoom out (smaller rows)
      const direction = edge === 'top' ? -1 : 1
      const sensitivity = 0.5
      const newHeight = Math.round(startRowHeight + dy * direction * sensitivity)
      onRowHeightChange(Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, newHeight)))
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  // Click gutter to jump scroll
  const handleTrackClick = (e: React.MouseEvent) => {
    if (!canScroll) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const clickY = e.clientY - rect.top
    const targetScroll = (clickY / viewHeight) * contentHeight - viewHeight / 2
    onScrollY(Math.max(0, Math.min(maxScroll, targetScroll)))
  }

  return (
    <div
      ref={trackRef}
      className="flex-shrink-0 relative"
      style={{ width, background: 'rgba(0,0,0,0.2)', cursor: 'default' }}
      onClick={handleTrackClick}
    >
      {/* Thumb */}
      <div
        className="absolute flex flex-col items-center justify-between"
        style={{
          left: 1,
          right: 1,
          top: thumbTop,
          height: thumbHeight,
          background: 'rgba(255,255,255,0.18)',
          borderRadius: 3,
          cursor: canScroll ? 'grab' : 'default',
        }}
        onPointerDown={handleThumbPointerDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top zoom dot */}
        <div
          className="flex-shrink-0 rounded-full border border-[rgba(255,255,255,0.4)]"
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            cursor: 'ns-resize',
            background: 'rgba(80,80,80,0.9)',
            marginTop: 1,
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.15)',
          }}
          onPointerDown={(e) => handleDotDrag('top', e)}
        />
        {/* Bottom zoom dot */}
        <div
          className="flex-shrink-0 rounded-full border border-[rgba(255,255,255,0.4)]"
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            cursor: 'ns-resize',
            background: 'rgba(80,80,80,0.9)',
            marginBottom: 1,
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.15)',
          }}
          onPointerDown={(e) => handleDotDrag('bottom', e)}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TrackSection: independently scrollable group of tracks
// ═══════════════════════════════════════════════════════════════════

interface TrackSectionProps {
  tracks: Track[]
  sectionType: 'video' | 'audio'
  height: number
  scrollY: number
  onScrollY: (y: number) => void
  rowHeight: number
  onRowHeightChange: (h: number) => void
  pps: number
  scrollX: number
  usableWidth: number
  totalDuration: number
  currentTime: number
  activeTool: TimelineTool
  dragState: {
    clipId: string
    sourceTrackId: string
    active: boolean
    ghostLeft: number
    targetTrackId: string | null
    newStartTime: number
  } | null
  onClipDragStart: (clipId: string, trackId: string, e: React.PointerEvent) => void
  onContentClick: (e: React.MouseEvent<HTMLDivElement>) => void
  getTimeline: () => import('@/lib/types').Timeline | null
  trimSnapTime: number | null
  onTrimSnap: (time: number | null) => void
}

function TrackSection({
  tracks,
  sectionType,
  height,
  scrollY,
  onScrollY,
  rowHeight,
  onRowHeightChange,
  pps,
  scrollX,
  usableWidth,
  totalDuration,
  currentTime,
  activeTool,
  dragState,
  onClipDragStart,
  onContentClick,
  getTimeline,
  trimSnapTime,
  onTrimSnap,
}: TrackSectionProps) {
  const { addTrack } = useVideoStore()
  const addBtnHeight = 22
  const totalContentHeight = tracks.length * rowHeight + addBtnHeight

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && totalContentHeight > height) {
        e.stopPropagation()
        const maxY = Math.max(0, totalContentHeight - height)
        onScrollY(Math.max(0, Math.min(maxY, scrollY + e.deltaY)))
      }
    },
    [totalContentHeight, height, scrollY, onScrollY],
  )

  return (
    <div className="flex flex-shrink-0 overflow-hidden" style={{ height }}>
      {/* Track headers */}
      <div className="flex-shrink-0 overflow-hidden" style={{ width: TRACK_HEADER_WIDTH }}>
        <div style={{ transform: `translateY(${-scrollY}px)` }}>
          {tracks.map((track) => (
            <TrackHeader key={track.id} track={track} height={rowHeight} />
          ))}
          <div
            className="flex items-center justify-center border-b border-r border-[var(--color-border)] cursor-pointer hover:bg-white/5"
            style={{ width: TRACK_HEADER_WIDTH, height: addBtnHeight, fontSize: 9, color: 'var(--color-text-muted)' }}
            onClick={() => {
              if (sectionType === 'audio') addTrack('audio', `A${tracks.length + 1}`)
              else addTrack('video', `V${tracks.length + 1}`)
            }}
          >
            + {sectionType === 'audio' ? 'Audio' : 'Video'}
          </div>
        </div>
      </div>

      {/* Track content */}
      <div className="flex-1 overflow-hidden relative" onClick={onContentClick} onWheel={handleWheel}>
        <div style={{ transform: `translateY(${-scrollY}px)` }}>
          {tracks.map((track) => {
            const isDropTarget =
              dragState?.active && dragState.targetTrackId === track.id && dragState.sourceTrackId !== track.id
            return (
              <div
                key={track.id}
                className="relative"
                style={{
                  background: isDropTarget ? 'rgba(59,130,246,0.15)' : undefined,
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ transform: `translateX(${-scrollX}px)` }}>
                  <TrackRow
                    track={track}
                    pps={pps}
                    scrollX={scrollX}
                    containerWidth={usableWidth}
                    height={rowHeight}
                    totalDuration={totalDuration}
                    currentTime={currentTime}
                    activeTool={activeTool}
                    draggingClipId={dragState?.active ? dragState.clipId : null}
                    onClipDragStart={onClipDragStart}
                    onTrimSnap={onTrimSnap}
                  />
                </div>
              </div>
            )
          })}
          <div className="border-b border-[var(--color-border)]" style={{ height: addBtnHeight }} />
        </div>

        {/* Drag ghost */}
        {dragState?.active &&
          (() => {
            const tl = getTimeline()
            const clip = tl?.tracks.flatMap((t) => t.clips).find((c) => c.id === dragState.clipId)
            if (!clip) return null
            const idx = tracks.findIndex((t) => t.id === dragState.targetTrackId)
            if (idx < 0) return null
            return (
              <div
                className="absolute pointer-events-none rounded-[3px]"
                style={{
                  left: dragState.ghostLeft - scrollX,
                  top: idx * rowHeight - scrollY + 2,
                  width: clip.duration * pps,
                  height: rowHeight - 4,
                  background: 'rgba(59,130,246,0.4)',
                  border: '2px dashed rgba(255,255,255,0.6)',
                  zIndex: 50,
                }}
              />
            )
          })()}

        {/* Trim snap guide */}
        {trimSnapTime !== null && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: trimSnapTime * pps - scrollX,
              width: 1,
              background: '#22d3ee',
              opacity: 0.8,
              zIndex: 45,
            }}
          />
        )}
      </div>

      {/* Scrollbar with zoom dots */}
      <VerticalScrollbar
        scrollY={scrollY}
        onScrollY={onScrollY}
        contentHeight={totalContentHeight}
        viewHeight={height}
        width={SCROLLBAR_WIDTH}
        rowHeight={rowHeight}
        onRowHeightChange={onRowHeightChange}
      />
    </div>
  )
}

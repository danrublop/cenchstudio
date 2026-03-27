'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useVideoStore } from '@/lib/store'
import { useTimelineZoom } from './useTimelineZoom'
import { usePlayheadDrag } from './usePlayheadDrag'
import { RULER_HEIGHT } from './constants'
import TimeRuler from './TimeRuler'
import SceneTrack from './SceneTrack'
import OverlayTracks from './OverlayTracks'
import Playhead from './Playhead'

interface Props {
  currentTime: number
  totalDuration: number
  onSeek: (time: number) => void
  trackHeight?: number
}

export default function Timeline({ currentTime, totalDuration, onSeek, trackHeight = 80 }: Props) {
  const { scenes, timelineScrollX, timelineAutoScroll, setTimelineScrollX, setTimelineZoom } = useVideoStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    pps, totalWidth, maxScrollX, containerWidth, minPPS,
    zoomIn, zoomOut, fitAll,
  } = useTimelineZoom(containerRef, totalDuration)

  // Compute scene boundaries for snapping
  const sceneBoundaries: number[] = []
  let acc = 0
  for (const scene of scenes) {
    sceneBoundaries.push(acc)
    acc += scene.duration
  }
  sceneBoundaries.push(acc) // total end

  const { isDragging, dragTime, onPointerDown } = usePlayheadDrag({
    pps,
    scrollX: timelineScrollX,
    containerRef,
    sceneBoundaries,
    onSeek,
  })

  // Auto-scroll: keep playhead at ~25% from left when playing
  useEffect(() => {
    if (!timelineAutoScroll || isDragging) return
    const playheadX = currentTime * pps
    const targetOffset = containerWidth * 0.25
    const desiredScroll = playheadX - targetOffset
    // Only auto-scroll if playhead is outside 20%-80% of viewport
    const viewLeft = timelineScrollX
    const viewRight = timelineScrollX + containerWidth
    const headInView = playheadX >= viewLeft && playheadX <= viewRight
    if (headInView) {
      const relPos = (playheadX - viewLeft) / containerWidth
      if (relPos > 0.8) {
        setTimelineScrollX(Math.min(maxScrollX, Math.max(0, desiredScroll)))
      }
    }
  }, [currentTime, pps, containerWidth, timelineAutoScroll, isDragging, timelineScrollX, maxScrollX, setTimelineScrollX])

  // Double-click scene to zoom-to-fit
  const handleZoomToScene = useCallback((sceneIndex: number) => {
    const scene = scenes[sceneIndex]
    if (!scene) return
    let start = 0
    for (let i = 0; i < sceneIndex; i++) start += scenes[i].duration
    const sceneDuration = scene.duration
    // Fill ~80% of viewport
    const targetPPS = (containerWidth * 0.8) / sceneDuration
    setTimelineZoom(targetPPS)
    // Center the scene
    const sceneCenterPx = (start + sceneDuration / 2) * targetPPS
    const newScroll = sceneCenterPx - containerWidth / 2
    const newMax = Math.max(0, totalDuration * targetPPS - containerWidth)
    setTimelineScrollX(Math.min(newMax, Math.max(0, newScroll)))
  }, [scenes, containerWidth, totalDuration, setTimelineZoom, setTimelineScrollX])

  // Click on content area to seek
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle direct clicks (not from SceneTrack clicks that already propagated)
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const time = (timelineScrollX + (e.clientX - rect.left)) / pps
    onSeek(Math.max(0, Math.min(totalDuration, time)))
  }, [timelineScrollX, pps, totalDuration, onSeek])

  if (scenes.length === 0 || totalDuration === 0) return null

  const contentHeight = trackHeight - RULER_HEIGHT
  const overlayHeight = contentHeight > 120 ? Math.floor(contentHeight * 0.4) : 0
  const sceneTrackHeight = contentHeight - overlayHeight

  return (
    <div
      className="w-full border-t border-[var(--color-border)] bg-[var(--color-panel)]"
      style={{ height: trackHeight, position: 'relative', overflow: 'hidden' }}
      ref={containerRef}
    >
      {/* Ruler */}
      <TimeRuler
        pps={pps}
        totalWidth={totalWidth}
        scrollX={timelineScrollX}
        containerWidth={containerWidth}
        onSeek={onSeek}
      />

      {/* Content area */}
      <div
        className="relative overflow-hidden"
        style={{ height: contentHeight }}
        onClick={handleContentClick}
      >
        {/* Scrollable inner */}
        <div style={{ transform: `translateX(${-timelineScrollX}px)` }}>
          <SceneTrack
            pps={pps}
            scrollX={timelineScrollX}
            containerWidth={containerWidth}
            trackHeight={sceneTrackHeight}
            onZoomToScene={handleZoomToScene}
          />
          <OverlayTracks
            pps={pps}
            scrollX={timelineScrollX}
            containerWidth={containerWidth}
            trackHeight={contentHeight}
          />
        </div>
      </div>

      {/* Playhead */}
      <Playhead
        currentTime={currentTime}
        pps={pps}
        scrollX={timelineScrollX}
        containerWidth={containerWidth}
        isDragging={isDragging}
        dragTime={dragTime}
        onPointerDown={onPointerDown}
      />
    </div>
  )
}

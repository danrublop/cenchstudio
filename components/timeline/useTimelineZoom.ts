import { useCallback, useEffect, useRef, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import { MAX_PPS } from './constants'

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function useTimelineZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  totalDuration: number,
  /** Pixels reserved for non-scrollable UI (e.g. track headers) */
  reservedWidth: number = 0,
) {
  const { timelineZoom, timelineScrollX, setTimelineZoom, setTimelineScrollX, setTimelineFollowPaused } =
    useVideoStore()

  const [containerWidth, setContainerWidth] = useState(1)

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width || 1)
      }
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth || 1)
    return () => ro.disconnect()
  }, [containerRef])

  // Usable width for timeline content (subtract track headers etc.)
  const usableWidth = Math.max(1, containerWidth - reservedWidth)

  // Use a 'working duration' that provides plenty of room beyond the actual content
  const contentDuration = Math.max(totalDuration, 0.1)
  const workingDuration = Math.max(contentDuration + 600, contentDuration * 2) // At least 10 mins extra or 2x

  // Allow zooming out much further than just 'fit all'
  const minPPS = 0.1
  const pps = timelineZoom === 0 ? 20 : clamp(timelineZoom, minPPS, MAX_PPS)

  const totalWidth = Math.max(usableWidth, workingDuration * pps)
  const maxScrollX = Math.max(0, totalWidth - usableWidth)

  // Clamp scroll when it exceeds max
  useEffect(() => {
    if (timelineScrollX > maxScrollX) {
      setTimelineScrollX(Math.max(0, maxScrollX))
    }
  }, [maxScrollX, timelineScrollX, setTimelineScrollX])

  const zoomAtCursor = useCallback(
    (newPPS: number, cursorClientX: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cursorOffset = cursorClientX - rect.left - reservedWidth
      const timeAtCursor = (timelineScrollX + cursorOffset) / pps
      const clamped = clamp(newPPS, minPPS, MAX_PPS)
      setTimelineZoom(clamped)
      const newScroll = timeAtCursor * clamped - cursorOffset
      const newMax = Math.max(0, workingDuration * clamped - usableWidth)
      setTimelineScrollX(clamp(newScroll, 0, newMax))
    },
    [
      containerRef,
      pps,
      minPPS,
      timelineScrollX,
      workingDuration,
      usableWidth,
      reservedWidth,
      setTimelineZoom,
      setTimelineScrollX,
    ],
  )

  const zoomIn = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    zoomAtCursor(pps * 1.2, rect.left + rect.width / 2)
  }, [containerRef, pps, zoomAtCursor])

  const zoomOut = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    zoomAtCursor(pps / 1.2, rect.left + rect.width / 2)
  }, [containerRef, pps, zoomAtCursor])

  const fitAll = useCallback(() => {
    setTimelineZoom(0)
    setTimelineScrollX(0)
  }, [setTimelineZoom, setTimelineScrollX])

  // Wheel event listeners
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        zoomAtCursor(pps * factor, e.clientX)
      } else {
        // Horizontal scroll (both no-modifier and shift)
        const delta = e.shiftKey ? e.deltaY : e.deltaY
        const next = clamp(timelineScrollX + delta, 0, maxScrollX)
        if (next !== timelineScrollX) {
          setTimelineFollowPaused(true)
          setTimelineScrollX(next)
        }
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, pps, timelineScrollX, maxScrollX, zoomAtCursor, setTimelineScrollX, setTimelineFollowPaused])

  return { pps, totalWidth, maxScrollX, containerWidth, usableWidth, minPPS, zoomAtCursor, zoomIn, zoomOut, fitAll }
}

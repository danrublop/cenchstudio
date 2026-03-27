import { useCallback, useRef, useState } from 'react'
import { SNAP_THRESHOLD } from './constants'

interface UsePlayheadDragOptions {
  pps: number
  scrollX: number
  containerRef: React.RefObject<HTMLDivElement | null>
  sceneBoundaries: number[]
  onSeek: (time: number) => void
}

export function usePlayheadDrag({
  pps, scrollX, containerRef, sceneBoundaries, onSeek,
}: UsePlayheadDragOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)
  const draggingRef = useRef(false)

  const computeTime = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const time = (scrollX + (clientX - rect.left)) / pps
    // Snap to nearest scene boundary
    for (const boundary of sceneBoundaries) {
      const bPx = boundary * pps - scrollX
      const cursorPx = clientX - rect.left
      if (Math.abs(bPx - cursorPx) <= SNAP_THRESHOLD) {
        return boundary
      }
    }
    return Math.max(0, time)
  }, [pps, scrollX, containerRef, sceneBoundaries])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setIsDragging(true)
    const t = computeTime(e.clientX)
    setDragTime(t)
    onSeek(t)

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return
      const t2 = computeTime(ev.clientX)
      setDragTime(t2)
      onSeek(t2)
    }
    const onUp = () => {
      draggingRef.current = false
      setIsDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [computeTime, onSeek])

  return { isDragging, dragTime, onPointerDown }
}

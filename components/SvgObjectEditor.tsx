'use client'

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react'
import { useVideoStore } from '@/lib/store'
import type { SvgObject, TextOverlay } from '@/lib/types'

interface Props {
  sceneId: string
  canvasRef: React.RefObject<HTMLDivElement | null>
}

type LayerKind = 'svg' | 'text'
type ResizeType = 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br'

interface DragState {
  kind: LayerKind
  resizeType: ResizeType
  id: string
  startMouseX: number
  startMouseY: number
  startX: number
  startY: number
  startWidth: number   // svgObject.width (%)
  startSize: number    // textOverlay.size (px font size)
  canvasWidth: number
  canvasHeight: number
}

export default function SvgObjectEditor({ sceneId, canvasRef }: Props) {
  const { scenes, updateSvgObject, updateTextOverlay, saveSceneHTML } = useVideoStore()
  const scene = scenes.find((s) => s.id === sceneId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragState = useRef<DragState | null>(null)

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect() ?? null
  }, [canvasRef])

  const startDrag = useCallback((
    e: React.MouseEvent,
    kind: LayerKind,
    id: string,
    resizeType: ResizeType,
    x: number, y: number,
    width: number, size: number,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = getCanvasRect()
    if (!rect) return
    setSelectedId(id)
    dragState.current = {
      kind, resizeType, id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: x, startY: y,
      startWidth: width, startSize: size,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    }
  }, [getCanvasRect])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const ds = dragState.current
      if (!ds || !scene) return

      const dxPct = ((e.clientX - ds.startMouseX) / ds.canvasWidth) * 100
      const dyPct = ((e.clientY - ds.startMouseY) / ds.canvasHeight) * 100

      if (ds.kind === 'svg') {
        if (ds.resizeType === 'move') {
          updateSvgObject(sceneId, ds.id, {
            x: Math.max(0, Math.min(95, ds.startX + dxPct)),
            y: Math.max(0, Math.min(95, ds.startY + dyPct)),
          })
        } else {
          const sign = ds.resizeType === 'resize-tl' || ds.resizeType === 'resize-bl' ? -1 : 1
          updateSvgObject(sceneId, ds.id, {
            width: Math.max(5, Math.min(100, ds.startWidth + sign * dxPct)),
          })
        }
      } else {
        // text overlay
        if (ds.resizeType === 'move') {
          updateTextOverlay(sceneId, ds.id, {
            x: Math.max(0, Math.min(95, ds.startX + dxPct)),
            y: Math.max(0, Math.min(95, ds.startY + dyPct)),
          })
        } else {
          // Resize = scale font size via horizontal drag (right grows, left shrinks)
          const sign = ds.resizeType === 'resize-tl' || ds.resizeType === 'resize-bl' ? -1 : 1
          const newSize = Math.max(8, Math.round(ds.startSize + sign * dxPct * 1.5))
          updateTextOverlay(sceneId, ds.id, { size: newSize })
        }
      }
    }

    const onMouseUp = () => {
      if (dragState.current) saveSceneHTML(sceneId)
      dragState.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [sceneId, scene, updateSvgObject, updateTextOverlay, saveSceneHTML])

  const svgObjects: SvgObject[] = scene?.svgObjects ?? []
  const textOverlays: TextOverlay[] = scene?.textOverlays ?? []

  // Measure text overlay boxes from the actual iframe — only source of truth.
  // Hooks must come before any early return (React rules of hooks).
  const [textMeasures, setTextMeasures] = useState<Record<string, { wPct: number; hPct: number }>>({})
  const textOverlaysRef = useRef(textOverlays)
  useLayoutEffect(() => { textOverlaysRef.current = textOverlays })

  useEffect(() => {
    const iframe = canvasRef.current?.querySelector('iframe') as HTMLIFrameElement | null
    if (!iframe) return

    const measure = () => {
      const doc = iframe.contentDocument
      if (!doc || doc.readyState !== 'complete') return
      const vw = doc.documentElement.clientWidth
      const vh = doc.documentElement.clientHeight
      if (!vw || !vh) return
      const els = doc.querySelectorAll<HTMLElement>('.text-overlay')
      const next: Record<string, { wPct: number; hPct: number }> = {}
      textOverlaysRef.current.forEach((t, i) => {
        const el = els[i]
        if (el) {
          const r = el.getBoundingClientRect()
          next[t.id] = {
            wPct: Math.max(2, (r.width / vw) * 100),
            hPct: Math.max(1, (r.height / vh) * 100),
          }
        }
      })
      if (Object.keys(next).length > 0) setTextMeasures(next)
    }

    measure()
    iframe.addEventListener('load', measure)
    return () => iframe.removeEventListener('load', measure)
  }, [sceneId, canvasRef, textOverlays])

  // Early return after all hooks
  if (!scene || (svgObjects.length === 0 && textOverlays.length === 0)) return null

  const corners = ['tl', 'tr', 'bl', 'br'] as const

  const cornerHandles = (id: string, kind: LayerKind, x: number, y: number, width: number, size: number, isSelected: boolean) =>
    isSelected && corners.map((corner) => (
      <div
        key={corner}
        className="absolute w-3 h-3 bg-[#e84545] border border-white rounded-sm"
        style={{
          top: corner.startsWith('t') ? -6 : 'auto',
          bottom: corner.startsWith('b') ? -6 : 'auto',
          left: corner.endsWith('l') ? -6 : 'auto',
          right: corner.endsWith('r') ? -6 : 'auto',
          cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
        }}
        onMouseDown={(e) => startDrag(e, kind, id, `resize-${corner}` as ResizeType, x, y, width, size)}
      />
    ))

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
      onClick={() => setSelectedId(null)}
    >
      {/* SVG Objects */}
      {svgObjects.map((obj) => {
        const isSelected = selectedId === obj.id
        return (
          <div
            key={obj.id}
            className="absolute pointer-events-auto"
            style={{
              left: `${obj.x}%`,
              top: `${obj.y}%`,
              width: `${obj.width}%`,
              outline: isSelected ? '2px dashed #e84545' : '1px dashed rgba(232,69,69,0.4)',
              outlineOffset: '2px',
              cursor: 'move',
              minHeight: 4,
            }}
            onMouseDown={(e) => startDrag(e, 'svg', obj.id, 'move', obj.x, obj.y, obj.width, 0)}
            onClick={(e) => { e.stopPropagation(); setSelectedId(obj.id) }}
          >
            {cornerHandles(obj.id, 'svg', obj.x, obj.y, obj.width, 0, isSelected)}
            {isSelected && (
              <div className="absolute -top-5 left-0 text-[10px] text-[#e84545] bg-[#111114]/80 px-1 rounded whitespace-nowrap pointer-events-none">
                {obj.prompt.slice(0, 30) || 'Object'}
              </div>
            )}
          </div>
        )
      })}

      {/* Text Overlays */}
      {textOverlays.map((t) => {
        const isSelected = selectedId === t.id
        const canvasHeight = canvasRef.current?.offsetHeight ?? 438
        // Use iframe-measured values; fall back to rough estimate until iframe loads
        const measured = textMeasures[t.id]
        const widthPct = measured?.wPct ?? Math.max(2, t.content.length * t.size * 0.55 / (canvasRef.current?.offsetWidth ?? 780) * 100)
        const heightPct = measured?.hPct ?? Math.max(1, (t.size * 1.2) / canvasHeight * 100)
        return (
          <div
            key={t.id}
            className="absolute pointer-events-auto"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              outline: isSelected ? '2px dashed #4a9eff' : '1px dashed rgba(74,158,255,0.4)',
              outlineOffset: '2px',
              cursor: 'move',
            }}
            onMouseDown={(e) => startDrag(e, 'text', t.id, 'move', t.x, t.y, widthPct, t.size)}
            onClick={(e) => { e.stopPropagation(); setSelectedId(t.id) }}
          >
            {cornerHandles(t.id, 'text', t.x, t.y, widthPct, t.size, isSelected)}
            {isSelected && (
              <div className="absolute -top-5 left-0 text-[10px] text-[#4a9eff] bg-[#111114]/80 px-1 rounded whitespace-nowrap pointer-events-none">
                T · {t.content.slice(0, 20)}{t.content.length > 20 ? '…' : ''} · {t.size}px
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

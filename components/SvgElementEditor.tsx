'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useVideoStore } from '@/lib/store'
import type { SvgObject } from '@/lib/types'

interface SelectionBox {
  id: string // element id attribute or generated
  el: Element
  x: number
  y: number
  width: number
  height: number
  isText: boolean
  fontSize?: number
}

interface Props {
  sceneId: string
}

export default function SvgElementEditor({ sceneId }: Props) {
  const { scenes, updateScene, saveSceneHTML, openTextTabForSlot } = useVideoStore()
  // keep a stable ref to scenes for use inside extract callback
  const scenesRef = useRef(scenes)
  useEffect(() => {
    scenesRef.current = scenes
  }, [scenes])
  const scene = scenes.find((s) => s.id === sceneId)

  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [selections, setSelections] = useState<SelectionBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const dragState = useRef<{
    startMouseX: number
    startMouseY: number
    startBx: number
    startBy: number
    svgWidth: number
    svgHeight: number
    viewBoxW: number
    viewBoxH: number
    el: Element
    origTransform: string
    type: 'move' | 'scale'
    startWidth?: number
    startHeight?: number
  } | null>(null)

  // ── Compute selection boxes from SVG DOM ──────────────────────────────────

  const computeSelections = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector('svg')
    if (!svgEl) return

    const svgRect = svgEl.getBoundingClientRect()
    const vb = svgEl.viewBox.baseVal
    const viewBoxW = vb.width || 1920
    const viewBoxH = vb.height || 1080
    const scaleX = svgRect.width / viewBoxW
    const scaleY = svgRect.height / viewBoxH

    const candidates = svgEl.querySelectorAll('g[id], text')
    const boxes: SelectionBox[] = []

    candidates.forEach((el, idx) => {
      try {
        const bbox = (el as SVGGraphicsElement).getBBox?.()
        if (!bbox || (bbox.width === 0 && bbox.height === 0)) return

        const id = el.getAttribute('id') || `el-${idx}`
        if (!el.getAttribute('id')) el.setAttribute('id', id)

        const isText = el.tagName.toLowerCase() === 'text'
        const fontSize = isText ? parseFloat(getComputedStyle(el).fontSize) || 16 : undefined

        boxes.push({
          id,
          el,
          x: bbox.x * scaleX + svgRect.left - svgRect.left,
          y: bbox.y * scaleY + svgRect.top - svgRect.top,
          width: bbox.width * scaleX,
          height: bbox.height * scaleY,
          isText,
          fontSize,
        })
      } catch {
        // getBBox can throw on hidden elements
      }
    })

    setSelections(boxes)
  }, [])

  // ── Mount / remount SVG ───────────────────────────────────────────────────

  useEffect(() => {
    if (!scene?.svgContent || !svgContainerRef.current) return
    svgContainerRef.current.innerHTML = scene.svgContent
    // Give browser a frame to render before measuring
    requestAnimationFrame(() => computeSelections())
  }, [scene?.svgContent, computeSelections])

  // ── Serialise SVG back to string ─────────────────────────────────────────

  const serializeAndSave = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector('svg')
    if (!svgEl) return
    const newSvg = svgEl.outerHTML
    updateScene(sceneId, { svgContent: newSvg })
    saveSceneHTML(sceneId)
    requestAnimationFrame(() => computeSelections())
  }, [sceneId, updateScene, saveSceneHTML, computeSelections])

  // ── Drag to move ─────────────────────────────────────────────────────────

  const handleHandleMouseDown = useCallback((e: React.MouseEvent, box: SelectionBox, type: 'move' | 'scale') => {
    e.stopPropagation()
    e.preventDefault()

    const svgEl = svgContainerRef.current?.querySelector('svg')
    if (!svgEl) return
    const svgRect = svgEl.getBoundingClientRect()
    const vb = svgEl.viewBox.baseVal

    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startBx: box.x,
      startBy: box.y,
      svgWidth: svgRect.width,
      svgHeight: svgRect.height,
      viewBoxW: vb.width || 1920,
      viewBoxH: vb.height || 1080,
      el: box.el,
      origTransform: box.el.getAttribute('transform') || '',
      type,
      startWidth: box.width,
      startHeight: box.height,
    }
    setSelectedId(box.id)
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const ds = dragState.current
      if (!ds) return

      const svgScaleX = ds.viewBoxW / ds.svgWidth
      const svgScaleY = ds.viewBoxH / ds.svgHeight
      const dx = (e.clientX - ds.startMouseX) * svgScaleX
      const dy = (e.clientY - ds.startMouseY) * svgScaleY

      if (ds.type === 'move') {
        const existing = ds.origTransform.replace(/^translate\([^)]+\)\s*/, '')
        ds.el.setAttribute('transform', `translate(${dx}, ${dy}) ${existing}`)
      } else {
        // scale from top-left
        const scaleX = ds.startWidth ? (ds.startWidth + (e.clientX - ds.startMouseX)) / ds.startWidth : 1
        const scaleY = ds.startHeight ? (ds.startHeight + (e.clientY - ds.startMouseY)) / ds.startHeight : 1
        const s = Math.max(0.1, (scaleX + scaleY) / 2)
        const existing = ds.origTransform.replace(/^scale\([^)]+\)\s*/, '')
        ds.el.setAttribute('transform', `scale(${s.toFixed(3)}) ${existing}`)
      }

      requestAnimationFrame(() => computeSelections())
    }

    const onMouseUp = () => {
      if (dragState.current) {
        serializeAndSave()
        dragState.current = null
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [computeSelections, serializeAndSave])

  // ── Double-click to edit text ─────────────────────────────────────────────

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, box: SelectionBox) => {
      if (!box.isText) return
      e.stopPropagation()
      openTextTabForSlot(`svg:main:${box.id}`)
    },
    [openTextTabForSlot],
  )

  // ── Font size drag (vertical) for text elements ───────────────────────────

  const fontDragRef = useRef<{ startY: number; startSize: number; el: Element } | null>(null)

  const handleFontDragStart = useCallback((e: React.MouseEvent, box: SelectionBox) => {
    e.stopPropagation()
    e.preventDefault()
    fontDragRef.current = {
      startY: e.clientY,
      startSize: box.fontSize ?? 16,
      el: box.el,
    }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const fd = fontDragRef.current
      if (!fd) return
      const dy = fd.startY - e.clientY // drag up = bigger
      const newSize = Math.max(8, Math.round(fd.startSize + dy * 0.5))
      ;(fd.el as HTMLElement).style.fontSize = `${newSize}px`
      requestAnimationFrame(() => computeSelections())
    }
    const onUp = () => {
      if (fontDragRef.current) {
        serializeAndSave()
        fontDragRef.current = null
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [computeSelections, serializeAndSave])

  // ── Extract element to independent SvgObject ─────────────────────────────

  const handleExtract = useCallback(
    (box: SelectionBox) => {
      const svgEl = svgContainerRef.current?.querySelector('svg') as SVGSVGElement | null
      if (!svgEl) return

      try {
        const bbox = (box.el as SVGGraphicsElement).getBBox()
        if (bbox.width === 0 || bbox.height === 0) return

        const vb = svgEl.viewBox.baseVal
        const viewBoxW = vb.width || 1920
        const viewBoxH = vb.height || 1080

        const styleBlock = svgEl.querySelector('style')?.outerHTML ?? ''
        const defsBlock = svgEl.querySelector('defs')?.outerHTML ?? ''
        const newSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}">${defsBlock}${styleBlock}${box.el.outerHTML}</svg>`

        // Remove element from source, serialize
        box.el.remove()
        const newSourceSvg = svgEl.outerHTML

        const xPct = (bbox.x / viewBoxW) * 100
        const yPct = (bbox.y / viewBoxH) * 100
        const wPct = Math.max(2, (bbox.width / viewBoxW) * 100)

        const newObj: SvgObject = {
          id: uuidv4(),
          prompt: `#${box.id}`,
          svgContent: newSvg,
          x: xPct,
          y: yPct,
          width: wPct,
          opacity: 1,
          zIndex: 5,
        }

        const currentScene = scenesRef.current.find((s) => s.id === sceneId)!
        updateScene(sceneId, {
          svgContent: newSourceSvg,
          svgObjects: [
            ...(currentScene.svgObjects ?? []).map((o) =>
              o.id === currentScene.primaryObjectId ? { ...o, svgContent: newSourceSvg } : o,
            ),
            newObj,
          ],
        })
        saveSceneHTML(sceneId)
        setSelectedId(null)
        // Recompute selections after DOM update
        requestAnimationFrame(() => computeSelections())
      } catch {
        // getBBox can throw on detached/hidden elements
      }
    },
    [sceneId, updateScene, saveSceneHTML, computeSelections],
  )

  if (!scene?.svgContent) return null

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ zIndex: 15 }} onClick={() => setSelectedId(null)}>
      {/* SVG rendered directly */}
      <div
        ref={svgContainerRef}
        className="absolute inset-0 pointer-events-none"
        style={{ background: scene.bgColor ?? '#fffef9' }}
      />

      {/* Selection overlays */}
      {selections.map((box) => {
        const isSelected = selectedId === box.id
        return (
          <div
            key={box.id}
            className="absolute pointer-events-auto"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              outline: isSelected ? '2px dashed #e84545' : '1px dashed rgba(232,69,69,0.25)',
              outlineOffset: '2px',
              cursor: 'move',
            }}
            onMouseDown={(e) => handleHandleMouseDown(e, box, 'move')}
            onDoubleClick={(e) => handleDoubleClick(e, box)}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(box.id)
            }}
          >
            {isSelected && (
              <>
                {/* Scale handle — bottom-right corner */}
                <div
                  className="absolute w-3 h-3 bg-[#e84545] border border-white rounded-sm"
                  style={{ bottom: -6, right: -6, cursor: 'nwse-resize' }}
                  onMouseDown={(e) => handleHandleMouseDown(e, box, 'scale')}
                />

                {/* Font size handle — only for text */}
                {box.isText && (
                  <div
                    className="absolute -top-6 right-0 flex items-center gap-1 bg-[#111114]/90 rounded px-1.5 py-0.5 text-[9px] text-[#f0ece0] select-none"
                    style={{ cursor: 'ns-resize', whiteSpace: 'nowrap' }}
                    onMouseDown={(e) => handleFontDragStart(e, box)}
                    title="Drag up/down to resize font"
                  >
                    ↕ {box.fontSize ? Math.round(box.fontSize) : '?'}px
                  </div>
                )}

                {/* Element label + Extract button */}
                <div className="absolute -top-5 left-0 flex items-center gap-1.5">
                  <span className="text-[9px] text-[#e84545] bg-[#111114]/80 px-1 rounded whitespace-nowrap pointer-events-none">
                    {box.isText ? 'text' : `#${box.id}`}
                  </span>
                  {!box.isText && (
                    <button
                      className="text-[9px] text-[#f0ece0] bg-[#1a1a1f] border border-[#e84545]/60 px-1 rounded hover:bg-[#e84545] hover:text-white transition-colors whitespace-nowrap"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExtract(box)
                      }}
                      title="Extract to independent object"
                    >
                      ✂ Extract
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

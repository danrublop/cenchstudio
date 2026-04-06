'use client'

import { useRef, useEffect, useCallback } from 'react'
import {
  Plus,
  Box,
  Circle,
  Square,
  Hexagon,
  Play,
  Pause,
  RefreshCw,
  Database,
  Triangle,
  Dot,
  Layers,
  Camera,
  RotateCcw,
  Undo2,
  Redo2,
  Download,
  X,
} from 'lucide-react'
import type { ZdogStudioShapeType } from '@/lib/types/zdog-studio'
import { useZdogStudio } from './store'

const TAU = Math.PI * 2

function generateZdogCode(shapes: any[], zoom: number): string {
  let code = `// Zdog Scene Export\n\nconst illo = new Zdog.Illustration({\n  element: '.zdog-canvas',\n  zoom: ${zoom},\n  dragRotate: true,\n});\n\n`
  const shapeMap = new Map<string, string>()
  shapeMap.set('illo', 'illo')
  const pending = [...shapes]
  let iterations = 0
  while (pending.length > 0 && iterations < 100) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const shape = pending[i]
      const parentVar = shape.parentId ? shapeMap.get(shape.parentId) : 'illo'
      if (parentVar) {
        const varName = shape.id.replace(/[^a-zA-Z0-9]/g, '_')
        shapeMap.set(shape.id, varName)
        code += `const ${varName} = new Zdog.${shape.type}({\n  addTo: ${parentVar},\n`
        Object.entries(shape.properties).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            code += `  ${k}: ${typeof v === 'string' ? `'${v}'` : typeof v === 'object' ? JSON.stringify(v) : v},\n`
          }
        })
        code += `  translate: ${JSON.stringify(shape.transforms.translate)},\n  rotate: ${JSON.stringify(shape.transforms.rotate)},\n  scale: ${JSON.stringify(shape.transforms.scale)},\n});\n\n`
        pending.splice(i, 1)
      }
    }
    iterations++
  }
  code += `function animate() {\n  illo.updateRenderGraph();\n  requestAnimationFrame(animate);\n}\nanimate();`
  return code
}

export default function ZdogViewport() {
  const scene = useZdogStudio((s) => s.scene)
  const isSpinning = useZdogStudio((s) => s.isSpinning)
  const showCode = useZdogStudio((s) => s.showCode)
  const historyIndex = useZdogStudio((s) => s.historyIndex)
  const historyLen = useZdogStudio((s) => s.history.length)
  const { undo, redo, setSpinning, setShowCode, addShape, pushToHistory } = useZdogStudio()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const illoRef = useRef<any>(null)
  const animFrameRef = useRef<number>(0)
  const zdogLoadedRef = useRef(false)

  // Load Zdog script
  useEffect(() => {
    if (zdogLoadedRef.current || typeof window === 'undefined') return
    if ((window as any).Zdog) {
      zdogLoadedRef.current = true
      return
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/zdog@1/dist/zdog.dist.min.js'
    script.onload = () => {
      zdogLoadedRef.current = true
    }
    document.head.appendChild(script)
  }, [])

  // Resize
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current && canvasRef.current) {
          canvasRef.current.width = entry.contentRect.width
          canvasRef.current.height = entry.contentRect.height
          if (illoRef.current) illoRef.current.updateRenderGraph()
        }
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Sync Zdog
  useEffect(() => {
    if (!canvasRef.current) return
    const Zdog = (window as any).Zdog
    if (!Zdog) {
      const interval = setInterval(() => {
        if ((window as any).Zdog) {
          clearInterval(interval)
          useZdogStudio.getState().setScene({ ...scene })
        }
      }, 100)
      return () => clearInterval(interval)
    }

    if (containerRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth
      canvasRef.current.height = containerRef.current.clientHeight
    }

    const currentRotation = illoRef.current
      ? {
          x: illoRef.current.rotate.x,
          y: illoRef.current.rotate.y,
          z: illoRef.current.rotate.z,
        }
      : null

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    let illo: any
    try {
      illo = new Zdog.Illustration({
        element: canvasRef.current,
        zoom: scene.zoom,
        dragRotate: true,
        onDragStart: () => useZdogStudio.getState().setSpinning(false),
      })
      illoRef.current = illo
      if (currentRotation) illo.rotate.set(currentRotation)

      // Crosshair
      new Zdog.Shape({ addTo: illo, path: [{ x: -10 }, { x: 10 }], stroke: 0.5, color: '#444' })
      new Zdog.Shape({ addTo: illo, path: [{ y: -10 }, { y: 10 }], stroke: 0.5, color: '#444' })

      // Grid
      const grid = new Zdog.Group({ addTo: illo, rotate: { x: Zdog.TAU / 4 }, translate: { y: 20 } })
      for (let i = -5; i <= 5; i++) {
        new Zdog.Shape({
          addTo: grid,
          path: [{ x: -50 }, { x: 50 }],
          translate: { y: i * 10 },
          stroke: 0.1,
          color: '#333',
        })
        new Zdog.Shape({
          addTo: grid,
          path: [{ y: -50 }, { y: 50 }],
          translate: { x: i * 10 },
          stroke: 0.1,
          color: '#333',
        })
      }
    } catch {
      return
    }

    const shapeMap = new Map<string, any>()
    const pending = [...scene.shapes]
    let iterations = 0
    while (pending.length > 0 && iterations < 100) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const shape = pending[i]
        const parent = shape.parentId ? shapeMap.get(shape.parentId) : illo
        if (parent || !shape.parentId) {
          const opts = {
            addTo: parent || illo,
            ...shape.properties,
            translate: shape.transforms.translate,
            rotate: shape.transforms.rotate,
            scale: shape.transforms.scale,
          }
          let z: any
          switch (shape.type) {
            case 'Ellipse':
              z = new Zdog.Ellipse(opts)
              break
            case 'Rect':
              z = new Zdog.Rect(opts)
              break
            case 'RoundedRect':
              z = new Zdog.RoundedRect(opts)
              break
            case 'Polygon':
              z = new Zdog.Polygon(opts)
              break
            case 'Box':
              z = new Zdog.Box(opts)
              break
            case 'Cylinder':
              z = new Zdog.Cylinder(opts)
              break
            case 'Cone':
              z = new Zdog.Cone(opts)
              break
            case 'Hemisphere':
              z = new Zdog.Hemisphere(opts)
              break
            case 'Anchor':
              z = new Zdog.Anchor(opts)
              break
            case 'Group':
              z = new Zdog.Group(opts)
              break
            default:
              z = new Zdog.Shape(opts)
              break
          }
          shapeMap.set(shape.id, z)
          pending.splice(i, 1)
        }
      }
      iterations++
    }

    const animate = () => {
      if (useZdogStudio.getState().isSpinning) illo.rotate.y += 0.01
      illo.updateRenderGraph()
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [scene.shapes, scene.zoom])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const setView = useCallback((rot: { x: number; y: number; z: number }) => {
    if (illoRef.current) {
      illoRef.current.rotate.set(rot)
      illoRef.current.updateRenderGraph()
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Toolbar */}
      <div className="h-9 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex items-center px-2 gap-1.5 flex-shrink-0 overflow-x-auto">
        {/* Add shapes */}
        <div className="flex items-center gap-0.5 bg-[var(--color-bg-primary)] p-0.5 rounded border border-[var(--color-border)]">
          {(
            [
              ['Ellipse', Circle],
              ['Rect', Square],
              ['Box', Box],
              ['Cylinder', Database],
              ['Cone', Triangle],
              ['Polygon', Hexagon],
              ['Shape', Dot],
              ['Hemisphere', Circle],
              ['Group', Layers],
              ['Anchor', Plus],
            ] as [ZdogStudioShapeType, any][]
          ).map(([type, Icon]) => (
            <span
              key={type}
              onClick={() => addShape(type)}
              className="p-1 hover:bg-[var(--color-bg-hover)] rounded cursor-pointer"
              title={`Add ${type}`}
            >
              <Icon size={13} />
            </span>
          ))}
        </div>

        <div className="h-4 w-px bg-[var(--color-border)]" />

        {/* Undo/Redo */}
        <span
          onClick={undo}
          className={`p-1 rounded cursor-pointer ${historyIndex === 0 ? 'opacity-30' : 'hover:bg-[var(--color-bg-hover)]'}`}
          title="Undo"
        >
          <Undo2 size={13} />
        </span>
        <span
          onClick={redo}
          className={`p-1 rounded cursor-pointer ${historyIndex === historyLen - 1 ? 'opacity-30' : 'hover:bg-[var(--color-bg-hover)]'}`}
          title="Redo"
        >
          <Redo2 size={13} />
        </span>

        <div className="h-4 w-px bg-[var(--color-border)]" />

        {/* Spin */}
        <span
          onClick={() => setSpinning(!isSpinning)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${isSpinning ? 'bg-blue-600 text-white' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}
        >
          {isSpinning ? <Pause size={10} /> : <Play size={10} />}
          {isSpinning ? 'Spin' : 'Stop'}
        </span>

        <span
          onClick={() => setView({ x: 0, y: 0, z: 0 })}
          className="p-1 hover:bg-[var(--color-bg-hover)] rounded cursor-pointer"
          title="Reset View"
        >
          <RefreshCw size={11} />
        </span>

        <div className="h-4 w-px bg-[var(--color-border)]" />

        {/* Views */}
        <div className="flex items-center gap-0.5">
          <Camera size={9} className="text-[var(--color-text-muted)] ml-0.5" />
          {[
            { l: 'F', r: { x: 0, y: 0, z: 0 } },
            { l: 'B', r: { x: 0, y: TAU / 2, z: 0 } },
            { l: 'T', r: { x: TAU / 4, y: 0, z: 0 } },
            { l: 'L', r: { x: 0, y: TAU / 4, z: 0 } },
            { l: 'R', r: { x: 0, y: -TAU / 4, z: 0 } },
          ].map((v) => (
            <span
              key={v.l}
              onClick={() => {
                setView(v.r)
                setSpinning(false)
              }}
              className="px-1 py-0.5 hover:bg-[var(--color-bg-hover)] rounded text-[10px] font-bold cursor-pointer"
              title={v.l}
            >
              {v.l}
            </span>
          ))}
        </div>

        {/* Rotation */}
        <div className="flex items-center gap-0.5">
          <RotateCcw size={9} className="text-[var(--color-text-muted)]" />
          {[
            { l: '+90', d: TAU / 4 },
            { l: '-90', d: -TAU / 4 },
            { l: '180', d: TAU / 2 },
          ].map((s) => (
            <span
              key={s.l}
              onClick={() => {
                if (illoRef.current) {
                  illoRef.current.rotate.y += s.d
                  illoRef.current.updateRenderGraph()
                }
              }}
              className="px-1 py-0.5 hover:bg-[var(--color-bg-hover)] rounded text-[10px] font-bold cursor-pointer"
            >
              {s.l}°
            </span>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 ml-1">
          <span className="text-[10px] text-[var(--color-text-muted)] font-bold">Z</span>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={scene.zoom}
            onChange={(e) => pushToHistory({ ...scene, zoom: parseFloat(e.target.value) })}
            className="w-14 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{scene.zoom}x</span>
        </div>

        <div className="flex-1" />

        <span
          onClick={() => setShowCode(true)}
          className="flex items-center gap-1 px-2 py-0.5 bg-[var(--color-bg-hover)] hover:bg-[var(--color-border)] rounded text-[11px] font-medium cursor-pointer"
        >
          <Download size={11} /> Export
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 bg-[#111] relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full cursor-move" />
        <div className="absolute bottom-2 left-2 text-[8px] text-[var(--color-text-muted)] font-mono space-y-0.5 opacity-60">
          <div>
            ZOOM: {scene.zoom}x | SHAPES: {scene.shapes.length}
          </div>
          <div>DRAG TO ROTATE</div>
        </div>
      </div>

      {/* Code export overlay */}
      {showCode && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-[var(--color-bg-secondary)] w-full max-w-2xl rounded-lg border border-[var(--color-border)] flex flex-col max-h-full">
            <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="font-bold text-sm">Zdog Code Export</span>
              <span onClick={() => setShowCode(false)} className="cursor-pointer hover:text-white">
                <X size={16} />
              </span>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[12px] font-mono text-blue-300 bg-[#111]">
              {generateZdogCode(scene.shapes, scene.zoom)}
            </pre>
            <div className="p-3 border-t border-[var(--color-border)] flex justify-end gap-2">
              <span
                onClick={() => navigator.clipboard.writeText(generateZdogCode(scene.shapes, scene.zoom))}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-[12px] font-bold cursor-pointer"
              >
                Copy
              </span>
              <span
                onClick={() => setShowCode(false)}
                className="px-3 py-1.5 bg-[var(--color-bg-hover)] rounded text-[12px] font-bold cursor-pointer"
              >
                Close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

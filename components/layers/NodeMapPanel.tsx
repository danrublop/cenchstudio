'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import type { Scene, InteractionElement } from '@/lib/types'
import type { LayerStackKey } from '@/lib/layer-stack-keys'
import type { SceneElement } from '@/lib/types/elements'
import { useVideoStore } from '@/lib/store'
import { requestElementsFromIframe } from '@/lib/scene-patcher'
import NodeMapCanvas, { buildNodeList, ADD_NODE_TYPES, type NodeMapKey } from './NodeMapCanvas'
import NodeMapControls from './NodeMapControls'
import SceneLayersStackPanel from './SceneLayersStackPanel'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  scene: Scene
}

export default function NodeMapPanel({ scene }: Props) {
  // false = show full layer stack, true = drilled into node map view
  const [drilled, setDrilled] = useState(false)
  const [selectedKey, setSelectedKey] = useState<NodeMapKey | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())
  const [showAddMenu, setShowAddMenu] = useState(false)
  const refMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const updateScene = useVideoStore((s) => s.updateScene)
  const addTextOverlay = useVideoStore((s) => s.addTextOverlay)

  const nodes = useMemo(() => buildNodeList(scene), [scene])

  // ── Element discovery from iframe (for rx: node editing) ──
  const [iframeElements, setIframeElements] = useState<Record<string, SceneElement>>({})

  useEffect(() => {
    if (!drilled) return
    // Request elements from scene iframe
    const iframe = document.querySelector(`iframe[data-scene-id="${scene.id}"]`) as HTMLIFrameElement | null
    if (iframe) requestElementsFromIframe(iframe)

    // Listen for response
    const handler = (e: MessageEvent) => {
      if (e.data?.source !== 'cench-scene' || e.data?.type !== 'elements_list') return
      if (e.data.sceneId && e.data.sceneId !== scene.id) return
      setIframeElements(e.data.elements ?? {})
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [drilled, scene.id])

  const registerRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) refMap.current.set(key, el)
    else refMap.current.delete(key)
  }, [])

  const onToggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const onSelectNode = useCallback((key: NodeMapKey) => {
    setSelectedKey(key)
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    requestAnimationFrame(() => {
      const el = refMap.current.get(key)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  // Double-click a layer in the stack → drill into node map with that layer expanded
  const handleLayerDoubleClick = useCallback((key: LayerStackKey) => {
    setDrilled(true)
    setSelectedKey(key)
    setExpandedKeys(new Set([key]))
  }, [])

  // Double-click a scene row → drill into that scene's node map
  const handleSceneDoubleClick = useCallback((_sceneId: string) => {
    setDrilled(true)
    setSelectedKey(null)
    setExpandedKeys(new Set())
  }, [])

  // Back to full stack view
  const handleBack = useCallback(() => {
    setDrilled(false)
    setSelectedKey(null)
    setExpandedKeys(new Set())
  }, [])

  const onAddNode = useCallback(
    (type: string) => {
      switch (type) {
        case 'text':
          addTextOverlay(scene.id)
          break
        case 'ai': {
          const layer = {
            id: uuidv4(),
            type: 'image' as const,
            label: 'New AI Image',
            prompt: '',
            src: null,
            x: 10,
            y: 10,
            width: 30,
            height: 30,
            opacity: 1,
            zIndex: (scene.aiLayers?.length ?? 0) + 1,
            startAt: 0,
          }
          updateScene(scene.id, { aiLayers: [...(scene.aiLayers ?? []), layer as any] })
          break
        }
        case 'chart': {
          const chart = {
            id: uuidv4(),
            name: 'New Chart',
            chartType: 'bar' as const,
            data: [],
            config: {},
            layout: { x: 10, y: 10, width: 50, height: 40 },
            timing: { startAt: 0, duration: scene.duration, animated: true },
          }
          updateScene(scene.id, { chartLayers: [...(scene.chartLayers ?? []), chart as any] })
          break
        }
        case 'interaction': {
          const ix: InteractionElement = {
            id: uuidv4(),
            type: 'hotspot',
            label: 'New Hotspot',
            x: 50,
            y: 50,
            width: 10,
            height: 10,
            shape: 'circle',
            style: 'pulse',
            color: '#e84545',
            appearsAt: 0,
            hidesAt: null,
            entranceAnimation: 'fade',
          } as any
          updateScene(scene.id, { interactions: [...(scene.interactions ?? []), ix] })
          break
        }
        case 'physics': {
          const phys = {
            id: uuidv4(),
            name: 'New Physics',
            simulation: 'pendulum' as const,
            layout: 'split' as const,
            params: {},
            equations: [],
            title: '',
            narration: '',
          }
          updateScene(scene.id, { physicsLayers: [...(scene.physicsLayers ?? []), phys as any] })
          break
        }
        case 'svg': {
          const obj = {
            id: uuidv4(),
            prompt: '',
            svgContent: '<svg></svg>',
            x: 50,
            y: 50,
            width: 20,
            opacity: 1,
            zIndex: (scene.svgObjects?.length ?? 0) + 1,
          }
          updateScene(scene.id, { svgObjects: [...(scene.svgObjects ?? []), obj as any] })
          break
        }
      }
    },
    [scene, updateScene, addTextOverlay],
  )

  // ── Stack view (default) ──────────────────────────────────────────────────
  if (!drilled) {
    return (
      <SceneLayersStackPanel
        scene={scene}
        onLayerDoubleClick={handleLayerDoubleClick}
        onSceneDoubleClick={handleSceneDoubleClick}
        fillAvailableHeight
      />
    )
  }

  // ── Drilled-in view (node map + controls) ─────────────────────────────────
  return (
    <div className="flex flex-col" style={{ minHeight: 300 }}>
      <NodeMapCanvas
        scene={scene}
        nodes={nodes}
        selectedKey={selectedKey}
        onSelect={onSelectNode}
        onAddNode={onAddNode}
      />

      {/* Header between canvas and layer rows */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--color-hairline)', borderTop: '1px solid var(--color-hairline)' }}
      >
        <span
          role="button"
          tabIndex={0}
          className="flex items-center justify-center w-7 h-7 rounded text-[var(--color-text-muted)] hover:text-[var(--kbd-text)] hover:bg-[var(--color-panel)]/50 cursor-pointer transition-all outline-none shrink-0"
          onClick={handleBack}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleBack()
          }}
          title="Back to layers"
        >
          <ArrowLeft size={16} />
        </span>
        <span className="flex-1 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-[var(--agent-chat-user-surface)] truncate select-none">
          {scene.name || 'Scene'}
        </span>
        <div className="relative">
          <span
            role="button"
            tabIndex={0}
            className="flex items-center justify-center w-8 h-8 rounded text-[var(--color-text-muted)] hover:text-[var(--kbd-text)] hover:bg-[var(--color-panel)]/50 cursor-pointer transition-all outline-none"
            onClick={() => setShowAddMenu((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setShowAddMenu((v) => !v)
            }}
          >
            <Plus size={20} />
          </span>
          {showAddMenu && (
            <div
              className="absolute top-8 right-0 rounded-lg border py-1 shadow-xl z-20"
              style={{
                background: 'var(--color-bg-surface, var(--color-bg))',
                borderColor: 'var(--color-border)',
                minWidth: 140,
              }}
            >
              {ADD_NODE_TYPES.map((t) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  className="px-3 py-1.5 text-[11px] cursor-pointer hover:bg-white/[0.06]"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => {
                    onAddNode(t.id)
                    setShowAddMenu(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onAddNode(t.id)
                      setShowAddMenu(false)
                    }
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <NodeMapControls
        scene={scene}
        selectedKey={selectedKey}
        expandedKeys={expandedKeys}
        onToggleExpand={onToggleExpand}
        registerRef={registerRef}
        iframeElements={iframeElements}
      />
    </div>
  )
}

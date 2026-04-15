'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  MiniMapNode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  BaseEdge,
  getSmoothStepPath,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useVideoStore } from '@/lib/store'
import type { Scene, SceneEdge, SceneNode } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'
import TimelineControls from './timeline/TimelineControls'

// ── Constants ────────────────────────────────────────────────────────────────

const CHILD_X_OFFSET = 240
const CHILD_Y_SPACING = 64
const CHILD_Y_START = -20 // center children around scene node

const NODE_COLORS = {
  layer: '#3b82f6',
  text: '#eab308',
  audio: '#22c55e',
  interaction: '#a855f7',
  media: '#f97316',
  scene: '#6b6b7a',
} as const

// ── Custom Node: Scene ───────────────────────────────────────────────────────

function SceneFlowNode({ data }: { data: { scene: Scene; isStart: boolean; isEnd: boolean; isExpanded: boolean; onToggleExpand: () => void } }) {
  const { scene, isStart, isEnd, isExpanded, onToggleExpand } = data
  const hasContent =
    scene.svgContent || scene.canvasCode || scene.canvasBackgroundCode?.trim() || scene.sceneCode || scene.lottieSource || scene.reactCode

  return (
    <div
      className="relative rounded-lg border-2 overflow-hidden select-none"
      style={{
        width: 172,
        borderColor: isStart ? '#22c55e' : isEnd ? '#ef4444' : 'var(--color-border)',
        background: 'var(--color-panel)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.scene, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#e84545', width: 8, height: 8 }} />

      {/* Thumbnail */}
      <div
        className="w-full flex items-center justify-center overflow-hidden"
        style={{ height: 72, background: scene.bgColor || '#1a1a1f' }}
      >
        {scene.thumbnail ? (
          <img src={scene.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : hasContent ? (
          <span className="text-[11px] text-[var(--color-text-muted)]">No preview</span>
        ) : (
          <span className="text-[11px] text-[#3a3a45]">Empty scene</span>
        )}
      </div>

      {/* Info */}
      <div className="px-2 py-1.5 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: '#e84545', color: 'white' }}
          >
            {scene.sceneType}
          </span>
          <div className="flex items-center gap-1">
            {isStart && <span className="w-2 h-2 rounded-full bg-green-500" title="Start" />}
            {isEnd && <span className="w-2 h-2 rounded-full bg-red-500" title="End" />}
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-text-primary)] font-medium truncate">
          {scene.name || scene.prompt.slice(0, 30) || 'Untitled Scene'}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[var(--color-text-muted)]">{scene.duration}s</p>
          <span
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:bg-white/10"
            style={{ color: isExpanded ? '#e84545' : 'var(--color-text-muted)' }}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Custom Node: Layer ───────────────────────────────────────────────────────

function LayerNode({ data }: { data: { label: string; layerType: string; sceneId: string } }) {
  return (
    <div
      className="rounded-md border overflow-hidden select-none"
      style={{
        width: 140,
        borderColor: NODE_COLORS.layer,
        background: 'var(--color-panel)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.layer, width: 7, height: 7 }} />
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0"
            style={{ background: NODE_COLORS.layer, color: 'white' }}
          >
            {data.layerType}
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-primary)] mt-0.5 truncate">{data.label}</p>
      </div>
    </div>
  )
}

// ── Custom Node: Text ────────────────────────────────────────────────────────

function TextNode({ data }: { data: { content: string; overlayId: string; sceneId: string } }) {
  return (
    <div
      className="rounded-md border overflow-hidden select-none"
      style={{
        width: 140,
        borderColor: NODE_COLORS.text,
        background: 'var(--color-panel)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.text, width: 7, height: 7 }} />
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: NODE_COLORS.text, color: '#1a1a1f' }}
          >
            Text
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-primary)] mt-0.5 truncate">{data.content}</p>
      </div>
    </div>
  )
}

// ── Custom Node: Audio ───────────────────────────────────────────────────────

function AudioNode({ data }: { data: { audioType: string; label: string; sceneId: string } }) {
  return (
    <div
      className="rounded-md border overflow-hidden select-none"
      style={{
        width: 140,
        borderColor: NODE_COLORS.audio,
        background: 'var(--color-panel)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.audio, width: 7, height: 7 }} />
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: NODE_COLORS.audio, color: 'white' }}
          >
            {data.audioType}
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-primary)] mt-0.5 truncate">{data.label}</p>
      </div>
    </div>
  )
}

// ── Custom Node: Interaction ─────────────────────────────────────────────────

function InteractionNode({ data }: { data: { interactionType: string; label: string; elementId: string; sceneId: string } }) {
  return (
    <div
      className="rounded-md border overflow-hidden select-none"
      style={{
        width: 140,
        borderColor: NODE_COLORS.interaction,
        background: 'var(--color-panel)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.interaction, width: 7, height: 7 }} />
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: NODE_COLORS.interaction, color: 'white' }}
          >
            {data.interactionType}
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-primary)] mt-0.5 truncate">{data.label}</p>
      </div>
    </div>
  )
}

// ── Custom Node: Media (AI Layers) ───────────────────────────────────────────

function MediaNode({ data }: { data: { mediaType: string; label: string; layerId: string; sceneId: string } }) {
  return (
    <div
      className="rounded-md border overflow-hidden select-none"
      style={{
        width: 140,
        borderColor: NODE_COLORS.media,
        background: 'var(--color-panel)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: NODE_COLORS.media, width: 7, height: 7 }} />
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: NODE_COLORS.media, color: 'white' }}
          >
            {data.mediaType}
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-primary)] mt-0.5 truncate">{data.label}</p>
      </div>
    </div>
  )
}

// ── Custom Edge: Composition (dashed, animated) ──────────────────────────────

function CompositionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: any) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 8,
  })
  const color = (data?.color as string) || NODE_COLORS.scene
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: color,
        strokeWidth: 1.5,
        strokeDasharray: '6 4',
        opacity: 0.7,
      }}
    />
  )
}

// ── Node / Edge type registrations ───────────────────────────────────────────

const nodeTypes: NodeTypes = {
  sceneNode: SceneFlowNode,
  layerNode: LayerNode,
  textNode: TextNode,
  audioNode: AudioNode,
  interactionNode: InteractionNode,
  mediaNode: MediaNode,
}

const edgeTypes: EdgeTypes = {
  composition: CompositionEdge,
}

// ── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number
  y: number
  sceneId: string
  nodeType: 'scene' | 'layer' | 'text' | 'audio' | 'interaction' | 'media'
  elementId?: string
}

function GraphContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const {
    addTextOverlay,
    removeTextOverlay,
    removeInteraction,
    selectScene,
    toggleGraphSceneExpanded,
    graphExpandedScenes,
  } = useVideoStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  const isExpanded = graphExpandedScenes.includes(menu.sceneId)

  const items: { label: string; action: () => void; danger?: boolean }[] = []

  if (menu.nodeType === 'scene') {
    items.push({
      label: isExpanded ? 'Collapse' : 'Expand layers',
      action: () => { toggleGraphSceneExpanded(menu.sceneId); onClose() },
    })
    items.push({
      label: 'Add Text Overlay',
      action: () => { addTextOverlay(menu.sceneId); if (!isExpanded) toggleGraphSceneExpanded(menu.sceneId); onClose() },
    })
    items.push({
      label: 'Select Scene',
      action: () => { selectScene(menu.sceneId); onClose() },
    })
  } else if (menu.nodeType === 'text' && menu.elementId) {
    items.push({
      label: 'Delete Text Overlay',
      danger: true,
      action: () => { removeTextOverlay(menu.sceneId, menu.elementId!); onClose() },
    })
    items.push({
      label: 'Edit in Inspector',
      action: () => { selectScene(menu.sceneId); onClose() },
    })
  } else if (menu.nodeType === 'interaction' && menu.elementId) {
    items.push({
      label: 'Delete Interaction',
      danger: true,
      action: () => { removeInteraction(menu.sceneId, menu.elementId!); onClose() },
    })
    items.push({
      label: 'Edit in Inspector',
      action: () => { selectScene(menu.sceneId); onClose() },
    })
  } else {
    items.push({
      label: 'Edit in Inspector',
      action: () => { selectScene(menu.sceneId); onClose() },
    })
  }

  return (
    <div
      ref={ref}
      className="fixed rounded-lg border overflow-hidden z-[200] py-1"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'var(--color-panel)',
        borderColor: 'var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        minWidth: 160,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          onClick={item.action}
          className="px-3 py-1.5 text-[11px] cursor-pointer transition-colors hover:bg-white/[0.08]"
          style={{ color: item.danger ? '#ef4444' : 'var(--color-text-primary)' }}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}

// ── Minimap node ─────────────────────────────────────────────────────────────

type SceneNodeData = { scene: Scene; isStart: boolean; isEnd: boolean; isExpanded: boolean; onToggleExpand: () => void }

function SceneMiniMapNode(props: ComponentProps<typeof MiniMapNode>) {
  return <MiniMapNode {...props} strokeWidth={props.selected ? 2.75 : 1.65} />
}

// ── Derive child nodes + edges for an expanded scene ─────────────────────────

function deriveChildNodesAndEdges(scene: Scene, scenePos: { x: number; y: number }): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let yOffset = CHILD_Y_START

  const addChild = (id: string, type: string, data: Record<string, any>, color: string) => {
    nodes.push({
      id,
      type,
      position: { x: scenePos.x + CHILD_X_OFFSET, y: scenePos.y + yOffset },
      draggable: false,
      selectable: true,
      data,
    })
    edges.push({
      id: `e-${scene.id}-${id}`,
      source: scene.id,
      target: id,
      type: 'composition',
      data: { color },
    })
    yOffset += CHILD_Y_SPACING
  }

  // Layer nodes — one per code type that has content
  const codeLayers: { type: string; label: string; hasContent: boolean }[] = [
    { type: 'react', label: 'React Component', hasContent: !!scene.reactCode },
    { type: 'canvas2d', label: 'Canvas2D', hasContent: !!scene.canvasCode },
    { type: 'svg', label: 'SVG', hasContent: !!scene.svgContent },
    { type: 'three', label: 'Three.js', hasContent: !!scene.sceneCode && scene.sceneType === 'three' },
    { type: 'motion', label: 'Motion/HTML', hasContent: !!scene.sceneCode && scene.sceneType === 'motion' },
    { type: 'd3', label: 'D3 Data Viz', hasContent: !!scene.sceneCode && scene.sceneType === 'd3' },
    { type: 'lottie', label: 'Lottie', hasContent: !!scene.lottieSource },
    { type: 'canvas-bg', label: 'Canvas BG', hasContent: !!scene.canvasBackgroundCode?.trim() },
  ]

  for (const layer of codeLayers) {
    if (layer.hasContent) {
      addChild(`${scene.id}-layer-${layer.type}`, 'layerNode', {
        label: layer.label,
        layerType: layer.type,
        sceneId: scene.id,
      }, NODE_COLORS.layer)
    }
  }

  // Text overlays
  for (const overlay of scene.textOverlays ?? []) {
    addChild(`${scene.id}-text-${overlay.id}`, 'textNode', {
      content: overlay.content,
      overlayId: overlay.id,
      sceneId: scene.id,
    }, NODE_COLORS.text)
  }

  // Audio tracks
  if (scene.audioLayer?.tts?.text) {
    addChild(`${scene.id}-audio-tts`, 'audioNode', {
      audioType: 'TTS',
      label: scene.audioLayer.tts.text.slice(0, 40),
      sceneId: scene.id,
    }, NODE_COLORS.audio)
  }
  if (scene.audioLayer?.music?.src) {
    addChild(`${scene.id}-audio-music`, 'audioNode', {
      audioType: 'Music',
      label: scene.audioLayer.music.name || 'Music track',
      sceneId: scene.id,
    }, NODE_COLORS.audio)
  }
  for (const sfx of scene.audioLayer?.sfx ?? []) {
    addChild(`${scene.id}-audio-sfx-${sfx.id}`, 'audioNode', {
      audioType: 'SFX',
      label: sfx.name || sfx.src || 'Sound effect',
      sceneId: scene.id,
    }, NODE_COLORS.audio)
  }

  // Interactions
  for (const interaction of scene.interactions ?? []) {
    addChild(`${scene.id}-interaction-${interaction.id}`, 'interactionNode', {
      interactionType: interaction.type,
      label: ('label' in interaction ? (interaction as any).label : null) || interaction.type,
      elementId: interaction.id,
      sceneId: scene.id,
    }, NODE_COLORS.interaction)
  }

  // AI Layers (avatar, veo3, image, sticker)
  for (const aiLayer of scene.aiLayers ?? []) {
    addChild(`${scene.id}-media-${aiLayer.id}`, 'mediaNode', {
      mediaType: aiLayer.type,
      label: aiLayer.type === 'avatar' ? 'Avatar' : aiLayer.type === 'veo3' ? 'Veo3 Video' : aiLayer.type === 'image' ? 'AI Image' : 'Sticker',
      layerId: aiLayer.id,
      sceneId: scene.id,
    }, NODE_COLORS.media)
  }

  return { nodes, edges }
}

// ── GraphContent ─────────────────────────────────────────────────────────────

function GraphContent() {
  const {
    scenes,
    project,
    updateSceneGraph,
    selectScene,
    selectedSceneId,
    graphExpandedScenes,
    toggleGraphSceneExpanded,
  } = useVideoStore()
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Derive all nodes (scene + children for expanded scenes)
  const { initialNodes, initialEdges } = useMemo(() => {
    const allNodes: Node[] = []
    const allEdges: Edge[] = []

    for (const n of project.sceneGraph.nodes) {
      const scene = scenes.find((s) => s.id === n.id)
      if (!scene) continue

      const hasOutgoing = project.sceneGraph.edges.some((e) => e.fromSceneId === n.id)
      const isStart = project.sceneGraph.startSceneId === n.id
      const isEnd = !hasOutgoing
      const isExpanded = graphExpandedScenes.includes(n.id)

      allNodes.push({
        id: n.id,
        type: 'sceneNode',
        position: n.position,
        selected: n.id === selectedSceneId,
        data: {
          scene,
          isStart,
          isEnd,
          isExpanded,
          onToggleExpand: () => toggleGraphSceneExpanded(n.id),
        } satisfies SceneNodeData,
      })

      // Child nodes for expanded scenes
      if (isExpanded) {
        const { nodes: childNodes, edges: childEdges } = deriveChildNodesAndEdges(scene, n.position)
        allNodes.push(...childNodes)
        allEdges.push(...childEdges)
      }
    }

    // Scene-to-scene flow edges
    for (const e of project.sceneGraph.edges) {
      allEdges.push({
        id: e.id,
        source: e.fromSceneId,
        target: e.toSceneId,
        label: e.condition.type,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b6b7a' },
        style: { stroke: '#6b6b7a', strokeWidth: 2 },
        labelStyle: { fill: '#9b9ba8', fontSize: 10 },
        labelBgStyle: { fill: 'transparent' },
      })
    }

    return { initialNodes: allNodes, initialEdges: allEdges }
  }, [scenes, project.sceneGraph, selectedSceneId, graphExpandedScenes, toggleGraphSceneExpanded])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  useEffect(() => { setEdges(initialEdges) }, [initialEdges, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: SceneEdge = {
        id: uuidv4(),
        fromSceneId: connection.source ?? '',
        toSceneId: connection.target ?? '',
        condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
      }
      updateSceneGraph({
        ...project.sceneGraph,
        edges: [...project.sceneGraph.edges, newEdge],
      })
    },
    [project.sceneGraph, updateSceneGraph],
  )

  // Only persist position changes for scene nodes (not child nodes)
  const onNodesChangeWithPersist = useCallback(
    (changes: any) => {
      onNodesChange(changes)
      const posChanges = changes.filter(
        (c: any) => c.type === 'position' && c.dragging === false,
      )
      if (posChanges.length === 0) return

      // Filter to only scene-level nodes (IDs that match scene IDs, not compound child IDs)
      const sceneNodeIds = new Set(project.sceneGraph.nodes.map((n) => n.id))
      const scenePositionChanges = posChanges.filter((c: any) => sceneNodeIds.has(c.id))
      if (scenePositionChanges.length === 0) return

      const updatedNodes: SceneNode[] = project.sceneGraph.nodes.map((n) => {
        const change = scenePositionChanges.find((c: any) => c.id === n.id)
        if (change?.position) return { ...n, position: change.position }
        return n
      })
      updateSceneGraph({ ...project.sceneGraph, nodes: updatedNodes })
    },
    [onNodesChange, project.sceneGraph, updateSceneGraph],
  )

  const onEdgesChangeWithPersist = useCallback(
    (changes: any) => {
      onEdgesChange(changes)
      const removals = changes.filter((c: any) => c.type === 'remove')
      if (removals.length === 0) return
      const removedIds = new Set(removals.map((c: any) => c.id))
      // Only remove scene-to-scene edges from persisted graph
      const persistedEdgeIds = new Set(project.sceneGraph.edges.map((e) => e.id))
      const hasPersistedRemovals = removals.some((c: any) => persistedEdgeIds.has(c.id))
      if (!hasPersistedRemovals) return
      updateSceneGraph({
        ...project.sceneGraph,
        edges: project.sceneGraph.edges.filter((e) => !removedIds.has(e.id)),
      })
    },
    [onEdgesChange, project.sceneGraph, updateSceneGraph],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Extract scene ID from child node IDs (format: sceneId-type-elementId)
      const sceneNodeIds = new Set(scenes.map((s) => s.id))
      if (sceneNodeIds.has(node.id)) {
        selectScene(node.id)
      } else {
        // Child node — extract scene ID (first segment before first hyphen that matches a scene)
        for (const scene of scenes) {
          if (node.id.startsWith(scene.id + '-')) {
            selectScene(scene.id)
            break
          }
        }
      }
    },
    [selectScene, scenes],
  )

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault()
      let nodeType: ContextMenuState['nodeType'] = 'scene'
      let sceneId = node.id
      let elementId: string | undefined

      const sceneNodeIds = new Set(scenes.map((s) => s.id))
      if (!sceneNodeIds.has(node.id)) {
        // Child node
        for (const scene of scenes) {
          if (node.id.startsWith(scene.id + '-')) {
            sceneId = scene.id
            const suffix = node.id.slice(scene.id.length + 1)
            if (suffix.startsWith('layer-')) nodeType = 'layer'
            else if (suffix.startsWith('text-')) { nodeType = 'text'; elementId = suffix.replace('text-', '') }
            else if (suffix.startsWith('audio-')) nodeType = 'audio'
            else if (suffix.startsWith('interaction-')) { nodeType = 'interaction'; elementId = suffix.replace('interaction-', '') }
            else if (suffix.startsWith('media-')) { nodeType = 'media'; elementId = suffix.replace('media-', '') }
            break
          }
        }
      }

      setContextMenu({ x: e.clientX, y: e.clientY, sceneId, nodeType, elementId })
    },
    [scenes],
  )

  const onPaneClick = useCallback(() => setContextMenu(null), [])

  // Minimap colors
  const minimapNodeColor = useCallback(
    (node: Node) => {
      if (node.type === 'layerNode') return NODE_COLORS.layer
      if (node.type === 'textNode') return NODE_COLORS.text
      if (node.type === 'audioNode') return NODE_COLORS.audio
      if (node.type === 'interactionNode') return NODE_COLORS.interaction
      if (node.type === 'mediaNode') return NODE_COLORS.media
      // Scene node
      const d = node.data as SceneNodeData
      const sel = node.id === selectedSceneId
      if (sel) return 'rgba(232, 69, 69, 0.42)'
      if (d?.isStart) return '#166534'
      if (d?.isEnd) return '#991b1b'
      return 'var(--minimap-node-fill, #3f3f48)'
    },
    [selectedSceneId],
  )

  const minimapNodeStrokeColor = useCallback(
    (node: Node) => {
      if (node.type && node.type !== 'sceneNode') {
        return (NODE_COLORS as any)[node.type.replace('Node', '')] || '#6b6b7a'
      }
      const d = node.data as SceneNodeData
      const sel = node.id === selectedSceneId
      if (sel) return 'var(--color-accent, #e84545)'
      if (d?.isStart) return '#4ade80'
      if (d?.isEnd) return '#fca5a5'
      return 'var(--minimap-node-stroke, rgba(107, 107, 122, 0.55))'
    },
    [selectedSceneId],
  )

  const onMiniMapNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const sceneNodeIds = new Set(scenes.map((s) => s.id))
      if (sceneNodeIds.has(node.id)) selectScene(node.id)
      else {
        for (const scene of scenes) {
          if (node.id.startsWith(scene.id + '-')) { selectScene(scene.id); break }
        }
      }
    },
    [selectScene, scenes],
  )

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--color-timeline-bg, var(--color-bg))' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithPersist}
        onEdgesChange={onEdgesChangeWithPersist}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="#222230" gap={24} size={1.5} />
        <TimelineControls
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitAll={() => fitView({ padding: 0.2, duration: 400 })}
        />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          zoomStep={12}
          ariaLabel="Scene graph overview — drag to pan the view, scroll to zoom"
          className="!m-2 !rounded-md !border !border-[var(--color-border)] !shadow-md"
          style={{
            width: 200,
            height: 132,
            background: 'var(--color-panel)',
          }}
          bgColor="var(--color-panel)"
          maskColor="var(--minimap-mask)"
          maskStrokeColor="var(--color-accent)"
          maskStrokeWidth={1.5}
          offsetScale={6}
          nodeColor={minimapNodeColor}
          nodeStrokeColor={minimapNodeStrokeColor}
          nodeBorderRadius={4}
          nodeStrokeWidth={1.65}
          nodeComponent={SceneMiniMapNode}
          onNodeClick={onMiniMapNodeClick}
        />
      </ReactFlow>

      {contextMenu && (
        <GraphContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function SceneGraphEditor() {
  return (
    <ReactFlowProvider>
      <GraphContent />
    </ReactFlowProvider>
  )
}

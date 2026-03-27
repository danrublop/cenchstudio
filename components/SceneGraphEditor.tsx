'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useVideoStore } from '@/lib/store'
import type { Scene, SceneEdge, SceneNode } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'
import TimelineControls from './timeline/TimelineControls'

// ── Custom scene node ─────────────────────────────────────────────────────────

function SceneFlowNode({ data }: { data: { scene: Scene; isStart: boolean; isEnd: boolean } }) {
  const { scene, isStart, isEnd } = data
  const hasContent = scene.svgContent || scene.canvasCode || scene.sceneCode || scene.lottieSource

  return (
    <div
      className="relative rounded-lg border-2 overflow-hidden select-none"
      style={{
        width: 160,
        borderColor: isStart ? '#22c55e' : isEnd ? '#ef4444' : 'var(--color-border)',
        background: 'var(--color-panel)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#6b6b7a', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#e84545', width: 8, height: 8 }} />

      {/* Thumbnail */}
      <div
        className="w-full flex items-center justify-center overflow-hidden"
        style={{ height: 72, background: scene.bgColor || '#1a1a1f' }}
      >
        {scene.thumbnail ? (
          <img src={scene.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : hasContent ? (
          <span className="text-[10px] text-[var(--color-text-muted)]">No preview</span>
        ) : (
          <span className="text-[10px] text-[#3a3a45]">Empty scene</span>
        )}
      </div>

      {/* Info */}
      <div className="px-2 py-1.5 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: '#e84545', color: 'white' }}
          >
            {scene.sceneType}
          </span>
          <div className="flex items-center gap-1">
            {isStart && <span className="w-2 h-2 rounded-full bg-green-500" title="Start" />}
            {isEnd && <span className="w-2 h-2 rounded-full bg-red-500" title="End" />}
          </div>
        </div>
        <p className="text-[10px] text-[var(--color-text-primary)] font-medium truncate">
          {scene.name || scene.prompt.slice(0, 30) || 'Untitled Scene'}
        </p>
        <p className="text-[9px] text-[var(--color-text-muted)]">{scene.duration}s</p>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { sceneNode: SceneFlowNode }

// ── GraphContent ──────────────────────────────────────────────────────────

function GraphContent() {
  const { scenes, project, updateSceneGraph, selectScene } = useVideoStore()
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  // Derive nodes from scene graph
  const initialNodes: Node[] = useMemo(() => {
    return project.sceneGraph.nodes.map((n) => {
      const scene = scenes.find((s) => s.id === n.id)
      if (!scene) return null
      const hasOutgoing = project.sceneGraph.edges.some((e) => e.fromSceneId === n.id)
      const isStart = project.sceneGraph.startSceneId === n.id
      const isEnd = !hasOutgoing
      return {
        id: n.id,
        type: 'sceneNode',
        position: n.position,
        data: { scene, isStart, isEnd },
      }
    }).filter(Boolean) as Node[]
  }, [scenes, project.sceneGraph])

  // Derive edges from scene graph
  const initialEdges: Edge[] = useMemo(() => {
    return project.sceneGraph.edges.map((e) => ({
      id: e.id,
      source: e.fromSceneId,
      target: e.toSceneId,
      label: e.condition.type,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b6b7a' },
      style: { stroke: '#6b6b7a', strokeWidth: 2 },
      labelStyle: { fill: '#9b9ba8', fontSize: 10 },
      labelBgStyle: { fill: 'transparent' },
    }))
  }, [project.sceneGraph.edges])

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
      const newGraph = {
        ...project.sceneGraph,
        edges: [...project.sceneGraph.edges, newEdge],
      }
      updateSceneGraph(newGraph)
    },
    [project.sceneGraph, updateSceneGraph]
  )

  const onNodesChangeWithPersist = useCallback(
    (changes: any) => {
      onNodesChange(changes)
      const posChanges = changes.filter((c: any) => c.type === 'position' && c.dragging === false)
      if (posChanges.length === 0) return
      const updatedNodes: SceneNode[] = project.sceneGraph.nodes.map((n) => {
        const change = posChanges.find((c: any) => c.id === n.id)
        if (change?.position) return { ...n, position: change.position }
        return n
      })
      updateSceneGraph({ ...project.sceneGraph, nodes: updatedNodes })
    },
    [onNodesChange, project.sceneGraph, updateSceneGraph]
  )

  const onEdgesChangeWithPersist = useCallback(
    (changes: any) => {
      onEdgesChange(changes)
      const removals = changes.filter((c: any) => c.type === 'remove')
      if (removals.length === 0) return
      const removedIds = new Set(removals.map((c: any) => c.id))
      updateSceneGraph({
        ...project.sceneGraph,
        edges: project.sceneGraph.edges.filter((e) => !removedIds.has(e.id)),
      })
    },
    [onEdgesChange, project.sceneGraph, updateSceneGraph]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectScene(node.id)
    },
    [selectScene]
  )

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--color-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithPersist}
        onEdgesChange={onEdgesChangeWithPersist}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="#2a2a35" gap={20} />
        <TimelineControls
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitAll={() => fitView({ padding: 0.2, duration: 400 })}
        />
        <MiniMap
          style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)' }}
          nodeColor="#e84545"
          maskColor="rgba(0,0,0,0.4)"
        />
      </ReactFlow>
    </div>
  )
}

export default function SceneGraphEditor() {
  return (
    <ReactFlowProvider>
      <GraphContent />
    </ReactFlowProvider>
  )
}

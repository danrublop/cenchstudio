'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRightLeft,
  Box,
  Camera,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Minus,
  Music,
  Paintbrush,
  Plus,
  Type,
  User,
  Variable,
  Volume2,
} from 'lucide-react'
import type { Scene } from '@/lib/types'
import type { LayerStackKey } from '@/lib/layer-stack-keys'
import { parseLayerStackKey } from '@/lib/layer-stack-keys'
import {
  buildDefaultOrder,
  labelForKey,
  iconForKey,
  iconForSceneStackId,
  audioRowVisible,
} from './SceneLayersStackPanel'
import { extractElementsFromReactCode } from '@/lib/react-extract'

// ── Extended node types beyond LayerStackKey ─────────────────────────────────

export type NodeMapKey =
  | LayerStackKey
  | 'root'
  | 'camera'
  | 'transition'
  | 'style'
  | 'variables'
  | `tts`
  | `music`
  | `sfx:${string}`
  | `3d:${string}`
  | `rx:${string}`

export interface NodeMapEntry {
  key: NodeMapKey
  label: string
  kind: string
  ring: 'center' | 'inner' | 'outer'
  /** Category column for the hierarchical layout. */
  group: NodeGroup
}

export type NodeGroup = 'content' | 'text' | 'interaction' | 'bridge' | 'audio' | 'world' | 'meta'

const GROUP_ORDER: NodeGroup[] = ['content', 'text', 'interaction', 'bridge', 'audio', 'world', 'meta']

const GROUP_LABELS: Record<NodeGroup, string> = {
  content: 'Visual content',
  text: 'Text',
  interaction: 'Interactions',
  bridge: 'Bridges',
  audio: 'Audio',
  world: '3D world',
  meta: 'Scene props',
}

function groupForKind(kind: string): NodeGroup {
  if (kind === 'text' || kind === 'rx_heading' || kind === 'rx_paragraph' || kind === 'rx_text') return 'text'
  if (kind === 'interaction') return 'interaction'
  if (kind === 'tts' || kind === 'music' || kind === 'sfx' || kind === 'audio') return 'audio'
  if (kind === '3d_env' || kind === '3d_obj' || kind === '3d_panel' || kind === '3d_avatar' || kind === '3d_camera')
    return 'world'
  if (kind === 'camera' || kind === 'transition' || kind === 'style' || kind === 'variables' || kind === 'bg')
    return 'meta'
  if (kind === 'rx_three' || kind === 'rx_canvas2d' || kind === 'rx_d3' || kind === 'rx_svg' || kind === 'rx_lottie')
    return 'bridge'
  // svg, ai, chart, physics, video, rx_image → content column
  return 'content'
}

function sceneHasOwnBackground(scene: Scene): boolean {
  // 3D worlds + Three.js environment presets manage their own background/sky.
  // Don't surface the flat bg node in those contexts — it's misleading.
  if (scene.worldConfig) return true
  if (scene.threeEnvironmentPresetId) return true
  return false
}

// ── Color mapping per kind ───────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  root: '#e84545',
  ai: '#a855f7',
  svg: '#3b82f6',
  text: '#22c55e',
  chart: '#f97316',
  audio: '#eab308',
  tts: '#eab308',
  music: '#eab308',
  sfx: '#eab308',
  video: '#ec4899',
  bg: '#6b7280',
  scene: '#64748b',
  physics: '#06b6d4',
  interaction: '#f59e0b',
  camera: '#6366f1',
  transition: '#f43f5e',
  style: '#8b5cf6',
  variables: '#14b8a6',
  '3d_env': '#10b981',
  '3d_obj': '#8b5cf6',
  '3d_panel': '#f59e0b',
  '3d_avatar': '#ec4899',
  '3d_camera': '#6366f1',
  rx_three: '#8b5cf6',
  rx_canvas2d: '#06b6d4',
  rx_d3: '#f97316',
  rx_svg: '#3b82f6',
  rx_lottie: '#ec4899',
  rx_heading: '#22c55e',
  rx_paragraph: '#6b7280',
  rx_text: '#22c55e',
  rx_image: '#f59e0b',
}

function colorForKind(kind: string): string {
  return KIND_COLORS[kind] ?? '#6b7280'
}

// ── Build full node list ─────────────────────────────────────────────────────

export function buildNodeList(scene: Scene): NodeMapEntry[] {
  const nodes: NodeMapEntry[] = []
  const hasOwnBg = sceneHasOwnBackground(scene)

  const push = (entry: Omit<NodeMapEntry, 'group'>) => {
    nodes.push({ ...entry, group: groupForKind(entry.kind) })
  }

  const stackKeys = buildDefaultOrder(scene)
  for (const k of stackKeys) {
    const { kind } = parseLayerStackKey(k)
    if (k === 'audio') continue
    if (kind === 'rx') continue // handled by extraction loop below
    if (kind === 'bg' && hasOwnBg) continue // 3D worlds / env presets manage their own background
    push({
      key: k,
      label: labelForKey(scene, k),
      kind,
      ring: ['scene', 'bg', 'video'].includes(kind) ? 'inner' : 'outer',
    })
  }

  const a = scene.audioLayer
  if (a) {
    if (a.tts?.text?.trim() || a.tts?.status === 'generating' || a.tts?.status === 'ready') {
      const preview = (a.tts.text ?? '').trim().slice(0, 24)
      push({ key: 'tts', label: preview ? `TTS: ${preview}...` : 'TTS / Narration', kind: 'tts', ring: 'outer' })
    }
    if (a.music?.src) {
      push({ key: 'music', label: a.music.name || 'Music', kind: 'music', ring: 'outer' })
    }
    for (const s of a.sfx ?? []) {
      push({ key: `sfx:${s.id}` as NodeMapKey, label: s.name || 'SFX', kind: 'sfx', ring: 'outer' })
    }
    if (audioRowVisible(a) && nodes.every((n) => !['tts', 'music', 'sfx'].includes(n.kind))) {
      push({ key: 'audio' as NodeMapKey, label: 'Audio', kind: 'audio', ring: 'inner' })
    }
  }

  if (scene.cameraMotion?.length) {
    push({ key: 'camera', label: 'Camera Animation', kind: 'camera', ring: 'inner' })
  }
  if (scene.transition && scene.transition !== 'none') {
    push({ key: 'transition', label: `Transition: ${scene.transition}`, kind: 'transition', ring: 'inner' })
  }
  const so = scene.styleOverride
  if (so && (so.palette?.length || so.font || so.bgColor)) {
    push({ key: 'style', label: 'Style Override', kind: 'style', ring: 'inner' })
  }
  if (scene.variables?.length) {
    push({ key: 'variables', label: `Variables (${scene.variables.length})`, kind: 'variables', ring: 'outer' })
  }

  // 3D world sub-elements
  if (scene.worldConfig) {
    const wc = scene.worldConfig
    push({ key: '3d:env' as NodeMapKey, label: `Environment: ${wc.environment}`, kind: '3d_env', ring: 'outer' })
    for (const [i, obj] of (wc.objects ?? []).entries()) {
      push({ key: `3d:obj:${i}` as NodeMapKey, label: obj.assetId, kind: '3d_obj', ring: 'outer' })
    }
    for (const [i, panel] of (wc.panels ?? []).entries()) {
      const preview = panel.html?.replace(/<[^>]+>/g, '').slice(0, 20) || `Panel ${i + 1}`
      push({ key: `3d:panel:${i}` as NodeMapKey, label: preview, kind: '3d_panel', ring: 'outer' })
    }
    for (const [i, av] of (wc.avatars ?? []).entries()) {
      push({
        key: `3d:avatar:${i}` as NodeMapKey,
        label: av.mood || `Avatar ${i + 1}`,
        kind: '3d_avatar',
        ring: 'outer',
      })
    }
    if (wc.cameraPath?.length) {
      push({
        key: '3d:camera' as NodeMapKey,
        label: `Camera Path (${wc.cameraPath.length} keys)`,
        kind: '3d_camera',
        ring: 'outer',
      })
    }
  }

  // Three.js environment preset (non-world scenes)
  if (scene.threeEnvironmentPresetId && !scene.worldConfig) {
    push({ key: '3d:preset' as NodeMapKey, label: scene.threeEnvironmentPresetId, kind: '3d_env', ring: 'outer' })
  }

  // React code elements (bridge components, text, images extracted from JSX)
  // Pick the most specific code field to avoid duplicate matches
  const codeToScan =
    scene.reactCode?.trim() ||
    scene.sceneCode?.trim() ||
    scene.canvasCode?.trim() ||
    scene.svgContent?.trim() ||
    scene.sceneHTML?.trim() ||
    ''
  if (codeToScan) {
    const rxElements = extractElementsFromReactCode(codeToScan)
    // Deduplicate by kind+label
    const seen = new Set<string>()
    let idx = 0
    for (const el of rxElements) {
      const dedupKey = `${el.kind}:${el.label}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      push({
        key: `rx:${el.kind}:${idx}` as NodeMapKey,
        label: el.label,
        kind: `rx_${el.kind}`,
        ring: 'outer',
      })
      idx++
    }
  }

  return nodes
}

// ── Constants ────────────────────────────────────────────────────────────────

const CANVAS_H_DEFAULT = 320
const ROOT_W = 160
const ROOT_H = 96
const CARD_W = 140
const CARD_TITLE_H = 22
const CARD_BODY_H = 28
const CARD_H = CARD_TITLE_H + CARD_BODY_H
const PORT_R = 4

// ── Add-node menu items ──────────────────────────────────────────────────────

export const ADD_NODE_TYPES = [
  { id: 'text', label: 'Text Overlay' },
  { id: 'svg', label: 'SVG Object' },
  { id: 'ai', label: 'AI Layer' },
  { id: 'chart', label: 'Chart' },
  { id: 'interaction', label: 'Interaction' },
  { id: 'physics', label: 'Physics Sim' },
] as const

// ── Layout ───────────────────────────────────────────────────────────────────

interface PositionedNode extends NodeMapEntry {
  x: number
  y: number
}

interface PositionedColumn {
  group: NodeGroup
  label: string
  x: number
  headerY: number
  nodes: PositionedNode[]
}

interface ComputedLayout {
  columns: PositionedColumn[]
  rootCy: number
  totalHeight: number
  totalWidth: number
}

const COLUMN_GAP = 44
const COLUMN_HEADER_H = 18
const COLUMN_HEADER_GAP = 6
const NODE_GAP = 8
const COLUMN_TOP_PAD = 16
const COLUMN_BOTTOM_PAD = 16
const ROOT_X = 40

function computeLayout(nodes: NodeMapEntry[], minH: number): ComputedLayout {
  // Bucket nodes by group, preserve insertion order within each group.
  const buckets = new Map<NodeGroup, NodeMapEntry[]>()
  for (const g of GROUP_ORDER) buckets.set(g, [])
  for (const n of nodes) buckets.get(n.group)?.push(n)
  const activeGroups = GROUP_ORDER.filter((g) => (buckets.get(g)?.length ?? 0) > 0)

  const columns: PositionedColumn[] = []
  let x = ROOT_X + ROOT_W + COLUMN_GAP
  let maxColumnHeight = 0
  for (const group of activeGroups) {
    const groupNodes = buckets.get(group) ?? []
    const columnHeight =
      COLUMN_TOP_PAD +
      COLUMN_HEADER_H +
      COLUMN_HEADER_GAP +
      groupNodes.length * CARD_H +
      (groupNodes.length - 1) * NODE_GAP +
      COLUMN_BOTTOM_PAD
    maxColumnHeight = Math.max(maxColumnHeight, columnHeight)
    columns.push({
      group,
      label: GROUP_LABELS[group],
      x,
      headerY: 0, // filled below once total height known
      nodes: groupNodes.map((n, i) => ({
        ...n,
        x,
        y: 0, // filled below
      })),
    })
    x += CARD_W + COLUMN_GAP
  }

  const totalHeight = Math.max(minH, maxColumnHeight + 40)
  const rootCy = totalHeight / 2

  // Center each column's stack vertically around the canvas midline.
  for (const col of columns) {
    const n = col.nodes.length
    const stackHeight = n * CARD_H + Math.max(0, n - 1) * NODE_GAP
    const headerY = rootCy - (COLUMN_HEADER_H + COLUMN_HEADER_GAP + stackHeight) / 2
    col.headerY = Math.max(COLUMN_TOP_PAD, headerY)
    const firstNodeY = col.headerY + COLUMN_HEADER_H + COLUMN_HEADER_GAP
    for (let i = 0; i < col.nodes.length; i++) {
      col.nodes[i].y = firstNodeY + i * (CARD_H + NODE_GAP)
    }
  }

  const totalWidth = x + 40
  return { columns, rootCy, totalHeight, totalWidth }
}

// ── Component ────────────────────────────────────────────────────────────────

interface NodeMapCanvasProps {
  scene: Scene
  nodes: NodeMapEntry[]
  selectedKey: NodeMapKey | null
  onSelect: (key: NodeMapKey) => void
  onAddNode: (type: string) => void
}

const ZOOM_MIN = 0.3
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.12

export default function NodeMapCanvas({ scene, nodes, selectedKey, onSelect }: NodeMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 500, h: CANVAS_H_DEFAULT })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const minCanvasH = Math.max(CANVAS_H_DEFAULT, nodes.length * (CARD_H + NODE_GAP) + 40)
  const layout = useMemo(() => computeLayout(nodes, minCanvasH), [nodes, minCanvasH])
  const rootCy = layout.rootCy
  const rootPortX = ROOT_X + ROOT_W

  const onBgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-node]')) return
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y }
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        setPan({
          x: dragRef.current.startPanX + (ev.clientX - dragRef.current.startX),
          y: dragRef.current.startPanY + (ev.clientY - dragRef.current.startY),
        })
      }
      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [pan],
  )

  // Zoom with ctrl/meta + wheel, centered on cursor.
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const delta = -Math.sign(e.deltaY) * ZOOM_STEP
    setZoom((z) => {
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta))
      if (nextZoom === z) return z
      const ratio = nextZoom / z
      setPan((p) => ({
        x: cx - (cx - p.x) * ratio,
        y: cy - (cy - p.y) * ratio,
      }))
      return nextZoom
    })
  }, [])

  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP)), [])
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP)), [])
  const zoomReset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Size the inner wrapper to fit all columns.
  const svgW = Math.max(size.w / Math.max(zoom, 0.5), layout.totalWidth)
  const svgH = Math.max(minCanvasH, layout.totalHeight)

  return (
    <div className="relative flex flex-col">
      <div
        ref={containerRef}
        className="relative overflow-auto cursor-grab active:cursor-grabbing"
        style={{
          height: CANVAS_H_DEFAULT,
          backgroundColor: '#1a1a1e',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        onMouseDown={onBgMouseDown}
        onWheel={onWheel}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: svgW,
            height: svgH,
            position: 'relative',
          }}
        >
          {/* Bezier connections: root → each column's first node (one edge per group) */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgW}
            height={svgH}
            style={{ overflow: 'visible' }}
          >
            {layout.columns.map((col) => {
              const first = col.nodes[0]
              if (!first) return null
              const firstSelected = col.nodes.some((n) => n.key === selectedKey)
              const color = colorForKind(first.kind)
              const x1 = rootPortX
              const y1 = rootCy
              const x2 = first.x
              const y2 = first.y + CARD_TITLE_H / 2
              const cpOffset = Math.min(80, Math.abs(x2 - x1) * 0.45)
              return (
                <path
                  key={`edge-root-${col.group}`}
                  d={`M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={firstSelected ? 1.5 : 1}
                  strokeOpacity={firstSelected ? 0.5 : 0.2}
                />
              )
            })}
            {/* Intra-column straight connectors linking siblings */}
            {layout.columns.flatMap((col) =>
              col.nodes.slice(1).map((n, i) => {
                const prev = col.nodes[i]
                const color = colorForKind(n.kind)
                const x = col.x + CARD_W / 2
                return (
                  <line
                    key={`edge-${col.group}-${n.key}`}
                    x1={x}
                    y1={prev.y + CARD_H}
                    x2={x}
                    y2={n.y}
                    stroke={color}
                    strokeWidth={1}
                    strokeOpacity={0.15}
                  />
                )
              }),
            )}
          </svg>

          {/* Column headers */}
          {layout.columns.map((col) => (
            <div
              key={`header-${col.group}`}
              className="absolute pointer-events-none"
              style={{
                left: col.x,
                top: col.headerY,
                width: CARD_W,
                height: COLUMN_HEADER_H,
              }}
            >
              <span
                className="text-[9px] uppercase tracking-wider font-semibold"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {col.label}
              </span>
            </div>
          ))}

          {/* ── Root / Scene node card ── */}
          <div
            data-node="root"
            className="absolute rounded-md overflow-hidden cursor-pointer"
            style={{
              left: ROOT_X,
              top: rootCy - ROOT_H / 2,
              width: ROOT_W,
              height: ROOT_H,
              border: `1px solid ${selectedKey === 'root' ? '#555' : '#333'}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
            onClick={() => onSelect('root')}
          >
            <div className="flex items-center gap-1.5 px-2" style={{ height: CARD_TITLE_H, background: '#e84545' }}>
              <span className="text-[10px] font-semibold text-white truncate flex-1">{scene.name || 'Scene'}</span>
              <span className="shrink-0">
                <SceneTypeIcon sceneType={scene.sceneType} size={13} />
              </span>
              <div
                className="absolute rounded-full"
                style={{
                  right: -PORT_R,
                  top: CARD_TITLE_H / 2 - PORT_R,
                  width: PORT_R * 2,
                  height: PORT_R * 2,
                  background: '#e84545',
                  border: '2px solid #1a1a1e',
                }}
              />
            </div>
            <div
              style={{
                background: '#2a2a2e',
                width: '100%',
                height: ROOT_H - CARD_TITLE_H,
                position: 'relative',
                overflow: 'hidden',
                marginTop: 0,
                lineHeight: 0,
              }}
            >
              {scene.thumbnail ? (
                <img
                  src={scene.thumbnail}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                  }}
                />
              ) : (
                <iframe
                  src={`/scenes/${scene.id}.html`}
                  title="Scene preview"
                  className="pointer-events-none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    border: 'none',
                    width: 1920,
                    height: 1080,
                    transformOrigin: '0 0',
                    transform: `scale(${Math.max(ROOT_W / 1920, (ROOT_H - CARD_TITLE_H) / 1080)})`,
                  }}
                />
              )}
            </div>
          </div>

          {/* ── Column node cards ── */}
          {layout.columns.flatMap((col) =>
            col.nodes.map((n) => {
              const Icon = getNodeIcon(scene, n)
              const isSelected = selectedKey === n.key
              const color = colorForKind(n.kind)
              const isBg = n.kind === 'bg'
              const bgSize = CARD_TITLE_H + 50
              const nodeW = isBg ? 70 : CARD_W
              const nodeH = isBg ? bgSize : CARD_H
              const bodyH = isBg ? bgSize - CARD_TITLE_H : CARD_BODY_H
              return (
                <div
                  key={n.key}
                  data-node={n.key}
                  className="absolute rounded-md overflow-hidden cursor-pointer"
                  style={{
                    left: n.x,
                    top: n.y,
                    width: nodeW,
                    height: nodeH,
                    border: `1px solid ${isSelected ? '#555' : '#333'}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(n.key)
                  }}
                >
                  <div
                    className="absolute rounded-full"
                    style={{
                      left: -PORT_R,
                      top: CARD_TITLE_H / 2 - PORT_R,
                      width: PORT_R * 2,
                      height: PORT_R * 2,
                      background: color,
                      border: '2px solid #1a1a1e',
                    }}
                  />
                  <div className="flex items-center gap-1 px-2" style={{ height: CARD_TITLE_H, background: color }}>
                    <span className="text-[9px] font-semibold text-white truncate flex-1">{n.label}</span>
                    {Icon && <Icon size={10} strokeWidth={2.5} color="rgba(255,255,255,0.7)" className="shrink-0" />}
                  </div>
                  {isBg ? (
                    <div className="flex items-center justify-center" style={{ height: bodyH, background: '#2a2a2e' }}>
                      <div
                        className="rounded-full"
                        style={{
                          width: 32,
                          height: 32,
                          background: scene.bgColor || '#000',
                          border: '2px solid #444',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center px-2" style={{ height: bodyH, background: '#2a2a2e' }}>
                      <span className="text-[8px] truncate" style={{ color: '#999' }}>
                        {getNodeSummary(scene, n)}
                      </span>
                    </div>
                  )}
                </div>
              )
            }),
          )}
        </div>
      </div>

      {/* Zoom toolbar */}
      <div
        className="absolute right-2 top-2 flex items-center gap-1 rounded px-1 py-0.5"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      >
        <ZoomButton onClick={zoomOut} label="Zoom out">
          <Minus size={11} />
        </ZoomButton>
        <span
          role="button"
          tabIndex={0}
          title="Reset zoom"
          className="text-[10px] tabular-nums cursor-pointer hover:text-white px-1 select-none"
          style={{ color: 'rgba(255,255,255,0.7)', minWidth: 34, textAlign: 'center' }}
          onClick={zoomReset}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') zoomReset()
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <ZoomButton onClick={zoomIn} label="Zoom in">
          <Plus size={11} />
        </ZoomButton>
      </div>
    </div>
  )
}

function ZoomButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={label}
      className="flex h-5 w-5 items-center justify-center rounded cursor-pointer"
      style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.06)' }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
    >
      {children}
    </span>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNodeIcon(scene: Scene, node: NodeMapEntry) {
  const { kind } = node
  if (kind === 'tts' || kind === 'sfx') return Volume2
  if (kind === 'music') return Music
  if (kind === 'camera' || kind === '3d_camera') return Camera
  if (kind === 'transition') return ArrowRightLeft
  if (kind === 'style') return Paintbrush
  if (kind === 'variables') return Variable
  if (kind === '3d_env') return Globe
  if (kind === '3d_obj') return Box
  if (kind === '3d_panel') return LayoutTemplate
  if (kind === '3d_avatar') return User
  if (kind === 'rx_three') return Box
  if (kind === 'rx_canvas2d') return Paintbrush
  if (kind === 'rx_d3') return Layers
  if (kind === 'rx_svg') return Layers
  if (kind === 'rx_lottie') return Layers
  if (kind === 'rx_heading' || kind === 'rx_paragraph' || kind === 'rx_text') return Type
  if (kind === 'rx_image') return ImageIcon
  try {
    return iconForKey(scene, node.key as any)
  } catch {
    return null
  }
}

function SceneTypeIcon({ sceneType, size = 12 }: { sceneType: string | undefined; size?: number }) {
  const st = sceneType ?? 'react'
  const s = size
  const fill = 'rgba(255,255,255,0.7)'

  if (st === 'react') {
    // React atom logo
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2.2" fill={fill} />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke={fill} strokeWidth="1.2" fill="none" />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4"
          stroke={fill}
          strokeWidth="1.2"
          fill="none"
          transform="rotate(60 12 12)"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4"
          stroke={fill}
          strokeWidth="1.2"
          fill="none"
          transform="rotate(120 12 12)"
        />
      </svg>
    )
  }

  if (st === 'svg') {
    // SVG badge
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke={fill} strokeWidth="1.5" />
        <path d="M7 14l3-4 2 2 3-4 3 4" stroke={fill} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (st === 'three' || st === '3d_world') {
    // 3D cube
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke={fill} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M2 7v10l10 5V12" stroke={fill} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M22 7v10l-10 5V12" stroke={fill} strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    )
  }

  if (st === 'canvas2d') {
    // Paintbrush / pen
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M18 2l4 4-9.5 9.5-4.5.5.5-4.5L18 2z" stroke={fill} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M3 20c1-2 3-3 5-3" stroke={fill} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }

  if (st === 'd3') {
    // Bar chart
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="12" width="4" height="8" rx="0.5" fill={fill} />
        <rect x="10" y="6" width="4" height="14" rx="0.5" fill={fill} />
        <rect x="17" y="9" width="4" height="11" rx="0.5" fill={fill} />
      </svg>
    )
  }

  if (st === 'motion') {
    // Motion wave
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" stroke={fill} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    )
  }

  if (st === 'lottie') {
    // Play circle
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9.5" stroke={fill} strokeWidth="1.3" />
        <path d="M10 8l6 4-6 4V8z" fill={fill} />
      </svg>
    )
  }

  // Fallback: generic code brackets
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6l-5 6 5 6M16 6l5 6-5 6"
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getNodeSummary(scene: Scene, node: NodeMapEntry): string {
  const { kind, key } = node
  const { id } = parseLayerStackKey(key as string)

  if (kind === 'text' && id) {
    const t = scene.textOverlays.find((x) => x.id === id)
    return t?.content?.slice(0, 32) || 'Empty text'
  }
  if (kind === 'ai' && id) {
    const l = scene.aiLayers.find((x) => x.id === id)
    return l?.type ?? 'AI'
  }
  if (kind === 'chart' && id) {
    const c = (scene.chartLayers ?? []).find((x) => x.id === id)
    return c?.chartType ?? 'Chart'
  }
  if (kind === 'physics' && id) {
    const p = (scene.physicsLayers ?? []).find((x) => x.id === id)
    return p?.simulation ?? 'Physics'
  }
  if (kind === 'interaction' && id) {
    const ix = scene.interactions.find((x) => x.id === id)
    return ix?.type ?? 'Interaction'
  }
  if (kind === 'svg' && id) {
    const o = scene.svgObjects.find((x) => x.id === id)
    return o?.prompt?.slice(0, 32) || 'SVG'
  }
  if (kind === 'scene') return id ?? 'Renderer'
  if (kind === 'bg') return scene.bgColor || 'Background'
  if (kind === 'video') return scene.videoLayer?.src?.split('/').pop()?.slice(0, 24) || 'Video'
  if (kind === 'audio') return 'Audio layer'
  if (kind === 'tts') return 'Text-to-speech'
  if (kind === 'music') return scene.audioLayer?.music?.name?.slice(0, 24) || 'Music'
  if (kind === 'sfx') return 'Sound effect'
  if (kind === 'camera') return `${scene.cameraMotion?.length ?? 0} moves`
  if (kind === 'transition') return scene.transition ?? ''
  if (kind === 'style') return scene.styleOverride?.font || 'Custom'
  if (kind === 'variables') return `${scene.variables?.length ?? 0} vars`

  // 3D sub-elements
  if (kind === '3d_env') {
    const wc = scene.worldConfig
    return wc ? `${wc.environment}${wc.timeOfDay ? ` · ${wc.timeOfDay}` : ''}` : 'Environment'
  }
  if (kind === '3d_obj') {
    const idx = parseInt(key.split(':')[2] ?? '0', 10)
    const obj = scene.worldConfig?.objects?.[idx]
    return obj ? `${obj.assetId} [${obj.position.map((v) => v.toFixed(1)).join(', ')}]` : 'Object'
  }
  if (kind === '3d_panel') {
    const idx = parseInt(key.split(':')[2] ?? '0', 10)
    const panel = scene.worldConfig?.panels?.[idx]
    return panel?.html?.replace(/<[^>]+>/g, '').slice(0, 28) || 'Panel'
  }
  if (kind === '3d_avatar') {
    const idx = parseInt(key.split(':')[2] ?? '0', 10)
    const av = scene.worldConfig?.avatars?.[idx]
    return av?.mood ?? 'Avatar'
  }
  if (kind === '3d_camera') {
    return `${scene.worldConfig?.cameraPath?.length ?? 0} keyframes`
  }

  // React-extracted elements
  if (kind === 'rx_three') return 'Three.js bridge'
  if (kind === 'rx_canvas2d') return 'Canvas 2D bridge'
  if (kind === 'rx_d3') return 'D3 bridge'
  if (kind === 'rx_svg') return 'SVG bridge'
  if (kind === 'rx_lottie') return 'Lottie bridge'
  if (kind === 'rx_heading') return 'Heading'
  if (kind === 'rx_paragraph') return 'Text content'
  if (kind === 'rx_text') return 'Text'
  if (kind === 'rx_image') return 'Image'

  return kind
}

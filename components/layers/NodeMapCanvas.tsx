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
  Music,
  Paintbrush,
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

  const stackKeys = buildDefaultOrder(scene)
  for (const k of stackKeys) {
    const { kind } = parseLayerStackKey(k)
    if (k === 'audio') continue
    if (kind === 'rx') continue // handled by extraction loop below
    nodes.push({
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
      nodes.push({ key: 'tts', label: preview ? `TTS: ${preview}...` : 'TTS / Narration', kind: 'tts', ring: 'outer' })
    }
    if (a.music?.src) {
      nodes.push({ key: 'music', label: a.music.name || 'Music', kind: 'music', ring: 'outer' })
    }
    for (const s of a.sfx ?? []) {
      nodes.push({ key: `sfx:${s.id}` as NodeMapKey, label: s.name || 'SFX', kind: 'sfx', ring: 'outer' })
    }
    if (audioRowVisible(a) && nodes.every((n) => !['tts', 'music', 'sfx'].includes(n.kind))) {
      nodes.push({ key: 'audio' as NodeMapKey, label: 'Audio', kind: 'audio', ring: 'inner' })
    }
  }

  if (scene.cameraMotion?.length) {
    nodes.push({ key: 'camera', label: 'Camera Animation', kind: 'camera', ring: 'inner' })
  }
  if (scene.transition && scene.transition !== 'none') {
    nodes.push({ key: 'transition', label: `Transition: ${scene.transition}`, kind: 'transition', ring: 'inner' })
  }
  const so = scene.styleOverride
  if (so && (so.palette?.length || so.font || so.bgColor)) {
    nodes.push({ key: 'style', label: 'Style Override', kind: 'style', ring: 'inner' })
  }
  if (scene.variables?.length) {
    nodes.push({ key: 'variables', label: `Variables (${scene.variables.length})`, kind: 'variables', ring: 'outer' })
  }

  // 3D world sub-elements
  if (scene.worldConfig) {
    const wc = scene.worldConfig
    nodes.push({ key: '3d:env' as NodeMapKey, label: `Environment: ${wc.environment}`, kind: '3d_env', ring: 'outer' })
    for (const [i, obj] of (wc.objects ?? []).entries()) {
      nodes.push({ key: `3d:obj:${i}` as NodeMapKey, label: obj.assetId, kind: '3d_obj', ring: 'outer' })
    }
    for (const [i, panel] of (wc.panels ?? []).entries()) {
      const preview = panel.html?.replace(/<[^>]+>/g, '').slice(0, 20) || `Panel ${i + 1}`
      nodes.push({ key: `3d:panel:${i}` as NodeMapKey, label: preview, kind: '3d_panel', ring: 'outer' })
    }
    for (const [i, av] of (wc.avatars ?? []).entries()) {
      nodes.push({
        key: `3d:avatar:${i}` as NodeMapKey,
        label: av.mood || `Avatar ${i + 1}`,
        kind: '3d_avatar',
        ring: 'outer',
      })
    }
    if (wc.cameraPath?.length) {
      nodes.push({
        key: '3d:camera' as NodeMapKey,
        label: `Camera Path (${wc.cameraPath.length} keys)`,
        kind: '3d_camera',
        ring: 'outer',
      })
    }
  }

  // Three.js environment preset (non-world scenes)
  if (scene.threeEnvironmentPresetId && !scene.worldConfig) {
    nodes.push({ key: '3d:preset' as NodeMapKey, label: scene.threeEnvironmentPresetId, kind: '3d_env', ring: 'outer' })
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
      nodes.push({
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

function computeLayout(nodes: NodeMapEntry[], _w: number, h: number): PositionedNode[] {
  const rootX = 40
  const rootCy = h / 2
  const childX = rootX + ROOT_W + 80
  const n = nodes.length
  const totalChildH = n * CARD_H + Math.max(0, n - 1) * 8
  const startY = Math.max(8, rootCy - totalChildH / 2)

  return nodes.map((node, i) => ({
    ...node,
    x: childX,
    y: startY + i * (CARD_H + 8),
  }))
}

// ── Component ────────────────────────────────────────────────────────────────

interface NodeMapCanvasProps {
  scene: Scene
  nodes: NodeMapEntry[]
  selectedKey: NodeMapKey | null
  onSelect: (key: NodeMapKey) => void
  onAddNode: (type: string) => void
}

export default function NodeMapCanvas({ scene, nodes, selectedKey, onSelect }: NodeMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 500, h: CANVAS_H_DEFAULT })
  const [pan, setPan] = useState({ x: 0, y: 0 })
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

  // Use enough height to fit all cards
  const minCanvasH = Math.max(CANVAS_H_DEFAULT, nodes.length * (CARD_H + 8) + 40)
  const positioned = useMemo(() => computeLayout(nodes, size.w, minCanvasH), [nodes, size.w, minCanvasH])

  const rootX = 40
  const rootCy = minCanvasH / 2
  // Root output port position
  const rootPortX = rootX + ROOT_W
  const rootPortY = rootCy + ROOT_H / 2 - ROOT_H / 2 + CARD_TITLE_H / 2 + 4

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

  // SVG canvas dimensions (enough for all nodes)
  const svgW = Math.max(size.w, rootX + ROOT_W + 80 + CARD_W + 40)
  const svgH = minCanvasH

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
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            width: svgW,
            height: svgH,
            position: 'relative',
          }}
        >
          {/* Bezier connections */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgW}
            height={svgH}
            style={{ overflow: 'visible' }}
          >
            {positioned.map((n) => {
              const isSelected = selectedKey === n.key
              const color = colorForKind(n.kind)
              // Root output port → child input port
              const x1 = rootPortX
              const y1 = rootCy
              const x2 = n.x
              const y2 = n.y + CARD_TITLE_H / 2
              const cpOffset = Math.min(80, Math.abs(x2 - x1) * 0.45)
              return (
                <path
                  key={`edge-${n.key}`}
                  d={`M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? 1.5 : 1}
                  strokeOpacity={isSelected ? 0.5 : 0.2}
                />
              )
            })}
          </svg>

          {/* ── Root / Scene node card ── */}
          <div
            data-node="root"
            className="absolute rounded-md overflow-hidden cursor-pointer"
            style={{
              left: rootX,
              top: rootCy - ROOT_H / 2,
              width: ROOT_W,
              height: ROOT_H,
              border: `1px solid ${selectedKey === 'root' ? '#555' : '#333'}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
            onClick={() => onSelect('root')}
          >
            {/* Title bar */}
            <div className="flex items-center gap-1.5 px-2" style={{ height: CARD_TITLE_H, background: '#e84545' }}>
              <span className="text-[10px] font-semibold text-white truncate flex-1">{scene.name || 'Scene'}</span>
              <span className="shrink-0">
                <SceneTypeIcon sceneType={scene.sceneType} size={13} />
              </span>
              {/* Output port */}
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
            {/* Body — thumbnail or iframe preview */}
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

          {/* ── Child node cards ── */}
          {positioned.map((n) => {
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
                {/* Input port */}
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
                {/* Title bar */}
                <div className="flex items-center gap-1 px-2" style={{ height: CARD_TITLE_H, background: color }}>
                  <span className="text-[9px] font-semibold text-white truncate flex-1">{n.label}</span>
                  {Icon && <Icon size={10} strokeWidth={2.5} color="rgba(255,255,255,0.7)" className="shrink-0" />}
                </div>
                {/* Body */}
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
          })}
        </div>
      </div>
    </div>
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

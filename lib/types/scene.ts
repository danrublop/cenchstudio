import type { TransitionType } from '../transitions'
export type { TransitionType } from '../transitions'

import type { AudioLayer } from './audio'
import type { D3ChartLayer } from './d3'
import type { PhysicsLayer } from './physics'
import type { AILayer } from './ai-layer'
import type { InteractionElement, SceneVariable, SceneUsage } from './interaction'
import type { WorldConfig } from './world'

export interface TextOverlay {
  id: string
  content: string
  font: string
  size: number
  color: string
  x: number // percentage of canvas width
  y: number // percentage of canvas height
  animation: 'fade-in' | 'slide-up' | 'typewriter'
  duration: number // seconds
  delay: number // seconds into scene
}

export interface VideoLayer {
  enabled: boolean
  src: string | null // URL or /uploads/filename
  opacity: number // 0–1
  trimStart: number // seconds
  trimEnd: number | null
}

export type SceneType =
  | 'svg'
  | 'canvas2d'
  | 'motion'
  | 'd3'
  | 'three'
  | 'lottie'
  | 'zdog'
  | 'physics'
  | 'avatar_scene'
  | '3d_world'

// ── Scene ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  status?: 'pending' | 'done' | 'error'
  generationLogId?: string
  usage?: { inputTokens: number; outputTokens: number; costUsd: number; apiCalls: number; totalDurationMs: number }
  userRating?: number
  agentType?: string
  modelId?: string
}

export interface Scene {
  id: string
  name: string
  prompt: string
  summary: string
  svgContent: string
  usage: SceneUsage | null
  duration: number // seconds
  bgColor: string
  thumbnail: string | null // data URL
  videoLayer: VideoLayer
  audioLayer: AudioLayer
  textOverlays: TextOverlay[]
  svgObjects: SvgObject[]
  primaryObjectId: string | null
  svgBranches: SvgBranch[]
  activeBranchId: string | null
  transition: TransitionType
  sceneType: SceneType
  canvasCode: string
  /** Canvas2D loop behind Motion / D3 / SVG (full-frame #c, z-index 0); empty when unused */
  canvasBackgroundCode: string
  sceneCode: string
  /** Three.js: chosen Cench stage env id (kept in sync with applyCenchThreeEnvironment in sceneCode when possible) */
  threeEnvironmentPresetId?: string | null
  sceneHTML: string
  sceneStyles: string
  lottieSource: string
  d3Data: any
  chartLayers?: D3ChartLayer[]
  physicsLayers?: PhysicsLayer[]
  interactions: InteractionElement[]
  variables: SceneVariable[]
  aiLayers: AILayer[]
  messages: Message[]
  styleOverride: SceneStyleOverride
  cameraMotion: CameraMove[] | null
  worldConfig: WorldConfig | null
  /** Layer stack panel: synthetic keys hidden in UI (eye toggle); export may ignore until wired */
  layerHiddenIds?: string[]
  /** Layer stack panel: top-to-bottom = front-to-back; controls z-index / array order where applicable */
  layerPanelOrder?: string[]
}

export interface CameraMove {
  type:
    | 'kenBurns'
    | 'dollyIn'
    | 'dollyOut'
    | 'pan'
    | 'rackFocus'
    | 'cut'
    | 'shake'
    | 'reset'
    | 'orbit'
    | 'dolly3D'
    | 'rackFocus3D'
    | 'presetReveal'
    | 'presetEmphasis'
    | 'presetCinematicPush'
    | 'presetRackTransition'
  params?: Record<string, unknown>
}

export interface SvgBranch {
  id: string
  parentId: string | null // null = root (initial generate)
  label: string // "Original" or truncated edit instruction
  svgContent: string
  usage: SceneUsage | null
}

export interface SvgObject {
  id: string
  prompt: string
  svgContent: string
  x: number // left offset % of canvas (0–100)
  y: number // top offset % of canvas (0–100)
  width: number // % of canvas width
  opacity: number // 0–1
  zIndex: number // layering (default 4, above text overlays)
}

// ── Database / Schema Types ──────────────────────────────────────────────────

export interface SceneStyleOverride {
  palette?: [string, string, string, string] | null
  font?: string | null
  roughnessLevel?: number | null
  strokeWidth?: number | null
  bgColor?: string | null
  textureStyle?: string | null
  defaultTool?: string | null
  strokeColorOverride?: string | null
  textureIntensity?: number | null
  textureBlendMode?: 'multiply' | 'screen' | 'overlay' | null
  bgStyle?: 'plain' | 'paper' | 'grid' | 'dots' | 'chalkboard' | 'kraft' | null
  axisColor?: string | null
  gridColor?: string | null
  styleNote?: string | null
}

export type SceneStylePresetName =
  | 'before'
  | 'after'
  | 'warning'
  | 'highlight'
  | 'chalkboard'
  | 'blueprint'
  | 'newspaper'
  | 'neon'

export interface TransitionConfig {
  type: TransitionType
  duration: number
}

export interface SceneElement {
  id: string
  type: string
  props: Record<string, unknown>
}

export interface AssetPlacement {
  assetId: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
}

export interface SceneLayer {
  id: string
  type: string
  label: string | null
  parentLayerId: string | null
  zIndex: number
  visible: boolean
  opacity: number
  blendMode: string
  startAt: number
  duration: number | null
  generatedCode: string | null
  elements: SceneElement[]
  assetPlacements: AssetPlacement[]
  prompt: string | null
  layerConfig: Record<string, unknown> | null
}

import type { SceneType } from './scene'
import type { InteractionElement, SceneVariable } from './interaction'
import type { AudioSettings } from './audio'
import type { WatermarkConfig, BrandKit } from './media'
import type { APIPermissions } from './permissions'
import type { TransitionType } from '../transitions'
import type { Timeline } from './timeline'
import type { AspectRatio } from '../dimensions'

export interface GlobalStyle {
  presetId: import('../styles/presets').StylePresetId | null

  // Optional per-project overrides (null = use preset default)
  paletteOverride: [string, string, string, string] | null
  bgColorOverride: string | null
  fontOverride: string | null
  strokeColorOverride: string | null

  // Legacy fields — kept for migration compatibility
  palette?: [string, string, string, string, string]
  strokeWidth?: number
  font?: string
  duration?: number
  theme?: 'dark' | 'light' | 'blue'

  /** App chrome typography (panels, settings). Not used for generated scene text. */
  uiTypography?: 'system' | 'app' | 'custom'
  /** When `uiTypography` is `custom`, font family from the studio catalog. */
  uiFontFamily?: string | null
  /** UI text size scale: 0 = compact, 1 = default, 2 = large, 3 = extra-large */
  uiTextSize?: number
}

export type ExportResolution = '720p' | '1080p' | '4k'
export type ExportFPS = 24 | 30 | 60

export interface ExportSettings {
  resolution: ExportResolution
  fps: ExportFPS
  format: 'mp4'
  outputName?: string
  profile?: 'fast' | 'quality'
  /** Skip save dialog, write directly to this path (headless/API export). */
  outputPath?: string
}

export interface ExportProgress {
  phase: 'rendering' | 'mixing_audio' | 'stitching' | 'complete' | 'error'
  currentScene: number
  totalScenes: number
  sceneProgress: number // 0–100
  downloadUrl: string | null
  error: string | null
  diagnostics?: string[]
}

// ── Project / Scene Graph ────────────────────────────────────────────────────

export interface SceneNode {
  id: string // matches scene.id
  position: { x: number; y: number }
}

export interface EdgeCondition {
  type: 'auto' | 'hotspot' | 'choice' | 'quiz' | 'gate' | 'variable' | 'slider' | 'toggle'
  interactionId: string | null
  variableName: string | null
  variableValue: string | null
  /** Rich condition — when set, takes precedence over variableName/variableValue equality check */
  variableCondition?: import('./interaction').VariableCondition | null
}

export interface SceneEdge {
  id: string
  fromSceneId: string
  toSceneId: string
  condition: EdgeCondition
}

export interface SceneGraph {
  nodes: SceneNode[]
  edges: SceneEdge[]
  startSceneId: string
}

export interface MP4Settings {
  resolution: '720p' | '1080p' | '4k'
  fps: 24 | 30 | 60
  format: 'mp4' | 'webm'
  aspectRatio?: AspectRatio
}

export interface InteractiveSettings {
  playerTheme: 'dark' | 'light' | 'transparent'
  showProgressBar: boolean
  showSceneNav: boolean
  allowFullscreen: boolean
  brandColor: string
  customDomain: string | null
  password: string | null
}

// ── Player types (shared with packages/player) ───────────────────────────────

export interface PlayerOptions {
  theme: 'dark' | 'light' | 'transparent'
  showProgressBar: boolean
  showSceneNav: boolean
  allowFullscreen: boolean
  brandColor: string
  autoplay: boolean
}

export interface PublishedScene {
  id: string
  type: SceneType
  duration: number
  htmlUrl: string
  htmlContent: string | null
  interactions: InteractionElement[]
  variables: SceneVariable[]
  transition: TransitionType
}

export interface PublishedProject {
  id: string
  version: number
  name: string
  playerOptions: PlayerOptions
  sceneGraph: SceneGraph
  scenes: PublishedScene[]
}

export interface Project {
  id: string
  name: string
  outputMode: 'mp4' | 'interactive'
  createdAt: string
  updatedAt: string

  mp4Settings: {
    resolution: '720p' | '1080p' | '4k'
    fps: 24 | 30 | 60
    format: 'mp4' | 'webm'
    aspectRatio?: AspectRatio
  }

  interactiveSettings: {
    playerTheme: 'dark' | 'light' | 'transparent'
    showProgressBar: boolean
    showSceneNav: boolean
    allowFullscreen: boolean
    brandColor: string
    customDomain: string | null
    password: string | null
  }

  sceneGraph: SceneGraph
  apiPermissions: APIPermissions
  audioSettings: AudioSettings
  audioProviderEnabled: Record<string, boolean>
  mediaGenEnabled: Record<string, boolean>
  watermark: WatermarkConfig | null
  brandKit: BrandKit | null
  pausedAgentRun?: {
    toolName: string
    toolInput: Record<string, unknown>
    agentType?: string | null
    reason?: string | null
    createdAt: string
  } | null

  /** NLE timeline with clips on tracks. When present, the compositor reads from this instead of the sequential scene list. */
  timeline?: Timeline | null
}

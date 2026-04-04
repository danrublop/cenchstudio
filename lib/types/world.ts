import type { AvatarMood, NarrationScript } from './ai-layer'

// ── 3D World Types ──────────────────────────────────────────────────────────

export type WorldEnvironment = 'meadow' | 'studio_room' | 'void_space'

export interface WorldObjectConfig {
  assetId: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  animations?: string[]
  gsapAnimation?: {
    property: string
    from: number
    to: number
    duration: number
    at?: string
  }
}

export interface WorldPanelConfig {
  html: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
  animateIn?: string
  animateAt?: number
}

export interface WorldAvatarConfig {
  glbUrl?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  mood?: AvatarMood
  script?: NarrationScript
}

export interface WorldCameraKeyframe {
  t: number
  pos: [number, number, number]
  lookAt: [number, number, number]
}

export interface WorldConfig {
  environment: WorldEnvironment
  timeOfDay?: 'morning' | 'afternoon' | 'sunset' | 'night'
  windStrength?: number
  grassDensity?: number
  roomStyle?: 'classroom' | 'office' | 'studio'
  spaceLayout?: 'grid' | 'arc' | 'spiral' | 'random'
  objects?: WorldObjectConfig[]
  panels?: WorldPanelConfig[]
  avatars?: WorldAvatarConfig[]
  cameraPath?: WorldCameraKeyframe[]
}

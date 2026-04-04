/**
 * Shared types for the Pixi compositor used by both export and preview.
 */

export type TextOverlayConfig = {
  id: string
  content: string
  font: string
  size: number
  color: string
  x: number
  y: number
  animation: 'fade-in' | 'slide-up' | 'typewriter'
  duration: number
  delay: number
}

export type CameraMoveConfig = {
  type: string
  params?: Record<string, unknown>
}

export type SvgObjectConfig = {
  id: string
  svgContent: string
  x: number
  y: number
  width: number
  opacity: number
  zIndex: number
}

export type LayerAnimationConfig = {
  type:
    | 'fade-in'
    | 'fade-out'
    | 'slide-left'
    | 'slide-right'
    | 'slide-up'
    | 'slide-down'
    | 'scale-in'
    | 'scale-out'
    | 'spin-in'
    | 'none'
  duration: number
  delay: number
  easing?: string
}

export type AiLayerConfig = {
  id: string
  type: 'image' | 'sticker' | 'avatar' | 'veo3' | string
  imageUrl?: string | null
  stickerUrl?: string | null
  videoUrl?: string | null
  playbackRate?: number
  loop?: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
  startAt?: number
  animateIn?: boolean
  animation?: LayerAnimationConfig
}

export type SceneCompositorConfig = {
  sceneId?: string
  width: number
  height: number
  durationSeconds: number
  sceneType?: string
  svgContent?: string
  sceneHTML?: string
  bgColor: string
  videoSrc?: string | null
  videoOpacity?: number
  trimStart?: number
  trimEnd?: number | null
  textOverlays?: TextOverlayConfig[]
  svgObjects?: SvgObjectConfig[]
  aiLayers?: AiLayerConfig[]
  layerHiddenIds?: string[]
  layerPanelOrder?: string[]
  cameraMotion?: CameraMoveConfig[] | null
}

import type { MediaLayerStatus } from './media'

// ── AI Layer Types ──────────────────────────────────────────────────────────

export type AvatarMood = 'neutral' | 'happy' | 'sad' | 'angry' | 'fear' | 'surprise'
export type AvatarView = 'full' | 'mid' | 'upper' | 'head'
export type AvatarGesture = 'wave' | 'handup' | 'index' | 'ok' | 'thumbup' | 'thumbdown' | 'side' | 'shrug'
export type AvatarPosition =
  | 'pip_bottom_right'
  | 'pip_bottom_left'
  | 'pip_top_right'
  | 'fullscreen'
  | 'fullscreen_left'
  | 'fullscreen_right'
export type PipShape = 'circle' | 'rounded' | 'square'

export interface NarrationLine {
  text: string
  mood?: AvatarMood
  gesture?: AvatarGesture
  gestureHand?: 'left' | 'right'
  lookAt?: { x: number; y: number }
  lookCamera?: boolean
  pauseBefore?: number
  animation?: string
}

export type AvatarCharacter = 'friendly' | 'professional' | 'energetic'

export interface NarrationScript {
  mood: AvatarMood
  view: AvatarView
  lipsyncHeadMovement: boolean
  eyeContact: number
  position: AvatarPosition
  pipSize?: number
  pipShape?: PipShape
  avatarScale?: number
  containerEnabled?: boolean
  background?: string
  character?: AvatarCharacter
  /** TalkingHead model id — see `TALKING_HEAD_AVATAR_MODELS` (local + CDN samples). */
  avatarModelId?: string
  /**
   * Animate mouth from estimated speaking time for the narration text only — no TTS, no audio.
   * Uses the same jaw morph loop as the Web Speech fallback. Handy for free local VRM demos / QA.
   */
  fakeLipsync?: boolean
  // Container glassmorphic styling
  containerBlur?: number
  containerBorderColor?: string
  containerBorderOpacity?: number
  containerBorderWidth?: number
  containerShadowOpacity?: number
  containerInnerGlow?: number
  containerBgOpacity?: number
  enterAt?: number
  exitAt?: number
  entranceAnimation?: 'fade' | 'scale-in' | 'slide-up'
  exitAnimation?: 'fade' | 'scale-out' | 'slide-down'
  lines: NarrationLine[]
}

export interface ContentPanel {
  id: string
  html: string
  position: 'left' | 'right' | 'top' | 'bottom' | 'center'
  revealAt: string // 'start' | 'marker_N' | seconds as string
  exitAt?: string
  style?: Record<string, string>
}

export interface AvatarSceneConfig {
  narrationScript: NarrationScript
  contentPanels: ContentPanel[]
  backdrop: string
  avatarPosition: 'left' | 'right' | 'center'
  avatarSize: number
}

export interface AvatarLayer {
  id: string
  type: 'avatar'
  avatarId: string
  voiceId: string
  script: string
  removeBackground: boolean
  x: number
  y: number
  width: number
  height: number
  opacity: number
  zIndex: number
  videoUrl: string | null
  thumbnailUrl: string | null
  status: MediaLayerStatus
  heygenVideoId: string | null
  estimatedDuration: number
  startAt: number
  label: string
  // Extended avatar fields
  avatarPlacement?: AvatarPosition
  avatarProvider?: string
  talkingHeadUrl?: string | null
  narrationScript?: NarrationScript
  avatarSceneConfig?: AvatarSceneConfig
}

export interface Veo3Layer {
  id: string
  type: 'veo3'
  prompt: string
  negativePrompt: string | null
  aspectRatio: '16:9' | '9:16' | '1:1'
  duration: 5 | 8
  loop: boolean
  playbackRate: number
  x: number
  y: number
  width: number
  height: number
  opacity: number
  zIndex: number
  videoUrl: string | null
  thumbnailUrl: string | null
  status: MediaLayerStatus
  operationName: string | null
  startAt: number
  label: string
}

export type AILayer = AvatarLayer | Veo3Layer | ImageLayer | StickerLayer

// Re-import and re-export to make AILayer union complete
import type { ImageLayer, StickerLayer } from './media'

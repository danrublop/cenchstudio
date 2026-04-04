// ── Clip / Track / Timeline (NLE model) ─────────────────────────────────────

export type ClipSourceType = 'scene' | 'video' | 'image' | 'audio' | 'title'

export interface Keyframe {
  time: number // seconds relative to clip start
  property: string // 'x' | 'y' | 'scaleX' | 'scaleY' | 'opacity' | 'rotation' | 'speed'
  value: number
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | string
}

export interface ClipFilter {
  type: 'blur' | 'brightness' | 'contrast' | 'saturate' | 'grayscale' | 'sepia' | 'hue-rotate'
  value: number
}

export interface Clip {
  id: string
  trackId: string
  sourceType: ClipSourceType
  sourceId: string // scene ID, file path, asset URL, etc.
  label: string
  startTime: number // position on global timeline (seconds)
  duration: number // playback duration after trim+speed
  trimStart: number // source in-point (seconds)
  trimEnd: number | null // source out-point (seconds, null = end)
  speed: number // playback rate (1 = normal)
  opacity: number // 0–1
  position: { x: number; y: number } // offset in pixels (0,0 = top-left)
  scale: { x: number; y: number } // 1,1 = 100%
  rotation: number // degrees
  filters: ClipFilter[]
  blendMode?: string // normal, multiply, screen, overlay, etc.
  keyframes: Keyframe[]
  transition?: {
    type: string // crossfade, wipe, dissolve, etc.
    duration: number // seconds
  } | null
}

export type TrackType = 'video' | 'audio' | 'overlay'

export interface Track {
  id: string
  name: string
  type: TrackType
  clips: Clip[]
  muted: boolean
  locked: boolean
  position: number // top-to-bottom order in UI (0 = top)
}

export interface Timeline {
  tracks: Track[]
}

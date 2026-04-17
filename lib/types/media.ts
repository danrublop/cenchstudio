// ── Project Assets / Watermark ──────────────────────────────────────────────

export type AssetType = 'image' | 'video' | 'svg'

export type AssetSource = 'upload' | 'generated'

export type MediaIntent = 't2i' | 'i2i' | 'sticker' | 'video' | 'avatar'

export interface AssetGenerationMetadata {
  prompt: string | null
  provider: string | null
  model: string | null
  costCents: number | null
  parentAssetId: string | null
  referenceAssetIds: string[] | null
  enhanceTags: string[] | null
}

export interface ProjectAsset extends AssetGenerationMetadata {
  id: string
  projectId: string
  filename: string
  storagePath: string
  publicUrl: string
  type: AssetType
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationSeconds: number | null
  name: string
  tags: string[]
  thumbnailUrl: string | null
  extractedColors: string[]
  source: AssetSource
  createdAt: string
}

export interface WatermarkConfig {
  assetId: string
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity: number
  sizePercent: number
}

export interface BrandKit {
  brandName: string | null
  logoAssetIds: string[]
  palette: string[]
  fontPrimary: string | null
  fontSecondary: string | null
  guidelines: string | null
}

export type ImageModel =
  | 'flux-1.1-pro'
  | 'flux-schnell'
  | 'ideogram-v3'
  | 'recraft-v3'
  | 'stable-diffusion-3'
  | 'dall-e-3'

export type ImageStyle = 'photorealistic' | 'illustration' | 'flat' | 'sketch' | '3d' | 'pixel' | 'watercolor'

export type MediaLayerStatus = 'pending' | 'generating' | 'removing-bg' | 'ready' | 'error'

export interface LayerAnimation {
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
  duration: number // seconds
  delay: number // seconds from scene start
  easing?: string // CSS easing, e.g. 'ease-in-out'
}

export interface ImageLayer {
  id: string
  type: 'image'
  prompt: string
  model: ImageModel
  style: ImageStyle | null
  imageUrl: string | null
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
  status: MediaLayerStatus
  label: string
  startAt?: number
  animation?: LayerAnimation
  filter?: string // CSS filter string, e.g. "blur(2px) brightness(1.2)"
}

export interface StickerLayer {
  id: string
  type: 'sticker'
  prompt: string
  model: ImageModel
  style: ImageStyle | null
  imageUrl: string | null
  stickerUrl: string | null
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
  status: MediaLayerStatus
  animateIn: boolean
  startAt: number
  label: string
  animation?: LayerAnimation
  filter?: string
}

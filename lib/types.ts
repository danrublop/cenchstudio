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

export interface AudioLayer {
  enabled: boolean
  src: string | null
  volume: number // 0–1
  fadeIn: boolean
  fadeOut: boolean
  startOffset: number // seconds
}

export type TransitionType = 'none' | 'crossfade' | 'wipe-left' | 'wipe-right'
export type SceneType = 'svg' | 'canvas2d' | 'motion' | 'd3' | 'three' | 'lottie'

// ── AI Media Generation Types ───────────────────────────────────────────────

export type APIName = 'heygen' | 'veo3' | 'imageGen' | 'backgroundRemoval' | 'elevenLabs' | 'unsplash'

export type PermissionMode = 'always_ask' | 'always_allow' | 'always_deny' | 'ask_once'

export interface PermissionConfig {
  mode: PermissionMode
  sessionLimit: number | null
  monthlyLimit: number | null
  sessionSpend: number
  monthlySpend: number
}

export interface APIPermissions {
  heygen: PermissionConfig
  veo3: PermissionConfig
  imageGen: PermissionConfig
  backgroundRemoval: PermissionConfig
  elevenLabs: PermissionConfig
  unsplash: PermissionConfig
}

export interface PermissionRequest {
  id: string
  api: APIName
  estimatedCost: string
  reason: string
  details: {
    prompt?: string
    duration?: number
    model?: string
    resolution?: string
  }
}

export interface PermissionResponse {
  id: string
  decision: 'allow' | 'deny'
  remember: 'once' | 'session' | 'always'
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

// ── AI Layer Types ──────────────────────────────────────────────────────────

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
}

export type AILayer = AvatarLayer | Veo3Layer | ImageLayer | StickerLayer

export interface SceneUsage {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

// ── Interaction Elements ─────────────────────────────────────────────────────

export interface BaseInteraction {
  id: string
  type: string
  x: number       // % of canvas width (0–100)
  y: number       // % of canvas height (0–100)
  width: number   // % of canvas width
  height: number  // % of canvas height
  appearsAt: number       // seconds into scene
  hidesAt: number | null  // null = stays until scene ends
  entranceAnimation: 'fade' | 'slide-up' | 'pop' | 'none'
}

export interface HotspotElement extends BaseInteraction {
  type: 'hotspot'
  label: string
  shape: 'circle' | 'rectangle' | 'pill'
  style: 'pulse' | 'glow' | 'border' | 'filled'
  color: string
  triggersEdgeId: string | null
  jumpsToSceneId: string | null
}

export interface ChoiceOption {
  id: string
  label: string
  icon: string | null
  jumpsToSceneId: string
  color: string | null
}

export interface ChoiceElement extends BaseInteraction {
  type: 'choice'
  question: string | null
  layout: 'horizontal' | 'vertical' | 'grid'
  options: ChoiceOption[]
}

export interface QuizOption {
  id: string
  label: string
}

export interface QuizElement extends BaseInteraction {
  type: 'quiz'
  question: string
  options: QuizOption[]
  correctOptionId: string
  onCorrect: 'continue' | 'jump'
  onCorrectSceneId: string | null
  onWrong: 'retry' | 'jump' | 'continue'
  onWrongSceneId: string | null
  explanation: string | null
}

export interface GateElement extends BaseInteraction {
  type: 'gate'
  buttonLabel: string
  buttonStyle: 'primary' | 'outline' | 'minimal'
  minimumWatchTime: number
}

export interface TooltipElement extends BaseInteraction {
  type: 'tooltip'
  triggerShape: 'circle' | 'rectangle'
  triggerColor: string
  triggerLabel: string | null
  tooltipTitle: string
  tooltipBody: string
  tooltipPosition: 'top' | 'bottom' | 'left' | 'right'
  tooltipMaxWidth: number
}

export interface FormField {
  id: string
  label: string
  type: 'text' | 'select' | 'radio'
  placeholder: string | null
  options: string[]
  required: boolean
}

export interface FormInputElement extends BaseInteraction {
  type: 'form'
  fields: FormField[]
  submitLabel: string
  setsVariables: { fieldId: string; variableName: string }[]
  jumpsToSceneId: string | null
}

export type InteractionElement =
  | HotspotElement
  | ChoiceElement
  | QuizElement
  | GateElement
  | TooltipElement
  | FormInputElement

export interface SceneVariable {
  name: string
}

// ── Scene ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  status?: 'pending' | 'done' | 'error'
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
  sceneCode: string
  sceneHTML: string
  sceneStyles: string
  lottieSource: string
  d3Data: any
  interactions: InteractionElement[]
  variables: SceneVariable[]
  aiLayers: AILayer[]
  messages: Message[]
}

export interface SvgBranch {
  id: string
  parentId: string | null  // null = root (initial generate)
  label: string            // "Original" or truncated edit instruction
  svgContent: string
  usage: SceneUsage | null
}

export interface SvgObject {
  id: string
  prompt: string
  svgContent: string
  x: number       // left offset % of canvas (0–100)
  y: number       // top offset % of canvas (0–100)
  width: number   // % of canvas width
  opacity: number // 0–1
  zIndex: number  // layering (default 4, above text overlays)
}

export interface GlobalStyle {
  palette: [string, string, string, string, string]
  strokeWidth: number // 1–5
  font: string
  duration: number // 3–20 seconds
  theme: 'dark' | 'light'
}

export type ExportResolution = '720p' | '1080p' | '4k'
export type ExportFPS = 24 | 30 | 60

export interface ExportSettings {
  resolution: ExportResolution
  fps: ExportFPS
  format: 'mp4'
}

export interface ExportProgress {
  phase: 'rendering' | 'stitching' | 'complete' | 'error'
  currentScene: number
  totalScenes: number
  sceneProgress: number // 0–100
  downloadUrl: string | null
  error: string | null
}

// ── Project / Scene Graph ────────────────────────────────────────────────────

export interface SceneNode {
  id: string  // matches scene.id
  position: { x: number; y: number }
}

export interface EdgeCondition {
  type: 'auto' | 'hotspot' | 'choice' | 'quiz' | 'gate' | 'variable'
  interactionId: string | null
  variableName: string | null
  variableValue: string | null
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
}

// ── Database / Schema Types ──────────────────────────────────────────────────

export interface SceneStyleOverride {
  palette?: string[]
  font?: string
  roughnessLevel?: number
  strokeWidth?: number
  bgColor?: string
  textureStyle?: string
}

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

export interface MP4Settings {
  resolution: '720p' | '1080p' | '4k'
  fps: 24 | 30 | 60
  format: 'mp4' | 'webm'
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

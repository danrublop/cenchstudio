// ── Element types for the property inspector ──────────────────────────────────
// Every drawable element in a scene gets a structured definition so the
// inspector can display and edit its properties, and the iframe can do
// hit-testing for click-to-select.

export type ElementType =
  | 'rough-line'
  | 'rough-circle'
  | 'rough-rect'
  | 'rough-arrow'
  | 'rough-polygon'
  | 'text'
  | 'svg-path'
  | 'svg-text'
  | 'svg-shape'
  | 'three-object'
  | 'zdog-shape'
  | 'd3-chart'
  | 'image'
  | 'group'
  | 'physics-card'

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export interface BaseElement {
  id: string // unique within scene e.g. 'line-01'
  type: ElementType
  label: string // human readable e.g. 'Arrow pointing right'
  visible: boolean
  opacity: number // 0-1
  animStartTime: number // seconds on GSAP timeline
  animDuration: number // seconds
  bbox: BBox // bounding box for hit detection in 1920x1080 space
}

export interface RoughLineElement extends BaseElement {
  type: 'rough-line'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  strokeWidth: number
  tool: 'marker' | 'pen' | 'chalk' | 'brush' | 'highlighter'
  seed: number
}

export interface RoughCircleElement extends BaseElement {
  type: 'rough-circle'
  cx: number
  cy: number
  radius: number
  color: string
  fill: string | null
  fillAlpha: number
  strokeWidth: number
  tool: string
  seed: number
}

export interface RoughRectElement extends BaseElement {
  type: 'rough-rect'
  x: number
  y: number
  width: number
  height: number
  color: string
  fill: string | null
  fillAlpha: number
  cornerRadius: number
  strokeWidth: number
  tool: string
  seed: number
}

export interface RoughArrowElement extends BaseElement {
  type: 'rough-arrow'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  strokeWidth: number
  arrowheadSize: number
  tool: string
  seed: number
}

export interface RoughPolygonElement extends BaseElement {
  type: 'rough-polygon'
  points: [number, number][]
  color: string
  fill: string | null
  fillAlpha: number
  strokeWidth: number
  tool: string
  seed: number
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  fontWeight: '400' | '600' | '700'
  textAlign: 'left' | 'center' | 'right'
}

export interface SVGPathSceneElement extends BaseElement {
  type: 'svg-path'
  d: string
  stroke: string
  strokeWidth: number
  fill: string
  fillOpacity: number
}

export interface SVGTextSceneElement extends BaseElement {
  type: 'svg-text'
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  fill: string
  textAnchor: 'start' | 'middle' | 'end'
}

export interface SVGShapeSceneElement extends BaseElement {
  type: 'svg-shape'
  stroke: string
  strokeWidth: number
  fill: string
  fillOpacity: number
}

export interface ThreeObjectElement extends BaseElement {
  type: 'three-object'
  // Three.js elements are complex — only agent editing makes sense
  // bbox covers the full scene by default
}

export interface ZdogShapeElement extends BaseElement {
  type: 'zdog-shape'
}

export interface D3ChartElement extends BaseElement {
  type: 'd3-chart'
}

export interface ImageElement extends BaseElement {
  type: 'image'
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface GroupElement extends BaseElement {
  type: 'group'
  children: string[] // child element ids
}

/** Physics explain / caption card (overlay or fullscreen) — backed by `physicsLayers[n].params` */
export interface PhysicsCardElement extends BaseElement {
  type: 'physics-card'
  physicsLayerIndex: number
  canvasId: string
  cardX: number
  cardY: number
  cardWidth: number
  cardPreset: string
  cardBlur: number
  cardRadius: number
  cardPadding: number
  cardBg: string
  cardBorder: string
  cardShadow: string
  cardText: string
  titleColor: string
  bodyColor: string
  textAlign: 'left' | 'center'
  titleSize: number
  bodySize: number
  equationSize: number
  simScale: number
}

// Union type
export type SceneElement =
  | RoughLineElement
  | RoughCircleElement
  | RoughRectElement
  | RoughArrowElement
  | RoughPolygonElement
  | TextElement
  | SVGPathSceneElement
  | SVGTextSceneElement
  | SVGShapeSceneElement
  | ThreeObjectElement
  | ZdogShapeElement
  | D3ChartElement
  | ImageElement
  | GroupElement
  | PhysicsCardElement

// ── Property metadata for the inspector UI ──────────────────────────────────

export type PropertyControlType = 'color' | 'number' | 'slider' | 'text' | 'textarea' | 'select' | 'toggle'

export interface PropertyMeta {
  key: string
  label: string
  control: PropertyControlType
  min?: number
  max?: number
  step?: number
  suffix?: string
  options?: string[]
  optionLabels?: string[]
  allowNone?: boolean
}

// Defines which properties each element type exposes in the inspector
export const ELEMENT_PROPERTY_MAP: Record<string, PropertyMeta[]> = {
  'rough-line': [
    { key: 'color', label: 'Color', control: 'color' },
    { key: 'strokeWidth', label: 'Stroke width', control: 'slider', min: 0.5, max: 20, step: 0.5 },
    { key: 'tool', label: 'Tool', control: 'select', options: ['marker', 'pen', 'chalk', 'brush', 'highlighter'] },
    { key: 'x1', label: 'X1', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y1', label: 'Y1', control: 'slider', min: 0, max: 1080, step: 1 },
    { key: 'x2', label: 'X2', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y2', label: 'Y2', control: 'slider', min: 0, max: 1080, step: 1 },
  ],
  'rough-arrow': [
    { key: 'color', label: 'Color', control: 'color' },
    { key: 'strokeWidth', label: 'Stroke width', control: 'slider', min: 0.5, max: 20, step: 0.5 },
    { key: 'arrowheadSize', label: 'Arrowhead', control: 'slider', min: 5, max: 60, step: 1 },
    { key: 'tool', label: 'Tool', control: 'select', options: ['marker', 'pen', 'chalk', 'brush', 'highlighter'] },
    { key: 'x1', label: 'X1', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y1', label: 'Y1', control: 'slider', min: 0, max: 1080, step: 1 },
    { key: 'x2', label: 'X2', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y2', label: 'Y2', control: 'slider', min: 0, max: 1080, step: 1 },
  ],
  'rough-circle': [
    { key: 'color', label: 'Stroke', control: 'color' },
    { key: 'fill', label: 'Fill', control: 'color', allowNone: true },
    { key: 'fillAlpha', label: 'Fill opacity', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'strokeWidth', label: 'Stroke width', control: 'slider', min: 0.5, max: 20, step: 0.5 },
    { key: 'cx', label: 'Center X', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'cy', label: 'Center Y', control: 'slider', min: 0, max: 1080, step: 1 },
    { key: 'radius', label: 'Radius', control: 'slider', min: 1, max: 960, step: 1 },
  ],
  'rough-rect': [
    { key: 'color', label: 'Stroke', control: 'color' },
    { key: 'fill', label: 'Fill', control: 'color', allowNone: true },
    { key: 'fillAlpha', label: 'Fill opacity', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'strokeWidth', label: 'Stroke width', control: 'slider', min: 0.5, max: 20, step: 0.5 },
    { key: 'cornerRadius', label: 'Corner radius', control: 'slider', min: 0, max: 100, step: 1 },
    { key: 'x', label: 'X', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y', label: 'Y', control: 'slider', min: 0, max: 1080, step: 1 },
    { key: 'width', label: 'Width', control: 'slider', min: 1, max: 1920, step: 1 },
    { key: 'height', label: 'Height', control: 'slider', min: 1, max: 1080, step: 1 },
  ],
  text: [
    { key: 'text', label: 'Text', control: 'textarea' },
    { key: 'color', label: 'Color', control: 'color' },
    { key: 'fontSize', label: 'Font size', control: 'slider', min: 8, max: 200, step: 1 },
    {
      key: 'fontWeight',
      label: 'Weight',
      control: 'select',
      options: ['400', '600', '700'],
      optionLabels: ['Regular', 'Semibold', 'Bold'],
    },
    { key: 'textAlign', label: 'Align', control: 'select', options: ['left', 'center', 'right'] },
    { key: 'x', label: 'X', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y', label: 'Y', control: 'slider', min: 0, max: 1080, step: 1 },
  ],
  'svg-path': [
    { key: 'stroke', label: 'Stroke', control: 'color', allowNone: true },
    { key: 'fill', label: 'Fill', control: 'color', allowNone: true },
    { key: 'strokeWidth', label: 'Stroke width', control: 'slider', min: 0, max: 20, step: 0.5 },
    { key: 'fillOpacity', label: 'Fill opacity', control: 'slider', min: 0, max: 1, step: 0.05 },
  ],
  'svg-text': [
    { key: 'text', label: 'Text', control: 'textarea' },
    { key: 'fill', label: 'Color', control: 'color' },
    { key: 'fontSize', label: 'Font size', control: 'slider', min: 8, max: 200, step: 1 },
    { key: 'textAnchor', label: 'Anchor', control: 'select', options: ['start', 'middle', 'end'] },
    { key: 'x', label: 'X', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y', label: 'Y', control: 'slider', min: 0, max: 1080, step: 1 },
  ],
  'svg-shape': [
    { key: 'stroke', label: 'Stroke', control: 'color', allowNone: true },
    { key: 'fill', label: 'Fill', control: 'color', allowNone: true },
    { key: 'strokeWidth', label: 'Stroke width', control: 'slider', min: 0, max: 20, step: 0.5 },
    { key: 'fillOpacity', label: 'Fill opacity', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'x', label: 'X', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y', label: 'Y', control: 'slider', min: 0, max: 1080, step: 1 },
    { key: 'width', label: 'Width', control: 'slider', min: 1, max: 1920, step: 1 },
    { key: 'height', label: 'Height', control: 'slider', min: 1, max: 1080, step: 1 },
  ],
  image: [
    { key: 'x', label: 'X', control: 'slider', min: 0, max: 1920, step: 1 },
    { key: 'y', label: 'Y', control: 'slider', min: 0, max: 1080, step: 1 },
    { key: 'width', label: 'Width', control: 'slider', min: 1, max: 1920, step: 1 },
    { key: 'height', label: 'Height', control: 'slider', min: 1, max: 1080, step: 1 },
    { key: 'rotation', label: 'Rotation', control: 'slider', min: -360, max: 360, step: 1, suffix: 'deg' },
  ],
  'physics-card': [
    {
      key: 'cardPreset',
      label: 'Style preset',
      control: 'select',
      options: ['glass_dark', 'glass_light', 'neon', 'chalk'],
      optionLabels: ['Glass (dark)', 'Glass (light)', 'Neon', 'Chalk'],
    },
    { key: 'cardBg', label: 'Card background', control: 'color', allowNone: true },
    { key: 'cardBorder', label: 'Border', control: 'color', allowNone: true },
    { key: 'cardShadow', label: 'Shadow CSS', control: 'textarea' },
    { key: 'cardText', label: 'Text color', control: 'color', allowNone: true },
    { key: 'titleColor', label: 'Title color', control: 'color', allowNone: true },
    { key: 'bodyColor', label: 'Body color', control: 'color', allowNone: true },
    { key: 'textAlign', label: 'Text align', control: 'select', options: ['left', 'center'] },
    { key: 'cardBlur', label: 'Glass blur', control: 'slider', min: 0, max: 18, step: 0.5, suffix: 'px' },
    { key: 'cardRadius', label: 'Corner radius', control: 'slider', min: 0, max: 40, step: 1, suffix: 'px' },
    { key: 'cardPadding', label: 'Padding', control: 'slider', min: 8, max: 56, step: 1, suffix: 'px' },
    { key: 'titleSize', label: 'Title size', control: 'slider', min: 16, max: 84, step: 1, suffix: 'px' },
    { key: 'bodySize', label: 'Body size', control: 'slider', min: 12, max: 54, step: 1, suffix: 'px' },
    { key: 'equationSize', label: 'Equation size', control: 'slider', min: 14, max: 88, step: 1, suffix: 'px' },
    { key: 'simScale', label: 'Simulation scale', control: 'slider', min: 0.35, max: 1.2, step: 0.01 },
    { key: 'cardX', label: 'Position X', control: 'slider', min: 1, max: 99, step: 0.5, suffix: '%' },
    { key: 'cardY', label: 'Position Y', control: 'slider', min: 8, max: 92, step: 0.5, suffix: '%' },
    { key: 'cardWidth', label: 'Card width', control: 'slider', min: 16, max: 55, step: 0.5, suffix: '%' },
  ],
}

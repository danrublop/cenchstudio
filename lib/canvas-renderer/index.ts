/**
 * Canvas2D Drawing Engine for Cench Studio
 *
 * Self-contained renderer providing hand-drawn primitives, pressure-sensitive
 * strokes, seeded randomness, path smoothing, and texture overlays.
 *
 * All randomness uses mulberry32 with fixed seeds — never Math.random().
 * All animateRough* functions return Promise<void>.
 * Text is never animated character by character.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrawTool = 'marker' | 'pen' | 'chalk' | 'brush' | 'highlighter'

export interface PressureOpts {
  /** 0–1, where max pressure occurs along the stroke (default 0.4) */
  peakAt?: number
  /** Fraction of base width at stroke tips (default 0.25) */
  minWidth?: number
  /** How sharply pressure peaks (default 2.5) */
  sharpness?: number
}

export interface DrawOpts {
  color?: string
  width?: number
  roughness?: number
  seed?: number
  fill?: string | null
  fillAlpha?: number
  tool?: DrawTool
  pressureOpts?: PressureOpts
  smooth?: boolean
  smoothIterations?: number
}

export interface DrawingTool {
  id: DrawTool
  name: string
  description: string
  roughness: number
  bowing: number
  defaultWidth: number
  pressureProfile: PressureOpts
  alphaJitter: number
  textureStyle: 'none' | 'grain' | 'paper' | 'chalk'
  textureIntensity: number
  smoothIterations: number
  lineDash: number[]
  lineCap: CanvasLineCap
}

// ── Drawing Tool Configurations ───────────────────────────────────────────────

export const DRAWING_TOOLS: Record<DrawTool, DrawingTool> = {
  marker: {
    id: 'marker',
    name: 'Marker',
    description: 'Broad, consistent strokes with slight wobble. Bold and readable.',
    roughness: 0.6,
    bowing: 0.4,
    defaultWidth: 6,
    pressureProfile: { peakAt: 0.35, minWidth: 0.55, sharpness: 1.8 },
    alphaJitter: 0.04,
    textureStyle: 'none',
    textureIntensity: 0,
    smoothIterations: 1,
    lineDash: [],
    lineCap: 'round',
  },
  pen: {
    id: 'pen',
    name: 'Pen',
    description: 'Fine, precise strokes with natural hand-drawn character.',
    roughness: 0.4,
    bowing: 0.25,
    defaultWidth: 2.5,
    pressureProfile: { peakAt: 0.4, minWidth: 0.25, sharpness: 2.5 },
    alphaJitter: 0.02,
    textureStyle: 'none',
    textureIntensity: 0,
    smoothIterations: 2,
    lineDash: [],
    lineCap: 'round',
  },
  chalk: {
    id: 'chalk',
    name: 'Chalk',
    description: 'Rough, textured strokes with grain — perfect for chalkboard scenes.',
    roughness: 1.8,
    bowing: 0.6,
    defaultWidth: 8,
    pressureProfile: { peakAt: 0.5, minWidth: 0.3, sharpness: 1.4 },
    alphaJitter: 0.18,
    textureStyle: 'chalk',
    textureIntensity: 0.6,
    smoothIterations: 0,
    lineDash: [],
    lineCap: 'round',
  },
  brush: {
    id: 'brush',
    name: 'Brush',
    description: 'Wide, tapered brush strokes with strong pressure variation.',
    roughness: 0.9,
    bowing: 0.5,
    defaultWidth: 14,
    pressureProfile: { peakAt: 0.3, minWidth: 0.08, sharpness: 3.2 },
    alphaJitter: 0.08,
    textureStyle: 'grain',
    textureIntensity: 0.3,
    smoothIterations: 3,
    lineDash: [],
    lineCap: 'round',
  },
  highlighter: {
    id: 'highlighter',
    name: 'Highlighter',
    description: 'Broad, semi-transparent strokes for emphasis.',
    roughness: 0.3,
    bowing: 0.15,
    defaultWidth: 18,
    pressureProfile: { peakAt: 0.5, minWidth: 0.7, sharpness: 1.2 },
    alphaJitter: 0.03,
    textureStyle: 'none',
    textureIntensity: 0,
    smoothIterations: 2,
    lineDash: [],
    lineCap: 'square',
  },
}

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

/**
 * Mulberry32 — fast, high-quality seeded PRNG.
 * Returns a function that produces a new float in [0, 1) each call.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Pressure Curve ────────────────────────────────────────────────────────────

/**
 * Compute stroke width multiplier at position t (0–1) along a stroke.
 * Returns a value in [minWidth, 1.0] following a smooth pressure curve.
 */
export function strokePressure(t: number, opts: PressureOpts = {}): number {
  const peakAt = opts.peakAt ?? 0.4
  const minWidth = opts.minWidth ?? 0.25
  const sharpness = opts.sharpness ?? 2.5

  // Build a bell-like curve centered on peakAt
  const distFromPeak = Math.abs(t - peakAt)
  // Map distance [0, max(peakAt, 1-peakAt)] → pressure [1, minWidth]
  const maxDist = Math.max(peakAt, 1 - peakAt)
  const normalized = Math.min(distFromPeak / maxDist, 1)
  const pressure = 1 - (1 - minWidth) * Math.pow(normalized, sharpness)
  return Math.max(minWidth, Math.min(1, pressure))
}

// ── Alpha Jitter ──────────────────────────────────────────────────────────────

/**
 * Compute per-segment alpha with subtle jitter for an organic feel.
 * @param baseAlpha - The nominal alpha (0–1)
 * @param t - Position along the stroke (0–1)
 * @param rand - Seeded PRNG function
 * @param intensity - How much to jitter (0 = none, 1 = max)
 */
export function jitteredAlpha(
  baseAlpha: number,
  t: number,
  rand: () => number,
  intensity: number
): number {
  if (intensity <= 0) return baseAlpha
  const jitter = (rand() - 0.5) * 2 * intensity
  return Math.max(0.1, Math.min(1, baseAlpha + jitter))
}

// ── Pressure-Sensitive Stroke ─────────────────────────────────────────────────

/**
 * Draw a multi-segment stroke with pressure-sensitive width and alpha jitter.
 * Uses per-segment line calls to allow width variation along the path.
 *
 * @param ctx - Canvas 2D context
 * @param points - Array of [x, y] points defining the path
 * @param baseWidth - Nominal stroke width in pixels
 * @param color - CSS color string
 * @param pressureOpts - Pressure curve configuration
 * @param rand - Seeded PRNG for jitter
 * @param alphaJitter - Magnitude of alpha variation per segment
 */
export function drawSegmentWithPressure(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  baseWidth: number,
  color: string,
  pressureOpts: PressureOpts = {},
  rand: () => number,
  alphaJitter: number = 0
): void {
  if (points.length < 2) return

  const total = points.length - 1

  for (let i = 0; i < total; i++) {
    const t = i / Math.max(total - 1, 1)
    const tNext = (i + 1) / Math.max(total - 1, 1)

    const widthMid = strokePressure((t + tNext) / 2, pressureOpts) * baseWidth
    const alpha = jitteredAlpha(1, t, rand, alphaJitter)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.lineWidth = widthMid
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(points[i][0], points[i][1])
    ctx.lineTo(points[i + 1][0], points[i + 1][1])
    ctx.stroke()
    ctx.restore()
  }
}

// ── Path Smoothing ────────────────────────────────────────────────────────────

/**
 * Chaikin's algorithm for corner cutting / path smoothing.
 * Each iteration replaces each edge with two new points at 25% and 75% along it.
 *
 * @param points - Input control points
 * @param iterations - Number of refinement passes (default 2)
 * @param ratio - Cut ratio (default 0.25 — standard Chaikin)
 * @param closed - Whether the path is a closed polygon
 */
export function chaikinSmooth(
  points: [number, number][],
  iterations: number = 2,
  ratio: number = 0.25,
  closed: boolean = false
): [number, number][] {
  if (points.length < 3 || iterations <= 0) return points

  let pts = points.slice()

  for (let iter = 0; iter < iterations; iter++) {
    const newPts: [number, number][] = []
    const len = closed ? pts.length : pts.length - 1

    if (!closed) {
      // Keep first point as anchor
      newPts.push(pts[0])
    }

    for (let i = 0; i < len; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]

      const q: [number, number] = [
        a[0] + ratio * (b[0] - a[0]),
        a[1] + ratio * (b[1] - a[1]),
      ]
      const r: [number, number] = [
        b[0] - ratio * (b[0] - a[0]),
        b[1] - ratio * (b[1] - a[1]),
      ]

      newPts.push(q, r)
    }

    if (!closed) {
      // Keep last point as anchor
      newPts.push(pts[pts.length - 1])
    }

    pts = newPts
  }

  return pts
}

// ── Tool Resolution ───────────────────────────────────────────────────────────

/**
 * Resolve DrawOpts against selected tool defaults.
 * User-provided values override tool defaults.
 * Returns a fully-resolved options object with tool config merged in.
 */
export function applyTool(opts: DrawOpts): Required<Omit<DrawOpts, 'fill'>> & {
  fill: string | null
  toolConfig: DrawingTool
} {
  const toolId = opts.tool ?? 'pen'
  const toolConfig = DRAWING_TOOLS[toolId]

  return {
    color: opts.color ?? '#000000',
    width: opts.width ?? toolConfig.defaultWidth,
    roughness: opts.roughness ?? toolConfig.roughness,
    seed: opts.seed ?? 42,
    fill: opts.fill !== undefined ? opts.fill : null,
    fillAlpha: opts.fillAlpha ?? 0.15,
    tool: toolId,
    pressureOpts: opts.pressureOpts ?? toolConfig.pressureProfile,
    smooth: opts.smooth ?? (toolConfig.smoothIterations > 0),
    smoothIterations: opts.smoothIterations ?? toolConfig.smoothIterations,
    toolConfig,
  }
}

// ── Texture Generation ────────────────────────────────────────────────────────

interface TextureGenOpts {
  style: 'none' | 'grain' | 'paper' | 'chalk'
  intensity?: number
}

/**
 * Generate a noise texture canvas using seeded PRNG.
 * Runs ONCE per scene — cache the result.
 *
 * @param width - Texture width in pixels
 * @param height - Texture height in pixels
 * @param seed - Fixed seed for deterministic output
 * @param opts - Texture style and intensity
 * @returns An OffscreenCanvas or null if style is 'none'
 */
export function generateTextureCanvas(
  width: number,
  height: number,
  seed: number,
  opts: TextureGenOpts
): OffscreenCanvas | null {
  if (opts.style === 'none') return null

  const intensity = opts.intensity ?? 0.3
  const rand = mulberry32(seed)

  // Use OffscreenCanvas for non-blocking texture generation
  let offscreen: OffscreenCanvas
  try {
    offscreen = new OffscreenCanvas(width, height)
  } catch {
    // Fallback: create a regular canvas if OffscreenCanvas unavailable
    const el = document.createElement('canvas')
    el.width = width
    el.height = height
    offscreen = el as unknown as OffscreenCanvas
  }

  const octx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D
  const imageData = octx.createImageData(width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    let noiseVal = 0

    if (opts.style === 'grain') {
      // Fine film grain
      noiseVal = rand() * intensity
    } else if (opts.style === 'paper') {
      // Coarser paper texture — blend multiple frequencies
      const coarse = rand() * 0.6
      const fine = rand() * 0.4
      noiseVal = (coarse + fine) * intensity * 0.5
    } else if (opts.style === 'chalk') {
      // Chalk dust: sparse bright specks on dark background
      const v = rand()
      noiseVal = v < 0.12 ? v * intensity * 2 : 0
    }

    const luminance = Math.floor(noiseVal * 255)
    data[i] = luminance
    data[i + 1] = luminance
    data[i + 2] = luminance
    // Alpha: low opacity so it overlays without covering the drawing
    data[i + 3] = Math.floor(intensity * 60)
  }

  octx.putImageData(imageData, 0, 0)
  return offscreen
}

// Texture cache — keyed by "style:seed:width:height"
const _textureCache = new Map<string, OffscreenCanvas | null>()

/**
 * Apply a texture overlay to a target canvas.
 * Texture is generated once and cached for the session.
 *
 * @param targetCanvas - The canvas to composite the texture onto
 * @param textureStyle - Which texture style to apply
 * @param seed - Fixed seed for determinism
 */
export function applyTextureOverlay(
  targetCanvas: HTMLCanvasElement,
  textureStyle: 'none' | 'grain' | 'paper' | 'chalk',
  seed: number
): void {
  if (textureStyle === 'none') return

  const key = `${textureStyle}:${seed}:${targetCanvas.width}:${targetCanvas.height}`

  let texture: OffscreenCanvas | null
  if (_textureCache.has(key)) {
    texture = _textureCache.get(key)!
  } else {
    texture = generateTextureCanvas(targetCanvas.width, targetCanvas.height, seed, {
      style: textureStyle,
      intensity: DRAWING_TOOLS[textureStyle as DrawTool]?.textureIntensity ?? 0.3,
    })
    _textureCache.set(key, texture)
  }

  if (!texture) return

  const ctx = targetCanvas.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(texture as unknown as CanvasImageSource, 0, 0)
  ctx.restore()
}

// ── Hand-drawn Point Generation ───────────────────────────────────────────────

/**
 * Wobble a straight line between two points into a hand-drawn-looking
 * sequence of points. Uses roughness to control wobble magnitude and
 * bowing to add a gentle curve to the baseline.
 */
function wobbleLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  roughness: number,
  bowing: number,
  numPoints: number,
  rand: () => number
): [number, number][] {
  const pts: [number, number][] = []
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)

  // Perpendicular unit vector for bowing
  const perpX = -dy / len
  const perpY = dx / len

  const bowAmount = bowing * len * 0.06

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    // Linear interpolation along the line
    const bx = x1 + t * dx
    const by = y1 + t * dy

    // Apply bow (parabolic offset perpendicular to the line)
    const bowFactor = 4 * t * (1 - t) * bowAmount

    // Apply roughness wobble — magnitude proportional to line length and roughness
    const wobbleMag = roughness * Math.max(1, len * 0.008)
    const wx = (rand() - 0.5) * 2 * wobbleMag
    const wy = (rand() - 0.5) * 2 * wobbleMag

    pts.push([
      bx + perpX * bowFactor + wx,
      by + perpY * bowFactor + wy,
    ])
  }

  return pts
}

/**
 * Generate points for a hand-drawn circle approximation.
 * Produces numPoints around the circumference with radial wobble.
 */
function wobbleCircle(
  cx: number,
  cy: number,
  radius: number,
  roughness: number,
  numPoints: number,
  rand: () => number
): [number, number][] {
  const pts: [number, number][] = []
  // Slightly overrun to close the circle naturally
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2
    const wobbleMag = roughness * Math.max(1, radius * 0.04)
    const r = radius + (rand() - 0.5) * 2 * wobbleMag
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
  }
  return pts
}

// ── Animation Helpers ─────────────────────────────────────────────────────────

/**
 * Simple promise-based delay.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Animate drawing of points progressively over a duration.
 * Resolves when the full stroke is drawn.
 *
 * @param ctx - Canvas 2D context
 * @param allPoints - Full set of points to draw
 * @param baseWidth - Base stroke width
 * @param color - Stroke color
 * @param pressureOpts - Pressure profile
 * @param rand - Seeded PRNG
 * @param alphaJitter - Alpha variation intensity
 * @param duration - Total animation duration in ms
 * @param lineDash - Optional dash pattern
 * @param lineCap - Line cap style
 */
function animatePoints(
  ctx: CanvasRenderingContext2D,
  allPoints: [number, number][],
  baseWidth: number,
  color: string,
  pressureOpts: PressureOpts,
  rand: () => number,
  alphaJitter: number,
  duration: number,
  lineDash: number[] = [],
  lineCap: CanvasLineCap = 'round'
): Promise<void> {
  return new Promise((resolve) => {
    const total = allPoints.length
    if (total < 2) {
      resolve()
      return
    }

    const startTime = performance.now()
    let drawnUpTo = 0

    function frame() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const targetIndex = Math.floor(progress * (total - 1)) + 1

      if (targetIndex > drawnUpTo) {
        // Draw only the new segments since last frame
        const segStart = Math.max(0, drawnUpTo - 1)
        const segPoints = allPoints.slice(segStart, targetIndex + 1)

        ctx.save()
        ctx.setLineDash(lineDash)
        ctx.lineCap = lineCap

        // Re-derive pressure positions relative to full stroke
        const adjustedPoints: [number, number][] = segPoints.map((p, i) => p)

        // Draw each new segment with pressure relative to full stroke position
        for (let i = 0; i < segPoints.length - 1; i++) {
          const globalT = (segStart + i) / Math.max(total - 2, 1)
          const globalTNext = (segStart + i + 1) / Math.max(total - 2, 1)
          const widthMid = strokePressure((globalT + globalTNext) / 2, pressureOpts) * baseWidth
          const alpha = jitteredAlpha(1, globalT, rand, alphaJitter)

          ctx.globalAlpha = alpha
          ctx.lineWidth = widthMid
          ctx.strokeStyle = color
          ctx.lineCap = lineCap
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(segPoints[i][0], segPoints[i][1])
          ctx.lineTo(segPoints[i + 1][0], segPoints[i + 1][1])
          ctx.stroke()
        }

        ctx.restore()
        drawnUpTo = targetIndex
      }

      if (progress < 1) {
        requestAnimationFrame(frame)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(frame)
  })
}

// ── Drawing Primitives ────────────────────────────────────────────────────────

/**
 * Draw a hand-drawn line from (x1,y1) to (x2,y2) with pressure and wobble.
 *
 * @param ctx - Canvas 2D context
 * @param x1 - Start x
 * @param y1 - Start y
 * @param x2 - End x
 * @param y2 - End y
 * @param opts - Drawing options
 * @param duration - Animation duration in milliseconds
 */
export async function animateRoughLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: DrawOpts = {},
  duration: number = 600
): Promise<void> {
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  const numPoints = Math.max(8, Math.floor(len / 6))

  let points = wobbleLine(
    x1, y1, x2, y2,
    resolved.roughness,
    resolved.toolConfig.bowing,
    numPoints,
    rand
  )

  if (resolved.smooth && resolved.smoothIterations > 0) {
    points = chaikinSmooth(points, resolved.smoothIterations)
  }

  await animatePoints(
    ctx, points, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  )
}

/**
 * Draw a hand-drawn circle.
 *
 * @param ctx - Canvas 2D context
 * @param cx - Center x
 * @param cy - Center y
 * @param diameter - Circle diameter in pixels
 * @param opts - Drawing options
 * @param duration - Animation duration in milliseconds
 */
export async function animateRoughCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter: number,
  opts: DrawOpts = {},
  duration: number = 800
): Promise<void> {
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)
  const radius = diameter / 2
  const numPoints = Math.max(32, Math.floor(radius * 0.5))

  let points = wobbleCircle(cx, cy, radius, resolved.roughness, numPoints, rand)

  if (resolved.smooth && resolved.smoothIterations > 0) {
    points = chaikinSmooth(points, resolved.smoothIterations, 0.25, true)
  }

  // Draw fill first if requested
  if (resolved.fill) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1])
    }
    ctx.closePath()
    ctx.fillStyle = resolved.fill
    ctx.globalAlpha = resolved.fillAlpha
    ctx.fill()
    ctx.restore()
  }

  await animatePoints(
    ctx, points, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  )
}

/**
 * Draw a hand-drawn rectangle.
 *
 * @param ctx - Canvas 2D context
 * @param x - Top-left x
 * @param y - Top-left y
 * @param w - Width
 * @param h - Height
 * @param opts - Drawing options
 * @param duration - Animation duration in milliseconds
 */
export async function animateRoughRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: DrawOpts = {},
  duration: number = 700
): Promise<void> {
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)

  // Build corners
  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y], // close
  ]

  // Generate wobbly points for each edge
  let allPoints: [number, number][] = []
  const edgeSeed = mulberry32(resolved.seed + 1)

  for (let i = 0; i < corners.length - 1; i++) {
    const [ax, ay] = corners[i]
    const [bx, by] = corners[i + 1]
    const edgeLen = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
    const numPoints = Math.max(4, Math.floor(edgeLen / 8))

    const edgePoints = wobbleLine(
      ax, ay, bx, by,
      resolved.roughness,
      resolved.toolConfig.bowing * 0.4,
      numPoints,
      edgeSeed
    )

    // Avoid duplicate junction points
    if (allPoints.length > 0) {
      allPoints = allPoints.concat(edgePoints.slice(1))
    } else {
      allPoints = edgePoints
    }
  }

  if (resolved.smooth && resolved.smoothIterations > 0) {
    allPoints = chaikinSmooth(allPoints, Math.max(1, resolved.smoothIterations - 1))
  }

  // Draw fill first if requested
  if (resolved.fill) {
    ctx.save()
    ctx.fillStyle = resolved.fill
    ctx.globalAlpha = resolved.fillAlpha
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  }

  await animatePoints(
    ctx, allPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  )
}

/**
 * Draw a hand-drawn polygon from an array of vertices.
 * Applies Chaikin smoothing for organic corners.
 *
 * @param ctx - Canvas 2D context
 * @param points - Array of [x, y] vertex coordinates
 * @param opts - Drawing options
 * @param duration - Animation duration in milliseconds
 */
export async function animateRoughPolygon(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  opts: DrawOpts = {},
  duration: number = 900
): Promise<void> {
  if (points.length < 3) return
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)

  // Close the polygon
  const closed = [...points, points[0]] as [number, number][]

  // Wobble each edge
  let allPoints: [number, number][] = []
  const edgeSeed = mulberry32(resolved.seed + 7)

  for (let i = 0; i < closed.length - 1; i++) {
    const [ax, ay] = closed[i]
    const [bx, by] = closed[i + 1]
    const edgeLen = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
    const numPts = Math.max(3, Math.floor(edgeLen / 8))

    const edgePoints = wobbleLine(
      ax, ay, bx, by,
      resolved.roughness,
      resolved.toolConfig.bowing * 0.3,
      numPts,
      edgeSeed
    )

    if (allPoints.length > 0) {
      allPoints = allPoints.concat(edgePoints.slice(1))
    } else {
      allPoints = edgePoints
    }
  }

  if (resolved.smooth && resolved.smoothIterations > 0) {
    allPoints = chaikinSmooth(allPoints, resolved.smoothIterations, 0.25, true)
  }

  // Draw fill if requested
  if (resolved.fill) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1])
    }
    ctx.closePath()
    ctx.fillStyle = resolved.fill
    ctx.globalAlpha = resolved.fillAlpha
    ctx.fill()
    ctx.restore()
  }

  await animatePoints(
    ctx, allPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  )
}

/**
 * Draw a hand-drawn freeform curve through control points.
 * Control points are smoothed before rendering.
 *
 * @param ctx - Canvas 2D context
 * @param points - Control points [x, y][]
 * @param opts - Drawing options
 * @param duration - Animation duration in milliseconds
 */
export async function animateRoughCurve(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  opts: DrawOpts = {},
  duration: number = 700
): Promise<void> {
  if (points.length < 2) return
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)

  // Apply strong smoothing to curve points, then wobble
  const iterations = Math.max(2, resolved.smoothIterations + 1)
  const smoothed = chaikinSmooth(points, iterations)

  // Add roughness wobble to smoothed points
  const wobbled: [number, number][] = smoothed.map((p, i) => {
    const wobbleMag = resolved.roughness * 3
    return [
      p[0] + (rand() - 0.5) * wobbleMag,
      p[1] + (rand() - 0.5) * wobbleMag,
    ]
  })

  await animatePoints(
    ctx, wobbled, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  )
}

/**
 * Draw a hand-drawn arrow from (x1,y1) to (x2,y2) with an arrowhead.
 *
 * @param ctx - Canvas 2D context
 * @param x1 - Start x
 * @param y1 - Start y
 * @param x2 - End x
 * @param y2 - End y
 * @param opts - Drawing options
 * @param duration - Total animation duration in milliseconds (split: 80% shaft, 20% head)
 */
export async function animateRoughArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: DrawOpts = {},
  duration: number = 700
): Promise<void> {
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)

  // Draw shaft at 80% of duration
  const shaftDuration = duration * 0.8
  const headDuration = duration * 0.2

  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  const numPoints = Math.max(8, Math.floor(len / 6))

  let shaftPoints = wobbleLine(
    x1, y1, x2, y2,
    resolved.roughness,
    resolved.toolConfig.bowing,
    numPoints,
    rand
  )

  if (resolved.smooth && resolved.smoothIterations > 0) {
    shaftPoints = chaikinSmooth(shaftPoints, resolved.smoothIterations)
  }

  await animatePoints(
    ctx, shaftPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    shaftDuration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  )

  // Draw arrowhead
  const headRand = mulberry32(resolved.seed + 100)
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headSize = Math.max(12, resolved.width * 3.5)
  const spread = Math.PI / 6

  const leftX = x2 - Math.cos(angle - spread) * headSize
  const leftY = y2 - Math.sin(angle - spread) * headSize
  const rightX = x2 - Math.cos(angle + spread) * headSize
  const rightY = y2 - Math.sin(angle + spread) * headSize

  // Left wing
  const leftPoints = wobbleLine(
    x2, y2, leftX, leftY,
    resolved.roughness * 0.8,
    0,
    4,
    headRand
  )
  // Right wing
  const rightPoints = wobbleLine(
    x2, y2, rightX, rightY,
    resolved.roughness * 0.8,
    0,
    4,
    headRand
  )

  const headPoints: [number, number][] = [...leftPoints, ...rightPoints.slice(1)]

  await animatePoints(
    ctx, headPoints, resolved.width, resolved.color,
    { ...resolved.pressureOpts, minWidth: 0.5 }, headRand,
    resolved.toolConfig.alphaJitter,
    headDuration,
    [],
    'round'
  )
}

// ── Smooth Primitives (no wobble) ─────────────────────────────────────────────

/**
 * Animate a perfectly smooth line from (x1,y1) to (x2,y2).
 * No roughness or wobble applied.
 *
 * @param ctx - Canvas 2D context
 * @param x1 - Start x
 * @param y1 - Start y
 * @param x2 - End x
 * @param y2 - End y
 * @param opts - Drawing options (tool ignored for wobble, used for width/color)
 * @param duration - Animation duration in milliseconds
 */
export async function animateLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: DrawOpts = {},
  duration: number = 500
): Promise<void> {
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  const numPoints = Math.max(8, Math.floor(len / 4))

  const points: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    points.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)])
  }

  await animatePoints(
    ctx, points, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    0, // no alpha jitter
    duration,
    [],
    'round'
  )
}

/**
 * Animate a smooth circle (no roughness).
 *
 * @param ctx - Canvas 2D context
 * @param cx - Center x
 * @param cy - Center y
 * @param r - Radius in pixels
 * @param opts - Drawing options
 * @param duration - Animation duration in milliseconds
 */
export async function animateCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts: DrawOpts = {},
  duration: number = 600
): Promise<void> {
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)
  const numPoints = Math.max(32, Math.floor(r * 0.5))

  const points: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
  }

  if (resolved.fill) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = resolved.fill
    ctx.globalAlpha = resolved.fillAlpha
    ctx.fill()
    ctx.restore()
  }

  await animatePoints(
    ctx, points, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    0,
    duration,
    [],
    'round'
  )
}

/**
 * Animate a smooth arrow from (x1,y1) to (x2,y2).
 *
 * @param ctx - Canvas 2D context
 * @param x1 - Start x
 * @param y1 - Start y
 * @param x2 - End x
 * @param y2 - End y
 * @param opts - Drawing options
 * @param duration - Animation duration in milliseconds
 */
export async function animateArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: DrawOpts = {},
  duration: number = 500
): Promise<void> {
  const resolved = applyTool(opts)
  const rand = mulberry32(resolved.seed)

  const shaftDuration = duration * 0.8
  const headDuration = duration * 0.2

  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  const numPoints = Math.max(8, Math.floor(len / 4))

  const shaftPoints: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    shaftPoints.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)])
  }

  await animatePoints(
    ctx, shaftPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    0,
    shaftDuration,
    [],
    'round'
  )

  // Draw arrowhead instantly
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headSize = Math.max(12, resolved.width * 3.5)
  const spread = Math.PI / 6

  ctx.save()
  ctx.strokeStyle = resolved.color
  ctx.lineWidth = resolved.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x2 - Math.cos(angle - spread) * headSize, y2 - Math.sin(angle - spread) * headSize)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x2 - Math.cos(angle + spread) * headSize, y2 - Math.sin(angle + spread) * headSize)
  ctx.stroke()
  ctx.restore()

  await wait(headDuration)
}

// ── Text Rendering ────────────────────────────────────────────────────────────

/**
 * Render text to the canvas instantly (no character animation).
 * If `delay` is provided, the text appears after a setTimeout.
 * Text ALWAYS appears as a complete unit — never animated character by character.
 *
 * @param ctx - Canvas 2D context
 * @param text - Text content to render
 * @param x - X position
 * @param y - Y position
 * @param opts - Text rendering options
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    size?: number
    color?: string
    weight?: string
    align?: CanvasTextAlign
    font?: string
    delay?: number
  } = {}
): void {
  const size = opts.size ?? 32
  const color = opts.color ?? '#000000'
  const weight = opts.weight ?? 'normal'
  const align = opts.align ?? 'left'
  const fontFamily = opts.font ?? 'sans-serif'
  const delay = opts.delay ?? 0

  const render = () => {
    ctx.save()
    ctx.font = `${weight} ${size}px ${fontFamily}`
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  if (delay > 0) {
    setTimeout(render, delay)
  } else {
    render()
  }
}

// ── Fade-in Fill ──────────────────────────────────────────────────────────────

/**
 * Fade in a filled shape by repeatedly calling a draw function while
 * ramping globalAlpha from 0 to the target alpha over the duration.
 *
 * @param ctx - Canvas 2D context
 * @param drawFn - Function that draws the shape (called each frame)
 * @param color - Fill color
 * @param alpha - Target alpha (0–1)
 * @param duration - Fade duration in milliseconds
 */
export function fadeInFill(
  ctx: CanvasRenderingContext2D,
  drawFn: (ctx: CanvasRenderingContext2D) => void,
  color: string,
  alpha: number,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = performance.now()

    function frame() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      ctx.save()
      ctx.fillStyle = color
      ctx.globalAlpha = eased * alpha
      drawFn(ctx)
      ctx.restore()

      if (progress < 1) {
        requestAnimationFrame(frame)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(frame)
  })
}

// ── Asset Drawing Placeholder ─────────────────────────────────────────────────

/**
 * Draw an asset (image, sprite, etc.) by its asset ID.
 * This is a placeholder — the actual asset loading mechanism
 * is handled by the embedding scene at runtime.
 *
 * @param ctx - Canvas 2D context
 * @param assetId - Asset identifier to look up
 * @param opts - Placement and rendering options
 */
export async function drawAsset(
  ctx: CanvasRenderingContext2D,
  assetId: string,
  opts: {
    x?: number
    y?: number
    width?: number
    height?: number
    opacity?: number
  } = {}
): Promise<void> {
  const x = opts.x ?? 0
  const y = opts.y ?? 0
  const width = opts.width ?? 100
  const height = opts.height ?? 100
  const opacity = opts.opacity ?? 1

  // Look for a pre-loaded asset on window
  const assets = (window as any).__cenchAssets ?? {}
  const img = assets[assetId]

  if (img instanceof HTMLImageElement && img.complete) {
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.drawImage(img, x, y, width, height)
    ctx.restore()
    return
  }

  // Asset not found — draw a placeholder rectangle
  ctx.save()
  ctx.globalAlpha = opacity * 0.3
  ctx.fillStyle = '#888888'
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = '#555555'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = opacity * 0.6
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`asset:${assetId}`, x + width / 2, y + height / 2)
  ctx.restore()
}

/**
 * Extract structured element metadata from React scene code (reactCode).
 *
 * React scenes embed everything in JSX — text, charts, 3D layers, etc.
 * This module parses the code string with regex heuristics to derive
 * structured metadata for the node map and layer stack.
 *
 * This is best-effort: it catches common patterns the agent produces
 * but won't handle every possible JSX structure.
 */

export interface ReactCodeElement {
  kind: 'three' | 'canvas2d' | 'd3' | 'svg' | 'lottie' | 'text' | 'image' | 'heading' | 'paragraph'
  label: string
  /** Optional props extracted from JSX */
  props?: Record<string, string>
}

/**
 * Scan reactCode for known bridge components and common JSX patterns.
 * Returns a flat list of detected elements.
 */
export function extractElementsFromReactCode(reactCode: string | undefined): ReactCodeElement[] {
  if (!reactCode?.trim()) return []
  const elements: ReactCodeElement[] = []

  // ── Bridge components ──────────────────────────────────────────────────
  // <ThreeJSLayer ... />  or <ThreeJSLayer>...</ThreeJSLayer>
  const threeMatches = reactCode.matchAll(/<ThreeJSLayer\b([^>]*)\/?>/g)
  for (const m of threeMatches) {
    const label = extractProp(m[1], 'label') || extractProp(m[1], 'name') || 'Three.js Layer'
    elements.push({ kind: 'three', label, props: extractAllProps(m[1]) })
  }

  // <Canvas2DLayer ... />
  const canvasMatches = reactCode.matchAll(/<Canvas2DLayer\b([^>]*)\/?>/g)
  for (const m of canvasMatches) {
    const label = extractProp(m[1], 'label') || extractProp(m[1], 'name') || 'Canvas 2D Layer'
    elements.push({ kind: 'canvas2d', label, props: extractAllProps(m[1]) })
  }

  // <D3Layer ... />
  const d3Matches = reactCode.matchAll(/<D3Layer\b([^>]*)\/?>/g)
  for (const m of d3Matches) {
    const label = extractProp(m[1], 'label') || extractProp(m[1], 'name') || 'D3 Layer'
    elements.push({ kind: 'd3', label, props: extractAllProps(m[1]) })
  }

  // <SVGLayer ... />
  const svgMatches = reactCode.matchAll(/<SVGLayer\b([^>]*)\/?>/g)
  for (const m of svgMatches) {
    const label = extractProp(m[1], 'label') || extractProp(m[1], 'name') || 'SVG Layer'
    elements.push({ kind: 'svg', label, props: extractAllProps(m[1]) })
  }

  // <LottieLayer ... />
  const lottieMatches = reactCode.matchAll(/<LottieLayer\b([^>]*)\/?>/g)
  for (const m of lottieMatches) {
    const label = extractProp(m[1], 'label') || extractProp(m[1], 'name') || 'Lottie Layer'
    elements.push({ kind: 'lottie', label, props: extractAllProps(m[1]) })
  }

  // ── Common JSX text patterns ───────────────────────────────────────────
  // <h1>...</h1>, <h2>...</h2>, etc.
  const headingMatches = reactCode.matchAll(/<(h[1-6])\b[^>]*>([^<]{1,80})<\/\1>/g)
  for (const m of headingMatches) {
    const text = m[2].trim()
    if (text) elements.push({ kind: 'heading', label: `${m[1].toUpperCase()}: ${text.slice(0, 40)}` })
  }

  // <p>...</p> (first few, skip very short ones)
  const pMatches = reactCode.matchAll(/<p\b[^>]*>([^<]{8,120})<\/p>/g)
  let pCount = 0
  for (const m of pMatches) {
    if (pCount >= 3) break
    const text = m[1].trim()
    if (text) {
      elements.push({ kind: 'paragraph', label: text.slice(0, 40) + (text.length > 40 ? '...' : '') })
      pCount++
    }
  }

  // <img src="..." /> or <img ... alt="..." />
  const imgMatches = reactCode.matchAll(/<img\b([^>]*)\/?>/g)
  for (const m of imgMatches) {
    const alt = extractProp(m[1], 'alt') || 'Image'
    elements.push({ kind: 'image', label: alt.slice(0, 30) })
  }

  // ── Three.js patterns in raw code ──────────────────────────────────────
  // new THREE.Mesh, new THREE.BoxGeometry, scene.add, etc.
  const threeMeshes = reactCode.matchAll(/new\s+THREE\.(\w*(?:Mesh|Light|Group|Camera|Scene))\b/g)
  const threeSet = new Set<string>()
  for (const m of threeMeshes) {
    if (!threeSet.has(m[1])) {
      threeSet.add(m[1])
      elements.push({ kind: 'three', label: m[1] })
    }
  }

  // THREE geometry objects (BoxGeometry, SphereGeometry, etc.)
  const threeGeo = reactCode.matchAll(/new\s+THREE\.(\w*Geometry)\b/g)
  for (const m of threeGeo) {
    if (!threeSet.has(m[1])) {
      threeSet.add(m[1])
      elements.push({ kind: 'three', label: m[1] })
    }
  }

  // ── Inline SVG in code ─────────────────────────────────────────────────
  const svgCount = (reactCode.match(/<svg\b/g) ?? []).length
  if (svgCount > 0 && !elements.some((e) => e.kind === 'svg')) {
    elements.push({ kind: 'svg', label: `Inline SVG (${svgCount})` })
  }

  // ── Canvas drawing patterns ────────────────────────────────────────────
  if (reactCode.includes('getContext') || reactCode.includes('ctx.fill') || reactCode.includes('ctx.stroke')) {
    if (!elements.some((e) => e.kind === 'canvas2d')) {
      elements.push({ kind: 'canvas2d', label: 'Canvas 2D Drawing' })
    }
  }

  // ── GSAP / anime.js animation ──────────────────────────────────────────
  if (reactCode.includes('gsap.') || reactCode.includes('anime(')) {
    elements.push({ kind: 'text', label: 'Animation (GSAP/Anime)' })
  }

  return elements
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractProp(propsStr: string, name: string): string | null {
  // Match name="value" or name='value'
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`)
  const m = propsStr.match(re)
  return m?.[1] ?? null
}

/**
 * Rewrite the text content of the Nth unique heading / paragraph / image-alt
 * in React scene code. Mirrors the dedup semantics of `extractElementsFromReactCode`
 * (same kind + same text counts as one node). Returns the rewritten code, or
 * `null` if no matching element was found.
 *
 * Source-level fallback used by the Layers tab when the iframe registry
 * doesn't have a live DOM match for an rx:* node.
 *
 * Limitations:
 *  - Only handles plain-text children (no nested tags inside the heading/paragraph).
 *  - New text is escaped for JSX: `<`, `>`, `{`, `}` become entities.
 */
export type PatchableKind = 'heading' | 'paragraph' | 'image'

export function patchReactCodeText(code: string, kind: PatchableKind, index: number, newText: string): string | null {
  if (!code) return null
  const safe = escapeForJsxText(newText)

  if (kind === 'heading') {
    return rewriteDeduped(code, /<(h[1-6])\b([^>]*)>([^<]{1,80})<\/\1>/g, index, (match) => {
      const [, level, attrs, text] = match
      return { anchor: text, replacement: `<${level}${attrs}>${safe}</${level}>` }
    })
  }

  if (kind === 'paragraph') {
    return rewriteDeduped(code, /<p\b([^>]*)>([^<]{8,120})<\/p>/g, index, (match) => {
      const [, attrs, text] = match
      return { anchor: text, replacement: `<p${attrs}>${safe}</p>` }
    })
  }

  if (kind === 'image') {
    // Image label is the alt attribute — rewrite alt on the Nth unique <img>.
    return rewriteDeduped(code, /<img\b([^>]*?)\s*\/?>/g, index, (match) => {
      const [, attrs] = match
      const alt = (attrs.match(/\balt\s*=\s*["']([^"']*)["']/) ?? [])[1] ?? ''
      const trimmed = attrs.trimEnd()
      const rewritten = / alt\s*=\s*["'][^"']*["']/.test(trimmed)
        ? trimmed.replace(/\balt\s*=\s*["'][^"']*["']/, `alt="${safe.replace(/"/g, '&quot;')}"`)
        : `${trimmed}${trimmed ? ' ' : ''}alt="${safe.replace(/"/g, '&quot;')}"`
      return { anchor: alt, replacement: `<img ${rewritten.trimStart()}/>` }
    })
  }

  return null
}

/**
 * Convert a node-map rx:* global index to the per-kind index expected by
 * `patchReactCodeText` / `readReactCodeText`.
 *
 * The node-map UI emits keys `rx:${kind}:${idx}` where `idx` is a single
 * counter shared across all rx kinds (heading, paragraph, image, three,
 * canvas2d, …). The patch helpers want the index of the target heading
 * within headings only. This walks the extractor output exactly like the
 * UI does (dedup by `${kind}:${label}`) and returns how many same-kind
 * elements precede the one at the global index.
 *
 * Returns `null` when the global index isn't present, or the element at
 * that index doesn't match `rxKind`.
 */
export function rxGlobalIndexToPerKindIndex(code: string, rxKind: string, globalIdx: number): number | null {
  if (!code) return null
  const elements = extractElementsFromReactCode(code)
  const seen = new Set<string>()
  let g = 0
  let perKind = 0
  for (const el of elements) {
    const dedupKey = `${el.kind}:${el.label}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    if (g === globalIdx) return el.kind === rxKind ? perKind : null
    if (el.kind === rxKind) perKind++
    g++
  }
  return null
}

/**
 * Read the source text of the Nth unique match of a patchable element.
 * Returns `null` when the match isn't found. Mirrors the dedup semantics
 * used by `patchReactCodeText` so the getter/setter pair stays aligned.
 *
 * Note: `index` is the per-kind unique index, NOT the node-map global
 * index. Callers working from an `rx:${kind}:${idx}` node key should first
 * convert with `rxGlobalIndexToPerKindIndex`.
 */
export function readReactCodeText(code: string, kind: PatchableKind, index: number): string | null {
  if (!code) return null
  const patterns: Record<PatchableKind, RegExp> = {
    heading: /<(h[1-6])\b[^>]*>([^<]{1,80})<\/\1>/g,
    paragraph: /<p\b[^>]*>([^<]{8,120})<\/p>/g,
    image: /<img\b([^>]*?)\s*\/?>/g,
  }
  const pattern = patterns[kind]
  pattern.lastIndex = 0
  const seen = new Set<string>()
  let uniqueIdx = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(code)) !== null) {
    const anchor =
      kind === 'image'
        ? ((match[1].match(/\balt\s*=\s*["']([^"']*)["']/) ?? [])[1] ?? '')
        : kind === 'heading'
          ? match[2]
          : match[1]
    if (seen.has(anchor)) continue
    seen.add(anchor)
    if (uniqueIdx === index) return anchor
    uniqueIdx++
  }
  return null
}

function rewriteDeduped(
  code: string,
  pattern: RegExp,
  index: number,
  build: (match: RegExpExecArray) => { anchor: string; replacement: string },
): string | null {
  const seen = new Set<string>()
  let uniqueIdx = 0
  let match: RegExpExecArray | null
  pattern.lastIndex = 0
  while ((match = pattern.exec(code)) !== null) {
    const { anchor, replacement } = build(match)
    if (seen.has(anchor)) continue
    seen.add(anchor)
    if (uniqueIdx === index) {
      return code.slice(0, match.index) + replacement + code.slice(match.index + match[0].length)
    }
    uniqueIdx++
  }
  return null
}

function escapeForJsxText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

function extractAllProps(propsStr: string): Record<string, string> {
  const props: Record<string, string> = {}
  const re = /(\w+)\s*=\s*["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(propsStr)) !== null) {
    props[m[1]] = m[2]
  }
  return props
}

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

function extractAllProps(propsStr: string): Record<string, string> {
  const props: Record<string, string> = {}
  const re = /(\w+)\s*=\s*["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(propsStr)) !== null) {
    props[m[1]] = m[2]
  }
  return props
}

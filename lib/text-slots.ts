/**
 * Unified enumeration and updates for editable text across scene sources
 * (overlays, SVG <text>, interactions, physics copy).
 */

import { compileD3SceneFromLayers } from './charts/compile'
import { deriveChartLayersFromScene } from './charts/extract'
import { compilePhysicsSceneFromLayers } from './physics/compile'
import type { D3ChartLayer, InteractionElement, PhysicsLayer, Scene, SvgObject } from './types'
import type { SceneElement } from './types/elements'

export type TextSlotKind = 'overlay' | 'svg_text' | 'interaction' | 'physics' | 'chart' | 'dom_text'

/** Slot key shape: `chart:{layerId}:title` */
export function parseChartTitleSlotKey(key: string): { layerId: string } | null {
  const m = /^chart:([^:]+):title$/.exec(key)
  return m ? { layerId: m[1] } : null
}

/** Resolved chart title string for UI (config.title or layer name). */
export function chartLayerTitleLine(layer: D3ChartLayer): string {
  const cfg = (layer.config || {}) as Record<string, unknown>
  const t = cfg.title
  if (typeof t === 'string' && t.trim()) return t.trim()
  return (layer.name || '').trim()
}

export interface TextSlot {
  key: string
  kind: TextSlotKind
  label: string
  preview: string
  badge: string
}

/**
 * Synthetic `svg:{id}` layer id for the scene root `svgContent` row in the layer stack
 * (so main SVG &lt;text&gt; nodes appear as sub-rows).
 */
export const MAIN_SCENE_SVG_LAYER_ID = '__cench_scene_svg__'

/** List &lt;text&gt; elements in an SVG fragment (same rules as Text tab slots). */
export function listSvgTextElementsInMarkup(svgMarkup: string): { ref: string; preview: string }[] {
  return listTextInSvgMarkup(svgMarkup)
}

/** SSR-safe: whether markup probably contains &lt;text&gt; (for layer stack ordering without DOMParser). */
export function svgMarkupLikelyHasTextElements(svgMarkup: string): boolean {
  return /<text\b/i.test((svgMarkup || '').trim())
}

/** Id stored in `Scene.layerHiddenIds` for Text-tab visibility. Overlays use `text:{id}` so the layer stack stays in sync. */
export function layerHiddenIdForTextSlot(slotKey: string): string {
  if (slotKey.startsWith('overlay:')) {
    return `text:${slotKey.slice('overlay:'.length)}`
  }
  return `ts:${encodeURIComponent(slotKey)}`
}

function listTextInSvgMarkup(svgMarkup: string): { ref: string; preview: string }[] {
  if (!svgMarkup?.trim() || typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
    if (doc.querySelector('parsererror')) return []
    const texts = Array.from(doc.querySelectorAll('text'))
    return texts.map((t, i) => {
      const idAttr = t.getAttribute('id')?.trim()
      const ref = idAttr && idAttr.length > 0 ? idAttr : `__idx_${i}`
      const preview = (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 72)
      return { ref, preview }
    })
  } catch {
    return []
  }
}

function getSvgTextAtRef(svgMarkup: string, elementRef: string): string {
  if (!svgMarkup?.trim() || typeof DOMParser === 'undefined') return ''
  try {
    const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
    if (doc.querySelector('parsererror')) return ''
    const texts = Array.from(doc.querySelectorAll('text'))
    let el: Element | null = null
    if (elementRef.startsWith('__idx_')) {
      const i = parseInt(elementRef.slice(6), 10)
      if (!Number.isNaN(i)) el = texts[i] ?? null
    } else {
      el = doc.getElementById(elementRef)
    }
    return el?.textContent ?? ''
  } catch {
    return ''
  }
}

function setSvgTextContent(svgMarkup: string, elementRef: string, newText: string): string {
  if (!svgMarkup?.trim() || typeof DOMParser === 'undefined') return svgMarkup
  try {
    const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
    if (doc.querySelector('parsererror')) return svgMarkup
    const texts = Array.from(doc.querySelectorAll('text'))
    let el: Element | null = null
    if (elementRef.startsWith('__idx_')) {
      const i = parseInt(elementRef.slice(6), 10)
      if (!Number.isNaN(i)) el = texts[i] ?? null
    } else {
      el = doc.getElementById(elementRef)
    }
    if (!el) return svgMarkup
    el.textContent = newText
    const root = doc.documentElement
    if (root.tagName.toLowerCase() !== 'svg') return svgMarkup
    return root.outerHTML
  } catch {
    return svgMarkup
  }
}

function pushInteractionSlots(scene: Scene, out: TextSlot[]) {
  for (const ix of scene.interactions ?? []) {
    const bid = `Interact · ${ix.type}`
    switch (ix.type) {
      case 'hotspot':
        out.push({
          key: `ix:${ix.id}:label`,
          kind: 'interaction',
          label: 'Hotspot label',
          preview: ix.label || '',
          badge: bid,
        })
        break
      case 'choice':
        out.push({
          key: `ix:${ix.id}:question`,
          kind: 'interaction',
          label: 'Choice question',
          preview: (ix.question || '').slice(0, 72),
          badge: bid,
        })
        ix.options?.forEach((o) => {
          out.push({
            key: `ix:${ix.id}:opt:${o.id}`,
            kind: 'interaction',
            label: `Option`,
            preview: (o.label || '').slice(0, 72),
            badge: bid,
          })
        })
        break
      case 'quiz':
        out.push({
          key: `ix:${ix.id}:question`,
          kind: 'interaction',
          label: 'Quiz question',
          preview: (ix.question || '').slice(0, 72),
          badge: bid,
        })
        ix.options?.forEach((o) => {
          out.push({
            key: `ix:${ix.id}:qopt:${o.id}`,
            kind: 'interaction',
            label: `Answer choice`,
            preview: (o.label || '').slice(0, 72),
            badge: bid,
          })
        })
        if (ix.explanation?.trim()) {
          out.push({
            key: `ix:${ix.id}:explanation`,
            kind: 'interaction',
            label: 'Explanation',
            preview: ix.explanation.slice(0, 72),
            badge: bid,
          })
        }
        break
      case 'gate':
        out.push({
          key: `ix:${ix.id}:buttonLabel`,
          kind: 'interaction',
          label: 'Gate button',
          preview: ix.buttonLabel || '',
          badge: bid,
        })
        break
      case 'tooltip':
        if (ix.triggerLabel?.trim()) {
          out.push({
            key: `ix:${ix.id}:triggerLabel`,
            kind: 'interaction',
            label: 'Trigger label',
            preview: ix.triggerLabel.slice(0, 72),
            badge: bid,
          })
        }
        out.push({
          key: `ix:${ix.id}:tooltipTitle`,
          kind: 'interaction',
          label: 'Tooltip title',
          preview: ix.tooltipTitle.slice(0, 72),
          badge: bid,
        })
        out.push({
          key: `ix:${ix.id}:tooltipBody`,
          kind: 'interaction',
          label: 'Tooltip body',
          preview: ix.tooltipBody.slice(0, 72),
          badge: bid,
        })
        break
      case 'form':
        out.push({
          key: `ix:${ix.id}:submitLabel`,
          kind: 'interaction',
          label: 'Submit label',
          preview: ix.submitLabel || '',
          badge: bid,
        })
        ix.fields?.forEach((f) => {
          out.push({
            key: `ix:${ix.id}:field:${f.id}:label`,
            kind: 'interaction',
            label: `Field · ${f.label || f.id}`,
            preview: (f.label || '').slice(0, 72),
            badge: bid,
          })
          if (f.placeholder?.trim()) {
            out.push({
              key: `ix:${ix.id}:field:${f.id}:placeholder`,
              kind: 'interaction',
              label: `Placeholder`,
              preview: f.placeholder.slice(0, 72),
              badge: bid,
            })
          }
        })
        break
      default:
        break
    }
  }
}

function pushPhysicsSlots(layers: PhysicsLayer[] | undefined, out: TextSlot[]) {
  for (const p of layers ?? []) {
    const badge = `Physics · ${p.name || p.simulation}`
    out.push({
      key: `phys:${p.id}:title`,
      kind: 'physics',
      label: 'Title',
      preview: (p.title || '').slice(0, 72),
      badge,
    })
    out.push({
      key: `phys:${p.id}:narration`,
      kind: 'physics',
      label: 'Narration',
      preview: (p.narration || '').slice(0, 72),
      badge,
    })
  }
}

export type CollectTextSlotsOptions = {
  includeSvg?: boolean
  /** Inspector elements from the iframe — used to surface React DOM text */
  inspectorElements?: Record<string, SceneElement>
}

/** Collect every editable text slot for the scene. Set `includeSvg: false` during SSR / before hydration. */
export function collectTextSlots(scene: Scene, opts?: CollectTextSlotsOptions): TextSlot[] {
  const includeSvg = opts?.includeSvg !== false
  const out: TextSlot[] = []

  for (const t of scene.textOverlays ?? []) {
    out.push({
      key: `overlay:${t.id}`,
      kind: 'overlay',
      label: 'Text overlay',
      preview: (t.content || '').slice(0, 72),
      badge: 'Overlay',
    })
  }

  if (includeSvg && typeof window !== 'undefined') {
    const mainSvg = scene.svgContent?.trim() ?? ''
    if (mainSvg) {
      for (const { ref, preview } of listTextInSvgMarkup(mainSvg)) {
        out.push({
          key: `svg:main:${ref}`,
          kind: 'svg_text',
          label: `SVG text · ${ref.startsWith('__idx_') ? ref.replace('__idx_', '#') : ref}`,
          preview: preview || '(empty)',
          badge: 'SVG',
        })
      }
    }

    for (const obj of scene.svgObjects ?? []) {
      const inner = obj.svgContent?.trim() ?? ''
      if (!inner) continue
      for (const { ref, preview } of listTextInSvgMarkup(inner)) {
        out.push({
          key: `svg:obj:${obj.id}:${ref}`,
          kind: 'svg_text',
          label: `SVG object text`,
          preview: preview || '(empty)',
          badge: 'SVG obj',
        })
      }
    }
  }

  for (const c of deriveChartLayersFromScene(scene)) {
    out.push({
      key: `chart:${c.id}:title`,
      kind: 'chart',
      label: 'Title',
      preview: chartLayerTitleLine(c).slice(0, 72),
      badge: `Chart · ${c.name}`,
    })
  }

  pushInteractionSlots(scene, out)
  pushPhysicsSlots(scene.physicsLayers, out)

  // React DOM text elements from the inspector
  if (opts?.inspectorElements) {
    for (const el of Object.values(opts.inspectorElements)) {
      if (el.type !== 'dom-text') continue
      const text = (el as any).text as string | undefined
      if (!text?.trim()) continue
      out.push({
        key: `dom:${el.id}`,
        kind: 'dom_text',
        label: el.label || 'React text',
        preview: text.trim().slice(0, 72),
        badge: 'React',
      })
    }
  }

  return out
}

export function getTextSlotValue(scene: Scene, key: string, inspectorElements?: Record<string, SceneElement>): string {
  if (key.startsWith('dom:')) {
    const elId = key.slice('dom:'.length)
    const el = inspectorElements?.[elId]
    return el ? ((el as any).text as string) ?? '' : ''
  }
  if (key.startsWith('overlay:')) {
    const id = key.slice('overlay:'.length)
    return scene.textOverlays?.find((t) => t.id === id)?.content ?? ''
  }
  if (key.startsWith('svg:main:')) {
    const ref = key.slice('svg:main:'.length)
    return getSvgTextAtRef(scene.svgContent || '', ref)
  }
  if (key.startsWith('svg:obj:')) {
    const rest = key.slice('svg:obj:'.length)
    const colon = rest.indexOf(':')
    if (colon < 0) return ''
    const objId = rest.slice(0, colon)
    const ref = rest.slice(colon + 1)
    const obj = scene.svgObjects?.find((o) => o.id === objId)
    return getSvgTextAtRef(obj?.svgContent || '', ref)
  }
  if (key.startsWith('ix:')) {
    const parts = key.split(':')
    if (parts.length < 3) return ''
    const ixId = parts[1]
    const ix = scene.interactions?.find((i) => i.id === ixId)
    if (!ix) return ''
    const field = parts[2]
    if (field === 'label' && ix.type === 'hotspot') return ix.label
    if (field === 'question' && (ix.type === 'choice' || ix.type === 'quiz')) return ix.question ?? ''
    if (field === 'explanation' && ix.type === 'quiz') return ix.explanation ?? ''
    if (field === 'buttonLabel' && ix.type === 'gate') return ix.buttonLabel
    if (field === 'triggerLabel' && ix.type === 'tooltip') return ix.triggerLabel ?? ''
    if (field === 'tooltipTitle' && ix.type === 'tooltip') return ix.tooltipTitle
    if (field === 'tooltipBody' && ix.type === 'tooltip') return ix.tooltipBody
    if (field === 'submitLabel' && ix.type === 'form') return ix.submitLabel
    if (field === 'opt' && parts[3] && ix.type === 'choice') {
      return ix.options?.find((o) => o.id === parts[3])?.label ?? ''
    }
    if (field === 'qopt' && parts[3] && ix.type === 'quiz') {
      return ix.options?.find((o) => o.id === parts[3])?.label ?? ''
    }
    if (field === 'field' && parts[3] && parts[4] && ix.type === 'form') {
      const f = ix.fields?.find((x) => x.id === parts[3])
      if (!f) return ''
      if (parts[4] === 'label') return f.label
      if (parts[4] === 'placeholder') return f.placeholder ?? ''
    }
  }
  if (key.startsWith('phys:')) {
    const parts = key.split(':')
    if (parts.length < 4) return ''
    const layerId = parts[1]
    const sub = parts[2]
    const p = scene.physicsLayers?.find((l) => l.id === layerId)
    if (!p) return ''
    if (sub === 'title') return p.title
    if (sub === 'narration') return p.narration
  }
  const chartTitle = parseChartTitleSlotKey(key)
  if (chartTitle) {
    const layer = deriveChartLayersFromScene(scene).find((l) => l.id === chartTitle.layerId)
    if (!layer) return ''
    const cfg = (layer.config || {}) as Record<string, unknown>
    const t = cfg.title
    if (typeof t === 'string') return t
    return layer.name ?? ''
  }
  return ''
}

function patchSvgObjectsForMain(
  svgObjects: SvgObject[] | undefined,
  primaryId: string | null,
  newMain: string,
): SvgObject[] | undefined {
  if (!svgObjects?.length || !primaryId) return undefined
  return svgObjects.map((o) => (o.id === primaryId ? { ...o, svgContent: newMain } : o))
}

/** Returns scene patch and whether HTML should be re-saved. */
export function applyTextSlotValue(
  scene: Scene,
  key: string,
  value: string,
): { patch: Partial<Scene>; saveHtml: boolean; domElementId?: string } {
  // DOM text edits go through elementOverrides — caller must also patch iframe
  if (key.startsWith('dom:')) {
    const elId = key.slice('dom:'.length)
    const prev = scene.elementOverrides ?? {}
    const prevEl = prev[elId] ?? {}
    return {
      patch: { elementOverrides: { ...prev, [elId]: { ...prevEl, text: value } } },
      saveHtml: true,
      domElementId: elId,
    }
  }
  if (key.startsWith('overlay:')) {
    const id = key.slice('overlay:'.length)
    const next = (scene.textOverlays ?? []).map((t) => (t.id === id ? { ...t, content: value } : t))
    return { patch: { textOverlays: next }, saveHtml: true }
  }

  if (key.startsWith('svg:main:')) {
    const ref = key.slice('svg:main:'.length)
    const newSvg = setSvgTextContent(scene.svgContent || '', ref, value)
    const patch: Partial<Scene> = { svgContent: newSvg }
    const po = patchSvgObjectsForMain(scene.svgObjects, scene.primaryObjectId, newSvg)
    if (po) patch.svgObjects = po
    return { patch, saveHtml: true }
  }

  if (key.startsWith('svg:obj:')) {
    const rest = key.slice('svg:obj:'.length)
    const colon = rest.indexOf(':')
    if (colon < 0) return { patch: {}, saveHtml: false }
    const objId = rest.slice(0, colon)
    const ref = rest.slice(colon + 1)
    const objs = scene.svgObjects ?? []
    const idx = objs.findIndex((o) => o.id === objId)
    if (idx < 0) return { patch: {}, saveHtml: false }
    const next = [...objs]
    next[idx] = {
      ...next[idx],
      svgContent: setSvgTextContent(next[idx].svgContent || '', ref, value),
    }
    return { patch: { svgObjects: next }, saveHtml: true }
  }

  if (key.startsWith('ix:')) {
    const parts = key.split(':')
    if (parts.length < 3) return { patch: {}, saveHtml: false }
    const ixId = parts[1]
    const field = parts[2]
    const ix = scene.interactions?.find((i) => i.id === ixId)
    if (!ix) return { patch: {}, saveHtml: false }

    let updated: InteractionElement | null = null
    if (field === 'label' && ix.type === 'hotspot') updated = { ...ix, label: value }
    else if (field === 'question' && (ix.type === 'choice' || ix.type === 'quiz')) updated = { ...ix, question: value }
    else if (field === 'explanation' && ix.type === 'quiz') updated = { ...ix, explanation: value }
    else if (field === 'buttonLabel' && ix.type === 'gate') updated = { ...ix, buttonLabel: value }
    else if (field === 'triggerLabel' && ix.type === 'tooltip') updated = { ...ix, triggerLabel: value }
    else if (field === 'tooltipTitle' && ix.type === 'tooltip') updated = { ...ix, tooltipTitle: value }
    else if (field === 'tooltipBody' && ix.type === 'tooltip') updated = { ...ix, tooltipBody: value }
    else if (field === 'submitLabel' && ix.type === 'form') updated = { ...ix, submitLabel: value }
    else if (field === 'opt' && parts[3] && ix.type === 'choice') {
      updated = {
        ...ix,
        options: ix.options.map((o) => (o.id === parts[3] ? { ...o, label: value } : o)),
      }
    } else if (field === 'qopt' && parts[3] && ix.type === 'quiz') {
      updated = {
        ...ix,
        options: ix.options.map((o) => (o.id === parts[3] ? { ...o, label: value } : o)),
      }
    } else if (field === 'field' && parts[3] && parts[4] && ix.type === 'form') {
      updated = {
        ...ix,
        fields: ix.fields.map((f) => {
          if (f.id !== parts[3]) return f
          if (parts[4] === 'label') return { ...f, label: value }
          if (parts[4] === 'placeholder') return { ...f, placeholder: value }
          return f
        }),
      }
    }

    if (!updated) return { patch: {}, saveHtml: false }
    const interactions = (scene.interactions ?? []).map((i) => (i.id === ixId ? updated! : i))
    return { patch: { interactions }, saveHtml: true }
  }

  if (key.startsWith('phys:')) {
    const parts = key.split(':')
    if (parts.length < 4) return { patch: {}, saveHtml: false }
    const layerId = parts[1]
    const sub = parts[2]
    const layers = scene.physicsLayers ?? []
    const idx = layers.findIndex((l) => l.id === layerId)
    if (idx < 0) return { patch: {}, saveHtml: false }
    const next = [...layers]
    const cur = next[idx]
    if (sub === 'title') next[idx] = { ...cur, title: value }
    else if (sub === 'narration') next[idx] = { ...cur, narration: value }
    else return { patch: {}, saveHtml: false }

    const primary = next[0]
    const patch: Partial<Scene> = { physicsLayers: next, sceneType: 'physics' }
    if (primary) {
      const c = compilePhysicsSceneFromLayers(scene.id, primary)
      patch.sceneCode = c.sceneCode
      patch.sceneHTML = c.sceneHTML
    }
    return { patch, saveHtml: true }
  }

  const chartTitle = parseChartTitleSlotKey(key)
  if (chartTitle) {
    const layers = deriveChartLayersFromScene(scene)
    const idx = layers.findIndex((l) => l.id === chartTitle.layerId)
    if (idx < 0) return { patch: {}, saveHtml: false }
    const next = [...layers]
    const cur = next[idx]
    const trimmed = value.trim()
    next[idx] = {
      ...cur,
      name: trimmed || cur.name,
      config: { ...cur.config, title: value },
    }
    const compiled = compileD3SceneFromLayers(next)
    return {
      patch: {
        chartLayers: next,
        sceneCode: compiled.sceneCode,
        d3Data: compiled.d3Data as Scene['d3Data'],
        sceneType: 'd3',
      },
      saveHtml: true,
    }
  }

  return { patch: {}, saveHtml: false }
}

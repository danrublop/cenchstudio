/**
 * Prompt enrichment for media generation.
 *
 * Why: raw user prompts like "fox on a hill" miss the quality/style cues that
 * separate amateur outputs from usable ones. Enrichment adds curated tags per
 * category so the agent (and the Generate panel) ship higher-quality prompts to
 * providers without the user having to be a prompt expert.
 *
 * Pattern adapted from open-gen-ai/src/lib/promptUtils.js (ENHANCE_TAGS), but
 * the tag registry is Cench-specific and enrichPrompt() respects the project's
 * active style preset so enrichment never fights the palette/roughness globals.
 */

import type { ImageModel } from '@/lib/types'

export type EnhanceCategory = 'quality' | 'lighting' | 'mood' | 'style' | 'medium' | 'camera'

export const ENHANCE_TAGS: Record<EnhanceCategory, string[]> = {
  quality: ['ultra detailed', '4k', 'sharp focus', 'masterpiece', 'crisp'],
  lighting: [
    'cinematic lighting',
    'soft natural light',
    'golden hour',
    'studio lighting',
    'rim light',
    'volumetric light',
  ],
  mood: ['vibrant', 'moody', 'dreamy', 'energetic', 'serene', 'dramatic'],
  style: ['photorealistic', 'illustration', 'flat design', 'oil painting', 'watercolor', 'cyberpunk', 'isometric'],
  medium: ['digital art', 'concept art', 'matte painting', 'pencil sketch', 'vector art'],
  camera: ['wide shot', 'close-up', 'overhead view', 'shallow depth of field', 'bokeh'],
}

/** Flattened list useful for UI chips. */
export const ALL_ENHANCE_TAGS: { category: EnhanceCategory; tag: string }[] = (
  Object.entries(ENHANCE_TAGS) as [EnhanceCategory, string[]][]
).flatMap(([category, tags]) => tags.map((tag) => ({ category, tag })))

export const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Hero illustration', prompt: 'minimalist hero illustration, flat vector, generous negative space' },
  { label: 'Product shot', prompt: 'clean product photograph on seamless background, soft shadows' },
  { label: 'Explainer icon', prompt: 'simple friendly icon, bold outlines, limited palette, transparent background' },
  { label: 'Background plate', prompt: 'soft abstract gradient background, subtle grain, suitable for overlay text' },
  { label: 'Data viz motif', prompt: 'geometric data visualization motif, axonometric, muted analytical palette' },
  { label: 'Whiteboard sketch', prompt: 'whiteboard-style hand-drawn sketch, black marker on off-white, informal' },
]

export interface PresetStyleContext {
  /** Comes from the active project/scene style preset. */
  palette?: string[] | null
  fontFamily?: string | null
  /** 0–3; from style preset. Higher = rougher, sketchier look. */
  roughness?: number | null
}

/**
 * Enrich a prompt with selected tags + (optionally) the active style preset.
 * Pure / deterministic so unit tests can snapshot it.
 */
export function enrichPrompt(
  rawPrompt: string,
  tags: string[] = [],
  model?: ImageModel,
  context?: PresetStyleContext,
): string {
  const base = rawPrompt.trim()
  const parts: string[] = [base]

  // Deduplicate tags while preserving order.
  const seen = new Set<string>()
  for (const t of tags) {
    const norm = t.trim().toLowerCase()
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    parts.push(t.trim())
  }

  // Style preset hints — only when user hasn't already expressed style intent.
  const hasStyleTag = tags.some((t) => ENHANCE_TAGS.style.includes(t))
  if (!hasStyleTag && context) {
    if (context.roughness != null && context.roughness >= 2) {
      parts.push('loose sketchy line work')
    }
    if (context.palette && context.palette.length > 0) {
      parts.push(`palette of ${context.palette.slice(0, 4).join(', ')}`)
    }
  }

  // Model-specific nudges — only when safe. Flux does well with explicit resolution cues.
  if (model === 'flux-1.1-pro' && !tags.some((t) => /4k|detailed|sharp/i.test(t))) {
    parts.push('ultra detailed, sharp focus')
  }

  return parts.join(', ')
}

/**
 * Split a stored prompt back into its base + tags. Best-effort; used for Re-edit
 * on the Gallery card.
 */
export function parseEnrichedPrompt(stored: string): { base: string; tags: string[] } {
  const bits = stored.split(/,\s*/)
  const [first, ...rest] = bits
  return { base: first ?? '', tags: rest }
}

/**
 * Media provider router.
 *
 * Picks the best configured + enabled provider for a given media intent
 * (text-to-image, image-to-image, sticker, video, avatar). Mirrors the shape
 * of lib/audio/router.ts + resolve-best-tts-provider.ts so the agent framework
 * has a uniform mental model across modalities.
 *
 * Contract (feedback_provider_visibility.md):
 *  - Only surface providers whose API keys are present AND that are enabled in
 *    the user's store settings. No silent fallbacks to a disabled provider.
 *  - If no provider is available for an intent, return null + a reason so the
 *    caller can explain the gap to the user / agent instead of erroring vaguely.
 */

import type { ImageModel, MediaIntent } from '@/lib/types'
import { MEDIA_PROVIDERS, isMediaProviderReady } from './provider-registry'

export interface MediaRouterContext {
  /** Map of providerId → enabled (from useVideoStore().mediaGenEnabled). Server-side callers should pass null to trust only key presence. */
  enabledMap: Record<string, boolean> | null
  intent: MediaIntent
  /** Optional: narrow to a specific image model family (Flux / DALL-E / Ideogram). */
  preferModel?: ImageModel | null
  /** Optional: i2i reference image URL — required for 'i2i' intent. */
  referenceImageUrl?: string | null
}

export interface RouteDecision {
  providerId: string
  /** Canonical model id passed to the underlying API (e.g. 'flux-schnell'). May equal providerId. */
  modelId: string
  /** Estimated per-call cost in USD cents. Used for permission dialogs. */
  estimatedCostCents: number
  /** Humane reason string, surfaced to the user / agent. */
  reason: string
}

export interface RouteFailure {
  providerId: null
  modelId: null
  estimatedCostCents: null
  reason: string
  /** Which provider IDs would work if the user enabled them or set the API key. */
  wouldWorkWith: string[]
}

export type RouteResult = RouteDecision | RouteFailure

// Preferred order per intent. First match that's both ready AND enabled wins.
const PREFERENCE: Record<MediaIntent, { providerId: string; modelId: string; cents: number }[]> = {
  t2i: [
    { providerId: 'imageGen', modelId: 'flux-1.1-pro', cents: 5 },
    { providerId: 'googleImageGen', modelId: 'imagen-3', cents: 4 },
    { providerId: 'dall-e', modelId: 'dall-e-3', cents: 4 },
    { providerId: 'imageGen', modelId: 'flux-schnell', cents: 1 }, // cheapest fallback
  ],
  i2i: [
    { providerId: 'imageGen', modelId: 'flux-1.1-pro', cents: 5 },
    { providerId: 'googleImageGen', modelId: 'imagen-3', cents: 4 },
  ],
  sticker: [
    { providerId: 'imageGen', modelId: 'recraft-v3', cents: 4 },
    { providerId: 'imageGen', modelId: 'flux-schnell', cents: 1 },
  ],
  video: [{ providerId: 'veo3', modelId: 'veo-3', cents: 100 }],
  avatar: [
    { providerId: 'heygen', modelId: 'heygen-v2', cents: 30 },
    { providerId: 'musetalk', modelId: 'musetalk', cents: 10 },
    { providerId: 'talkinghead', modelId: 'talkinghead', cents: 0 },
  ],
}

export function routeMediaIntent(ctx: MediaRouterContext): RouteResult {
  const pref = PREFERENCE[ctx.intent]
  if (!pref) {
    return {
      providerId: null,
      modelId: null,
      estimatedCostCents: null,
      reason: `No providers registered for intent "${ctx.intent}"`,
      wouldWorkWith: [],
    }
  }

  if (ctx.intent === 'i2i' && !ctx.referenceImageUrl) {
    return {
      providerId: null,
      modelId: null,
      estimatedCostCents: null,
      reason: 'Image-to-image requires a reference image URL',
      wouldWorkWith: [],
    }
  }

  // If the caller forces a specific model, try it first (and only it).
  const ordered = ctx.preferModel
    ? [...pref.filter((p) => p.modelId === ctx.preferModel), ...pref.filter((p) => p.modelId !== ctx.preferModel)]
    : pref

  const wouldWorkWith: string[] = []
  for (const cand of ordered) {
    const def = MEDIA_PROVIDERS.find((p) => p.id === cand.providerId)
    if (!def) continue
    const ready = isMediaProviderReady(def)
    const enabled = ctx.enabledMap == null ? true : (ctx.enabledMap[cand.providerId] ?? def.defaultEnabled)

    if (!ready) {
      wouldWorkWith.push(`${def.name} (set ${def.requiresKey})`)
      continue
    }
    if (!enabled) {
      wouldWorkWith.push(`${def.name} (disabled in Settings)`)
      continue
    }

    return {
      providerId: cand.providerId,
      modelId: cand.modelId,
      estimatedCostCents: cand.cents,
      reason: `Routed ${ctx.intent} → ${def.name} / ${cand.modelId}`,
    }
  }

  return {
    providerId: null,
    modelId: null,
    estimatedCostCents: null,
    reason: `No enabled + configured provider for ${ctx.intent}`,
    wouldWorkWith,
  }
}

/** Helper: list every provider that *could* handle an intent, for the Generate UI dropdown. */
export function listCandidatesForIntent(
  intent: MediaIntent,
): { providerId: string; modelId: string; name: string; cents: number; ready: boolean }[] {
  const pref = PREFERENCE[intent] ?? []
  return pref.map((p) => {
    const def = MEDIA_PROVIDERS.find((d) => d.id === p.providerId)
    return {
      providerId: p.providerId,
      modelId: p.modelId,
      name: def?.name ?? p.providerId,
      cents: p.cents,
      ready: def ? isMediaProviderReady(def) : false,
    }
  })
}

import type { AvatarCharacter } from '../types'

/**
 * Same tag as `TalkingHead@1.7` in scene HTML so meshes match the runtime.
 * Demo assets ship with https://github.com/met4citizen/TalkingHead — check their licenses for production.
 */
export const TALKING_HEAD_SAMPLE_CDN_BASE = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars'

/**
 * Presenter GLBs: `path` is either under `public/` (gitignored; add your own) or an absolute URL (CDN samples work without local files).
 */
export const TALKING_HEAD_AVATAR_MODELS = [
  { id: 'brunette', label: 'Brunette presenter (local)', path: '/avatars/brunette.glb' },
  { id: 'mpfb', label: 'MPFB professional (local)', path: '/avatars/mpfb.glb' },
  {
    id: 'brunette_remote',
    label: 'Brunette presenter (CDN)',
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/brunette.glb`,
  },
  {
    id: 'mpfb_remote',
    label: 'MPFB professional (CDN)',
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/mpfb.glb`,
  },
  {
    id: 'brunette_t',
    label: 'Brunette compact (CDN)',
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/brunette-t.glb`,
  },
  {
    id: 'avaturn',
    label: 'Avaturn sample (CDN)',
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/avaturn.glb`,
  },
  {
    id: 'avatarsdk',
    label: 'AvatarSDK sample (CDN)',
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/avatarsdk.glb`,
  },
] as const

export type TalkingHeadAvatarModelId = (typeof TALKING_HEAD_AVATAR_MODELS)[number]['id']

const MODEL_IDS = new Set<string>(TALKING_HEAD_AVATAR_MODELS.map((m) => m.id))

const PATH_BY_ID = Object.fromEntries(TALKING_HEAD_AVATAR_MODELS.map((m) => [m.id, m.path])) as Record<
  TalkingHeadAvatarModelId,
  string
>

/** Legacy: personality preset implied a default mesh before `avatarModelId` existed. */
export const DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER: Record<AvatarCharacter, TalkingHeadAvatarModelId> = {
  friendly: 'brunette',
  professional: 'mpfb',
  energetic: 'brunette',
}

export function isTalkingHeadModelId(id: string | null | undefined): id is TalkingHeadAvatarModelId {
  return !!id && MODEL_IDS.has(id)
}

/** Resolved GLB URL for TalkingHead `showAvatar({ url })` — local `/avatars/…` or https CDN. */
export function getTalkingHeadGlbPath(modelId: string): string {
  if (isTalkingHeadModelId(modelId)) return PATH_BY_ID[modelId]
  return PATH_BY_ID.brunette
}

/** Resolve model id from narration + optional `talkinghead://` URL (character + model query params). */
export function resolveTalkingHeadModelId(
  narrationScript: { avatarModelId?: string; character?: AvatarCharacter } | null | undefined,
  url: URL | null,
): TalkingHeadAvatarModelId {
  const fromNs = narrationScript?.avatarModelId
  if (isTalkingHeadModelId(fromNs)) return fromNs

  if (url) {
    const fromUrl = url.searchParams.get('model')
    if (isTalkingHeadModelId(fromUrl)) return fromUrl
    const ch = (url.searchParams.get('character') as AvatarCharacter) || null
    if (ch && DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[ch]) {
      return DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[ch]
    }
  }

  const c = narrationScript?.character ?? 'friendly'
  return DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[c] ?? 'brunette'
}

export function resolveTalkingHeadModelIdFromLayer(layer: {
  narrationScript?: { avatarModelId?: string; character?: AvatarCharacter } | null
  talkingHeadUrl?: string | null
  avatarSceneConfig?: { narrationScript?: { avatarModelId?: string; character?: AvatarCharacter } | null } | null
}): TalkingHeadAvatarModelId {
  const ns = layer.narrationScript ?? layer.avatarSceneConfig?.narrationScript ?? undefined
  let u: URL | null = null
  try {
    if (layer.talkingHeadUrl?.startsWith('talkinghead://')) {
      u = new URL(layer.talkingHeadUrl)
    }
  } catch {
    u = null
  }
  return resolveTalkingHeadModelId(ns, u)
}

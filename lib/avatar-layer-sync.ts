import { resolveTalkingHeadModelIdFromLayer } from './avatars/talkinghead-models'
import type { AvatarCharacter, AvatarLayer, NarrationScript } from './types'

export function defaultNarrationScript(over?: Partial<NarrationScript>): NarrationScript {
  return {
    mood: 'happy',
    view: 'upper',
    lipsyncHeadMovement: true,
    eyeContact: 0.7,
    position: 'pip_bottom_right',
    pipSize: 280,
    pipShape: 'circle',
    avatarScale: 1.15,
    containerEnabled: true,
    lines: [{ text: 'Hello.' }],
    ...over,
  }
}

function buildTalkingHeadPseudoUrl(layer: AvatarLayer): string {
  const text =
    layer.script?.trim() ||
    layer.narrationScript?.lines
      ?.map((l) => l.text)
      .join(' ')
      .trim() ||
    ''
  let char: AvatarCharacter = 'friendly'
  try {
    if (layer.talkingHeadUrl?.startsWith('talkinghead://')) {
      const p = new URL(layer.talkingHeadUrl)
      char = (layer.narrationScript?.character ??
        (p.searchParams.get('character') as AvatarCharacter) ??
        'friendly') as AvatarCharacter
    } else {
      char = (layer.narrationScript?.character ?? 'friendly') as AvatarCharacter
    }
  } catch {
    char = layer.narrationScript?.character ?? 'friendly'
  }
  const model = resolveTalkingHeadModelIdFromLayer(layer)
  return `talkinghead://render?text=${encodeURIComponent(text)}&audio=&character=${char}&model=${encodeURIComponent(model)}`
}

/** Merge avatar layer updates, deep-merge `narrationScript`, and refresh `talkingHeadUrl` when speech-related fields change. */
export function mergeAvatarLayerUpdates(prev: AvatarLayer, updates: Partial<AvatarLayer>): Partial<AvatarLayer> {
  const out: Partial<AvatarLayer> = { ...updates }

  if (updates.avatarSceneConfig && prev.avatarSceneConfig) {
    const asc = prev.avatarSceneConfig
    const u = updates.avatarSceneConfig
    out.avatarSceneConfig = {
      ...asc,
      ...u,
      contentPanels: u.contentPanels ?? asc.contentPanels,
      narrationScript: u.narrationScript
        ? { ...asc.narrationScript, ...u.narrationScript, lines: u.narrationScript.lines ?? asc.narrationScript.lines }
        : asc.narrationScript,
    }
  } else if (updates.avatarSceneConfig && !prev.avatarSceneConfig) {
    out.avatarSceneConfig = updates.avatarSceneConfig
  }

  if (updates.narrationScript) {
    const base = prev.narrationScript ?? defaultNarrationScript()
    out.narrationScript = {
      ...base,
      ...updates.narrationScript,
      lines: updates.narrationScript.lines !== undefined ? updates.narrationScript.lines : base.lines,
    }
  }

  const ascNsPatch = updates.avatarSceneConfig?.narrationScript
  const ascSpeechRelated =
    !!ascNsPatch &&
    (ascNsPatch.lines !== undefined || ascNsPatch.character !== undefined || ascNsPatch.avatarModelId !== undefined)

  const speechRelated =
    updates.script !== undefined ||
    updates.talkingHeadUrl !== undefined ||
    ascSpeechRelated ||
    (updates.narrationScript != null &&
      (updates.narrationScript.lines !== undefined ||
        updates.narrationScript.character !== undefined ||
        updates.narrationScript.avatarModelId !== undefined))

  const next: AvatarLayer = { ...prev, ...out }
  if (next.talkingHeadUrl?.startsWith('talkinghead://') && speechRelated) {
    out.talkingHeadUrl = buildTalkingHeadPseudoUrl(next)
    const t =
      next.script?.trim() ||
      next.narrationScript?.lines
        ?.map((l) => l.text)
        .join(' ')
        .trim() ||
      ''
    if (t && updates.script === undefined && !prev.script?.trim()) {
      out.script = t
    }
  }

  const pos = out.narrationScript?.position ?? next.narrationScript?.position
  if (pos) {
    out.avatarPlacement = pos
  }

  const mergedNs = out.narrationScript ?? next.narrationScript
  if (mergedNs && prev.avatarSceneConfig) {
    const asc = { ...prev.avatarSceneConfig, ...(out.avatarSceneConfig ?? {}) }
    out.avatarSceneConfig = {
      ...asc,
      narrationScript: mergedNs,
    }
  }

  return out
}

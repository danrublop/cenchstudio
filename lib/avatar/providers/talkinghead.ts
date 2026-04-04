import { DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER, isTalkingHeadModelId } from '@/lib/avatars/talkinghead-models'
import type { AvatarCharacter } from '@/lib/types'
import type { AvatarProvider, AvatarGenerateInput, AvatarGenerateResult } from '../types'

/**
 * TalkingHead.js provider — free 3D avatar.
 *
 * Runs entirely in the browser via Three.js + TalkingHead.js.
 * Returns a special `talkinghead://` URL that the scene compositor
 * recognises and embeds as an inline Three.js canvas (not an MP4).
 */
export const talkingHeadProvider: AvatarProvider = {
  id: 'talkinghead',
  name: 'Animated Character (Free)',
  isFree: true,
  requiresImage: false,
  estimateCost: () => 0,

  async generate(input: AvatarGenerateInput, config: Record<string, any>): Promise<AvatarGenerateResult> {
    const character = (config.characterFile || 'friendly') as AvatarCharacter
    const idleAnimation = config.idleAnimation || 'idle'
    const style = config.style || 'default'
    const modelFromConfig = config.avatarModelId || config.model
    const model =
      typeof modelFromConfig === 'string' && isTalkingHeadModelId(modelFromConfig)
        ? modelFromConfig
        : (DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[character] ?? 'brunette')

    // Encode all params into the special URL scheme
    const params = new URLSearchParams({
      text: input.text,
      audio: input.audioUrl,
      character,
      model,
      idle: idleAnimation,
      style,
    })

    return {
      videoUrl: `talkinghead://render?${params.toString()}`,
      durationSeconds: input.durationSeconds,
      costUsd: 0,
      provider: 'talkinghead',
    }
  },
}

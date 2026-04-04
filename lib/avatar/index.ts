import type { AvatarProvider, AvatarGenerateInput, AvatarGenerateResult, AvatarProviderId } from './types'
import { talkingHeadProvider } from './providers/talkinghead'
import { museTalkProvider } from './providers/musetalk'
import { fabricProvider } from './providers/fabric'
import { auroraProvider } from './providers/aurora'
import { heygenProvider } from './providers/heygen'
import type { avatarConfigs } from '../db/schema'

const PROVIDERS: Record<string, AvatarProvider> = {
  talkinghead: talkingHeadProvider,
  musetalk: museTalkProvider,
  fabric: fabricProvider,
  aurora: auroraProvider,
  heygen: heygenProvider,
}

export class AvatarService {
  static getProvider(providerId: string): AvatarProvider {
    const provider = PROVIDERS[providerId]
    if (!provider) throw new Error(`Unknown avatar provider: ${providerId}`)
    return provider
  }

  static async generate(
    input: AvatarGenerateInput,
    avatarConfig: typeof avatarConfigs.$inferSelect,
  ): Promise<AvatarGenerateResult> {
    const provider = this.getProvider(avatarConfig.provider)

    // Validate provider has what it needs
    if (provider.requiresImage && !input.sourceImageUrl) {
      const configImage = (avatarConfig.config as any)?.sourceImageUrl
      if (!configImage) {
        throw new Error(`Provider ${provider.id} requires a source image. Upload one in avatar settings.`)
      }
      input.sourceImageUrl = configImage
    }

    return provider.generate(input, avatarConfig.config as Record<string, any>)
  }

  static getAllProviders(): { id: string; name: string; isFree: boolean; requiresImage: boolean }[] {
    return Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      name: p.name,
      isFree: p.isFree,
      requiresImage: p.requiresImage,
    }))
  }

  static estimateCost(providerId: string, durationSeconds: number): number {
    const provider = PROVIDERS[providerId]
    return provider ? provider.estimateCost(durationSeconds) : 0
  }
}

export { PROVIDERS }
export type { AvatarProvider, AvatarGenerateInput, AvatarGenerateResult, AvatarProviderId }

import { downloadVeo3Video, generateVeo3Video, getVeo3Status, VEO3_COST_ESTIMATE, enhanceVeo3Prompt } from '../veo3'
import type { VideoProviderClient } from './types'

/** Veo 3 wrapped as a VideoProviderClient so the new multi-provider video
 *  route can dispatch uniformly. The underlying functions live in veo3.ts
 *  (kept for backwards compatibility with direct callers). */
export const veo3Provider: VideoProviderClient = {
  id: 'veo3',
  name: 'Google Veo 3',
  envKey: 'GOOGLE_AI_KEY',
  costPerCallUsd: VEO3_COST_ESTIMATE,

  async generate(opts) {
    const finalPrompt = await enhanceVeo3Prompt(opts.prompt).catch(() => opts.prompt)
    // Veo 3 only supports 5 or 8 second clips today.
    const duration: 5 | 8 = opts.durationSeconds >= 8 ? 8 : 5
    const { operationName } = await generateVeo3Video({
      prompt: finalPrompt,
      negativePrompt: opts.negativePrompt,
      aspectRatio: opts.aspectRatio,
      durationSeconds: duration,
    })
    return { operationId: operationName, enhancedPrompt: finalPrompt }
  },

  async pollStatus(operationId) {
    return getVeo3Status(operationId)
  },

  async download(uri) {
    return downloadVeo3Video(uri)
  },
}

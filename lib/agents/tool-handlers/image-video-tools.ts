import { v4 as uuidv4 } from 'uuid'
import type { APIName } from '@/lib/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'
import { persistGeneratedAsset } from '@/lib/media/provenance'

export const IMAGE_VIDEO_TOOL_NAMES = [
  'search_images',
  'place_image',
  'generate_image',
  'generate_sticker',
  'generate_veo3_video',
] as const

export function createImageVideoToolHandler(deps: {
  checkMediaEnabled: (world: WorldStateMutable, providerId: string, label: string) => ToolResult | null
  checkApiPermission: (
    world: WorldStateMutable,
    api: APIName,
    context?: {
      reason?: string
      details?: { prompt?: string; duration?: number; model?: string; resolution?: string }
    },
  ) => ToolResult | null
  enrichPermission: (
    result: ToolResult,
    context: {
      generationType: import('@/lib/types').GenerationType
      prompt?: string
      provider?: string
      availableProviders?: import('@/lib/types').GenerationProviderOption[]
      config?: Record<string, any>
      toolArgs?: Record<string, any>
    },
  ) => ToolResult
  regenerateHTML: (
    world: WorldStateMutable,
    sceneId: string,
    logger?: import('@/lib/agents/logger').AgentLogger,
  ) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleImageVideoTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: import('@/lib/agents/logger').AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'search_images': {
        const mediaErr = deps.checkMediaEnabled(world, 'unsplash', 'Unsplash')
        if (mediaErr) return mediaErr
        const { query, count } = args as { query: string; count?: number }
        const permErr = deps.checkApiPermission(world, 'unsplash', {
          reason: 'Search Unsplash images',
          details: { prompt: query },
        })
        if (permErr) return permErr
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const response = await fetch(
            `${baseUrl}/api/search-images?query=${encodeURIComponent(query)}&count=${count || 5}`,
          )
          if (!response.ok) return { success: false, error: `Image search failed: ${response.statusText}` }
          const data = await response.json()
          return { success: true, affectedSceneId: null, data }
        } catch (e) {
          return { success: false, error: `Image search error: ${String(e)}` }
        }
      }

      case 'place_image': {
        const { sceneId, imageUrl, x, y, width, height, opacity, zIndex } = args as {
          sceneId: string
          imageUrl: string
          x: number
          y: number
          width: number
          height: number
          opacity?: number
          zIndex?: number
        }
        const permErr = deps.checkApiPermission(world, 'imageGen', {
          reason: 'Place generated image in scene',
          details: { prompt: imageUrl },
        })
        if (permErr) return permErr
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const newLayer = {
          id: uuidv4(),
          type: 'image' as const,
          prompt: `Placed image: ${imageUrl}`,
          model: 'flux-1.1-pro' as const,
          style: null,
          imageUrl,
          x,
          y,
          width,
          height,
          rotation: 0,
          opacity: opacity ?? 1,
          zIndex: zIndex ?? 1,
          status: 'ready' as const,
          label: 'Placed Image',
        }
        updateScene(world, sceneId, { aiLayers: [...(scene.aiLayers || []), newLayer] })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Placed image from ${imageUrl}`)
      }

      case 'generate_image': {
        const mediaErr = deps.checkMediaEnabled(world, 'imageGen', 'AI Image Generation')
        if (mediaErr) return mediaErr
        const { sceneId, prompt, model, aspectRatio, style, removeBackground } = args as Record<string, any>
        const blocked = deps.checkApiPermission(world, 'imageGen', {
          reason: 'Generate AI image',
          details: { prompt: prompt as string, model: (model as string) ?? 'flux-schnell' },
        })
        if (blocked)
          return deps.enrichPermission(blocked, {
            generationType: 'image',
            prompt: prompt as string,
            provider: (model as string) ?? 'flux-schnell',
            availableProviders: [
              { id: 'flux-1.1-pro', name: 'Flux 1.1 Pro', cost: '~$0.05', isFree: false },
              { id: 'flux-schnell', name: 'Flux Schnell', cost: '~$0.003', isFree: false },
              { id: 'ideogram-v3', name: 'Ideogram V3', cost: '~$0.08', isFree: false },
              { id: 'recraft-v3', name: 'Recraft V3', cost: '~$0.04', isFree: false },
              { id: 'stable-diffusion-3', name: 'SD 3', cost: '~$0.03', isFree: false },
              { id: 'dall-e-3', name: 'DALL-E 3', cost: '~$0.04', isFree: false },
            ],
            config: { style, aspectRatio, removeBackground },
            toolArgs: args as Record<string, any>,
          })
        if (!sceneId || !prompt) return err('sceneId and prompt are required')
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)
        try {
          const { generateImage } = await import('@/lib/apis/image-gen')
          const result = await generateImage({
            prompt,
            negativePrompt: args.negativePrompt as string | undefined,
            model: model ?? 'flux-schnell',
            aspectRatio: aspectRatio ?? '1:1',
            style: style ?? null,
          })
          if (removeBackground) {
            const { removeImageBackground } = await import('@/lib/apis/background-removal')
            const bgResult = await removeImageBackground(result.imageUrl)
            result.imageUrl = bgResult.resultUrl
          }
          // Persist to the media library so query_media_library / reuse_asset can find it later.
          let assetId: string | null = null
          if (world.projectId) {
            try {
              const persisted = await persistGeneratedAsset({
                projectId: world.projectId,
                sourceUrl: result.imageUrl,
                type: 'image',
                width: result.width,
                height: result.height,
                metadata: {
                  prompt,
                  provider: 'imageGen',
                  model: (model as string) ?? 'flux-schnell',
                  costCents: Math.round((result.cost ?? 0) * 100),
                  parentAssetId: null,
                  referenceAssetIds: null,
                  enhanceTags: null,
                },
              })
              assetId = persisted.id
              result.imageUrl = persisted.publicUrl
            } catch (e) {
              // Non-fatal: generation succeeded; we just couldn't persist. The tool result
              // still returns the upstream URL so the agent can place it directly.
              console.warn('[image-video-tools] persist generated asset failed:', e)
            }
          }
          return ok(sceneId, `Image generated: ${prompt.slice(0, 60)}`, {
            imageUrl: result.imageUrl,
            width: result.width,
            height: result.height,
            cost: result.cost,
            assetId,
          })
        } catch (e: any) {
          return err(`Image generation failed: ${e.message}`)
        }
      }

      case 'generate_sticker': {
        const mediaErr = deps.checkMediaEnabled(world, 'imageGen', 'AI Image Generation')
        if (mediaErr) return mediaErr
        const { sceneId, prompt, model, style } = args as Record<string, any>
        const blocked = deps.checkApiPermission(world, 'imageGen', {
          reason: 'Generate AI sticker',
          details: { prompt: prompt as string, model: (model as string) ?? 'recraft-v3' },
        })
        if (blocked) return blocked
        if (!sceneId || !prompt) return err('sceneId and prompt are required')
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)
        try {
          const { generateImage } = await import('@/lib/apis/image-gen')
          const result = await generateImage({
            prompt,
            model: model ?? 'recraft-v3',
            aspectRatio: '1:1',
            style: style ?? 'illustration',
          })
          const { removeImageBackground } = await import('@/lib/apis/background-removal')
          const bgResult = await removeImageBackground(result.imageUrl)
          let stickerUrl = bgResult.resultUrl
          let assetId: string | null = null
          if (world.projectId) {
            try {
              const persisted = await persistGeneratedAsset({
                projectId: world.projectId,
                sourceUrl: bgResult.resultUrl,
                type: 'image',
                name: `sticker: ${prompt.slice(0, 40)}`,
                tags: ['sticker'],
                metadata: {
                  prompt,
                  provider: 'imageGen',
                  model: (model as string) ?? 'recraft-v3',
                  costCents: Math.round((result.cost ?? 0) * 100),
                  parentAssetId: null,
                  referenceAssetIds: null,
                  enhanceTags: null,
                },
              })
              assetId = persisted.id
              stickerUrl = persisted.publicUrl
            } catch (e) {
              console.warn('[image-video-tools] persist sticker failed:', e)
            }
          }
          return ok(sceneId, `Sticker generated: ${prompt.slice(0, 60)}`, {
            imageUrl: stickerUrl,
            cost: result.cost,
            assetId,
          })
        } catch (e: any) {
          return err(`Sticker generation failed: ${e.message}`)
        }
      }

      case 'generate_veo3_video': {
        // Dispatches through the video provider registry so the same tool can
        // drive Veo 3, Kling, or Runway based on the `provider` arg. Keeps the
        // legacy tool name ("generate_veo3_video") working; when the agent
        // wants a different provider it can pass `provider: 'kling'` / `'runway'`.
        const { getVideoProvider, firstConfiguredVideoProvider } = await import('@/lib/apis/video/registry')
        const requestedProvider = (args.provider as string | undefined) || 'veo3'
        const registryProvider =
          requestedProvider === 'auto'
            ? firstConfiguredVideoProvider()
            : (getVideoProvider(requestedProvider) ?? getVideoProvider('veo3'))
        if (!registryProvider) {
          return err('No video provider configured. Add GOOGLE_AI_KEY, FAL_KEY, or RUNWAY_API_KEY.')
        }
        if (!process.env[registryProvider.envKey]) {
          return err(`${registryProvider.name} not configured — set ${registryProvider.envKey} first.`)
        }
        const providerId = registryProvider.id
        const apiName = (
          providerId === 'veo3' || providerId === 'kling' || providerId === 'runway' ? providerId : 'veo3'
        ) as APIName

        const mediaErr = deps.checkMediaEnabled(world, providerId, registryProvider.name)
        if (mediaErr) return mediaErr
        const { sceneId, prompt } = args as Record<string, any>
        const blocked = deps.checkApiPermission(world, apiName, {
          reason: `Generate ${registryProvider.name} video clip`,
          details: {
            prompt: prompt as string,
            duration: (args.duration as number) ?? 5,
            resolution: (args.aspectRatio as string) ?? '16:9',
          },
        })
        if (blocked)
          return deps.enrichPermission(blocked, {
            generationType: 'video',
            prompt: prompt as string,
            provider: providerId,
            availableProviders: [
              { id: 'veo3', name: 'Google Veo 3', cost: '~$0.50–2.00', isFree: false },
              { id: 'kling', name: 'Kling 2.1', cost: '~$0.40–0.55', isFree: false },
              { id: 'runway', name: 'Runway Gen-4', cost: '~$0.70–1.20', isFree: false },
            ],
            config: { aspectRatio: args.aspectRatio, duration: args.duration, provider: providerId },
            toolArgs: args as Record<string, any>,
          })
        if (!sceneId || !prompt) return err('sceneId and prompt are required')
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)
        try {
          const { operationId } = await registryProvider.generate({
            prompt,
            negativePrompt: args.negativePrompt as string | undefined,
            aspectRatio: ((args.aspectRatio as string) ?? '16:9') as '16:9' | '9:16' | '1:1',
            durationSeconds: (args.duration as number) ?? 5,
            seed: args.seed as number | undefined,
          })
          return ok(
            sceneId,
            `${registryProvider.name} video generation started. Operation: ${operationId}. Takes 2-10 min.`,
            { operationName: operationId, provider: providerId },
          )
        } catch (e: any) {
          return err(`${registryProvider.name} generation failed: ${e.message}`)
        }
      }

      default:
        return err(`Unknown image/video tool: ${toolName}`)
    }
  }
}

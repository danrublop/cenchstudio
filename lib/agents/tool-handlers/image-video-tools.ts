import { v4 as uuidv4 } from 'uuid'
import type { APIName } from '@/lib/types'
import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

export const IMAGE_VIDEO_TOOL_NAMES = [
  'search_images',
  'place_image',
  'generate_image',
  'generate_sticker',
  'generate_veo3_video',
] as const

function ok(affectedSceneId: string | null, description: string, data?: unknown): ToolResult {
  return {
    success: true,
    affectedSceneId,
    changes: [
      {
        type: affectedSceneId ? 'scene_updated' : 'global_updated',
        sceneId: affectedSceneId ?? undefined,
        description,
      },
    ],
    data,
  }
}

function err(message: string): ToolResult {
  return { success: false, error: message }
}

function findScene(world: WorldStateMutable, sceneId: string) {
  return world.scenes.find((s) => s.id === sceneId)
}

function updateScene(world: WorldStateMutable, sceneId: string, updates: Record<string, unknown>) {
  const idx = world.scenes.findIndex((s) => s.id === sceneId)
  if (idx === -1) return null
  world.scenes[idx] = { ...world.scenes[idx], ...updates }
  return world.scenes[idx]
}

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
          return ok(sceneId, `Image generated: ${prompt.slice(0, 60)}`, {
            imageUrl: result.imageUrl,
            width: result.width,
            height: result.height,
            cost: result.cost,
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
          return ok(sceneId, `Sticker generated: ${prompt.slice(0, 60)}`, {
            imageUrl: bgResult.resultUrl,
            cost: result.cost,
          })
        } catch (e: any) {
          return err(`Sticker generation failed: ${e.message}`)
        }
      }

      case 'generate_veo3_video': {
        const mediaErr = deps.checkMediaEnabled(world, 'veo3', 'Veo3 Video')
        if (mediaErr) return mediaErr
        const { sceneId, prompt } = args as Record<string, any>
        const blocked = deps.checkApiPermission(world, 'veo3', {
          reason: 'Generate Veo3 video clip',
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
            provider: 'veo3',
            availableProviders: [{ id: 'veo3', name: 'Google Veo 3', cost: '~$0.50–2.00', isFree: false }],
            config: { aspectRatio: args.aspectRatio, duration: args.duration },
            toolArgs: args as Record<string, any>,
          })
        if (!sceneId || !prompt) return err('sceneId and prompt are required')
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)
        try {
          const { generateVeo3Video } = await import('@/lib/apis/veo3')
          const { operationName } = await generateVeo3Video({
            prompt,
            negativePrompt: args.negativePrompt as string | undefined,
            aspectRatio: ((args.aspectRatio as string) ?? '16:9') as '16:9' | '9:16' | '1:1',
            durationSeconds: ((args.duration as number) ?? 5) as 5 | 8,
          })
          return ok(sceneId, `Veo3 video generation started. Operation: ${operationName}. Takes 2-10 min.`, {
            operationName,
          })
        } catch (e: any) {
          return err(`Veo3 generation failed: ${e.message}`)
        }
      }

      default:
        return err(`Unknown image/video tool: ${toolName}`)
    }
  }
}

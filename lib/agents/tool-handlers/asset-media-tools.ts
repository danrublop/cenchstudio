import type { AgentLogger } from '@/lib/agents/logger'
import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

export const ASSET_MEDIA_TOOL_NAMES = [
  'set_audio_layer',
  'set_video_layer',
  'request_screen_recording',
  'use_asset_in_scene',
  'add_watermark',
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

export function createAssetMediaToolHandler(deps: {
  checkApiPermission: (
    world: WorldStateMutable,
    api: string,
    context?: { reason?: string; details?: Record<string, any> },
  ) => ToolResult | null
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleAssetMediaTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'set_audio_layer': {
        const { sceneId, src, volume, fadeIn, fadeOut, startOffset } = args as {
          sceneId: string
          src?: string | null
          volume?: number
          fadeIn?: boolean
          fadeOut?: boolean
          startOffset?: number
        }
        // Only check ElevenLabs permission when setting a new audio source
        if (src != null) {
          const permErr = deps.checkApiPermission(world, 'elevenLabs', {
            reason: 'Set scene audio source',
          })
          if (permErr) return permErr
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const audioLayer = {
          ...scene.audioLayer,
          enabled: src != null,
          src: src ?? null,
          volume: volume ?? scene.audioLayer?.volume ?? 1,
          fadeIn: fadeIn ?? scene.audioLayer?.fadeIn ?? false,
          fadeOut: fadeOut ?? scene.audioLayer?.fadeOut ?? false,
          startOffset: startOffset ?? scene.audioLayer?.startOffset ?? 0,
        }
        updateScene(world, sceneId, { audioLayer })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Updated audio layer`)
      }

      case 'set_video_layer': {
        const { sceneId, src, opacity, trimStart, trimEnd } = args as {
          sceneId: string
          src?: string | null
          opacity?: number
          trimStart?: number
          trimEnd?: number | null
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const videoLayer = {
          ...scene.videoLayer,
          enabled: src != null,
          src: src ?? null,
          opacity: opacity ?? scene.videoLayer?.opacity ?? 1,
          trimStart: trimStart ?? scene.videoLayer?.trimStart ?? 0,
          trimEnd: trimEnd !== undefined ? trimEnd : (scene.videoLayer?.trimEnd ?? null),
        }
        updateScene(world, sceneId, { videoLayer })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Updated video layer`)
      }

      case 'request_screen_recording': {
        const { sceneId, fps, resolution } = args as {
          sceneId: string
          fps?: number
          resolution?: '720p' | '1080p' | '1440p' | '2160p' | 'source'
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const params = new URLSearchParams()
        if (typeof fps === 'number' && Number.isFinite(fps)) {
          params.set('fps', String(Math.max(1, Math.min(120, Math.round(fps)))))
        }
        if (resolution) params.set('resolution', resolution)
        params.set('sceneId', sceneId)
        const markerSrc = `recording://request${params.toString() ? `?${params.toString()}` : ''}`

        const videoLayer = {
          ...scene.videoLayer,
          enabled: true,
          src: markerSrc,
        }
        updateScene(world, sceneId, { videoLayer })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, 'Queued Electron screen recording request for this scene')
      }

      case 'use_asset_in_scene': {
        const { assetId, usage, position } = args as {
          assetId: string
          usage: 'fullscreen' | 'overlay' | 'watermark' | 'background' | 'inline'
          position?: { x?: number; y?: number; width?: number; anchor?: string }
        }
        // Look up asset from the project's media library via API
        try {
          const projectId = world.projectId
          if (!projectId) {
            return ok(
              null,
              `Asset ${assetId} referenced. The agent should use the asset URL from the system prompt asset list.`,
              { assetId, usage, position },
            )
          }
          return ok(null, `Asset ${assetId} referenced for ${usage} usage.`, { assetId, usage, position })
        } catch {
          return ok(null, `Asset ${assetId} referenced for ${usage} usage.`, { assetId, usage, position })
        }
      }

      case 'add_watermark': {
        const {
          assetId,
          position: pos,
          opacity: op,
          sizePercent: sp,
        } = args as {
          assetId: string
          position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
          opacity?: number
          sizePercent?: number
        }
        const watermarkConfig = {
          assetId,
          position: pos || 'bottom-right',
          opacity: typeof op === 'number' ? Math.max(0, Math.min(1, op)) : 0.8,
          sizePercent: typeof sp === 'number' ? Math.max(1, Math.min(50, sp)) : 12,
        }
        // Store on world state — the API route will persist this to the project
        ;(world as any).watermark = watermarkConfig
        return ok(
          null,
          `Watermark set: asset ${assetId} at ${watermarkConfig.position}, opacity ${watermarkConfig.opacity}, size ${watermarkConfig.sizePercent}%`,
          { watermark: watermarkConfig },
        )
      }

      default:
        return err(`Unknown asset/media tool: ${toolName}`)
    }
  }
}

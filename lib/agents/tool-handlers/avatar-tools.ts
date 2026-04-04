import { v4 as uuidv4 } from 'uuid'
import type { APIName } from '@/lib/types'
import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

export const AVATAR_TOOL_NAMES = [
  'list_avatars',
  'generate_avatar',
  'generate_avatar_narration',
  'generate_avatar_scene',
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

export function createAvatarToolHandler(deps: {
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
}) {
  return async function handleAvatarTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'list_avatars': {
        const mediaErr = deps.checkMediaEnabled(world, 'heygen', 'HeyGen Avatars')
        if (mediaErr) return mediaErr
        const blocked = deps.checkApiPermission(world, 'heygen', {
          reason: 'List available HeyGen avatars',
        })
        if (blocked) return blocked
        try {
          const { listAvatars } = await import('@/lib/apis/heygen')
          const avatars = await listAvatars()
          return ok(null, `Found ${avatars.length} avatars`, {
            avatars: avatars.slice(0, 20).map((a) => ({
              id: a.avatar_id,
              name: a.avatar_name,
              gender: a.gender,
              preview: a.preview_image_url,
            })),
          })
        } catch (e: any) {
          return err(`Failed to list avatars: ${e.message}`)
        }
      }

      case 'generate_avatar': {
        const mediaErr = deps.checkMediaEnabled(world, 'heygen', 'HeyGen Avatars')
        if (mediaErr) return mediaErr
        const { sceneId, script, avatarId, voiceId, label } = args as Record<string, any>
        const blocked = deps.checkApiPermission(world, 'heygen', {
          reason: 'Generate HeyGen avatar video',
          details: { prompt: script },
        })
        if (blocked) return blocked
        if (!sceneId || !script || !avatarId || !voiceId) {
          return err('sceneId, script, avatarId, and voiceId are required')
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)
        try {
          const { generateAvatarVideo } = await import('@/lib/apis/heygen')
          const { videoId, estimatedSeconds } = await generateAvatarVideo({
            avatarId,
            voiceId,
            script,
            bgColor: '#00FF00',
          })
          const layerId = uuidv4()
          const avatarLayer = {
            id: layerId,
            type: 'avatar' as const,
            avatarId,
            voiceId,
            script,
            removeBackground: (args.removeBackground ?? true) as boolean,
            x: (args.x as number) ?? 960,
            y: (args.y as number) ?? 540,
            width: (args.width as number) ?? 400,
            height: 400,
            opacity: 1,
            zIndex: 10,
            videoUrl: null,
            thumbnailUrl: null,
            status: 'processing' as const,
            heygenVideoId: videoId,
            estimatedDuration: estimatedSeconds,
            startAt: 0,
            label: (label as string) ?? 'Avatar',
          }
          scene.aiLayers = [...(scene.aiLayers ?? []), avatarLayer as any]
          return ok(
            sceneId,
            `Avatar generation started (ID: ${videoId}). Estimated ${estimatedSeconds}s. Poll for completion.`,
            { videoId, layerId },
          )
        } catch (e: any) {
          return err(`Avatar generation failed: ${e.message}`)
        }
      }

      case 'generate_avatar_narration': {
        const {
          sceneId,
          text: narrationText,
          placement,
          avatarConfigId: cfgId,
          sourceImageUrl: srcImg,
        } = args as Record<string, any>
        if (!sceneId || !narrationText) return err('sceneId and text are required')
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)

        const avatarProvider =
          world.generationOverrides?.falAvatar?.provider ?? world.generationOverrides?.heygen?.provider ?? 'talkinghead'
        const avatarProviderOptions: import('@/lib/types').GenerationProviderOption[] = [
          { id: 'talkinghead', name: 'TalkingHead (Free)', cost: 'Free', isFree: true },
          { id: 'musetalk', name: 'MuseTalk', cost: '~$0.04/scene', isFree: false },
          { id: 'fabric', name: 'Fabric 1.0', cost: '~$0.08–0.15/scene', isFree: false },
          { id: 'aurora', name: 'Aurora', cost: '~$0.05/scene', isFree: false },
          { id: 'heygen', name: 'HeyGen', cost: '~$0.10–1.00', isFree: false },
        ].filter((p) => !world.mediaGenEnabled || world.mediaGenEnabled[p.id] !== false)

        if (['musetalk', 'fabric', 'aurora'].includes(avatarProvider)) {
          const blocked = deps.checkApiPermission(world, 'falAvatar', {
            reason: 'Generate avatar narration (FAL provider)',
            details: { prompt: narrationText as string, model: avatarProvider },
          })
          if (blocked)
            return deps.enrichPermission(blocked, {
              generationType: 'avatar',
              prompt: narrationText,
              provider: avatarProvider,
              availableProviders: avatarProviderOptions,
              config: { placement: placement ?? 'pip_bottom_right', sourceImageUrl: srcImg },
              toolArgs: args as Record<string, any>,
            })
        } else if (avatarProvider === 'heygen') {
          const blocked = deps.checkApiPermission(world, 'heygen', {
            reason: 'Generate avatar narration (HeyGen)',
            details: { prompt: narrationText as string, model: 'heygen' },
          })
          if (blocked)
            return deps.enrichPermission(blocked, {
              generationType: 'avatar',
              prompt: narrationText,
              provider: 'heygen',
              availableProviders: avatarProviderOptions,
              config: { placement: placement ?? 'pip_bottom_right' },
              toolArgs: args as Record<string, any>,
            })
        }

        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const projectId = world.projectId
          if (!projectId) return err('projectId not available in world state')
          const response = await fetch(`${baseUrl}/api/projects/${projectId}/avatar/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: narrationText,
              sceneId,
              avatarConfigId: cfgId ?? undefined,
              sourceImageUrl: srcImg ?? undefined,
            }),
          })
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            return err(`Avatar generation failed: ${errData.error ?? response.statusText}`)
          }
          const avatarVideo = await response.json()
          const videoUrl = avatarVideo.videoUrl
          const provider = avatarVideo.provider
          const cost = avatarVideo.costUsd ?? 0
          const avatarPlacement = (placement as string) || 'pip_bottom_right'
          const isTalkingHead = videoUrl?.startsWith('talkinghead://')
          const layerId = uuidv4()
          const avatarLayer = {
            id: layerId,
            type: 'avatar' as const,
            avatarId: '',
            voiceId: '',
            script: narrationText,
            removeBackground: false,
            x: avatarPlacement === 'fullscreen' ? 960 : avatarPlacement.includes('right') ? 1640 : 280,
            y: avatarPlacement === 'fullscreen' ? 540 : avatarPlacement.includes('top') ? 280 : 800,
            width: avatarPlacement === 'fullscreen' ? 1920 : 280,
            height: avatarPlacement === 'fullscreen' ? 1080 : 280,
            opacity: 1,
            zIndex: 100,
            videoUrl: isTalkingHead ? null : videoUrl,
            thumbnailUrl: null,
            status: 'ready' as const,
            heygenVideoId: null,
            estimatedDuration: avatarVideo.durationSeconds ?? scene.duration,
            startAt: 0,
            label: 'Avatar Narrator',
            avatarPlacement,
            avatarProvider: provider,
            talkingHeadUrl: isTalkingHead ? videoUrl : null,
          }
          scene.aiLayers = [...(scene.aiLayers ?? []), avatarLayer as any]
          const costMsg = cost > 0 ? ` Cost: $${cost.toFixed(2)}.` : ' (free)'
          return ok(sceneId, `Avatar narration added (${provider}, ${avatarPlacement}).${costMsg}`, {
            layerId,
            videoUrl,
            provider,
            placement: avatarPlacement,
            costUsd: cost,
          })
        } catch (e: any) {
          return err(`Avatar narration failed: ${e.message}`)
        }
      }

      case 'generate_avatar_scene': {
        const { sceneId, narration_script, content_panels, backdrop, avatar_position, avatar_size, avatar_config_id } =
          args as Record<string, any>
        if (!sceneId || !narration_script) return err('sceneId and narration_script are required')
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)

        const avatarProvider =
          world.generationOverrides?.falAvatar?.provider ?? world.generationOverrides?.heygen?.provider ?? 'talkinghead'
        if (['musetalk', 'fabric', 'aurora'].includes(avatarProvider)) {
          const blocked = deps.checkApiPermission(world, 'falAvatar', {
            reason: 'Generate full avatar presenter scene (FAL provider)',
            details: { prompt: narration_script as string, model: avatarProvider },
          })
          if (blocked)
            return deps.enrichPermission(blocked, {
              generationType: 'avatar',
              prompt: 'Avatar scene generation',
              provider: avatarProvider,
              toolArgs: args as Record<string, any>,
            })
        }

        try {
          scene.sceneType = 'avatar_scene'
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const projectId = world.projectId
          if (!projectId) return err('projectId not available in world state')
          const firstLineText = narration_script.lines?.map((l: any) => l.text).join(' ') || 'Avatar scene'
          const response = await fetch(`${baseUrl}/api/projects/${projectId}/avatar/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: firstLineText,
              sceneId,
              avatarConfigId: avatar_config_id ?? undefined,
            }),
          })
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            return err(`Avatar scene generation failed: ${errData.error ?? response.statusText}`)
          }

          const avatarVideo = await response.json()
          const videoUrl = avatarVideo.videoUrl
          const provider = avatarVideo.provider
          const isTalkingHead = videoUrl?.startsWith('talkinghead://')
          const layerId = uuidv4()
          const avatarLayer = {
            id: layerId,
            type: 'avatar' as const,
            avatarId: '',
            voiceId: '',
            script: firstLineText,
            removeBackground: false,
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            opacity: 1,
            zIndex: 100,
            videoUrl: isTalkingHead ? null : videoUrl,
            thumbnailUrl: null,
            status: 'ready' as const,
            heygenVideoId: null,
            estimatedDuration: scene.duration,
            startAt: 0,
            label: 'Avatar Presenter',
            avatarPlacement: narration_script.position || 'fullscreen_left',
            avatarProvider: provider,
            talkingHeadUrl: isTalkingHead ? videoUrl : null,
            narrationScript: narration_script,
            avatarSceneConfig: {
              narrationScript: narration_script,
              contentPanels: (content_panels || []).map((p: any, i: number) => ({
                id: p.id || `panel-${i}`,
                html: p.html || '',
                position: p.position || 'right',
                revealAt: String(p.revealAt ?? i * 3 + 2),
                exitAt: p.exitAt ? String(p.exitAt) : undefined,
                style: p.style,
              })),
              backdrop: backdrop || '',
              avatarPosition: avatar_position || 'left',
              avatarSize: avatar_size || 40,
            },
          }

          scene.aiLayers = [...(scene.aiLayers ?? []).filter((l) => l.type !== 'avatar'), avatarLayer as any]
          const cost = avatarVideo.costUsd ?? 0
          const costMsg = cost > 0 ? ` Cost: $${cost.toFixed(2)}.` : ' (free)'
          return ok(
            sceneId,
            `Avatar presenter scene created (${provider}).${costMsg} ${(content_panels || []).length} content panel(s).`,
            {
              layerId,
              provider,
              sceneType: 'avatar_scene',
              contentPanels: (content_panels || []).length,
              costUsd: cost,
            },
          )
        } catch (e: any) {
          return err(`Avatar scene failed: ${e.message}`)
        }
      }

      default:
        return err(`Unknown avatar tool: ${toolName}`)
    }
  }
}

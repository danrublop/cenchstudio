import type { AgentLogger } from '@/lib/agents/logger'
import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

export const AI_LAYER_TOOL_NAMES = [
  'update_ai_layer',
  'animate_ai_layer',
  'set_layer_filter',
  'crop_image_layer',
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

export function createAILayerToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleAILayerTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'update_ai_layer': {
        const { sceneId, layerId, ...rest } = args as {
          sceneId: string
          layerId: string
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          opacity?: number
          zIndex?: number
          label?: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const layerIdx = scene.aiLayers.findIndex((l) => l.id === layerId)
        if (layerIdx === -1) return err(`AI layer ${layerId} not found in scene ${sceneId}`)

        const layer = scene.aiLayers[layerIdx]
        const changedFields: string[] = []

        for (const [key, value] of Object.entries(rest)) {
          if (value !== undefined && key in layer) {
            ;(layer as any)[key] = value
            changedFields.push(key)
          }
        }

        scene.aiLayers[layerIdx] = layer
        updateScene(world, sceneId, { aiLayers: scene.aiLayers })
        await deps.regenerateHTML(world, sceneId, logger)

        return ok(
          sceneId,
          changedFields.length > 0
            ? `Updated layer "${layer.label ?? layerId}": ${changedFields.join(', ')}`
            : `No fields changed on layer "${layer.label ?? layerId}"`,
        )
      }

      case 'animate_ai_layer': {
        const {
          sceneId,
          layerId,
          animation,
          duration = 0.5,
          delay = 0,
          easing = 'ease-out',
        } = args as {
          sceneId: string
          layerId: string
          animation: string
          duration?: number
          delay?: number
          easing?: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const layerIdx = scene.aiLayers.findIndex((l) => l.id === layerId)
        if (layerIdx === -1) return err(`AI layer ${layerId} not found in scene ${sceneId}`)

        const animObj = { type: animation, duration, delay, easing }
        const layer = scene.aiLayers[layerIdx]
        ;(layer as any).animation = animObj
        scene.aiLayers[layerIdx] = layer
        updateScene(world, sceneId, { aiLayers: scene.aiLayers })
        await deps.regenerateHTML(world, sceneId, logger)

        return ok(
          sceneId,
          `Set animation "${animation}" on layer "${layer.label ?? layerId}" (${duration}s, delay ${delay}s, ${easing})`,
        )
      }

      case 'set_layer_filter': {
        const { sceneId, layerId, filter } = args as {
          sceneId: string
          layerId: string
          filter: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const layerIdx = scene.aiLayers.findIndex((l) => l.id === layerId)
        if (layerIdx === -1) return err(`AI layer ${layerId} not found in scene ${sceneId}`)

        const layer = scene.aiLayers[layerIdx]
        ;(layer as any).filter = filter === 'none' ? undefined : filter
        scene.aiLayers[layerIdx] = layer
        updateScene(world, sceneId, { aiLayers: scene.aiLayers })
        await deps.regenerateHTML(world, sceneId, logger)

        return ok(
          sceneId,
          filter === 'none'
            ? `Removed filter from layer "${layer.label ?? layerId}"`
            : `Set filter "${filter}" on layer "${layer.label ?? layerId}"`,
        )
      }

      case 'crop_image_layer': {
        const {
          sceneId,
          layerId,
          cropX = 50,
          cropY = 50,
          cropWidth,
          cropHeight,
        } = args as {
          sceneId: string
          layerId: string
          cropX?: number
          cropY?: number
          cropWidth: number
          cropHeight: number
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const layerIdx = scene.aiLayers.findIndex((l) => l.id === layerId)
        if (layerIdx === -1) return err(`AI layer ${layerId} not found in scene ${sceneId}`)

        const layer = scene.aiLayers[layerIdx]
        if (layer.type !== 'image' && layer.type !== 'sticker') {
          return err(
            `Layer "${layer.label ?? layerId}" is type "${layer.type}" — crop is only supported for image and sticker layers`,
          )
        }

        const mutable = layer as any
        mutable.width = cropWidth
        mutable.height = cropHeight
        mutable.cropX = cropX
        mutable.cropY = cropY
        scene.aiLayers[layerIdx] = layer
        updateScene(world, sceneId, { aiLayers: scene.aiLayers })
        await deps.regenerateHTML(world, sceneId, logger)

        return ok(
          sceneId,
          `Cropped layer "${layer.label ?? layerId}" to ${cropWidth}x${cropHeight} at origin (${cropX}%, ${cropY}%)`,
        )
      }

      default:
        return err(`Unknown AI layer tool: ${toolName}`)
    }
  }
}

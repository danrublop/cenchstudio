import { v4 as uuidv4 } from 'uuid'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, type ToolResult } from './_shared'

export const PARENTING_TOOL_NAMES = ['set_layer_parent', 'create_group_layer'] as const

export function createParentingToolHandler() {
  return async function handleParentingTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'set_layer_parent': {
        const { sceneId, layerId, parentLayerId } = args as {
          sceneId: string
          layerId: string
          parentLayerId: string | null
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const resolvedParent = parentLayerId === 'null' || parentLayerId === null ? null : parentLayerId

        if (resolvedParent) {
          return ok(sceneId, `Set layer ${layerId} parent to ${resolvedParent}`, {
            layerId,
            parentLayerId: resolvedParent,
          })
        }
        return ok(sceneId, 'Set layer to root (no parent)', {
          layerId,
          parentLayerId: null,
        })
      }

      case 'create_group_layer': {
        const { sceneId, label, startAt } = args as {
          sceneId: string
          label?: string
          startAt?: number
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const groupLayer = {
          id: uuidv4(),
          type: 'group' as const,
          label: label || 'Group',
          parentLayerId: null,
          zIndex: 0,
          visible: true,
          opacity: 0,
          blendMode: 'normal' as const,
          startAt: startAt ?? 0,
          duration: null,
          generatedCode: '',
          elements: [],
          assetPlacements: [],
          prompt: null,
          layerConfig: null,
        }

        return ok(sceneId, `Created group layer "${groupLayer.label}"`, {
          layer: groupLayer,
        })
      }

      default:
        return err(`Unknown parenting tool: ${toolName}`)
    }
  }
}

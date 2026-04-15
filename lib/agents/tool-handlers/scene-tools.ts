import { v4 as uuidv4 } from 'uuid'
import { normalizeTransition } from '@/lib/transitions'
import type { Scene } from '@/lib/types'
import type { AgentLogger } from '@/lib/agents/logger'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

export const SCENE_TOOL_NAMES = [
  'create_scene',
  'delete_scene',
  'duplicate_scene',
  'reorder_scenes',
  'set_scene_duration',
  'set_scene_background',
  'set_transition',
] as const

export function createSceneToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleSceneTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'create_scene': {
        const { name, prompt, duration, bgColor, position } = args as {
          name: string
          prompt: string
          duration: number
          bgColor?: string
          position?: number
        }
        const newScene: Scene = {
          id: uuidv4(),
          name: name || '',
          prompt: prompt || '',
          summary: '',
          svgContent: '',
          duration: Math.max(6, Math.min(30, duration || 8)),
          bgColor: bgColor || '#181818',
          thumbnail: null,
          videoLayer: { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
          audioLayer: { enabled: false, src: null, volume: 1, fadeIn: false, fadeOut: false, startOffset: 0 },
          textOverlays: [],
          svgObjects: [],
          primaryObjectId: null,
          svgBranches: [],
          activeBranchId: null,
          transition: 'none',
          usage: null,
          sceneType: 'react',
          canvasCode: '',
          canvasBackgroundCode: '',
          sceneCode: '',
          reactCode: '',
          sceneHTML: '',
          sceneStyles: '',
          lottieSource: '',
          d3Data: null,
          chartLayers: [],
          physicsLayers: [],
          interactions: [],
          variables: [],
          aiLayers: [],
          messages: [],
          styleOverride: {},
          cameraMotion: null,
          worldConfig: null,
        }

        if (typeof position === 'number' && position >= 0 && position <= world.scenes.length) {
          world.scenes.splice(position, 0, newScene)
        } else {
          world.scenes.push(newScene)
        }

        return {
          success: true,
          affectedSceneId: newScene.id,
          changes: [
            {
              type: 'scene_created',
              sceneId: newScene.id,
              description: `Created scene "${name}" (${newScene.id})`,
            },
          ],
          data: { sceneId: newScene.id },
        }
      }

      case 'delete_scene': {
        const { sceneId } = args as { sceneId: string }
        const idx = world.scenes.findIndex((s) => s.id === sceneId)
        if (idx === -1) return err(`Scene ${sceneId} not found`)
        const sceneName = world.scenes[idx].name
        world.scenes.splice(idx, 1)
        return {
          success: true,
          affectedSceneId: sceneId,
          changes: [{ type: 'scene_deleted', sceneId, description: `Deleted scene "${sceneName}"` }],
        }
      }

      case 'duplicate_scene': {
        const { sceneId } = args as { sceneId: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        const newScene: Scene = {
          ...JSON.parse(JSON.stringify(scene)),
          id: uuidv4(),
          name: scene.name ? `${scene.name} (copy)` : '(copy)',
          thumbnail: null,
          interactions: scene.interactions.map((el) => ({ ...el, id: uuidv4() })),
        }
        const idx = world.scenes.findIndex((s) => s.id === sceneId)
        world.scenes.splice(idx + 1, 0, newScene)
        return {
          success: true,
          affectedSceneId: newScene.id,
          changes: [
            { type: 'scene_created', sceneId: newScene.id, description: `Duplicated scene as "${newScene.name}"` },
          ],
          data: { sceneId: newScene.id },
        }
      }

      case 'reorder_scenes': {
        const { fromIndex, toIndex } = args as { fromIndex: number; toIndex: number }
        if (fromIndex < 0 || fromIndex >= world.scenes.length) return err(`fromIndex ${fromIndex} out of range`)
        if (toIndex < 0 || toIndex >= world.scenes.length) return err(`toIndex ${toIndex} out of range`)
        const [removed] = world.scenes.splice(fromIndex, 1)
        world.scenes.splice(toIndex, 0, removed)
        return ok(null, `Moved scene from position ${fromIndex} to ${toIndex}`)
      }

      case 'set_scene_duration': {
        const { sceneId, duration } = args as { sceneId: string; duration: number }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        const clamped = Math.max(3, Math.min(30, duration))
        updateScene(world, sceneId, { duration: clamped })
        return ok(sceneId, `Set duration to ${clamped}s`)
      }

      case 'set_scene_background': {
        const { sceneId, bgColor } = args as { sceneId: string; bgColor: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        updateScene(world, sceneId, { bgColor })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Set background to ${bgColor}`)
      }

      case 'set_transition': {
        const { sceneId, transition: raw } = args as { sceneId: string; transition: string }
        const transition = normalizeTransition(raw)
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        updateScene(world, sceneId, { transition })
        return ok(sceneId, `Set transition to "${transition}"`)
      }

      default:
        return err(`Unknown scene tool: ${toolName}`)
    }
  }
}

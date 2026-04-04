import { v4 as uuidv4 } from 'uuid'
import type { TextOverlay } from '@/lib/types'
import type { AgentLogger } from '@/lib/agents/logger'
import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

export const ELEMENT_TOOL_NAMES = [
  'add_element',
  'edit_element',
  'delete_element',
  'move_element',
  'resize_element',
  'reorder_element',
  'adjust_element_timing',
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

function updateScene(world: WorldStateMutable, sceneId: string, updates: Partial<import('@/lib/types').Scene>) {
  const idx = world.scenes.findIndex((s) => s.id === sceneId)
  if (idx === -1) return null
  world.scenes[idx] = { ...world.scenes[idx], ...updates }
  return world.scenes[idx]
}

const VALID_ANIMATIONS: TextOverlay['animation'][] = ['fade-in', 'slide-up', 'typewriter']

export function createElementToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleElementTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'add_element': {
        const { sceneId, content, font, size, color, x, y, animation, duration, delay } = args as {
          sceneId: string
          content: string
          font?: string
          size?: number
          color?: string
          x: number
          y: number
          animation?: string
          duration?: number
          delay?: number
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const validatedAnimation: TextOverlay['animation'] =
          animation && VALID_ANIMATIONS.includes(animation as TextOverlay['animation'])
            ? (animation as TextOverlay['animation'])
            : 'fade-in'

        const overlay: TextOverlay = {
          id: uuidv4(),
          content,
          font: font || 'Caveat',
          size: size || 48,
          color: color || '#ffffff',
          x,
          y,
          animation: validatedAnimation,
          duration: duration || 0.6,
          delay: delay || 0,
        }

        updateScene(world, sceneId, {
          textOverlays: [...scene.textOverlays, overlay],
        })

        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Added text overlay "${content}"`, { elementId: overlay.id })
      }

      case 'edit_element': {
        const { sceneId, elementId, ...updates } = args as {
          sceneId: string
          elementId: string
          [key: string]: unknown
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const element = scene.textOverlays.find((o) => o.id === elementId)
        if (!element) return err(`Element ${elementId} not found in scene ${sceneId}`)

        if (updates.animation && !VALID_ANIMATIONS.includes(updates.animation as TextOverlay['animation'])) {
          updates.animation = 'fade-in'
        }

        updateScene(world, sceneId, {
          textOverlays: scene.textOverlays.map((o) => (o.id === elementId ? { ...o, ...updates } : o)),
        })

        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Updated text overlay ${elementId}`)
      }

      case 'delete_element': {
        const { sceneId, elementId } = args as { sceneId: string; elementId: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const element = scene.textOverlays.find((o) => o.id === elementId)
        if (!element) return err(`Element ${elementId} not found in scene ${sceneId}`)

        updateScene(world, sceneId, {
          textOverlays: scene.textOverlays.filter((o) => o.id !== elementId),
        })

        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Deleted text overlay ${elementId}`)
      }

      case 'move_element': {
        const { sceneId, elementId, x, y } = args as {
          sceneId: string
          elementId: string
          x: number
          y: number
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const element = scene.textOverlays.find((o) => o.id === elementId)
        if (!element) return err(`Element ${elementId} not found in scene ${sceneId}`)

        updateScene(world, sceneId, {
          textOverlays: scene.textOverlays.map((o) => (o.id === elementId ? { ...o, x, y } : o)),
        })

        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Moved text overlay ${elementId} to (${x}%, ${y}%)`)
      }

      case 'resize_element': {
        const { sceneId, elementId, size } = args as {
          sceneId: string
          elementId: string
          size: number
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const element = scene.textOverlays.find((o) => o.id === elementId)
        if (!element) return err(`Element ${elementId} not found in scene ${sceneId}`)

        updateScene(world, sceneId, {
          textOverlays: scene.textOverlays.map((o) => (o.id === elementId ? { ...o, size } : o)),
        })

        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Resized text overlay ${elementId} to ${size}px`)
      }

      case 'reorder_element': {
        const { sceneId, elementId } = args as { sceneId: string; elementId: string }
        return ok(sceneId, `Noted reorder for ${elementId} (position-based)`)
      }

      case 'adjust_element_timing': {
        const { sceneId, elementId, delay, duration } = args as {
          sceneId: string
          elementId: string
          delay?: number
          duration?: number
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const element = scene.textOverlays.find((o) => o.id === elementId)
        if (!element) return err(`Element ${elementId} not found in scene ${sceneId}`)

        updateScene(world, sceneId, {
          textOverlays: scene.textOverlays.map((o) => {
            if (o.id !== elementId) return o
            return {
              ...o,
              ...(delay !== undefined ? { delay } : {}),
              ...(duration !== undefined ? { duration } : {}),
            }
          }),
        })

        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Adjusted timing for text overlay ${elementId}`)
      }

      default:
        return err(`Unknown element tool: ${toolName}`)
    }
  }
}

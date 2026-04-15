import { v4 as uuidv4 } from 'uuid'
import type { SceneEdge } from '@/lib/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

export const INTERACTION_TOOL_NAMES = [
  'add_interaction',
  'add_multiple_interactions',
  'edit_interaction',
  'connect_scenes',
  'define_scene_variable',
] as const

export function createInteractionToolHandler() {
  return async function handleInteractionTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'add_interaction': {
        const { sceneId, type, style, x, y, width, height, appearsAt, config } = args as {
          sceneId: string
          type: string
          style?: string
          x: number
          y: number
          width: number
          height: number
          appearsAt: number
          config: Record<string, unknown>
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const element = {
          id: uuidv4(),
          type,
          x,
          y,
          width,
          height,
          appearsAt,
          hidesAt: null,
          entranceAnimation: 'fade' as const,
          ...(style ? { visualStyle: { preset: style } } : {}),
          ...config,
        }
        updateScene(world, sceneId, { interactions: [...(scene.interactions || []), element as any] })

        // Auto-create scene variable for slider/toggle if it doesn't exist
        if ((type === 'slider' || type === 'toggle') && config.setsVariable) {
          const varName = config.setsVariable as string
          const existingVars = scene.variables || []
          if (!existingVars.some((v: any) => v.name === varName)) {
            const newVar = {
              name: varName,
              type: type === 'slider' ? 'number' as const : 'boolean' as const,
              defaultValue: type === 'slider' ? (config.defaultValue ?? 0) : (config.defaultValue ?? false),
            }
            updateScene(world, sceneId, { variables: [...existingVars, newVar] })
          }
        }

        return {
          success: true,
          affectedSceneId: sceneId,
          changes: [
            { type: 'scene_updated', sceneId, description: `Added ${type} interaction (style: ${style || 'auto'})` },
          ],
          data: { elementId: element.id },
        }
      }

      case 'add_multiple_interactions': {
        const { sceneId, interactions: interactionsList } = args as {
          sceneId: string
          interactions: Array<{
            type: string
            style?: string
            x: number
            y: number
            width: number
            height: number
            appearsAt: number
            config: Record<string, unknown>
          }>
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const newElements = interactionsList.map((item) => ({
          id: uuidv4(),
          type: item.type,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          appearsAt: item.appearsAt,
          hidesAt: null,
          entranceAnimation: 'fade' as const,
          ...(item.style ? { visualStyle: { preset: item.style } } : {}),
          ...item.config,
        }))
        updateScene(world, sceneId, { interactions: [...(scene.interactions || []), ...(newElements as any[])] })

        // Auto-create scene variables for slider/toggle interactions
        const existingVars = scene.variables || []
        const newVars = [...existingVars]
        for (const item of interactionsList) {
          if ((item.type === 'slider' || item.type === 'toggle') && item.config.setsVariable) {
            const varName = item.config.setsVariable as string
            if (!newVars.some((v: any) => v.name === varName)) {
              newVars.push({
                name: varName,
                type: item.type === 'slider' ? 'number' as const : 'boolean' as const,
                defaultValue: item.type === 'slider' ? (item.config.defaultValue ?? 0) : (item.config.defaultValue ?? false),
              })
            }
          }
        }
        if (newVars.length > existingVars.length) {
          updateScene(world, sceneId, { variables: newVars })
        }

        return {
          success: true,
          affectedSceneId: sceneId,
          changes: [{ type: 'scene_updated', sceneId, description: `Added ${newElements.length} interactions` }],
          data: { elementIds: newElements.map((e) => e.id) },
        }
      }

      case 'edit_interaction': {
        const { sceneId, elementId, updates } = args as {
          sceneId: string
          elementId: string
          updates: Record<string, unknown>
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        const el = (scene.interactions || []).find((e) => e.id === elementId)
        if (!el) return err(`Interaction ${elementId} not found`)

        const updated = scene.interactions.map((e) => (e.id === elementId ? { ...e, ...updates } : e))
        updateScene(world, sceneId, { interactions: updated })
        return ok(sceneId, `Updated interaction ${elementId}`)
      }

      case 'connect_scenes': {
        const { fromSceneId, toSceneId, conditionType, interactionId, variableCondition } = args as {
          fromSceneId: string
          toSceneId: string
          conditionType: string
          interactionId?: string
          variableCondition?: { variableName: string; operator: string; value?: unknown }
        }
        const edge: SceneEdge = {
          id: uuidv4(),
          fromSceneId,
          toSceneId,
          condition: {
            type: conditionType as SceneEdge['condition']['type'],
            interactionId: interactionId ?? null,
            variableName: variableCondition?.variableName ?? null,
            variableValue: null,
            ...(variableCondition ? { variableCondition: variableCondition as any } : {}),
          },
        }
        world.sceneGraph.edges.push(edge)
        for (const sid of [fromSceneId, toSceneId]) {
          if (!world.sceneGraph.nodes.some((n) => n.id === sid)) {
            world.sceneGraph.nodes.push({ id: sid, position: { x: 0, y: 0 } })
          }
        }
        if (!world.sceneGraph.startSceneId) {
          world.sceneGraph.startSceneId = fromSceneId
        }
        return {
          success: true,
          affectedSceneId: null,
          changes: [{ type: 'project_updated', description: `Connected scene ${fromSceneId} → ${toSceneId}` }],
          data: { edge },
        }
      }

      case 'define_scene_variable': {
        const { sceneId, name, type, defaultValue } = args as {
          sceneId: string
          name: string
          type: 'string' | 'number' | 'boolean'
          defaultValue: string | number | boolean
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const existingVars = scene.variables || []
        if (existingVars.some((v: any) => v.name === name)) {
          // Update existing variable's type and default
          updateScene(world, sceneId, {
            variables: existingVars.map((v: any) =>
              v.name === name ? { ...v, type, defaultValue } : v,
            ),
          })
          return ok(sceneId, `Updated variable "${name}" (${type}, default: ${defaultValue})`)
        }

        updateScene(world, sceneId, {
          variables: [...existingVars, { name, type, defaultValue }],
        })
        return ok(sceneId, `Defined variable "${name}" (${type}, default: ${defaultValue})`)
      }

      default:
        return err(`Unknown interaction tool: ${toolName}`)
    }
  }
}

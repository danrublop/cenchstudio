import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { getBuiltInTemplate } from '@/lib/templates/built-in'
import { instantiateTemplate } from '@/lib/templates/instantiate'
import type { Scene } from '@/lib/types'
import type { TemplateCategory } from '@/lib/templates/types'

export const TEMPLATE_TOOL_NAMES = ['pick_template', 'use_template', 'save_as_template'] as const

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

function findScene(world: WorldStateMutable, sceneId: string): Scene | undefined {
  return world.scenes.find((s) => s.id === sceneId)
}

export function createTemplateToolHandler() {
  return async function handleTemplateTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'pick_template': {
        const { suggestedCategory, reason } = args as {
          suggestedCategory?: string
          reason?: string
        }

        return {
          success: true,
          affectedSceneId: null,
          changes: [
            {
              type: 'ui_action' as any,
              description: 'Showing template picker',
            },
          ],
          data: {
            action: 'show_template_picker',
            suggestedCategory: suggestedCategory ?? null,
            reason: reason ?? 'Choose a template for the new scene',
          },
        }
      }

      case 'use_template': {
        const { templateId, scenePrompt, position } = args as {
          templateId: string
          scenePrompt: string
          position?: number
        }

        const template = getBuiltInTemplate(templateId)
        if (!template) {
          return err(`Template not found: ${templateId}`)
        }

        const placeholderValues: Record<string, string> = {}
        for (const placeholder of template.placeholders) {
          if (placeholder === 'TITLE') {
            placeholderValues[placeholder] = scenePrompt.slice(0, 60)
          } else if (placeholder === 'SUBTITLE') {
            placeholderValues[placeholder] = ''
          } else {
            placeholderValues[placeholder] = scenePrompt
          }
        }

        const newScene = instantiateTemplate(template, placeholderValues, scenePrompt.slice(0, 40))

        if (position != null && position >= 0 && position <= world.scenes.length) {
          world.scenes.splice(position, 0, newScene)
        } else {
          world.scenes.push(newScene)
        }

        return ok(newScene.id, `Created scene from template "${template.name}"`, {
          sceneId: newScene.id,
          templateId,
        })
      }

      case 'save_as_template': {
        const { sceneId, name, description, category, tags, isPublic, placeholders } = args as {
          sceneId: string
          name: string
          description?: string
          category: TemplateCategory
          tags?: string[]
          isPublic?: boolean
          placeholders?: string[]
        }

        const scene = findScene(world, sceneId)
        if (!scene) {
          return err(`Scene not found: ${sceneId}`)
        }

        return ok(sceneId, `Prepared template "${name}" from scene`, {
          action: 'save_template',
          template: {
            name,
            description: description ?? '',
            category,
            tags: tags ?? [],
            isPublic: isPublic ?? false,
            placeholders: placeholders ?? ['TITLE', 'SUBTITLE'],
            duration: scene.duration,
            styleOverride: scene.styleOverride ?? {},
            bgColor: scene.bgColor,
          },
        })
      }

      default:
        return err(`Unknown template tool: ${toolName}`)
    }
  }
}

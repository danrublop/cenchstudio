import { v4 as uuidv4 } from 'uuid'
import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

export const PLANNING_EXPORT_TOOL_NAMES = ['plan_scenes', 'export_mp4', 'publish_interactive'] as const

interface PlannedScene {
  id?: string
  name: string
  purpose: string
  sceneType: string
  duration: number
  transition?: string
  narrationDraft?: string
  visualElements?: string[]
  audioNotes?: string
  chartSpec?: Record<string, unknown>
}

export function createPlanningExportToolHandler() {
  return async function handlePlanningExportTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'plan_scenes': {
        const { title, scenes, totalDuration, styleNotes, featureFlags } = args as {
          title: string
          scenes: PlannedScene[]
          totalDuration: number
          styleNotes?: string
          featureFlags?: Record<string, boolean>
        }

        const adjustedScenes = scenes.map((s) => {
          let duration = s.duration
          if (s.narrationDraft) {
            const wordCount = s.narrationDraft.split(/\s+/).filter(Boolean).length
            duration = Math.round(wordCount / 2.5 + 3)
          }
          duration = Math.max(6, Math.min(30, duration))
          return {
            ...s,
            id: s.id || uuidv4(),
            duration,
          }
        })

        const adjustedTotal = adjustedScenes.reduce((sum, s) => sum + s.duration, 0)

        // Check scene type diversity
        let warnings: string[] | undefined
        if (adjustedScenes.length >= 3) {
          const types = new Set(adjustedScenes.map((s) => s.sceneType))
          if (types.size === 1) {
            warnings = [
              `All ${adjustedScenes.length} scenes use "${adjustedScenes[0].sceneType}". Consider mixing scene types for visual variety.`,
            ]
          }
        }

        const storyboard = {
          title,
          scenes: adjustedScenes,
          totalDuration: adjustedTotal,
          styleNotes,
          featureFlags,
        }

        ;(world as any).storyboard = storyboard

        return {
          success: true,
          affectedSceneId: null,
          changes: [],
          data: {
            message: `Storyboard "${title}" planned with ${adjustedScenes.length} scenes (${adjustedTotal}s total)`,
            storyboard,
            styleNotes,
            ...(warnings ? { warnings } : {}),
          },
        }
      }

      case 'export_mp4': {
        return {
          success: true,
          affectedSceneId: null,
          changes: [{ type: 'project_updated', description: 'Triggered MP4 export' }],
          data: { action: 'open_export_modal' },
        }
      }

      case 'publish_interactive': {
        return {
          success: true,
          affectedSceneId: null,
          changes: [{ type: 'project_updated', description: 'Triggered interactive publish' }],
          data: { action: 'publish' },
        }
      }

      default:
        return { success: false, error: `Unknown planning/export tool: ${toolName}` }
    }
  }
}

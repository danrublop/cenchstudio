import { normalizeTransition } from '@/lib/transitions'
import { FONT_FAMILIES, isValidFont } from '@/lib/fonts/catalog'
import { SCENE_STYLE_PRESETS } from '@/lib/styles/scene-presets'
import type { AgentLogger } from '@/lib/agents/logger'
import type { ToolResult } from '@/lib/agents/types'
import type { GlobalStyle, Scene, SceneStyleOverride } from '@/lib/types'
import type { SceneStylePresetName } from '@/lib/types'
import type { StylePresetId } from '@/lib/styles/presets'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'

export const STYLE_TOOL_NAMES = [
  'set_camera_motion',
  'set_global_style',
  'set_all_transitions',
  'set_roughness_all',
  'set_scene_style',
  'style_scene',
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

function findScene(world: WorldStateMutable, sceneId: string): Scene | undefined {
  return world.scenes.find((s) => s.id === sceneId)
}

function updateScene(world: WorldStateMutable, sceneId: string, updates: Partial<Scene>): Scene | null {
  const idx = world.scenes.findIndex((s) => s.id === sceneId)
  if (idx === -1) return null
  world.scenes[idx] = { ...world.scenes[idx], ...updates }
  return world.scenes[idx]
}

export function createStyleToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleStyleTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'set_camera_motion': {
        const { sceneId, moves } = args as {
          sceneId: string
          moves: Array<{ type: string; params?: Record<string, unknown> }>
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        updateScene(world, sceneId, { cameraMotion: moves as any })
        await deps.regenerateHTML(world, sceneId, logger)
        const moveNames = moves.map((m) => m.type).join(', ')
        return ok(sceneId, `Set camera motion: ${moveNames}`)
      }

      case 'set_global_style': {
        const {
          palette,
          font,
          strokeWidth,
          theme,
          duration,
          presetId,
          paletteOverride,
          bgColorOverride,
          fontOverride,
          scope,
        } = args as {
          palette?: string[]
          font?: string
          strokeWidth?: number
          theme?: 'dark' | 'light'
          duration?: number
          presetId?: string | null
          paletteOverride?: string[] | null
          bgColorOverride?: string | null
          fontOverride?: string | null
          scope?: 'project_default' | 'all_scenes' | 'new_scenes_only'
        }
        if (presetId !== undefined)
          world.globalStyle.presetId = presetId === 'none' ? null : (presetId as StylePresetId | null)
        if (paletteOverride !== undefined)
          world.globalStyle.paletteOverride = paletteOverride as [string, string, string, string] | null
        if (bgColorOverride !== undefined) world.globalStyle.bgColorOverride = bgColorOverride
        if (fontOverride !== undefined) world.globalStyle.fontOverride = fontOverride

        if (font && !isValidFont(font)) {
          return {
            success: false,
            affectedSceneId: null,
            error: `Font "${font}" is not in the curated catalog. Available fonts: ${FONT_FAMILIES.join(', ')}`,
            changes: [],
          }
        }
        if (palette) world.globalStyle.palette = palette as GlobalStyle['palette']
        if (font) world.globalStyle.font = font
        if (strokeWidth !== undefined) world.globalStyle.strokeWidth = Math.max(1, Math.min(5, strokeWidth))
        if (theme) world.globalStyle.theme = theme
        if (duration) world.globalStyle.duration = duration

        if (scope === 'all_scenes') {
          for (let i = 0; i < world.scenes.length; i++) {
            world.scenes[i] = { ...world.scenes[i], styleOverride: {} }
          }
          await Promise.all(world.scenes.map((s) => deps.regenerateHTML(world, s.id, logger)))
        }

        return {
          success: true,
          affectedSceneId: null,
          changes: [
            {
              type: 'global_updated',
              description: `Updated global style${scope === 'all_scenes' ? ' (applied to all scenes)' : ''}`,
            },
          ],
        }
      }

      case 'set_all_transitions': {
        const { transition: raw } = args as { transition: string }
        const transition = normalizeTransition(raw)
        world.scenes.forEach((scene, idx) => {
          world.scenes[idx] = { ...scene, transition }
        })
        return ok(null, `Set all transitions to "${transition}"`)
      }

      case 'set_roughness_all': {
        const { strokeWidth } = args as { strokeWidth: number }
        world.globalStyle.strokeWidth = Math.max(1, Math.min(5, strokeWidth))
        return ok(null, `Set global stroke width to ${strokeWidth}`)
      }

      case 'set_scene_style': {
        const { sceneId, preset, palette, bgColor, font, roughnessLevel, defaultTool } = args as {
          sceneId: string
          preset?: string
          palette?: string[]
          bgColor?: string
          font?: string
          roughnessLevel?: number
          defaultTool?: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        let override: SceneStyleOverride = { ...scene.styleOverride }
        if (preset && preset in SCENE_STYLE_PRESETS) {
          override = { ...SCENE_STYLE_PRESETS[preset as SceneStylePresetName] }
        }
        if (font && !isValidFont(font)) {
          return err(`Font "${font}" is not in the curated catalog. Available: ${FONT_FAMILIES.join(', ')}`)
        }
        if (palette && palette.length === 4) override.palette = palette as [string, string, string, string]
        if (bgColor) override.bgColor = bgColor
        if (font) override.font = font
        if (roughnessLevel !== undefined) override.roughnessLevel = roughnessLevel
        if (defaultTool) override.defaultTool = defaultTool
        updateScene(world, sceneId, { styleOverride: override })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Applied style ${preset ? `preset "${preset}"` : 'override'} to scene`)
      }

      case 'style_scene': {
        const {
          sceneId,
          palette,
          bgColor,
          bgStyle,
          font,
          roughnessLevel,
          defaultTool,
          strokeColorOverride,
          textureStyle,
          textureIntensity,
          textureBlendMode,
          axisColor,
          gridColor,
          styleNote,
          inspiration,
        } = args as {
          sceneId: string
          palette?: string[]
          bgColor?: string
          bgStyle?: string
          font?: string
          roughnessLevel?: number
          defaultTool?: string
          strokeColorOverride?: string
          textureStyle?: string
          textureIntensity?: number
          textureBlendMode?: string
          axisColor?: string
          gridColor?: string
          styleNote?: string
          inspiration?: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        if (font && !isValidFont(font)) {
          return err(`Font "${font}" is not in the curated catalog. Available: ${FONT_FAMILIES.join(', ')}`)
        }
        const override: SceneStyleOverride = { ...scene.styleOverride }
        if (palette && palette.length === 4) override.palette = palette as [string, string, string, string]
        if (bgColor) override.bgColor = bgColor
        if (bgStyle) override.bgStyle = bgStyle as SceneStyleOverride['bgStyle']
        if (font) override.font = font
        if (roughnessLevel !== undefined) override.roughnessLevel = roughnessLevel
        if (defaultTool) override.defaultTool = defaultTool
        if (strokeColorOverride) override.strokeColorOverride = strokeColorOverride
        if (textureStyle) override.textureStyle = textureStyle
        if (textureIntensity !== undefined) override.textureIntensity = textureIntensity
        if (textureBlendMode) override.textureBlendMode = textureBlendMode as SceneStyleOverride['textureBlendMode']
        if (axisColor) override.axisColor = axisColor
        if (gridColor) override.gridColor = gridColor
        if (styleNote) override.styleNote = styleNote
        updateScene(world, sceneId, { styleOverride: override })
        await deps.regenerateHTML(world, sceneId, logger)
        const desc = styleNote
          ? `Styled scene: ${styleNote}${inspiration ? ` (inspired by ${inspiration})` : ''}`
          : 'Applied style override to scene'
        return ok(sceneId, desc)
      }

      default:
        return err(`Unknown style tool: ${toolName}`)
    }
  }
}

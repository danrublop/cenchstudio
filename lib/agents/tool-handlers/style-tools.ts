import { normalizeTransition } from '@/lib/transitions'
import { FONT_FAMILIES, isValidFont, getFontPairing } from '@/lib/fonts/catalog'
import { SCENE_STYLE_PRESETS } from '@/lib/styles/scene-presets'
import type { AgentLogger } from '@/lib/agents/logger'
import type { GlobalStyle, SceneStyleOverride } from '@/lib/types'
import type { SceneStylePresetName } from '@/lib/types'
import type { StylePresetId } from '@/lib/styles/presets'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

export const STYLE_TOOL_NAMES = [
  'set_camera_motion',
  'set_global_style',
  'set_all_transitions',
  'set_roughness_all',
  'set_scene_style',
  'style_scene',
] as const

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
          bodyFont,
          fontPairing,
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
          bodyFont?: string
          fontPairing?: string
          strokeWidth?: number
          theme?: 'dark' | 'light'
          duration?: number
          presetId?: string | null
          paletteOverride?: string[] | null
          bgColorOverride?: string | null
          fontOverride?: string | null
          scope?: 'project_default' | 'all_scenes' | 'new_scenes_only'
        }
        // Resolve font pairing first — it sets both heading + body font
        if (fontPairing) {
          const pairing = getFontPairing(fontPairing)
          if (pairing) {
            world.globalStyle.fontOverride = pairing.heading
            world.globalStyle.bodyFontOverride = pairing.body
          }
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
        if (bodyFont && !isValidFont(bodyFont)) {
          return {
            success: false,
            affectedSceneId: null,
            error: `Body font "${bodyFont}" is not in the curated catalog. Available fonts: ${FONT_FAMILIES.join(', ')}`,
            changes: [],
          }
        }
        if (palette) world.globalStyle.palette = palette as GlobalStyle['palette']
        if (font) world.globalStyle.font = font
        if (bodyFont) world.globalStyle.bodyFontOverride = bodyFont
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
        const { sceneId, preset, palette, bgColor, font, bodyFont, fontPairing, roughnessLevel, defaultTool } =
          args as {
            sceneId: string
            preset?: string
            palette?: string[]
            bgColor?: string
            font?: string
            bodyFont?: string
            fontPairing?: string
            roughnessLevel?: number
            defaultTool?: string
          }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        let override: SceneStyleOverride = { ...scene.styleOverride }
        if (preset && preset in SCENE_STYLE_PRESETS) {
          override = { ...SCENE_STYLE_PRESETS[preset as SceneStylePresetName] }
        }
        if (fontPairing) {
          const pairing = getFontPairing(fontPairing)
          if (pairing) {
            override.font = pairing.heading
            override.bodyFont = pairing.body
          }
        }
        if (font && !isValidFont(font)) {
          return err(`Font "${font}" is not in the curated catalog. Available: ${FONT_FAMILIES.join(', ')}`)
        }
        if (bodyFont && !isValidFont(bodyFont)) {
          return err(`Body font "${bodyFont}" is not in the curated catalog. Available: ${FONT_FAMILIES.join(', ')}`)
        }
        if (palette && palette.length === 4) override.palette = palette as [string, string, string, string]
        if (bgColor) override.bgColor = bgColor
        if (font) override.font = font
        if (bodyFont) override.bodyFont = bodyFont
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
          bodyFont,
          fontPairing,
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
          bodyFont?: string
          fontPairing?: string
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
        if (bodyFont && !isValidFont(bodyFont)) {
          return err(`Body font "${bodyFont}" is not in the curated catalog. Available: ${FONT_FAMILIES.join(', ')}`)
        }
        const override: SceneStyleOverride = { ...scene.styleOverride }
        if (fontPairing) {
          const pairing = getFontPairing(fontPairing)
          if (pairing) {
            override.font = pairing.heading
            override.bodyFont = pairing.body
          }
        }
        if (palette && palette.length === 4) override.palette = palette as [string, string, string, string]
        if (bgColor) override.bgColor = bgColor
        if (bgStyle) override.bgStyle = bgStyle as SceneStyleOverride['bgStyle']
        if (font) override.font = font
        if (bodyFont) override.bodyFont = bodyFont
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

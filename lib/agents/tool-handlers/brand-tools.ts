import type { AgentLogger } from '@/lib/agents/logger'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, okGlobal, err, type ToolResult } from './_shared'
import type { BrandKit } from '@/lib/types/media'

export const BRAND_TOOL_NAMES = [
  'get_brand_kit',
  'apply_brand_kit',
] as const

export function createBrandToolHandler() {
  return async function handleBrandTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'get_brand_kit': {
        const kit = world.brandKit
        if (!kit) {
          return okGlobal('No brand kit configured for this project.', { brandKit: null })
        }

        // Resolve logo asset details
        const logos = (kit.logoAssetIds || [])
          .map((id) => world.projectAssets?.find((a) => a.id === id))
          .filter(Boolean)
          .map((a) => ({
            id: a!.id,
            name: a!.name,
            publicUrl: a!.publicUrl,
            type: a!.type,
            extractedColors: a!.extractedColors,
          }))

        return okGlobal('Brand kit retrieved.', {
          brandKit: {
            brandName: kit.brandName,
            palette: kit.palette,
            fontPrimary: kit.fontPrimary,
            fontSecondary: kit.fontSecondary,
            guidelines: kit.guidelines,
            logos,
          },
        })
      }

      case 'apply_brand_kit': {
        const kit = world.brandKit
        if (!kit) return err('No brand kit configured for this project.')

        if (kit.palette.length >= 4) {
          world.globalStyle = {
            ...world.globalStyle,
            paletteOverride: kit.palette.slice(0, 4) as [string, string, string, string],
          }
        }
        if (kit.fontPrimary) {
          world.globalStyle = {
            ...world.globalStyle,
            fontOverride: kit.fontPrimary,
          }
        }

        return okGlobal(
          `Applied brand kit: palette ${kit.palette.length >= 4 ? 'set' : 'unchanged'}, font ${kit.fontPrimary || 'unchanged'}.`,
          { globalStyle: world.globalStyle },
        )
      }

      default:
        return err(`Unknown brand tool: ${toolName}`)
    }
  }
}

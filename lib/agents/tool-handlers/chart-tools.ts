import { v4 as uuidv4 } from 'uuid'
import type { Scene } from '@/lib/types'
import type { AgentLogger } from '@/lib/agents/logger'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { clearStaleCodeFields } from '@/lib/agents/tool-executor'
import { compileD3SceneFromLayers } from '@/lib/charts/compile'
import { deriveChartLayersFromScene } from '@/lib/charts/extract'
import { autoGridChartLayoutsForLayers, isCenchChartType } from '@/lib/charts/structured-d3'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

export const CHART_TOOL_NAMES = ['generate_chart', 'update_chart', 'remove_chart', 'reorder_charts'] as const

// ── Factory ──────────────────────────────────────────────────────────────────

export function createChartToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleChartTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      // ── generate_chart ───────────────────────────────────────────────────

      case 'generate_chart': {
        const {
          sceneId,
          chartType,
          data: chartData,
          config: chartConfig,
          animated,
          name: chartName,
          layout: chartLayout,
        } = args as {
          sceneId: string
          chartType: string
          data: unknown
          config?: Record<string, unknown>
          animated?: boolean
          name?: string
          layout?: { x?: number; y?: number; width?: number; height?: number }
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        if (!isCenchChartType(chartType)) {
          return err(
            `Invalid chartType "${chartType}". Use a structured preset (including plotly/funnel) or add_layer(d3) for custom code.`,
          )
        }

        const lay = chartLayout || {}
        const chartLayer = {
          id: uuidv4(),
          name:
            typeof chartName === 'string' && chartName.trim() ? chartName.trim().slice(0, 120) : `${chartType} chart`,
          chartType,
          data: chartData,
          config: (chartConfig || {}) as Record<string, unknown>,
          layout: {
            x: typeof lay.x === 'number' && Number.isFinite(lay.x) ? lay.x : 5,
            y: typeof lay.y === 'number' && Number.isFinite(lay.y) ? lay.y : 10,
            width: typeof lay.width === 'number' && Number.isFinite(lay.width) ? lay.width : 90,
            height: typeof lay.height === 'number' && Number.isFinite(lay.height) ? lay.height : 80,
          },
          timing: { startAt: 0, duration: Math.max(0.5, scene.duration || 8), animated: !!animated },
        }
        const existingLayers = deriveChartLayersFromScene(scene as Scene)
        let nextLayers = [...existingLayers, chartLayer] as any
        if (nextLayers.length >= 2 && nextLayers.length <= 4) {
          nextLayers = autoGridChartLayoutsForLayers(nextLayers as any) as any
        }
        const compiled = compileD3SceneFromLayers(nextLayers)

        const staleClears = clearStaleCodeFields('d3')
        updateScene(world, sceneId, {
          ...staleClears,
          sceneType: 'd3',
          sceneCode: compiled.sceneCode,
          sceneStyles: '',
          d3Data: compiled.d3Data,
          chartLayers: nextLayers,
        })

        await deps.regenerateHTML(world, sceneId, logger)
        return {
          success: true,
          affectedSceneId: sceneId,
          changes: [
            { type: 'scene_updated', sceneId, description: `Added ${chartType} chart${animated ? ' (animated)' : ''}` },
          ],
          data: { chartType, animated: !!animated, chartCount: nextLayers.length },
        }
      }

      // ── update_chart ─────────────────────────────────────────────────────

      case 'update_chart': {
        const {
          sceneId,
          chartId,
          chartType,
          data: patchData,
          config: patchConfig,
          layout: patchLayout,
          timing: patchTiming,
          name: patchName,
          animated,
        } = args as {
          sceneId: string
          chartId: string
          chartType?: string
          data?: unknown
          config?: Record<string, unknown>
          layout?: { x?: number; y?: number; width?: number; height?: number }
          timing?: { startAt?: number; duration?: number }
          name?: string
          animated?: boolean
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        const layers = deriveChartLayersFromScene(scene as Scene)
        const idx = layers.findIndex((c) => c.id === chartId)
        if (idx < 0) return err(`Chart ${chartId} not found in scene`)

        const cur = layers[idx]
        let nextLayer = { ...cur }
        if (typeof patchName === 'string' && patchName.trim()) {
          nextLayer = { ...nextLayer, name: patchName.trim().slice(0, 120) }
        }
        if (chartType !== undefined && chartType !== null && String(chartType).length > 0) {
          const ct = String(chartType)
          if (!isCenchChartType(ct)) return err(`Invalid chartType "${ct}"`)
          nextLayer = { ...nextLayer, chartType: ct as any }
        }
        if (patchData !== undefined) nextLayer = { ...nextLayer, data: patchData }
        if (patchConfig && typeof patchConfig === 'object' && !Array.isArray(patchConfig)) {
          nextLayer = { ...nextLayer, config: { ...cur.config, ...patchConfig } }
        }
        if (patchLayout && typeof patchLayout === 'object') {
          const pl = patchLayout
          nextLayer = {
            ...nextLayer,
            layout: {
              x: typeof pl.x === 'number' && Number.isFinite(pl.x) ? pl.x : cur.layout.x,
              y: typeof pl.y === 'number' && Number.isFinite(pl.y) ? pl.y : cur.layout.y,
              width: typeof pl.width === 'number' && Number.isFinite(pl.width) ? pl.width : cur.layout.width,
              height: typeof pl.height === 'number' && Number.isFinite(pl.height) ? pl.height : cur.layout.height,
            },
          }
        }
        if (patchTiming && typeof patchTiming === 'object') {
          const pt = patchTiming
          nextLayer = {
            ...nextLayer,
            timing: {
              startAt: typeof pt.startAt === 'number' && Number.isFinite(pt.startAt) ? pt.startAt : cur.timing.startAt,
              duration:
                typeof pt.duration === 'number' && Number.isFinite(pt.duration) && pt.duration > 0
                  ? pt.duration
                  : cur.timing.duration,
              animated: cur.timing.animated,
            },
          }
        }
        if (typeof animated === 'boolean') {
          nextLayer = { ...nextLayer, timing: { ...nextLayer.timing, animated } }
        }

        const nextLayers = [...layers]
        nextLayers[idx] = nextLayer
        const compiled = compileD3SceneFromLayers(nextLayers)
        const staleClears = clearStaleCodeFields('d3')
        updateScene(world, sceneId, {
          ...staleClears,
          sceneType: 'd3',
          sceneCode: compiled.sceneCode,
          sceneStyles: '',
          d3Data: compiled.d3Data,
          chartLayers: nextLayers,
        })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Updated chart ${chartId}`, { chartId })
      }

      // ── remove_chart ─────────────────────────────────────────────────────

      case 'remove_chart': {
        const { sceneId, chartId } = args as { sceneId: string; chartId: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        const layers = deriveChartLayersFromScene(scene as Scene)
        const nextLayers = layers.filter((c) => c.id !== chartId)
        if (nextLayers.length === layers.length) return err(`Chart ${chartId} not found`)
        const compiled = compileD3SceneFromLayers(nextLayers)
        const staleClears = clearStaleCodeFields('d3')
        updateScene(world, sceneId, {
          ...staleClears,
          sceneType: 'd3',
          sceneCode: compiled.sceneCode,
          sceneStyles: '',
          d3Data: compiled.d3Data,
          chartLayers: nextLayers,
        })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Removed chart ${chartId}`, { chartCount: nextLayers.length })
      }

      // ── reorder_charts ───────────────────────────────────────────────────

      case 'reorder_charts': {
        const { sceneId, orderedChartIds } = args as { sceneId: string; orderedChartIds: string[] }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        if (!Array.isArray(orderedChartIds) || orderedChartIds.length === 0) {
          return err('orderedChartIds must be a non-empty array of chart layer ids')
        }
        const layers = deriveChartLayersFromScene(scene as Scene)
        if (layers.length === 0) return err('No charts in this scene to reorder')
        const map = new Map(layers.map((l) => [l.id, l]))
        if (orderedChartIds.length !== layers.length) {
          return err(`orderedChartIds length (${orderedChartIds.length}) must match chart count (${layers.length})`)
        }
        const nextLayers: typeof layers = []
        const seen = new Set<string>()
        for (const id of orderedChartIds) {
          if (seen.has(id)) return err(`Duplicate chart id in orderedChartIds: ${id}`)
          const L = map.get(id)
          if (!L) return err(`Unknown chart id "${id}" — use ids from context chartLayers`)
          nextLayers.push(L)
          seen.add(id)
        }
        const compiled = compileD3SceneFromLayers(nextLayers)
        const staleClears = clearStaleCodeFields('d3')
        updateScene(world, sceneId, {
          ...staleClears,
          sceneType: 'd3',
          sceneCode: compiled.sceneCode,
          sceneStyles: '',
          d3Data: compiled.d3Data,
          chartLayers: nextLayers,
        })
        await deps.regenerateHTML(world, sceneId, logger)
        return ok(sceneId, 'Reordered charts', { order: nextLayers.map((c) => c.id) })
      }

      default:
        return err(`Unknown chart tool: ${toolName}`)
    }
  }
}

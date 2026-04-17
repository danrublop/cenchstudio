import { v4 as uuidv4 } from 'uuid'
import type { Scene, SceneType, ZdogPersonAsset, ZdogPersonFormula } from '@/lib/types'
import type { AgentLogger } from '@/lib/agents/logger'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { clearStaleCodeFields, generateLayerContent } from '@/lib/agents/tool-executor'
import { resolveStyle } from '@/lib/styles/presets'
import { generateCode } from '@/lib/generation/generate'
import { runStructuredD3Generation } from '@/lib/generation/d3-structured-run'
import { deriveChartLayersFromScene } from '@/lib/charts/extract'
import { compileD3SceneFromLayers } from '@/lib/charts/compile'
import {
  buildCanvasAnimationCode,
  getCanvasMotionTemplate,
  CANVAS_MOTION_TEMPLATE_IDS,
} from '@/lib/templates/canvas-animation-templates'
import { buildThreeDataScatterSceneCode } from '@/lib/three-environments/build-three-data-scatter-scene-code'
import { wrapSceneAsReact } from '@/lib/generation/react-wrappers'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

// ── Tool Names ───────────────────────────────────────────────────────────────

export const LAYER_TOOL_NAMES = [
  'add_layer',
  'apply_canvas_motion_template',
  'three_data_scatter_scene',
  'create_zdog_composed_scene',
  'save_zdog_person_asset',
  'list_zdog_person_assets',
  'build_zdog_asset',
  'remove_layer',
  'reorder_layer',
  'set_layer_opacity',
  'set_layer_visibility',
  'set_layer_timing',
  'regenerate_layer',
  'patch_layer_code',
  'write_scene_code',
  'read_scene_code',
  'migrate_to_react',
] as const

// ── Factory ──────────────────────────────────────────────────────────────────

export function createLayerToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  const { regenerateHTML } = deps

  return async function handleLayerTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      // ── add_layer ───────────────────────────────────────────────────────

      case 'add_layer': {
        const { sceneId, layerType, prompt, zIndex, opacity, startAt, generatedCode } = args as {
          sceneId: string
          layerType: SceneType
          prompt: string
          zIndex?: number
          opacity?: number
          startAt?: number
          /** Pre-generated code — skips LLM generation (used by local model fallback) */
          generatedCode?: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        // If the run is scoped to D3 tools, block non-D3 add_layer to avoid accidental mode drift.
        if ((world.activeTools || []).includes('d3') && layerType !== 'd3') {
          return err(`add_layer(${layerType}) blocked in D3-only mode. Use layerType 'd3' or generate_chart.`)
        }

        let result: { success: boolean; code?: string; error?: string }
        if (generatedCode) {
          // Skip LLM — use pre-generated code directly (local model fallback path)
          logger?.log('generation', `Using pre-generated code (${generatedCode.length} chars)`)
          result = { success: true, code: generatedCode }
        } else {
          // Generate content via direct SDK call
          result = await generateLayerContent(
            layerType,
            prompt,
            scene,
            world.globalStyle,
            world.modelId,
            world.modelTier,
            logger,
            world.modelConfigs,
          )
        }
        if (!result.success) return err(result.error || 'Layer generation failed')
        if (!result.code?.trim()) return err('Layer generation returned empty code — nothing to render')

        const layerId = uuidv4()

        // Clear stale code fields from previous scene type before setting new ones
        const staleClears = clearStaleCodeFields(layerType)

        if (layerType === 'svg') {
          const newObj = {
            id: layerId,
            prompt,
            svgContent: result.code || '',
            x: 0,
            y: 0,
            width: 100,
            opacity: opacity ?? 1,
            zIndex: zIndex ?? 2,
          }
          const existing = scene.svgObjects || []
          updateScene(world, sceneId, {
            ...staleClears,
            sceneType: 'svg',
            svgObjects: [...existing, newObj],
            svgContent: result.code || '',
          })
        } else {
          // For canvas2d, d3, three, motion, lottie, zdog — update sceneCode/canvasCode
          const updates: Partial<Scene> = { ...staleClears, sceneType: layerType }
          if (layerType === 'canvas2d') updates.canvasCode = result.code || ''
          else if (layerType === 'lottie') updates.lottieSource = result.code || ''
          else if (layerType === 'react') updates.reactCode = result.code || ''
          else updates.sceneCode = result.code || ''
          updateScene(world, sceneId, updates)
        }

        await regenerateHTML(world, sceneId, logger)
        return {
          success: true,
          affectedSceneId: sceneId,
          changes: [{ type: 'scene_updated', sceneId, description: `Added ${layerType} layer: "${prompt}"` }],
          data: { layerId },
        }
      }

      // ── apply_canvas_motion_template ────────────────────────────────────

      case 'apply_canvas_motion_template': {
        const { sceneId, templateId, bgColor, asBackground } = args as {
          sceneId: string
          templateId: string
          bgColor?: string
          asBackground?: boolean
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        if (!CANVAS_MOTION_TEMPLATE_IDS.includes(templateId)) {
          return err(`Unknown canvas motion template "${templateId}". Valid: ${CANVAS_MOTION_TEMPLATE_IDS.join(', ')}`)
        }
        const meta = getCanvasMotionTemplate(templateId)
        const codeFull = buildCanvasAnimationCode(templateId)
        const codeFill = buildCanvasAnimationCode(templateId, { layout: 'fill' })
        const resolvedBg =
          typeof bgColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(bgColor.trim())
            ? bgColor.trim()
            : (meta?.suggestedBgColor ?? scene.bgColor)

        const canLayerBg = ['motion', 'd3', 'svg'].includes(scene.sceneType ?? '')

        if (asBackground && canLayerBg) {
          updateScene(world, sceneId, {
            canvasBackgroundCode: codeFill,
            bgColor: resolvedBg,
          })
          await regenerateHTML(world, sceneId, logger)
          return ok(
            sceneId,
            `Applied canvas motion template "${templateId}" as full-frame background (kept ${scene.sceneType} content)`,
            {
              templateId,
              mode: 'background',
              bgColor: resolvedBg,
            },
          )
        }

        const stale = clearStaleCodeFields('canvas2d')
        updateScene(world, sceneId, {
          ...stale,
          sceneType: 'canvas2d',
          canvasCode: codeFull,
          bgColor: resolvedBg,
          sceneHTML: '',
          physicsLayers: [],
          worldConfig: null,
        })
        await regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Applied canvas motion template "${templateId}" as full Canvas2D scene`, {
          templateId,
          mode: 'full_scene',
          bgColor: meta?.suggestedBgColor,
        })
      }

      // ── three_data_scatter_scene ────────────────────────────────────────

      case 'three_data_scatter_scene': {
        const { sceneId, studioEnvironmentId, points, orbitSpeed, pointRadius } = args as {
          sceneId: string
          studioEnvironmentId: string
          points: { x: number; y: number; z: number }[]
          orbitSpeed?: number
          pointRadius?: number
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        if (!Array.isArray(points) || points.length === 0) {
          return err('three_data_scatter_scene requires a non-empty points array of {x,y,z}')
        }
        if (points.length > 4000) return err('three_data_scatter_scene: max 4000 points')
        const code = buildThreeDataScatterSceneCode({
          studioEnvironmentId: studioEnvironmentId || 'track_rolling_topdown',
          points,
          orbitSpeed,
          pointRadius,
        })
        const stale = clearStaleCodeFields('three')
        updateScene(world, sceneId, {
          ...stale,
          sceneType: 'three',
          sceneCode: code,
          sceneHTML: '',
          physicsLayers: [],
          worldConfig: null,
        })
        await regenerateHTML(world, sceneId, logger)
        return ok(
          sceneId,
          `3D data scatter: ${points.length} points, env "${studioEnvironmentId || 'track_rolling_topdown'}" (Cortico-style scatter, vanilla Three.js)`,
          { pointCount: points.length, studioEnvironmentId: studioEnvironmentId || 'track_rolling_topdown' },
        )
      }

      // ── create_zdog_composed_scene ──────────────────────────────────────

      case 'create_zdog_composed_scene': {
        const { sceneId, seed, people, modules, beats, title } = args as {
          sceneId: string
          seed: number
          people: unknown[]
          modules: unknown[]
          beats: unknown[]
          title?: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        if (!Array.isArray(people) || people.length === 0) return err('people must be a non-empty array')
        if (!Array.isArray(modules)) return err('modules must be an array')
        if (!Array.isArray(beats)) return err('beats must be an array')

        const resolved = resolveStyle(world.globalStyle.presetId, world.globalStyle)
        const library = world.zdogLibrary || []
        const resolvedPeople = (people as any[]).map((p) => {
          if (!p || typeof p !== 'object' || !p.assetId) return p
          const asset = library.find((a) => a.id === p.assetId)
          if (!asset) return p
          return { ...p, formula: { ...(asset.formula || {}), ...(p.formula || {}) } }
        })

        const result = await generateCode('zdog', title || scene.prompt || 'Deterministic composed zdog scene', {
          palette: resolved.palette,
          bgColor: scene.bgColor,
          duration: scene.duration,
          font: resolved.font,
          strokeWidth: world.globalStyle.strokeWidth ?? 2,
          modelId: world.modelId,
          modelTier: world.modelTier,
          zdogComposedSpec: {
            seed,
            title,
            people: resolvedPeople as any,
            modules: modules as any,
            beats: beats as any,
          },
        })

        const staleClears = clearStaleCodeFields('zdog')
        updateScene(world, sceneId, {
          ...staleClears,
          sceneType: 'zdog',
          sceneCode: result.code || '',
          prompt: title || scene.prompt,
        })
        await regenerateHTML(world, sceneId, logger)
        return ok(sceneId, 'Built deterministic composed Zdog scene', {
          mode: 'composed',
          usage: result.usage,
        })
      }

      // ── save_zdog_person_asset ──────────────────────────────────────────

      case 'save_zdog_person_asset': {
        const { name, formula, tags } = args as {
          name: string
          formula: ZdogPersonFormula
          tags?: string[]
        }
        if (!name || !formula) return err('name and formula are required')
        const now = new Date().toISOString()
        const asset: ZdogPersonAsset = {
          id: uuidv4(),
          name: String(name).slice(0, 120),
          formula,
          tags: Array.isArray(tags) ? tags : [],
          createdAt: now,
          updatedAt: now,
        }
        world.zdogLibrary = [...(world.zdogLibrary || []), asset]
        return ok(null, `Saved Zdog person asset "${asset.name}"`, { asset })
      }

      // ── list_zdog_person_assets ─────────────────────────────────────────

      case 'list_zdog_person_assets': {
        const assets = world.zdogLibrary || []
        const studioAssets = world.zdogStudioLibrary || []
        return ok(null, `Listed ${assets.length} person assets, ${studioAssets.length} studio assets`, {
          assets,
          studioAssets,
        })
      }

      // ── build_zdog_asset ───────────────────────────────────────────────

      case 'build_zdog_asset': {
        const { name, shapes, tags } = args as {
          name: string
          shapes: any[]
          tags?: string[]
        }
        if (!name || !shapes?.length) return err('name and shapes are required')
        const now = new Date().toISOString()
        const asset = {
          id: uuidv4(),
          name: String(name).slice(0, 120),
          shapes,
          tags: Array.isArray(tags) ? tags : [],
          createdAt: now,
          updatedAt: now,
        }
        world.zdogStudioLibrary = [...(world.zdogStudioLibrary || []), asset]
        return ok(null, `Saved Zdog studio asset "${asset.name}" with ${shapes.length} shapes`, { asset })
      }

      // ── remove_layer ────────────────────────────────────────────────────

      case 'remove_layer': {
        const { sceneId, layerId } = args as { sceneId: string; layerId: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        // Try to remove from svgObjects
        const svgIdx = (scene.svgObjects || []).findIndex((o) => o.id === layerId)
        if (svgIdx !== -1) {
          const newObjects = scene.svgObjects.filter((o) => o.id !== layerId)
          updateScene(world, sceneId, { svgObjects: newObjects })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Removed SVG layer ${layerId}`)
        }

        // Try AI layers
        const aiIdx = (scene.aiLayers || []).findIndex((l) => l.id === layerId)
        if (aiIdx !== -1) {
          const newLayers = scene.aiLayers.filter((l) => l.id !== layerId)
          updateScene(world, sceneId, { aiLayers: newLayers })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Removed AI layer ${layerId}`)
        }

        // D3 chart layers (same ids as chartLayers / context)
        const chartList = deriveChartLayersFromScene(scene as Scene)
        if (chartList.some((c) => c.id === layerId)) {
          const nextCharts = chartList.filter((c) => c.id !== layerId)
          const compiled = compileD3SceneFromLayers(nextCharts)
          const staleClears = clearStaleCodeFields('d3')
          updateScene(world, sceneId, {
            ...staleClears,
            sceneType: 'd3',
            sceneCode: compiled.sceneCode,
            sceneStyles: '',
            d3Data: compiled.d3Data,
            chartLayers: nextCharts,
          })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Removed chart layer ${layerId}`)
        }

        return err(`Layer ${layerId} not found in scene ${sceneId}`)
      }

      // ── reorder_layer ───────────────────────────────────────────────────

      case 'reorder_layer': {
        const { sceneId, layerId, zIndex } = args as { sceneId: string; layerId: string; zIndex: number }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const svgObj = (scene.svgObjects || []).find((o) => o.id === layerId)
        if (svgObj) {
          const updated = scene.svgObjects.map((o) => (o.id === layerId ? { ...o, zIndex } : o))
          updateScene(world, sceneId, { svgObjects: updated })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Set layer ${layerId} z-index to ${zIndex}`)
        }
        return err(`Layer ${layerId} not found`)
      }

      // ── set_layer_opacity ───────────────────────────────────────────────

      case 'set_layer_opacity': {
        const { sceneId, layerId, opacity } = args as { sceneId: string; layerId: string; opacity: number }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const clamped = Math.max(0, Math.min(1, opacity))
        const svgObj = (scene.svgObjects || []).find((o) => o.id === layerId)
        if (svgObj) {
          const updated = scene.svgObjects.map((o) => (o.id === layerId ? { ...o, opacity: clamped } : o))
          updateScene(world, sceneId, { svgObjects: updated })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Set layer ${layerId} opacity to ${clamped}`)
        }

        // Try AI layers
        const aiLayer = (scene.aiLayers || []).find((l) => l.id === layerId)
        if (aiLayer) {
          const updated = scene.aiLayers.map((l) => (l.id === layerId ? { ...l, opacity: clamped } : l))
          updateScene(world, sceneId, { aiLayers: updated })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Set AI layer opacity to ${clamped}`)
        }
        return err(`Layer ${layerId} not found`)
      }

      // ── set_layer_visibility ────────────────────────────────────────────

      case 'set_layer_visibility': {
        const { sceneId, layerId, visible } = args as { sceneId: string; layerId: string; visible: boolean }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        // Visibility is handled via opacity (0 = hidden, 1 = visible)
        const svgObj = (scene.svgObjects || []).find((o) => o.id === layerId)
        if (svgObj) {
          const updated = scene.svgObjects.map((o) => (o.id === layerId ? { ...o, opacity: visible ? 1 : 0 } : o))
          updateScene(world, sceneId, { svgObjects: updated })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Set layer ${layerId} visibility to ${visible}`)
        }

        // Try AI layers
        const aiLayer = (scene.aiLayers || []).find((l) => l.id === layerId)
        if (aiLayer) {
          const updated = scene.aiLayers.map((l) => (l.id === layerId ? { ...l, opacity: visible ? 1 : 0 } : l))
          updateScene(world, sceneId, { aiLayers: updated })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Set AI layer ${layerId} visibility to ${visible}`)
        }
        return err(`Layer ${layerId} not found`)
      }

      // ── set_layer_timing ────────────────────────────────────────────────

      case 'set_layer_timing': {
        const { sceneId, layerId, startAt } = args as { sceneId: string; layerId: string; startAt: number }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        // startAt is stored in aiLayers
        const aiLayer = (scene.aiLayers || []).find((l) => l.id === layerId)
        if (aiLayer) {
          const updated = scene.aiLayers.map((l) => (l.id === layerId ? { ...l, startAt } : l))
          updateScene(world, sceneId, { aiLayers: updated })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Set layer startAt to ${startAt}s`)
        }
        return err(`Layer ${layerId} not found in aiLayers`)
      }

      // ── regenerate_layer ────────────────────────────────────────────────

      case 'regenerate_layer': {
        const { sceneId, layerId, prompt } = args as { sceneId: string; layerId: string; prompt: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const svgObj = (scene.svgObjects || []).find((o) => o.id === layerId)
        if (svgObj) {
          const result = await generateLayerContent(
            'svg',
            prompt,
            scene,
            world.globalStyle,
            world.modelId,
            world.modelTier,
            logger,
            world.modelConfigs,
          )
          if (!result.success) return err(result.error || 'Regeneration failed')
          const updated = scene.svgObjects.map((o) =>
            o.id === layerId ? { ...o, prompt, svgContent: result.code || '' } : o,
          )
          updateScene(world, sceneId, { svgObjects: updated, svgContent: result.code || '' })
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Regenerated layer ${layerId}`)
        }

        // D3 scenes with structured chartLayers: regenerate via CenchCharts JSON
        if (scene.sceneType === 'd3' && deriveChartLayersFromScene(scene as Scene).length > 0) {
          const resolved = resolveStyle(world.globalStyle.presetId, world.globalStyle)
          const text = (prompt && String(prompt).trim()) || (scene.prompt || '').trim()
          if (!text) return err('Provide a prompt to regenerate this D3 chart scene')
          try {
            const useProjectModel =
              world.modelId && String(world.modelId).toLowerCase().includes('claude')
                ? String(world.modelId)
                : undefined
            const out = await runStructuredD3Generation({
              prompt: text,
              palette: resolved.palette,
              font: resolved.font,
              bgColor: scene.bgColor,
              duration: scene.duration || 8,
              previousSummary: '',
              d3Data: scene.d3Data,
              model: useProjectModel,
            })
            const staleClears = clearStaleCodeFields('d3')
            updateScene(world, sceneId, {
              ...staleClears,
              sceneType: 'd3',
              prompt: text,
              sceneCode: out.sceneCode,
              sceneStyles: out.styles || '',
              d3Data: out.d3Data,
              chartLayers: out.chartLayers,
            })
            await regenerateHTML(world, sceneId, logger)
            return ok(sceneId, `Regenerated D3 charts (${out.chartLayers.length} layer(s))`, { usage: out.usage })
          } catch (e) {
            return err(e instanceof Error ? e.message : 'Structured D3 regeneration failed')
          }
        }

        // For non-SVG scenes, regenerate the scene code
        const layerType = scene.sceneType
        const result = await generateLayerContent(
          layerType,
          prompt,
          scene,
          world.globalStyle,
          world.modelId,
          world.modelTier,
          logger,
          world.modelConfigs,
        )
        if (!result.success) return err(result.error || 'Regeneration failed')

        const updates: Partial<Scene> = { prompt }
        if (layerType === 'canvas2d') updates.canvasCode = result.code || ''
        else if (layerType === 'lottie') updates.lottieSource = result.code || ''
        else if (layerType === 'react') updates.reactCode = result.code || ''
        else updates.sceneCode = result.code || ''
        updateScene(world, sceneId, updates)
        await regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Regenerated ${layerType} scene code`)
      }

      // ── patch_layer_code ────────────────────────────────────────────────

      case 'patch_layer_code': {
        const { sceneId, layerId, oldCode, newCode } = args as {
          sceneId: string
          layerId: string
          oldCode: string
          newCode: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        // Try SVG object
        const svgObj = (scene.svgObjects || []).find((o) => o.id === layerId)
        if (svgObj) {
          if (!svgObj.svgContent.includes(oldCode)) {
            return err(`oldCode not found in layer ${layerId} SVG content. Make sure it's an exact substring.`)
          }
          const matchCount = svgObj.svgContent.split(oldCode).length - 1
          const patchedSvg = svgObj.svgContent.replace(oldCode, newCode)
          const updated = scene.svgObjects.map((o) => (o.id === layerId ? { ...o, svgContent: patchedSvg } : o))
          // Also update top-level svgContent if this is the primary object
          const updates: Partial<Scene> = { svgObjects: updated }
          if (scene.primaryObjectId === layerId) updates.svgContent = patchedSvg
          updateScene(world, sceneId, updates)
          await regenerateHTML(world, sceneId, logger)
          const warning =
            matchCount > 1 ? ` (warning: oldCode matched ${matchCount} times, only first was replaced)` : ''
          return ok(sceneId, `Patched SVG layer ${layerId}${warning}`)
        }

        // Try patching sceneCode/canvasCode/lottieSource
        const codeField =
          scene.sceneType === 'canvas2d'
            ? 'canvasCode'
            : scene.sceneType === 'lottie'
              ? 'lottieSource'
              : scene.sceneType === 'react'
                ? 'reactCode'
                : 'sceneCode'
        const code: string = (scene[codeField as keyof Scene] as string) || ''
        if (!code.includes(oldCode)) {
          // Try whitespace-normalized matching as a fallback
          const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim()
          const normalizedCode = normalizeWs(code)
          const normalizedOld = normalizeWs(oldCode)
          if (normalizedCode.includes(normalizedOld)) {
            // Find the actual substring with original whitespace
            const startHint = oldCode.trim().slice(0, 30)
            return err(
              `oldCode not found as-is in ${codeField}, but a whitespace-normalized match exists. ` +
                `The code likely has different indentation/newlines. Try copying the exact code starting with "${startHint}…" from the scene.`,
            )
          }
          // Show a nearby snippet for context
          const firstLine = oldCode.split('\n')[0].trim().slice(0, 40)
          const codeSnippetIdx = code.toLowerCase().indexOf(firstLine.toLowerCase())
          const hint =
            codeSnippetIdx >= 0
              ? ` Closest match near char ${codeSnippetIdx}: "${code.slice(Math.max(0, codeSnippetIdx - 10), codeSnippetIdx + 50).replace(/\n/g, '\\n')}…"`
              : ` Code is ${code.length} chars. First 80: "${code.slice(0, 80).replace(/\n/g, '\\n')}…"`
          return err(`oldCode not found in ${codeField}. Make sure it's an exact substring match.${hint}`)
        }
        const matchCount = code.split(oldCode).length - 1
        const patched = code.replace(oldCode, newCode)
        updateScene(world, sceneId, { [codeField]: patched })
        await regenerateHTML(world, sceneId, logger)
        const warning = matchCount > 1 ? ` (warning: oldCode matched ${matchCount} times, only first was replaced)` : ''
        return ok(sceneId, `Patched ${codeField} in scene ${sceneId}${warning}`)
      }

      // ── migrate_to_react ──────────────────────────────────────────────

      case 'migrate_to_react': {
        const { sceneId } = args as { sceneId: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        if (scene.sceneType === 'react') {
          return err(`Scene ${sceneId} is already a React scene`)
        }

        const reactCode = wrapSceneAsReact(scene)
        if (!reactCode) {
          return err(`Scene type "${scene.sceneType}" cannot be automatically migrated to React`)
        }

        updateScene(world, sceneId, {
          sceneType: 'react',
          reactCode,
        })
        await regenerateHTML(world, sceneId, logger)
        return ok(sceneId, `Migrated ${scene.sceneType} scene to React wrapper`, {
          previousType: scene.sceneType,
        })
      }

      // ── read_scene_code ──────────────────────────────────────────────
      // Returns the full source code for a scene — not truncated like the world state preview.

      case 'read_scene_code': {
        const { sceneId } = args as { sceneId: string }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const parts: string[] = []
        parts.push(`Scene: "${scene.name}" (${scene.id})`)
        parts.push(`Type: ${scene.sceneType}`)
        parts.push(`Duration: ${scene.duration}s`)

        // Primary code field
        const codeField =
          scene.sceneType === 'react'
            ? 'reactCode'
            : scene.sceneType === 'canvas2d'
              ? 'canvasCode'
              : scene.sceneType === 'svg'
                ? 'svgContent'
                : scene.sceneType === 'lottie'
                  ? 'lottieSource'
                  : 'sceneCode'
        const code = (scene[codeField as keyof Scene] as string) || ''
        if (code) {
          parts.push(`\n--- ${codeField} (${code.length} chars) ---`)
          parts.push(code)
        }

        if (scene.sceneStyles) {
          parts.push(`\n--- styles (${scene.sceneStyles.length} chars) ---`)
          parts.push(scene.sceneStyles)
        }

        if (scene.canvasBackgroundCode?.trim()) {
          parts.push(`\n--- canvasBackgroundCode (${scene.canvasBackgroundCode.length} chars) ---`)
          parts.push(scene.canvasBackgroundCode)
        }

        // SVG objects with full code
        if (scene.svgObjects?.length > 0) {
          parts.push(`\n--- SVG Objects (${scene.svgObjects.length}) ---`)
          for (const obj of scene.svgObjects) {
            parts.push(`\n[${obj.id}] "${obj.prompt?.slice(0, 80)}"`)
            if (obj.svgContent) parts.push(obj.svgContent)
          }
        }

        // AI layers with full code
        if (scene.aiLayers?.length > 0) {
          parts.push(`\n--- AI Layers (${scene.aiLayers.length}) ---`)
          for (const layer of scene.aiLayers) {
            parts.push(`\n[${layer.id}] type:${layer.type} label:"${layer.label}"`)
          }
        }

        return ok(sceneId, parts.join('\n'))
      }

      // ── write_scene_code ─────────────────────────────────────────────
      // Direct code write — skips the LLM generation call that add_layer uses.
      // Creates a new scene if sceneId is omitted, or replaces code on existing scene.

      case 'write_scene_code': {
        const {
          sceneId,
          sceneCode,
          styles,
          name: sceneName,
          duration,
          bgColor,
          sceneType: requestedType,
        } = args as {
          sceneId?: string
          sceneCode: string
          styles?: string
          name?: string
          duration?: number
          bgColor?: string
          sceneType?: SceneType
        }
        if (!sceneCode?.trim()) return err('sceneCode is required')

        const type: SceneType = requestedType ?? 'react'

        if (sceneId) {
          // Update existing scene
          const scene = findScene(world, sceneId)
          if (!scene) return err(`Scene ${sceneId} not found`)

          const codeField =
            type === 'react'
              ? 'reactCode'
              : type === 'canvas2d'
                ? 'canvasCode'
                : type === 'lottie'
                  ? 'lottieSource'
                  : type === 'svg'
                    ? 'svgContent'
                    : 'sceneCode'

          const updates: Partial<Scene> = {
            sceneType: type,
            [codeField]: sceneCode,
            ...(styles ? { sceneStyles: styles } : {}),
            ...(sceneName ? { name: sceneName } : {}),
            ...(duration ? { duration: Math.max(3, Math.min(30, duration)) } : {}),
            ...(bgColor ? { bgColor } : {}),
          }

          updateScene(world, sceneId, updates)
          await regenerateHTML(world, sceneId, logger)
          return ok(sceneId, `Wrote ${type} code to scene "${scene.name}" (${sceneId})`)
        }

        // Create new scene with the provided code
        const newScene: Scene = {
          id: uuidv4(),
          name: sceneName || 'Untitled Scene',
          prompt: '',
          summary: '',
          svgContent: type === 'svg' ? sceneCode : '',
          duration: Math.max(3, Math.min(30, duration || 8)),
          bgColor: bgColor || '#0a0c10',
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
          sceneType: type,
          canvasCode: type === 'canvas2d' ? sceneCode : '',
          canvasBackgroundCode: '',
          sceneCode: !['react', 'canvas2d', 'svg', 'lottie'].includes(type) ? sceneCode : '',
          reactCode: type === 'react' ? sceneCode : '',
          sceneHTML: '',
          sceneStyles: styles || '',
          lottieSource: type === 'lottie' ? sceneCode : '',
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

        world.scenes.push(newScene)
        await regenerateHTML(world, newScene.id, logger)
        return {
          success: true,
          affectedSceneId: newScene.id,
          changes: [
            {
              type: 'scene_created',
              sceneId: newScene.id,
              description: `Created scene "${newScene.name}" with ${type} code (${newScene.id})`,
            },
          ],
        }
      }

      default:
        return err(`Unknown layer tool: ${toolName}`)
    }
  }
}

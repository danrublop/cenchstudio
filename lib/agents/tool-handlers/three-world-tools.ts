import fs from 'fs/promises'
import path from 'path'
import type { SceneType } from '@/lib/types'
import type { AgentLogger } from '@/lib/agents/logger'
import type { ToolResult } from '@/lib/agents/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { clearStaleCodeFields } from '@/lib/agents/tool-executor'

export const THREE_WORLD_TOOL_NAMES = [
  'search_3d_models',
  'get_3d_model_url',
  'search_lottie',
  'create_world_scene',
  'list_3d_assets',
] as const

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function updateScene(world: WorldStateMutable, sceneId: string, updates: Record<string, unknown>) {
  const idx = world.scenes.findIndex((s) => s.id === sceneId)
  if (idx === -1) return null
  // If switching away from d3, clear chart-specific fields
  if (updates.sceneType && updates.sceneType !== 'd3') {
    updates.chartLayers = []
    updates.d3Data = null
  }
  world.scenes[idx] = { ...world.scenes[idx], ...updates }
  return world.scenes[idx]
}

// ── Handler Factory ──────────────────────────────────────────────────────────

export function createThreeWorldToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleThreeWorldTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      // ── search_3d_models ─────────────────────────────────────────────────
      case 'search_3d_models': {
        try {
          const cataloguePath = path.join(process.cwd(), 'public/models/library/index.json')
          const raw = await fs.readFile(cataloguePath, 'utf-8')
          const catalogue = JSON.parse(raw)
          const query = ((args.query as string) || '').toLowerCase()
          const categoryFilter = args.category as string | undefined

          const results = catalogue.models.filter(
            (m: { id: string; name: string; tags: string[]; description: string; category: string }) => {
              if (categoryFilter && m.category !== categoryFilter) return false
              const searchable = `${m.id} ${m.name} ${m.tags.join(' ')} ${m.description}`.toLowerCase()
              return query.split(/\s+/).every((word: string) => searchable.includes(word))
            },
          )

          if (results.length === 0) {
            return ok(
              null,
              `No 3D models found for "${args.query}". Available categories: ${Object.keys(catalogue.categories).join(', ')}`,
            )
          }

          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const formatted = results.map(
            (m: {
              id: string
              name: string
              category: string
              file: string
              tags: string[]
              description: string
              scale: number
            }) => ({
              id: m.id,
              name: m.name,
              category: m.category,
              url: `${baseUrl}/models/library/${m.file}`,
              tags: m.tags,
              description: m.description,
              scale: m.scale,
            }),
          )

          return ok(null, `Found ${results.length} model(s) matching "${args.query}"`, formatted)
        } catch {
          return ok(null, 'Model library not available — index.json not found')
        }
      }

      // ── get_3d_model_url ─────────────────────────────────────────────────
      case 'get_3d_model_url': {
        try {
          const cataloguePath = path.join(process.cwd(), 'public/models/library/index.json')
          const raw = await fs.readFile(cataloguePath, 'utf-8')
          const catalogue = JSON.parse(raw)
          const modelId = args.modelId as string
          const model = catalogue.models.find((m: { id: string }) => m.id === modelId)

          if (!model) {
            const available = catalogue.models.map((m: { id: string }) => m.id).join(', ')
            return ok(null, `Model "${modelId}" not found. Available: ${available}`)
          }

          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const url = `${baseUrl}/models/library/${model.file}`

          const snippet = `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('${url}', (gltf) => {
  const model = gltf.scene;
  model.scale.setScalar(${model.scale});
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(model);
});`

          return ok(null, `Model "${model.name}" — use GLTFLoader to load from ${url}`, {
            id: model.id,
            name: model.name,
            url,
            scale: model.scale,
            description: model.description,
            codeSnippet: snippet,
          })
        } catch {
          return ok(null, 'Model library not available — index.json not found')
        }
      }

      // ── search_lottie ────────────────────────────────────────────────────
      case 'search_lottie': {
        const { query, limit } = args as { query: string; limit?: number }
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const response = await fetch(
            `${baseUrl}/api/lottie/search?q=${encodeURIComponent(query)}&limit=${limit || 5}`,
          )
          if (!response.ok) {
            return {
              success: false,
              error: `Lottie search failed: ${response.statusText}`,
            }
          }
          const data = await response.json()
          return { success: true, affectedSceneId: null, data }
        } catch (e) {
          return {
            success: false,
            error: `Lottie search error: ${String(e)}`,
          }
        }
      }

      // ── create_world_scene ───────────────────────────────────────────────
      case 'create_world_scene': {
        const {
          sceneId,
          environment,
          environment_config,
          objects,
          panels,
          camera_path,
          duration: worldDuration,
        } = args as Record<string, any>
        if (!sceneId) return err('sceneId is required')
        if (!environment) return err('environment is required')

        const validEnvs = ['meadow', 'studio_room', 'void_space']
        if (!validEnvs.includes(environment)) return err(`Invalid environment. Must be one of: ${validEnvs.join(', ')}`)

        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        // Build WorldConfig
        const worldConfig: Record<string, unknown> = {
          environment,
          ...(environment_config || {}),
          objects: objects || [],
          panels: panels || [],
          avatars: [],
          cameraPath: camera_path || [],
        }

        // Update scene to 3d_world type
        const staleClears = clearStaleCodeFields('3d_world' as SceneType)
        const updates: Partial<Record<string, unknown>> = {
          ...staleClears,
          sceneType: '3d_world' as SceneType,
          worldConfig: worldConfig as any,
        }
        if (worldDuration) updates.duration = worldDuration

        updateScene(world, sceneId, updates)
        await deps.regenerateHTML(world, sceneId, logger)

        return ok(sceneId, `Created ${environment} 3D world scene`, {
          environment,
          objectCount: (objects || []).length,
          panelCount: (panels || []).length,
          cameraKeyframes: (camera_path || []).length,
        })
      }

      // ── list_3d_assets ───────────────────────────────────────────────────
      case 'list_3d_assets': {
        try {
          const cataloguePath = path.join(process.cwd(), 'public/models/library/index.json')
          const raw = await fs.readFile(cataloguePath, 'utf-8')
          const catalogue = JSON.parse(raw)
          const query = ((args.query as string) || '').toLowerCase()
          const categoryFilter = args.category as string | undefined

          let results = catalogue.models as Array<{
            id: string
            name: string
            tags: string[]
            description: string
            category: string
            scale: number
          }>

          if (categoryFilter) {
            results = results.filter((m) => m.category === categoryFilter)
          }

          if (query) {
            results = results.filter((m) => {
              const searchable = `${m.id} ${m.name} ${m.tags.join(' ')} ${m.description}`.toLowerCase()
              return query.split(/\s+/).every((word) => searchable.includes(word))
            })
          }

          if (results.length === 0) {
            return ok(
              null,
              `No 3D assets found for "${args.query || 'all'}". Available categories: ${Object.keys(catalogue.categories).join(', ')}`,
            )
          }

          const formatted = results.map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            tags: m.tags,
            description: m.description,
          }))

          return ok(null, `Found ${results.length} asset(s)`, formatted)
        } catch {
          return ok(null, 'Asset library not available — index.json not found')
        }
      }

      default:
        return err(`Unknown three/world tool: ${toolName}`)
    }
  }
}

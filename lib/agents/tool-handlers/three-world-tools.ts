import fs from 'fs/promises'
import path from 'path'
import type { SceneType } from '@/lib/types'
import type { AgentLogger } from '@/lib/agents/logger'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { clearStaleCodeFields } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

export const THREE_WORLD_TOOL_NAMES = [
  'search_3d_models',
  'get_3d_model_url',
  'search_lottie',
  'create_world_scene',
  'list_3d_assets',
  'extrude_svg_to_3d',
] as const

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
        const { query, category, limit } = args as { query: string; category?: string; limit?: number }
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const params = new URLSearchParams({ q: query, limit: String(limit || 5) })
          if (category) params.set('category', category)
          const response = await fetch(`${baseUrl}/api/lottie/search?${params}`)
          if (!response.ok) {
            return {
              success: false,
              error: `Lottie search failed: ${response.statusText}`,
            }
          }
          const data = await response.json()
          // Add usage hints to each result
          if (data.results) {
            for (const r of data.results) {
              r.usageHint = {
                motionScene: `CenchMotion.lottieSync('#lottie-wrap', { src: '${r.url}', tl: window.__tl, delay: 0.3 })`,
                reactScene: `<LottieLayer data="${r.url}" />`,
              }
            }
          }
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

      // ── extrude_svg_to_3d ─────────────────────────────────────────────
      case 'extrude_svg_to_3d': {
        const sceneId = args.sceneId as string
        const assetId = args.assetId as string
        const depth = (args.depth as number) ?? 20
        const materialStyle = (args.materialStyle as string) ?? 'chrome'
        const animate = args.animate !== false

        if (!sceneId || !assetId) return err('sceneId and assetId are required')

        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const asset = world.projectAssets?.find((a) => a.id === assetId)
        if (!asset) return err(`Asset ${assetId} not found in project assets`)
        if (asset.type !== 'svg') return err(`Asset ${assetId} is not an SVG (type: ${asset.type})`)

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const svgUrl = `${baseUrl}${asset.publicUrl}`

        // Material presets
        const matPresets: Record<string, string> = {
          chrome: 'metalness: 0.8, roughness: 0.15',
          matte: 'metalness: 0.05, roughness: 0.9',
          glass: 'metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.7',
          gold: 'metalness: 0.9, roughness: 0.2, color: new THREE.Color("#FFD700")',
        }
        const matProps = matPresets[materialStyle] || matPresets.chrome

        const rotationLine = animate ? `pivot.rotation.y = elapsed * 0.3;` : ''

        const sceneCode = `import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const { WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment } = window;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor(PALETTE[3] || '#1a1a2e');
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 0, 8);

window.THREE = THREE;
window.scene = scene;
window.camera = camera;
window.renderer = renderer;

setupEnvironment(scene, renderer);

// 3-point lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-4, 3, -2);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.6);
rim.position.set(0, -2, -5);
scene.add(rim);

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: PALETTE[3] || '#1a1a2e', roughness: 0.3, metalness: 0.6 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3.5;
floor.receiveShadow = true;
scene.add(floor);

// Pivot for rotation, inner group for centering
const pivot = new THREE.Group();
scene.add(pivot);

// Load and extrude SVG
fetch('${svgUrl}').then(r => r.text()).then(text => {
  const inner = new THREE.Group();
  const data = new SVGLoader().parse(text);
  let i = 0;
  for (const path of data.paths) {
    const shapes = SVGLoader.createShapes(path);
    for (const shape of shapes) {
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: ${depth},
        bevelEnabled: true,
        bevelThickness: ${Math.max(1, depth * 0.1)},
        bevelSize: ${Math.max(0.5, depth * 0.08)},
        bevelSegments: 8,
        curveSegments: 24,
      });
      // Always use palette colors — SVGLoader cannot resolve gradient/url() fills
      const mat = new THREE.MeshStandardMaterial({ color: PALETTE[i % PALETTE.length], ${matProps} });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      inner.add(mesh);
      i++;
    }
  }
  // Center inner group at origin, scale+flip via pivot
  const box = new THREE.Box3().setFromObject(inner);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  inner.position.set(-center.x, -center.y, -center.z);
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = 4 / maxDim;
  pivot.scale.set(s, -s, s);
  pivot.add(inner);
});

// Animation
window.__tl.to({}, {
  duration: DURATION,
  onUpdate() {
    const elapsed = window.__tl.time();
    ${rotationLine}
    renderer.render(scene, camera);
  }
}, 0);
`

        const staleClears = clearStaleCodeFields('three' as SceneType)
        updateScene(world, sceneId, {
          sceneType: 'three' as SceneType,
          sceneCode,
          ...staleClears,
        })

        await deps.regenerateHTML(world, sceneId, logger)

        return ok(
          sceneId,
          `Extruded SVG "${asset.name}" into 3D scene with ${materialStyle} material (depth: ${depth}).`,
        )
      }

      default:
        return err(`Unknown three/world tool: ${toolName}`)
    }
  }
}

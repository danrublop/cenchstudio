/**
 * Media-library agent tools.
 *
 * These five tools lift the agent from a "generate-on-every-request" model to a
 * "library-aware" model:
 *
 *   1. query_media_library        — search existing ProjectAssets before generating
 *   2. reuse_asset                — place an existing asset into a scene by id
 *   3. regenerate_asset           — retry a prior generation with overrides
 *   4. generate_image_from_reference — i2i flow with a reference ProjectAsset
 *   5. generate_variation         — sibling variation of an existing generated asset
 *
 * All successful generations land in projectAssets via persistGeneratedAsset
 * so subsequent runs can see them. Cost permission flows mirror the existing
 * generate_image path (checkApiPermission + enrichPermission).
 */

import { v4 as uuidv4 } from 'uuid'
import { and, eq, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectAssets } from '@/lib/db/schema'
import type { APIName, AssetType, ImageLayer, ImageModel, ProjectAsset } from '@/lib/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'
import { persistGeneratedAsset } from '@/lib/media/provenance'
import { enrichPrompt } from '@/lib/media/prompt-enhancer'
import { routeMediaIntent } from '@/lib/media/router'

export const MEDIA_LIBRARY_EXT_TOOL_NAMES = [
  'query_media_library',
  'reuse_asset',
  'regenerate_asset',
  'generate_image_from_reference',
  'generate_variation',
  'upload_media_from_url',
  'tag_asset',
] as const

export function createMediaLibraryExtHandler(deps: {
  checkMediaEnabled: (world: WorldStateMutable, providerId: string, label: string) => ToolResult | null
  checkApiPermission: (
    world: WorldStateMutable,
    api: APIName,
    context?: {
      reason?: string
      details?: { prompt?: string; duration?: number; model?: string; resolution?: string }
    },
  ) => ToolResult | null
  enrichPermission: (
    result: ToolResult,
    context: {
      generationType: import('@/lib/types').GenerationType
      prompt?: string
      provider?: string
      availableProviders?: import('@/lib/types').GenerationProviderOption[]
      config?: Record<string, any>
      toolArgs?: Record<string, any>
    },
  ) => ToolResult
  regenerateHTML: (
    world: WorldStateMutable,
    sceneId: string,
    logger?: import('@/lib/agents/logger').AgentLogger,
  ) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handleMediaLibraryExtTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: import('@/lib/agents/logger').AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'query_media_library':
        return await queryMediaLibrary(args, world)
      case 'reuse_asset':
        return await reuseAsset(args, world, deps, logger)
      case 'regenerate_asset':
        return await regenerateAsset(args, world, deps, logger)
      case 'generate_image_from_reference':
        return await generateImageFromReference(args, world, deps, logger)
      case 'generate_variation':
        return await generateVariation(args, world, deps, logger)
      case 'upload_media_from_url':
        return await uploadMediaFromUrl(args, world)
      case 'tag_asset':
        return await tagAsset(args, world)
      default:
        return err(`Unknown media-library tool: ${toolName}`)
    }
  }
}

// ── query_media_library ──────────────────────────────────────────────────────

async function queryMediaLibrary(args: Record<string, unknown>, world: WorldStateMutable): Promise<ToolResult> {
  const projectId = world.projectId
  if (!projectId) return err('Project id is not available in the agent world')

  const type = normalizeType(args.type)
  const source =
    args.source === 'upload' || args.source === 'generated' ? (args.source as 'upload' | 'generated') : null
  const promptMatch = typeof args.promptContains === 'string' ? (args.promptContains as string).trim() : ''
  const tag = typeof args.tag === 'string' ? (args.tag as string).trim() : ''
  const limit = clampInt(args.limit, 1, 50, 10)

  const conds = [eq(projectAssets.projectId, projectId)]
  if (type) conds.push(eq(projectAssets.type, type))
  if (source) conds.push(eq(projectAssets.source, source))
  if (promptMatch) conds.push(sql`LOWER(${projectAssets.prompt}) LIKE ${'%' + promptMatch.toLowerCase() + '%'}`)
  if (tag) conds.push(sql`${tag} = ANY(${projectAssets.tags})`)

  const rows = await db
    .select({
      id: projectAssets.id,
      name: projectAssets.name,
      type: projectAssets.type,
      source: projectAssets.source,
      publicUrl: projectAssets.publicUrl,
      thumbnailUrl: projectAssets.thumbnailUrl,
      width: projectAssets.width,
      height: projectAssets.height,
      prompt: projectAssets.prompt,
      provider: projectAssets.provider,
      model: projectAssets.model,
      tags: projectAssets.tags,
      createdAt: projectAssets.createdAt,
    })
    .from(projectAssets)
    .where(and(...conds))
    .orderBy(desc(projectAssets.createdAt))
    .limit(limit)

  return ok(null, `Found ${rows.length} asset${rows.length === 1 ? '' : 's'}`, { assets: rows, count: rows.length })
}

// ── reuse_asset ──────────────────────────────────────────────────────────────

async function reuseAsset(
  args: Record<string, unknown>,
  world: WorldStateMutable,
  deps: {
    regenerateHTML: (
      world: WorldStateMutable,
      sceneId: string,
      logger?: import('@/lib/agents/logger').AgentLogger,
    ) => Promise<any>
  },
  logger?: import('@/lib/agents/logger').AgentLogger,
): Promise<ToolResult> {
  const { assetId, sceneId } = args as { assetId?: string; sceneId?: string }
  if (!assetId || !sceneId) return err('assetId and sceneId are required')

  const projectId = world.projectId
  if (!projectId) return err('Project id unavailable')

  const [asset] = await db
    .select()
    .from(projectAssets)
    .where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, projectId)))
    .limit(1)

  if (!asset) return err(`Asset ${assetId} not found in project`)
  if (asset.type !== 'image' && asset.type !== 'svg') {
    return err(
      `reuse_asset currently supports image/svg assets only (asset is "${asset.type}"). Use set_video_layer for video.`,
    )
  }

  const scene = findScene(world, sceneId)
  if (!scene) return err(`Scene ${sceneId} not found`)

  const { x, y, width, height, opacity, zIndex } = args as {
    x?: number
    y?: number
    width?: number
    height?: number
    opacity?: number
    zIndex?: number
  }

  const newLayer: ImageLayer = {
    id: uuidv4(),
    type: 'image',
    prompt: asset.prompt ?? `Reused asset: ${asset.name}`,
    model: (asset.model as ImageModel) ?? 'flux-schnell',
    style: null,
    imageUrl: asset.publicUrl,
    x: x ?? 960,
    y: y ?? 540,
    width: width ?? asset.width ?? 800,
    height: height ?? asset.height ?? 600,
    rotation: 0,
    opacity: opacity ?? 1,
    zIndex: zIndex ?? 10,
    status: 'ready',
    label: asset.name,
  }
  updateScene(world, sceneId, { aiLayers: [...(scene.aiLayers || []), newLayer] })
  await deps.regenerateHTML(world, sceneId, logger)
  return ok(sceneId, `Reused asset "${asset.name}" from library`, {
    assetId,
    sceneLayerId: newLayer.id,
    publicUrl: asset.publicUrl,
  })
}

// ── regenerate_asset ─────────────────────────────────────────────────────────

async function regenerateAsset(
  args: Record<string, unknown>,
  world: WorldStateMutable,
  deps: {
    checkMediaEnabled: (world: WorldStateMutable, providerId: string, label: string) => ToolResult | null
    checkApiPermission: (world: WorldStateMutable, api: APIName, context?: any) => ToolResult | null
    enrichPermission: (result: ToolResult, context: any) => ToolResult
  },
  _logger?: import('@/lib/agents/logger').AgentLogger,
): Promise<ToolResult> {
  const { assetId, promptOverride, model, enhanceTags, aspectRatio } = args as {
    assetId?: string
    promptOverride?: string
    model?: ImageModel
    enhanceTags?: string[]
    aspectRatio?: string
  }
  if (!assetId) return err('assetId is required')

  const projectId = world.projectId
  if (!projectId) return err('Project id unavailable')

  const [parent] = await db
    .select()
    .from(projectAssets)
    .where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, projectId)))
    .limit(1)
  if (!parent) return err(`Asset ${assetId} not found`)
  if (parent.type !== 'image') return err(`regenerate_asset currently supports images only`)

  const mediaErr = deps.checkMediaEnabled(world, 'imageGen', 'AI Image Generation')
  if (mediaErr) return mediaErr

  const basePrompt = promptOverride?.trim() || parent.prompt || parent.name
  if (!basePrompt) return err('Parent asset has no prompt to regenerate from — pass promptOverride')
  const chosenModel: ImageModel = (model ?? (parent.model as ImageModel) ?? 'flux-schnell') as ImageModel
  const chosenAR = aspectRatio ?? deriveAspectFromDims(parent.width, parent.height) ?? '1:1'
  const chosenTags = enhanceTags ?? parent.enhanceTags ?? []

  const blocked = deps.checkApiPermission(world, 'imageGen', {
    reason: 'Regenerate AI image',
    details: { prompt: basePrompt, model: chosenModel },
  })
  if (blocked) {
    return deps.enrichPermission(blocked, {
      generationType: 'image',
      prompt: basePrompt,
      provider: chosenModel,
      config: { aspectRatio: chosenAR, enhanceTags: chosenTags, parentAssetId: parent.id },
      toolArgs: args,
    })
  }

  const finalPrompt = enrichPrompt(basePrompt, chosenTags, chosenModel)
  try {
    const { generateImage } = await import('@/lib/apis/image-gen')
    const result = await generateImage({
      prompt: finalPrompt,
      model: chosenModel,
      aspectRatio: chosenAR,
      style: null,
      skipCache: true, // regenerations must produce a fresh sibling
    })
    const persisted = await persistGeneratedAsset({
      projectId,
      sourceUrl: result.imageUrl,
      type: 'image',
      name: `${parent.name} — retry`,
      tags: parent.tags ?? [],
      width: result.width,
      height: result.height,
      metadata: {
        prompt: finalPrompt,
        provider: 'imageGen',
        model: chosenModel,
        costCents: Math.round((result.cost ?? 0) * 100),
        parentAssetId: parent.id,
        referenceAssetIds: parent.referenceAssetIds ?? null,
        enhanceTags: chosenTags,
      },
    })
    return ok(null, `Regenerated asset (parent ${parent.id.slice(0, 6)}…) → ${persisted.id}`, {
      assetId: persisted.id,
      parentAssetId: parent.id,
      publicUrl: persisted.publicUrl,
      prompt: finalPrompt,
      cost: result.cost,
    })
  } catch (e: any) {
    return err(`Regeneration failed: ${e.message}`)
  }
}

// ── generate_image_from_reference (i2i) ──────────────────────────────────────

async function generateImageFromReference(
  args: Record<string, unknown>,
  world: WorldStateMutable,
  deps: {
    checkMediaEnabled: (world: WorldStateMutable, providerId: string, label: string) => ToolResult | null
    checkApiPermission: (world: WorldStateMutable, api: APIName, context?: any) => ToolResult | null
    enrichPermission: (result: ToolResult, context: any) => ToolResult
  },
  _logger?: import('@/lib/agents/logger').AgentLogger,
): Promise<ToolResult> {
  const { referenceAssetId, prompt, model, aspectRatio, enhanceTags } = args as {
    referenceAssetId?: string
    prompt?: string
    model?: ImageModel
    aspectRatio?: string
    enhanceTags?: string[]
  }
  if (!referenceAssetId || !prompt) return err('referenceAssetId and prompt are required')

  const projectId = world.projectId
  if (!projectId) return err('Project id unavailable')

  const [ref] = await db
    .select()
    .from(projectAssets)
    .where(and(eq(projectAssets.id, referenceAssetId), eq(projectAssets.projectId, projectId)))
    .limit(1)
  if (!ref) return err(`Reference asset ${referenceAssetId} not found`)
  if (ref.type !== 'image' && ref.type !== 'svg') {
    return err('Reference asset must be an image or SVG')
  }

  const mediaErr = deps.checkMediaEnabled(world, 'imageGen', 'AI Image Generation')
  if (mediaErr) return mediaErr

  const route = routeMediaIntent({
    enabledMap: world.mediaGenEnabled ?? null,
    intent: 'i2i',
    preferModel: model ?? null,
    referenceImageUrl: ref.publicUrl,
  })
  if (route.providerId == null) {
    return err(`No provider available for image-to-image: ${route.reason}`)
  }

  const blocked = deps.checkApiPermission(world, 'imageGen', {
    reason: 'Generate image from reference',
    details: { prompt, model: route.modelId },
  })
  if (blocked) {
    return deps.enrichPermission(blocked, {
      generationType: 'image',
      prompt,
      provider: route.providerId,
      config: { aspectRatio, enhanceTags, referenceAssetId },
      toolArgs: args,
    })
  }

  const hint = `referencing the style and composition of this image: ${ref.publicUrl}`
  const finalPrompt = enrichPrompt(`${prompt}; ${hint}`, enhanceTags ?? [], route.modelId as ImageModel)

  try {
    const { generateImage } = await import('@/lib/apis/image-gen')
    const result = await generateImage({
      prompt: finalPrompt,
      model: route.modelId as ImageModel,
      aspectRatio: aspectRatio ?? deriveAspectFromDims(ref.width, ref.height) ?? '1:1',
      referenceImageUrl: ref.publicUrl,
    })
    const persisted = await persistGeneratedAsset({
      projectId,
      sourceUrl: result.imageUrl,
      type: 'image',
      name: `from ${ref.name}`,
      metadata: {
        prompt: finalPrompt,
        provider: route.providerId,
        model: route.modelId,
        costCents: Math.round((result.cost ?? 0) * 100),
        parentAssetId: null,
        referenceAssetIds: [ref.id],
        enhanceTags: enhanceTags ?? null,
      },
    })
    return ok(null, `Generated image from reference ${ref.id.slice(0, 6)}…`, {
      assetId: persisted.id,
      publicUrl: persisted.publicUrl,
      referenceAssetId: ref.id,
      prompt: finalPrompt,
      cost: result.cost,
    })
  } catch (e: any) {
    return err(`i2i generation failed: ${e.message}`)
  }
}

// ── generate_variation ───────────────────────────────────────────────────────

async function generateVariation(
  args: Record<string, unknown>,
  world: WorldStateMutable,
  deps: {
    checkMediaEnabled: (world: WorldStateMutable, providerId: string, label: string) => ToolResult | null
    checkApiPermission: (world: WorldStateMutable, api: APIName, context?: any) => ToolResult | null
    enrichPermission: (result: ToolResult, context: any) => ToolResult
  },
  _logger?: import('@/lib/agents/logger').AgentLogger,
): Promise<ToolResult> {
  // A variation is a regenerate with a fresh seed — we expose it as a separate tool
  // so the agent can pick the right verb ("make another version" vs "redo because it was bad").
  return await regenerateAsset({ ...args, promptOverride: (args as any).promptOverride ?? null }, world, deps)
}

// ── upload_media_from_url ────────────────────────────────────────────────────

async function uploadMediaFromUrl(args: Record<string, unknown>, world: WorldStateMutable): Promise<ToolResult> {
  const { url, name, tags } = args as { url?: string; name?: string; tags?: string[] }
  const projectId = world.projectId
  if (!projectId) return err('Project id is not available in the agent world')
  if (!url || typeof url !== 'string') return err('url is required')
  try {
    new URL(url)
  } catch {
    return err(`Invalid URL: ${url}`)
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/ingest-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, projectId, name, tags }),
    })
    const data = await response.json()
    if (!response.ok) return err(`Media ingest failed: ${data?.error ?? response.statusText}`)
    const asset = data.asset
    const summary = data.deduped
      ? `Deduped — "${asset.name}" already in library (contentHash: ${data.contentHash.slice(0, 8)}…)`
      : `Ingested ${asset.type} "${asset.name}" → asset ${asset.id}`
    return ok(null, summary, data)
  } catch (e: any) {
    return err(`Media ingest failed: ${e?.message ?? String(e)}`)
  }
}

// ── tag_asset ────────────────────────────────────────────────────────────────

async function tagAsset(args: Record<string, unknown>, world: WorldStateMutable): Promise<ToolResult> {
  const { assetId, tags, mode } = args as {
    assetId?: string
    tags?: string[]
    mode?: 'replace' | 'append'
  }
  const projectId = world.projectId
  if (!projectId) return err('Project id is not available in the agent world')
  if (!assetId) return err('assetId is required')
  if (!Array.isArray(tags)) return err('tags must be an array of strings')
  const cleanTags = tags
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim())
    .slice(0, 30)
  const effectiveMode = mode === 'append' ? 'append' : 'replace'

  const [asset] = await db
    .select()
    .from(projectAssets)
    .where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, projectId)))
    .limit(1)
  if (!asset) return err(`Asset ${assetId} not found`)

  const existing = asset.tags ?? []
  const nextTags = effectiveMode === 'replace' ? cleanTags : Array.from(new Set([...existing, ...cleanTags]))

  const [updated] = await db
    .update(projectAssets)
    .set({ tags: nextTags })
    .where(eq(projectAssets.id, assetId))
    .returning()

  return ok(
    null,
    `${effectiveMode === 'replace' ? 'Replaced' : 'Appended'} tags on "${updated.name}" — now [${nextTags.join(', ')}]`,
    {
      assetId,
      tags: nextTags,
      previousTags: existing,
    },
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeType(raw: unknown): AssetType | null {
  if (raw === 'image' || raw === 'video' || raw === 'svg') return raw
  return null
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function deriveAspectFromDims(w: number | null, h: number | null): string | null {
  if (!w || !h) return null
  const ratio = w / h
  if (ratio > 1.5) return '16:9'
  if (ratio < 0.7) return '9:16'
  if (ratio > 1.1) return '4:3'
  if (ratio < 0.9) return '3:4'
  return '1:1'
}

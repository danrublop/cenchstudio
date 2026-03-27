/**
 * Tool execution engine for the Cench Studio agent system.
 *
 * Each tool creates a snapshot before execution, performs the operation
 * against the world state (passed as mutable objects), and returns a
 * structured result with success/failure and affected scene info.
 *
 * Note: This module is SERVER-SIDE only and should be used inside API routes.
 * It does NOT directly access the Zustand store — instead it operates on
 * plain Scene[] and GlobalStyle objects, returning updated versions that
 * the API route then forwards to the client to apply via store actions.
 */

import { v4 as uuidv4 } from 'uuid'
import type { Scene, GlobalStyle, TextOverlay, TransitionType, SceneType, APIPermissions } from '../types'
import type { ToolResult, StateChange, StateSnapshot } from './types'
import { generateSceneHTML } from '../sceneTemplate'
import { generateCode } from '../generation/generate'

// ── Snapshot System ───────────────────────────────────────────────────────────

const snapshots: StateSnapshot[] = []
const MAX_SNAPSHOTS = 50

export function createSnapshot(scenes: Scene[], globalStyle: GlobalStyle, description: string): StateSnapshot {
  const snapshot: StateSnapshot = {
    id: uuidv4(),
    timestamp: Date.now(),
    description,
    // Deep clone
    scenes: JSON.parse(JSON.stringify(scenes)),
    globalStyle: { ...globalStyle },
  }
  snapshots.push(snapshot)
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.shift()
  }
  return snapshot
}

export function getSnapshots(): StateSnapshot[] {
  return [...snapshots]
}

export function getLastSnapshot(): StateSnapshot | null {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
}

// ── World State Container ─────────────────────────────────────────────────────

export interface WorldStateMutable {
  scenes: Scene[]
  globalStyle: GlobalStyle
  projectName: string
  outputMode: 'mp4' | 'interactive'
  apiPermissions?: APIPermissions
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function findScene(world: WorldStateMutable, sceneId: string): Scene | undefined {
  return world.scenes.find(s => s.id === sceneId)
}

function updateScene(world: WorldStateMutable, sceneId: string, updates: Partial<Scene>): Scene | null {
  const idx = world.scenes.findIndex(s => s.id === sceneId)
  if (idx === -1) return null
  const updated = { ...world.scenes[idx], ...updates }
  world.scenes[idx] = updated
  return updated
}

function ok(
  affectedSceneId: string | null,
  description: string,
  data?: unknown,
): ToolResult {
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

// ── Permission Helpers ────────────────────────────────────────────────────────

type APIName = keyof APIPermissions

/**
 * Check whether an API is permitted to be called based on the project's
 * APIPermissions config. Returns an error ToolResult when the call should be
 * blocked, or null when execution should proceed.
 *
 * We intentionally do NOT handle the ask_once / always_ask flow here — those
 * modes require a UI round-trip that can't happen inside a server-side tool
 * executor. Instead we surface an actionable message asking the user to grant
 * permission via Settings > API Permissions.
 */
function checkApiPermission(world: WorldStateMutable, api: APIName): ToolResult | null {
  if (!world.apiPermissions) return null
  const config = world.apiPermissions[api]
  if (!config) return null

  switch (config.mode) {
    case 'always_allow':
      return null
    case 'always_deny':
      return err(`${api} is disabled in project settings. Enable it under Settings > API Permissions.`)
    case 'always_ask':
    case 'ask_once':
      return err(`Permission required: ${api} usage needs approval. Enable it under Settings > API Permissions.`)
    default:
      return null
  }
}

// ── Tool Implementations ──────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  world: WorldStateMutable,
): Promise<ToolResult> {
  // Snapshot before every execution
  createSnapshot(world.scenes, world.globalStyle, `before:${toolName}`)

  switch (toolName) {
    // ── Scene Tools ──────────────────────────────────────────────────────────

    case 'create_scene': {
      const { name, prompt, duration, bgColor, position } = args as {
        name: string; prompt: string; duration: number; bgColor?: string; position?: number;
      }
      const newScene: Scene = {
        id: uuidv4(),
        name: name || '',
        prompt: prompt || '',
        summary: '',
        svgContent: '',
        duration: Math.max(3, Math.min(30, duration || 8)),
        bgColor: bgColor || '#181818',
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
        sceneType: 'svg',
        canvasCode: '',
        sceneCode: '',
        sceneHTML: '',
        sceneStyles: '',
        lottieSource: '',
        d3Data: null,
        interactions: [],
        variables: [],
        aiLayers: [],
        messages: [],
      }

      if (typeof position === 'number' && position >= 0 && position <= world.scenes.length) {
        world.scenes.splice(position, 0, newScene)
      } else {
        world.scenes.push(newScene)
      }

      return {
        success: true,
        affectedSceneId: newScene.id,
        changes: [{
          type: 'scene_created',
          sceneId: newScene.id,
          description: `Created scene "${name}" (${newScene.id})`,
        }],
        data: { sceneId: newScene.id },
      }
    }

    case 'delete_scene': {
      const { sceneId } = args as { sceneId: string }
      const idx = world.scenes.findIndex(s => s.id === sceneId)
      if (idx === -1) return err(`Scene ${sceneId} not found`)
      const sceneName = world.scenes[idx].name
      world.scenes.splice(idx, 1)
      return {
        success: true,
        affectedSceneId: sceneId,
        changes: [{ type: 'scene_deleted', sceneId, description: `Deleted scene "${sceneName}"` }],
      }
    }

    case 'duplicate_scene': {
      const { sceneId } = args as { sceneId: string }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const newScene: Scene = {
        ...JSON.parse(JSON.stringify(scene)),
        id: uuidv4(),
        name: scene.name ? `${scene.name} (copy)` : '(copy)',
        thumbnail: null,
        interactions: scene.interactions.map(el => ({ ...el, id: uuidv4() })),
      }
      const idx = world.scenes.findIndex(s => s.id === sceneId)
      world.scenes.splice(idx + 1, 0, newScene)
      return {
        success: true,
        affectedSceneId: newScene.id,
        changes: [{ type: 'scene_created', sceneId: newScene.id, description: `Duplicated scene as "${newScene.name}"` }],
        data: { sceneId: newScene.id },
      }
    }

    case 'reorder_scenes': {
      const { fromIndex, toIndex } = args as { fromIndex: number; toIndex: number }
      if (fromIndex < 0 || fromIndex >= world.scenes.length) return err(`fromIndex ${fromIndex} out of range`)
      if (toIndex < 0 || toIndex >= world.scenes.length) return err(`toIndex ${toIndex} out of range`)
      const [removed] = world.scenes.splice(fromIndex, 1)
      world.scenes.splice(toIndex, 0, removed)
      return ok(null, `Moved scene from position ${fromIndex} to ${toIndex}`)
    }

    case 'set_scene_duration': {
      const { sceneId, duration } = args as { sceneId: string; duration: number }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const clamped = Math.max(3, Math.min(30, duration))
      updateScene(world, sceneId, { duration: clamped })
      return ok(sceneId, `Set duration to ${clamped}s`)
    }

    case 'set_scene_background': {
      const { sceneId, bgColor } = args as { sceneId: string; bgColor: string }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      updateScene(world, sceneId, { bgColor })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Set background to ${bgColor}`)
    }

    case 'set_transition': {
      const { sceneId, transition } = args as { sceneId: string; transition: TransitionType }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      updateScene(world, sceneId, { transition })
      return ok(sceneId, `Set transition to "${transition}"`)
    }

    // ── Layer Tools ──────────────────────────────────────────────────────────

    case 'add_layer': {
      const { sceneId, layerType, prompt, zIndex, opacity, startAt } = args as {
        sceneId: string; layerType: SceneType; prompt: string;
        zIndex?: number; opacity?: number; startAt?: number;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      // Generate content via direct SDK call
      const result = await generateLayerContent(layerType, prompt, scene, world.globalStyle)
      if (!result.success) return err(result.error || 'Layer generation failed')

      const layerId = uuidv4()

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
          sceneType: 'svg',
          svgObjects: [...existing, newObj],
          svgContent: result.code || '',
        })
      } else {
        // For canvas2d, d3, three, motion, lottie — update sceneCode/canvasCode
        const updates: Partial<Scene> = { sceneType: layerType }
        if (layerType === 'canvas2d') updates.canvasCode = result.code || ''
        else if (layerType === 'lottie') updates.lottieSource = result.code || ''
        else updates.sceneCode = result.code || ''
        updateScene(world, sceneId, updates)
      }

      await regenerateHTML(world, sceneId)
      return {
        success: true,
        affectedSceneId: sceneId,
        changes: [{ type: 'scene_updated', sceneId, description: `Added ${layerType} layer: "${prompt}"` }],
        data: { layerId },
      }
    }

    case 'remove_layer': {
      const { sceneId, layerId } = args as { sceneId: string; layerId: string }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      // Try to remove from svgObjects
      const svgIdx = (scene.svgObjects || []).findIndex(o => o.id === layerId)
      if (svgIdx !== -1) {
        const newObjects = scene.svgObjects.filter(o => o.id !== layerId)
        updateScene(world, sceneId, { svgObjects: newObjects })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Removed SVG layer ${layerId}`)
      }

      // Try AI layers
      const aiIdx = (scene.aiLayers || []).findIndex(l => l.id === layerId)
      if (aiIdx !== -1) {
        const newLayers = scene.aiLayers.filter(l => l.id !== layerId)
        updateScene(world, sceneId, { aiLayers: newLayers })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Removed AI layer ${layerId}`)
      }

      return err(`Layer ${layerId} not found in scene ${sceneId}`)
    }

    case 'reorder_layer': {
      const { sceneId, layerId, zIndex } = args as { sceneId: string; layerId: string; zIndex: number }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const svgObj = (scene.svgObjects || []).find(o => o.id === layerId)
      if (svgObj) {
        const updated = scene.svgObjects.map(o => o.id === layerId ? { ...o, zIndex } : o)
        updateScene(world, sceneId, { svgObjects: updated })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Set layer ${layerId} z-index to ${zIndex}`)
      }
      return err(`Layer ${layerId} not found`)
    }

    case 'set_layer_opacity': {
      const { sceneId, layerId, opacity } = args as { sceneId: string; layerId: string; opacity: number }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const clamped = Math.max(0, Math.min(1, opacity))
      const svgObj = (scene.svgObjects || []).find(o => o.id === layerId)
      if (svgObj) {
        const updated = scene.svgObjects.map(o => o.id === layerId ? { ...o, opacity: clamped } : o)
        updateScene(world, sceneId, { svgObjects: updated })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Set layer ${layerId} opacity to ${clamped}`)
      }

      // Try AI layers
      const aiLayer = (scene.aiLayers || []).find(l => l.id === layerId)
      if (aiLayer) {
        const updated = scene.aiLayers.map(l => l.id === layerId ? { ...l, opacity: clamped } : l)
        updateScene(world, sceneId, { aiLayers: updated })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Set AI layer opacity to ${clamped}`)
      }
      return err(`Layer ${layerId} not found`)
    }

    case 'set_layer_visibility': {
      const { sceneId, layerId, visible } = args as { sceneId: string; layerId: string; visible: boolean }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      // Visibility is handled via opacity (0 = hidden, 1 = visible for SVG objects)
      const svgObj = (scene.svgObjects || []).find(o => o.id === layerId)
      if (svgObj) {
        const updated = scene.svgObjects.map(o => o.id === layerId ? { ...o, opacity: visible ? 1 : 0 } : o)
        updateScene(world, sceneId, { svgObjects: updated })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Set layer ${layerId} visibility to ${visible}`)
      }
      return err(`Layer ${layerId} not found`)
    }

    case 'set_layer_timing': {
      const { sceneId, layerId, startAt } = args as { sceneId: string; layerId: string; startAt: number }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      // startAt is stored in aiLayers
      const aiLayer = (scene.aiLayers || []).find(l => l.id === layerId)
      if (aiLayer) {
        const updated = scene.aiLayers.map(l => l.id === layerId ? { ...l, startAt } : l)
        updateScene(world, sceneId, { aiLayers: updated })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Set layer startAt to ${startAt}s`)
      }
      return err(`Layer ${layerId} not found in aiLayers`)
    }

    case 'regenerate_layer': {
      const { sceneId, layerId, prompt } = args as { sceneId: string; layerId: string; prompt: string }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const svgObj = (scene.svgObjects || []).find(o => o.id === layerId)
      if (svgObj) {
        const result = await generateLayerContent('svg', prompt, scene, world.globalStyle)
        if (!result.success) return err(result.error || 'Regeneration failed')
        const updated = scene.svgObjects.map(o => o.id === layerId
          ? { ...o, prompt, svgContent: result.code || '' }
          : o)
        updateScene(world, sceneId, { svgObjects: updated, svgContent: result.code || '' })
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Regenerated layer ${layerId}`)
      }

      // For non-SVG scenes, regenerate the scene code
      const layerType = scene.sceneType
      const result = await generateLayerContent(layerType, prompt, scene, world.globalStyle)
      if (!result.success) return err(result.error || 'Regeneration failed')

      const updates: Partial<Scene> = { prompt }
      if (layerType === 'canvas2d') updates.canvasCode = result.code || ''
      else if (layerType === 'lottie') updates.lottieSource = result.code || ''
      else updates.sceneCode = result.code || ''
      updateScene(world, sceneId, updates)
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Regenerated ${layerType} scene code`)
    }

    case 'patch_layer_code': {
      const { sceneId, layerId, oldCode, newCode } = args as {
        sceneId: string; layerId: string; oldCode: string; newCode: string;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      // Try SVG object
      const svgObj = (scene.svgObjects || []).find(o => o.id === layerId)
      if (svgObj) {
        if (!svgObj.svgContent.includes(oldCode)) {
          return err(`oldCode not found in layer ${layerId} SVG content. Make sure it's an exact substring.`)
        }
        const patchedSvg = svgObj.svgContent.replace(oldCode, newCode)
        const updated = scene.svgObjects.map(o => o.id === layerId ? { ...o, svgContent: patchedSvg } : o)
        // Also update top-level svgContent if this is the primary object
        const updates: Partial<Scene> = { svgObjects: updated }
        if (scene.primaryObjectId === layerId) updates.svgContent = patchedSvg
        updateScene(world, sceneId, updates)
        await regenerateHTML(world, sceneId)
        return ok(sceneId, `Patched SVG layer ${layerId}`)
      }

      // Try patching sceneCode/canvasCode
      const codeField = scene.sceneType === 'canvas2d' ? 'canvasCode' : 'sceneCode'
      const code: string = scene[codeField as keyof Scene] as string || ''
      if (!code.includes(oldCode)) {
        return err(`oldCode not found in ${codeField}. Make sure it's an exact substring match.`)
      }
      const patched = code.replace(oldCode, newCode)
      updateScene(world, sceneId, { [codeField]: patched })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Patched ${codeField} in scene ${sceneId}`)
    }

    // ── Element (Text Overlay) Tools ─────────────────────────────────────────

    case 'add_element': {
      const { sceneId, content, font, size, color, x, y, animation, duration, delay } = args as {
        sceneId: string; content: string; font?: string; size?: number; color?: string;
        x: number; y: number; animation?: string; duration?: number; delay?: number;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const validAnimations: TextOverlay['animation'][] = ['fade-in', 'slide-up', 'typewriter']
      const animValue = (animation as string) || 'fade-in'
      const overlay: TextOverlay = {
        id: uuidv4(),
        content: content || 'Text',
        font: font || 'Caveat',
        size: size || 48,
        color: color || '#ffffff',
        x,
        y,
        animation: validAnimations.includes(animValue as TextOverlay['animation'])
          ? (animValue as TextOverlay['animation'])
          : 'fade-in',
        duration: duration ?? 0.6,
        delay: delay ?? 0,
      }
      const updated = [...(scene.textOverlays || []), overlay]
      updateScene(world, sceneId, { textOverlays: updated })
      await regenerateHTML(world, sceneId)
      return {
        success: true,
        affectedSceneId: sceneId,
        changes: [{ type: 'scene_updated', sceneId, description: `Added text overlay "${content}"` }],
        data: { elementId: overlay.id },
      }
    }

    case 'edit_element': {
      const { sceneId, elementId, ...updates } = args as {
        sceneId: string; elementId: string;
        content?: string; font?: string; size?: number; color?: string;
        animation?: string; duration?: number; delay?: number;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const el = (scene.textOverlays || []).find(o => o.id === elementId)
      if (!el) return err(`Element ${elementId} not found`)

      const validAnimations: TextOverlay['animation'][] = ['fade-in', 'slide-up', 'typewriter']
      const updatedOverlays: TextOverlay[] = scene.textOverlays.map(o => {
        if (o.id !== elementId) return o
        const merged = { ...o, ...updates }
        if (merged.animation && !validAnimations.includes(merged.animation as TextOverlay['animation'])) {
          merged.animation = 'fade-in'
        }
        return merged as TextOverlay
      })
      updateScene(world, sceneId, { textOverlays: updatedOverlays })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Updated text overlay ${elementId}`)
    }

    case 'delete_element': {
      const { sceneId, elementId } = args as { sceneId: string; elementId: string }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const updated = (scene.textOverlays || []).filter(o => o.id !== elementId)
      updateScene(world, sceneId, { textOverlays: updated })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Deleted text overlay ${elementId}`)
    }

    case 'move_element': {
      const { sceneId, elementId, x, y } = args as { sceneId: string; elementId: string; x: number; y: number }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const updated = (scene.textOverlays || []).map(o => o.id === elementId ? { ...o, x, y } : o)
      updateScene(world, sceneId, { textOverlays: updated })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Moved text overlay ${elementId} to (${x}%, ${y}%)`)
    }

    case 'resize_element': {
      const { sceneId, elementId, size } = args as { sceneId: string; elementId: string; size: number }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const updated = (scene.textOverlays || []).map(o => o.id === elementId ? { ...o, size } : o)
      updateScene(world, sceneId, { textOverlays: updated })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Resized text overlay ${elementId} to ${size}px`)
    }

    case 'reorder_element': {
      // TextOverlays don't have zIndex — we reorder by array position
      // Higher zIndex = later in array (rendered on top)
      const { sceneId, elementId } = args as { sceneId: string; elementId: string; zIndex: number }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      return ok(sceneId, `Noted reorder for ${elementId} (position-based)`)
    }

    case 'adjust_element_timing': {
      const { sceneId, elementId, delay, duration } = args as {
        sceneId: string; elementId: string; delay?: number; duration?: number;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const updated = (scene.textOverlays || []).map(o =>
        o.id === elementId ? {
          ...o,
          ...(delay !== undefined ? { delay } : {}),
          ...(duration !== undefined ? { duration } : {}),
        } : o
      )
      updateScene(world, sceneId, { textOverlays: updated })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Adjusted timing for overlay ${elementId}`)
    }

    // ── Asset / Media Tools ──────────────────────────────────────────────────

    case 'search_images': {
      const permErr = checkApiPermission(world, 'unsplash')
      if (permErr) return permErr
      const { query, count } = args as { query: string; count?: number }
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/search-images?query=${encodeURIComponent(query)}&count=${count || 5}`)
        if (!response.ok) {
          return { success: false, error: `Image search failed: ${response.statusText}` }
        }
        const data = await response.json()
        return { success: true, affectedSceneId: null, data }
      } catch (e) {
        return { success: false, error: `Image search error: ${String(e)}` }
      }
    }

    case 'place_image': {
      const permErr = checkApiPermission(world, 'imageGen')
      if (permErr) return permErr
      const { sceneId, imageUrl, x, y, width, height, opacity, zIndex } = args as {
        sceneId: string; imageUrl: string; x: number; y: number;
        width: number; height: number; opacity?: number; zIndex?: number;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const newLayer = {
        id: uuidv4(),
        type: 'image' as const,
        prompt: `Placed image: ${imageUrl}`,
        model: 'flux-1.1-pro' as const,
        style: null,
        imageUrl,
        x, y, width, height,
        rotation: 0,
        opacity: opacity ?? 1,
        zIndex: zIndex ?? 1,
        status: 'ready' as const,
        label: 'Placed Image',
      }
      updateScene(world, sceneId, { aiLayers: [...(scene.aiLayers || []), newLayer] })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Placed image from ${imageUrl}`)
    }

    case 'set_audio_layer': {
      const { sceneId, src, volume, fadeIn, fadeOut, startOffset } = args as {
        sceneId: string; src?: string | null; volume?: number;
        fadeIn?: boolean; fadeOut?: boolean; startOffset?: number;
      }
      // Only check ElevenLabs permission when setting a new audio source
      if (src != null) {
        const permErr = checkApiPermission(world, 'elevenLabs')
        if (permErr) return permErr
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const audioLayer = {
        ...scene.audioLayer,
        enabled: src != null,
        src: src ?? null,
        volume: volume ?? scene.audioLayer?.volume ?? 1,
        fadeIn: fadeIn ?? scene.audioLayer?.fadeIn ?? false,
        fadeOut: fadeOut ?? scene.audioLayer?.fadeOut ?? false,
        startOffset: startOffset ?? scene.audioLayer?.startOffset ?? 0,
      }
      updateScene(world, sceneId, { audioLayer })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Updated audio layer`)
    }

    case 'set_video_layer': {
      const { sceneId, src, opacity, trimStart, trimEnd } = args as {
        sceneId: string; src?: string | null; opacity?: number;
        trimStart?: number; trimEnd?: number | null;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const videoLayer = {
        ...scene.videoLayer,
        enabled: src != null,
        src: src ?? null,
        opacity: opacity ?? scene.videoLayer?.opacity ?? 1,
        trimStart: trimStart ?? scene.videoLayer?.trimStart ?? 0,
        trimEnd: trimEnd !== undefined ? trimEnd : scene.videoLayer?.trimEnd ?? null,
      }
      updateScene(world, sceneId, { videoLayer })
      await regenerateHTML(world, sceneId)
      return ok(sceneId, `Updated video layer`)
    }

    // ── Global Style Tools ───────────────────────────────────────────────────

    case 'set_global_style': {
      const { palette, font, strokeWidth, theme, duration } = args as {
        palette?: string[]; font?: string; strokeWidth?: number;
        theme?: 'dark' | 'light'; duration?: number;
      }
      if (palette) world.globalStyle.palette = palette as GlobalStyle['palette']
      if (font) world.globalStyle.font = font
      if (strokeWidth !== undefined) world.globalStyle.strokeWidth = Math.max(1, Math.min(5, strokeWidth))
      if (theme) world.globalStyle.theme = theme
      if (duration) world.globalStyle.duration = duration

      return {
        success: true,
        affectedSceneId: null,
        changes: [{ type: 'global_updated', description: 'Updated global style' }],
      }
    }

    case 'set_all_transitions': {
      const { transition } = args as { transition: TransitionType }
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

    case 'plan_scenes': {
      const { title, scenes: plannedScenes, totalDuration, styleNotes } = args as {
        title: string;
        scenes: Array<{ name: string; purpose: string; sceneType: string; duration: number; transition?: string }>;
        totalDuration: number;
        styleNotes?: string;
      }
      // This is a "thinking" tool — just acknowledge the plan
      return {
        success: true,
        affectedSceneId: null,
        changes: [],
        data: {
          message: `Acknowledged plan for "${title}": ${plannedScenes.length} scenes, ${totalDuration}s total.`,
          styleNotes,
        },
      }
    }

    // ── Interaction Tools ────────────────────────────────────────────────────

    case 'add_interaction': {
      const { sceneId, type, x, y, width, height, appearsAt, config } = args as {
        sceneId: string; type: string; x: number; y: number;
        width: number; height: number; appearsAt: number; config: Record<string, unknown>;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)

      const element = {
        id: uuidv4(),
        type,
        x, y, width, height,
        appearsAt,
        hidesAt: null,
        entranceAnimation: 'fade' as const,
        ...config,
      }
      updateScene(world, sceneId, { interactions: [...(scene.interactions || []), element as any] })
      return {
        success: true,
        affectedSceneId: sceneId,
        changes: [{ type: 'scene_updated', sceneId, description: `Added ${type} interaction` }],
        data: { elementId: element.id },
      }
    }

    case 'edit_interaction': {
      const { sceneId, elementId, updates } = args as {
        sceneId: string; elementId: string; updates: Record<string, unknown>;
      }
      const scene = findScene(world, sceneId)
      if (!scene) return err(`Scene ${sceneId} not found`)
      const el = (scene.interactions || []).find(e => e.id === elementId)
      if (!el) return err(`Interaction ${elementId} not found`)

      const updated = scene.interactions.map(e => e.id === elementId ? { ...e, ...updates } : e)
      updateScene(world, sceneId, { interactions: updated })
      return ok(sceneId, `Updated interaction ${elementId}`)
    }

    case 'connect_scenes': {
      // Scene graph connections are managed client-side via updateSceneGraph
      // We return the data needed for the client to create the edge
      const { fromSceneId, toSceneId, conditionType, interactionId } = args as {
        fromSceneId: string; toSceneId: string; conditionType: string; interactionId?: string;
      }
      return {
        success: true,
        affectedSceneId: null,
        changes: [{ type: 'project_updated', description: `Connected scene ${fromSceneId} → ${toSceneId}` }],
        data: {
          edge: {
            id: uuidv4(),
            fromSceneId,
            toSceneId,
            condition: {
              type: conditionType,
              interactionId: interactionId ?? null,
              variableName: null,
              variableValue: null,
            },
          },
        },
      }
    }

    // ── Export Tools ─────────────────────────────────────────────────────────

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
      return err(`Unknown tool: ${toolName}`)
  }
}

// ── HTML Regeneration ─────────────────────────────────────────────────────────

async function regenerateHTML(world: WorldStateMutable, sceneId: string): Promise<void> {
  const scene = findScene(world, sceneId)
  if (!scene) return
  try {
    const html = generateSceneHTML(scene)
    updateScene(world, sceneId, { sceneHTML: html })
  } catch (e) {
    console.error('[ToolExecutor] HTML regeneration failed:', e)
  }
}

// ── Layer Generation ──────────────────────────────────────────────────────────

interface GenerationResult {
  success: boolean
  code?: string
  error?: string
}

async function generateLayerContent(
  layerType: SceneType,
  prompt: string,
  scene: Scene,
  globalStyle: GlobalStyle,
): Promise<GenerationResult> {
  try {
    const result = await generateCode(layerType, prompt, {
      palette: globalStyle.palette,
      bgColor: scene.bgColor,
      duration: scene.duration,
      font: globalStyle.font,
      strokeWidth: globalStyle.strokeWidth,
      d3Data: scene.d3Data ?? undefined,
    })
    return { success: true, code: result.code }
  } catch (e) {
    return { success: false, error: `Generation failed: ${String(e)}` }
  }
}

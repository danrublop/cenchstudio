'use client'

import { v4 as uuidv4 } from 'uuid'
import type { Scene, GlobalStyle, Project, AILayer } from '../types'
import { DEFAULT_AUDIO_SETTINGS } from '../types'
import { DEFAULT_AUDIO_PROVIDER_ENABLED } from '../audio/provider-registry'
import { DEFAULT_MEDIA_PROVIDER_ENABLED } from '../media/provider-registry'
import { createDefaultAPIPermissions } from '../permissions'
import { resolveStyle, type ResolvedStyle } from '../styles/presets'
import { deriveChartLayersFromScene } from '../charts/extract'
import { derivePhysicsLayersFromScene } from '../physics/extract'
import { normalizeTransition } from '../transitions'
import type { Storyboard } from '../agents/types'
import type { UndoableState } from './types'

// ── Module-level variables ───────────────────────────────────────────────────

export const MAX_UNDO = 50
export let _debouncedPushTimer: ReturnType<typeof setTimeout> | null = null
export let _hasPendingSnapshot = false
export let _inspectorSaveTimer: ReturnType<typeof setTimeout> | null = null
export let _inspectorUndoPushed = false

export function setDebouncedPushTimer(v: ReturnType<typeof setTimeout> | null) {
  _debouncedPushTimer = v
}

export function setHasPendingSnapshot(v: boolean) {
  _hasPendingSnapshot = v
}

export function setInspectorSaveTimer(v: ReturnType<typeof setTimeout> | null) {
  _inspectorSaveTimer = v
}

export function setInspectorUndoPushed(v: boolean) {
  _inspectorUndoPushed = v
}

// ── Helper functions ─────────────────────────────────────────────────────────

/** Resolve the globalStyle into concrete values for API calls */
export function getResolvedStyle(gs: GlobalStyle): ResolvedStyle {
  return resolveStyle(gs.presetId, gs)
}

export function aiLayerHasRenderableOrPending(layer: AILayer): boolean {
  if (layer.status === 'pending' || layer.status === 'generating' || layer.status === 'removing-bg') return true
  switch (layer.type) {
    case 'veo3':
      return !!(layer.videoUrl || layer.operationName)
    case 'avatar':
      return !!(layer.videoUrl || layer.heygenVideoId || layer.talkingHeadUrl)
    case 'image':
      return !!layer.imageUrl
    case 'sticker':
      return !!(layer.imageUrl || layer.stickerUrl)
    default:
      return false
  }
}

/** Code, HTML, video layer, or AI media (including in-flight generation). */
export function sceneHasRenderableContent(s: Scene): boolean {
  if (s.svgContent || s.canvasCode || s.sceneCode || s.reactCode || s.lottieSource) return true
  if (s.canvasBackgroundCode?.trim()) return true
  if (s.sceneHTML && s.sceneHTML.trim().length > 0) return true
  if (s.videoLayer?.enabled && s.videoLayer.src) return true
  const layers = s.aiLayers ?? []
  if (layers.length > 0 && layers.some(aiLayerHasRenderableOrPending)) return true
  return false
}

export function normalizeScene(scene: Scene): Scene {
  const derivedChartLayers = deriveChartLayersFromScene(scene)
  const derivedPhysicsLayers = derivePhysicsLayersFromScene(scene)
  // Strip transient build flags — these are runtime-only for incremental timeline updates
  const { _building, _buildPhase, ...cleanScene } = scene as any
  return {
    ...cleanScene,
    canvasBackgroundCode: cleanScene.canvasBackgroundCode ?? '',
    chartLayers: derivedChartLayers,
    physicsLayers: derivedPhysicsLayers,
    transition: normalizeTransition(cleanScene.transition),
  }
}

export function ensureStoryboardSceneIdsForPair(
  proposed: Storyboard | null,
  edited: Storyboard | null,
): { proposed: Storyboard | null; edited: Storyboard | null } {
  if (!proposed && !edited) return { proposed: null, edited: null }
  if (!proposed) return { proposed: null, edited: edited ? ensureStoryboardSceneIds(edited) : null }
  if (!edited) return { proposed: ensureStoryboardSceneIds(proposed), edited: null }

  const proposedScenes = proposed.scenes ?? []
  const editedScenes = edited.scenes ?? []

  let changed = false
  const maxLen = Math.max(proposedScenes.length, editedScenes.length)
  const outProposedScenes = proposedScenes.map((s) => ({ ...s }))
  const outEditedScenes = editedScenes.map((s) => ({ ...s }))

  const genId = () => uuidv4()

  for (let i = 0; i < maxLen; i++) {
    const ps = outProposedScenes[i]
    const es = outEditedScenes[i]
    if (ps && es) {
      if (!ps.id && es.id) {
        ps.id = es.id
        changed = true
      } else if (ps.id && !es.id) {
        es.id = ps.id
        changed = true
      } else if (!ps.id && !es.id) {
        const shared = genId()
        ps.id = shared
        es.id = shared
        changed = true
      }
    } else if (ps && !ps.id) {
      ps.id = genId()
      changed = true
    } else if (es && !es.id) {
      es.id = genId()
      changed = true
    }
  }

  if (!changed) return { proposed, edited }

  return {
    proposed: { ...proposed, scenes: outProposedScenes },
    edited: { ...edited, scenes: outEditedScenes },
  }
}

export function ensureStoryboardSceneIds(sb: Storyboard): Storyboard {
  const scenes = sb.scenes ?? []
  let changed = false
  const genId = () => uuidv4()
  const outScenes = scenes.map((s) => {
    if (s.id) return s
    changed = true
    return { ...s, id: genId() }
  })
  return changed ? { ...sb, scenes: outScenes } : sb
}

/** Read the persisted editor theme from its dedicated localStorage key. */
export function getPersistedTheme(): 'dark' | 'light' | 'blue' {
  if (typeof window === 'undefined') return 'dark'
  const v = localStorage.getItem('cench-editor-theme')
  if (v === 'light' || v === 'blue') return v
  return 'dark'
}

/** Write the editor theme to its dedicated localStorage key. */
export function setPersistedTheme(theme: 'dark' | 'light' | 'blue') {
  if (typeof window !== 'undefined') localStorage.setItem('cench-editor-theme', theme)
}

export const DEFAULT_GLOBAL_STYLE: GlobalStyle = {
  presetId: null,
  paletteOverride: null,
  bgColorOverride: null,
  fontOverride: null,
  bodyFontOverride: null,
  strokeColorOverride: null,
  theme: typeof window !== 'undefined' ? getPersistedTheme() : 'dark',
  uiTypography: 'app',
  uiFontFamily: null,
}

export function createDefaultProject(scenes: Scene[] = []): Project {
  const now = new Date().toISOString()
  const startSceneId = scenes[0]?.id ?? ''
  return {
    id: uuidv4(),
    name: 'Untitled Project',
    outputMode: 'mp4',
    createdAt: now,
    updatedAt: now,
    mp4Settings: { resolution: '1080p', fps: 30, format: 'mp4', aspectRatio: '16:9' as const },
    interactiveSettings: {
      playerTheme: 'dark',
      showProgressBar: true,
      showSceneNav: true,
      allowFullscreen: true,
      brandColor: '#e84545',
      customDomain: null,
      password: null,
    },
    sceneGraph: {
      nodes: scenes.map((s, i) => ({ id: s.id, position: { x: i * 220, y: 100 } })),
      edges: scenes.slice(0, -1).map((s, i) => ({
        id: uuidv4(),
        fromSceneId: s.id,
        toSceneId: scenes[i + 1].id,
        condition: { type: 'auto', interactionId: null, variableName: null, variableValue: null },
      })),
      startSceneId,
    },
    apiPermissions: createDefaultAPIPermissions(),
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    audioProviderEnabled: { ...DEFAULT_AUDIO_PROVIDER_ENABLED },
    mediaGenEnabled: { ...DEFAULT_MEDIA_PROVIDER_ENABLED },
    watermark: null,
    brandKit: null,
    pausedAgentRun: null,
  }
}

export function createDefaultScene(prompt = ''): Scene {
  return {
    id: uuidv4(),
    name: '',
    prompt,
    summary: '',
    svgContent: '',
    duration: 8,
    bgColor: '#ffffff',
    thumbnail: null,
    videoLayer: {
      enabled: false,
      src: null,
      opacity: 1,
      trimStart: 0,
      trimEnd: null,
    },
    audioLayer: {
      enabled: false,
      src: null,
      volume: 1,
      fadeIn: false,
      fadeOut: false,
      startOffset: 0,
    },
    textOverlays: [],
    svgObjects: [],
    primaryObjectId: null,
    svgBranches: [],
    activeBranchId: null,
    transition: 'none',
    usage: null,
    sceneType: 'react',
    canvasCode: '',
    canvasBackgroundCode: '',
    sceneCode: '',
    reactCode: '',
    threeEnvironmentPresetId: null,
    sceneHTML: '',
    sceneStyles: '',
    lottieSource: '',
    d3Data: null,
    chartLayers: [],
    physicsLayers: [],
    interactions: [],
    variables: [],
    aiLayers: [],
    messages: [],
    styleOverride: {},
    cameraMotion: null,
    elementOverrides: {},
    worldConfig: null,
    layerHiddenIds: [],
    layerPanelOrder: undefined,
  }
}

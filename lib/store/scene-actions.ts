'use client'

import { v4 as uuidv4 } from 'uuid'
import type { Scene, TextOverlay, SvgObject, SvgBranch, SceneNode, InteractionElement } from '../types'
import type { Set, Get } from './types'
import { createDefaultScene } from './helpers'

export function createSceneActions(set: Set, get: Get) {
  return {
    addScene: (prompt = '') => {
      get()._pushUndo()
      const { globalStyle, project } = get()
      const scene = createDefaultScene(prompt)
      scene.duration = globalStyle.duration ?? 8

      set((state) => {
        const newScenes = [...state.scenes, scene]
        // Sync scene graph nodes
        const existingNodeIds = new Set(state.project.sceneGraph.nodes.map((n) => n.id))
        const newNodes: SceneNode[] = [...state.project.sceneGraph.nodes]
        if (!existingNodeIds.has(scene.id)) {
          newNodes.push({ id: scene.id, position: { x: newScenes.length * 220, y: 100 } })
        }
        return {
          scenes: newScenes,
          selectedSceneId: scene.id,
          project: {
            ...state.project,
            sceneGraph: { ...state.project.sceneGraph, nodes: newNodes },
          },
        }
      })
      return scene.id
    },

    updateScene: (id: string, updates: Partial<Scene>) => {
      get()._pushUndoDebounced()
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s)),
      }))
    },

    deleteScene: (id: string) => {
      get()._pushUndo()
      set((state) => {
        const newScenes = state.scenes.filter((s) => s.id !== id)
        const newSelectedId = state.selectedSceneId === id ? (newScenes[0]?.id ?? null) : state.selectedSceneId
        // Remove from scene graph
        const newGraph = {
          ...state.project.sceneGraph,
          nodes: state.project.sceneGraph.nodes.filter((n) => n.id !== id),
          edges: state.project.sceneGraph.edges.filter((e) => e.fromSceneId !== id && e.toSceneId !== id),
          startSceneId:
            state.project.sceneGraph.startSceneId === id
              ? (newScenes[0]?.id ?? '')
              : state.project.sceneGraph.startSceneId,
        }
        return {
          scenes: newScenes,
          selectedSceneId: newSelectedId,
          project: { ...state.project, sceneGraph: newGraph },
        }
      })
    },

    duplicateScene: (id: string) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === id)
      if (!scene) return
      const newScene: Scene = {
        ...scene,
        id: uuidv4(),
        name: scene.name ? `${scene.name} (copy)` : '',
        thumbnail: null,
        interactions: scene.interactions.map((el) => ({ ...el, id: uuidv4() })),
      }
      set((state) => {
        const idx = state.scenes.findIndex((s) => s.id === id)
        const scenes = [...state.scenes]
        scenes.splice(idx + 1, 0, newScene)
        const newNodes: SceneNode[] = [
          ...state.project.sceneGraph.nodes,
          { id: newScene.id, position: { x: (idx + 2) * 220, y: 100 } },
        ]
        return {
          scenes,
          selectedSceneId: newScene.id,
          project: { ...state.project, sceneGraph: { ...state.project.sceneGraph, nodes: newNodes } },
        }
      })
      get().saveSceneHTML(newScene.id)
    },

    reorderScenes: (fromIndex: number, toIndex: number) => {
      get()._pushUndo()
      set((state) => {
        const scenes = [...state.scenes]
        const [removed] = scenes.splice(fromIndex, 1)
        scenes.splice(toIndex, 0, removed)
        return { scenes }
      })
    },

    moveScene: (id: string, direction: 'up' | 'down') => {
      get()._pushUndo()
      set((state) => {
        const scenes = [...state.scenes]
        const idx = scenes.findIndex((s) => s.id === id)
        if (direction === 'up' && idx > 0) {
          ;[scenes[idx - 1], scenes[idx]] = [scenes[idx], scenes[idx - 1]]
        } else if (direction === 'down' && idx < scenes.length - 1) {
          ;[scenes[idx], scenes[idx + 1]] = [scenes[idx + 1], scenes[idx]]
        }
        return { scenes }
      })
    },

    selectScene: (id: string) => {
      get().clearInspector()
      set({
        selectedSceneId: id,
        textEditorSlotKey: null,
        layersTabSectionPending: null,
        layersTabAvatarLayerIdPending: null,
        layerStackPropertiesKey: null,
      })
    },

    addTextOverlay: (sceneId: string) => {
      get()._pushUndo()
      const overlay: TextOverlay = {
        id: uuidv4(),
        content: 'Text overlay',
        font: 'Caveat',
        size: 48,
        color: '#ffffff',
        x: 50,
        y: 50,
        animation: 'fade-in',
        duration: 1,
        delay: 0,
      }
      get().updateScene(sceneId, {
        textOverlays: [...(get().scenes.find((s) => s.id === sceneId)?.textOverlays ?? []), overlay],
      })
    },

    updateTextOverlay: (sceneId: string, overlayId: string, updates: Partial<TextOverlay>) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        textOverlays: scene.textOverlays.map((o) => (o.id === overlayId ? { ...o, ...updates } : o)),
      })
    },

    removeTextOverlay: (sceneId: string, overlayId: string) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        textOverlays: scene.textOverlays.filter((o) => o.id !== overlayId),
      })
    },

    addSvgObject: (sceneId: string) => {
      get()._pushUndo()
      const obj: SvgObject = {
        id: uuidv4(),
        prompt: '',
        svgContent: '',
        x: 25,
        y: 25,
        width: 50,
        opacity: 1,
        zIndex: 4,
      }
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, { svgObjects: [...scene.svgObjects, obj] })
    },

    updateSvgObject: (sceneId: string, objectId: string, updates: Partial<SvgObject>) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        svgObjects: scene.svgObjects.map((o) => (o.id === objectId ? { ...o, ...updates } : o)),
      })
    },

    removeSvgObject: (sceneId: string, objectId: string) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        svgObjects: scene.svgObjects.filter((o) => o.id !== objectId),
      })
    },

    switchBranch: (sceneId: string, branchId: string) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      const branch = scene.svgBranches.find((b) => b.id === branchId)
      if (!branch) return
      get().updateScene(sceneId, {
        svgContent: branch.svgContent,
        usage: branch.usage,
        activeBranchId: branchId,
      })
      if (scene.primaryObjectId) {
        get().updateSvgObject(sceneId, scene.primaryObjectId, { svgContent: branch.svgContent })
      }
      get().saveSceneHTML(sceneId)
    },

    // ── Variable actions ──

    addSceneVariable: (sceneId: string, variable: import('@/lib/types').SceneVariable) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      // Don't add duplicates
      if ((scene.variables ?? []).some((v) => v.name === variable.name)) return
      get().updateScene(sceneId, {
        variables: [...(scene.variables ?? []), variable],
      })
    },

    removeSceneVariable: (sceneId: string, variableName: string) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        variables: (scene.variables ?? []).filter((v) => v.name !== variableName),
      })
    },

    runtimeVariables: {},

    setRuntimeVariable: (sceneId: string, name: string, value: unknown) => {
      set((state) => ({
        runtimeVariables: {
          ...state.runtimeVariables,
          [sceneId]: { ...(state.runtimeVariables[sceneId] ?? {}), [name]: value },
        },
      }))
    },

    getRuntimeVariables: (sceneId: string) => {
      return get().runtimeVariables[sceneId] ?? {}
    },

    // ── Interaction actions ──

    addInteraction: (sceneId: string, element: InteractionElement) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        interactions: [...(scene.interactions ?? []), element],
      })
    },

    updateInteraction: (sceneId: string, elementId: string, updates: Partial<InteractionElement>) => {
      get()._pushUndoDebounced()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        interactions: (scene.interactions ?? []).map((el) =>
          el.id === elementId ? ({ ...el, ...updates } as InteractionElement) : el,
        ),
      })
    },

    replaceInteraction: (sceneId: string, elementId: string, next: InteractionElement) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        interactions: (scene.interactions ?? []).map((el) => (el.id === elementId ? next : el)),
      })
    },

    removeInteraction: (sceneId: string, elementId: string) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        interactions: (scene.interactions ?? []).filter((el) => el.id !== elementId),
      })
    },

    captureSceneThumbnail: (sceneId: string, dataUrl: string) => {
      get().updateScene(sceneId, { thumbnail: dataUrl })
    },
  }
}

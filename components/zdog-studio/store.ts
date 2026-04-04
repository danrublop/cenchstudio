'use client'

import { create } from 'zustand'
import type {
  ZdogStudioShape,
  ZdogStudioShapeType,
  ZdogStudioSceneState,
  ZdogStudioAsset,
} from '@/lib/types/zdog-studio'

const TAU = Math.PI * 2

// ── Default person rig ────────────────────────────────────────────────────────

export const DEFAULT_PERSON_SHAPES: ZdogStudioShape[] = [
  {
    id: 'hips',
    type: 'Shape',
    name: 'Hips',
    properties: { path: [{ x: -3 }, { x: 3 }], stroke: 4, color: '#636' },
    transforms: { translate: { y: 5 }, rotate: {}, scale: 1 },
  },
  {
    id: 'spine',
    type: 'Anchor',
    parentId: 'hips',
    name: 'Spine',
    properties: {},
    transforms: { translate: {}, rotate: { x: TAU / 8 }, scale: 1 },
  },
  {
    id: 'chest',
    type: 'Shape',
    parentId: 'spine',
    name: 'Chest',
    properties: { path: [{ x: -1.5 }, { x: 1.5 }], stroke: 9, color: '#C25' },
    transforms: { translate: { y: -6.5 }, rotate: {}, scale: 1 },
  },
  {
    id: 'head',
    type: 'Shape',
    parentId: 'chest',
    name: 'Head',
    properties: { stroke: 12, color: '#EA0' },
    transforms: { translate: { y: -9.5 }, rotate: {}, scale: 1 },
  },
  {
    id: 'eye-left',
    type: 'Ellipse',
    parentId: 'head',
    name: 'Left Eye',
    properties: { diameter: 2, quarters: 2, stroke: 0.5, color: '#333', backface: false },
    transforms: { translate: { x: -2, y: 1, z: 4.5 }, rotate: { z: -TAU / 4 }, scale: 1 },
  },
  {
    id: 'eye-right',
    type: 'Ellipse',
    parentId: 'head',
    name: 'Right Eye',
    properties: { diameter: 2, quarters: 2, stroke: 0.5, color: '#333', backface: false },
    transforms: { translate: { x: 2, y: 1, z: 4.5 }, rotate: { z: -TAU / 4 }, scale: 1 },
  },
  {
    id: 'smile',
    type: 'Ellipse',
    parentId: 'head',
    name: 'Smile',
    properties: { diameter: 3, quarters: 2, stroke: 0.5, color: '#FED', fill: true, closed: true, backface: false },
    transforms: { translate: { y: 2.5, z: 4.5 }, rotate: { z: TAU / 4 }, scale: 1 },
  },
  ...Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * TAU
    const r = 5.5
    return {
      id: `hair-${i + 1}`,
      type: 'Shape' as ZdogStudioShapeType,
      parentId: 'head',
      name: `Hair ${i + 1}`,
      properties: { stroke: 2.5, color: '#4B2C20' },
      transforms: {
        translate: {
          x: Math.round(Math.cos(angle) * r * 10) / 10,
          y: -4 + Math.round(Math.sin(angle) * 2 * 10) / 10,
          z: Math.round(Math.sin(angle) * r * 10) / 10,
        },
        rotate: {},
        scale: 1,
      },
    }
  }),
  {
    id: 'leg-left',
    type: 'Shape',
    parentId: 'hips',
    name: 'Left Leg',
    properties: { path: [{ y: 0 }, { y: 12 }], stroke: 4, color: '#636' },
    transforms: { translate: { x: -3 }, rotate: { x: TAU / 4 }, scale: 1 },
  },
  {
    id: 'foot-left',
    type: 'RoundedRect',
    parentId: 'leg-left',
    name: 'Left Foot',
    properties: { width: 2, height: 4, cornerRadius: 1, stroke: 4, color: '#C25', fill: true },
    transforms: { translate: { y: 14, z: 2 }, rotate: { x: TAU / 4 }, scale: 1 },
  },
  {
    id: 'leg-right',
    type: 'Shape',
    parentId: 'hips',
    name: 'Right Leg',
    properties: { path: [{ y: 0 }, { y: 12 }], stroke: 4, color: '#636' },
    transforms: { translate: { x: 3 }, rotate: { x: -TAU / 8 }, scale: 1 },
  },
  {
    id: 'foot-right',
    type: 'RoundedRect',
    parentId: 'leg-right',
    name: 'Right Foot',
    properties: { width: 2, height: 4, cornerRadius: 1, stroke: 4, color: '#C25', fill: true },
    transforms: { translate: { y: 14, z: 2 }, rotate: { x: -TAU / 8 }, scale: 1 },
  },
  {
    id: 'arm-upper-left',
    type: 'Shape',
    parentId: 'chest',
    name: 'Left Upper Arm',
    properties: { path: [{ y: 0 }, { y: 6 }], stroke: 4, color: '#636' },
    transforms: { translate: { x: -5, y: -2 }, rotate: { x: -TAU / 4 }, scale: 1 },
  },
  {
    id: 'arm-fore-left',
    type: 'Shape',
    parentId: 'arm-upper-left',
    name: 'Left Forearm',
    properties: { path: [{ y: 0 }, { y: 6 }], stroke: 4, color: '#EA0' },
    transforms: { translate: { y: 6 }, rotate: { x: TAU / 8 }, scale: 1 },
  },
  {
    id: 'hand-left',
    type: 'Shape',
    parentId: 'arm-fore-left',
    name: 'Left Hand',
    properties: { stroke: 6, color: '#EA0' },
    transforms: { translate: { y: 6, z: 1 }, rotate: {}, scale: 1 },
  },
  {
    id: 'arm-upper-right',
    type: 'Shape',
    parentId: 'chest',
    name: 'Right Upper Arm',
    properties: { path: [{ y: 0 }, { y: 6 }], stroke: 4, color: '#636' },
    transforms: { translate: { x: 5, y: -2 }, rotate: { x: TAU / 4 }, scale: 1 },
  },
  {
    id: 'arm-fore-right',
    type: 'Shape',
    parentId: 'arm-upper-right',
    name: 'Right Forearm',
    properties: { path: [{ y: 0 }, { y: 6 }], stroke: 4, color: '#EA0' },
    transforms: { translate: { y: 6 }, rotate: { x: TAU / 8 }, scale: 1 },
  },
  {
    id: 'hand-right',
    type: 'Shape',
    parentId: 'arm-fore-right',
    name: 'Right Hand',
    properties: { stroke: 6, color: '#EA0' },
    transforms: { translate: { y: 6, z: 1 }, rotate: {}, scale: 1 },
  },
]

// ── Zdog Studio Store ─────────────────────────────────────────────────────────

interface ZdogStudioStore {
  scene: ZdogStudioSceneState
  history: ZdogStudioSceneState[]
  historyIndex: number
  isSpinning: boolean
  showCode: boolean
  assetName: string
  assets: ZdogStudioAsset[]
  saving: boolean
  activeTab: 'outliner' | 'library'

  // Actions
  setScene: (s: ZdogStudioSceneState) => void
  pushToHistory: (s: ZdogStudioSceneState) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  setSpinning: (v: boolean) => void
  setShowCode: (v: boolean) => void
  setAssetName: (v: string) => void
  setAssets: (v: ZdogStudioAsset[]) => void
  setSaving: (v: boolean) => void
  setActiveTab: (v: 'outliner' | 'library') => void
  addShape: (type: ZdogStudioShapeType) => void
  updateShape: (id: string, updates: Partial<ZdogStudioShape>) => void
  updateProperty: (id: string, prop: string, value: any) => void
  updateTransform: (
    id: string,
    type: 'translate' | 'rotate' | 'scale',
    axis: 'x' | 'y' | 'z' | null,
    value: number,
  ) => void
  deleteShape: (id: string) => void
  loadShapes: (shapes: ZdogStudioShape[]) => void
  reset: () => void
}

const INITIAL_STATE: ZdogStudioSceneState = {
  shapes: DEFAULT_PERSON_SHAPES,
  selectedId: 'hips',
  zoom: 5,
}

export const useZdogStudio = create<ZdogStudioStore>((set, get) => ({
  scene: INITIAL_STATE,
  history: [INITIAL_STATE],
  historyIndex: 0,
  isSpinning: true,
  showCode: false,
  assetName: '',
  assets: [],
  saving: false,
  activeTab: 'outliner',

  setScene: (s) => set({ scene: s }),

  pushToHistory: (newState) => {
    const { history, historyIndex, scene: current } = get()
    if (JSON.stringify(current.shapes) === JSON.stringify(newState.shapes) && current.zoom === newState.zoom) {
      set({ scene: newState })
      return
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newState)
    if (newHistory.length > 50) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1, scene: newState })
  },

  undo: () => {
    const { historyIndex, history } = get()
    if (historyIndex > 0) {
      const i = historyIndex - 1
      set({ historyIndex: i, scene: history[i] })
    }
  },

  redo: () => {
    const { historyIndex, history } = get()
    if (historyIndex < history.length - 1) {
      const i = historyIndex + 1
      set({ historyIndex: i, scene: history[i] })
    }
  },

  select: (id) => set((s) => ({ scene: { ...s.scene, selectedId: id } })),

  setSpinning: (v) => set({ isSpinning: v }),
  setShowCode: (v) => set({ showCode: v }),
  setAssetName: (v) => set({ assetName: v }),
  setAssets: (v) => set({ assets: v }),
  setSaving: (v) => set({ saving: v }),
  setActiveTab: (v) => set({ activeTab: v }),

  addShape: (type) => {
    const { scene, pushToHistory } = get()
    const id = `${type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`
    const newShape: ZdogStudioShape = {
      id,
      type,
      name: `New ${type}`,
      parentId: scene.selectedId || undefined,
      properties: {
        stroke: ['Box', 'Cylinder', 'Cone', 'Hemisphere'].includes(type) ? 0 : 4,
        color: '#636',
        fill: true,
        diameter: ['Ellipse', 'Cylinder', 'Cone', 'Hemisphere'].includes(type) ? 20 : undefined,
        width: ['Rect', 'RoundedRect', 'Box'].includes(type) ? 20 : undefined,
        height: ['Rect', 'RoundedRect', 'Box'].includes(type) ? 20 : undefined,
        depth: type === 'Box' ? 20 : undefined,
        length: ['Cylinder', 'Cone'].includes(type) ? 20 : undefined,
        sides: type === 'Polygon' ? 5 : undefined,
        radius: type === 'Polygon' ? 10 : undefined,
        cornerRadius: type === 'RoundedRect' ? 5 : undefined,
        path: type === 'Shape' ? [{ x: -5 }, { x: 5 }] : undefined,
      },
      transforms: { translate: {}, rotate: {}, scale: 1 },
    }
    pushToHistory({ ...scene, shapes: [...scene.shapes, newShape], selectedId: id })
  },

  updateShape: (id, updates) => {
    const { scene, pushToHistory } = get()
    pushToHistory({ ...scene, shapes: scene.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)) })
  },

  updateProperty: (id, prop, value) => {
    const { scene, pushToHistory } = get()
    pushToHistory({
      ...scene,
      shapes: scene.shapes.map((s) => (s.id === id ? { ...s, properties: { ...s.properties, [prop]: value } } : s)),
    })
  },

  updateTransform: (id, type, axis, value) => {
    const { scene, pushToHistory } = get()
    pushToHistory({
      ...scene,
      shapes: scene.shapes.map((s) => {
        if (s.id !== id) return s
        if (type === 'scale' && axis === null) return { ...s, transforms: { ...s.transforms, scale: value } }
        const current = s.transforms[type] as any
        return { ...s, transforms: { ...s.transforms, [type]: { ...current, [axis!]: value } } }
      }),
    })
  },

  deleteShape: (id) => {
    const { scene, pushToHistory } = get()
    const toDelete = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const s of scene.shapes) {
        if (s.parentId && toDelete.has(s.parentId) && !toDelete.has(s.id)) {
          toDelete.add(s.id)
          changed = true
        }
      }
    }
    pushToHistory({
      ...scene,
      shapes: scene.shapes.filter((s) => !toDelete.has(s.id)),
      selectedId: toDelete.has(scene.selectedId || '') ? null : scene.selectedId,
    })
  },

  loadShapes: (shapes) => {
    const { scene, pushToHistory } = get()
    pushToHistory({ ...scene, shapes, selectedId: shapes[0]?.id || null })
  },

  reset: () =>
    set({
      scene: INITIAL_STATE,
      history: [INITIAL_STATE],
      historyIndex: 0,
      isSpinning: true,
      showCode: false,
      assetName: '',
    }),
}))

'use client'

import type { Set, Get, UndoableState } from './types'
import {
  MAX_UNDO,
  _debouncedPushTimer,
  _hasPendingSnapshot,
  _inspectorSaveTimer,
  _inspectorUndoPushed,
  setDebouncedPushTimer,
  setHasPendingSnapshot,
  setInspectorSaveTimer,
  setInspectorUndoPushed,
} from './helpers'

// ── sessionStorage persistence for undo/redo stacks ─────────────────────────

const UNDO_STORAGE_KEY = 'cench-undo-stack'
const REDO_STORAGE_KEY = 'cench-redo-stack'

/** Strip code fields from scenes to keep sessionStorage size manageable. */
function stripCodeFields(stack: UndoableState[]): UndoableState[] {
  return stack.map((s) => ({
    ...s,
    scenes: s.scenes.map((sc) => ({
      ...sc,
      svgContent: '',
      canvasCode: '',
      canvasBackgroundCode: '',
      sceneCode: '',
      reactCode: '',
      sceneHTML: '',
      sceneStyles: '',
      lottieSource: '',
    })),
  }))
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null

function persistUndoStacks(undoStack: UndoableState[], redoStack: UndoableState[]) {
  if (_persistTimer) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(stripCodeFields(undoStack)))
      sessionStorage.setItem(REDO_STORAGE_KEY, JSON.stringify(stripCodeFields(redoStack)))
    } catch {
      // QuotaExceededError — trim oldest half and retry once
      try {
        const trimmed = undoStack.slice(Math.floor(undoStack.length / 2))
        sessionStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(stripCodeFields(trimmed)))
        sessionStorage.setItem(REDO_STORAGE_KEY, JSON.stringify(stripCodeFields(redoStack)))
      } catch {
        // Give up silently — memory-only undo is the fallback
      }
    }
  }, 500) // debounce writes
}

/** Restore undo/redo stacks from sessionStorage (called once during store init). */
export function restoreUndoStacks(): { undoStack: UndoableState[]; redoStack: UndoableState[] } {
  try {
    const undoRaw = sessionStorage.getItem(UNDO_STORAGE_KEY)
    const redoRaw = sessionStorage.getItem(REDO_STORAGE_KEY)
    return {
      undoStack: undoRaw ? JSON.parse(undoRaw) : [],
      redoStack: redoRaw ? JSON.parse(redoRaw) : [],
    }
  } catch {
    return { undoStack: [], redoStack: [] }
  }
}

// ── Undo/Redo actions ───────────────────────────────────────────────────────

export function createUndoActions(set: Set, get: Get) {
  return {
    _pushUndo: () => {
      const { scenes, globalStyle, project, _undoStack, isAgentRunning } = get()
      if (isAgentRunning) return // don't capture intermediate agent state
      // Sanitize d3Data (may contain non-cloneable values) before cloning
      const safeScenes = scenes.map((s) =>
        s.d3Data !== null && s.d3Data !== undefined ? { ...s, d3Data: JSON.parse(JSON.stringify(s.d3Data)) } : s,
      )
      const snapshot: UndoableState = structuredClone({ scenes: safeScenes, globalStyle, project })
      const newStack = [..._undoStack, snapshot]
      if (newStack.length > MAX_UNDO) newStack.shift()
      set({ _undoStack: newStack, _redoStack: [] })
      persistUndoStacks(newStack, [])
      // Suppress debounced pushes for the next second (prevents double-snapshot
      // when a discrete action calls _pushUndo then delegates to updateScene)
      setHasPendingSnapshot(true)
      if (_debouncedPushTimer) clearTimeout(_debouncedPushTimer)
      setDebouncedPushTimer(
        setTimeout(() => {
          setHasPendingSnapshot(false)
        }, 1000),
      )
    },

    _pushUndoDebounced: () => {
      if (!_hasPendingSnapshot) {
        get()._pushUndo()
        setHasPendingSnapshot(true)
      }
      if (_debouncedPushTimer) clearTimeout(_debouncedPushTimer)
      setDebouncedPushTimer(
        setTimeout(() => {
          setHasPendingSnapshot(false)
        }, 1000),
      )
    },

    undo: () => {
      const { _undoStack, _redoStack, scenes, globalStyle, project, isAgentRunning } = get()
      if (_undoStack.length === 0 || isAgentRunning) return
      setInspectorUndoPushed(false)
      if (_inspectorSaveTimer) {
        clearTimeout(_inspectorSaveTimer)
        setInspectorSaveTimer(null)
      }
      const current: UndoableState = structuredClone({ scenes, globalStyle, project })
      const newUndo = [..._undoStack]
      const prev = newUndo.pop()!
      const newRedo = [..._redoStack, current]
      set({
        scenes: prev.scenes,
        globalStyle: prev.globalStyle,
        project: prev.project,
        _undoStack: newUndo,
        _redoStack: newRedo,
        sceneHtmlVersion: get().sceneHtmlVersion + 1,
        inspectorSelectedElement: null,
        inspectorSelectedLayerId: null,
        inspectorElements: {},
        inspectorPendingChanges: {},
      })
      persistUndoStacks(newUndo, newRedo)
      // Fix selectedSceneId if it no longer exists
      const sel = get().selectedSceneId
      if (sel && !prev.scenes.find((s) => s.id === sel)) {
        set({ selectedSceneId: prev.scenes[0]?.id ?? null })
      }
      // Quiet-save the restored state
      const sceneId = get().selectedSceneId
      if (sceneId) get().saveSceneHTML(sceneId, true)
    },

    redo: () => {
      const { _undoStack, _redoStack, scenes, globalStyle, project, isAgentRunning } = get()
      if (_redoStack.length === 0 || isAgentRunning) return
      setInspectorUndoPushed(false)
      if (_inspectorSaveTimer) {
        clearTimeout(_inspectorSaveTimer)
        setInspectorSaveTimer(null)
      }
      const current: UndoableState = structuredClone({ scenes, globalStyle, project })
      const newRedo = [..._redoStack]
      const next = newRedo.pop()!
      const newUndo = [..._undoStack, current]
      set({
        scenes: next.scenes,
        globalStyle: next.globalStyle,
        project: next.project,
        _undoStack: newUndo,
        _redoStack: newRedo,
        sceneHtmlVersion: get().sceneHtmlVersion + 1,
        inspectorSelectedElement: null,
        inspectorSelectedLayerId: null,
        inspectorElements: {},
        inspectorPendingChanges: {},
      })
      persistUndoStacks(newUndo, newRedo)
      const sel = get().selectedSceneId
      if (sel && !next.scenes.find((s) => s.id === sel)) {
        set({ selectedSceneId: next.scenes[0]?.id ?? null })
      }
      // Quiet-save the restored state
      const sceneId = get().selectedSceneId
      if (sceneId) get().saveSceneHTML(sceneId, true)
    },
  }
}

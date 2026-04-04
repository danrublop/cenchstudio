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
      set({
        scenes: prev.scenes,
        globalStyle: prev.globalStyle,
        project: prev.project,
        _undoStack: newUndo,
        _redoStack: [..._redoStack, current],
        sceneHtmlVersion: get().sceneHtmlVersion + 1,
        inspectorSelectedElement: null,
        inspectorSelectedLayerId: null,
        inspectorElements: {},
        inspectorPendingChanges: {},
      })
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
      set({
        scenes: next.scenes,
        globalStyle: next.globalStyle,
        project: next.project,
        _undoStack: [..._undoStack, current],
        _redoStack: newRedo,
        sceneHtmlVersion: get().sceneHtmlVersion + 1,
        inspectorSelectedElement: null,
        inspectorSelectedLayerId: null,
        inspectorElements: {},
        inspectorPendingChanges: {},
      })
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

'use client'

import { useReducer, useRef, useCallback, useEffect } from 'react'
import { buildReducer, initialBuildState } from './reducer'
import type { BuildSSEEvent, BuildAction } from './types'

const MAX_RETRY_DELAY = 30_000
const BASE_RETRY_DELAY = 1_000
const MAX_RETRIES = 5

export function useBuildStream(projectId: string) {
  const [state, dispatch] = useReducer(buildReducer, initialBuildState)
  const abortRef = useRef<AbortController | null>(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const collapseTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const stoppedRef = useRef(false)

  const scheduleAutoCollapse = useCallback((sceneId: string) => {
    // Clear any existing timer for this scene
    const existing = collapseTimersRef.current.get(sceneId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      dispatch({ type: 'AUTO_COLLAPSE', sceneId })
      collapseTimersRef.current.delete(sceneId)
    }, 1500)
    collapseTimersRef.current.set(sceneId, timer)
  }, [])

  const processEvent = useCallback(
    (event: BuildSSEEvent) => {
      switch (event.type) {
        case 'build_start':
          dispatch({ type: 'BUILD_START', scenes: event.scenes })
          break
        case 'scene_start':
          dispatch({ type: 'SCENE_START', sceneId: event.sceneId })
          break
        case 'agent_step':
          dispatch({
            type: 'AGENT_STEP',
            sceneId: event.sceneId,
            agentName: event.agentName,
            status: event.status,
            detail: event.detail,
          })
          break
        case 'template_selected':
          dispatch({
            type: 'TEMPLATE_SELECTED',
            sceneId: event.sceneId,
            templateId: event.templateId,
            templateUrl: event.templateUrl,
          })
          break
        case 'frame_start':
          dispatch({
            type: 'FRAME_START',
            sceneId: event.sceneId,
            frameIndex: event.frameIndex,
            prompt: event.prompt,
          })
          break
        case 'frame_done':
          dispatch({
            type: 'FRAME_DONE',
            sceneId: event.sceneId,
            frameIndex: event.frameIndex,
            thumbnailUrl: event.thumbnailUrl,
            outputUrl: event.outputUrl,
            durationMs: event.durationMs,
          })
          break
        case 'animation_start':
          dispatch({ type: 'ANIMATION_START', sceneId: event.sceneId })
          break
        case 'animation_done':
          dispatch({ type: 'ANIMATION_DONE', sceneId: event.sceneId })
          break
        case 'scene_done':
          dispatch({ type: 'SCENE_DONE', sceneId: event.sceneId, durationMs: event.durationMs })
          scheduleAutoCollapse(event.sceneId)
          break
        case 'build_done':
          dispatch({ type: 'BUILD_DONE' })
          break
        case 'build_error':
          dispatch({ type: 'BUILD_ERROR', sceneId: event.sceneId, error: event.error })
          break
      }
    },
    [scheduleAutoCollapse],
  )

  const connectStream = useCallback(async () => {
    if (stoppedRef.current) return
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Build error: ${response.statusText}`)
      }

      // Connection succeeded — reset retry state
      dispatch({ type: 'SET_RECONNECTING', isReconnecting: false })
      retryCountRef.current = 0

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          try {
            processEvent(JSON.parse(jsonStr) as BuildSSEEvent)
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // Flush remaining buffer
      const remaining = buffer.trim()
      if (remaining.startsWith('data: ')) {
        const jsonStr = remaining.slice(6).trim()
        if (jsonStr) {
          try {
            processEvent(JSON.parse(jsonStr) as BuildSSEEvent)
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      const retryCount = retryCountRef.current
      if (retryCount < MAX_RETRIES) {
        dispatch({ type: 'SET_RECONNECTING', isReconnecting: true })
        const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY)
        retryCountRef.current = retryCount + 1
        retryTimeoutRef.current = setTimeout(() => {
          connectStream()
        }, delay)
      } else {
        dispatch({
          type: 'BUILD_ERROR',
          error: `Connection lost after ${MAX_RETRIES} retries: ${(err as Error).message}`,
        })
      }
    }
  }, [projectId, processEvent])

  const stop = useCallback(() => {
    stoppedRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    // Clear all collapse timers
    for (const timer of collapseTimersRef.current.values()) {
      clearTimeout(timer)
    }
    collapseTimersRef.current.clear()
  }, [])

  const start = useCallback(() => {
    stop()
    stoppedRef.current = false
    dispatch({ type: 'RESET' })
    connectStream()
  }, [stop, connectStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      for (const timer of collapseTimersRef.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  return { state, dispatch, start, stop }
}

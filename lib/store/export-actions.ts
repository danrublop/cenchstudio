'use client'

import type { ExportSettings, ExportProgress } from '../types'
import { generateSceneHTML } from '../sceneTemplate'
import { resolveProjectDimensions } from '../dimensions'
import { mergeProjectCaptions, type SceneCaptionInput } from '../audio/captions'
import type { Set, Get } from './types'

export function createExportActions(set: Set, get: Get) {
  return {
    openExportModal: () => set({ isExportModalOpen: true }),
    closeExportModal: () => set({ isExportModalOpen: false, exportProgress: null }),

    exportVideo: async (settings: ExportSettings) => {
      const { scenes } = get()

      // Path 2 (Electron): WebCodecs + Pixi exporter (single scene v1).
      // This runs only in Electron where preload exposes window.electronAPI.
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const diagnostics: string[] = []
        const pushDiag = (msg: string) => {
          diagnostics.push(msg)
          if (diagnostics.length > 60) diagnostics.shift()
          const p = get().exportProgress
          if (!p) return
          set({
            exportProgress: {
              ...p,
              diagnostics: [...diagnostics],
            },
          })
        }

        set({
          isExporting: true,
          exportProgress: {
            phase: 'rendering',
            currentScene: 1,
            totalScenes: scenes.length,
            sceneProgress: 0,
            downloadUrl: null,
            error: null,
            diagnostics: [],
          },
        })

        try {
          if (scenes.length === 0) throw new Error('No scenes to export')

          let filePath: string
          if (settings.outputPath) {
            // Headless mode: skip save dialog
            filePath = settings.outputPath
          } else {
            const suggested = `${settings.outputName || 'export'}.mp4`
            const pick = await (window as any).electronAPI.saveDialog(suggested)
            if (pick.canceled || !pick.filePath) {
              set({ exportProgress: null })
              return
            }
            filePath = pick.filePath
          }
          pushDiag(`save: ${filePath}`)

          const { exportSolidSceneMp4 } = await import('../export2/pixi-mp4')
          const { resolution, fps } = settings
          const dims = resolveProjectDimensions(get().project.mp4Settings?.aspectRatio, resolution)

          const partPaths: string[] = []
          for (let idx = 0; idx < scenes.length; idx++) {
            const scene = scenes[idx]
            const partPath = `${filePath}.scene-${String(idx + 1).padStart(3, '0')}.mp4`
            partPaths.push(partPath)
            pushDiag(`render: scene ${idx + 1}/${scenes.length}`)

            // Fetch full scene from DB — in-memory fields may be empty
            // (localStorage partialize strips svgContent, sceneCode, etc.)
            let fullScene = scene
            try {
              const fullRes = await fetch(`/api/scene?projectId=${get().project.id}&sceneId=${scene.id}`)
              if (fullRes.ok) {
                const fullData = await fullRes.json()
                if (fullData.scene) fullScene = { ...scene, ...fullData.scene }
              }
            } catch {}
            const freshHTML = generateSceneHTML(
              fullScene,
              get().globalStyle,
              undefined,
              get().audioSettings,
              resolveProjectDimensions(get().project.mp4Settings?.aspectRatio, get().project.mp4Settings?.resolution),
            )

            const bytes = await exportSolidSceneMp4({
              sceneId: fullScene.id,
              width: dims.width,
              height: dims.height,
              fps,
              durationSeconds: fullScene.duration,
              sceneType: fullScene.sceneType,
              svgContent: fullScene.svgContent,
              sceneHTML: freshHTML,
              bgColor: scene.bgColor || '#000000',
              videoSrc: scene.videoLayer?.enabled ? scene.videoLayer.src : null,
              videoOpacity: scene.videoLayer?.opacity ?? 1,
              trimStart: scene.videoLayer?.trimStart ?? 0,
              trimEnd: scene.videoLayer?.trimEnd ?? null,
              textOverlays: scene.textOverlays as any,
              svgObjects: scene.svgObjects as any,
              aiLayers: scene.aiLayers as any,
              layerHiddenIds: scene.layerHiddenIds ?? [],
              layerPanelOrder: scene.layerPanelOrder ?? [],
              cameraMotion: scene.cameraMotion as any,
              audioSrc: scene.audioLayer?.enabled ? scene.audioLayer.src : null,
              audioStartOffset: scene.audioLayer?.startOffset ?? 0,
              audioVolume: scene.audioLayer?.volume ?? 1,
              audioFadeIn: scene.audioLayer?.fadeIn ?? false,
              audioFadeOut: scene.audioLayer?.fadeOut ?? false,
              audioLayer: scene.audioLayer as any,
              profile: settings.profile ?? 'quality',
              onProgress: (ratio) => {
                set({
                  exportProgress: {
                    phase: 'rendering',
                    currentScene: idx + 1,
                    totalScenes: scenes.length,
                    sceneProgress: Math.max(0, Math.min(100, Math.round(ratio * 100))),
                    downloadUrl: null,
                    error: null,
                    diagnostics: [...diagnostics],
                  },
                })
              },
              onLog: (message) => pushDiag(`s${idx + 1}: ${message}`),
            })

            await (window as any).electronAPI.writeFile({ filePath: partPath, bytes })
            pushDiag(`render: scene ${idx + 1} written`)
          }

          set({
            exportProgress: {
              phase: 'stitching', // reuse UI phase slot for "writing file"
              currentScene: scenes.length,
              totalScenes: scenes.length,
              sceneProgress: 100,
              downloadUrl: null,
              error: null,
              diagnostics: [...diagnostics],
            },
          })

          pushDiag(`concat: ${partPaths.length} scene files`)
          const transitions = scenes.slice(0, -1).map((s) => ({ type: s.transition, duration: 0.5 }))
          transitions.forEach((tr, i) => {
            pushDiag(`transition ${i + 1}: ${tr.type} (${tr.duration}s)`)
          })
          await (window as any).electronAPI.concatMp4({
            inputs: partPaths,
            output: filePath,
            transitions,
            cleanup: true,
          })
          pushDiag('concat: done')

          // Caption sidecar: stitch per-scene word timings into a project-
          // level SRT + VTT and drop them next to the MP4. Skipped when
          // the project is on an NLE timeline (scene-order duration
          // accumulation would misalign tracks).
          try {
            if (!get().project?.timeline) {
              let cursor = 0
              const inputs: SceneCaptionInput[] = []
              for (const s of scenes) {
                const words = s.audioLayer?.tts?.captions?.words
                if (words && words.length > 0) inputs.push({ startSeconds: cursor, words })
                cursor += s.duration
              }
              if (inputs.length > 0) {
                const bundle = mergeProjectCaptions(inputs)
                if (bundle.cues.length > 0) {
                  const base = filePath.replace(/\.mp4$/i, '')
                  const encoder = new TextEncoder()
                  await (window as any).electronAPI.writeFile({
                    filePath: `${base}.srt`,
                    bytes: encoder.encode(bundle.srt),
                  })
                  await (window as any).electronAPI.writeFile({
                    filePath: `${base}.vtt`,
                    bytes: encoder.encode(bundle.vtt),
                  })
                  pushDiag(`captions: wrote ${bundle.cues.length} cues (.srt + .vtt)`)
                }
              }
            }
          } catch (capErr) {
            pushDiag(`captions: skipped (${String(capErr)})`)
          }

          set({
            exportProgress: {
              phase: 'complete',
              currentScene: scenes.length,
              totalScenes: scenes.length,
              sceneProgress: 100,
              // Keep downloadUrl null (Electron save path is already chosen)
              downloadUrl: null,
              error: null,
              diagnostics: [...diagnostics],
            },
          })
        } catch (err) {
          set({
            exportProgress: {
              phase: 'error',
              currentScene: 0,
              totalScenes: scenes.length,
              sceneProgress: 0,
              downloadUrl: null,
              error: String(err),
              diagnostics: [...diagnostics],
            },
          })
        } finally {
          set({ isExporting: false })
        }
        return
      }

      set({
        isExporting: true,
        exportProgress: {
          phase: 'rendering',
          currentScene: 0,
          totalScenes: scenes.length,
          sceneProgress: 0,
          downloadUrl: null,
          error: null,
        },
      })

      const controller = new AbortController()
      let activityTimeout: ReturnType<typeof setTimeout>

      const resetTimeout = () => {
        clearTimeout(activityTimeout)
        activityTimeout = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 min no-activity
      }
      resetTimeout()

      try {
        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            scenes: scenes.map((s) => ({
              id: s.id,
              duration: s.duration,
              transition: s.transition,
              sceneType: s.sceneType,
              audioLayer: s.audioLayer,
              ...(s.sceneType === '3d_world' && s.worldConfig ? { worldConfig: s.worldConfig } : {}),
            })),
            outputName: settings.outputName || `cench-studio-${Date.now()}`,
            settings,
          }),
        })

        if (!response.ok) throw new Error('Export request failed')

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          resetTimeout()
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              const { type } = data
              if (type === 'scene_progress') {
                set({
                  exportProgress: {
                    phase: 'rendering',
                    currentScene: data.scene,
                    totalScenes: scenes.length,
                    sceneProgress: data.progress,
                    downloadUrl: null,
                    error: null,
                  },
                })
              } else if (type === 'scene_done') {
                set((state) => ({
                  exportProgress: state.exportProgress
                    ? { ...state.exportProgress, currentScene: data.scene, sceneProgress: 100 }
                    : null,
                }))
              } else if (type === 'mixing_audio') {
                set({
                  exportProgress: {
                    phase: 'mixing_audio',
                    currentScene: scenes.length,
                    totalScenes: scenes.length,
                    sceneProgress: 100,
                    downloadUrl: null,
                    error: null,
                  },
                })
              } else if (type === 'stitching') {
                set({
                  exportProgress: {
                    phase: 'stitching',
                    currentScene: scenes.length,
                    totalScenes: scenes.length,
                    sceneProgress: 100,
                    downloadUrl: null,
                    error: null,
                  },
                })
              } else if (type === 'complete') {
                set({
                  exportProgress: {
                    phase: 'complete',
                    currentScene: scenes.length,
                    totalScenes: scenes.length,
                    sceneProgress: 100,
                    downloadUrl: data.downloadUrl,
                    error: null,
                  },
                })
              } else if (type === 'error') {
                set({
                  exportProgress: {
                    phase: 'error',
                    currentScene: 0,
                    totalScenes: scenes.length,
                    sceneProgress: 0,
                    downloadUrl: null,
                    error: data.message,
                  },
                })
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }

        // Stream ended — check if we got a terminal event
        const currentProgress = get().exportProgress
        if (currentProgress && currentProgress.phase !== 'complete' && currentProgress.phase !== 'error') {
          set({
            exportProgress: {
              ...currentProgress,
              phase: 'error',
              error: 'Export connection lost unexpectedly. Check that the render server is running.',
            },
          })
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? 'Export timed out — no progress received for 10 minutes.'
            : String(err)
        set({
          exportProgress: {
            phase: 'error',
            currentScene: 0,
            totalScenes: scenes.length,
            sceneProgress: 0,
            downloadUrl: null,
            error: message,
          },
        })
      } finally {
        clearTimeout(activityTimeout!)
        set({ isExporting: false })
      }
    },

    setExportProgress: (progress: ExportProgress | null) => set({ exportProgress: progress }),
  }
}

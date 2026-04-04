'use client'

import { v4 as uuidv4 } from 'uuid'
import type { Scene, SceneUsage, SvgObject, SvgBranch, AILayer, AvatarLayer } from '../types'
import { generateSceneHTML } from '../sceneTemplate'
import { mergeAvatarLayerUpdates } from '../avatar-layer-sync'
import { compileD3SceneFromLayers } from '../charts/compile'
import type { Set, Get } from './types'
import { getResolvedStyle } from './helpers'

export function createGenerationActions(set: Set, get: Get) {
  return {
    generateSVG: async (sceneId: string, onToken?: (svg: string) => void) => {
      const { scenes, globalStyle } = get()
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.prompt.trim()) return

      const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
      const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

      set({ isGenerating: true, generatingSceneId: sceneId })
      get().updateScene(sceneId, { svgContent: '' })

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.prompt,
            palette: getResolvedStyle(globalStyle).palette,
            font: getResolvedStyle(globalStyle).font,
            duration: scene.duration || 8,
            previousSummary,
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'Generation failed')
        }

        const data = await response.json()
        const cleanedSvg: string = data.result ?? ''
        const usage: SceneUsage | null = data.usage ?? null

        const rootBranch: SvgBranch = {
          id: uuidv4(),
          parentId: null,
          label: 'Original',
          svgContent: cleanedSvg,
          usage,
        }

        const currentScene = get().scenes.find((s) => s.id === sceneId)!
        const existingPrimary = (currentScene.svgObjects ?? []).find((o) => o.id === currentScene.primaryObjectId)
        const primaryId = existingPrimary?.id ?? uuidv4()
        const primaryObj: SvgObject = {
          id: primaryId,
          prompt: currentScene.prompt,
          svgContent: cleanedSvg,
          x: existingPrimary?.x ?? 0,
          y: existingPrimary?.y ?? 0,
          width: existingPrimary?.width ?? 100,
          opacity: existingPrimary?.opacity ?? 1,
          zIndex: 2,
        }
        const updatedObjects = existingPrimary
          ? (currentScene.svgObjects ?? []).map((o) => (o.id === primaryId ? primaryObj : o))
          : [primaryObj, ...(currentScene.svgObjects ?? [])]

        get().updateScene(sceneId, {
          svgContent: cleanedSvg,
          usage,
          svgBranches: [rootBranch],
          activeBranchId: rootBranch.id,
          svgObjects: updatedObjects,
          primaryObjectId: primaryId,
        })

        await get().saveSceneHTML(sceneId)

        try {
          const summaryRes = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              summarize: true,
              svgContent: cleanedSvg,
            }),
          })
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json()
            get().updateScene(sceneId, { summary: (summaryData.result ?? '').trim().slice(0, 200) })
          }
        } catch {
          // Summary is optional
        }
      } catch (err) {
        console.error('Generation error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    generateCanvas: async (sceneId: string, onToken?: (code: string) => void) => {
      const { scenes, globalStyle } = get()
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.prompt.trim()) return

      const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
      const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

      set({ isGenerating: true, generatingSceneId: sceneId })
      get().updateScene(sceneId, { canvasCode: '' })

      try {
        const response = await fetch('/api/generate-canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.prompt,
            palette: getResolvedStyle(globalStyle).palette,
            bgColor: scene.bgColor,
            duration: scene.duration || 8,
            previousSummary,
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'Canvas generation failed')
        }

        const data = await response.json()
        const cleanedCode: string = data.result ?? ''
        const usage: SceneUsage | null = data.usage ?? null

        get().updateScene(sceneId, { canvasCode: cleanedCode, usage })
        await get().saveSceneHTML(sceneId)

        try {
          const summaryRes = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.prompt,
              summarize: true,
              svgContent: cleanedCode.slice(0, 2000),
            }),
          })
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json()
            get().updateScene(sceneId, { summary: (summaryData.result ?? '').trim().slice(0, 200) })
          }
        } catch {
          // Summary is optional
        }
      } catch (err) {
        console.error('Canvas generation error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    generateMotion: async (sceneId: string) => {
      const { scenes, globalStyle } = get()
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.prompt.trim()) return

      const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
      const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

      set({ isGenerating: true, generatingSceneId: sceneId })
      get().updateScene(sceneId, { sceneCode: '', sceneHTML: '', sceneStyles: '' })

      try {
        const response = await fetch('/api/generate-motion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.prompt,
            palette: getResolvedStyle(globalStyle).palette,
            font: getResolvedStyle(globalStyle).font,
            bgColor: scene.bgColor,
            duration: scene.duration || 8,
            previousSummary,
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'Motion generation failed')
        }

        const data = await response.json()
        const { result } = data
        get().updateScene(sceneId, {
          sceneCode: result.sceneCode ?? '',
          sceneHTML: result.htmlContent ?? '',
          sceneStyles: result.styles ?? '',
          usage: data.usage ?? null,
        })
        await get().saveSceneHTML(sceneId)
      } catch (err) {
        console.error('Motion generation error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    generateD3: async (sceneId: string) => {
      const { scenes, globalStyle } = get()
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.prompt.trim()) return

      const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
      const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

      set({ isGenerating: true, generatingSceneId: sceneId })
      get().updateScene(sceneId, { sceneCode: '', sceneStyles: '' })

      try {
        const response = await fetch('/api/generate-d3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.prompt,
            palette: getResolvedStyle(globalStyle).palette,
            font: getResolvedStyle(globalStyle).font,
            bgColor: scene.bgColor,
            duration: scene.duration || 8,
            d3Data: scene.d3Data,
            previousSummary,
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'D3 generation failed')
        }

        const data = await response.json()
        const { result } = data
        const nextLayers = Array.isArray(result.chartLayers) ? result.chartLayers : []
        get().updateScene(sceneId, {
          sceneType: 'd3',
          sceneCode: result.sceneCode ?? '',
          sceneStyles: result.styles ?? '',
          d3Data: result.d3Data ?? result.suggestedData ?? null,
          chartLayers: nextLayers,
          usage: data.usage ?? null,
        })
        await get().saveSceneHTML(sceneId)
      } catch (err) {
        console.error('D3 generation error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    generateThree: async (sceneId: string) => {
      const { scenes, globalStyle } = get()
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.prompt.trim()) return

      const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
      const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

      set({ isGenerating: true, generatingSceneId: sceneId })
      get().updateScene(sceneId, { sceneCode: '' })

      try {
        const response = await fetch('/api/generate-three', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.prompt,
            palette: getResolvedStyle(globalStyle).palette,
            bgColor: scene.bgColor,
            duration: scene.duration || 8,
            previousSummary,
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'Three.js generation failed')
        }

        const data = await response.json()
        const { result } = data
        get().updateScene(sceneId, {
          sceneCode: result.sceneCode ?? '',
          usage: data.usage ?? null,
        })
        await get().saveSceneHTML(sceneId)
      } catch (err) {
        console.error('Three.js generation error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    generateLottie: async (sceneId: string, onToken?: (svg: string) => void) => {
      const { scenes, globalStyle } = get()
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.prompt.trim()) return

      const sceneIndex = scenes.findIndex((s) => s.id === sceneId)
      const previousSummary = sceneIndex > 0 ? scenes[sceneIndex - 1].summary : ''

      set({ isGenerating: true, generatingSceneId: sceneId })
      get().updateScene(sceneId, { svgContent: '' })

      try {
        const response = await fetch('/api/generate-lottie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.prompt,
            palette: getResolvedStyle(globalStyle).palette,
            font: getResolvedStyle(globalStyle).font,
            duration: scene.duration || 8,
            previousSummary,
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'Lottie overlay generation failed')
        }

        const data = await response.json()
        const cleanedSvg: string = data.result ?? ''
        const usage: SceneUsage | null = data.usage ?? null

        get().updateScene(sceneId, { svgContent: cleanedSvg, usage })
        await get().saveSceneHTML(sceneId)
      } catch (err) {
        console.error('Lottie overlay generation error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    editSVG: async (sceneId: string, instruction: string, onToken?: (svg: string) => void) => {
      const { scenes } = get()
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.svgContent || !instruction.trim()) return

      set({ isGenerating: true, generatingSceneId: sceneId })

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            edit: true,
            svgContent: scene.svgContent,
            editInstruction: instruction,
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'Edit failed')
        }

        const data = await response.json()
        const cleanedSvg: string = data.result ?? ''
        const usage: SceneUsage | null = data.usage ?? null

        const preSyncScene = get().scenes.find((s) => s.id === sceneId)!
        if (preSyncScene.primaryObjectId) {
          get().updateSvgObject(sceneId, preSyncScene.primaryObjectId, { svgContent: cleanedSvg })
        }

        const currentScene = get().scenes.find((s) => s.id === sceneId)!
        const newBranch: SvgBranch = {
          id: uuidv4(),
          parentId: currentScene.activeBranchId,
          label: instruction.trim().slice(0, 40),
          svgContent: cleanedSvg,
          usage,
        }
        get().updateScene(sceneId, {
          svgContent: cleanedSvg,
          usage,
          svgBranches: [...currentScene.svgBranches, newBranch],
          activeBranchId: newBranch.id,
        })

        await get().saveSceneHTML(sceneId)
      } catch (err) {
        console.error('Edit error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    enhancePrompt: async (sceneId: string) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene || !scene.prompt.trim()) return

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.prompt,
            enhance: true,
          }),
        })
        if (!response.ok) return
        const data = await response.json()
        get().updateScene(sceneId, { prompt: (data.result ?? '').trim() })
      } catch (err) {
        console.error('Enhance error:', err)
      }
    },

    saveSceneHTML: async (sceneId: string, quiet = false) => {
      let scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) {
        console.error('[saveSceneHTML] scene not found:', sceneId)
        return
      }
      if (scene.sceneType === 'd3' && (scene.chartLayers?.length ?? 0) > 0) {
        const compiled = compileD3SceneFromLayers(scene.chartLayers ?? [])
        if (
          compiled.sceneCode !== scene.sceneCode ||
          JSON.stringify(compiled.d3Data) !== JSON.stringify(scene.d3Data)
        ) {
          get().updateScene(sceneId, { sceneCode: compiled.sceneCode, d3Data: compiled.d3Data as any })
          scene = get().scenes.find((s) => s.id === sceneId) ?? scene
        }
      }
      // Resolve watermark if configured
      const wm = get().project.watermark
      let watermarkWithUrl = null as any
      if (wm) {
        const asset = get().projectAssets.find((a) => a.id === wm.assetId)
        if (asset) {
          watermarkWithUrl = { ...wm, publicUrl: asset.publicUrl }
        }
      }
      const html = generateSceneHTML(scene, get().globalStyle, watermarkWithUrl, get().audioSettings)
      try {
        const res = await fetch('/api/scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sceneId, html }),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          console.error('[saveSceneHTML] API error', res.status, body)
          return
        }
        console.log('[saveSceneHTML] saved', sceneId, `(${html.length} chars)`)
        if (!quiet) {
          set({ sceneHtmlVersion: get().sceneHtmlVersion + 1 })
        }
      } catch (err) {
        console.error('[saveSceneHTML] network error:', err)
      }
    },

    generateSvgObject: async (sceneId: string, objectId: string, prompt: string, onToken?: (svg: string) => void) => {
      const { globalStyle } = get()
      if (!prompt.trim()) return

      set({ isGenerating: true, generatingSceneId: sceneId })

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            palette: getResolvedStyle(globalStyle).palette,
            strokeWidth: globalStyle.strokeWidth ?? 2,
            font: getResolvedStyle(globalStyle).font,
            duration: 8,
            previousSummary: '',
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err || 'Generation failed')
        }

        const data = await response.json()
        const cleanedSvg: string = data.result ?? ''
        get().updateSvgObject(sceneId, objectId, { svgContent: cleanedSvg, prompt })

        await get().saveSceneHTML(sceneId)
      } catch (err) {
        console.error('SVG object generation error:', err)
      } finally {
        set({ isGenerating: false, generatingSceneId: null })
      }
    },

    generateAIImage: async (
      sceneId: string,
      opts: {
        prompt: string
        model?: string
        style?: string | null
        aspectRatio?: string
        removeBackground?: boolean
        x?: number
        y?: number
        width?: number
        height?: number
        label?: string
      },
    ) => {
      const { project } = get()
      const layerId = uuidv4()

      // Add pending layer
      const isSticker = opts.removeBackground ?? false
      const layer: AILayer = isSticker
        ? {
            id: layerId,
            type: 'sticker' as const,
            prompt: opts.prompt,
            model: (opts.model ?? 'recraft-v3') as any,
            style: (opts.style ?? 'illustration') as any,
            imageUrl: null,
            stickerUrl: null,
            x: opts.x ?? 960,
            y: opts.y ?? 540,
            width: opts.width ?? 200,
            height: opts.height ?? 200,
            rotation: 0,
            opacity: 1,
            zIndex: 10,
            status: 'generating',
            animateIn: true,
            startAt: 0,
            label: opts.label ?? 'AI Sticker',
          }
        : {
            id: layerId,
            type: 'image' as const,
            prompt: opts.prompt,
            model: (opts.model ?? 'flux-schnell') as any,
            style: (opts.style ?? null) as any,
            imageUrl: null,
            x: opts.x ?? 960,
            y: opts.y ?? 540,
            width: opts.width ?? 400,
            height: opts.height ?? 400,
            rotation: 0,
            opacity: 1,
            zIndex: 5,
            status: 'generating',
            label: opts.label ?? 'AI Image',
          }

      get().addAILayer(sceneId, layer)

      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            sceneId,
            prompt: opts.prompt,
            model: opts.model ?? (isSticker ? 'recraft-v3' : 'flux-schnell'),
            style: opts.style,
            aspectRatio: opts.aspectRatio ?? '1:1',
            removeBackground: isSticker,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        if (isSticker) {
          get().updateAILayer(sceneId, layerId, {
            status: 'ready',
            imageUrl: data.imageUrl,
            stickerUrl: data.stickerUrl,
          } as Partial<AILayer>)
        } else {
          get().updateAILayer(sceneId, layerId, {
            status: 'ready',
            imageUrl: data.imageUrl,
          } as Partial<AILayer>)
        }

        // Regenerate scene HTML
        await get().saveSceneHTML(sceneId)
      } catch (err: any) {
        console.error('AI image generation failed:', err)
        get().updateAILayer(sceneId, layerId, { status: 'error' } as Partial<AILayer>)
      }
    },

    pollAvatarStatus: (sceneId: string, layerId: string, videoId: string) => {
      const poll = async () => {
        try {
          const res = await fetch(`/api/generate-avatar?videoId=${encodeURIComponent(videoId)}`)
          const data = await res.json()

          if (data.status === 'completed') {
            get().updateAILayer(sceneId, layerId, {
              status: 'ready',
              videoUrl: data.videoUrl,
              thumbnailUrl: data.thumbnailUrl,
            } as Partial<AILayer>)
            await get().saveSceneHTML(sceneId)
            return // stop polling
          }

          if (data.status === 'failed') {
            get().updateAILayer(sceneId, layerId, { status: 'error' } as Partial<AILayer>)
            return
          }

          // Still processing — poll again in 15s
          setTimeout(poll, 15000)
        } catch {
          setTimeout(poll, 15000)
        }
      }
      setTimeout(poll, 5000)
    },

    pollVeo3Status: (sceneId: string, layerId: string, operationName: string, projectId?: string, prompt?: string) => {
      const poll = async () => {
        try {
          const params = new URLSearchParams({ operationName })
          if (projectId) params.set('projectId', projectId)
          if (prompt) params.set('prompt', prompt)
          const res = await fetch(`/api/generate-video?${params}`)
          const data = await res.json()

          if (data.done && data.videoUrl) {
            get().updateAILayer(sceneId, layerId, {
              status: 'ready',
              videoUrl: data.videoUrl,
            } as Partial<AILayer>)
            await get().saveSceneHTML(sceneId)
            return
          }

          if (data.done && data.error) {
            get().updateAILayer(sceneId, layerId, { status: 'error' } as Partial<AILayer>)
            return
          }

          setTimeout(poll, 15000)
        } catch {
          setTimeout(poll, 15000)
        }
      }
      setTimeout(poll, 5000)
    },

    // ── AI Layer actions ──────────────────────────────────────────────────────
    addAILayer: (sceneId: string, layer: AILayer) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        aiLayers: [...(scene.aiLayers ?? []), layer],
      })
    },

    updateAILayer: (sceneId: string, layerId: string, updates: Partial<AILayer>) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      const prev = (scene.aiLayers ?? []).find((l) => l.id === layerId)
      const patch =
        prev?.type === 'avatar'
          ? mergeAvatarLayerUpdates(prev as AvatarLayer, updates as Partial<AvatarLayer>)
          : updates
      get().updateScene(sceneId, {
        aiLayers: (scene.aiLayers ?? []).map((l) => (l.id === layerId ? ({ ...l, ...patch } as AILayer) : l)),
      })
    },

    removeAILayer: (sceneId: string, layerId: string) => {
      get()._pushUndo()
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      get().updateScene(sceneId, {
        aiLayers: (scene.aiLayers ?? []).filter((l) => l.id !== layerId),
      })
    },

    // Frame capturer for agent visual feedback
    registerFrameCapturer: (capturer: ((sceneId: string, time: number) => Promise<string | null>) | null) => {
      ;(globalThis as any).__cenchFrameCapturer = capturer
    },
    captureSceneFrame: async (sceneId: string, time: number) => {
      const capturer = (globalThis as any).__cenchFrameCapturer as
        | ((sceneId: string, time: number) => Promise<string | null>)
        | null
      if (!capturer) return null
      return capturer(sceneId, time)
    },
  }
}

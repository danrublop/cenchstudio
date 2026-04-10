'use client'

import type { Scene, GlobalStyle, Project, SceneGraph } from '../types'
import { DEFAULT_AUDIO_SETTINGS } from '../types'
import { DEFAULT_AUDIO_PROVIDER_ENABLED } from '../audio/provider-registry'
import { DEFAULT_MEDIA_PROVIDER_ENABLED } from '../media/provider-registry'
import { createDefaultAPIPermissions } from '../permissions'
import type { Set, Get } from './types'
import {
  createDefaultProject,
  DEFAULT_GLOBAL_STYLE,
  normalizeScene,
  sceneHasRenderableContent,
  ensureStoryboardSceneIdsForPair,
} from './helpers'

export function createProjectActions(set: Set, get: Get) {
  return {
    setOutputMode: (mode: 'mp4' | 'interactive') => {
      set((state) => ({
        project: { ...state.project, outputMode: mode, updatedAt: new Date().toISOString() },
        _isDirty: true,
      }))
    },

    updateProject: (updates: Partial<Project>) => {
      set((state) => ({
        project: { ...state.project, ...updates, updatedAt: new Date().toISOString() },
        _isDirty: true,
      }))
    },

    updateSceneGraph: (graph: SceneGraph) => {
      set((state) => ({
        project: { ...state.project, sceneGraph: graph, updatedAt: new Date().toISOString() },
        _isDirty: true,
      }))
    },

    publishProject: async () => {
      const { project, scenes } = get()
      set({ isPublishing: true, publishError: null })
      try {
        // Ensure all scene HTML files exist on disk before publishing
        await Promise.all(scenes.map((s) => get().saveSceneHTML(s.id, true)))

        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            project: {
              id: project.id,
              name: project.name,
              interactiveSettings: project.interactiveSettings,
              sceneGraph: project.sceneGraph,
            },
            scenes: scenes.map((s) => ({
              id: s.id,
              sceneType: s.sceneType,
              duration: s.duration,
              interactions: s.interactions,
              variables: s.variables,
              transition: s.transition,
            })),
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Publish failed' }))
          throw new Error(data.error || 'Publish failed')
        }
        const data = await res.json()
        set({ publishedUrl: data.publishedUrl, showPublishPanel: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Publish failed'
        console.error('Publish error:', message)
        set({ publishError: message })
      } finally {
        set({ isPublishing: false })
      }
    },

    setShowPublishPanel: (show: boolean) => set({ showPublishPanel: show }),

    // ── Project management ──────────────────────────────────────────────
    fetchProjectList: async () => {
      set({ isLoadingProjects: true })
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const list = await res.json()
          set({ projectList: list.map((p: any) => ({
            id: p.id, name: p.name, updatedAt: p.updatedAt,
            thumbnailUrl: p.thumbnailUrl, outputMode: p.outputMode,
            createdAt: p.createdAt,
          })) })
        }
      } catch (e) {
        console.error('Failed to fetch projects:', e)
      } finally {
        set({ isLoadingProjects: false })
      }
    },

    createNewProject: async (name?: string) => {
      const state = get()
      // Don't save current project — auto-save handles it.
      // Saving here overwrites externally-added scenes.

      const newProject = createDefaultProject([])

      // Auto-increment "Untitled Project" names
      if (!name) {
        const existing = state.projectList.map((p) => p.name)
        let n = 1
        let candidate = 'Untitled Project'
        while (existing.includes(candidate)) {
          n++
          candidate = `Untitled Project ${n}`
        }
        newProject.name = candidate
      } else {
        newProject.name = name
      }
      set({
        project: newProject,
        scenes: [],
        selectedSceneId: null,
        globalStyle: DEFAULT_GLOBAL_STYLE,
        chatMessages: [],
        conversations: [],
        activeConversationId: null,
        _persistedMessageIds: new Set<string>(),
        pendingStoryboard: null,
        storyboardProposed: null,
        pausedAgentRun: null,
        runCheckpoint: null,
        publishedUrl: null,
        _dbLoadComplete: true,
      })

      const st = get()
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: st.project.id,
            name: st.project.name,
            outputMode: st.project.outputMode,
            globalStyle: st.globalStyle,
            mp4Settings: st.project.mp4Settings,
            interactiveSettings: st.project.interactiveSettings,
            apiPermissions: st.project.apiPermissions,
            audioSettings: st.project.audioSettings,
            audioProviderEnabled: st.audioProviderEnabled,
            mediaGenEnabled: st.mediaGenEnabled,
            scenes: st.scenes,
            sceneGraph: st.project.sceneGraph,
          }),
        })
        if (res.ok) {
          const saved = await res.json()
          const toIso = (v: unknown) => (typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : '')
          const createdAt = toIso(saved.createdAt) || st.project.createdAt
          const updatedAt = toIso(saved.updatedAt) || st.project.updatedAt
          set({
            project: { ...get().project, createdAt, updatedAt },
          })
        } else {
          const err = await res.json().catch(() => ({}))
          console.error('[createNewProject] POST /api/projects failed:', res.status, err)
          await get().saveProjectToDb()
        }
      } catch (e) {
        console.error('[createNewProject] persist error:', e)
        await get().saveProjectToDb()
      }

      await get().fetchProjectList()
      // Create first conversation for the new project
      await get().newConversation(newProject.id)
    },

    refreshProjectFromServer: async () => {
      const { project, _dbLoadComplete } = get()
      if (!project?.id || !_dbLoadComplete) return
      try {
        const res = await fetch(`/api/projects/${project.id}`)
        if (!res.ok) return
        const data = await res.json()
        const newScenes: Scene[] = (data.scenes || []).map(normalizeScene)
        const loadedProject: Project = {
          id: data.id,
          name: data.name,
          outputMode: data.outputMode || 'mp4',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          mp4Settings: data.mp4Settings || { resolution: '1080p', fps: 30, format: 'mp4' },
          interactiveSettings: data.interactiveSettings || {
            playerTheme: 'dark',
            showProgressBar: true,
            showSceneNav: true,
            allowFullscreen: true,
            brandColor: '#e84545',
            customDomain: null,
            password: null,
          },
          sceneGraph: data.sceneGraph || { nodes: [], edges: [], startSceneId: '' },
          apiPermissions: data.apiPermissions || createDefaultAPIPermissions(),
          audioSettings: data.audioSettings || DEFAULT_AUDIO_SETTINGS,
          audioProviderEnabled: data.audioProviderEnabled || { ...DEFAULT_AUDIO_PROVIDER_ENABLED },
          mediaGenEnabled: data.mediaGenEnabled || { ...DEFAULT_MEDIA_PROVIDER_ENABLED },
          watermark: data.watermark || null,
          timeline: data.timeline || null,
        }
        const currentTheme = get().globalStyle.theme
        const loadedStyle = data.globalStyle || DEFAULT_GLOBAL_STYLE
        const proposedRaw = data.storyboardProposed ?? null
        const editedRaw = data.storyboardEdited ?? proposedRaw
        const { proposed: loadedProposed, edited: loadedEdited } = ensureStoryboardSceneIdsForPair(
          proposedRaw,
          editedRaw,
        )
        const loadedPausedRun = data.pausedAgentRun ?? null
        const loadedRunCheckpoint = data.runCheckpoint ?? null
        const sel = get().selectedSceneId
        const selectedSceneId = sel && newScenes.some((s) => s.id === sel) ? sel : (newScenes[0]?.id ?? null)
        set({
          project: loadedProject,
          scenes: newScenes,
          selectedSceneId,
          globalStyle: (() => {
            const prev = get().globalStyle
            const typ = prev.uiTypography ?? 'app'
            return {
              ...loadedStyle,
              theme: currentTheme ?? loadedStyle.theme,
              uiTypography: typ,
              uiFontFamily: typ === 'custom' ? (prev.uiFontFamily ?? 'Inter') : null,
            }
          })(),
          audioProviderEnabled: loadedProject.audioProviderEnabled,
          mediaGenEnabled: loadedProject.mediaGenEnabled,
          sceneHtmlVersion: get().sceneHtmlVersion + 1,
          pendingStoryboard: loadedEdited,
          storyboardProposed: loadedProposed,
          pausedAgentRun: loadedPausedRun,
          runCheckpoint: loadedRunCheckpoint,
          _lastDbLoadTimestamp: Date.now(),
        })
        for (let i = 0; i < newScenes.length; i++) {
          const scene = newScenes[i]
          if (sceneHasRenderableContent(scene)) {
            setTimeout(() => get().saveSceneHTML(scene.id, true), i * 50)
          }
        }
      } catch (e) {
        console.error('[Store] refreshProjectFromServer failed:', e)
      }
    },

    loadProject: async (projectId: string) => {
      // Immediately clear per-project state so nothing from the old project
      // is visible while the new project loads from DB.
      set({
        pendingStoryboard: null,
        storyboardProposed: null,
        pausedAgentRun: null,
        runCheckpoint: null,
        conversations: [],
        chatMessages: [],
        activeConversationId: null,
        _persistedMessageIds: new Set<string>(),
      })

      // Save current project before switching — auto-save may not have fired yet.
      // Only save if DB was loaded and scenes are still fresh (not stripped localStorage).
      const { scenes: currentScenes, _dbLoadComplete: dbLoaded, _lastDbLoadTimestamp: dbLoadTs } = get()
      const dbDataIsStillFresh = dbLoaded && (Date.now() - (dbLoadTs ?? 0)) < 300_000 // 5 min
      const hasContent = currentScenes.some(sceneHasRenderableContent)
      if (hasContent && dbDataIsStillFresh) {
        await get().saveProjectToDb()
      }
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(`Failed to load project: ${res.status} ${err.error || ''}`)
        }
        const data = await res.json()

        const loadedProject: Project = {
          id: data.id,
          name: data.name,
          outputMode: data.outputMode || 'mp4',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          mp4Settings: data.mp4Settings || { resolution: '1080p', fps: 30, format: 'mp4' },
          interactiveSettings: data.interactiveSettings || {
            playerTheme: 'dark',
            showProgressBar: true,
            showSceneNav: true,
            allowFullscreen: true,
            brandColor: '#e84545',
            customDomain: null,
            password: null,
          },
          sceneGraph: data.sceneGraph || { nodes: [], edges: [], startSceneId: '' },
          apiPermissions: data.apiPermissions || createDefaultAPIPermissions(),
          audioSettings: data.audioSettings || DEFAULT_AUDIO_SETTINGS,
          audioProviderEnabled: data.audioProviderEnabled || { ...DEFAULT_AUDIO_PROVIDER_ENABLED },
          mediaGenEnabled: data.mediaGenEnabled || { ...DEFAULT_MEDIA_PROVIDER_ENABLED },
          watermark: data.watermark || null,
          timeline: data.timeline || null,
        }

        // Preserve the current editor theme and UI typography (global preference, not per-project)
        const currentTheme = get().globalStyle.theme
        const prevGs = get().globalStyle
        const typ = prevGs.uiTypography ?? 'app'
        const loadedStyle = data.globalStyle || DEFAULT_GLOBAL_STYLE
        const proposedRaw = data.storyboardProposed ?? null
        const editedRaw = data.storyboardEdited ?? proposedRaw
        const { proposed: loadedProposed, edited: loadedEdited } = ensureStoryboardSceneIdsForPair(
          proposedRaw,
          editedRaw,
        )
        const loadedPausedRun = data.pausedAgentRun ?? null
        const loadedRunCheckpoint = data.runCheckpoint ?? null
        const loadedSceneIds = new Set((data.scenes || []).map((s: any) => s.id))
        const persistedSelectedId = get().selectedSceneId
        const selectedSceneId = (persistedSelectedId && loadedSceneIds.has(persistedSelectedId))
          ? persistedSelectedId
          : data.scenes?.[0]?.id ?? null
        set({
          project: loadedProject,
          scenes: (data.scenes || []).map(normalizeScene),
          selectedSceneId,
          // Clear conversation state immediately so old project's messages don't bleed through
          conversations: [],
          chatMessages: [],
          activeConversationId: null,
          _persistedMessageIds: new Set<string>(),
          globalStyle: {
            ...loadedStyle,
            theme: currentTheme ?? loadedStyle.theme,
            uiTypography: typ,
            uiFontFamily: typ === 'custom' ? (prevGs.uiFontFamily ?? 'Inter') : null,
          },
          audioProviderEnabled: loadedProject.audioProviderEnabled,
          mediaGenEnabled: loadedProject.mediaGenEnabled,
          publishedUrl: null,
          pendingStoryboard: loadedEdited,
          storyboardProposed: loadedProposed,
          pausedAgentRun: loadedPausedRun,
          runCheckpoint: loadedRunCheckpoint,
        })

        // Regenerate scene HTML to inject updated element-registry code
        // Only for scenes that actually have content (avoid overwriting existing HTML with empty output)
        // Stagger calls to avoid bursts of parallel write requests
        const loadedScenes = data.scenes || []
        for (let i = 0; i < loadedScenes.length; i++) {
          const scene = loadedScenes[i]
          if (sceneHasRenderableContent(scene)) {
            setTimeout(() => get().saveSceneHTML(scene.id, true), i * 50)
          }
        }

        // Load project conversations and assets
        await get().loadConversations(projectId)
        get().loadProjectAssets(projectId)

        // Mark DB load complete — auto-save is now safe
        set({ _dbLoadComplete: true, _lastDbLoadTimestamp: Date.now() })

        // The _lastDbLoadTimestamp guard in the persist merge callback now prevents
        // localStorage from clobbering freshly loaded DB scenes — no setTimeout hack needed.
      } catch (e) {
        console.error('Failed to load project:', e)
      }
    },

    saveProjectToDb: async () => {
      const { project, scenes, globalStyle, audioProviderEnabled, mediaGenEnabled, _dbLoadComplete } = get()
      // Don't save until DB has been loaded — prevents overwriting real data
      // with empty localStorage-hydrated scenes
      if (!_dbLoadComplete) return

      const patchBody = JSON.stringify({
        name: project.name,
        outputMode: project.outputMode,
        globalStyle,
        mp4Settings: project.mp4Settings,
        interactiveSettings: project.interactiveSettings,
        apiPermissions: project.apiPermissions,
        audioSettings: project.audioSettings,
        audioProviderEnabled,
        mediaGenEnabled,
        watermark: project.watermark,
        scenes,
        sceneGraph: project.sceneGraph,
        timeline: project.timeline ?? null,
      })

      let res: Response | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: patchBody,
        })
        if (res.status === 409 && attempt < 2) {
          // Version conflict — refresh server timestamp and retry with backoff
          console.warn(`[saveProjectToDb] 409 conflict on attempt ${attempt + 1}, retrying…`)
          await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)))
          try {
            const refresh = await fetch(`/api/projects/${project.id}`)
            if (refresh.ok) {
              const fresh = await refresh.json()
              if (fresh.updatedAt) set({ project: { ...get().project, updatedAt: fresh.updatedAt } })
            }
          } catch { /* proceed with retry anyway */ }
          continue
        }
        break
      }

      if (res?.ok) {
        const saved = await res.json()
        if (saved.updatedAt) {
          set({ project: { ...get().project, updatedAt: saved.updatedAt }, _isDirty: false })
        }
      } else if (res?.status === 404) {
        // Project doesn't exist in DB yet — create it
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: project.id,
            name: project.name,
            outputMode: project.outputMode,
            globalStyle,
            mp4Settings: project.mp4Settings,
            interactiveSettings: project.interactiveSettings,
            apiPermissions: project.apiPermissions,
            audioSettings: project.audioSettings,
            audioProviderEnabled,
            mediaGenEnabled,
            scenes,
            sceneGraph: project.sceneGraph,
            timeline: project.timeline ?? null,
          }),
        })
      }
    },

    deleteProjectFromDb: async (projectId: string) => {
      try {
        await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
        await get().fetchProjectList()
      } catch (e) {
        console.error('Failed to delete project:', e)
      }
    },
  }
}

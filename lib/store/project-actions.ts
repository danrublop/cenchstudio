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
  getPersistedTheme,
} from './helpers'

export function createProjectActions(set: Set, get: Get) {
  return {
    setOutputMode: (mode: 'mp4' | 'interactive') => {
      set((state) => ({
        project: { ...state.project, outputMode: mode, updatedAt: new Date().toISOString() },
      }))
    },

    updateProject: (updates: Partial<Project>) => {
      set((state) => ({
        project: { ...state.project, ...updates, updatedAt: new Date().toISOString() },
      }))
    },

    updateSceneGraph: (graph: SceneGraph) => {
      set((state) => ({
        project: { ...state.project, sceneGraph: graph, updatedAt: new Date().toISOString() },
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
          set({ projectList: list.map((p: any) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt })) })
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
          mp4Settings: { resolution: '1080p', fps: 30, format: 'mp4', aspectRatio: '16:9' as const, ...data.mp4Settings },
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
          brandKit: data.brandKit || null,
          timeline: data.timeline || null,
        }
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
              theme: getPersistedTheme(),
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
          brandKit: loadedProject.brandKit,
        })
        for (const scene of newScenes) {
          if (sceneHasRenderableContent(scene)) {
            get().saveSceneHTML(scene.id, true)
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
      // Only save if scenes actually have content (avoids overwriting DB with empty
      // localStorage-hydrated scenes on initial page load).
      const hasContent = get().scenes.some(sceneHasRenderableContent)
      if (hasContent) {
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
          mp4Settings: { resolution: '1080p', fps: 30, format: 'mp4', aspectRatio: '16:9' as const, ...data.mp4Settings },
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
          brandKit: data.brandKit || null,
          timeline: data.timeline || null,
        }

        // Preserve the current editor theme and UI typography (global preference, not per-project)
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
        set({
          project: loadedProject,
          scenes: (data.scenes || []).map(normalizeScene),
          selectedSceneId: data.scenes?.[0]?.id || null,
          // Clear conversation state immediately so old project's messages don't bleed through
          conversations: [],
          chatMessages: [],
          activeConversationId: null,
          _persistedMessageIds: new Set<string>(),
          globalStyle: {
            ...loadedStyle,
            theme: getPersistedTheme(),
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
          brandKit: loadedProject.brandKit,
        })

        // Regenerate scene HTML to inject updated element-registry code
        // Only for scenes that actually have content (avoid overwriting existing HTML with empty output)
        const loadedScenes = data.scenes || []
        let savedAny = false
        for (const scene of loadedScenes) {
          if (sceneHasRenderableContent(scene)) {
            get().saveSceneHTML(scene.id, true)
            savedAny = true
          }
        }
        // Bump sceneHtmlVersion so PreviewPlayer knows HTML files exist
        if (savedAny) {
          set({ sceneHtmlVersion: get().sceneHtmlVersion + 1 })
        }

        // Load project conversations and assets
        await get().loadConversations(projectId)
        get().loadProjectAssets(projectId)

        // Mark DB load complete — auto-save is now safe
        set({ _dbLoadComplete: true })

        // Guard against persist middleware clobbering rich scenes with stripped
        // localStorage data. If after a short delay the store's scenes lost their
        // code fields, re-fetch from the server.
        const richSceneIds = loadedScenes
          .filter((s: any) => sceneHasRenderableContent(s))
          .map((s: any) => s.id)
        if (richSceneIds.length > 0) {
          setTimeout(() => {
            const current = get().scenes
            const clobbered = richSceneIds.some((id: string) => {
              const s = current.find((cs) => cs.id === id)
              return s && !sceneHasRenderableContent(s)
            })
            if (clobbered) {
              console.warn('[loadProject] Persist merge clobbered scene code — refreshing from server')
              get().refreshProjectFromServer()
            }
          }, 500)
        }
      } catch (e) {
        console.error('Failed to load project:', e)
      }
    },

    saveProjectToDb: async () => {
      const { project, scenes, globalStyle, audioProviderEnabled, mediaGenEnabled, _dbLoadComplete } = get()
      // Don't save until DB has been loaded — prevents overwriting real data
      // with empty localStorage-hydrated scenes
      if (!_dbLoadComplete) return
      const localRich = scenes.some(sceneHasRenderableContent)

      let dbProject: any = null
      try {
        const check = await fetch(`/api/projects/${project.id}`, { method: 'GET' })
        if (check.ok) dbProject = await check.json()
      } catch {
        /* proceed without snapshot */
      }

      const dbScenes: Scene[] = dbProject?.scenes || []
      const dbRich = dbScenes.some(sceneHasRenderableContent)

      // Pull server state into the editor when local is clearly behind (stripped persist / wrong tab).
      const pullFromDb = () => {
        void get().refreshProjectFromServer()
      }

      const sameSceneIds =
        dbProject &&
        scenes.length === dbScenes.length &&
        scenes.length > 0 &&
        scenes.every((s) => dbScenes.some((d) => d.id === s.id))

      // Only skip when local looks like stripped localStorage (same scenes as DB, no code) but DB still has content.
      if (sameSceneIds && !localRich && dbRich) {
        console.warn(
          'saveProjectToDb: skipping save — local has no renderable content but DB does (likely stripped localStorage)',
        )
        pullFromDb()
        return
      }

      try {
        if (dbProject) {
          const dbTime = new Date(dbProject.updatedAt).getTime()
          const ourTime = new Date(project.updatedAt).getTime()
          if (dbTime > ourTime) {
            if (dbRich && !localRich) pullFromDb()
            return
          }

          if (!localRich && dbRich && dbScenes.length > scenes.length) {
            console.warn('saveProjectToDb: skipping — DB has more scenes than local (rehydration/stale client)')
            pullFromDb()
            return
          }
          if (!localRich && dbRich && dbScenes.length === scenes.length && scenes.length > 0) {
            const localIds = new Set(scenes.map((s) => s.id))
            const dbIds = new Set(dbScenes.map((s) => s.id))
            const sameSet = localIds.size === dbIds.size && [...localIds].every((id) => dbIds.has(id))
            if (sameSet) {
              console.warn('saveProjectToDb: skipping — DB has scene content, local is empty (stripped localStorage)')
              pullFromDb()
              return
            }
          }
        }

        // PATCH the project with retry on 409 conflict
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
          brandKit: project.brandKit,
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
            // Re-read server version so next attempt has correct updatedAt
            try {
              const refresh = await fetch(`/api/projects/${project.id}`, { method: 'GET' })
              if (refresh.ok) {
                const freshProject = await refresh.json()
                if (freshProject.updatedAt) {
                  set({ project: { ...get().project, updatedAt: freshProject.updatedAt } })
                }
              }
            } catch { /* proceed with retry anyway */ }
            continue
          }
          break
        }
        if (res && res.ok) {
          // Sync local updatedAt so subsequent auto-saves aren't blocked
          // by the conflict check (DB timestamp would be newer otherwise)
          const saved = await res.json()
          if (saved.updatedAt) {
            set({ project: { ...get().project, updatedAt: saved.updatedAt } })
          }
        } else if (res && res.status === 404) {
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
      } catch (e) {
        console.error('Failed to save project:', e)
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

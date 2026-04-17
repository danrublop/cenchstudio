import type { StoreApi } from 'zustand'
import type { VideoStore } from './types'
import type { Workspace } from '../types'

type Set = StoreApi<VideoStore>['setState']
type Get = () => VideoStore

export function createWorkspaceActions(set: Set, get: Get) {
  return {
    fetchWorkspaces: async () => {
      set({ isLoadingWorkspaces: true })
      try {
        const res = await fetch('/api/workspaces')
        if (res.ok) {
          const list = await res.json()
          set({ workspaces: list })
        }
      } catch (e) {
        console.error('Failed to fetch workspaces:', e)
      } finally {
        set({ isLoadingWorkspaces: false })
      }
    },

    createWorkspace: async (name: string, opts?: { color?: string; icon?: string }): Promise<string> => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: opts?.color, icon: opts?.icon }),
      })
      if (!res.ok) throw new Error('Failed to create workspace')
      const workspace = await res.json()
      await get().fetchWorkspaces()
      return workspace.id
    },

    updateWorkspace: async (id: string, updates: Partial<Workspace>) => {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update workspace')
      await get().fetchWorkspaces()
    },

    deleteWorkspace: async (id: string) => {
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete workspace')
      // If we were viewing the deleted workspace, reset to all projects
      if (get().activeWorkspaceId === id) {
        set({ activeWorkspaceId: null })
      }
      await get().fetchWorkspaces()
      await get().fetchProjectList()
    },

    setActiveWorkspace: (id: string | null) => {
      set({ activeWorkspaceId: id })
    },

    moveProjectToWorkspace: async (projectId: string, workspaceId: string | null) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      if (!res.ok) throw new Error('Failed to move project')
      // Update local project list
      set((state) => ({
        projectList: state.projectList.map((p) => (p.id === projectId ? { ...p, workspaceId } : p)),
      }))
      await get().fetchWorkspaces()
    },
  }
}

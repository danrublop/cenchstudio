import type { StoreApi } from 'zustand'
import type { VideoStore } from './types'
import type { Workspace, WorkspaceListItem } from '../types'
import { createLogger } from '../logger'

const log = createLogger('store.workspace')

type Set = StoreApi<VideoStore>['setState']
type Get = () => VideoStore

const workspacesIpc = () => (typeof window !== 'undefined' ? window.cenchApi?.workspaces : undefined)
const projectsIpc = () => (typeof window !== 'undefined' ? window.cenchApi?.projects : undefined)

export function createWorkspaceActions(set: Set, get: Get) {
  return {
    fetchWorkspaces: async () => {
      set({ isLoadingWorkspaces: true })
      try {
        const ipc = workspacesIpc()
        const list = ipc ? await ipc.list() : await fetch('/api/workspaces').then((r) => (r.ok ? r.json() : null))
        if (list) set({ workspaces: list as unknown as WorkspaceListItem[] })
      } catch (e) {
        log.error('failed to fetch workspaces', { error: e })
      } finally {
        set({ isLoadingWorkspaces: false })
      }
    },

    createWorkspace: async (name: string, opts?: { color?: string; icon?: string }): Promise<string> => {
      const ipc = workspacesIpc()
      const workspace = ipc
        ? await ipc.create({ name, color: opts?.color, icon: opts?.icon })
        : await (async () => {
            const res = await fetch('/api/workspaces', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, color: opts?.color, icon: opts?.icon }),
            })
            if (!res.ok) throw new Error('Failed to create workspace')
            return res.json()
          })()
      await get().fetchWorkspaces()
      return (workspace as { id: string }).id
    },

    updateWorkspace: async (id: string, updates: Partial<Workspace>) => {
      const ipc = workspacesIpc()
      if (ipc) {
        await ipc.update({ workspaceId: id, updates: updates as Record<string, unknown> })
      } else {
        const res = await fetch(`/api/workspaces/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!res.ok) throw new Error('Failed to update workspace')
      }
      await get().fetchWorkspaces()
    },

    deleteWorkspace: async (id: string) => {
      const ipc = workspacesIpc()
      if (ipc) {
        await ipc.delete(id)
      } else {
        const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete workspace')
      }
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
      const ipc = projectsIpc()
      if (ipc) {
        await ipc.update({ projectId, updates: { workspaceId } })
      } else {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        })
        if (!res.ok) throw new Error('Failed to move project')
      }
      // Update local project list
      set((state) => ({
        projectList: state.projectList.map((p) => (p.id === projectId ? { ...p, workspaceId } : p)),
      }))
      await get().fetchWorkspaces()
    },
  }
}

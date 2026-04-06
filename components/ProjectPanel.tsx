'use client'

import { useEffect, useState, useCallback } from 'react'
import { useVideoStore } from '@/lib/store'
import { FolderOpen, Plus, X, ChevronDown, Film, Layers, Clock } from 'lucide-react'

interface ProjectListItem {
  id: string
  name: string
  description: string | null
  outputMode: string
  updatedAt: string
  createdAt: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export default function ProjectPanel({ onClose }: { onClose: () => void }) {
  const {
    project,
    scenes,
    projectList,
    isLoadingProjects,
    fetchProjectList,
    createNewProject,
    loadProject,
    deleteProjectFromDb,
    saveProjectToDb,
  } = useVideoStore()

  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)

  // Fetch full project list with details
  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const list = await res.json()
        setProjects(list)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Count scenes from description JSON for other projects
  const getSceneCount = (p: ProjectListItem) => {
    if (p.id === project.id) return scenes.length
    try {
      const data = JSON.parse(p.description || '{}')
      return data.scenes?.length ?? 0
    } catch {
      return 0
    }
  }

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== project.name) {
      useVideoStore.getState().updateProject({ name: renameValue.trim() })
      await saveProjectToDb()
      fetchProjects()
    }
    setIsRenaming(false)
  }

  const handleDelete = async (id: string) => {
    await deleteProjectFromDb(id)
    setConfirmDelete(null)
    if (id === project.id) {
      // Deleted current project — load another or create new
      const remaining = projects.filter((p) => p.id !== id)
      if (remaining.length > 0) {
        await loadProject(remaining[0].id)
      } else {
        await createNewProject()
      }
    }
    fetchProjects()
  }

  const handleCreate = async () => {
    await createNewProject()
    onClose()
  }

  const handleSelect = async (id: string) => {
    if (id !== project.id) {
      await loadProject(id)
    }
    onClose()
  }

  const currentSceneCount = scenes.length
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 5), 0)

  return (
    <div className="flex flex-col h-full text-[var(--color-text-primary)] bg-transparent">
      <div className="flex-1 overflow-y-auto">
        {/* Current project details */}
        <div className="border-b border-[var(--color-border)] p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Current Project
          </div>

          {/* Project name + updated */}
          <div className="flex items-center gap-2">
            <input
              value={isRenaming ? renameValue : project.name}
              onFocus={() => {
                setRenameValue(project.name)
                setIsRenaming(true)
              }}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') {
                  setIsRenaming(false)
                  setRenameValue(project.name)
                }
              }}
              className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none outline-none text-[var(--color-text-primary)] truncate"
            />
            <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
              {formatRelative(project.updatedAt)}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2 text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1.5">
              <Layers size={12} />
              <span className="text-[12px] tabular-nums">
                {currentSceneCount} scene{currentSceneCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span className="text-[12px] tabular-nums">{totalDuration}s</span>
            </div>
            <span className="text-[12px] tabular-nums uppercase ml-auto">{project.outputMode}</span>
          </div>

          {/* Project settings */}
          <details className="mt-3 group">
            <summary className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
              Details
              <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2 space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">ID</span>
                <span className="text-[var(--color-text-secondary)] font-mono text-[11px] truncate ml-2 max-w-[160px]">
                  {project.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Resolution</span>
                <span className="text-[var(--color-text-secondary)]">{project.mp4Settings?.resolution || '1080p'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">FPS</span>
                <span className="text-[var(--color-text-secondary)]">{project.mp4Settings?.fps || 30}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Format</span>
                <span className="text-[var(--color-text-secondary)] uppercase">
                  {project.mp4Settings?.format || 'mp4'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Created</span>
                <span className="text-[var(--color-text-secondary)]">{formatDate(project.createdAt)}</span>
              </div>
            </div>
          </details>
        </div>

        {/* All projects */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">All Projects</div>
            <span
              onClick={handleCreate}
              className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Plus size={14} />
            </span>
          </div>

          {loading ? (
            <div className="text-[12px] text-[var(--color-text-muted)] py-4 text-center">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-[12px] text-[var(--color-text-muted)] py-4 text-center">No projects yet</div>
          ) : (
            <div className="space-y-1">
              {projects.map((p) => {
                const isCurrent = p.id === project.id
                const sceneCount = getSceneCount(p)
                return (
                  <div
                    key={p.id}
                    className={`group/item rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-white/5 border border-[var(--color-border)]'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                    onClick={() => handleSelect(p.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FolderOpen size={13} className="text-[var(--color-text-muted)] shrink-0" />
                        <span className="text-[12px] font-medium truncate">{p.name}</span>
                      </div>
                      {confirmDelete !== p.id && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDelete(p.id)
                          }}
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer shrink-0 ml-2"
                        >
                          <X size={12} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--color-text-muted)]">
                      <span>
                        {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                      </span>
                      <span className="uppercase">{p.outputMode || 'mp4'}</span>
                      <span className="ml-auto">{formatRelative(p.updatedAt)}</span>
                    </div>
                    {confirmDelete === p.id && (
                      <div className="flex gap-2 mt-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                        <span
                          onClick={() => handleDelete(p.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer transition-colors"
                        >
                          Delete
                        </span>
                        <span
                          onClick={() => setConfirmDelete(null)}
                          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
                        >
                          Cancel
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

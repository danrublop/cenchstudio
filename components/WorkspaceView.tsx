'use client'

import { useEffect, useState, useRef } from 'react'
import { useVideoStore } from '@/lib/store'
import { Plus, FolderOpen, Clock, Layers, ChevronLeft, Trash2 } from 'lucide-react'

const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1']

interface ProjectListItem {
  id: string
  name: string
  description: string | null
  outputMode: string
  workspaceId: string | null
  updatedAt: string
  createdAt: string
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
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getSceneCount(p: ProjectListItem, currentProjectId: string, currentScenes: any[]) {
  if (p.id === currentProjectId) return currentScenes.length
  try {
    const data = JSON.parse(p.description || '{}')
    return data.scenes?.length ?? 0
  } catch {
    return 0
  }
}

/** Single workspace detail view */
function WorkspaceDetail({ workspaceId, onBack }: { workspaceId: string; onBack: () => void }) {
  const {
    workspaces,
    project,
    scenes,
    loadProject,
    createNewProject,
    deleteProjectFromDb,
    fetchWorkspaces,
    updateWorkspace,
    deleteWorkspace,
    setActiveWorkspace,
    setCenterTab,
  } = useVideoStore()

  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const workspace = workspaces.find((w) => w.id === workspaceId)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((list) => setProjects(list))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workspaceId])

  useEffect(() => {
    if (isEditingName && nameInputRef.current) nameInputRef.current.focus()
  }, [isEditingName])

  if (!workspace) return null

  const handleSaveName = async () => {
    if (nameValue.trim() && nameValue !== workspace.name) {
      await updateWorkspace(workspace.id, { name: nameValue.trim() })
    }
    setIsEditingName(false)
  }

  const handleOpenProject = async (id: string) => {
    await loadProject(id)
    setCenterTab('preview')
  }

  const handleNewProject = async () => {
    setActiveWorkspace(workspace.id)
    await createNewProject()
    setCenterTab('preview')
  }

  const handleDeleteProject = async (id: string) => {
    await deleteProjectFromDb(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    fetchWorkspaces()
  }

  const handleDeleteWorkspace = async () => {
    await deleteWorkspace(workspace.id)
    onBack()
  }

  return (
    <div className="max-w-[720px] mx-auto px-8 py-10">
      {/* Back + header */}
      <div
        onClick={onBack}
        className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        All workspaces
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          {workspace.color && (
            <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: workspace.color }} />
          )}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') setIsEditingName(false)
              }}
              className="text-xl font-semibold bg-transparent border-b border-[var(--color-border)] outline-none text-[var(--color-text-primary)] flex-1"
            />
          ) : (
            <h1
              className="text-xl font-semibold text-[var(--color-text-primary)] cursor-pointer hover:opacity-80"
              onClick={() => {
                setNameValue(workspace.name)
                setIsEditingName(true)
              }}
            >
              {workspace.name}
            </h1>
          )}
          <span
            onClick={handleDeleteWorkspace}
            className="ml-auto text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer transition-colors"
            title="Delete workspace"
          >
            <Trash2 size={14} />
          </span>
        </div>

        <div className="flex items-center gap-4 text-[13px] text-[var(--color-text-muted)]">
          <span>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Projects grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Projects</h2>
          <span
            onClick={handleNewProject}
            className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
          >
            <Plus size={14} />
            New project
          </span>
        </div>

        {loading ? (
          <div className="text-[13px] text-[var(--color-text-muted)] py-8 text-center">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen size={32} className="text-[var(--color-text-muted)] opacity-30 mx-auto mb-3" />
            <p className="text-[13px] text-[var(--color-text-muted)] mb-4">No projects in this workspace yet</p>
            <span
              onClick={handleNewProject}
              className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-accent)] hover:opacity-80 cursor-pointer transition-opacity"
            >
              <Plus size={12} />
              Create your first project
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => {
              const sceneCount = getSceneCount(p, project.id, scenes)
              const isCurrent = p.id === project.id
              return (
                <div
                  key={p.id}
                  className={`group/card rounded-xl border transition-colors cursor-pointer p-4 ${
                    isCurrent
                      ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
                      : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30 bg-[var(--color-panel)]'
                  }`}
                  onClick={() => handleOpenProject(p.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate flex-1 mr-2">
                      {p.name}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(p.id)
                      }}
                      className="opacity-0 group-hover/card:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer shrink-0 text-[11px]"
                    >
                      Delete
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Layers size={10} />
                      {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                    </span>
                    <span className="uppercase">{p.outputMode || 'mp4'}</span>
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock size={10} />
                      {formatRelative(p.updatedAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** Main workspace tab — shows all workspaces, click to drill in */
export default function WorkspaceView({ onClose }: { onClose: () => void }) {
  const { activeWorkspaceId, workspaces, fetchWorkspaces, createWorkspace, setActiveWorkspace } = useVideoStore()

  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    if (creatingWorkspace) inputRef.current?.focus()
  }, [creatingWorkspace])

  const handleCreate = async () => {
    if (!newName.trim()) {
      setCreatingWorkspace(false)
      return
    }
    const colorIdx = workspaces.length % DEFAULT_COLORS.length
    const id = await createWorkspace(newName.trim(), { color: DEFAULT_COLORS[colorIdx] })
    setNewName('')
    setCreatingWorkspace(false)
    setActiveWorkspace(id)
  }

  // Drill-in: show single workspace detail
  if (activeWorkspaceId) {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--color-input-bg)]">
        <WorkspaceDetail workspaceId={activeWorkspaceId} onBack={() => setActiveWorkspace(null)} />
      </div>
    )
  }

  // All workspaces list
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-input-bg)]">
      <div className="max-w-[720px] mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Workspaces</h1>
          <span
            onClick={() => setCreatingWorkspace(true)}
            className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
          >
            <Plus size={14} />
            New workspace
          </span>
        </div>

        {/* Create workspace inline */}
        {creatingWorkspace && (
          <div className="mb-4 flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: DEFAULT_COLORS[workspaces.length % DEFAULT_COLORS.length] }}
            />
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setCreatingWorkspace(false)
                  setNewName('')
                }
              }}
              onBlur={handleCreate}
              placeholder="Workspace name..."
              className="flex-1 text-[13px] bg-transparent border-none outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
          </div>
        )}

        {workspaces.length === 0 && !creatingWorkspace ? (
          <div className="text-center py-16">
            <Layers size={40} className="text-[var(--color-text-muted)] opacity-20 mx-auto mb-4" />
            <p className="text-[14px] text-[var(--color-text-muted)] mb-4">
              Workspaces group projects together for shared assets, styles, and batch workflows.
            </p>
            <span
              onClick={() => setCreatingWorkspace(true)}
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-accent)] hover:opacity-80 cursor-pointer transition-opacity"
            >
              <Plus size={14} />
              Create your first workspace
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="rounded-xl border border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30 bg-[var(--color-panel)] p-4 cursor-pointer transition-colors"
                onClick={() => setActiveWorkspace(ws.id)}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  {ws.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />}
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)] truncate">{ws.name}</span>
                </div>
                <div className="text-[12px] text-[var(--color-text-muted)]">
                  {ws.projectCount} project{ws.projectCount !== 1 ? 's' : ''}
                  <span className="mx-2">·</span>
                  {formatRelative(ws.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

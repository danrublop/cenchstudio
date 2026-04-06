'use client'

import { useEffect, useState, useCallback } from 'react'
import { useVideoStore } from '@/lib/store'
import { FolderOpen, Video, Monitor, Plus, Clock } from 'lucide-react'
import dynamic from 'next/dynamic'

const Logo3D = dynamic(() => import('./Logo3D'), { ssr: false })
import RecordingHUD from '@/components/recording/RecordingHUD'
import type { RecordingSessionManifest } from '@/types/electron'

interface ProjectItem {
  id: string
  name: string
  updatedAt: string
}

type RecordingPhase = 'idle' | 'recording'

export default function WelcomePage({ onEnterEditor }: { onEnterEditor: () => void }) {
  const { fetchProjectList, projectList, loadProject, createNewProject, addScene, updateScene, saveSceneHTML } =
    useVideoStore()
  const [loading, setLoading] = useState(true)
  const [recordPhase, setRecordPhase] = useState<RecordingPhase>('idle')


  useEffect(() => {
    fetchProjectList().finally(() => setLoading(false))
  }, [fetchProjectList])

  const handleOpenProject = async (projectId: string) => {
    await loadProject(projectId)
    onEnterEditor()
  }

  const handleNewProject = async () => {
    await createNewProject()
    onEnterEditor()
  }

  const handleRecordClick = () => {
    setRecordPhase('recording')
  }

  const handleStudioRecord = async () => {
    await createNewProject('Studio Recording')
    const sceneId = addScene('Recording')
    useVideoStore.getState().setStudioRecordMode(true)
    useVideoStore.getState().setRecordingAttachSceneId(sceneId)
    console.log('[WelcomePage] Studio record mode set:', useVideoStore.getState().studioRecordMode)
    onEnterEditor()
  }

  const handleRecordingFinish = useCallback(
    async (manifest: RecordingSessionManifest) => {
      setRecordPhase('idle')
            try {
        // Create project + scene with the recorded video
        await createNewProject('Screen Recording')
        const sceneId = addScene('Screen recording')
        updateScene(sceneId, {
          videoLayer: {
            src: manifest.screenVideoUrl,
            enabled: true,
            opacity: 1,
            trimStart: 0,
            trimEnd: null,
          },
        })
        await saveSceneHTML(sceneId)
        onEnterEditor()
      } catch (err: any) {
        alert(`Failed to create project from recording: ${err.message || 'Unknown error'}.\nThe recording was saved to disk.`)
      }
    },
    [createNewProject, addScene, updateScene, saveSceneHTML, onEnterEditor],
  )

  const handleRecordingCancel = () => {
    setRecordPhase('idle')
      }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="h-full w-full flex bg-[var(--color-panel)]">
      {/* Recording HUD overlay */}
      {recordPhase === 'recording' && (
        <RecordingHUD
          onFinish={handleRecordingFinish}
          onCancel={handleRecordingCancel}
        />
      )}

      {/* Left — Recent Projects */}
      <div className="w-[280px] shrink-0 border-r border-[var(--color-border)] flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted, #6b6b7a)' }}>
            Recent projects
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-3" style={{ color: 'var(--color-text-muted, #6b6b7a)' }}>
              <Clock size={13} className="animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : projectList.length === 0 ? (
            <div className="px-2 py-3 text-xs" style={{ color: 'var(--color-text-muted, #6b6b7a)' }}>
              No projects yet
            </div>
          ) : (
            projectList.map((p) => (
              <div
                key={p.id}
                onClick={() => handleOpenProject(p.id)}
                className="flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors"
                style={{ color: 'var(--color-text-primary, #f0ece0)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface, #1e1e1e)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-[13px] truncate mr-3">{p.name}</span>
                <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--color-text-muted, #6b6b7a)' }}>
                  {formatDate(p.updatedAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right — Main area with 3D logo center, actions bottom-right */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-[320px] h-[320px]">
            <Logo3D />
          </div>
        </div>
        <div className="flex items-end justify-end gap-2 p-5">
          <ActionCard icon={<Plus size={18} />} label="New project" onClick={handleNewProject} />
          <ActionCard
            icon={<FolderOpen size={18} />}
            label="Open project"
            onClick={() => {
              if (projectList.length > 0) {
                handleOpenProject(projectList[0].id)
              } else {
                handleNewProject()
              }
            }}
          />
          <ActionCard icon={<Video size={18} />} label="Quick Record" onClick={handleRecordClick} />
          <ActionCard icon={<Monitor size={18} />} label="Studio Record" onClick={handleStudioRecord} />
        </div>
      </div>
    </div>
  )
}

function ActionCard({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
      style={{
        color: 'var(--color-text-primary, #f0ece0)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-hover, #252525)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ color: 'var(--color-text-muted, #6b6b7a)' }}>{icon}</span>
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import SceneList, { ProjectSwitcher } from './SceneList'
import PreviewPlayer from './PreviewPlayer'
import SceneEditor from './SceneEditor'
import ExportModal from './ExportModal'
import PublishPanel from './PublishPanel'
import PermissionDialog from './PermissionDialog'
import ChatPanel from './ChatPanel'
import SettingsPanel from './SettingsPanel'
import AgentEditorOverlay from './settings/AgentEditorOverlay'
import { Bot, Bookmark, Settings, PanelLeft, Plus, X } from 'lucide-react'

export default function Editor() {
  const {
    scenes, addScene, updateScene, isExportModalOpen, openExportModal, globalStyle,
    project, setOutputMode, publishProject, isPublishing, showPublishPanel, setShowPublishPanel,
    publishedUrl, showModeModal, setShowModeModal, setPendingMode, pendingMode,
    isChatOpen, setChatOpen, settingsTab, setSettingsTab,
    editingAgentId, isCreatingAgent,
  } = useVideoStore()
  const [mounted, setMounted] = useState(false)
  const [leftWidth, setLeftWidth]   = useState(280)
  const [rightWidth, setRightWidth] = useState(340)
  const [chatWidth, setChatWidth]   = useState(380)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const showSettings = settingsTab !== null

  const panelDrag = useRef<{
    side: 'left' | 'right' | 'chat'
    startX: number
    startW: number
  } | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = panelDrag.current
      if (!d) return
      const dx = e.clientX - d.startX
      if (d.side === 'left') {
        const minW = showSettings ? 340 : 160
        setLeftWidth(Math.max(minW, Math.min(520, d.startW + dx)))
      } else if (d.side === 'right') {
        setRightWidth(Math.max(340, Math.min(600, d.startW - dx)))
      } else if (d.side === 'chat') {
        setChatWidth(Math.max(280, Math.min(560, d.startW - dx)))
      }
    }
    const onUp = () => {
      panelDrag.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [leftWidth, rightWidth, chatWidth, showSettings])

  useEffect(() => {
    if (showSettings) {
      setIsLeftCollapsed(false)
      if (leftWidth < 340) {
        setLeftWidth(340)
      }
    }
  }, [showSettings])

  const startPanelDrag = (e: React.MouseEvent, side: 'left' | 'right' | 'chat') => {
    e.preventDefault()
    panelDrag.current = {
      side,
      startX: e.clientX,
      startW: side === 'left' ? leftWidth : rightWidth,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const { saveProjectToDb, fetchProjectList, loadProject, projectList } = useVideoStore()

  useEffect(() => {
    setMounted(true)
    // On first load, try to load the most recent project from DB
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then((list: any[]) => {
        if (list.length > 0) {
          // Load most recent project (already sorted by updatedAt desc)
          useVideoStore.getState().loadProject(list[0].id)
        }
      })
      .catch(() => {}) // DB might not be ready yet, that's fine
  }, [])

  // Auto-save to DB every 30 seconds when there are changes
  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      saveProjectToDb()
    }, 30000)
    return () => clearInterval(interval)
  }, [mounted, saveProjectToDb])

  // Save on tab close
  useEffect(() => {
    if (!mounted) return
    const handler = () => { saveProjectToDb() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [mounted, saveProjectToDb])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (globalStyle.theme === 'light') {
      root.classList.add('light-theme')
    } else {
      root.classList.remove('light-theme')
    }
    root.style.setProperty('--font-global', globalStyle.font)
    globalStyle.palette.forEach((color, i) => {
      root.style.setProperty(`--color-p${i + 1}`, color)
    })
  }, [globalStyle.theme, globalStyle.font, globalStyle.palette])

  useEffect(() => {
    if (!mounted) return
    if (scenes.length === 0) {
      addScene()
    } else {
      scenes.forEach((scene) => {
        if (!scene.svgContent && scene.thumbnail) {
          updateScene(scene.id, { thumbnail: null })
        }
      })
    }
  }, [mounted])

  const confirmModeSwitch = () => {
    if (pendingMode) setOutputMode(pendingMode)
    setShowModeModal(false)
    setPendingMode(null)
  }

  const cancelModeSwitch = () => {
    setShowModeModal(false)
    setPendingMode(null)
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] animate-pulse">
          <span className="text-sm">loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] font-[family-name:var(--font-global)] overflow-hidden select-none">


      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left — Scene List */}
        <div
          className="flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col overflow-hidden transition-all duration-200 ease-in-out relative z-[101]"
          style={{ width: isLeftCollapsed ? 64 : leftWidth }}
        >
          <div className="flex-1 overflow-hidden relative flex flex-col">
            {/* Header with four buttons */}
            <div className={`pt-[12.25px] pb-[7px] flex-shrink-0 flex justify-between gap-2 ${isLeftCollapsed ? 'border-b-0 pl-3 pr-2' : 'border-b border-[var(--color-border)] px-3'}`}>
              <div className={`flex gap-2 ${isLeftCollapsed ? 'flex-col items-start' : 'flex-row items-center flex-1'}`}>
                <button
                  onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                  data-tooltip={isLeftCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  data-tooltip-pos="right"
                  className="kbd w-7 h-7 p-0 flex items-center justify-center shrink-0"
                >
                  <PanelLeft size={15} />
                </button>

                <ProjectSwitcher isCollapsed={isLeftCollapsed} />

                <button
                  onClick={() => setSettingsTab(showSettings ? null : 'general')}
                  className={`kbd w-7 h-7 p-0 flex items-center justify-center shrink-0 transition-all duration-200 ${showSettings ? 'border-[#e84545] text-[#e84545] shadow-[#800]' : ''}`}
                  data-tooltip="Settings"
                  data-tooltip-pos={isLeftCollapsed ? 'right' : 'bottom'}
                >
                  <Settings size={15} />
                </button>

                <button
                  onClick={() => {
                    if (showSettings) {
                      setSettingsTab(null)
                    } else {
                      addScene()
                    }
                  }}
                  className={`kbd h-7 !py-0 gap-2 text-xs font-medium shadow-black/40 transition-all duration-200 relative flex items-center justify-center overflow-hidden ${
                    isLeftCollapsed ? 'w-7 px-0 cursor-copy' : 'flex-1 px-3'
                  }`}
                >
                  {isLeftCollapsed && (showSettings ? <X size={14} className="flex-shrink-0" /> : <Plus size={14} className="flex-shrink-0" />)}
                  <span className={`whitespace-nowrap overflow-hidden ${isLeftCollapsed ? 'hidden' : 'inline'}`}>
                    {showSettings ? 'Close' : 'New Scene'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {showSettings && !isLeftCollapsed ? (
                <SettingsPanel onClose={() => setSettingsTab(null)} />
              ) : (
                <SceneList isCollapsed={isLeftCollapsed} onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)} />
              )}
            </div>
          </div>
          <div className={`py-2 flex gap-2 ${isLeftCollapsed ? 'border-t-0 pl-3 pr-2 justify-start flex-col items-start' : 'border-t border-[var(--color-border)] px-3 justify-center items-center'}`}>
            <button
              onClick={() => window.open('/docs', '_blank')}
              className={`kbd p-0 flex items-center justify-center shrink-0 rounded-md transition-all ${
                isLeftCollapsed ? 'w-8 h-8' : 'w-8 h-8'
              }`}
              data-tooltip="Docs"
              data-tooltip-pos={isLeftCollapsed ? 'right' : 'top'}
            >
              <Bookmark size={15} />
            </button>
            {project.outputMode === 'mp4' ? (
              <button
                onClick={openExportModal}
                disabled={scenes.length === 0}
                className={`kbd font-bold bg-[#e84545] border-[#e84545] shadow-[#800] text-white disabled:opacity-40 flex items-center justify-center transition-all ${
                  isLeftCollapsed ? 'w-8 h-8 p-0 rounded-md' : 'flex-1 h-8 px-3 text-[13px]'
                }`}
                data-tooltip={isLeftCollapsed ? 'Export MP4' : ''}
                data-tooltip-pos={isLeftCollapsed ? 'right' : 'bottom'}
              >
                <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                  <span className={`transition-all duration-200 flex items-center justify-center ${isLeftCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-0 absolute'}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                    </svg>
                  </span>
                  <span className={`transition-all duration-200 whitespace-nowrap ${isLeftCollapsed ? 'opacity-0 scale-0 absolute' : 'opacity-100 scale-100'}`}>
                    Export
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => publishProject()}
                disabled={scenes.length === 0 || isPublishing}
                className={`kbd font-bold bg-[#3b82f6] border-[#3b82f6] shadow-[#1e3a8a] text-white disabled:opacity-40 flex items-center justify-center transition-all ${
                  isLeftCollapsed ? 'w-8 h-8 p-0 rounded-md' : 'flex-1 h-8 px-3 text-[13px]'
                }`}
                data-tooltip={isLeftCollapsed ? 'Publish' : ''}
                data-tooltip-pos={isLeftCollapsed ? 'right' : 'bottom'}
              >
                {isPublishing ? (
                  <span className="animate-pulse">Publishing...</span>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span className={`transition-all duration-200 flex items-center justify-center ${isLeftCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-0 absolute'}`}>
                      🌐
                    </span>
                    <span className={`transition-all duration-200 ${isLeftCollapsed ? 'opacity-0 scale-0 absolute' : 'opacity-100 scale-100'}`}>
                      {publishedUrl ? 'Update' : 'Publish'}
                    </span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Left resize handle (Absolute) */}
        {!isLeftCollapsed && (
          <div
            className="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-[200]"
            style={{
              cursor: 'col-resize',
              left: isLeftCollapsed ? 64 : leftWidth
            }}
            onMouseDown={(e) => startPanelDrag(e, 'left')}
          />
        )}

        {/* Center — Preview */}
        <div className="flex-1 flex flex-col bg-[var(--color-bg)] min-w-0 relative z-[100] overflow-hidden">
          <PreviewPlayer />
          {(editingAgentId || isCreatingAgent) && <AgentEditorOverlay />}
        </div>

        {/* Right resize handle (Absolute) */}
        <div
          className="absolute top-0 bottom-0 w-1.5 translate-x-1/2 hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-[200]"
          style={{
            cursor: 'col-resize',
            right: isChatOpen ? rightWidth + chatWidth : rightWidth
          }}
          onMouseDown={(e) => startPanelDrag(e, 'right')}
        />

        {/* Right — Editor */}
        <div
          className="flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-panel)] overflow-y-auto"
          style={{ width: rightWidth }}
        >
          <SceneEditor />
        </div>

        {/* Chat resize handle */}
        {isChatOpen && (
          <div
            className="absolute top-0 bottom-0 w-1.5 translate-x-1/2 hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-[200]"
            style={{
              cursor: 'col-resize',
              right: chatWidth
            }}
            onMouseDown={(e) => startPanelDrag(e, 'chat')}
          />
        )}

        {/* Chat Panel */}
        {isChatOpen && (
          <div
            className="flex-shrink-0 border-l border-[var(--color-border)] overflow-hidden"
            style={{ width: chatWidth }}
          >
            <ChatPanel />
          </div>
        )}
      </div>

      {/* Modals */}
      <PermissionDialog />
      {isExportModalOpen && <ExportModal />}

      {showPublishPanel && publishedUrl && (
        <PublishPanel url={publishedUrl} onClose={() => setShowPublishPanel(false)} />
      )}

      {/* Output mode switch modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
              Switch to {pendingMode === 'mp4' ? '🎬 MP4 Export' : '🌐 Interactive'} mode?
            </h2>
            {pendingMode === 'mp4' ? (
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                <strong className="text-[var(--color-text-primary)]">MP4 Export:</strong> Download a video file. Best for social media, presentations, and simple website embeds. Scenes play linearly in order.
                <br /><br />
                Your interactive elements are preserved — you can switch back anytime.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                <strong className="text-[var(--color-text-primary)]">Interactive:</strong> Publish a hosted link your clients embed on their website. Supports branching, hotspots, quizzes, and pause gates. Best for onboarding docs and explainer content.
                <br /><br />
                Your MP4 export settings are preserved — you can switch back anytime.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={confirmModeSwitch}
                className="kbd flex-1 h-9 text-sm font-bold bg-[#e84545] border-[#e84545] text-white shadow-[#800]"
              >
                Switch mode
              </button>
              <button
                onClick={cancelModeSwitch}
                className="kbd flex-1 h-9 text-sm font-bold text-[var(--color-text-muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

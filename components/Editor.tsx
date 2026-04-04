'use client'

import { useEffect, useRef, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import SceneList from './SceneList'
import ProjectPanel from './ProjectPanel'
import PreviewPlayer from './PreviewPlayer'
import SceneEditor from './SceneEditor'
import ExportModal from './ExportModal'
import PublishPanel from './PublishPanel'
import PermissionDialog from './PermissionDialog'
import SettingsPanel from './SettingsPanel'
import AgentEditorOverlay from './settings/AgentEditorOverlay'
import MediaLibrary from './MediaLibrary'
import LayersTab from './tabs/LayersTab'
import {
  Settings,
  PanelLeft,
  Plus,
  X,
  FolderOpen,
  Layers,
  Image,
  Infinity as AgentIcon,
  Download,
  Globe,
  Clapperboard,
  Undo2,
  Redo2,
  Minus,
  RotateCcw,
  Shrink,
  Expand,
} from 'lucide-react'
import { resolveUIFontStack } from '@/lib/ui-font'

export default function Editor() {
  const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
  const useElectronLayout = true
  const {
    scenes,
    addScene,
    updateScene,
    isExportModalOpen,
    openExportModal,
    globalStyle,
    project,
    setOutputMode,
    publishProject,
    isPublishing,
    publishError,
    showPublishPanel,
    setShowPublishPanel,
    publishedUrl,
    selectedSceneId,
    settingsTab,
    setSettingsTab,
    editingAgentId,
    isCreatingAgent,
    isPreviewFullscreen,
    setPreviewFullscreen,
    rightPanelTab,
    setRightPanelTab,
    previewZoom,
  } = useVideoStore()
  const [mounted, setMounted] = useState(false)
  const [leftWidth, setLeftWidth] = useState(280)
  const [rightWidth, setRightWidth] = useState(340)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [showProjectPanel, setShowProjectPanel] = useState(false)
  const [electronLeftTab, setElectronLeftTab] = useState<'scenes' | 'media' | 'layers'>('scenes')
  const showSettings = settingsTab !== null
  const selectedScene = scenes.find((s) => s.id === selectedSceneId)

  const panelDrag = useRef<{
    side: 'left' | 'right'
    startX: number
    startW: number
  } | null>(null)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const showSettingsRef = useRef(showSettings)
  const electronLeftTabRef = useRef(electronLeftTab)
  showSettingsRef.current = showSettings
  electronLeftTabRef.current = electronLeftTab

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = panelDrag.current
      if (!d) return
      e.preventDefault()
      const dx = e.clientX - d.startX
      if (d.side === 'left') {
        const minW =
          showSettingsRef.current || (useElectronLayout && electronLeftTabRef.current === 'layers') ? 340 : 250
        setLeftWidth(Math.max(minW, Math.min(520, d.startW + dx)))
      } else if (d.side === 'right') {
        setRightWidth(Math.max(340, Math.min(600, d.startW - dx)))
      }
    }
    const onUp = () => {
      if (!panelDrag.current) return
      panelDrag.current = null
      setIsDraggingPanel(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  useEffect(() => {
    if (showSettings) {
      setIsLeftCollapsed(false)
      if (leftWidth < 280) {
        setLeftWidth(280)
      }
    }
    if (useElectronLayout && electronLeftTab === 'layers') {
      setIsLeftCollapsed(false)
      if (leftWidth < 340) {
        setLeftWidth(340)
      }
    }
  }, [showSettings, useElectronLayout, electronLeftTab, leftWidth])

  const startPanelDrag = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault()
    panelDrag.current = {
      side,
      startX: e.clientX,
      startW: side === 'left' ? leftWidth : rightWidth,
    }
    setIsDraggingPanel(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const { saveProjectToDb, fetchProjectList, loadProject, projectList } = useVideoStore()
  const sendPreviewCommand = (action: 'undo' | 'redo' | 'zoom_in' | 'zoom_out' | 'zoom_reset') => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('cench-preview-command', { detail: { action } }))
  }

  useEffect(() => {
    setMounted(true)
    // Prefer the project id from persisted Zustand state so we don't swap to a different
    // "most recent" list item and lose agent-written scenes in the DB for this project.
    const loadInitialProject = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const persistedId = useVideoStore.getState().project?.id
          const r = await fetch('/api/projects')
          const list: any[] = r.ok ? await r.json() : []
          if (list.length === 0) {
            useVideoStore.getState()._setDbLoadComplete(true)
            return
          }
          const ids = new Set(list.map((p: { id: string }) => p.id))
          const targetId = persistedId && ids.has(persistedId) ? persistedId : list[0].id
          await useVideoStore.getState().loadProject(targetId)
          if (useVideoStore.getState()._dbLoadComplete) return
        } catch {
          // fetch itself failed
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000))
      }
      console.warn('Failed to load project from DB after 3 attempts — auto-save disabled until next successful load')
    }
    loadInitialProject()
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
    const handler = () => {
      saveProjectToDb()
    }
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
    root.style.setProperty('--font-global', globalStyle.fontOverride ?? globalStyle.font ?? 'Geist')
    root.style.setProperty('--font-ui', resolveUIFontStack(globalStyle))
    if (useElectronLayout) root.classList.add('electron-app')
    else root.classList.remove('electron-app')
  }, [
    globalStyle.theme,
    globalStyle.font,
    globalStyle.fontOverride,
    globalStyle.uiTypography,
    globalStyle.uiFontFamily,
  ])

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
    <div className="flex flex-col h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] [font-family:var(--font-ui)] overflow-hidden select-none">
      {useElectronLayout && (
        <header
          className={`h-10 border-b border-[var(--color-border)] bg-[var(--color-panel)] grid grid-cols-[auto_1fr_auto] items-center px-3 gap-2 ${isElectron ? 'pl-20' : 'pl-3'}`}
          style={isElectron ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
        >
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsLeftCollapsed(!isLeftCollapsed)
              }}
              data-tooltip={isLeftCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="no-style electron-titlebar-icon w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <PanelLeft size={17} />
            </button>
            <button
              onClick={() => setPreviewFullscreen(!isPreviewFullscreen)}
              data-tooltip={isPreviewFullscreen ? 'Leave Fullscreen' : 'Fullscreen'}
              className="no-style electron-titlebar-icon w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {isPreviewFullscreen ? <Shrink size={16} /> : <Expand size={16} />}
            </button>
          </div>
          <div className="justify-self-center flex items-center gap-2 min-w-0 max-w-[60vw]">
            <button
              onClick={() => sendPreviewCommand('undo')}
              data-tooltip="Undo"
              className="no-style electron-titlebar-icon w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={() => sendPreviewCommand('redo')}
              data-tooltip="Redo"
              className="no-style electron-titlebar-icon w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <Redo2 size={15} />
            </button>
            <span
              className="truncate text-[12px] font-medium text-[var(--color-text-muted)] px-1.5"
              style={isElectron ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
              title={project.name || 'Untitled Project'}
            >
              {project.name || 'Untitled Project'}
            </span>
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <button
                onClick={() => sendPreviewCommand('zoom_out')}
                data-tooltip="Zoom Out"
                className="no-style electron-titlebar-icon w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <Minus size={15} />
              </button>
              <button
                type="button"
                onClick={() => sendPreviewCommand('zoom_reset')}
                data-tooltip="Reset to 100%"
                className="no-style electron-titlebar-icon h-6 min-w-[2.5rem] px-1.5 rounded-md flex items-center justify-center shrink-0 transition-colors text-[12px] font-medium text-[var(--color-text-muted)] tabular-nums"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                onClick={() => sendPreviewCommand('zoom_in')}
                data-tooltip="Zoom In"
                className="no-style electron-titlebar-icon w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <Plus size={15} />
              </button>
              <button
                onClick={() => sendPreviewCommand('zoom_reset')}
                data-tooltip="Reset"
                className="no-style electron-titlebar-icon w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 justify-self-end">
            <button
              onClick={() => setRightPanelTab('prompt')}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                rightPanelTab === 'prompt' ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
              }`}
              data-tooltip="Agent"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <AgentIcon size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => {
                setSettingsTab(showSettings ? null : 'general')
                if (!showSettings) setShowProjectPanel(false)
              }}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                showSettings ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
              }`}
              data-tooltip="Settings"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <Settings size={17} />
            </button>
          </div>
        </header>
      )}

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Drag overlay — prevents iframes from stealing mouse events during resize */}
        {isDraggingPanel && <div className="fixed inset-0 z-[9999]" style={{ cursor: 'col-resize' }} />}
        {/* Left — Scene List */}
        <div
          className={`flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col transition-all duration-200 ease-in-out relative ${
            isLeftCollapsed
              ? useElectronLayout
                ? 'z-[101] overflow-hidden pointer-events-none'
                : 'z-[103] overflow-visible'
              : 'z-[101] overflow-hidden'
          } ${isPreviewFullscreen ? 'overflow-hidden' : ''}`}
          style={{
            width: isPreviewFullscreen ? 0 : isLeftCollapsed ? (useElectronLayout ? 0 : 64) : leftWidth,
            visibility: isPreviewFullscreen || (useElectronLayout && isLeftCollapsed) ? 'hidden' : 'visible',
          }}
        >
          <div className={`flex-1 relative flex flex-col ${isLeftCollapsed ? 'overflow-visible' : 'overflow-hidden'}`}>
            {/* Sidebar header */}
            <div
              className={`pt-2 pb-2 flex-shrink-0 flex justify-between gap-2 ${isLeftCollapsed ? 'border-b-0 pl-3 pr-2' : 'px-3'}`}
            >
              <div
                className={`flex gap-2 ${isLeftCollapsed ? 'flex-col items-start' : `flex-row items-center ${useElectronLayout ? 'justify-center w-full' : 'flex-1'}`}`}
              >
                {!useElectronLayout && (
                  <>
                    <button
                      onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                      data-tooltip={isLeftCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                      data-tooltip-pos={isLeftCollapsed ? 'right' : 'bottom-right'}
                      className="kbd w-7 h-7 p-0 flex items-center justify-center shrink-0"
                    >
                      <PanelLeft size={15} style={{ color: 'var(--kbd-text)' }} />
                    </button>

                    <button
                      onClick={() => {
                        setShowProjectPanel(!showProjectPanel)
                        if (!showProjectPanel) setSettingsTab(null)
                      }}
                      className={`kbd w-7 h-7 p-0 flex items-center justify-center shrink-0 transition-all duration-200 ${showProjectPanel ? 'border-[var(--color-accent)]' : ''}`}
                      data-tooltip="Projects"
                      data-tooltip-pos={isLeftCollapsed ? 'right' : 'bottom'}
                    >
                      <FolderOpen size={15} style={{ color: 'var(--kbd-text)' }} />
                    </button>

                    <button
                      onClick={() => {
                        setSettingsTab(showSettings ? null : 'general')
                        if (!showSettings) setShowProjectPanel(false)
                      }}
                      className={`kbd w-7 h-7 p-0 flex items-center justify-center shrink-0 transition-all duration-200 ${showSettings ? 'border-[var(--color-accent)]' : ''}`}
                      data-tooltip="Settings"
                      data-tooltip-pos={isLeftCollapsed ? 'right' : 'bottom'}
                    >
                      <Settings size={15} style={{ color: 'var(--kbd-text)' }} />
                    </button>
                  </>
                )}
                {useElectronLayout && (
                  <>
                    <button
                      onClick={() => {
                        setElectronLeftTab('scenes')
                        setShowProjectPanel(false)
                        setSettingsTab(null)
                      }}
                      className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        electronLeftTab === 'scenes' && !showProjectPanel && !showSettings
                          ? 'text-[var(--color-accent)] electron-titlebar-icon-active'
                          : ''
                      }`}
                      data-tooltip="Scenes"
                      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                      <Clapperboard size={19} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        setElectronLeftTab('media')
                        setShowProjectPanel(false)
                        setSettingsTab(null)
                      }}
                      className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        electronLeftTab === 'media' && !showProjectPanel && !showSettings
                          ? 'text-[var(--color-accent)] electron-titlebar-icon-active'
                          : ''
                      }`}
                      data-tooltip="Media"
                      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                      <Image size={19} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        setElectronLeftTab('layers')
                        setShowProjectPanel(false)
                        setSettingsTab(null)
                      }}
                      className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        electronLeftTab === 'layers' && !showProjectPanel && !showSettings
                          ? 'text-[var(--color-accent)] electron-titlebar-icon-active'
                          : ''
                      }`}
                      data-tooltip="Layers"
                      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                      <Layers size={19} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        setShowProjectPanel(!showProjectPanel)
                        if (!showProjectPanel) setSettingsTab(null)
                      }}
                      className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        showProjectPanel ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                      }`}
                      data-tooltip="Projects"
                      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                      <FolderOpen size={19} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        if (project.outputMode === 'mp4') openExportModal()
                        else publishProject()
                      }}
                      className="no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
                      data-tooltip={project.outputMode === 'mp4' ? 'Export' : 'Publish'}
                      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                      {project.outputMode === 'mp4' ? (
                        <Download size={19} strokeWidth={1.5} />
                      ) : (
                        <Globe size={19} strokeWidth={1.5} />
                      )}
                    </button>
                  </>
                )}
                {!useElectronLayout && (
                  <button
                    onClick={() => {
                      if (showSettings) {
                        setSettingsTab(null)
                      } else if (showProjectPanel) {
                        setShowProjectPanel(false)
                      } else {
                        addScene()
                      }
                    }}
                    className={`kbd h-7 !py-0 gap-2 text-xs font-medium shadow-black/40 transition-all duration-200 relative flex items-center justify-center overflow-hidden ${
                      isLeftCollapsed ? 'w-7 px-0 cursor-copy' : 'flex-1 px-3'
                    }`}
                    {...(isLeftCollapsed
                      ? {
                          'data-tooltip': showSettings || showProjectPanel ? 'Close' : 'New Scene',
                          'data-tooltip-pos': 'right',
                        }
                      : {})}
                  >
                    {isLeftCollapsed &&
                      (showSettings || showProjectPanel ? (
                        <X size={14} className="flex-shrink-0" />
                      ) : (
                        <Plus size={14} className="flex-shrink-0" />
                      ))}
                    <span className={`whitespace-nowrap overflow-hidden ${isLeftCollapsed ? 'hidden' : 'inline'}`}>
                      {showSettings || showProjectPanel ? 'Close' : 'New Scene'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {showProjectPanel && !isLeftCollapsed ? (
                <ProjectPanel onClose={() => setShowProjectPanel(false)} />
              ) : showSettings && !isLeftCollapsed ? (
                <SettingsPanel onClose={() => setSettingsTab(null)} />
              ) : useElectronLayout && electronLeftTab === 'media' ? (
                <MediaLibrary />
              ) : useElectronLayout && electronLeftTab === 'layers' ? (
                <div className="min-h-0 h-full flex flex-col overflow-hidden">
                  {selectedScene ? (
                    <LayersTab scene={selectedScene} />
                  ) : (
                    <div className="flex items-center justify-center h-32 text-[#6b6b7a] text-xs p-4 text-center">
                      Select or create a scene to edit layers
                    </div>
                  )}
                </div>
              ) : (
                <SceneList
                  isCollapsed={isLeftCollapsed}
                  onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                />
              )}
            </div>
          </div>
          <div
            className={`py-2 flex gap-2 ${isLeftCollapsed ? 'border-t-0 pl-3 pr-2 justify-start flex-col items-start' : 'border-t border-[var(--color-border)] px-3 justify-center items-center'}`}
          >
            {!useElectronLayout && (
              <button
                onClick={() => window.open('/docs', '_blank')}
                className={`kbd p-0 flex items-center justify-center shrink-0 rounded-md transition-all ${
                  isLeftCollapsed ? 'w-8 h-8' : 'w-8 h-8'
                }`}
                data-tooltip="Docs"
                data-tooltip-pos={isLeftCollapsed ? 'right' : 'top'}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </button>
            )}
            {useElectronLayout && electronLeftTab === 'scenes' && !showProjectPanel && !showSettings && (
              <button
                onClick={() => addScene()}
                className={`kbd h-8 !py-0 gap-2 text-xs font-medium shadow-black/40 transition-all duration-200 relative flex items-center justify-center overflow-hidden ${
                  isLeftCollapsed ? 'w-8 px-0' : 'w-full px-3'
                }`}
              >
                {isLeftCollapsed && <Plus size={14} strokeWidth={1.5} className="flex-shrink-0" />}
                <span className={`whitespace-nowrap overflow-hidden ${isLeftCollapsed ? 'hidden' : 'inline'}`}>
                  New Scene
                </span>
              </button>
            )}
            {!useElectronLayout &&
              (project.outputMode === 'mp4' ? (
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
                    <span
                      className={`transition-all duration-200 flex items-center justify-center ${isLeftCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-0 absolute'}`}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                    </span>
                    <span
                      className={`transition-all duration-200 whitespace-nowrap ${isLeftCollapsed ? 'opacity-0 scale-0 absolute' : 'opacity-100 scale-100'}`}
                    >
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
                      <span
                        className={`transition-all duration-200 flex items-center justify-center ${isLeftCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-0 absolute'}`}
                      >
                        🌐
                      </span>
                      <span
                        className={`transition-all duration-200 ${isLeftCollapsed ? 'opacity-0 scale-0 absolute' : 'opacity-100 scale-100'}`}
                      >
                        {publishedUrl ? 'Update' : 'Publish'}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            {!useElectronLayout && publishError && !isLeftCollapsed && (
              <p className="text-[10px] text-red-400 mt-1 px-1 leading-tight truncate" title={publishError}>
                {publishError}
              </p>
            )}
          </div>
        </div>

        {/* Left resize handle (Absolute) */}
        {!isLeftCollapsed && !isPreviewFullscreen && (
          <div
            className="absolute top-0 bottom-0 w-2 -translate-x-1/2 hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-[200]"
            style={{
              cursor: 'col-resize',
              left: isLeftCollapsed ? 64 : leftWidth,
            }}
            onMouseDown={(e) => startPanelDrag(e, 'left')}
          />
        )}

        {/* Center — Preview */}
        <div className="flex-1 flex flex-col bg-[var(--color-bg)] min-w-0 relative z-[90] overflow-visible">
          <PreviewPlayer />
          {(editingAgentId || isCreatingAgent) && <AgentEditorOverlay />}
        </div>

        {/* Right resize handle (Absolute) */}
        {!isPreviewFullscreen && (
          <div
            className="absolute top-0 bottom-0 w-2 translate-x-1/2 hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-[200]"
            style={{
              cursor: 'col-resize',
              right: rightWidth,
            }}
            onMouseDown={(e) => startPanelDrag(e, 'right')}
          />
        )}

        {/* Right — Editor (min-h-0 + overflow-hidden so Layers tab pins stack to panel bottom) */}
        {!isPreviewFullscreen && (
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)] relative z-[101]"
            style={{ width: rightWidth }}
          >
            <SceneEditor />
          </div>
        )}
      </div>

      {/* Modals */}
      <PermissionDialog />
      {isExportModalOpen && <ExportModal />}

      {showPublishPanel && publishedUrl && (
        <PublishPanel url={publishedUrl} onClose={() => setShowPublishPanel(false)} />
      )}

      {useElectronLayout && (
        <footer className="h-3 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1">
          <div className="w-full h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div className="h-full w-[35%] bg-[#e84545] rounded-full animate-pulse" />
          </div>
        </footer>
      )}
    </div>
  )
}

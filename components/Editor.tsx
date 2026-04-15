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
import EditorStatusBar from './EditorStatusBar'
import SettingsPanel from './SettingsPanel'
import AgentEditorOverlay from './settings/AgentEditorOverlay'
import { useRecordingBridge } from '@/hooks/useRecordingBridge'
import MediaLibrary from './MediaLibrary'
import WelcomePageContent from './WelcomePage'
import LayersTab from './tabs/LayersTab'
import {
  Settings,
  PanelLeft,
  PanelBottomOpen,
  PanelBottomClose,
  Plus,
  X,
  FolderOpen,
  Layers,
  Download,
  Globe,
  Search,
} from 'lucide-react'
import { CenchLogo as AgentIcon } from './icons/CenchLogo'
import { resolveUIFontStack } from '@/lib/ui-font'
// Custom SVG icon for media tab
function MediaIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.1935 16.793C20.8437 19.2739 20.6689 20.5143 19.7717 21.2572C18.8745 22 17.5512 22 14.9046 22H9.09536C6.44881 22 5.12553 22 4.22834 21.2572C3.33115 20.5143 3.15626 19.2739 2.80648 16.793L2.38351 13.793C1.93748 10.6294 1.71447 9.04765 2.66232 8.02383C3.61017 7 5.29758 7 8.67239 7H15.3276C18.7024 7 20.3898 7 21.3377 8.02383C22.0865 8.83268 22.1045 9.98979 21.8592 12" />
      <path d="M19.5617 7C19.7904 5.69523 18.7863 4.5 17.4617 4.5H6.53788C5.21323 4.5 4.20922 5.69523 4.43784 7" />
      <path d="M17.4999 4.5C17.5283 4.24092 17.5425 4.11135 17.5427 4.00435C17.545 2.98072 16.7739 2.12064 15.7561 2.01142C15.6497 2 15.5194 2 15.2588 2H8.74099C8.48035 2 8.35002 2 8.24362 2.01142C7.22584 2.12064 6.45481 2.98072 6.45704 4.00434C6.45727 4.11135 6.47146 4.2409 6.49983 4.5" />
      <circle cx="16.5" cy="11.5" r="1.5" />
      <path d="M19.9999 20L17.1157 17.8514C16.1856 17.1586 14.8004 17.0896 13.7766 17.6851L13.5098 17.8403C12.7984 18.2542 11.8304 18.1848 11.2156 17.6758L7.37738 14.4989C6.6113 13.8648 5.38245 13.8309 4.5671 14.4214L3.24316 15.3803" />
    </svg>
  )
}

const COMMAND_ITEMS: { id: string; label: string; hint?: string; action: string }[] = [
  { id: 'settings', label: 'Settings', hint: 'General settings', action: 'settings' },
  { id: 'agents', label: 'Agents', hint: 'Agent configuration', action: 'agents' },
  { id: 'projects', label: 'Projects', hint: 'Open projects panel', action: 'projects' },
  { id: 'new-scene', label: 'New Scene', hint: 'Add a new scene', action: 'new-scene' },
  { id: 'layers', label: 'Layers', hint: 'Scenes & layers panel', action: 'layers' },
  { id: 'media', label: 'Media', hint: 'Media library', action: 'media' },
  { id: 'export', label: 'Export / Publish', hint: 'Export or publish project', action: 'export' },
]

function CommandPalette({ 
  onClose, 
  onAction,
  projects = []
}: { 
  onClose: () => void; 
  onAction: (action: string, id?: string) => void;
  projects?: { id: string, name: string }[]
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isProjectSearch = projects.length > 0

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = isProjectSearch 
    ? projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : COMMAND_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.hint && item.hint.toLowerCase().includes(query.toLowerCase()))
      )

  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      const item = filtered[selectedIndex]
      if (isProjectSearch) {
        onAction('open-project', (item as any).id)
      } else {
        onAction((item as any).action)
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-transparent" onClick={onClose} />
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[10000] w-[min(540px,90vw)] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
          <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder={isProjectSearch ? "Search projects..." : "Search commands..."}
            className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto px-1.5 pb-2 custom-scrollbar">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-[var(--color-text-muted)]">
              {isProjectSearch ? "No projects found" : "No results found"}
            </p>
          )}
          {filtered.map((item: any, i) => (
            <div
              key={item.id}
              onClick={() => isProjectSearch ? onAction('open-project', item.id) : onAction(item.action)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex items-center gap-3 px-2 py-1.5 cursor-pointer transition-colors rounded-md ${
                i === selectedIndex ? 'bg-white/[0.08]' : ''
              }`}
            >
              <span className="text-xs font-medium text-[var(--color-text-primary)] flex-1">{isProjectSearch ? item.name : item.label}</span>
              {!isProjectSearch && item.hint && (
                <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold opacity-60">
                  {item.hint}
                </span>
              )}
              {isProjectSearch && (
                <span className="text-[10px] text-[var(--color-text-muted)] opacity-40">Open</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function Editor({ showWelcome, onEnterEditor }: { showWelcome?: boolean; onEnterEditor?: () => void }) {
  const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
  const useElectronLayout = true
  // Bridge store-driven recording commands to the useScreenRecorder hook
  useRecordingBridge()
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
    projectLoadFailed,
    lastGenerationError,
    timelineHeight,
    setTimelineHeight,
  } = useVideoStore()
  const [mounted, setMounted] = useState(false)
  const [leftWidth, setLeftWidth] = useState(260)
  const [rightWidth, setRightWidth] = useState(340)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [showProjectPanel, setShowProjectPanel] = useState(false)
  const [electronLeftTab, setElectronLeftTab] = useState<'media' | 'layers'>('layers')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
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

  // Cmd+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = panelDrag.current
      if (!d) return
      e.preventDefault()
      const dx = e.clientX - d.startX
      if (d.side === 'left') {
        const minW =
          showSettingsRef.current ? 240 : 140
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
      if (leftWidth < 240) {
        setLeftWidth(240)
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
      useVideoStore.setState({ projectLoadFailed: true })
    }
    loadInitialProject()
  }, [])

  // Auto-save to DB every 30 seconds when there are changes
  // Also attempt recovery if initial load failed — retry loading periodically
  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(async () => {
      const state = useVideoStore.getState()
      if (state.projectLoadFailed && !state._dbLoadComplete && state.project?.id) {
        // Attempt to recover from load failure
        try {
          const res = await fetch(`/api/projects/${state.project.id}`, { method: 'HEAD' })
          if (res.ok) {
            // Server is reachable — enable auto-save so edits aren't lost
            useVideoStore.setState({ _dbLoadComplete: true, projectLoadFailed: false })
            console.log('[Editor] Server reachable — auto-save re-enabled')
          }
        } catch { /* still offline */ }
        return
      }
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
    root.classList.remove('light-theme', 'blue-theme')
    if (globalStyle.theme === 'light') {
      root.classList.add('light-theme')
    } else if (globalStyle.theme === 'blue') {
      root.classList.add('blue-theme')
    }
    root.style.setProperty('--font-global', globalStyle.fontOverride ?? globalStyle.font ?? 'Geist')
    root.style.setProperty('--font-ui', resolveUIFontStack(globalStyle))
    const scaleMap = ['0.9', '1', '1.1', '1.2']
    root.style.setProperty('--ui-zoom', scaleMap[globalStyle.uiTextSize ?? 1] ?? '1')
    if (useElectronLayout) root.classList.add('electron-app')
    else root.classList.remove('electron-app')
  }, [
    globalStyle.theme,
    globalStyle.font,
    globalStyle.fontOverride,
    globalStyle.uiTypography,
    globalStyle.uiFontFamily,
    globalStyle.uiTextSize,
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
    <div className="flex flex-col h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] [font-family:var(--font-ui)] overflow-hidden" style={{ zoom: 'var(--ui-zoom, 1)' }}>
      {projectLoadFailed && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm shrink-0">
          <span>Could not connect to server. Changes won't be saved.</span>
          <span
            className="underline cursor-pointer hover:text-red-300"
            onClick={async () => {
              useVideoStore.setState({ projectLoadFailed: false })
              const persistedId = useVideoStore.getState().project?.id
              try {
                const r = await fetch('/api/projects')
                const list: any[] = r.ok ? await r.json() : []
                if (list.length > 0) {
                  const ids = new Set(list.map((p: { id: string }) => p.id))
                  const targetId = persistedId && ids.has(persistedId) ? persistedId : list[0].id
                  await useVideoStore.getState().loadProject(targetId)
                } else {
                  useVideoStore.getState()._setDbLoadComplete(true)
                }
              } catch {
                useVideoStore.setState({ projectLoadFailed: true })
              }
            }}
          >
            Retry
          </span>
        </div>
      )}
      {lastGenerationError && (
        <div className="flex items-center justify-between px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 text-orange-400 text-sm shrink-0">
          <span>Generation failed: {lastGenerationError}</span>
          <span
            className="underline cursor-pointer hover:text-orange-300"
            onClick={() => useVideoStore.setState({ lastGenerationError: null })}
          >
            Dismiss
          </span>
        </div>
      )}
      {useElectronLayout && (
        <header
          className={`h-12 border-b border-[var(--color-border)] bg-[var(--color-panel)] grid grid-cols-[auto_1fr_auto] items-center px-3 gap-2 ${isElectron ? 'pl-20' : 'pl-3'}`}
          style={{ color: 'var(--color-text-muted)', ...(isElectron ? { WebkitAppRegion: 'drag' } as React.CSSProperties : {}) }}
        >
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsLeftCollapsed(!isLeftCollapsed)
              }}
              data-tooltip={isLeftCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <PanelLeft size={20} strokeWidth={1.5} />
            </button>
          </div>
          <div
            className="justify-self-center flex min-w-0 max-w-[min(60vw,360px)] items-center justify-center gap-2 px-2 h-full"
            style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
          >
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="no-style flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
              aria-label="Search"
              data-tooltip="Search"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <Search size={18} strokeWidth={2} />
            </button>
            <span
              className="min-w-0 truncate text-sm font-normal text-[var(--color-text-muted)]"
              title={project?.name?.trim() || 'Untitled project'}
            >
              {showWelcome
                ? project?.name?.trim() || 'Cench Studio'
                : project?.name?.trim() || 'Untitled project'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 justify-self-end">
            <button
              onClick={() => setTimelineHeight(timelineHeight > 0 ? 0 : 200)}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-8 h-8 rounded-md flex items-center justify-center transition-colors`}
              data-tooltip="Timeline"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              {timelineHeight > 0
                ? <PanelBottomOpen size={20} strokeWidth={1.5} />
                : <PanelBottomClose size={20} strokeWidth={1.5} />
              }
            </button>
            <button
              onClick={() => setRightPanelTab(rightPanelTab === 'prompt' ? null : 'prompt')}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                rightPanelTab === 'prompt' ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
              }`}
              data-tooltip="Agent"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <AgentIcon size={40} />
            </button>
            <button
              onClick={() => {
                if (useElectronLayout) {
                  if (project.outputMode === 'mp4') openExportModal()
                  else publishProject()
                  return
                }
                setSettingsTab(showSettings ? null : 'general')
                if (!showSettings) setShowProjectPanel(false)
              }}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                showSettings ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
              }`}
              data-tooltip={useElectronLayout ? (project.outputMode === 'mp4' ? 'Export' : 'Publish') : 'Settings'}
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              {useElectronLayout ? (
                project.outputMode === 'mp4' ? (
                  <Download size={20} />
                ) : (
                  <Globe size={20} />
                )
              ) : (
                <Settings size={20} />
              )}
            </button>
          </div>
        </header>
      )}

      {showWelcome ? (
        <div className="flex-1 overflow-hidden relative flex">
          {(showSettings || showProjectPanel) && (
            <div className="w-[300px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] z-50 flex flex-col">
              <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 justify-between shrink-0">
                <span className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {showSettings ? 'Settings' : 'Projects'}
                </span>
                <button 
                  onClick={() => { setSettingsTab(null); setShowProjectPanel(false); }}
                  className="p-1 hover:bg-white/[0.05] rounded-md transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {showSettings ? (
                  <SettingsPanel onClose={() => setSettingsTab(null)} />
                ) : (
                  <ProjectPanel onClose={() => setShowProjectPanel(false)} />
                )}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto">
            <WelcomePageContent
              onEnterEditor={onEnterEditor ?? (() => {})}
              onOpenSearch={() => setShowCommandPalette(true)}
            />
          </div>
        </div>
      ) : (
        <>
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
              className={`h-12 flex-shrink-0 flex justify-between gap-2 items-center ${isLeftCollapsed ? 'border-b-0 pl-3 pr-2' : 'px-3'}`}
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
                      className="kbd w-8 h-8 p-0 flex items-center justify-center shrink-0"
                    >
                      <PanelLeft size={17} style={{ color: 'var(--kbd-text)' }} />
                    </button>

                    <button
                      onClick={() => {
                        setShowProjectPanel(!showProjectPanel)
                        if (!showProjectPanel) setSettingsTab(null)
                      }}
                      className={`kbd w-8 h-8 p-0 flex items-center justify-center shrink-0 transition-all duration-200 ${showProjectPanel ? 'border-[var(--color-accent)]' : ''}`}
                      data-tooltip="Projects"
                      data-tooltip-pos={isLeftCollapsed ? 'right' : 'bottom'}
                    >
                      <FolderOpen size={17} style={{ color: 'var(--kbd-text)' }} />
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
                      <MediaIcon size={19} />
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
                      data-tooltip="Scenes & layers"
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
                        setSettingsTab(showSettings ? null : 'general')
                        if (!showSettings) setShowProjectPanel(false)
                      }}
                      className="no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
                      data-tooltip="Settings"
                      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                      <Settings size={19} strokeWidth={1.5} />
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
                    className={`kbd h-7 !py-0 gap-2 text-sm font-medium shadow-black/40 transition-all duration-200 relative flex items-center justify-center overflow-hidden ${
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
                scenes.length === 0 ? (
                  <div className="flex min-h-0 h-full flex-col gap-2 overflow-hidden p-3">
                    <button
                      type="button"
                      onClick={() => addScene()}
                      className="kbd flex h-8 w-full items-center justify-center gap-2 px-3 text-sm font-medium shadow-black/40"
                    >
                      <Plus size={14} strokeWidth={1.5} />
                      New Scene
                    </button>
                    <p className="text-center text-[11px] text-[var(--color-text-muted)]">No scenes yet.</p>
                  </div>
                ) : (
                  <div className="flex min-h-0 h-full flex-col overflow-hidden">
                    <LayersTab
                      scene={selectedScene ?? scenes[0]!}
                      showScenesSection
                      isLeftCollapsed={isLeftCollapsed}
                    />
                  </div>
                )
              ) : (
                <SceneList
                  isCollapsed={isLeftCollapsed}
                  onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Left resize handle (Absolute) */}
        {!isLeftCollapsed && !isPreviewFullscreen && (
          <div
            className="absolute top-0 bottom-0 w-3 -translate-x-1/2 hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-[200]"
            style={{
              cursor: 'col-resize',
              left: isLeftCollapsed ? 64 : leftWidth,
            }}
            onMouseDown={(e) => startPanelDrag(e, 'left')}
            onDoubleClick={() => setIsLeftCollapsed(true)}
          />
        )}

        {/* Center — Preview (match top titlebar / panel chrome) */}
        <div className="flex-1 flex flex-col bg-[var(--color-panel)] min-w-0 relative z-[90] overflow-visible">
          <PreviewPlayer />
          {(editingAgentId || isCreatingAgent) && <AgentEditorOverlay />}
        </div>

        {/* Right resize handle (Absolute) */}
        {!isPreviewFullscreen && rightPanelTab && (
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
        {!isPreviewFullscreen && rightPanelTab && (
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)] relative z-[101]"
            style={{ width: rightWidth }}
          >
            <SceneEditor />
          </div>
        )}
      </div>
    </>
  )}

      {/* Modals */}
      <PermissionDialog />
      {isExportModalOpen && <ExportModal />}

      {showPublishPanel && publishedUrl && (
        <PublishPanel url={publishedUrl} onClose={() => setShowPublishPanel(false)} />
      )}

      {useElectronLayout && <EditorStatusBar />}

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          projects={showWelcome ? projectList : []}
          onAction={(action, id) => {
            setShowCommandPalette(false)
            if (action === 'open-project' && id) {
              loadProject(id)
              onEnterEditor?.()
            } else if (action === 'settings') setSettingsTab('general')
            else if (action === 'projects') setShowProjectPanel(true)
            else if (action === 'media') setElectronLeftTab('media')
            else if (action === 'layers') setElectronLeftTab('layers')
            else if (action === 'export') { if (project.outputMode === 'mp4') openExportModal(); else publishProject() }
            else if (action === 'agents') setSettingsTab('agents')
            else if (action === 'new-scene') addScene()
          }}
        />
      )}
    </div>
  )
}

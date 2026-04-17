'use client'

import { useEffect, useRef, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import SceneList from './SceneList'
import ProjectPanel from './ProjectPanel'
import WorkspaceView from './WorkspaceView'
import CustomizeView from './CustomizeView'
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
import Timeline from './timeline'
import SceneGraphEditor from './SceneGraphEditor'
import TransportBar from './TransportBar'
import {
  Settings,
  PanelLeft,
  PanelBottomOpen,
  PanelBottomClose,
  Plus,
  X,
  FolderOpen,
  Layers,
  Package2,
  Download,
  Globe,
  Search,
  SquarePlay,
  Briefcase,
  Film,
  Clapperboard,
  Sparkles,
  Volume2,
  Music,
  Type,
  BarChart3,
  User,
  Boxes,
  Code2,
} from 'lucide-react'
import { CenchLogo as AgentIcon } from './icons/CenchLogo'

function ChatIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 9V7.2C18 6.0799 18 5.51984 17.782 5.09202C17.5903 4.71569 17.2843 4.40973 16.908 4.21799C16.4802 4 15.9201 4 14.8 4H7.2C6.0799 4 5.51984 4 5.09202 4.21799C4.71569 4.40973 4.40973 4.71569 4.21799 5.09202C4 5.51984 4 6.0799 4 7.2V18L8 16M20 20L17.8062 18.5374C17.5065 18.3377 17.3567 18.2378 17.1946 18.167C17.0507 18.1042 16.9 18.0586 16.7454 18.031C16.5713 18 16.3912 18 16.0311 18H11.2C10.0799 18 9.51984 18 9.09202 17.782C8.71569 17.5903 8.40973 17.2843 8.21799 16.908C8 16.4802 8 15.9201 8 14.8V12.2C8 11.0799 8 10.5198 8.21799 10.092C8.40973 9.71569 8.71569 9.40973 9.09202 9.21799C9.51984 9 10.0799 9 11.2 9H16.8C17.9201 9 18.4802 9 18.908 9.21799C19.2843 9.40973 19.5903 9.71569 19.782 10.092C20 10.5198 20 11.0799 20 12.2V20Z" />
    </svg>
  )
}
import { resolveUIFontStack } from '@/lib/ui-font'
import type { LayersStripTabId } from '@/lib/layers-strip-dock'
import type { LayersStripTabId } from '@/lib/layers-strip-dock'
import {
  LAYERS_TAB_DRAG_TYPE,
  LAYERS_STRIP_TAB_LABELS,
  isLayersStripTabId,
  layersStripToCenterTabId,
  parseLayersStripCenterTabId,
} from '@/lib/layers-strip-dock'

function LayerDockTabIcon({ id, size = 14 }: { id: LayersStripTabId; size?: number }) {
  const p = { size, strokeWidth: 1.5 as const }
  switch (id) {
    case 'nodemap':
      return <Layers {...p} />
    case 'scene':
      return <Film {...p} />
    case 'transitions':
      return <Clapperboard {...p} />
    case 'effects':
      return <Sparkles {...p} />
    case 'audio':
      return <Volume2 {...p} />
    case 'sfx':
      return <Music {...p} />
    case 'text':
      return <Type {...p} />
    case 'charts':
      return <BarChart3 {...p} />
    case 'avatar':
      return <User {...p} />
    case 'three':
      return <Boxes {...p} />
    case 'code':
      return <Code2 {...p} />
    default:
      return <Layers {...p} />
  }
}
// Custom SVG icon for media tab
function MediaIcon({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.1935 16.793C20.8437 19.2739 20.6689 20.5143 19.7717 21.2572C18.8745 22 17.5512 22 14.9046 22H9.09536C6.44881 22 5.12553 22 4.22834 21.2572C3.33115 20.5143 3.15626 19.2739 2.80648 16.793L2.38351 13.793C1.93748 10.6294 1.71447 9.04765 2.66232 8.02383C3.61017 7 5.29758 7 8.67239 7H15.3276C18.7024 7 20.3898 7 21.3377 8.02383C22.0865 8.83268 22.1045 9.98979 21.8592 12" />
      <path d="M19.5617 7C19.7904 5.69523 18.7863 4.5 17.4617 4.5H6.53788C5.21323 4.5 4.20922 5.69523 4.43784 7" />
      <path d="M17.4999 4.5C17.5283 4.24092 17.5425 4.11135 17.5427 4.00435C17.545 2.98072 16.7739 2.12064 15.7561 2.01142C15.6497 2 15.5194 2 15.2588 2H8.74099C8.48035 2 8.35002 2 8.24362 2.01142C7.22584 2.12064 6.45481 2.98072 6.45704 4.00434C6.45727 4.11135 6.47146 4.2409 6.49983 4.5" />
      <circle cx="16.5" cy="11.5" r="1.5" />
      <path d="M19.9999 20L17.1157 17.8514C16.1856 17.1586 14.8004 17.0896 13.7766 17.6851L13.5098 17.8403C12.7984 18.2542 11.8304 18.1848 11.2156 17.6758L7.37738 14.4989C6.6113 13.8648 5.38245 13.8309 4.5671 14.4214L3.24316 15.3803" />
    </svg>
  )
}

function PreviewIcon({ size = 16, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M10 8.5V15.5L16 12L10 8.5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SettingsAdjustIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M85.333,170.667c39.765,0,73.173-27.193,82.645-64h322.688c11.782,0,21.333-9.551,21.333-21.333 C512,73.551,502.449,64,490.667,64H167.979c-9.472-36.807-42.88-64-82.645-64C38.202,0,0,38.202,0,85.333 S38.202,170.667,85.333,170.667z M85.333,42.667c23.567,0,42.667,19.099,42.667,42.667S108.901,128,85.333,128 s-42.667-19.099-42.667-42.667S61.766,42.667,85.333,42.667z" />
      <path d="M426.667,341.333c-39.765,0-73.173,27.193-82.645,64H21.333C9.551,405.333,0,414.885,0,426.667S9.551,448,21.333,448 h322.688c9.472,36.807,42.88,64,82.645,64C473.798,512,512,473.798,512,426.667S473.798,341.333,426.667,341.333z M426.667,469.333c-23.567,0-42.667-19.099-42.667-42.667S403.099,384,426.667,384s42.667,19.099,42.667,42.667 S450.234,469.333,426.667,469.333z" />
      <path d="M490.667,234.667H338.645c-9.472-36.807-42.88-64-82.645-64s-73.173,27.193-82.645,64H21.333 C9.551,234.667,0,244.218,0,256s9.551,21.333,21.333,21.333h152.021c9.472,36.807,42.88,64,82.645,64s73.173-27.193,82.645-64 h152.021c11.782,0,21.333-9.551,21.333-21.333S502.449,234.667,490.667,234.667z M256,298.667 c-23.567,0-42.667-19.099-42.667-42.667s19.099-42.667,42.667-42.667s42.667,19.099,42.667,42.667S279.567,298.667,256,298.667z" />
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
  projects = [],
}: {
  onClose: () => void
  onAction: (action: string, id?: string) => void
  projects?: { id: string; name: string }[]
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
    ? projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : COMMAND_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.hint && item.hint.toLowerCase().includes(query.toLowerCase())),
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
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={isProjectSearch ? 'Search projects...' : 'Search commands...'}
            className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto px-1.5 pb-2 custom-scrollbar">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-[var(--color-text-muted)]">
              {isProjectSearch ? 'No projects found' : 'No results found'}
            </p>
          )}
          {filtered.map((item: any, i) => (
            <div
              key={item.id}
              onClick={() => (isProjectSearch ? onAction('open-project', item.id) : onAction(item.action))}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex items-center gap-3 px-2 py-1.5 cursor-pointer transition-colors rounded-md ${
                i === selectedIndex ? 'bg-white/[0.08]' : ''
              }`}
            >
              <span className="text-xs font-medium text-[var(--color-text-primary)] flex-1">
                {isProjectSearch ? item.name : item.label}
              </span>
              {!isProjectSearch && item.hint && (
                <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold opacity-60">
                  {item.hint}
                </span>
              )}
              {isProjectSearch && <span className="text-[10px] text-[var(--color-text-muted)] opacity-40">Open</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function Editor({ showWelcome, onEnterEditor }: { showWelcome?: boolean; onEnterEditor?: () => void }) {
  const LEFT_RAIL_WIDTH = 52
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
    timelineView,
    timelineTransport,
    zdogStudioMode,
    centerTab,
    centerOpenTabs,
    setCenterTab,
    closeCenterTab,
    layersStripDragTabId,
    setLayersStripDragTabId,
  } = useVideoStore()
  const [mounted, setMounted] = useState(false)
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false)
  const timelineDragRef = useRef<{ startY: number; startH: number } | null>(null)
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
        const minW = showSettingsRef.current ? 240 : 140
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

  // Timeline resize drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = timelineDragRef.current
      if (!d) return
      e.preventDefault()
      setTimelineHeight(Math.max(0, Math.min(Math.round(window.innerHeight * 0.75), d.startH + (d.startY - e.clientY))))
    }
    const onUp = () => {
      if (!timelineDragRef.current) return
      timelineDragRef.current = null
      setIsDraggingTimeline(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setTimelineHeight])

  useEffect(() => {
    if (showSettings && !useElectronLayout) {
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
  const { createNewProject } = useVideoStore()
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
        } catch {
          /* still offline */
        }
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
    <div
      className="flex flex-col h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] [font-family:var(--font-ui)] overflow-hidden"
      style={{ zoom: 'var(--ui-zoom, 1)' }}
    >
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
          className={`h-12 border-b-[1.5px] border-[var(--color-border)] bg-[var(--color-panel)] grid grid-cols-[auto_1fr_auto] items-center px-3 gap-2 ${isElectron ? 'pl-20' : 'pl-3'}`}
          style={{
            color: 'var(--color-text-muted)',
            ...(isElectron ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : {}),
          }}
        >
          <div className="w-8 h-8" />
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
              {showWelcome ? project?.name?.trim() || 'Cench Studio' : project?.name?.trim() || 'Untitled project'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 justify-self-end">
            {useElectronLayout && (
              <button
                onClick={() => {
                  if (centerTab === null) {
                    setCenterTab('preview')
                  } else if (centerTab === 'preview' && centerOpenTabs.length === 1) {
                    setCenterTab(null)
                  } else if (centerTab === 'preview') {
                    closeCenterTab('preview')
                  } else {
                    setCenterTab('preview')
                  }
                }}
                className="no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
                data-tooltip="Preview"
                style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
              >
                <SquarePlay size={20} strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={() => setTimelineHeight(timelineHeight > 0 ? 0 : 200)}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-8 h-8 rounded-md flex items-center justify-center transition-colors`}
              data-tooltip="Timeline"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              {timelineHeight > 0 ? (
                <PanelBottomOpen size={20} strokeWidth={1.5} />
              ) : (
                <PanelBottomClose size={20} strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={() => setRightPanelTab(rightPanelTab === 'prompt' ? null : 'prompt')}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-8 h-8 rounded-md flex items-center justify-center transition-colors`}
              data-tooltip="Agent"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <ChatIcon size={22} />
            </button>
            <button
              onClick={() => {
                if (useElectronLayout) {
                  if (!centerOpenTabs.includes('settings')) {
                    setCenterTab('settings')
                    setSettingsTab('general')
                  } else if (centerTab === 'settings') {
                    setCenterTab('preview')
                  } else {
                    setCenterTab('settings')
                  }
                  return
                }
                setSettingsTab(showSettings ? null : 'general')
                if (!showSettings) setShowProjectPanel(false)
              }}
              className={`${useElectronLayout ? 'no-style electron-titlebar-icon' : 'kbd'} w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors`}
              data-tooltip="Settings"
              style={isElectron ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
            >
              <Settings size={20} strokeWidth={1.5} />
            </button>
          </div>
        </header>
      )}

      {showWelcome ? (
        <div className="flex-1 overflow-hidden relative flex">
          {useElectronLayout && (
            <div className="w-[52px] shrink-0 border-r-[1.5px] border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col items-center py-2 gap-1 z-[101]">
              <button
                onClick={() => {
                  if (showSettings || showProjectPanel) {
                    setSettingsTab(null)
                    setShowProjectPanel(false)
                  } else {
                    setShowProjectPanel(true)
                  }
                }}
                className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  showSettings || showProjectPanel ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                }`}
                data-tooltip={showSettings || showProjectPanel ? 'Close Side Panel' : 'Open Side Panel'}
                data-tooltip-pos="right"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <PanelLeft size={19} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => {
                  setShowProjectPanel((v) => !v)
                  setSettingsTab(null)
                }}
                className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  showProjectPanel ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                }`}
                data-tooltip="Projects"
                data-tooltip-pos="right"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <FolderOpen size={19} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => {
                  setSettingsTab(showSettings ? null : 'general')
                  setShowProjectPanel(false)
                }}
                className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  showSettings ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                }`}
                data-tooltip="Settings"
                data-tooltip-pos="right"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <Settings size={19} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => {
                  onEnterEditor?.()
                  setCenterTab('workspace')
                }}
                className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  centerTab === 'workspace' ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                }`}
                data-tooltip="Workspaces"
                data-tooltip-pos="right"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <Package2 size={19} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => {
                  onEnterEditor?.()
                  setCenterTab('customize')
                }}
                className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  centerTab === 'customize' ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                }`}
                data-tooltip="Customize"
                data-tooltip-pos="right"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <Briefcase size={19} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {(showSettings || showProjectPanel) && (
            <div
              className="absolute top-0 bottom-0 w-[300px] border-r-[1.5px] border-[var(--color-border)] bg-[var(--color-panel)] z-50 flex flex-col"
              style={{ left: useElectronLayout ? LEFT_RAIL_WIDTH : 0 }}
            >
              <div className="h-12 border-b-[1.5px] border-[var(--color-border)] flex items-center px-4 justify-between shrink-0">
                <span className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {showSettings ? 'Settings' : 'Projects'}
                </span>
                <button
                  onClick={() => {
                    setSettingsTab(null)
                    setShowProjectPanel(false)
                  }}
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
          {/* Main layout: left+center column beside right panel */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Drag overlay — prevents iframes from stealing mouse events during resize */}
            {isDraggingPanel && <div className="fixed inset-0 z-[9999]" style={{ cursor: 'col-resize' }} />}
            {isDraggingTimeline && <div className="fixed inset-0 z-[9999]" style={{ cursor: 'row-resize' }} />}

            {/* Left + Center column (timeline spans full width of this column) */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Upper area: left panel + preview */}
              <div className="flex flex-1 overflow-hidden relative min-h-0">
                {/* Left — Scene List */}
                <div
                  className={`flex-shrink-0 border-r-[1.5px] border-[var(--color-border)] bg-[var(--color-panel)] flex transition-all duration-200 ease-in-out relative z-[101] ${
                    isPreviewFullscreen ? 'overflow-hidden' : ''
                  }`}
                  style={{
                    width: isPreviewFullscreen ? 0 : isLeftCollapsed ? LEFT_RAIL_WIDTH : LEFT_RAIL_WIDTH + leftWidth,
                    visibility: isPreviewFullscreen ? 'hidden' : 'visible',
                  }}
                >
                  <div className="w-[52px] shrink-0 border-r-[1.5px] border-[var(--color-border)] flex flex-col items-center py-2 gap-1">
                    {useElectronLayout && (
                      <>
                        <button
                          onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                          className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isLeftCollapsed ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                          }`}
                          data-tooltip={isLeftCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          <PanelLeft size={19} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => {
                            setShowProjectPanel(true)
                            setSettingsTab(null)
                          }}
                          className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            showProjectPanel ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                          }`}
                          data-tooltip="Projects"
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          <FolderOpen size={19} strokeWidth={1.5} />
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
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          <Layers size={19} strokeWidth={1.5} />
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
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          <MediaIcon size={19} />
                        </button>
                        <button
                          onClick={() => {
                            if (project.outputMode === 'mp4') openExportModal()
                            else publishProject()
                          }}
                          className="no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
                          data-tooltip={project.outputMode === 'mp4' ? 'Export' : 'Publish'}
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          {project.outputMode === 'mp4' ? (
                            <Download size={19} strokeWidth={1.5} />
                          ) : (
                            <Globe size={19} strokeWidth={1.5} />
                          )}
                        </button>
                        <button
                          onClick={() => setCenterTab('workspace')}
                          className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            centerTab === 'workspace' ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                          }`}
                          data-tooltip="Workspaces"
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          <Package2 size={19} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => setCenterTab('customize')}
                          className={`no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            centerTab === 'customize' ? 'text-[var(--color-accent)] electron-titlebar-icon-active' : ''
                          }`}
                          data-tooltip="Customize"
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          <Briefcase size={19} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => void createNewProject()}
                          className="no-style electron-titlebar-icon w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
                          data-tooltip="New Project"
                          data-tooltip-pos="right"
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                          <Plus size={19} strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                  </div>

                  {!isLeftCollapsed && (
                    <div className="flex-1 min-w-0 relative flex flex-col overflow-hidden">
                      {!useElectronLayout && (
                        <div className="h-12 flex-shrink-0 flex justify-between gap-2 items-center px-3">
                          <div className="flex gap-2 flex-row items-center flex-1">
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
                              <span
                                className={`whitespace-nowrap overflow-hidden ${isLeftCollapsed ? 'hidden' : 'inline'}`}
                              >
                                {showSettings || showProjectPanel ? 'Close' : 'New Scene'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 overflow-hidden relative">
                        {showProjectPanel && !isLeftCollapsed ? (
                          <ProjectPanel onClose={() => setShowProjectPanel(false)} />
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
                  )}
                </div>

                {/* Left resize handle (Absolute) */}
                {!isLeftCollapsed && !isPreviewFullscreen && (
                  <div
                    className="absolute top-0 bottom-0 w-3 -translate-x-1/2 hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-[200]"
                    style={{
                      cursor: 'col-resize',
                      left: isLeftCollapsed ? LEFT_RAIL_WIDTH : LEFT_RAIL_WIDTH + leftWidth,
                    }}
                    onMouseDown={(e) => startPanelDrag(e, 'left')}
                    onDoubleClick={() => setIsLeftCollapsed(true)}
                  />
                )}

                {/* Center — Preview / Settings tabs */}
                <div className="flex-1 flex flex-col bg-[var(--color-panel)] min-w-0 relative z-[90] overflow-visible">
                  {useElectronLayout && layersStripDragTabId != null && (
                    <div
                      className="absolute inset-0 z-[500] bg-black/5 pointer-events-auto"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        let raw: LayersStripTabId | null = useVideoStore.getState().layersStripDragTabId
                        if (!raw) {
                          const a = e.dataTransfer.getData(LAYERS_TAB_DRAG_TYPE)
                          if (a && isLayersStripTabId(a)) raw = a
                        }
                        if (!raw) {
                          const plain = e.dataTransfer.getData('text/plain')
                          const m = plain.startsWith('cench-layers-tab:')
                            ? plain.slice('cench-layers-tab:'.length)
                            : plain
                          if (isLayersStripTabId(m)) raw = m
                        }
                        if (raw) setCenterTab(layersStripToCenterTabId(raw))
                        setLayersStripDragTabId(null)
                      }}
                    />
                  )}
                  {/* Tab bar — VS Code style */}
                  {useElectronLayout && centerOpenTabs.length > 0 && (
                    <div className="relative flex h-[35px] shrink-0">
                      {centerOpenTabs.map((id) => {
                        const isActive = centerTab === id
                        const dockStripId = parseLayersStripCenterTabId(id)
                        return (
                          <div
                            key={id}
                            onClick={() => setCenterTab(id)}
                            className={`relative flex items-center gap-1.5 h-full px-3 cursor-pointer select-none border-r border-[var(--color-border)] transition-colors ${
                              isActive
                                ? 'bg-[var(--color-input-bg)] text-[var(--color-text-primary)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border-b border-b-[var(--color-border)]'
                            }`}
                          >
                            {dockStripId != null ? (
                              <LayerDockTabIcon id={dockStripId} />
                            ) : (
                              <>
                                {id === 'preview' && <PreviewIcon size={14} />}
                                {id === 'settings' && <SettingsAdjustIcon size={14} />}
                                {id === 'workspace' && <Package2 size={14} />}
                                {id === 'customize' && <Briefcase size={14} />}
                              </>
                            )}
                            <span className="text-xs font-medium whitespace-nowrap">
                              {dockStripId != null
                                ? LAYERS_STRIP_TAB_LABELS[dockStripId]
                                : id === 'preview'
                                  ? 'Preview'
                                  : id === 'settings'
                                    ? 'Settings'
                                    : id === 'workspace'
                                      ? 'Workspaces'
                                      : id === 'customize'
                                        ? 'Customize'
                                        : id}
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation()
                                closeCenterTab(id)
                              }}
                              className="flex items-center justify-center w-5 h-5 rounded-sm hover:bg-white/[0.1] transition-colors"
                            >
                              <X size={14} strokeWidth={1.5} className="text-[var(--color-text-muted)]" />
                            </span>
                          </div>
                        )
                      })}
                      <div className="flex-1 border-b border-[var(--color-border)]" />
                    </div>
                  )}
                  {(() => {
                    const layerDockId = centerTab != null ? parseLayersStripCenterTabId(centerTab) : null
                    if (layerDockId != null) {
                      if (!selectedScene) {
                        return (
                          <div className="flex flex-1 items-center justify-center bg-[var(--color-input-bg)] text-sm text-[var(--color-text-muted)]">
                            Select a scene
                          </div>
                        )
                      }
                      return (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-input-bg)]">
                          <LayersTab
                            scene={selectedScene}
                            lockedStripMode={layerDockId}
                            showScenesSection={false}
                            isLeftCollapsed={isLeftCollapsed}
                          />
                        </div>
                      )
                    }
                    if (centerTab === 'preview') {
                      return (
                        <>
                          <PreviewPlayer />
                          {(editingAgentId || isCreatingAgent) && <AgentEditorOverlay />}
                        </>
                      )
                    }
                    if (centerTab === 'settings') {
                      return (
                        <div className="flex-1 overflow-y-auto bg-[var(--color-input-bg)]">
                          <SettingsPanel onClose={() => closeCenterTab('settings')} />
                        </div>
                      )
                    }
                    if (centerTab === 'workspace') {
                      return <WorkspaceView onClose={() => closeCenterTab('workspace')} />
                    }
                    if (centerTab === 'customize') {
                      return <CustomizeView onClose={() => closeCenterTab('customize')} />
                    }
                    return (
                      <div className="flex flex-1 items-center justify-center bg-[var(--color-panel)]">
                        <AgentIcon size={120} className="text-[var(--color-text-muted)] opacity-[0.08]" />
                      </div>
                    )
                  })()}
                </div>
              </div>
              {/* end upper area */}

              {/* Timeline section — full width of left+center column */}
              {!zdogStudioMode && (
                <>
                  <div
                    className="h-[1.5px] flex-shrink-0 bg-[var(--color-border)] cursor-row-resize z-[100] relative before:absolute before:inset-x-0 before:-top-1 before:-bottom-1 before:content-['']"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      timelineDragRef.current = { startY: e.clientY, startH: timelineHeight }
                      setIsDraggingTimeline(true)
                      document.body.style.cursor = 'row-resize'
                      document.body.style.userSelect = 'none'
                    }}
                  />
                  {timelineHeight > 0 && <TransportBar />}
                  {timelineHeight > 0 &&
                    (timelineView === 'graph' ? (
                      <div
                        style={{ height: timelineHeight }}
                        className="border-t border-[var(--color-border)] overflow-hidden flex-shrink-0"
                      >
                        <SceneGraphEditor />
                      </div>
                    ) : (
                      <Timeline
                        currentTime={timelineTransport.globalTime}
                        totalDuration={timelineTransport.totalDuration}
                        onSeek={(t: number) =>
                          window.dispatchEvent(
                            new CustomEvent('cench-preview-command', { detail: { action: 'seek', time: t } }),
                          )
                        }
                        trackHeight={timelineHeight}
                      />
                    ))}
                </>
              )}
            </div>
            {/* end left+center column */}

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

            {/* Right — Editor (full height, UNCHANGED) */}
            {!isPreviewFullscreen && rightPanelTab && (
              <div
                className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l-[1.5px] border-[var(--color-border)] bg-[var(--color-panel)] relative z-[101]"
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
            else if (action === 'export') {
              if (project.outputMode === 'mp4') openExportModal()
              else publishProject()
            } else if (action === 'agents') setSettingsTab('agents')
            else if (action === 'new-scene') addScene()
          }}
        />
      )}
    </div>
  )
}

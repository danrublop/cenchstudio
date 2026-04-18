'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download, Loader2, AlertTriangle, FolderOpen, Plus } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { resolveProjectDimensions } from '@/lib/dimensions'
import type { ExportFPS, ExportResolution, ExportSettings } from '@/lib/types'
import {
  PLATFORM_PROFILES,
  checkPlatformCompatibility,
  getPlatformProfile,
  type PlatformProfileId,
} from '@/lib/export/platform-profiles'
import { mergeProjectCaptions, type SceneCaptionInput } from '@/lib/audio/captions'
import { CenchLogo } from './icons/CenchLogo'

type OSType = 'mac' | 'windows' | 'linux' | 'unknown'

function detectOS(): OSType {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (ua.includes('Mac OS X')) return 'mac'
  if (ua.includes('Windows')) return 'windows'
  if (ua.includes('Linux')) return 'linux'
  return 'unknown'
}

const OS_WARNINGS: Partial<Record<OSType, { title: string; body: string }>> = {
  mac: {
    title: 'macOS detected',
    body: 'The render server will open a visible Chrome window to capture each scene. Keep the windows in the foreground while exporting.',
  },
  windows: {
    title: 'Windows detected',
    body: 'The render server will open a visible Chrome window to capture each scene. Keep the windows in the foreground while exporting. Make sure Google Chrome is installed.',
  },
}

function getResolutions(
  aspectRatio?: import('@/lib/dimensions').AspectRatio | null,
): { value: ExportResolution; label: string; desc: string }[] {
  return (['720p', '1080p', '4k'] as const).map((res) => {
    const d = resolveProjectDimensions(aspectRatio, res)
    return { value: res, label: res === '4k' ? '4K' : res, desc: `${d.width}×${d.height}` }
  })
}

const FPS_OPTIONS: ExportFPS[] = [24, 30, 60]

interface ExportPanelProps {
  /** When provided, the Cancel button calls this. Used by the modal wrapper. */
  onClose?: () => void
  /** When true, panel renders as a tab body (no card/border chrome). */
  inTab?: boolean
}

export default function ExportPanel({ onClose, inTab = false }: ExportPanelProps) {
  const {
    exportProgress,
    closeExportModal,
    exportVideo,
    scenes,
    project,
    updateProject,
    saveProjectToDb,
    exportFormDraft,
    setExportFormDraft,
    markExportStatusSeen,
  } = useVideoStore()

  // Initialize form draft on first render when null. Uses project mp4Settings
  // when available so settings persist across sessions per-project. In
  // Electron, also seeds saveDirPath from the system Downloads folder so
  // exports run without prompting unless the user explicitly changes it.
  useEffect(() => {
    if (exportFormDraft) return
    const initialPlatformId: PlatformProfileId = project?.mp4Settings?.platformProfileId ?? 'custom'
    const initialProfile = getPlatformProfile(initialPlatformId)
    const initialName = project?.name
      ? project.name
          .replace(/[^a-zA-Z0-9_\-\s]/g, '')
          .trim()
          .replace(/\s+/g, '-') || 'export'
      : 'export'
    setExportFormDraft({
      platformId: initialPlatformId,
      resolution:
        initialPlatformId === 'custom' ? (project?.mp4Settings?.resolution ?? '1080p') : initialProfile.resolution,
      fps: initialPlatformId === 'custom' ? (project?.mp4Settings?.fps ?? 30) : initialProfile.fps,
      profile: 'quality',
      os: detectOS(),
      filename: initialName,
      saveDirPath: '',
      saveDirName: '',
    })
    if (typeof window !== 'undefined' && window.electronAPI?.getDefaultExportDir) {
      window.electronAPI
        .getDefaultExportDir()
        .then(({ dirPath }) => {
          if (!dirPath) return
          setExportFormDraft({
            saveDirPath: dirPath,
            saveDirName: dirPath.split(/[\\/]/).pop() || dirPath,
          })
        })
        .catch(() => {})
    }
  }, [exportFormDraft, project, setExportFormDraft])

  // Mark status as seen whenever this panel is visible — clears the tab pill.
  useEffect(() => {
    markExportStatusSeen()
  }, [markExportStatusSeen])

  const draft = exportFormDraft
  const platformId = draft?.platformId ?? 'custom'
  const resolution = draft?.resolution ?? '1080p'
  const fps = draft?.fps ?? 30
  const profile = draft?.profile ?? 'quality'
  const os = draft?.os ?? 'unknown'
  const filename = draft?.filename ?? 'export'
  const saveDirPath = draft?.saveDirPath ?? ''
  const saveDirName = draft?.saveDirName ?? ''

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Drop platform back to 'custom' if user manually changes resolution/fps to
  // values that no longer match the named platform profile.
  const setResolution = (v: ExportResolution) => {
    let nextPlatform: PlatformProfileId = platformId
    if (platformId !== 'custom') {
      const prof = getPlatformProfile(platformId)
      if (prof.resolution !== v) nextPlatform = 'custom'
    }
    setExportFormDraft({ resolution: v, platformId: nextPlatform })
  }
  const setFps = (v: ExportFPS) => {
    let nextPlatform: PlatformProfileId = platformId
    if (platformId !== 'custom') {
      const prof = getPlatformProfile(platformId)
      if (prof.fps !== v) nextPlatform = 'custom'
    }
    setExportFormDraft({ fps: v, platformId: nextPlatform })
  }

  const pickSaveLocation = async () => {
    try {
      // Electron: native directory picker via IPC, returns absolute path.
      if (typeof window !== 'undefined' && window.electronAPI?.chooseDirectory) {
        const res = await window.electronAPI.chooseDirectory(saveDirPath || undefined)
        if (res.canceled || !res.dirPath) return
        setExportFormDraft({
          saveDirPath: res.dirPath,
          saveDirName: res.dirPath.split(/[\\/]/).pop() || res.dirPath,
        })
        return
      }
      // Web fallback: showDirectoryPicker only gives a handle (no path);
      // used for display only since the web export path returns a downloadUrl.
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
        setExportFormDraft({ saveDirPath: '', saveDirName: handle.name })
      }
    } catch {
      // User cancelled
    }
  }

  const osWarning = OS_WARNINGS[os]

  const currentPlatform = useMemo(() => getPlatformProfile(platformId), [platformId])
  const totalDuration = useMemo(() => scenes.reduce((a, s) => a + s.duration, 0), [scenes])
  const compat = useMemo(
    () => checkPlatformCompatibility(currentPlatform, project?.mp4Settings?.aspectRatio ?? '16:9', totalDuration),
    [currentPlatform, project?.mp4Settings?.aspectRatio, totalDuration],
  )

  const applyPlatform = (id: PlatformProfileId) => {
    const prof = getPlatformProfile(id)
    setExportFormDraft({
      platformId: id,
      ...(id !== 'custom' ? { resolution: prof.resolution, fps: prof.fps } : {}),
    })
    updateProject({
      mp4Settings: {
        ...project.mp4Settings,
        platformProfileId: id === 'custom' ? null : id,
      },
    })
  }

  const applyProjectAspect = () => {
    if (!currentPlatform.aspectRatio) return
    updateProject({
      mp4Settings: {
        ...project.mp4Settings,
        aspectRatio: currentPlatform.aspectRatio,
      },
    })
    saveProjectToDb().catch((err) => {
      console.warn('[ExportPanel] failed to persist aspect change', err)
    })
  }

  // Stitch per-scene caption word timings into a project-level SRT + VTT
  // at export time. Memoised so the bundle rebuilds only when scenes change.
  // Skipped in NLE timeline mode — scene order + `s.duration` don't match
  // timeline composition offsets when tracks have gaps or overlap.
  const mergedCaptions = useMemo(() => {
    if (project?.timeline) return null
    let cursor = 0
    const inputs: SceneCaptionInput[] = []
    for (const s of scenes) {
      const words = s.audioLayer?.tts?.captions?.words
      if (words && words.length > 0) {
        inputs.push({ startSeconds: cursor, words })
      }
      cursor += s.duration
    }
    if (inputs.length === 0) return null
    const bundle = mergeProjectCaptions(inputs)
    if (bundle.cues.length === 0) return null
    return bundle
  }, [scenes, project?.timeline])

  const sanitizedName = filename.replace(/[^a-zA-Z0-9_\-]/g, '') || 'export'

  const downloadCaptions = (kind: 'srt' | 'vtt') => {
    if (!mergedCaptions) return
    const content = kind === 'srt' ? mergedCaptions.srt : mergedCaptions.vtt
    const mime = kind === 'srt' ? 'application/x-subrip' : 'text/vtt'
    const blob = new Blob([content], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitizedName}.${kind}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const isRendering = exportProgress?.phase === 'rendering'
  const isMixingAudio = exportProgress?.phase === 'mixing_audio'
  const isStitching = exportProgress?.phase === 'stitching'
  const isComplete = exportProgress?.phase === 'complete'
  const isError = exportProgress?.phase === 'error'
  const isElectronPath2 = typeof window !== 'undefined' && !!window.electronAPI
  const backendLabel = isElectronPath2 ? 'Electron Path 2' : 'Render Server'

  const handleExport = () => {
    const settings: ExportSettings = { resolution, fps, format: 'mp4', outputName: sanitizedName, profile }
    // Electron: pre-construct outputPath from form fields so exportVideo
    // skips the native save dialog. Forward slashes are safe on all
    // platforms — Node normalizes them.
    if (isElectronPath2 && saveDirPath) {
      settings.outputPath = `${saveDirPath.replace(/[\\/]+$/, '')}/${sanitizedName}.mp4`
    }
    exportVideo(settings)
  }

  const handleCancelClick = () => {
    if (onClose) {
      onClose()
    } else {
      // Tab mode: clear progress so panel returns to settings view.
      closeExportModal()
    }
  }

  // Card chrome differs by mount target: modal gives it a fixed-width framed
  // card; tab gives it a centered, scrollable column that fills the area.
  const wrapperCls = inTab ? 'mx-auto w-full max-w-[560px] p-6 space-y-5' : 'p-5 space-y-5'

  return (
    <div className={wrapperCls}>
      {/* Settings (shown when no export has been initiated) */}
      {!exportProgress ? (
        <>
          {/* Platform profile */}
          <div>
            <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
              Platform
            </label>
            <select
              value={platformId}
              onChange={(e) => applyPlatform(e.target.value as PlatformProfileId)}
              className="w-full h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
            >
              {PLATFORM_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.note ? ` — ${p.note}` : ''}
                </option>
              ))}
            </select>
            {currentPlatform.id !== 'custom' && (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">{currentPlatform.description}</p>
            )}
            {currentPlatform.id !== 'custom' && !compat.aspectMatch && (
              <div className="mt-2 flex gap-2 bg-amber-950/40 border border-amber-700/40 rounded p-2.5">
                <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-amber-200/80 space-y-1.5">
                  <p>
                    Project aspect is {compat.actualAspect} but {currentPlatform.label} expects {compat.expectedAspect}.
                    The export will render at {compat.actualAspect} unless you switch the project aspect.
                  </p>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={applyProjectAspect}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyProjectAspect()
                    }}
                    className="inline-block text-amber-300 underline cursor-pointer hover:text-amber-200"
                  >
                    Switch project to {compat.expectedAspect}
                  </span>
                </div>
              </div>
            )}
            {compat.durationExceeds && compat.maxDurationSeconds !== null && (
              <div className="mt-2 flex gap-2 bg-amber-950/40 border border-amber-700/40 rounded p-2.5">
                <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-200/80">
                  Video is {Math.round(compat.totalDurationSeconds)}s — exceeds {currentPlatform.label}'s{' '}
                  {compat.maxDurationSeconds}s cap. Trim scenes before uploading.
                </p>
              </div>
            )}
          </div>

          {/* Filename */}
          <div>
            <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
              Filename
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={filename}
                onChange={(e) => setExportFormDraft({ filename: e.target.value })}
                className="flex-1 min-w-0 h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                placeholder="my-video"
              />
              <span className="text-[var(--color-text-muted)] text-sm">.mp4</span>
            </div>
          </div>

          {/* Save location */}
          {'showDirectoryPicker' in globalThis && (
            <div>
              <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
                Save to
              </label>
              <span
                role="button"
                tabIndex={0}
                onClick={pickSaveLocation}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') pickSaveLocation()
                }}
                className="flex items-center gap-2 h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm cursor-pointer hover:border-[var(--color-text-muted)] transition-colors w-full overflow-hidden"
              >
                <FolderOpen size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
                <span
                  className={`truncate ${saveDirName ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}
                >
                  {saveDirName || 'Default (Downloads)'}
                </span>
              </span>
            </div>
          )}

          {/* Resolution / Frame Rate / Export Profile (single row of dropdowns) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ExportResolution)}
                className="w-full h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                {getResolutions(project.mp4Settings?.aspectRatio).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} ({r.desc})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
                Frame Rate
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as ExportFPS)}
                className="w-full h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
                Export Profile
              </label>
              <select
                value={profile}
                onChange={(e) => setExportFormDraft({ profile: e.target.value as 'fast' | 'quality' })}
                className="w-full h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                <option value="fast">Fast</option>
                <option value="quality">Quality</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[var(--color-bg)] rounded p-3 text-sm text-[var(--color-text-muted)] space-y-1">
            <div className="flex justify-between">
              <span>Scenes</span>
              <span className="text-[var(--color-text-primary)]">{scenes.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total duration</span>
              <span className="text-[var(--color-text-primary)]">{scenes.reduce((a, s) => a + s.duration, 0)}s</span>
            </div>
            {mergedCaptions && (
              <div className="flex justify-between">
                <span>Captions</span>
                <span className="text-[var(--color-text-primary)]">{mergedCaptions.cues.length} cues · SRT + VTT</span>
              </div>
            )}
          </div>

          {/* OS warning — render-server backend only (Electron Path 2 doesn't
              open a visible Chrome capture window). */}
          {osWarning && !isElectronPath2 && (
            <div className="flex gap-2.5 bg-amber-950/40 border border-amber-700/40 rounded p-3">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-0.5">
                <p className="text-amber-400 font-medium">{osWarning.title}</p>
                <p className="text-amber-200/70">{osWarning.body}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCancelClick}
              className="kbd flex-1 h-9 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {onClose ? 'Cancel' : 'Reset'}
            </button>
            <button
              onClick={handleExport}
              disabled={scenes.length === 0}
              className="kbd flex-1 h-9 font-bold bg-[#e84545] border-[#e84545] shadow-[#800] text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Export
            </button>
          </div>
        </>
      ) : isComplete ? (
        /* Complete state */
        <div className="text-center space-y-4 py-4">
          <div className="flex justify-center text-[var(--color-text-primary)]">
            <CenchLogo size={56} />
          </div>
          <div>
            <p className="text-[var(--color-text-primary)] font-medium">Your video is ready</p>
            {exportProgress.filePath && (
              <p
                className="text-[12px] text-[var(--color-text-muted)] mt-1.5 font-mono break-all px-4"
                title={exportProgress.filePath}
              >
                {exportProgress.filePath}
              </p>
            )}
          </div>
          {(exportProgress.filePath || exportProgress.downloadUrl) && (
            <div className="flex items-center justify-center gap-4">
              <span
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (exportProgress.filePath && window.electronAPI?.showItemInFolder) {
                    window.electronAPI.showItemInFolder(exportProgress.filePath).catch(() => {})
                    return
                  }
                  const url = exportProgress.downloadUrl
                  if (!url) return
                  fetch('/api/export/reveal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                  }).catch(() => {
                    window.open(url, '_blank')
                  })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.click()
                }}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
              >
                <FolderOpen size={14} />
                {os === 'windows' ? 'Show in Explorer' : os === 'linux' ? 'Show in Files' : 'Show in Finder'}
              </span>
              <span className="text-[var(--color-border)]">|</span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (exportProgress.filePath && window.electronAPI?.openPath) {
                    window.electronAPI.openPath(exportProgress.filePath).catch(() => {})
                    return
                  }
                  const url = exportProgress.downloadUrl
                  if (!url) return
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${sanitizedName}.mp4`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.click()
                }}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
              >
                <Download size={14} />
                Open
              </span>
              <span className="text-[var(--color-border)]">|</span>
              <span
                role="button"
                tabIndex={0}
                onClick={handleCancelClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCancelClick()
                }}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
              >
                <Plus size={14} />
                {onClose ? 'Close' : 'New Export'}
              </span>
            </div>
          )}
          {mergedCaptions && (
            <div className="flex items-center justify-center gap-4 pt-1">
              <span
                role="button"
                tabIndex={0}
                onClick={() => downloadCaptions('srt')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') downloadCaptions('srt')
                }}
                className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
              >
                <Download size={12} />
                Download SRT
              </span>
              <span className="text-[var(--color-border)]">|</span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => downloadCaptions('vtt')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') downloadCaptions('vtt')
                }}
                className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
              >
                <Download size={12} />
                Download VTT
              </span>
            </div>
          )}
        </div>
      ) : isError ? (
        /* Error state */
        <div className="text-center space-y-4 py-4">
          <div className="flex justify-center text-[#e84545]">
            <AlertTriangle size={48} />
          </div>
          <div>
            <p className="text-[#f0ece0] font-medium">Export failed</p>
            <p className="text-[#6b6b7a] text-sm mt-1 break-words">{exportProgress?.error}</p>
          </div>
          {exportProgress?.diagnostics && exportProgress.diagnostics.length > 0 && (
            <div className="text-left bg-[var(--color-bg)] rounded p-3 max-h-28 overflow-auto">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Export diagnostics
              </div>
              <div className="space-y-1">
                {exportProgress.diagnostics.slice(-8).map((d, i) => (
                  <div key={`${d}-${i}`} className="text-[12px] text-[var(--color-text-muted)] font-mono break-all">
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleCancelClick}
            className="px-6 py-2 border border-[#2a2a32] text-[#6b6b7a] rounded hover:border-[#3a3a45] hover:text-[#f0ece0] transition-colors text-sm"
          >
            {onClose ? 'Close' : 'Try Again'}
          </button>
        </div>
      ) : (
        /* Progress state */
        <div className="space-y-4">
          {isRendering && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b7a] text-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Rendering scene {exportProgress.currentScene} of {exportProgress.totalScenes}
                </span>
                <span className="text-[#f0ece0] text-sm">{Math.round(exportProgress.sceneProgress)}%</span>
              </div>

              {/* Per-scene progress */}
              <div className="space-y-2">
                {scenes.map((scene, i) => {
                  const sceneNum = i + 1
                  const isDone = sceneNum < exportProgress.currentScene
                  const isCurrent = sceneNum === exportProgress.currentScene
                  const progress = isDone ? 100 : isCurrent ? exportProgress.sceneProgress : 0
                  return (
                    <div key={scene.id}>
                      <div className="flex justify-between text-[11px] text-[#6b6b7a] mb-0.5">
                        <span>
                          Scene {sceneNum}: {scene.name || scene.prompt.slice(0, 30) || 'Untitled'}
                        </span>
                        <span>{progress > 0 ? `${Math.round(progress)}%` : '—'}</span>
                      </div>
                      <div className="h-1 bg-[#1a1a1f] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e84545] rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isMixingAudio && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={20} className="animate-spin text-[#e84545]" />
              <div>
                <p className="text-[#f0ece0] text-sm font-medium">Mixing audio...</p>
                <p className="text-[#6b6b7a] text-sm">Combining TTS, SFX, and music tracks</p>
              </div>
            </div>
          )}

          {isStitching && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={20} className="animate-spin text-[#e84545]" />
              <div>
                <p className="text-[#f0ece0] text-sm font-medium">Stitching scenes...</p>
                <p className="text-[#6b6b7a] text-sm">Combining clips with FFmpeg</p>
              </div>
            </div>
          )}

          {exportProgress?.diagnostics && exportProgress.diagnostics.length > 0 && (
            <div className="bg-[var(--color-bg)] rounded p-3">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Export diagnostics
              </div>
              <div className="max-h-24 overflow-auto space-y-1">
                {exportProgress.diagnostics.slice(-6).map((d, i) => (
                  <div key={`${d}-${i}`} className="text-[12px] text-[var(--color-text-muted)] font-mono break-all">
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showCancelConfirm ? (
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
              <p className="text-sm text-[var(--color-text-primary)]">Cancel the export? Progress will be lost.</p>
              <div className="flex justify-end gap-2">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowCancelConfirm(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setShowCancelConfirm(false)
                  }}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors px-3 py-1.5"
                >
                  Continue
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setShowCancelConfirm(false)
                    closeExportModal()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowCancelConfirm(false)
                      closeExportModal()
                    }
                  }}
                  className="text-sm text-[#e84545] hover:text-[#ff5555] cursor-pointer transition-colors px-3 py-1.5"
                >
                  Cancel Export
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-end pt-1">
              <span
                role="button"
                tabIndex={0}
                onClick={() => setShowCancelConfirm(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setShowCancelConfirm(true)
                }}
                className="text-sm text-[var(--color-text-muted)] hover:text-[#e84545] cursor-pointer transition-colors"
              >
                Cancel
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

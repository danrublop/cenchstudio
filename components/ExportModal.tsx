'use client'

import { useState, useEffect } from 'react'
import { Download, Loader2, AlertTriangle, FolderOpen } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { ExportFPS, ExportResolution, ExportSettings } from '@/lib/types'

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

const RESOLUTIONS: { value: ExportResolution; label: string; desc: string }[] = [
  { value: '720p', label: '720p', desc: '1280×720' },
  { value: '1080p', label: '1080p', desc: '1920×1080' },
  { value: '4k', label: '4K', desc: '3840×2160' },
]

const FPS_OPTIONS: ExportFPS[] = [24, 30, 60]

export default function ExportModal() {
  const { exportProgress, closeExportModal, exportVideo, isExporting, scenes, project } = useVideoStore()
  const [resolution, setResolution] = useState<ExportResolution>('1080p')
  const [fps, setFps] = useState<ExportFPS>(30)
  const [profile, setProfile] = useState<'fast' | 'quality'>('quality')
  const [os, setOs] = useState<OSType>('unknown')
  const [filename, setFilename] = useState('')
  const [saveDir, setSaveDir] = useState<FileSystemDirectoryHandle | null>(null)
  const [saveDirName, setSaveDirName] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    setOs(detectOS())
  }, [])

  // Default filename from project name
  useEffect(() => {
    if (project?.name) {
      const safe = project.name
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
      setFilename(safe || 'export')
    } else {
      setFilename('export')
    }
  }, [project?.name])

  const pickSaveLocation = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
        setSaveDir(handle)
        setSaveDirName(handle.name)
      }
    } catch {
      // User cancelled
    }
  }

  const osWarning = OS_WARNINGS[os]

  const isRendering = exportProgress?.phase === 'rendering'
  const isMixingAudio = exportProgress?.phase === 'mixing_audio'
  const isStitching = exportProgress?.phase === 'stitching'
  const isComplete = exportProgress?.phase === 'complete'
  const isError = exportProgress?.phase === 'error'
  const isElectronPath2 = typeof window !== 'undefined' && !!window.electronAPI
  const backendLabel = isElectronPath2 ? 'Electron Path 2' : 'Render Server'

  const sanitizedName = filename.replace(/[^a-zA-Z0-9_\-]/g, '') || 'export'

  const handleExport = () => {
    const settings: ExportSettings = { resolution, fps, format: 'mp4', outputName: sanitizedName, profile }
    exportVideo(settings)
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4"
      onClick={!isExporting ? closeExportModal : undefined}
    >
      <div
        className="w-[480px] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-5">
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {backendLabel}
            </span>
          </div>
          <p className="text-[12px] text-[var(--color-text-muted)] -mt-3">
            {isElectronPath2
              ? 'Path 2 exporter active: single-scene Pixi/WebCodecs pipeline (iterating toward full multi-scene parity).'
              : 'Render-server exporter active: scene HTML capture + FFmpeg stitching.'}
          </p>

          {/* Settings (shown when no export has been initiated) */}
          {!exportProgress ? (
            <>
              {/* Resolution */}
              <div>
                <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
                  Resolution
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {RESOLUTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setResolution(r.value)}
                      className={`py-2.5 rounded border text-center transition-colors no-style ${
                        resolution === r.value
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                          : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div
                        className={`text-sm font-medium ${resolution === r.value ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}
                      >
                        {r.label}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS */}
              <div>
                <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
                  Frame Rate
                </label>
                <div className="flex gap-2">
                  {FPS_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={`flex-1 py-2 rounded border text-sm transition-colors no-style ${
                        fps === f
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {f} fps
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile */}
              <div>
                <label className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider block mb-2">
                  Export Profile
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setProfile('fast')}
                    className={`py-2 rounded border text-sm transition-colors no-style ${
                      profile === 'fast'
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Fast
                  </button>
                  <button
                    onClick={() => setProfile('quality')}
                    className={`py-2 rounded border text-sm transition-colors no-style ${
                      profile === 'quality'
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Quality
                  </button>
                </div>
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
                    onChange={(e) => setFilename(e.target.value)}
                    className="flex-1 h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
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
                    className="flex items-center gap-2 h-9 px-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-sm cursor-pointer hover:border-[var(--color-text-muted)] transition-colors w-full"
                  >
                    <FolderOpen size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
                    <span
                      className={saveDirName ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}
                    >
                      {saveDirName || 'Default (Downloads)'}
                    </span>
                  </span>
                </div>
              )}

              {/* Summary */}
              <div className="bg-[var(--color-bg)] rounded p-3 text-sm text-[var(--color-text-muted)] space-y-1">
                <div className="flex justify-between">
                  <span>Scenes</span>
                  <span className="text-[var(--color-text-primary)]">{scenes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total duration</span>
                  <span className="text-[var(--color-text-primary)]">
                    {scenes.reduce((a, s) => a + s.duration, 0)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Format</span>
                  <span className="text-[var(--color-text-primary)]">MP4 (H.264)</span>
                </div>
                <div className="flex justify-between">
                  <span>Profile</span>
                  <span className="text-[var(--color-text-primary)]">{profile}</span>
                </div>
                <div className="flex justify-between">
                  <span>Backend</span>
                  <span className="text-[var(--color-text-primary)]">{backendLabel}</span>
                </div>
              </div>

              {/* OS-specific warning */}
              {osWarning && (
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
                  onClick={closeExportModal}
                  className="kbd flex-1 h-9 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Cancel
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
              <div className="flex justify-center">
                <img src="/cench-logo.png" alt="Cench" className="h-12 object-contain export-logo" />
              </div>
              <div>
                <p className="text-[var(--color-text-primary)] font-medium">Your video is ready!</p>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">MP4 exported successfully</p>
              </div>
              {exportProgress.downloadUrl && (
                <div className="flex items-center justify-center gap-4">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const url = exportProgress.downloadUrl!
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
                      const url = exportProgress.downloadUrl!
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
                onClick={closeExportModal}
                className="px-6 py-2 border border-[#2a2a32] text-[#6b6b7a] rounded hover:border-[#3a3a45] hover:text-[#f0ece0] transition-colors text-sm"
              >
                Close
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
      </div>
    </div>
  )
}

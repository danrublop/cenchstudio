'use client'

import { useState, useEffect } from 'react'
import { X, Download, Loader2, AlertTriangle, Film } from 'lucide-react'
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
  const { exportProgress, closeExportModal, exportVideo, isExporting, scenes } = useVideoStore()
  const [resolution, setResolution] = useState<ExportResolution>('1080p')
  const [fps, setFps] = useState<ExportFPS>(30)
  const [os, setOs] = useState<OSType>('unknown')

  useEffect(() => {
    setOs(detectOS())
  }, [])

  const osWarning = OS_WARNINGS[os]

  const isIdle = !exportProgress || exportProgress.phase === 'rendering' && exportProgress.currentScene === 0
  const isRendering = exportProgress?.phase === 'rendering'
  const isStitching = exportProgress?.phase === 'stitching'
  const isComplete = exportProgress?.phase === 'complete'
  const isError = exportProgress?.phase === 'error'

  const handleExport = () => {
    const settings: ExportSettings = { resolution, fps, format: 'mp4' }
    exportVideo(settings)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4" onClick={!isExporting ? closeExportModal : undefined}>
      <div className="w-[480px] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-5">
          {/* Settings (shown when not yet exporting) */}
          {!exportProgress || (exportProgress.phase === 'rendering' && exportProgress.currentScene === 0 && !isExporting) ? (
            <>
              {/* Resolution */}
              <div>
                <label className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider block mb-2">
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
                      <div className={`text-sm font-medium ${resolution === r.value ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                        {r.label}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS */}
              <div>
                <label className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider block mb-2">
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

              {/* Summary */}
              <div className="bg-[var(--color-bg)] rounded p-3 text-xs text-[var(--color-text-muted)] space-y-1">
                <div className="flex justify-between">
                  <span>Scenes</span>
                  <span className="text-[var(--color-text-primary)]">{scenes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total duration</span>
                  <span className="text-[var(--color-text-primary)]">{scenes.reduce((a, s) => a + s.duration, 0)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Format</span>
                  <span className="text-[var(--color-text-primary)]">MP4 (H.264)</span>
                </div>
              </div>

              {/* OS-specific warning */}
              {osWarning && (
                <div className="flex gap-2.5 bg-amber-950/40 border border-amber-700/40 rounded p-3">
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
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
              <div className="flex justify-center text-[var(--color-accent)] animate-bounce">
                <Film size={48} />
              </div>
              <div>
                <p className="text-[#f0ece0] font-medium">Your video is ready!</p>
                <p className="text-[#6b6b7a] text-sm mt-1">MP4 exported successfully</p>
              </div>
              {exportProgress.downloadUrl && (
                <a
                  href={exportProgress.downloadUrl}
                  download
                  className="kbd px-6 py-3"
                >
                  <Download size={16} />
                  Download MP4
                </a>
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
                    <span className="text-[#f0ece0] text-sm">
                      {Math.round(exportProgress.sceneProgress)}%
                    </span>
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
                          <div className="flex justify-between text-[10px] text-[#6b6b7a] mb-0.5">
                            <span>Scene {sceneNum}: {(scene.name || scene.prompt.slice(0, 30)) || 'Untitled'}</span>
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

              {isStitching && (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 size={20} className="animate-spin text-[#e84545]" />
                  <div>
                    <p className="text-[#f0ece0] text-sm font-medium">Stitching scenes...</p>
                    <p className="text-[#6b6b7a] text-xs">Combining clips with FFmpeg</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

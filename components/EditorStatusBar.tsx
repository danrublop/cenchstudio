'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GitBranch, RefreshCw, XCircle, AlertTriangle, Minus, Plus, RotateCcw, Bell } from 'lucide-react'
import { useVideoStore } from '@/lib/store'

function sendPreviewCommand(action: 'zoom_in' | 'zoom_out' | 'zoom_reset') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('cench-preview-command', { detail: { action } }))
}

export default function EditorStatusBar() {
  const project = useVideoStore((s) => s.project)
  const sceneWriteErrors = useVideoStore((s) => s.sceneWriteErrors)
  const projectLoadFailed = useVideoStore((s) => s.projectLoadFailed)
  const publishError = useVideoStore((s) => s.publishError)
  const previewZoom = useVideoStore((s) => s.previewZoom)

  const [git, setGit] = useState<{ branch: string; dirty: boolean } | null>(null)
  const [gitRefreshing, setGitRefreshing] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifWrapRef = useRef<HTMLDivElement>(null)

  const refreshGit = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined
    if (!api?.getGitStatus) {
      setGit(null)
      return
    }
    setGitRefreshing(true)
    try {
      const r = await api.getGitStatus()
      if (r.ok && r.branch) setGit({ branch: r.branch, dirty: r.dirty })
      else setGit(null)
    } finally {
      setGitRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.getGitStatus) return
    void refreshGit()
    const t = setInterval(() => void refreshGit(), 20000)
    const onFocus = () => void refreshGit()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshGit])

  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e: MouseEvent) => {
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [notifOpen])

  const errorCount = Object.keys(sceneWriteErrors).length + (projectLoadFailed ? 1 : 0)
  const warnCount = publishError ? 1 : 0

  const errorTitle = [
    ...Object.entries(sceneWriteErrors).map(([id, msg]) => `${id}: ${msg}`),
    ...(projectLoadFailed ? ['Project: could not connect to server — changes may not save'] : []),
  ].join('\n')

  const branchLabel = git ? `${git.branch}${git.dirty ? '*' : ''}` : '—'
  const projectLabel = project?.name?.trim() || 'Untitled project'

  const itemClass =
    'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--color-border)]/40 transition-colors max-w-[140px]'

  return (
    <footer className="relative z-[120] flex h-8 shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 text-[12px] text-[var(--color-text-muted)] select-none [font-variant-numeric:tabular-nums]">
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
        <span
          className={`${itemClass} shrink-0 cursor-default`}
          title={
            typeof window !== 'undefined' && window.electronAPI?.getGitStatus
              ? git
                ? `Branch ${git.branch}${git.dirty ? ' (uncommitted changes)' : ''}`
                : 'Not a git repo or git unavailable'
              : 'Git status is available in the desktop app'
          }
        >
          <GitBranch size={12} className="shrink-0 opacity-80" strokeWidth={2} />
          <span className="truncate font-medium">{branchLabel}</span>
        </span>

        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-[var(--color-border)]/40 transition-colors disabled:opacity-30"
          onClick={() => void refreshGit()}
          disabled={typeof window === 'undefined' || !window.electronAPI?.getGitStatus}
          aria-label="Refresh git status"
          title="Refresh git status"
        >
          <RefreshCw size={12} className={gitRefreshing ? 'animate-spin' : ''} strokeWidth={2} />
        </button>

        <div className="mx-1 h-3 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />

        <span className="truncate px-1 font-medium text-[var(--color-text-primary)]/80" title={projectLabel}>
          {projectLabel}
        </span>

        <div className="mx-1 h-3 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />

        <span className={`${itemClass} shrink-0 cursor-default`} title={errorTitle || 'No errors'} role="status">
          <XCircle size={12} className="shrink-0" strokeWidth={2} />
          <span>{errorCount}</span>
        </span>

        <span className={`${itemClass} shrink-0 cursor-default`} title={publishError || 'No warnings'} role="status">
          <AlertTriangle size={12} className="shrink-0" strokeWidth={2} />
          <span>{warnCount}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-border)]/40 transition-colors"
          onClick={() => sendPreviewCommand('zoom_out')}
          aria-label="Zoom Out"
          title="Zoom Out"
        >
          <Minus size={13} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="flex h-6 min-w-[2.5rem] items-center justify-center rounded px-0.5 hover:bg-[var(--color-border)]/40 transition-colors text-[11px] font-medium tabular-nums"
          onClick={() => sendPreviewCommand('zoom_reset')}
          aria-label="Reset to 100%"
          title="Reset to 100%"
        >
          {Math.round(previewZoom * 100)}%
        </button>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-border)]/40 transition-colors"
          onClick={() => sendPreviewCommand('zoom_in')}
          aria-label="Zoom In"
          title="Zoom In"
        >
          <Plus size={13} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-border)]/40 transition-colors"
          onClick={() => sendPreviewCommand('zoom_reset')}
          aria-label="Reset Zoom"
          title="Reset Zoom"
        >
          <RotateCcw size={12} strokeWidth={2} />
        </button>

        <div className="mx-1 h-3 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />

        <span className="px-1.5 text-[11px] font-medium tracking-wide text-[var(--color-text-muted)]">
          Cench Studio
        </span>

        <div className="relative" ref={notifWrapRef}>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-border)]/40 transition-colors"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={13} strokeWidth={2} />
          </button>
          {notifOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-2 text-[12px] text-[var(--color-text-muted)] shadow-lg">
              <p className="leading-snug">Export and publish alerts will show here as the app grows.</p>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

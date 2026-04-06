'use client'

import { useVideoStore } from '@/lib/store'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import type { PermissionRequest, PermissionResponse } from '@/lib/types'
import { ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'

export default function PermissionDialog() {
  const { pendingPermissionRequest, setPendingPermissionRequest, setSessionPermission, updateAPIPermissions, project } = useVideoStore()
  const [dontAskAgain, setDontAskAgain] = useState(false)

  if (!pendingPermissionRequest) return null

  const req = pendingPermissionRequest
  const displayName = API_DISPLAY_NAMES[req.api] ?? req.api

  const respond = async (decision: 'allow' | 'deny') => {
    // Determine remember mode
    let remember: 'once' | 'session' | 'always' = 'once'
    if (dontAskAgain) {
      remember = 'session'
    }

    // Update session permissions
    if (remember === 'session') {
      setSessionPermission(req.api, decision)
      // Also persist to backend
      fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_session_permission', api: req.api, decision }),
      }).catch(() => {})
    }

    // Clear the dialog
    setPendingPermissionRequest(null)
    setDontAskAgain(false)
  }

  const respondAlwaysAllow = async () => {
    // Set to always_allow in project settings
    const currentConfig = project.apiPermissions[req.api]
    updateAPIPermissions({
      [req.api]: { ...currentConfig, mode: 'always_allow' },
    } as any)
    setSessionPermission(req.api, 'allow')
    setPendingPermissionRequest(null)
    setDontAskAgain(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="rounded-lg shadow-2xl border max-w-md w-full mx-4"
        style={{
          backgroundColor: 'var(--color-panel-bg, #1e1e2e)',
          borderColor: 'var(--color-border, #2a2a3a)',
          color: 'var(--color-text-primary, #e0e0e0)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-border, #2a2a3a)' }}
        >
          <ShieldCheck size={18} className="text-amber-400" />
          <span className="font-medium text-sm">Agent requesting API access</span>
          <button
            onClick={() => respond('deny')}
            className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-[#6b6b7a] min-w-[60px]">API:</span>
            <span className="font-medium">{displayName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#6b6b7a] min-w-[60px]">Reason:</span>
            <span>{req.reason}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#6b6b7a] min-w-[60px]">Cost:</span>
            <span className="font-medium text-amber-400">{req.estimatedCost}</span>
          </div>
          {req.details.prompt && (
            <div className="flex gap-2">
              <span className="text-[#6b6b7a] min-w-[60px]">Prompt:</span>
              <span className="text-sm opacity-80 line-clamp-2">&ldquo;{req.details.prompt}&rdquo;</span>
            </div>
          )}
          {req.details.model && (
            <div className="flex gap-2">
              <span className="text-[#6b6b7a] min-w-[60px]">Model:</span>
              <span>{req.details.model}</span>
            </div>
          )}
          {req.details.duration && (
            <div className="flex gap-2">
              <span className="text-[#6b6b7a] min-w-[60px]">Duration:</span>
              <span>{req.details.duration}s</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="px-4 py-3 border-t space-y-3"
          style={{ borderColor: 'var(--color-border, #2a2a3a)' }}
        >
          {/* Don't ask again checkbox */}
          <label className="flex items-center gap-2 text-sm text-[#6b6b7a] cursor-pointer">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="rounded"
            />
            Don&apos;t ask again this session
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => respond('allow')}
              className="flex-1 px-3 py-2 text-sm font-medium rounded transition-colors"
              style={{ backgroundColor: '#22c55e', color: '#fff' }}
            >
              Allow once
            </button>
            <button
              onClick={respondAlwaysAllow}
              className="flex-1 px-3 py-2 text-sm font-medium rounded border transition-colors hover:bg-white/5"
              style={{ borderColor: '#22c55e', color: '#22c55e' }}
            >
              Always allow {displayName.split(' ')[0]}
            </button>
            <button
              onClick={() => respond('deny')}
              className="px-3 py-2 text-sm font-medium rounded border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--color-border, #2a2a3a)', color: '#ef4444' }}
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

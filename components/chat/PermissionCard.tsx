'use client'

import { ShieldAlert } from 'lucide-react'
import { API_DISPLAY_NAMES } from '@/lib/permissions'

export interface PermissionCardProps {
  perm: { api: string; estimatedCost: string; toolName: string; resolved?: 'allow' | 'deny' }
  onAllow: () => void
  onDeny: () => void
}

export function PermissionCard({ perm, onAllow, onDeny }: PermissionCardProps) {
  const displayName = (API_DISPLAY_NAMES as Record<string, string>)[perm.api] ?? perm.api
  const isResolved = !!perm.resolved

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <ShieldAlert size={13} className="text-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-amber-400">Permission Required</span>
      </div>
      <p className="text-[11px] text-[var(--color-text-primary)] leading-relaxed mb-2">
        <span className="font-semibold">{displayName}</span> wants to run{' '}
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{perm.toolName}</span>
        <span className="text-[var(--color-text-muted)]"> ({perm.estimatedCost})</span>
      </p>
      {isResolved ? (
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide ${
            perm.resolved === 'allow' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {perm.resolved === 'allow' ? 'Allowed' : 'Denied'}
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <span
            onClick={onAllow}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/25 transition-colors select-none"
          >
            Allow
          </span>
          <span
            onClick={onDeny}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/25 cursor-pointer hover:bg-red-500/20 transition-colors select-none"
          >
            Deny
          </span>
        </div>
      )}
    </div>
  )
}

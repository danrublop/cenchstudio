'use client'

import { ShieldAlert } from 'lucide-react'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import {
  PERM_BODY_CLASS,
  PERM_HEADER_CLASS,
  PERM_HEADER_ICON_CLASS,
  PermissionActionFooter,
} from '@/components/GenerationConfirmCard'

export interface PermissionCardProps {
  perm: { api: string; estimatedCost: string; toolName: string; resolved?: 'allow' | 'deny' }
  onAllow: () => void
  onDeny: () => void
}

export function PermissionCard({ perm, onAllow, onDeny }: PermissionCardProps) {
  const displayName = (API_DISPLAY_NAMES as Record<string, string>)[perm.api] ?? perm.api
  const isResolved = !!perm.resolved

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
      <div className={PERM_HEADER_CLASS}>
        <ShieldAlert size={16} className={PERM_HEADER_ICON_CLASS} strokeWidth={2} />
        <span className="text-[13px] font-semibold text-[#141820]">Permission required</span>
      </div>
      <div className={PERM_BODY_CLASS}>
        <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">
          <span className="font-semibold">{displayName}</span> wants to run{' '}
          <span className="font-mono text-[12px] text-[var(--color-text-muted)]">{perm.toolName}</span>
          <span className="text-[var(--color-text-muted)]"> ({perm.estimatedCost})</span>
        </p>
        {isResolved ? (
          <p
            className={`text-[12px] font-semibold ${
              perm.resolved === 'allow' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {perm.resolved === 'allow' ? 'Allowed' : 'Denied'}
          </p>
        ) : (
          <PermissionActionFooter onCancel={onDeny} onGenerate={onAllow} active />
        )}
      </div>
    </div>
  )
}

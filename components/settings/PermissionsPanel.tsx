'use client'

import { ShieldCheck } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import type { APIName, PermissionMode, PermissionConfig } from '@/lib/types'

export default function PermissionsPanel() {
  const { modelConfigs, project, updateAPIPermissions } = useVideoStore()
  const permissions = project.apiPermissions ?? {}
  const externalApis: APIName[] = ['heygen', 'veo3', 'imageGen', 'backgroundRemoval', 'elevenLabs', 'unsplash']

  const activeApis = externalApis.filter(api => permissions[api]?.mode !== 'always_deny')
  const activeModels = modelConfigs.filter(m => m.enabled)

  return (
    <div className="space-y-4">
      {(activeApis.length === 0 && activeModels.length === 0) ? (
        <div className="text-center py-8 text-[#6b6b7a] flex flex-col items-center gap-2">
          <ShieldCheck size={24} className="opacity-20" />
          <p className="text-[11px]">No active modules or models enabled.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeApis.map((api) => (
            <PermissionConfigRow key={api} type="api" name={api} />
          ))}
          {activeModels.map((model) => (
            <PermissionConfigRow key={model.id} type="model" name={model.id} displayName={model.displayName} />
          ))}
        </div>
      )}
    </div>
  )
}

function PermissionConfigRow({ type, name, displayName }: { type: 'api' | 'model', name: string, displayName?: string }) {
  const { project, updateAPIPermissions } = useVideoStore()
  const permissions = project.apiPermissions ?? {}
  const label = type === 'api' ? API_DISPLAY_NAMES[name as APIName] : (displayName ?? name)
  const config = type === 'api' ? (permissions[name as APIName] as PermissionConfig) : null

  const updateMode = (mode: PermissionMode) => {
    if (type === 'api') {
      updateAPIPermissions({ [name as APIName]: { ...(config ?? {}), mode } } as any)
    }
  }

  const updateLimit = (val: string) => {
    if (type === 'api') {
      updateAPIPermissions({ [name as APIName]: { ...(config ?? {}), monthlyLimit: val ? parseFloat(val) : null } } as any)
    }
  }

  return (
    <div className="p-3 rounded-lg border bg-[var(--color-panel-bg)] border-[var(--color-border)] shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-tight text-[var(--color-text-primary)]">{label}</span>
        <span className="text-[8px] uppercase px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[#6b6b7a]">
          {type === 'api' ? 'Module' : 'LLM'}
        </span>
      </div>

      {type === 'api' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[8px] text-[#6b6b7a] uppercase block mb-1">Permission Mode</label>
            <select
              value={config?.mode ?? 'always_ask'}
              onChange={(e) => updateMode(e.target.value as PermissionMode)}
              className="w-full text-[10px] p-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] outline-none"
            >
              <option value="always_ask">Always Ask</option>
              <option value="always_allow">Always Allow</option>
              <option value="ask_once">Ask Once</option>
            </select>
          </div>
          <div>
            <label className="text-[8px] text-[#6b6b7a] uppercase block mb-1">Monthly Limit ($)</label>
            <input
              type="number"
              placeholder="No Limit"
              value={config?.monthlyLimit ?? ''}
              onChange={(e) => updateLimit(e.target.value)}
              className="w-full text-[10px] p-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-[#6b6b7a] italic">
          LLM usage permissions are currently inherited from Global Provider settings.
        </div>
      )}
    </div>
  )
}

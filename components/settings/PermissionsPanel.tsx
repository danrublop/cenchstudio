'use client'

import { ShieldCheck, Trash2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import type { APIName, PermissionMode, PermissionConfig } from '@/lib/types'
import {
  PERMISSION_DECISIONS,
  PERMISSION_SCOPES,
  type PermissionRule,
  type PermissionScope,
  type PermissionDecision,
} from '@/lib/types/permissions'

export default function PermissionsPanel() {
  const { modelConfigs, project, updateAPIPermissions } = useVideoStore()
  const permissions = project.apiPermissions ?? {}
  const externalApis: APIName[] = [
    'heygen',
    'veo3',
    'imageGen',
    'backgroundRemoval',
    'elevenLabs',
    'unsplash',
    'googleTts',
    'googleImageGen',
    'openaiTts',
    'geminiTts',
    'freesound',
    'pixabay',
  ]

  const activeApis = externalApis.filter((api) => permissions[api]?.mode !== 'always_deny')
  const activeModels = modelConfigs.filter((m) => m.enabled)

  return (
    <div className="space-y-6">
      <RulesSection />

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b7a] mb-2">Cost Limits</h3>
        {activeApis.length === 0 && activeModels.length === 0 ? (
          <div className="text-center py-8 text-[#6b6b7a] flex flex-col items-center gap-2">
            <ShieldCheck size={24} className="opacity-20" />
            <p className="text-[12px]">No active modules or models enabled.</p>
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
    </div>
  )
}

// ── Layered permission rules UI ────────────────────────────────────────────

function RulesSection() {
  const {
    permissionRules,
    refreshPermissionRules,
    createPermissionRule,
    deletePermissionRule,
    project,
    activeConversationId,
  } = useVideoStore()

  useEffect(() => {
    void refreshPermissionRules()
  }, [refreshPermissionRules])

  const grouped: Record<PermissionScope, PermissionRule[]> = {
    user: [],
    workspace: [],
    project: [],
    session: [],
  }
  for (const rule of permissionRules) grouped[rule.scope].push(rule)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b7a]">Permission Rules</h3>
        <span className="text-[8px] text-[#6b6b7a]">Deny wins across scopes</span>
      </div>

      <AddRuleRow
        onCreate={createPermissionRule}
        projectId={project?.id ?? null}
        conversationId={activeConversationId}
      />

      <div className="space-y-2 mt-3">
        {PERMISSION_SCOPES.map((scope) => {
          const rows = grouped[scope]
          if (rows.length === 0) return null
          return (
            <div key={scope}>
              <div className="text-[8px] uppercase tracking-wider text-[#6b6b7a] mb-1">{scope}</div>
              <div className="space-y-1">
                {rows.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} onDelete={deletePermissionRule} />
                ))}
              </div>
            </div>
          )
        })}
        {permissionRules.length === 0 && (
          <p className="text-[11px] text-[#6b6b7a] italic">No rules yet. Approve a call or add one above.</p>
        )}
      </div>
    </div>
  )
}

const RULE_APIS: Array<APIName | '*'> = [
  '*',
  'heygen',
  'veo3',
  'kling',
  'runway',
  'imageGen',
  'imageEnhance',
  'backgroundRemoval',
  'elevenLabs',
  'unsplash',
  'googleTts',
  'googleImageGen',
  'openaiTts',
  'geminiTts',
  'freesound',
  'pixabay',
  'falAvatar',
]

function AddRuleRow({
  onCreate,
  projectId,
  conversationId,
}: {
  onCreate: (input: Omit<PermissionRule, 'id' | 'userId' | 'createdAt'>) => Promise<PermissionRule | null>
  projectId: string | null
  conversationId: string | null
}) {
  const [decision, setDecision] = useState<PermissionDecision>('allow')
  const [api, setApi] = useState<APIName | '*'>('freesound')
  const [scope, setScope] = useState<PermissionScope>('user')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      await onCreate({
        scope,
        workspaceId: null,
        projectId: scope === 'project' ? projectId : null,
        conversationId: scope === 'session' ? conversationId : null,
        decision,
        api,
        specifier: null,
        costCapUsd: null,
        expiresAt: null,
        createdBy: 'user-settings',
        notes: null,
      })
    } finally {
      setBusy(false)
    }
  }

  const scopeDisabled = (scope === 'project' && !projectId) || (scope === 'session' && !conversationId)

  return (
    <div className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-panel-bg)] flex gap-1.5 items-center">
      <select
        value={decision}
        onChange={(e) => setDecision(e.target.value as PermissionDecision)}
        className="text-[11px] p-1 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)]"
      >
        {PERMISSION_DECISIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={api}
        onChange={(e) => setApi(e.target.value as APIName | '*')}
        className="flex-1 text-[11px] p-1 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)]"
      >
        {RULE_APIS.map((a) => (
          <option key={a} value={a}>
            {a === '*' ? 'any api' : a}
          </option>
        ))}
      </select>
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value as PermissionScope)}
        className="text-[11px] p-1 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)]"
      >
        {PERMISSION_SCOPES.map((s) => (
          <option key={s} value={s} disabled={(s === 'project' && !projectId) || (s === 'session' && !conversationId)}>
            {s}
          </option>
        ))}
      </select>
      <button
        onClick={submit}
        disabled={busy || scopeDisabled}
        className="p-1 rounded border border-[var(--color-border)] hover:bg-white/5 disabled:opacity-40"
        aria-label="Add rule"
      >
        <Plus size={12} />
      </button>
    </div>
  )
}

function RuleRow({ rule, onDelete }: { rule: PermissionRule; onDelete: (id: string) => Promise<boolean> }) {
  const specifierText = rule.specifier ? formatSpecifierSummary(rule.specifier) : null
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-panel-bg)]">
      <span
        className="text-[10px] font-mono uppercase px-1 py-0.5 rounded"
        style={{
          backgroundColor:
            rule.decision === 'allow'
              ? 'rgba(34,197,94,0.12)'
              : rule.decision === 'deny'
                ? 'rgba(239,68,68,0.12)'
                : 'rgba(245,158,11,0.12)',
          color: rule.decision === 'allow' ? '#22c55e' : rule.decision === 'deny' ? '#ef4444' : '#f59e0b',
        }}
      >
        {rule.decision}
      </span>
      <span className="text-[11px] font-medium">{rule.api}</span>
      {specifierText && <span className="text-[10px] text-[#6b6b7a]">({specifierText})</span>}
      {rule.costCapUsd !== null && (
        <span className="text-[10px] text-amber-400">cap ${rule.costCapUsd.toFixed(2)}</span>
      )}
      <span className="ml-auto text-[9px] text-[#6b6b7a] uppercase">{rule.createdBy}</span>
      <button
        onClick={() => onDelete(rule.id)}
        className="p-1 rounded hover:bg-white/10 text-[#6b6b7a] hover:text-red-400"
        aria-label="Delete rule"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

function formatSpecifierSummary(s: import('@/lib/types/permissions').RuleSpecifier): string {
  const parts: string[] = []
  if (s.provider) parts.push(`provider:${s.provider}`)
  if (s.model) parts.push(`model:${s.model}`)
  if (s.durationMax !== undefined) parts.push(`≤${s.durationMax}s`)
  if (s.durationMin !== undefined) parts.push(`≥${s.durationMin}s`)
  if (s.costMax !== undefined) parts.push(`≤$${s.costMax}`)
  return parts.join(', ')
}

function PermissionConfigRow({
  type,
  name,
  displayName,
}: {
  type: 'api' | 'model'
  name: string
  displayName?: string
}) {
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
      updateAPIPermissions({
        [name as APIName]: { ...(config ?? {}), monthlyLimit: val ? parseFloat(val) : null },
      } as any)
    }
  }

  return (
    <div className="p-3 rounded-lg border bg-[var(--color-panel-bg)] border-[var(--color-border)] shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-1">
        <span className="text-[12px] font-bold uppercase tracking-tight text-[var(--color-text-primary)]">{label}</span>
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
              className="w-full text-[11px] p-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] outline-none"
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
              className="w-full text-[11px] p-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-[#6b6b7a] italic">
          LLM usage permissions are currently inherited from Global Provider settings.
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ShieldAlert, ChevronDown, Pencil } from 'lucide-react'
import { API_DISPLAY_NAMES } from '@/lib/permissions'
import type { PendingPermission } from '@/lib/agents/types'

interface Props {
  perm: PendingPermission
  onAllow: (overrides?: { provider?: string; prompt?: string; config?: Record<string, any> }) => void
  onDeny: () => void
  onAutoChoose?: (genType: string, defaults: { provider: string; config: Record<string, any> }) => void
}

export default function GenerationConfirmCard({ perm, onAllow, onDeny, onAutoChoose }: Props) {
  const displayName = (API_DISPLAY_NAMES as Record<string, string>)[perm.api] ?? perm.api

  // If no rich context, render the simple card
  if (!perm.generationType) {
    return <SimplePermissionCard perm={perm} displayName={displayName} onAllow={() => onAllow()} onDeny={onDeny} />
  }

  return (
    <RichConfirmCard
      perm={perm}
      displayName={displayName}
      onAllow={onAllow}
      onDeny={onDeny}
      onAutoChoose={onAutoChoose}
    />
  )
}

// ── Simple card (backward compat) ──────────────────────────────────────────

function SimplePermissionCard({
  perm,
  displayName,
  onAllow,
  onDeny,
}: {
  perm: PendingPermission
  displayName: string
  onAllow: () => void
  onDeny: () => void
}) {
  if (perm.resolved) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldAlert size={13} className="text-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-amber-400">Permission Required</span>
        </div>
        <p className="text-[11px] text-[var(--color-text-primary)] leading-relaxed mb-2">
          <span className="font-semibold">{displayName}</span>{' '}
          <span className="text-[var(--color-text-muted)]">({perm.estimatedCost})</span>
        </p>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide ${
            perm.resolved === 'allow' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {perm.resolved === 'allow' ? 'Allowed — retry your message' : 'Denied'}
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <ShieldAlert size={13} className="text-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-amber-400">Permission Required</span>
      </div>
      <p className="text-[11px] text-[var(--color-text-primary)] leading-relaxed mb-2">
        <span className="font-semibold">{displayName}</span>{' '}
        <span className="text-[var(--color-text-muted)]">({perm.estimatedCost})</span>
      </p>
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
    </div>
  )
}

// ── Rich generation confirmation card ──────────────────────────────────────

const GEN_TYPE_LABELS: Record<string, string> = {
  avatar: 'Avatar Generation',
  image: 'Image Generation',
  tts: 'Text-to-Speech',
  sfx: 'Sound Effect',
  music: 'Background Music',
  video: 'Video Generation',
}

function RichConfirmCard({
  perm,
  displayName,
  onAllow,
  onDeny,
  onAutoChoose,
}: {
  perm: PendingPermission
  displayName: string
  onAllow: (overrides?: { provider?: string; prompt?: string; config?: Record<string, any> }) => void
  onDeny: () => void
  onAutoChoose?: (genType: string, defaults: { provider: string; config: Record<string, any> }) => void
}) {
  const [selectedProvider, setSelectedProvider] = useState(perm.provider ?? '')
  const [editedPrompt, setEditedPrompt] = useState(perm.prompt ?? '')
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<Record<string, any>>(perm.config ?? {})
  const [autoChoose, setAutoChoose] = useState(false)
  const [showProviderMenu, setShowProviderMenu] = useState(false)

  if (perm.resolved) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert size={13} className="text-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-amber-400">
            {GEN_TYPE_LABELS[perm.generationType!] ?? displayName}
          </span>
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide ${
            perm.resolved === 'allow' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {perm.resolved === 'allow' ? 'Allowed' : 'Denied'}
        </span>
      </div>
    )
  }

  const availableProviders = perm.availableProviders ?? []
  const currentProviderInfo = availableProviders.find((p) => p.id === selectedProvider)
  const costDisplay = currentProviderInfo?.cost ?? perm.estimatedCost
  const isFreeProvider = currentProviderInfo?.isFree ?? false

  const handleAllow = () => {
    const overrides: { provider?: string; prompt?: string; config?: Record<string, any> } = {}
    if (selectedProvider !== perm.provider) overrides.provider = selectedProvider
    if (editedPrompt !== perm.prompt) overrides.prompt = editedPrompt
    if (JSON.stringify(selectedConfig) !== JSON.stringify(perm.config)) overrides.config = selectedConfig

    if (autoChoose && perm.generationType && onAutoChoose) {
      onAutoChoose(perm.generationType, { provider: selectedProvider, config: selectedConfig })
    }

    onAllow(Object.keys(overrides).length > 0 ? overrides : undefined)
  }

  // If user switched to a free provider, auto-allow
  const handleProviderSwitch = (pid: string) => {
    setSelectedProvider(pid)
    setShowProviderMenu(false)
    setSelectedConfig({})
    const provInfo = availableProviders.find((p) => p.id === pid)
    if (provInfo?.isFree) {
      // Auto-allow for free providers
      onAllow({ provider: pid })
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={13} className="text-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-amber-400">
            {GEN_TYPE_LABELS[perm.generationType!] ?? displayName}
          </span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">{costDisplay}</span>
      </div>

      {/* Provider selector */}
      {availableProviders.length > 1 && (
        <div className="relative">
          <label className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-tight">
            Provider
          </label>
          <div
            onClick={() => setShowProviderMenu((o) => !o)}
            className="mt-0.5 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer hover:border-[var(--color-text-muted)] transition-colors"
          >
            <span className="text-[11px] text-[var(--color-text-primary)] font-medium">
              {currentProviderInfo?.name ?? selectedProvider}
            </span>
            <div className="flex items-center gap-1.5">
              {isFreeProvider && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 font-bold uppercase">
                  Free
                </span>
              )}
              <ChevronDown size={10} className="text-[var(--color-text-muted)]" />
            </div>
          </div>

          {showProviderMenu && (
            <div className="absolute top-full left-0 right-0 mt-0.5 z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl py-0.5 overflow-hidden">
              {availableProviders.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleProviderSwitch(p.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 cursor-pointer hover:bg-[var(--color-border)]/30 transition-colors ${
                    p.id === selectedProvider ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="text-[11px] font-medium">{p.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[var(--color-text-muted)]">{p.cost}</span>
                    {p.isFree && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 font-bold uppercase">
                        Free
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompt editor */}
      {perm.prompt && (
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-tight">
              {perm.generationType === 'tts' ? 'Text' : 'Prompt'}
            </label>
            <span
              onClick={() => setIsEditingPrompt((e) => !e)}
              className="text-[9px] text-[var(--color-accent)] cursor-pointer hover:underline flex items-center gap-0.5"
            >
              <Pencil size={8} />
              {isEditingPrompt ? 'Done' : 'Edit'}
            </span>
          </div>
          {isEditingPrompt ? (
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              rows={3}
              className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-accent)]/50"
            />
          ) : (
            <p className="text-[11px] text-[var(--color-text-primary)] leading-relaxed bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5 max-h-16 overflow-y-auto">
              {editedPrompt.length > 200 ? editedPrompt.slice(0, 200) + '…' : editedPrompt}
            </p>
          )}
        </div>
      )}

      {/* Provider-specific config */}
      {perm.generationType === 'avatar' && selectedProvider === 'talkinghead' && (
        <div>
          <label className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-tight">
            Character
          </label>
          <div className="flex gap-1.5 mt-0.5">
            {['friendly', 'professional', 'energetic'].map((ch) => (
              <span
                key={ch}
                onClick={() => setSelectedConfig((prev) => ({ ...prev, characterFile: ch }))}
                className={`px-2.5 py-1 rounded-md border text-[10px] cursor-pointer transition-colors capitalize ${
                  (selectedConfig.characterFile || 'friendly') === ch
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {perm.generationType === 'avatar' && ['musetalk', 'fabric', 'aurora'].includes(selectedProvider) && (
        <div>
          <label className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-tight">
            Source Image
          </label>
          <input
            type="text"
            value={selectedConfig.sourceImageUrl ?? ''}
            onChange={(e) => setSelectedConfig((prev) => ({ ...prev, sourceImageUrl: e.target.value }))}
            placeholder="Image URL"
            className="mt-0.5 w-full text-[11px] px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none"
          />
        </div>
      )}

      {perm.generationType === 'image' && (
        <div className="flex gap-2">
          {perm.config?.style && (
            <div className="flex-1">
              <label className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-tight">
                Style
              </label>
              <p className="text-[11px] text-[var(--color-text-primary)] mt-0.5">{perm.config.style}</p>
            </div>
          )}
          {perm.config?.aspectRatio && (
            <div>
              <label className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-tight">
                Aspect
              </label>
              <p className="text-[11px] text-[var(--color-text-primary)] mt-0.5">{perm.config.aspectRatio}</p>
            </div>
          )}
        </div>
      )}

      {/* Auto-choose checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoChoose}
          onChange={(e) => setAutoChoose(e.target.checked)}
          className="accent-[var(--color-accent)] w-3 h-3"
        />
        <span className="text-[10px] text-[var(--color-text-muted)]">Auto-choose (agent picks for me next time)</span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <span
          onClick={handleAllow}
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
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { ToggleLeft, ToggleRight, Upload, Check, Loader2, Trash2, DollarSign } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { MEDIA_PROVIDERS } from '@/lib/media/provider-registry'
import { useConfiguredProviders } from '@/lib/hooks/useConfiguredProviders'
import { SectionLabel, ListContainer, KeyInputRow } from './shared'

// ── Avatar Provider Toggle List (system-level, same style as Audio/MediaGen) ──

const AVATAR_PROVIDERS = MEDIA_PROVIDERS.filter((p) => p.category === 'avatar')

const AVATAR_API_KEYS: { provider: string; label: string; envVar: string }[] = [
  { provider: 'heygen', label: 'HeyGen', envVar: 'HEYGEN_API_KEY' },
  { provider: 'fal', label: 'FAL (MuseTalk, Fabric, Aurora)', envVar: 'FAL_KEY' },
]

export function AvatarProvidersSection() {
  const { mediaGenEnabled, toggleMediaGen } = useVideoStore()
  const configuredProviders = useConfiguredProviders()

  return (
    <div className="space-y-10">
      {/* Avatar Providers */}
      <div>
        <SectionLabel>Avatar Providers</SectionLabel>
        <ListContainer>
          {AVATAR_PROVIDERS.map((p) => {
            const isConfigured = configuredProviders.media.has(p.id)
            const isEnabled = isConfigured && (mediaGenEnabled[p.id] ?? p.defaultEnabled)
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 py-2 px-1 ${!isConfigured ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                    {p.name}
                  </span>
                  {!p.requiresKey && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-green-400 bg-green-400/10 border-green-400/30 uppercase tracking-tighter">
                      free
                    </span>
                  )}
                  {p.requiresKey === 'FAL_KEY' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-purple-400 bg-purple-400/10 border-purple-400/30 uppercase tracking-tighter">
                      fal.ai
                    </span>
                  )}
                  {!isConfigured && p.requiresKey && (
                    <span className="text-[10px] text-[var(--color-text-muted)] truncate">Set {p.requiresKey}</span>
                  )}
                </div>
                <span
                  onClick={() => isConfigured && toggleMediaGen(p.id)}
                  className={`select-none ${isConfigured ? 'cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all' : 'cursor-not-allowed'}`}
                >
                  {isEnabled ? (
                    <ToggleRight size={22} className="text-[var(--color-accent)]" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                </span>
              </div>
            )
          })}
        </ListContainer>
      </div>

      {/* API Keys */}
      <div>
        <SectionLabel>API Keys</SectionLabel>
        <p className="text-[11px] text-[#6b6b7a] px-1 mb-2 -mt-1">
          Set in{' '}
          <code className="text-[10px] px-1 py-0.5 rounded bg-white/5 border border-[var(--color-border)]">.env</code>
        </p>
        <div className="grid grid-cols-1 gap-1">
          {AVATAR_API_KEYS.map((k) => (
            <KeyInputRow key={k.provider} provider={k.provider} label={k.label} envVar={k.envVar} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Avatar Config (project-level, configures which provider + settings) ───────

interface AvatarConfig {
  id: string
  projectId: string
  provider: string
  config: Record<string, any>
  name: string
  thumbnailUrl: string | null
  isDefault: boolean
  createdAt: string
}

const PROVIDER_INFO: Record<string, { desc: string; cost: string; needsImage: boolean }> = {
  talkinghead: { desc: '3D animated character, renders in-browser', cost: 'Free', needsImage: false },
  musetalk: { desc: 'Photorealistic lip sync', cost: '~$0.04/scene', needsImage: true },
  fabric: { desc: 'Animate any photo or illustration', cost: '~$0.08–0.15/scene', needsImage: true },
  aurora: { desc: 'Studio quality, natural body language', cost: '~$0.05/scene', needsImage: true },
  heygen: { desc: 'Premium quality via HeyGen account', cost: 'HeyGen pricing', needsImage: false },
}

const CHARACTER_OPTIONS = [
  { id: 'friendly', label: 'Friendly', desc: 'Warm, approachable' },
  { id: 'professional', label: 'Professional', desc: 'Formal, neutral' },
  { id: 'energetic', label: 'Energetic', desc: 'Casual, expressive' },
]

export function AvatarSettingsTab() {
  const { project, mediaGenEnabled } = useVideoStore()
  const projectId = project?.id

  const [configs, setConfigs] = useState<AvatarConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedProvider, setSelectedProvider] = useState('talkinghead')
  const [configName, setConfigName] = useState('Default Avatar')
  const [providerConfig, setProviderConfig] = useState<Record<string, any>>({})

  // Only show providers that are enabled in system settings
  const enabledProviders = Object.keys(PROVIDER_INFO).filter((pid) => mediaGenEnabled[pid] ?? true)

  const fetchConfigs = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.avatarConfigs : undefined
      const data = ipc
        ? await ipc.list({ projectId })
        : await (await fetch(`/api/projects/${projectId}/avatar-configs`)).json()
      setConfigs((data.configs as AvatarConfig[]) ?? [])
      const def = ((data.configs as AvatarConfig[]) ?? []).find((c: AvatarConfig) => c.isDefault)
      if (def) {
        setSelectedProvider(def.provider)
        setConfigName(def.name)
        setProviderConfig(def.config ?? {})
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const saveConfig = async () => {
    if (!projectId) return
    setSaving(true)
    try {
      const existing = configs.find((c) => c.isDefault)
      const body = {
        provider: selectedProvider,
        name: configName,
        config: providerConfig,
        isDefault: true,
      }
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.avatarConfigs : undefined
      if (ipc) {
        if (existing) {
          await ipc.update({ projectId, configId: existing.id, ...body })
        } else {
          await ipc.create({ projectId, ...body })
        }
      } else if (existing) {
        await fetch(`/api/projects/${projectId}/avatar-configs/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        await fetch(`/api/projects/${projectId}/avatar-configs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      await fetchConfigs()
    } catch {
      /* ignore */
    }
    setSaving(false)
  }

  const deleteConfig = async (id: string) => {
    if (!projectId) return
    const ipc = typeof window !== 'undefined' ? window.cenchApi?.avatarConfigs : undefined
    if (ipc) {
      await ipc.delete({ projectId, configId: id })
    } else {
      await fetch(`/api/projects/${projectId}/avatar-configs/${id}`, { method: 'DELETE' })
    }
    await fetchConfigs()
  }

  if (!projectId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Open a project to configure avatars.</p>
  }

  const info = PROVIDER_INFO[selectedProvider]

  return (
    <div className="space-y-6">
      {/* Active provider selector */}
      <div>
        <SectionLabel>Active Provider</SectionLabel>
        <ListContainer>
          {enabledProviders.map((pid) => {
            const pi = PROVIDER_INFO[pid]
            const isSelected = selectedProvider === pid
            return (
              <div
                key={pid}
                onClick={() => {
                  setSelectedProvider(pid)
                  setProviderConfig({})
                }}
                className={`flex items-center justify-between gap-3 py-2.5 px-2 cursor-pointer rounded transition-colors ${
                  isSelected ? 'bg-[var(--color-accent)]/5' : 'hover:bg-[var(--color-border)]/20'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                  />
                  <div className="min-w-0">
                    <span className="text-sm text-[var(--color-text-primary)] font-semibold leading-none">{pid}</span>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">{pi?.desc}</p>
                  </div>
                </div>
                <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">{pi?.cost}</span>
              </div>
            )
          })}
        </ListContainer>
        {enabledProviders.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-muted)] px-1">
            No avatar providers enabled. Enable them in Settings &gt; Media Gen.
          </p>
        )}
      </div>

      {/* Provider-specific config */}
      <div className="space-y-3">
        <SectionLabel>Provider Settings</SectionLabel>

        {/* TalkingHead: character picker */}
        {selectedProvider === 'talkinghead' && (
          <div className="space-y-2">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase font-bold">Character</label>
            <div className="flex gap-2">
              {CHARACTER_OPTIONS.map((ch) => (
                <span
                  key={ch.id}
                  onClick={() => setProviderConfig((prev) => ({ ...prev, characterFile: ch.id }))}
                  className={`flex-1 text-center py-2 px-3 rounded-lg border cursor-pointer text-sm transition-colors ${
                    (providerConfig.characterFile || 'friendly') === ch.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                  }`}
                >
                  <div className="font-medium">{ch.label}</div>
                  <div className="text-[11px] opacity-70">{ch.desc}</div>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* fal.ai providers: source image */}
        {info?.needsImage && (
          <div className="space-y-2">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase font-bold">
              Avatar Source Image
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={providerConfig.sourceImageUrl ?? ''}
                onChange={(e) => setProviderConfig((prev) => ({ ...prev, sourceImageUrl: e.target.value }))}
                placeholder="Image URL or upload path"
                className="flex-1 text-sm px-3 py-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)]"
              />
              <span className="p-1.5 text-[var(--color-text-muted)]">
                <Upload size={14} />
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Face photo, illustration, or any image to animate as a talking avatar.
            </p>
          </div>
        )}

        {/* Fabric: resolution */}
        {selectedProvider === 'fabric' && (
          <div className="space-y-2">
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase font-bold">Resolution</label>
            <div className="flex gap-2">
              {['480p', '720p'].map((res) => (
                <span
                  key={res}
                  onClick={() => setProviderConfig((prev) => ({ ...prev, resolution: res }))}
                  className={`px-4 py-1.5 rounded border cursor-pointer text-sm transition-colors ${
                    (providerConfig.resolution || '480p') === res
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {res}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* HeyGen: avatar + voice IDs */}
        {selectedProvider === 'heygen' && (
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-[var(--color-text-muted)] uppercase font-bold">Avatar ID</label>
              <input
                type="text"
                value={providerConfig.avatarId ?? ''}
                onChange={(e) => setProviderConfig((prev) => ({ ...prev, avatarId: e.target.value }))}
                placeholder="HeyGen avatar ID"
                className="w-full text-sm px-3 py-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--color-text-muted)] uppercase font-bold">Voice ID</label>
              <input
                type="text"
                value={providerConfig.voiceId ?? ''}
                onChange={(e) => setProviderConfig((prev) => ({ ...prev, voiceId: e.target.value }))}
                placeholder="HeyGen voice ID"
                className="w-full text-sm px-3 py-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cost estimate */}
      {info && info.cost !== 'Free' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
          <DollarSign size={14} className="text-yellow-400 flex-shrink-0" />
          <p className="text-[12px] text-[var(--color-text-muted)]">
            At ~5 scenes/video, avatar generation costs approximately{' '}
            <span className="text-[var(--color-text-primary)] font-medium">
              {selectedProvider === 'musetalk'
                ? '$0.20'
                : selectedProvider === 'aurora'
                  ? '$2.00'
                  : selectedProvider === 'fabric'
                    ? '$3.20'
                    : selectedProvider === 'heygen'
                      ? '$4.00'
                      : '$0'}
            </span>{' '}
            per video.
          </p>
        </div>
      )}

      {/* Save */}
      <span
        onClick={saveConfig}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
          saving
            ? 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
            : 'bg-[var(--color-accent)] text-white hover:opacity-90'
        }`}
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        {saving ? 'Saving…' : 'Save Avatar Config'}
      </span>

      {/* Existing configs */}
      {configs.length > 0 && (
        <div>
          <SectionLabel>Saved Configs</SectionLabel>
          <ListContainer>
            {configs.map((cfg) => (
              <div key={cfg.id} className="flex items-center justify-between py-2 px-1">
                <div>
                  <span className="text-sm text-[var(--color-text-primary)] font-medium">{cfg.name}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] ml-2">{cfg.provider}</span>
                  {cfg.isDefault && (
                    <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-bold">
                      DEFAULT
                    </span>
                  )}
                </div>
                <span
                  onClick={() => deleteConfig(cfg.id)}
                  className="p-1 text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer transition-colors"
                >
                  <Trash2 size={12} />
                </span>
              </div>
            ))}
          </ListContainer>
        </div>
      )}
    </div>
  )
}

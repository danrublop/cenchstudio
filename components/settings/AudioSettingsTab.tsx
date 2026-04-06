'use client'

import { useState } from 'react'
import { ToggleLeft, ToggleRight, Volume2, Search, Loader2, Check } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { AUDIO_PROVIDERS, AUDIO_API_KEYS } from '@/lib/audio/provider-registry'
import { SectionLabel, ListContainer, KeyInputRow } from './shared'

export function AudioSettingsTab() {
  const { audioProviderEnabled, toggleAudioProvider, audioSettings, updateAudioSettings } = useVideoStore()
  const [detectingEdge, setDetectingEdge] = useState(false)
  const [edgeStatus, setEdgeStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const ttsProviders = AUDIO_PROVIDERS.filter((p) => p.category === 'tts')
  const sfxProviders = AUDIO_PROVIDERS.filter((p) => p.category === 'sfx')
  const musicProviders = AUDIO_PROVIDERS.filter((p) => p.category === 'music')

  return (
    <div className="space-y-10">
      {/* TTS Providers */}
      <div>
        <SectionLabel>TTS Providers</SectionLabel>
        <ListContainer>
          {ttsProviders.map((p) => {
            const isEnabled = audioProviderEnabled[p.id] ?? p.defaultEnabled
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                    {p.name}
                  </span>
                  {p.type === 'client' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-blue-400 bg-blue-400/10 border-blue-400/30 uppercase tracking-tighter">
                      browser
                    </span>
                  )}
                  {p.type === 'local' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-green-400 bg-green-400/10 border-green-400/30 uppercase tracking-tighter">
                      local
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleAudioProvider(p.id)}
                  className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all"
                >
                  {isEnabled ? (
                    <ToggleRight size={22} className="text-[var(--color-accent)]" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                </button>
              </div>
            )
          })}
        </ListContainer>
      </div>

      {/* SFX Providers */}
      <div>
        <SectionLabel>Sound Effects</SectionLabel>
        <ListContainer>
          {sfxProviders.map((p) => {
            const isEnabled = audioProviderEnabled[p.id] ?? p.defaultEnabled
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 px-1">
                <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                  {p.name}
                </span>
                <button
                  onClick={() => toggleAudioProvider(p.id)}
                  className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all"
                >
                  {isEnabled ? (
                    <ToggleRight size={22} className="text-[var(--color-accent)]" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                </button>
              </div>
            )
          })}
        </ListContainer>
      </div>

      {/* Music Providers */}
      <div>
        <SectionLabel>Background Music</SectionLabel>
        <ListContainer>
          {musicProviders.map((p) => {
            const isEnabled = audioProviderEnabled[p.id] ?? p.defaultEnabled
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 px-1">
                <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                  {p.name}
                </span>
                <button
                  onClick={() => toggleAudioProvider(p.id)}
                  className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all"
                >
                  {isEnabled ? (
                    <ToggleRight size={22} className="text-[var(--color-accent)]" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                </button>
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
          {AUDIO_API_KEYS.map((k) => (
            <KeyInputRow key={k.provider} provider={k.provider} label={k.label} envVar={k.envVar} />
          ))}
        </div>
      </div>

      {/* Local Servers */}
      <div>
        <SectionLabel>Local Servers</SectionLabel>
        <KeyInputRow
          provider="openai-edge-tts"
          label="Edge TTS"
          envVar="EDGE_TTS_URL"
          extraAction={
            <button
              onClick={async () => {
                if (detectingEdge) return
                setDetectingEdge(true)
                setEdgeStatus('idle')
                try {
                  const endpoint = audioSettings.edgeTTSUrl || 'http://localhost:5050'
                  const res = await fetch(`${endpoint}/v1/voices`, { signal: AbortSignal.timeout(3000) }).catch(
                    () => null,
                  )
                  setEdgeStatus(res?.ok ? 'ok' : 'fail')
                } catch {
                  setEdgeStatus('fail')
                }
                setDetectingEdge(false)
              }}
              disabled={detectingEdge}
              className="no-style p-1 text-[var(--color-accent)] hover:opacity-80 transition-all disabled:opacity-40"
            >
              {detectingEdge ? (
                <Loader2 size={16} className="animate-spin" />
              ) : edgeStatus === 'ok' ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Search size={16} />
              )}
            </button>
          }
        />
        {edgeStatus === 'fail' && (
          <p className="text-[11px] text-red-400 px-1 mt-1">
            Edge TTS server not reachable. Run:{' '}
            <code className="text-[10px] px-1 py-0.5 rounded bg-white/5 border border-[var(--color-border)]">
              docker run -p 5050:5050 travisvn/openai-edge-tts
            </code>
          </p>
        )}
        {edgeStatus === 'ok' && <p className="text-[11px] text-green-400 px-1 mt-1">Edge TTS server connected.</p>}
      </div>

      {/* Settings */}
      <div>
        <SectionLabel>Settings</SectionLabel>
        <div className="space-y-3 px-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="tgl"
              id="settings-music-ducking"
              checked={audioSettings.globalMusicDucking}
              onChange={(e) => updateAudioSettings({ globalMusicDucking: e.target.checked })}
            />
            <label className="tgl-btn" htmlFor="settings-music-ducking" />
            <span className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>
              Duck music during narration
            </span>
          </div>
          {audioSettings.globalMusicDucking && (
            <div className="flex items-center gap-2">
              <Volume2 size={11} className="text-[var(--color-text-muted)]" />
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.05}
                value={audioSettings.globalMusicDuckLevel}
                onChange={(e) => updateAudioSettings({ globalMusicDuckLevel: parseFloat(e.target.value) })}
                className="flex-1 accent-[var(--color-accent)]"
              />
              <span className="text-[11px] w-8" style={{ color: 'var(--color-text-muted)' }}>
                {Math.round(audioSettings.globalMusicDuckLevel * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useRef } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'

interface VoiceCloneDialogProps {
  provider: string
  onClose: () => void
  onCloned: (voiceId: string, voiceName: string) => void
}

export function VoiceCloneDialog({ provider, onClose, onCloned }: VoiceCloneDialogProps) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [mode, setMode] = useState<'controllable' | 'ultimate'>('controllable')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isVoxcpm = provider === 'voxcpm'

  const handleSubmit = async () => {
    if (!name.trim() || !file) return
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('provider', provider)
      formData.append('name', name.trim())
      formData.append('audioFile', file)
      if (isVoxcpm) {
        formData.append('mode', mode)
        if (transcript.trim()) formData.append('transcript', transcript.trim())
      }

      const res = await fetch('/api/tts/clone-voice', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Clone failed')
        return
      }

      onCloned(data.voiceId, data.name)
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] rounded-lg border shadow-xl p-4"
        style={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Clone Voice
          </h3>
          <span
            onClick={onClose}
            className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X size={16} />
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Voice Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Voice"
              maxLength={100}
              className="w-full border rounded px-2 py-1.5 text-[12px]"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">
              Reference Audio (WAV or MP3)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="audio/wav,audio/mpeg,audio/mp3,.wav,.mp3"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <span
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 w-full border border-dashed rounded px-3 py-3 text-[12px] cursor-pointer hover:bg-white/5 transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <Upload size={14} />
              {file ? file.name : 'Click to upload audio file (max 10MB)'}
            </span>
          </div>

          {isVoxcpm && (
            <>
              <div>
                <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Clone Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'controllable' | 'ultimate')}
                  className="w-full border rounded px-2 py-1.5 text-[12px]"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="controllable">Controllable (adjust tone & pace)</option>
                  <option value="ultimate">Ultimate (exact reproduction)</option>
                </select>
              </div>
              {mode === 'ultimate' && (
                <div>
                  <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">
                    Transcript (optional, improves accuracy)
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="What is being said in the reference audio..."
                    rows={2}
                    className="w-full border rounded px-2 py-1.5 text-[12px] resize-none"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-input-bg)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <span
            onClick={loading ? undefined : handleSubmit}
            className={`flex items-center justify-center gap-2 w-full rounded px-3 py-2 text-[12px] font-semibold cursor-pointer transition-all ${
              !name.trim() || !file || loading ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? 'Cloning...' : 'Clone Voice'}
          </span>
        </div>
      </div>
    </div>
  )
}

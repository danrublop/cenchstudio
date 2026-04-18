'use client'
import { useState, useRef } from 'react'
import { X, Loader2, Play, Pause } from 'lucide-react'

interface VoiceDesignDialogProps {
  onClose: () => void
  onDesigned: (voiceId: string, voiceName: string) => void
}

export function VoiceDesignDialog({ onClose, onDesigned }: VoiceDesignDialogProps) {
  const [description, setDescription] = useState('')
  const [sampleText, setSampleText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ voiceId: string; name: string; previewUrl?: string | null } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handleGenerate = async () => {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.tts : undefined
      if (ipc) {
        try {
          const data = await ipc.designVoice({
            description: description.trim(),
            sampleText: sampleText.trim() || undefined,
          })
          setResult({ voiceId: data.voiceId, name: data.name, previewUrl: data.previewUrl })
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Voice design failed')
        }
      } else {
        const res = await fetch('/api/tts/design-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: description.trim(),
            sampleText: sampleText.trim() || undefined,
          }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Voice design failed')
          return
        }

        setResult({ voiceId: data.voiceId, name: data.name, previewUrl: data.previewUrl })
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = () => {
    if (!result?.previewUrl) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    const audio = new Audio(result.previewUrl)
    audio.onended = () => setIsPlaying(false)
    audio.play().catch(() => {})
    audioRef.current = audio
    setIsPlaying(true)
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
            Design a Voice
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
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Voice Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A warm, deep male voice with a slight British accent and calm demeanor..."
              rows={3}
              maxLength={500}
              className="w-full border rounded px-2 py-1.5 text-[12px] resize-none"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
              }}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">{description.length}/500</span>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">
              Sample Text (optional, for preview)
            </label>
            <input
              type="text"
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="Hello, welcome to our presentation."
              className="w-full border rounded px-2 py-1.5 text-[12px]"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          {result && (
            <div
              className="flex items-center justify-between border rounded px-3 py-2"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)' }}
            >
              <div>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {result.name}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">Voice ID: {result.voiceId}</p>
              </div>
              <div className="flex items-center gap-2">
                {result.previewUrl && (
                  <span onClick={handlePreview} className="cursor-pointer text-[var(--color-accent)] hover:opacity-80">
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </span>
                )}
                <span
                  onClick={() => onDesigned(result.voiceId, result.name)}
                  className="text-[11px] font-semibold cursor-pointer px-2 py-1 rounded hover:opacity-80"
                  style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
                >
                  Use
                </span>
              </div>
            </div>
          )}

          {!result && (
            <span
              onClick={loading ? undefined : handleGenerate}
              className={`flex items-center justify-center gap-2 w-full rounded px-3 py-2 text-[12px] font-semibold cursor-pointer transition-all ${
                !description.trim() || loading ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
              }`}
              style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Designing...' : 'Generate Voice'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

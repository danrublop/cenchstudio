'use client'
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Play, Loader2 } from 'lucide-react'

interface Voice {
  id: string
  name: string
  language: string
  gender?: string
  previewUrl?: string | null
}

interface VoicePickerProps {
  provider: string
  selectedVoiceId: string | null
  onSelect: (voiceId: string, voiceName: string) => void
}

export function VoicePicker({ provider, selectedVoiceId, onSelect }: VoicePickerProps) {
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!provider || provider === 'web-speech' || provider === 'auto') return
    setLoading(true)
    fetch(`/api/tts/voices?provider=${provider}`)
      .then((r) => r.json())
      .then((d) => setVoices(d.voices || []))
      .catch(() => setVoices([]))
      .finally(() => setLoading(false))
  }, [provider])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedVoice = voices.find((v) => v.id === selectedVoiceId)

  const handlePreview = (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playing === voice.id) {
      setPlaying(null)
      return
    }
    if (!voice.previewUrl) return
    const audio = new Audio(voice.previewUrl)
    audio.onended = () => setPlaying(null)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlaying(voice.id)
  }

  return (
    <div ref={ref} className="relative">
      <span
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full border rounded px-2 py-1.5 text-[11px] cursor-pointer"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-input-bg)',
          color: 'var(--color-text-primary)',
        }}
      >
        {loading ? (
          <span className="flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Loading...
          </span>
        ) : (
          <span>{selectedVoice?.name || 'Select voice...'}</span>
        )}
        <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
      </span>
      {open && voices.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto border rounded shadow-lg"
          style={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)' }}
        >
          {voices.map((v) => (
            <div
              key={v.id}
              onClick={() => {
                onSelect(v.id, v.name)
                setOpen(false)
              }}
              className="flex items-center justify-between px-2 py-1.5 text-[11px] cursor-pointer hover:bg-white/5"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span>
                {v.name} {v.language ? `(${v.language})` : ''}
              </span>
              <span className="flex items-center gap-1">
                {v.id === selectedVoiceId && <span className="text-[var(--color-accent)]">✓</span>}
                {v.previewUrl && (
                  <span onClick={(e) => handlePreview(v, e)} className="p-0.5 hover:text-[var(--color-accent)]">
                    <Play size={10} fill={playing === v.id ? 'currentColor' : 'none'} />
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

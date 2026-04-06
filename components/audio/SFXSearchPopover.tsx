'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, Play, Pause, Plus, Loader2 } from 'lucide-react'

interface SFXResult {
  id: string
  name: string
  audioUrl: string
  duration: number | null
  previewUrl?: string
}

interface SFXSearchPopoverProps {
  onSelect: (result: SFXResult, triggerAt: number) => void
  onClose: () => void
}

export function SFXSearchPopover({ onSelect, onClose }: SFXSearchPopoverProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SFXResult[]>([])
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [triggerAt, setTriggerAt] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/sfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 8 }),
      })
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  const togglePreview = (result: SFXResult) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playing === result.id) {
      setPlaying(null)
      return
    }
    const url = result.previewUrl || result.audioUrl
    const audio = new Audio(url)
    audio.onended = () => setPlaying(null)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlaying(result.id)
  }

  return (
    <div
      ref={ref}
      className="border rounded-lg p-3 space-y-2 shadow-xl"
      style={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)', minWidth: 280 }}
    >
      <div className="flex gap-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search sounds..."
          className="flex-1 border rounded px-2 py-1 text-[12px]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
        <span onClick={handleSearch} className="kbd w-7 h-7 flex items-center justify-center cursor-pointer">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        <span>Trigger at:</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={triggerAt}
          onChange={(e) => setTriggerAt(parseFloat(e.target.value) || 0)}
          className="w-14 border rounded px-1 py-0.5 text-[11px]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
        <span>s</span>
      </div>
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {results.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/5 text-[12px]"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span onClick={() => togglePreview(r)} className="cursor-pointer hover:text-[var(--color-accent)]">
                {playing === r.id ? <Pause size={11} /> : <Play size={11} />}
              </span>
              <span className="flex-1 truncate">{r.name}</span>
              {r.duration && (
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  {r.duration.toFixed(1)}s
                </span>
              )}
              <span
                onClick={() => {
                  onSelect(r, triggerAt)
                  onClose()
                }}
                className="cursor-pointer hover:text-[var(--color-accent)]"
              >
                <Plus size={12} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

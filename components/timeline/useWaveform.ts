import { useEffect, useState, useRef } from 'react'

/** Number of peak samples to extract — higher = more detail */
const NUM_PEAKS = 300

/** Cache decoded waveform peaks by URL to avoid re-decoding */
const waveformCache = new Map<string, number[]>()

/** In-flight fetch promises so we don't duplicate requests */
const inflightFetches = new Map<string, Promise<number[]>>()

/**
 * Decode an audio file URL into an array of normalized peak amplitudes [0..1].
 * Uses RMS (root mean square) for smoother-looking waveforms with peak accents.
 */
async function decodePeaks(url: string, numPeaks: number): Promise<number[]> {
  if (waveformCache.has(url)) return waveformCache.get(url)!

  if (inflightFetches.has(url)) return inflightFetches.get(url)!

  const promise = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return []
      const buf = await res.arrayBuffer()
      const ctx = new OfflineAudioContext(1, 1, 44100)
      const decoded = await ctx.decodeAudioData(buf)
      const raw = decoded.getChannelData(0)
      const step = Math.max(1, Math.floor(raw.length / numPeaks))
      const peaks: number[] = []
      for (let i = 0; i < numPeaks; i++) {
        const start = i * step
        const end = Math.min(start + step, raw.length)
        // Blend RMS (smooth body) with peak (transient detail)
        let sumSq = 0
        let peak = 0
        for (let j = start; j < end; j++) {
          const abs = Math.abs(raw[j])
          sumSq += abs * abs
          if (abs > peak) peak = abs
        }
        const rms = Math.sqrt(sumSq / (end - start))
        // 70% RMS + 30% peak for a balance between smooth and detailed
        peaks.push(rms * 0.7 + peak * 0.3)
      }
      // Normalize to 0..1
      const globalMax = Math.max(...peaks, 0.001)
      const normalized = peaks.map((p) => Math.min(1, p / globalMax))
      waveformCache.set(url, normalized)
      return normalized
    } catch {
      return []
    } finally {
      inflightFetches.delete(url)
    }
  })()

  inflightFetches.set(url, promise)
  return promise
}

/**
 * Hook that returns waveform peak data for an audio URL.
 * Returns empty array while loading or if decoding fails.
 */
export function useWaveform(audioUrl: string | null | undefined): number[] {
  const [peaks, setPeaks] = useState<number[]>([])
  const urlRef = useRef(audioUrl)

  useEffect(() => {
    urlRef.current = audioUrl
    if (!audioUrl) {
      setPeaks([])
      return
    }
    // Check cache synchronously
    const cached = waveformCache.get(audioUrl)
    if (cached) {
      setPeaks(cached)
      return
    }
    decodePeaks(audioUrl, NUM_PEAKS).then((p) => {
      if (urlRef.current === audioUrl) setPeaks(p)
    })
  }, [audioUrl])

  return peaks
}

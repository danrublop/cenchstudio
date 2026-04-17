import { useState, useEffect } from 'react'

interface ConfiguredProviders {
  audio: Set<string>
  media: Set<string>
  loaded: boolean
}

let cachedResult: ConfiguredProviders | null = null

/**
 * Fetches which providers are actually configured (API key set, server running).
 * Caches the result for the session. Prefers the Electron IPC bridge
 * (`window.cenchApi.settings.listProviders`) and falls back to the legacy
 * web fetch path only if cenchApi is unavailable — retained so the hook
 * keeps working in pure-web preview until app/api/audio-settings is deleted.
 */
export function useConfiguredProviders(): ConfiguredProviders {
  const [result, setResult] = useState<ConfiguredProviders>(
    cachedResult ?? { audio: new Set(), media: new Set(), loaded: false },
  )

  useEffect(() => {
    if (cachedResult) {
      setResult(cachedResult)
      return
    }
    let cancelled = false

    const loadProviders = async () => {
      const ipc = typeof window !== 'undefined' ? window.cenchApi : undefined
      if (ipc?.settings?.listProviders) {
        return ipc.settings.listProviders()
      }
      const res = await fetch('/api/audio-settings')
      return res.json() as Promise<{
        providers?: Record<'tts' | 'sfx' | 'music', { id: string; available: boolean }[]>
        media?: { id: string; available: boolean }[]
      }>
    }

    loadProviders()
      .then((data) => {
        if (cancelled) return
        const audioIds = new Set<string>()
        for (const cat of ['tts', 'sfx', 'music'] as const) {
          for (const p of data.providers?.[cat] ?? []) {
            if (p.available) audioIds.add(p.id)
          }
        }
        const mediaIds = new Set<string>((data.media ?? []).filter((p) => p.available).map((p) => p.id))
        const next = { audio: audioIds, media: mediaIds, loaded: true }
        cachedResult = next
        setResult(next)
      })
      .catch(() => {
        // On error, leave the UI unblocked rather than fail the whole panel.
        if (!cancelled) setResult({ audio: new Set(), media: new Set(), loaded: false })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return result
}

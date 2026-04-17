import { useState, useEffect } from 'react'

interface ConfiguredProviders {
  audio: Set<string>
  media: Set<string>
  loaded: boolean
}

let cachedResult: ConfiguredProviders | null = null

/**
 * Fetches which providers are actually configured (API key set, server running)
 * from the server. Caches the result for the session.
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
    fetch('/api/audio-settings')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const audioIds = new Set<string>()
        for (const cat of ['tts', 'sfx', 'music'] as const) {
          for (const p of data.providers?.[cat] ?? []) {
            if (p.available) audioIds.add(p.id)
          }
        }
        const mediaIds = new Set<string>((data.media ?? []).filter((p: any) => p.available).map((p: any) => p.id))
        const res = { audio: audioIds, media: mediaIds, loaded: true }
        cachedResult = res
        setResult(res)
      })
      .catch(() => {
        // On error, assume all providers are available (don't block the UI)
        if (!cancelled) setResult({ audio: new Set(), media: new Set(), loaded: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return result
}

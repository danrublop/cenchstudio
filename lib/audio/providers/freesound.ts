import type { SFXProviderInterface, SFXResult } from '../types'

const API_BASE = 'https://freesound.org/apiv2'

function getApiKey(): string {
  const key = process.env.FREESOUND_API_KEY
  if (!key) throw new Error('FREESOUND_API_KEY is not set')
  return key
}

interface FreesoundResult {
  id: number
  name: string
  previews: {
    'preview-hq-mp3': string
    'preview-lq-mp3': string
    'preview-hq-ogg': string
    'preview-lq-ogg': string
  }
  duration: number
  license: string
}

interface FreesoundSearchResponse {
  count: number
  results: FreesoundResult[]
}

export const freesoundSFX: SFXProviderInterface = {
  id: 'freesound',
  name: 'Freesound',
  requiresKey: 'FREESOUND_API_KEY',

  async search(query: string, limit?: number): Promise<SFXResult[]> {
    const apiKey = getApiKey()
    const pageSize = limit || 10

    const params = new URLSearchParams({
      query,
      page_size: String(pageSize),
      fields: 'id,name,previews,duration,license',
      token: apiKey,
    })

    const response = await fetch(`${API_BASE}/search/text/?${params}`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Freesound search error (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as FreesoundSearchResponse

    return data.results.map((result) => ({
      id: String(result.id),
      name: result.name,
      audioUrl: result.previews['preview-hq-mp3'],
      duration: Math.round(result.duration * 10) / 10,
      provider: 'freesound' as const,
      previewUrl: result.previews['preview-hq-mp3'],
      license: result.license,
    }))
  },
}

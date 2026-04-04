import fs from 'fs/promises'
import path from 'path'
import type { TTSProviderInterface, TTSParams, TTSResult, Voice } from '../types'

const API_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel
const DEFAULT_MODEL = 'eleven_turbo_v2_5'

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set')
  return key
}

export const elevenlabsTTS: TTSProviderInterface = {
  id: 'elevenlabs',
  name: 'ElevenLabs',
  type: 'server',
  requiresKey: 'ELEVENLABS_API_KEY',

  async generate(params: TTSParams): Promise<TTSResult> {
    const apiKey = getApiKey()
    const voiceId = params.voiceId || DEFAULT_VOICE_ID
    const model = params.model || DEFAULT_MODEL

    const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: params.text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs TTS error (${response.status}): ${errorText}`)
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())

    const audioDir = path.join(process.cwd(), 'public', 'audio')
    await fs.mkdir(audioDir, { recursive: true })

    const filename = `tts-${params.sceneId}-${Date.now()}.mp3`
    const filePath = path.join(audioDir, filename)
    await fs.writeFile(filePath, audioBuffer)

    // Estimate duration from MP3 file size (128kbps bitrate assumption)
    const durationEstimate = (audioBuffer.length * 8) / (128 * 1000)

    return {
      audioUrl: `/audio/${filename}`,
      duration: Math.round(durationEstimate * 10) / 10,
      provider: 'elevenlabs',
    }
  },

  async listVoices(): Promise<Voice[]> {
    const apiKey = getApiKey()

    const response = await fetch(`${API_BASE}/voices`, {
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs voices error (${response.status}): ${await response.text()}`)
    }

    const data = (await response.json()) as {
      voices: Array<{
        voice_id: string
        name: string
        labels?: Record<string, string>
        preview_url?: string
      }>
    }

    return data.voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      language: v.labels?.language || 'en',
      gender: v.labels?.gender,
      previewUrl: v.preview_url || null,
    }))
  },
}

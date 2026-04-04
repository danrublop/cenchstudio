import fs from 'fs/promises'
import path from 'path'
import type { TTSProviderInterface, TTSParams, TTSResult, Voice } from '../types'

const API_BASE = 'https://texttospeech.googleapis.com/v1'
const DEFAULT_VOICE = 'en-US-Neural2-F'
const DEFAULT_LANGUAGE = 'en-US'

function getApiKey(): string {
  const key = process.env.GOOGLE_TTS_API_KEY
  if (!key) throw new Error('GOOGLE_TTS_API_KEY is not set')
  return key
}

export const googleTTS: TTSProviderInterface = {
  id: 'google-tts',
  name: 'Google Cloud TTS',
  type: 'server',
  requiresKey: 'GOOGLE_TTS_API_KEY',

  async generate(params: TTSParams): Promise<TTSResult> {
    const apiKey = getApiKey()
    const voiceId = params.voiceId || DEFAULT_VOICE

    // Extract language code from voice name (e.g. "en-US-Neural2-F" -> "en-US")
    const languageCode = voiceId.split('-').slice(0, 2).join('-') || DEFAULT_LANGUAGE

    const response = await fetch(`${API_BASE}/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: params.text },
        voice: {
          languageCode,
          name: voiceId,
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google TTS error (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as { audioContent: string }
    const audioBuffer = Buffer.from(data.audioContent, 'base64')

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
      provider: 'google-tts',
    }
  },

  async listVoices(): Promise<Voice[]> {
    const apiKey = getApiKey()

    const response = await fetch(`${API_BASE}/voices?key=${apiKey}`)

    if (!response.ok) {
      throw new Error(`Google TTS voices error (${response.status}): ${await response.text()}`)
    }

    const data = (await response.json()) as {
      voices: Array<{
        name: string
        languageCodes: string[]
        ssmlGender: string
      }>
    }

    return data.voices.map((v) => ({
      id: v.name,
      name: v.name,
      language: v.languageCodes[0] || 'en-US',
      gender: v.ssmlGender?.toLowerCase(),
    }))
  },
}

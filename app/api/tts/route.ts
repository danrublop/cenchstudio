import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel — a clear, neutral voice

export async function POST(req: NextRequest) {
  const { text, sceneId, voiceId = DEFAULT_VOICE_ID } = await req.json()

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 })
  }

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const filename = `tts-${sceneId ?? uuidv4()}.mp3`
    const filePath = path.join(uploadsDir, filename)

    const buffer = Buffer.from(await res.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (err: unknown) {
    console.error('TTS error:', err)
    const message = err instanceof Error ? err.message : 'TTS failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

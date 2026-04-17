import { NextRequest, NextResponse } from 'next/server'
import type { TTSProvider } from '@/lib/types'
import { getTTSProvider } from '@/lib/audio/router'
import { getOptionalUser } from '@/lib/auth-helpers'
import { sanitizeErrorMessage } from '@/lib/audio/sanitize'

const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave']
const CLONE_CAPABLE_PROVIDERS: TTSProvider[] = ['pocket-tts', 'voxcpm']

export async function POST(req: NextRequest) {
  await getOptionalUser()

  const formData = await req.formData()
  const provider = formData.get('provider') as string
  const name = formData.get('name') as string
  const audioFile = formData.get('audioFile') as File | null
  const transcript = formData.get('transcript') as string | null
  const mode = formData.get('mode') as string | null

  if (!provider || !CLONE_CAPABLE_PROVIDERS.includes(provider as TTSProvider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${CLONE_CAPABLE_PROVIDERS.join(', ')}` },
      { status: 400 },
    )
  }
  if (!name || typeof name !== 'string' || name.length > 100) {
    return NextResponse.json({ error: 'name is required (max 100 characters)' }, { status: 400 })
  }
  if (!audioFile) {
    return NextResponse.json({ error: 'audioFile is required' }, { status: 400 })
  }
  if (audioFile.size > MAX_AUDIO_SIZE) {
    return NextResponse.json({ error: 'Audio file exceeds 10MB limit' }, { status: 400 })
  }
  if (audioFile.type && !ALLOWED_TYPES.includes(audioFile.type)) {
    return NextResponse.json({ error: 'Audio file must be WAV or MP3' }, { status: 400 })
  }

  try {
    const ttsProvider = await getTTSProvider(provider as TTSProvider)

    if (!ttsProvider.cloneVoice) {
      return NextResponse.json({ error: `Provider ${provider} does not support voice cloning` }, { status: 400 })
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const result = await ttsProvider.cloneVoice({
      name,
      audioBuffer,
      transcript: transcript || undefined,
      mode: mode || undefined,
    })

    return NextResponse.json({ voiceId: result.voiceId, name: result.name, provider })
  } catch (err) {
    const message = err instanceof Error ? sanitizeErrorMessage(err.message) : 'Voice cloning failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

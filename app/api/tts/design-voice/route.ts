import { NextRequest, NextResponse } from 'next/server'
import { getTTSProvider } from '@/lib/audio/router'
import { getOptionalUser } from '@/lib/auth-helpers'
import { sanitizeErrorMessage } from '@/lib/audio/sanitize'

export async function POST(req: NextRequest) {
  await getOptionalUser()

  const { description, sampleText } = await req.json()

  if (!description || typeof description !== 'string') {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }
  if (description.length > 500) {
    return NextResponse.json({ error: 'description must be under 500 characters' }, { status: 400 })
  }

  try {
    const ttsProvider = await getTTSProvider('voxcpm')

    if (!ttsProvider.designVoice) {
      return NextResponse.json({ error: 'VoxCPM provider does not support voice design' }, { status: 400 })
    }

    const result = await ttsProvider.designVoice({
      description,
      sampleText: sampleText || undefined,
    })

    return NextResponse.json({
      voiceId: result.voiceId,
      name: result.name,
      previewUrl: result.previewUrl,
      provider: 'voxcpm',
    })
  } catch (err) {
    const message = err instanceof Error ? sanitizeErrorMessage(err.message) : 'Voice design failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import type { TTSProvider } from '@/lib/types'
import { getBestTTSProvider, getTTSProvider } from '@/lib/audio/router'
import { getOptionalUser } from '@/lib/auth-helpers'
import { validateTextLength, sanitizeErrorMessage, MAX_TTS_TEXT_LENGTH } from '@/lib/audio/sanitize'

export async function POST(req: NextRequest) {
  await getOptionalUser()
  const { text, sceneId, voiceId, provider, model, instructions, localMode } = await req.json()

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  if (!sceneId || typeof sceneId !== 'string') {
    return NextResponse.json({ error: 'sceneId is required' }, { status: 400 })
  }
  // Validate sceneId format (UUID or alphanumeric with hyphens)
  if (!/^[a-zA-Z0-9\-]+$/.test(sceneId)) {
    return NextResponse.json({ error: 'Invalid sceneId format' }, { status: 400 })
  }

  try {
    validateTextLength(text)
  } catch {
    return NextResponse.json(
      { error: `Text exceeds maximum length of ${MAX_TTS_TEXT_LENGTH} characters` },
      { status: 400 },
    )
  }

  const selectedProvider: TTSProvider = provider ?? getBestTTSProvider(null, localMode)
  console.log(`[TTS] Request: provider=${selectedProvider} textLen=${text.length} voiceId=${voiceId ?? 'default'}`)

  // Client-only providers return config for browser-side synthesis
  if (selectedProvider === 'web-speech' || selectedProvider === 'puter') {
    return NextResponse.json({
      mode: 'client',
      provider: selectedProvider,
      text,
      voiceId: voiceId ?? null,
    })
  }

  try {
    const impl = await getTTSProvider(selectedProvider)
    const result = await impl.generate({ text, sceneId, voiceId, model, instructions })

    console.log(`[TTS] Complete: provider=${result.provider} duration=${result.duration ?? 'unknown'}s`)
    return NextResponse.json({
      url: result.audioUrl,
      duration: result.duration,
      provider: result.provider,
    })
  } catch (err: unknown) {
    console.error('TTS error:', err)
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 })
  }
}

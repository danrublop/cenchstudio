import { NextRequest, NextResponse } from 'next/server'
import type { TTSProvider } from '@/lib/types'
import { getBestTTSProvider, getTTSProvider } from '@/lib/audio/router'

export async function POST(req: NextRequest) {
  const { text, sceneId, voiceId, provider, model, instructions } = await req.json()

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  if (!sceneId) {
    return NextResponse.json({ error: 'sceneId is required' }, { status: 400 })
  }

  const selectedProvider: TTSProvider = provider ?? getBestTTSProvider()
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
    const message = err instanceof Error ? err.message : 'TTS failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

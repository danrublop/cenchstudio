/**
 * TTS proxy for TalkingHead.js — works with ALL configured TTS providers.
 *
 * TalkingHead calls this endpoint with Google Cloud TTS format:
 *   { input: { text, ssml }, voice: { languageCode, name }, audioConfig: { audioEncoding } }
 *
 * We extract the text, generate audio via whichever provider is configured
 * (ElevenLabs, OpenAI, Gemini, Google, etc.), read the resulting MP3 file,
 * and return it in Google's response format: { audioContent: base64 }
 *
 * TalkingHead parses this itself and does phoneme→viseme lip sync.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBestTTSProvider, getTTSProvider } from '@/lib/audio/router'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Extract text from TalkingHead's Google-format request
    const text = body.input?.text || body.input?.ssml?.replace(/<[^>]+>/g, '') || ''
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // Pick the best available server-side TTS provider
    const providerName = getBestTTSProvider()

    // Client-only providers can't generate server-side audio
    if (providerName === 'web-speech' || providerName === 'puter') {
      return NextResponse.json(
        {
          error:
            'No server-side TTS provider configured. Set ELEVENLABS_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_TTS_API_KEY.',
        },
        { status: 503 },
      )
    }

    const provider = await getTTSProvider(providerName)
    const sceneId = `talkinghead-${Date.now()}`

    console.log(`[TTS/TalkingHead] Generating via ${providerName}: "${text.slice(0, 60)}..."`)

    const result = await provider.generate({
      text,
      sceneId,
      voiceId: body.voice?.name || undefined,
    })

    // Read the generated audio file and convert to base64
    // result.audioUrl is like "/audio/tts-xxx.mp3"
    const audioPath = path.join(process.cwd(), 'public', result.audioUrl)
    const audioBuffer = await fs.readFile(audioPath)
    const base64Audio = audioBuffer.toString('base64')

    console.log(`[TTS/TalkingHead] Done: ${providerName}, ${audioBuffer.length} bytes, ${result.duration ?? '?'}s`)

    // Return in Google Cloud TTS response format (what TalkingHead expects)
    return NextResponse.json({
      audioContent: base64Audio,
    })
  } catch (err) {
    console.error('[TTS/TalkingHead] Error:', err)
    const message = err instanceof Error ? err.message : 'TTS proxy failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

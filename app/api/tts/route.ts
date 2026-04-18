import fs from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import type { TTSProvider } from '@/lib/types'
import { getBestTTSProvider, getTTSProvider } from '@/lib/audio/router'
import { getOptionalUser } from '@/lib/auth-helpers'
import { validateTextLength, sanitizeErrorMessage, MAX_TTS_TEXT_LENGTH } from '@/lib/audio/sanitize'
import { buildNaiveCaptions } from '@/lib/audio/captions'
import { getAudioDir, audioUrlFor, isLocalAudioUrl } from '@/lib/audio/paths'

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

    // Fallback: if the provider didn't return timestamps but did give us an
    // audio duration, emit naive captions (even distribution across the
    // duration). Better than nothing for downstream export/publish surfaces.
    if (!result.captions && result.duration && isLocalAudioUrl(result.audioUrl)) {
      const bundle = buildNaiveCaptions(text, result.duration)
      if (bundle.words.length > 0 && bundle.srt.length > 0) {
        try {
          const audioDir = getAudioDir()
          await fs.mkdir(audioDir, { recursive: true })
          // Strip the URL prefix (either `/audio/` or `cench://audio/`) and the extension.
          const base = result.audioUrl.replace(/^(cench:\/\/audio\/|\/audio\/)/, '').replace(/\.[a-z0-9]+$/i, '')
          const srtName = `${base}.srt`
          const vttName = `${base}.vtt`
          await Promise.all([
            fs.writeFile(path.join(audioDir, srtName), bundle.srt, 'utf8'),
            fs.writeFile(path.join(audioDir, vttName), bundle.vtt, 'utf8'),
          ])
          result.captions = {
            srtUrl: audioUrlFor(srtName),
            vttUrl: audioUrlFor(vttName),
            kind: 'naive',
            words: bundle.words,
          }
        } catch (captionErr) {
          console.warn('[TTS] naive caption write failed:', captionErr)
        }
      }
    }

    console.log(
      `[TTS] Complete: provider=${result.provider} duration=${result.duration ?? 'unknown'}s captions=${result.captions ? result.captions.kind : 'no'}`,
    )
    return NextResponse.json({
      url: result.audioUrl,
      duration: result.duration,
      provider: result.provider,
      captions: result.captions
        ? {
            srtUrl: result.captions.srtUrl,
            vttUrl: result.captions.vttUrl,
            kind: result.captions.kind,
            words: result.captions.words,
          }
        : null,
    })
  } catch (err: unknown) {
    console.error('TTS error:', err)
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 })
  }
}

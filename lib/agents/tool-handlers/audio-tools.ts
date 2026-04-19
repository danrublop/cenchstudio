import type { APIName } from '@/lib/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'
import { synthesizeTTS, searchSFX, searchMusic } from '@/lib/services/audio'

export const AUDIO_TOOL_NAMES = ['elevenlabs_tts', 'add_narration', 'add_sound_effect', 'add_background_music'] as const

export function createAudioToolHandler(deps: {
  checkApiPermission: (
    world: WorldStateMutable,
    api: APIName,
    context?: {
      reason?: string
      details?: {
        prompt?: string
        duration?: number
        model?: string
        resolution?: string
        textLength?: number
      }
    },
  ) => ToolResult | null
  enrichPermission: (
    result: ToolResult,
    context: {
      generationType: import('@/lib/types').GenerationType
      prompt?: string
      provider?: string
      availableProviders?: import('@/lib/types').GenerationProviderOption[]
      config?: Record<string, any>
      toolArgs?: Record<string, any>
    },
  ) => ToolResult
}) {
  return async function handleAudioTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'elevenlabs_tts': {
        const { sceneId, text, voiceId } = args as Record<string, any>
        const blocked = deps.checkApiPermission(world, 'elevenLabs', {
          reason: 'Generate ElevenLabs narration',
          details: { prompt: text as string, model: voiceId as string | undefined },
        })
        if (blocked) return blocked
        if (!sceneId || !text) return err('sceneId and text are required')
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)
        try {
          const data = await synthesizeTTS({ text, sceneId, voiceId, provider: 'elevenlabs' })
          if ('mode' in data) return err('TTS returned client-only config; expected a url')
          return ok(sceneId, 'TTS audio generated', { audioUrl: data.url })
        } catch (e: any) {
          return err(`TTS failed: ${e.message}`)
        }
      }

      case 'add_narration': {
        const { sceneId, text, voiceId, provider, instructions } = args as Record<string, any>
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)

        const ttsApiMap: Record<string, APIName | null> = {
          elevenlabs: 'elevenLabs',
          'openai-tts': 'openaiTts',
          'gemini-tts': 'geminiTts',
          'google-tts': 'googleTts',
        }
        const isProviderEnabled = (id: string) =>
          !world.audioProviderEnabled || (world.audioProviderEnabled[id] ?? true)
        const explicitProvider = provider && provider !== 'auto' ? provider : null
        if (explicitProvider && !isProviderEnabled(explicitProvider)) {
          return err(`TTS provider "${explicitProvider}" is disabled in audio settings`)
        }
        // Delegate to the scorer-backed resolver. It reads the per-project
        // enabled map, localMode, platform, and env vars, and returns the
        // single best provider for this call — replacing the old inline
        // cascade. Explicit user picks still short-circuit.
        const { resolveTTSForNarration } = await import('@/lib/audio/resolve-best-tts-provider')
        const resolved = explicitProvider
          ? { provider: explicitProvider as any, reason: `user-picked (${explicitProvider})`, ranking: [] }
          : resolveTTSForNarration({
              localMode: world.localMode,
              audioProviderEnabled: world.audioProviderEnabled,
              textLength: typeof text === 'string' ? text.length : undefined,
            })
        const effectiveProvider = resolved.provider
        if (effectiveProvider && ttsApiMap[effectiveProvider]) {
          const ttsProviderOptions: import('@/lib/types').GenerationProviderOption[] = [
            { id: 'elevenlabs', name: 'ElevenLabs', cost: '~$0.01–0.10', isFree: false },
            { id: 'openai-tts', name: 'OpenAI TTS', cost: '~$0.015–0.03/1K chars', isFree: false },
            { id: 'gemini-tts', name: 'Gemini TTS', cost: '~$0.01–0.02/1K chars', isFree: false },
            { id: 'google-tts', name: 'Google Cloud TTS', cost: '~$0.004/100 chars', isFree: false },
            { id: 'openai-edge-tts', name: 'Edge TTS (Local)', cost: 'Free', isFree: true },
            { id: 'web-speech', name: 'Web Speech', cost: 'Free', isFree: true },
            { id: 'puter', name: 'Puter TTS', cost: 'Free', isFree: true },
          ].filter((p) => isProviderEnabled(p.id))
          const blocked = deps.checkApiPermission(world, ttsApiMap[effectiveProvider]!, {
            reason: 'Generate narration audio',
            details: {
              prompt: text as string,
              model: effectiveProvider,
              textLength: typeof text === 'string' ? text.length : undefined,
            },
          })
          if (blocked)
            return deps.enrichPermission(blocked, {
              generationType: 'tts',
              prompt: text as string,
              provider: effectiveProvider,
              availableProviders: ttsProviderOptions,
              config: { voiceId, instructions },
              toolArgs: args as Record<string, any>,
            })
        }

        try {
          const data = await synthesizeTTS({
            text,
            sceneId,
            voiceId,
            provider: effectiveProvider ?? undefined,
            instructions,
            localMode: world.localMode,
          })

          if ('mode' in data) {
            const audioLayer = scene.audioLayer || {
              enabled: false,
              src: null,
              volume: 1,
              fadeIn: false,
              fadeOut: false,
              startOffset: 0,
            }
            updateScene(world, sceneId, {
              audioLayer: {
                ...audioLayer,
                enabled: true,
                tts: {
                  text,
                  provider: data.provider,
                  voiceId: voiceId || null,
                  src: null,
                  status: 'ready' as const,
                  duration: null,
                  instructions: instructions || null,
                },
              },
            })
            // Client-only TTS (web-speech / puter) plays in the browser
            // preview but writes no audio file. MP4 exports of this scene
            // will be silent. Tell the agent explicitly so it can warn the
            // user and suggest adding a server-side TTS key.
            return ok(
              sceneId,
              `Narration set up for browser preview only (${data.provider}). MP4 export will be silent for this scene — add a server TTS API key (ElevenLabs, OpenAI, Gemini, or Google Cloud TTS) to generate a real audio file.`,
              { audioUrl: null, clientOnly: true, provider: data.provider },
            )
          }

          // After the `'mode' in data` branch returns, TypeScript narrows
          // `data` to the server-audio variant for the rest of this case.
          const audioLayer = scene.audioLayer || {
            enabled: false,
            src: null,
            volume: 1,
            fadeIn: false,
            fadeOut: false,
            startOffset: 0,
          }
          const captions =
            data.captions && data.captions.srtUrl && data.captions.vttUrl
              ? {
                  srtUrl: data.captions.srtUrl as string,
                  vttUrl: data.captions.vttUrl as string,
                  kind: (data.captions.kind === 'naive' ? 'naive' : 'aligned') as 'aligned' | 'naive',
                  words: Array.isArray(data.captions.words)
                    ? (data.captions.words as Array<{ text: string; start: number; end: number }>)
                    : [],
                }
              : null
          updateScene(world, sceneId, {
            audioLayer: {
              ...audioLayer,
              enabled: true,
              src: data.url,
              tts: {
                text,
                provider: data.provider,
                voiceId: voiceId || null,
                src: data.url,
                status: 'ready' as const,
                duration: data.duration || null,
                instructions: instructions || null,
                captions,
              },
            },
          })
          const captionSuffix = captions ? ', captions generated' : ''
          return ok(
            sceneId,
            `Narration generated (${data.provider})${data.duration ? `, ${data.duration.toFixed(1)}s` : ''}${captionSuffix}`,
            { audioUrl: data.url, ...(captions ? { captionsUrl: captions.vttUrl } : {}) },
          )
        } catch (e: any) {
          return err(`Narration failed: ${e.message}`)
        }
      }

      case 'add_sound_effect': {
        const { sceneId, query, triggerAt = 0, volume = 0.8, provider } = args as Record<string, any>
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)

        const sfxApiMap: Record<string, APIName | null> = {
          'elevenlabs-sfx': 'elevenLabs',
          freesound: 'freesound',
          pixabay: 'pixabay',
        }
        const isSfxEnabled = (id: string) => !world.audioProviderEnabled || (world.audioProviderEnabled[id] ?? true)
        const explicitSfxProvider = provider && provider !== 'auto' ? provider : null
        if (explicitSfxProvider && !isSfxEnabled(explicitSfxProvider)) {
          return err(`SFX provider "${explicitSfxProvider}" is disabled in audio settings`)
        }
        const effectiveSfxProvider =
          explicitSfxProvider ??
          (() => {
            if (process.env.ELEVENLABS_API_KEY && isSfxEnabled('elevenlabs-sfx')) return 'elevenlabs-sfx'
            if (process.env.FREESOUND_API_KEY && isSfxEnabled('freesound')) return 'freesound'
            if (process.env.PIXABAY_API_KEY && isSfxEnabled('pixabay')) return 'pixabay'
            return null
          })()
        if (effectiveSfxProvider && sfxApiMap[effectiveSfxProvider]) {
          const blocked = deps.checkApiPermission(world, sfxApiMap[effectiveSfxProvider]!, {
            reason: 'Generate/search sound effect',
            details: { prompt: query as string, model: effectiveSfxProvider },
          })
          if (blocked) return blocked
        }

        try {
          const data = await searchSFX({
            query,
            prompt: query,
            provider: effectiveSfxProvider ?? undefined,
            limit: 1,
            download: true,
          })
          if (!data.results || data.results.length === 0) return err(`No sound effects found for: ${query}`)

          const sfxResult = data.results[0] as Record<string, any>
          const newSfx = {
            id: `sfx-${Date.now()}`,
            name: sfxResult.name || query,
            provider: sfxResult.provider || data.provider,
            src: sfxResult.audioUrl,
            triggerAt,
            volume,
            duration: sfxResult.duration || null,
          }

          const audioLayer = scene.audioLayer || {
            enabled: false,
            src: null,
            volume: 1,
            fadeIn: false,
            fadeOut: false,
            startOffset: 0,
          }
          const existingSfx = audioLayer.sfx ?? []
          updateScene(world, sceneId, {
            audioLayer: { ...audioLayer, enabled: true, sfx: [...existingSfx, newSfx] },
          })
          return ok(sceneId, `Sound effect "${sfxResult.name}" added at ${triggerAt}s`, { sfx: newSfx })
        } catch (e: any) {
          return err(`SFX failed: ${e.message}`)
        }
      }

      case 'add_background_music': {
        const {
          sceneId,
          query,
          volume = 0.12,
          loop = true,
          duckDuringTTS = true,
          provider,
        } = args as Record<string, any>
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene not found: ${sceneId}`)

        const musicApiMap: Record<string, APIName | null> = {
          'pixabay-music': 'pixabay',
          'freesound-music': 'freesound',
        }
        const isMusicEnabled = (id: string) => !world.audioProviderEnabled || (world.audioProviderEnabled[id] ?? true)
        const explicitMusicProvider = provider && provider !== 'auto' ? provider : null
        if (explicitMusicProvider && !isMusicEnabled(explicitMusicProvider)) {
          return err(`Music provider "${explicitMusicProvider}" is disabled in audio settings`)
        }
        const effectiveMusicProvider =
          explicitMusicProvider ??
          (() => {
            if (process.env.PIXABAY_API_KEY && isMusicEnabled('pixabay-music')) return 'pixabay-music'
            if (process.env.FREESOUND_API_KEY && isMusicEnabled('freesound-music')) return 'freesound-music'
            return null
          })()
        if (effectiveMusicProvider && musicApiMap[effectiveMusicProvider]) {
          const blocked = deps.checkApiPermission(world, musicApiMap[effectiveMusicProvider]!, {
            reason: 'Generate/search background music',
            details: { prompt: query as string, model: effectiveMusicProvider },
          })
          if (blocked) return blocked
        }

        try {
          const data = await searchMusic({
            query,
            provider: effectiveMusicProvider ?? undefined,
            limit: 1,
            download: true,
          })
          if (!data.results || data.results.length === 0) return err(`No music found for: ${query}`)

          const musicResult = data.results[0] as Record<string, any>
          const musicTrack = {
            name: musicResult.name || query,
            provider: musicResult.provider || data.provider,
            src: musicResult.audioUrl,
            volume,
            loop,
            duckDuringTTS,
            duckLevel: 0.2,
          }

          const audioLayer = scene.audioLayer || {
            enabled: false,
            src: null,
            volume: 1,
            fadeIn: false,
            fadeOut: false,
            startOffset: 0,
          }
          updateScene(world, sceneId, {
            audioLayer: { ...audioLayer, enabled: true, music: musicTrack },
          })
          return ok(
            sceneId,
            `Background music "${musicResult.name}" added (vol: ${(volume * 100).toFixed(0)}%, duck: ${duckDuringTTS})`,
            { music: musicTrack },
          )
        } catch (e: any) {
          return err(`Music failed: ${e.message}`)
        }
      }

      default:
        return err(`Unknown audio tool: ${toolName}`)
    }
  }
}

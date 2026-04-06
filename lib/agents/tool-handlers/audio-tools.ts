import type { APIName } from '@/lib/types'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

export const AUDIO_TOOL_NAMES = ['elevenlabs_tts', 'add_narration', 'add_sound_effect', 'add_background_music'] as const

export function createAudioToolHandler(deps: {
  checkApiPermission: (
    world: WorldStateMutable,
    api: APIName,
    context?: {
      reason?: string
      details?: { prompt?: string; duration?: number; model?: string; resolution?: string }
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
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sceneId, voiceId }),
          })
          const data = await res.json()
          if (!res.ok) return err(data.error ?? 'TTS failed')
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
        const effectiveProvider =
          explicitProvider ??
          (() => {
            // In local mode, only use free TTS providers
            if (world.localMode) {
              if (isProviderEnabled('openai-edge-tts')) return 'openai-edge-tts'
              if (isProviderEnabled('native-tts')) return 'native-tts'
              if (isProviderEnabled('web-speech')) return 'web-speech'
              return null
            }
            if (process.env.ELEVENLABS_API_KEY && isProviderEnabled('elevenlabs')) return 'elevenlabs'
            if (process.env.OPENAI_API_KEY && isProviderEnabled('openai-tts')) return 'openai-tts'
            if (process.env.GEMINI_API_KEY && isProviderEnabled('gemini-tts')) return 'gemini-tts'
            if (process.env.GOOGLE_TTS_API_KEY && isProviderEnabled('google-tts')) return 'google-tts'
            if (isProviderEnabled('openai-edge-tts')) return 'openai-edge-tts'
            if (isProviderEnabled('puter')) return 'puter'
            if (isProviderEnabled('web-speech')) return 'web-speech'
            return null
          })()
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
            details: { prompt: text as string, model: effectiveProvider },
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
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const res = await fetch(`${baseUrl}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sceneId, voiceId, provider: effectiveProvider ?? undefined, instructions, localMode: world.localMode }),
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'TTS request failed' }))
            return err(`TTS failed: ${errData.error || res.statusText}`)
          }
          const data = await res.json()

          if (data.mode === 'client') {
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
            return ok(sceneId, `Narration added (${data.provider} — browser preview only)`)
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
              },
            },
          })
          return ok(
            sceneId,
            `Narration generated (${data.provider})${data.duration ? `, ${data.duration.toFixed(1)}s` : ''}`,
            { audioUrl: data.url },
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
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const res = await fetch(`${baseUrl}/api/sfx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              prompt: query,
              provider: effectiveSfxProvider ?? undefined,
              limit: 1,
              download: true,
            }),
          })
          if (!res.ok) return err('SFX search failed')
          const data = await res.json()
          if (!data.results || data.results.length === 0) return err(`No sound effects found for: ${query}`)

          const sfxResult = data.results[0]
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
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const res = await fetch(`${baseUrl}/api/music/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, provider: effectiveMusicProvider ?? undefined, limit: 1, download: true }),
          })
          if (!res.ok) return err('Music search failed')
          const data = await res.json()
          if (!data.results || data.results.length === 0) return err(`No music found for: ${query}`)

          const musicResult = data.results[0]
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

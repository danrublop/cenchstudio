'use client'

import type { SFXTrack, MusicTrack } from '../types'
import { normalizeAudioLayer } from '../audio/normalize'
import type { Set, Get } from './types'

export function createAudioActions(set: Set, get: Get) {
  return {
    updateAudioSettings: (updates: Partial<import('../types').AudioSettings>) =>
      set((s) => ({
        audioSettings: { ...s.audioSettings, ...updates },
      })),

    toggleAudioProvider: (id: string) =>
      set((s) => ({
        audioProviderEnabled: { ...s.audioProviderEnabled, [id]: !s.audioProviderEnabled[id] },
      })),

    toggleMediaGen: (id: string) =>
      set((s) => ({
        mediaGenEnabled: { ...s.mediaGenEnabled, [id]: !s.mediaGenEnabled[id] },
      })),

    setResearchEnabled: (enabled: boolean) => set({ researchEnabled: enabled }),

    toggleResearchProvider: (id: string) =>
      set((s) => ({
        researchProviderEnabled: { ...s.researchProviderEnabled, [id]: !s.researchProviderEnabled[id] },
      })),

    grantYtDlpConsent: (projectId: string) =>
      set((s) => ({
        ytDlpConsentedProjectIds: s.ytDlpConsentedProjectIds.includes(projectId)
          ? s.ytDlpConsentedProjectIds
          : [...s.ytDlpConsentedProjectIds, projectId],
      })),

    revokeYtDlpConsent: (projectId: string) =>
      set((s) => ({
        ytDlpConsentedProjectIds: s.ytDlpConsentedProjectIds.filter((id) => id !== projectId),
      })),

    generateNarration: async (
      sceneId: string,
      text: string,
      provider?: string,
      voiceId?: string,
      instructions?: string,
    ) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return

      // Set generating status
      const audioLayer = normalizeAudioLayer(scene.audioLayer)
      get().updateScene(sceneId, {
        audioLayer: {
          ...audioLayer,
          enabled: true,
          tts: {
            text,
            provider: (provider || 'auto') as any,
            voiceId: voiceId || null,
            src: null,
            status: 'generating',
            duration: null,
            instructions: instructions || null,
          },
        },
      })

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            sceneId,
            voiceId,
            provider: provider === 'auto' ? undefined : provider,
            instructions,
          }),
        })
        if (!res.ok) throw new Error('TTS failed')
        const data = await res.json()

        const currentScene = get().scenes.find((s) => s.id === sceneId)
        if (!currentScene) return
        const currentAL = normalizeAudioLayer(currentScene.audioLayer)

        if (data.mode === 'client') {
          get().updateScene(sceneId, {
            audioLayer: {
              ...currentAL,
              enabled: true,
              tts: {
                text,
                provider: data.provider,
                voiceId: voiceId || null,
                src: null,
                status: 'ready',
                duration: null,
                instructions: instructions || null,
              },
            },
          })
        } else {
          get().updateScene(sceneId, {
            audioLayer: {
              ...currentAL,
              enabled: true,
              src: data.url,
              tts: {
                text,
                provider: data.provider,
                voiceId: voiceId || null,
                src: data.url,
                status: 'ready',
                duration: data.duration || null,
                instructions: instructions || null,
              },
            },
          })
        }

        await get().saveSceneHTML(sceneId)
      } catch (err) {
        const currentScene = get().scenes.find((s) => s.id === sceneId)
        if (!currentScene) return
        const currentAL = normalizeAudioLayer(currentScene.audioLayer)
        get().updateScene(sceneId, {
          audioLayer: {
            ...currentAL,
            tts: { ...currentAL.tts!, status: 'error' },
          },
        })
        console.error('Narration generation failed:', err)
      }
    },

    addSFXToScene: (sceneId: string, sfx: SFXTrack) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      const audioLayer = normalizeAudioLayer(scene.audioLayer)
      const existingSfx = audioLayer.sfx ?? []
      get().updateScene(sceneId, {
        audioLayer: { ...audioLayer, enabled: true, sfx: [...existingSfx, sfx] },
      })
      get().saveSceneHTML(sceneId)
    },

    removeSFXFromScene: (sceneId: string, sfxId: string) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      const audioLayer = normalizeAudioLayer(scene.audioLayer)
      get().updateScene(sceneId, {
        audioLayer: { ...audioLayer, sfx: (audioLayer.sfx ?? []).filter((s) => s.id !== sfxId) },
      })
      get().saveSceneHTML(sceneId)
    },

    setSceneMusic: (sceneId: string, music: MusicTrack | null) => {
      const scene = get().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      const audioLayer = normalizeAudioLayer(scene.audioLayer)
      get().updateScene(sceneId, {
        audioLayer: { ...audioLayer, enabled: true, music },
      })
      get().saveSceneHTML(sceneId)
    },
  }
}

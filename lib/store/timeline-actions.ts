'use client'

import { v4 as uuidv4 } from 'uuid'
import type { Track, TrackType, Clip } from '../types'
import type { Set, Get } from './types'

export function createTimelineActions(set: Set, get: Get) {
  return {
    getTimeline: () => get().project.timeline ?? null,

    initTimeline: (force?: boolean) => {
      const state = get()
      if (state.project.timeline && !force) return
      const scenes = state.scenes

      const v1Id = uuidv4()
      const v2Id = uuidv4()
      const a1Id = uuidv4()
      const a2Id = uuidv4()

      const tracks: Track[] = [
        { id: v1Id, name: 'V1', type: 'video', clips: [], muted: false, locked: false, position: 0 },
        { id: v2Id, name: 'V2', type: 'video', clips: [], muted: false, locked: false, position: 1 },
        { id: a1Id, name: 'A1', type: 'audio', clips: [], muted: false, locked: false, position: 2 },
        { id: a2Id, name: 'A2', type: 'audio', clips: [], muted: false, locked: false, position: 3 },
      ]

      const makeClip = (
        trackId: string,
        sourceType: 'scene' | 'audio' | 'video' | 'title',
        sourceId: string,
        label: string,
        startTime: number,
        duration: number,
      ): Clip => ({
        id: uuidv4(),
        trackId,
        sourceType,
        sourceId,
        label,
        startTime,
        duration,
        trimStart: 0,
        trimEnd: null,
        speed: 1,
        opacity: 1,
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        filters: [],
        keyframes: [],
      })

      let acc = 0
      for (const scene of scenes) {
        // V1: scene clips
        const sceneClip = makeClip(v1Id, 'scene', scene.id, scene.name || 'Untitled', acc, scene.duration)
        if (scene.transition) {
          sceneClip.transition = {
            type: (scene.transition as any).type ?? 'none',
            duration: (scene.transition as any).duration ?? 0.5,
          }
        }
        tracks[0].clips.push(sceneClip)

        // A1 (tracks[2]): TTS and file audio
        const al = scene.audioLayer
        if (al?.enabled && al.src?.trim()) {
          const off = Math.max(0, Math.min(scene.duration, al.startOffset ?? 0))
          tracks[2].clips.push(
            makeClip(a1Id, 'audio', `aud-${scene.id}`, 'Audio', acc + off, Math.max(0.1, scene.duration - off)),
          )
        }
        const tts = al?.tts
        if (tts && (tts.text?.trim() || tts.src?.trim())) {
          const off = Math.max(0, Math.min(scene.duration, al!.startOffset ?? 0))
          const d =
            tts.duration != null && tts.duration > 0
              ? Math.min(tts.duration, scene.duration - off)
              : Math.max(0.2, scene.duration - off)
          tracks[2].clips.push(makeClip(a1Id, 'audio', `tts-${scene.id}`, 'TTS', acc + off, d))
        }

        // A2 (tracks[3]): Music and SFX
        if (al?.music?.src?.trim()) {
          const off = Math.max(0, Math.min(scene.duration, al.startOffset ?? 0))
          tracks[3].clips.push(
            makeClip(
              a2Id,
              'audio',
              `mus-${scene.id}`,
              al.music!.name || 'Music',
              acc + off,
              Math.max(0.1, scene.duration - off),
            ),
          )
        }
        al?.sfx?.forEach((sfx) => {
          const at = Math.max(0, Math.min(scene.duration, sfx.triggerAt))
          const d = Math.max(0.05, Math.min(sfx.duration ?? 0.2, scene.duration - at))
          tracks[3].clips.push(makeClip(a2Id, 'audio', sfx.id, sfx.name || 'SFX', acc + at, d))
        })

        acc += scene.duration
      }

      // Remove empty audio tracks (but keep all default tracks when no scenes exist)
      const finalTracks = scenes.length === 0 ? tracks : tracks.filter((t) => t.type === 'video' || t.clips.length > 0)
      // Ensure at least one audio track exists
      if (!finalTracks.some((t) => t.type === 'audio')) {
        finalTracks.push({ id: a1Id, name: 'A1', type: 'audio', clips: [], muted: false, locked: false, position: 1 })
      }
      // Re-number positions
      finalTracks.forEach((t, i) => {
        t.position = i
      })

      set((state) => ({
        project: { ...state.project, timeline: { tracks: finalTracks }, updatedAt: new Date().toISOString() },
      }))
    },

    syncTimelineFromScenes: () => {
      // Re-derive timeline clips from current scenes, preserving user edits
      const state = get()
      const tl = state.project.timeline
      if (!tl) {
        get().initTimeline()
        return
      }

      // Find V1 track and update scene clips
      const v1 = tl.tracks.find((t) => t.type === 'video')
      if (!v1) return

      // Find or create audio tracks
      let a1 = tl.tracks.find((t) => t.type === 'audio')
      let a2 = tl.tracks.find((t) => t.type === 'audio' && t.id !== a1?.id)
      const a1Id = a1?.id ?? uuidv4()
      const a2Id = a2?.id ?? uuidv4()

      const makeClip = (
        trackId: string,
        sourceType: 'scene' | 'audio' | 'video' | 'title',
        sourceId: string,
        label: string,
        startTime: number,
        duration: number,
      ): Clip => ({
        id: uuidv4(),
        trackId,
        sourceType,
        sourceId,
        label,
        startTime,
        duration,
        trimStart: 0,
        trimEnd: null,
        speed: 1,
        opacity: 1,
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        filters: [],
        keyframes: [],
      })

      let acc = 0
      const newSceneClips: Clip[] = []
      const newA1Clips: Clip[] = []
      const newA2Clips: Clip[] = []

      for (const scene of state.scenes) {
        // V1: scene clips
        const existing = v1.clips.find((c) => c.sourceId === scene.id && c.sourceType === 'scene')
        if (existing) {
          // Preserve user edits but update position
          newSceneClips.push({ ...existing, startTime: acc, label: scene.name || existing.label })
          // Only update duration if user hasn't trimmed it
          if (existing.trimStart === 0 && existing.trimEnd === null) {
            newSceneClips[newSceneClips.length - 1].duration = scene.duration
          }
        } else {
          newSceneClips.push(makeClip(v1.id, 'scene', scene.id, scene.name || 'Untitled', acc, scene.duration))
        }

        // A1: TTS and file audio
        const al = scene.audioLayer
        if (al?.enabled && al.src?.trim()) {
          const off = Math.max(0, Math.min(scene.duration, al.startOffset ?? 0))
          newA1Clips.push(
            makeClip(a1Id, 'audio', `aud-${scene.id}`, 'Audio', acc + off, Math.max(0.1, scene.duration - off)),
          )
        }
        const tts = al?.tts
        if (tts && (tts.text?.trim() || tts.src?.trim())) {
          const existingTts = a1 ? a1.clips.find((c) => c.sourceId === `tts-${scene.id}`) : null
          if (existingTts) {
            newA1Clips.push({
              ...existingTts,
              startTime: acc + Math.max(0, Math.min(scene.duration, al!.startOffset ?? 0)),
            })
          } else {
            const off = Math.max(0, Math.min(scene.duration, al!.startOffset ?? 0))
            const d =
              tts.duration != null && tts.duration > 0
                ? Math.min(tts.duration, scene.duration - off)
                : Math.max(0.2, scene.duration - off)
            newA1Clips.push(makeClip(a1Id, 'audio', `tts-${scene.id}`, 'TTS', acc + off, d))
          }
        }

        // A2: Music and SFX
        if (al?.music?.src?.trim()) {
          const off = Math.max(0, Math.min(scene.duration, al.startOffset ?? 0))
          newA2Clips.push(
            makeClip(
              a2Id,
              'audio',
              `mus-${scene.id}`,
              al.music!.name || 'Music',
              acc + off,
              Math.max(0.1, scene.duration - off),
            ),
          )
        }
        al?.sfx?.forEach((sfx) => {
          const at = Math.max(0, Math.min(scene.duration, sfx.triggerAt))
          const d = Math.max(0.05, Math.min(sfx.duration ?? 0.2, scene.duration - at))
          newA2Clips.push(makeClip(a2Id, 'audio', sfx.id, sfx.name || 'SFX', acc + at, d))
        })

        acc += scene.duration
      }

      // Keep non-scene clips on V1 (user-added video/image clips)
      const nonSceneClips = v1.clips.filter((c) => c.sourceType !== 'scene')

      // Build updated tracks
      let updatedTracks = tl.tracks.map((t) => {
        if (t.id === v1.id) return { ...t, clips: [...newSceneClips, ...nonSceneClips] }
        if (t.id === a1Id) return { ...t, clips: newA1Clips }
        if (t.id === a2Id) return { ...t, clips: newA2Clips }
        return t
      })

      // If A1 didn't exist, add it
      if (!a1 && newA1Clips.length > 0) {
        updatedTracks.push({
          id: a1Id,
          name: 'A1',
          type: 'audio' as const,
          clips: newA1Clips,
          muted: false,
          locked: false,
          position: updatedTracks.length,
        })
      }
      // If A2 didn't exist, add it
      if (!a2 && newA2Clips.length > 0) {
        updatedTracks.push({
          id: a2Id,
          name: 'A2',
          type: 'audio' as const,
          clips: newA2Clips,
          muted: false,
          locked: false,
          position: updatedTracks.length,
        })
      }

      set((s) => ({
        project: {
          ...s.project,
          timeline: { tracks: updatedTracks },
          updatedAt: new Date().toISOString(),
        },
      }))
    },

    addTrack: (type: TrackType, name?: string) => {
      const id = uuidv4()
      set((state) => {
        const tl = state.project.timeline ?? { tracks: [] }
        const maxPos = tl.tracks.reduce((m, t) => Math.max(m, t.position), -1)
        const newTrack: Track = {
          id,
          name: name ?? `Track ${tl.tracks.length + 1}`,
          type,
          clips: [],
          muted: false,
          locked: false,
          position: maxPos + 1,
        }
        return {
          project: {
            ...state.project,
            timeline: { tracks: [...tl.tracks, newTrack] },
            updatedAt: new Date().toISOString(),
          },
        }
      })
      return id
    },

    removeTrack: (trackId: string) => {
      set((state) => {
        const tl = state.project.timeline
        if (!tl) return state
        return {
          project: {
            ...state.project,
            timeline: { tracks: tl.tracks.filter((t) => t.id !== trackId) },
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },

    updateTrack: (trackId: string, updates: Partial<Pick<Track, 'name' | 'muted' | 'locked' | 'position'>>) => {
      set((state) => {
        const tl = state.project.timeline
        if (!tl) return state
        return {
          project: {
            ...state.project,
            timeline: {
              tracks: tl.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
            },
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },

    addClip: (trackId: string, clipData: Omit<Clip, 'id' | 'trackId'>) => {
      const id = uuidv4()
      set((state) => {
        const tl = state.project.timeline
        if (!tl) return state
        const clip: Clip = { ...clipData, id, trackId } as Clip
        return {
          project: {
            ...state.project,
            timeline: {
              tracks: tl.tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t)),
            },
            updatedAt: new Date().toISOString(),
          },
        }
      })
      return id
    },

    removeClip: (clipId: string) => {
      set((state) => {
        const tl = state.project.timeline
        if (!tl) return state
        return {
          project: {
            ...state.project,
            timeline: {
              tracks: tl.tracks.map((t) => ({
                ...t,
                clips: t.clips.filter((c) => c.id !== clipId),
              })),
            },
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },

    updateClip: (clipId: string, updates: Partial<Clip>) => {
      set((state) => {
        const tl = state.project.timeline
        if (!tl) return state
        return {
          project: {
            ...state.project,
            timeline: {
              tracks: tl.tracks.map((t) => ({
                ...t,
                clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
              })),
            },
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },

    splitClip: (clipId: string, atTime: number) => {
      const tl = get().project.timeline
      if (!tl) return null
      let found: { track: Track; clip: Clip } | null = null
      for (const t of tl.tracks) {
        const c = t.clips.find((c) => c.id === clipId)
        if (c) {
          found = { track: t, clip: c }
          break
        }
      }
      if (!found) return null
      const { clip } = found
      // atTime is relative to clip start
      if (atTime <= 0 || atTime >= clip.duration) return null
      const leftId = uuidv4()
      const rightId = uuidv4()
      const leftClip: Clip = {
        ...clip,
        id: leftId,
        duration: atTime,
        trimEnd: clip.trimStart + atTime * clip.speed,
        keyframes: clip.keyframes.filter((k) => k.time < atTime),
      }
      const rightClip: Clip = {
        ...clip,
        id: rightId,
        startTime: clip.startTime + atTime,
        duration: clip.duration - atTime,
        trimStart: clip.trimStart + atTime * clip.speed,
        keyframes: clip.keyframes.filter((k) => k.time >= atTime).map((k) => ({ ...k, time: k.time - atTime })),
      }
      set((state) => {
        const tl = state.project.timeline
        if (!tl) return state
        return {
          project: {
            ...state.project,
            timeline: {
              tracks: tl.tracks.map((t) => ({
                ...t,
                clips: t.clips.flatMap((c) => (c.id === clipId ? [leftClip, rightClip] : [c])),
              })),
            },
            updatedAt: new Date().toISOString(),
          },
        }
      })
      return { leftId, rightId }
    },

    moveClip: (clipId: string, toTrackId: string, startTime: number) => {
      set((state) => {
        const tl = state.project.timeline
        if (!tl) return state
        let movedClip: Clip | null = null
        // Remove from current track
        const tracksAfterRemove = tl.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => {
            if (c.id === clipId) {
              movedClip = c
              return false
            }
            return true
          }),
        }))
        if (!movedClip) return state
        // Add to target track
        const updatedClip: Clip = { ...(movedClip as Clip), trackId: toTrackId, startTime }
        return {
          project: {
            ...state.project,
            timeline: {
              tracks: tracksAfterRemove.map((t) =>
                t.id === toTrackId ? { ...t, clips: [...t.clips, updatedClip] } : t,
              ),
            },
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },
  }
}

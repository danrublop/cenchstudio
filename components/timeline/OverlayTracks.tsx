'use client'

import { useMemo } from 'react'
import { useVideoStore } from '@/lib/store'
import type { AILayer, Scene, SceneType } from '@/lib/types'
import { TYPE_BADGE_COLORS } from './SceneTrack'

const EPS = 1e-4

function clampTime(t: number, sceneDuration: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(sceneDuration)) return 0
  return Math.max(0, Math.min(sceneDuration, t))
}

function clampSpan(start: number, len: number, sceneDuration: number): { start: number; duration: number } {
  const s = clampTime(start, sceneDuration)
  const maxLen = Math.max(0, sceneDuration - s)
  const d = Number.isFinite(len) ? Math.max(0, Math.min(maxLen, len)) : maxLen
  return { start: s, duration: d }
}

function sceneHasCanvasTimelineClip(scene: Scene): boolean {
  if (scene.canvasBackgroundCode?.trim()) return true
  if (scene.sceneType === 'canvas2d' && scene.canvasCode?.trim()) return true
  return false
}

function aiLayerSpan(layer: AILayer, sceneDuration: number): { start: number; duration: number } {
  const start = clampTime(layer.startAt ?? 0, sceneDuration)
  const remain = Math.max(0.05, sceneDuration - start)
  if (layer.type === 'veo3') {
    return { start, duration: Math.min(layer.duration, remain) }
  }
  if (layer.type === 'avatar') {
    const d = layer.estimatedDuration
    if (d > 0) return { start, duration: Math.min(d, remain) }
    return { start, duration: remain }
  }
  return { start, duration: remain }
}

/** One item on the stacked timeline (Premiere-style lanes) */
interface LayerClip {
  id: string
  globalStart: number
  globalEnd: number
  label: string
  title: string
  color: string
  /** Lower → tends toward lower lane (below); audio uses negative z */
  z: number
}

type PackedClip = LayerClip & { track: number }

function packIntoTracks(clips: LayerClip[]): PackedClip[] {
  const sorted = [...clips].sort((a, b) => a.globalStart - b.globalStart || a.z - b.z || a.id.localeCompare(b.id))
  const laneEnd: number[] = []
  return sorted.map((clip) => {
    let t = 0
    while (t < laneEnd.length && laneEnd[t] > clip.globalStart + EPS) t++
    if (t === laneEnd.length) laneEnd.push(clip.globalEnd)
    else laneEnd[t] = Math.max(laneEnd[t], clip.globalEnd)
    return { ...clip, track: t }
  })
}

function collectLayerClips(scenes: Scene[], sceneStarts: number[]): LayerClip[] {
  const out: LayerClip[] = []

  scenes.forEach((scene, si) => {
    const sceneStart = sceneStarts[si]
    const dur = scene.duration
    const st = (scene.sceneType ?? 'svg') as SceneType
    const baseColor = TYPE_BADGE_COLORS[st] ?? '#64748b'
    const sceneLabel = scene.name?.trim() || `Scene ${si + 1}`

    // L0 foundation: one full-scene block (main edit / scene body)
    out.push({
      id: `base-${scene.id}`,
      globalStart: sceneStart,
      globalEnd: sceneStart + dur,
      label: `${si + 1}`,
      title: `${sceneLabel} · ${st}`,
      color: baseColor,
      z: 0,
    })

    if (sceneHasCanvasTimelineClip(scene) && scene.sceneType !== 'canvas2d') {
      out.push({
        id: `cv-${scene.id}`,
        globalStart: sceneStart,
        globalEnd: sceneStart + dur,
        label: 'Cv',
        title: scene.canvasBackgroundCode?.trim() ? 'Canvas background' : 'Canvas layer',
        color: '#14b8a6',
        z: 2,
      })
    }

    if ((scene.physicsLayers?.length ?? 0) > 0) {
      out.push({
        id: `phy-${scene.id}`,
        globalStart: sceneStart,
        globalEnd: sceneStart + dur,
        label: 'Ph',
        title: `${scene.physicsLayers!.length} physics`,
        color: '#06b6d4',
        z: 4,
      })
    }

    if ((scene.svgObjects?.length ?? 0) > 0) {
      out.push({
        id: `svg-${scene.id}`,
        globalStart: sceneStart,
        globalEnd: sceneStart + dur,
        label: 'Sg',
        title: `${scene.svgObjects!.length} SVG object(s)`,
        color: '#e84545',
        z: 6,
      })
    }

    ;(scene.aiLayers ?? []).forEach((layer) => {
      const { start, duration } = aiLayerSpan(layer, dur)
      if (duration <= 0) return
      const z = Number.isFinite(layer.zIndex) ? layer.zIndex : 20
      const short =
        layer.type === 'avatar' ? 'Av' : layer.type === 'veo3' ? 'Veo' : layer.type === 'image' ? 'Img' : 'St'
      out.push({
        id: layer.id,
        globalStart: sceneStart + start,
        globalEnd: sceneStart + start + duration,
        label: short,
        title: `${layer.type}: ${layer.label || layer.id.slice(0, 8)}`,
        color: '#ec4899',
        z: z + 20,
      })
    })
    ;(scene.chartLayers ?? []).forEach((ch, idx) => {
      const rawT0 = ch.timing?.startAt ?? 0
      const rawD = ch.timing?.duration ?? dur - rawT0
      const { start: t0, duration: d } = clampSpan(rawT0, Math.max(0.05, rawD), dur)
      if (d <= 0) return
      out.push({
        id: ch.id,
        globalStart: sceneStart + t0,
        globalEnd: sceneStart + t0 + d,
        label: 'D3',
        title: ch.name || ch.chartType,
        color: '#22c55e',
        z: 40 + idx,
      })
    })
    ;(scene.textOverlays ?? []).forEach((t) => {
      const { start: t0, duration: td } = clampSpan(t.delay, t.duration, dur)
      if (td <= 0) return
      out.push({
        id: t.id,
        globalStart: sceneStart + t0,
        globalEnd: sceneStart + t0 + td,
        label: 'Tx',
        title: t.content.slice(0, 40) + (t.content.length > 40 ? '…' : ''),
        color: '#4a9eff',
        z: 80,
      })
    })

    if (scene.videoLayer?.enabled && scene.videoLayer.src) {
      out.push({
        id: `vid-${scene.id}`,
        globalStart: sceneStart,
        globalEnd: sceneStart + dur,
        label: 'Vid',
        title: 'Video layer',
        color: '#65a30d',
        z: 35,
      })
    }

    if (scene.audioLayer?.enabled && scene.audioLayer.src?.trim()) {
      const off = clampTime(scene.audioLayer.startOffset ?? 0, dur)
      const w = Math.max(0, dur - off)
      if (w > 0) {
        out.push({
          id: `aud-${scene.id}`,
          globalStart: sceneStart + off,
          globalEnd: sceneStart + off + w,
          label: 'Au',
          title: 'Audio file',
          color: '#a78bfa',
          z: -26,
        })
      }
    }

    const tts = scene.audioLayer?.tts
    if (tts && (tts.text?.trim() || tts.src?.trim())) {
      const off = clampTime(scene.audioLayer!.startOffset ?? 0, dur)
      const rawD = tts.duration != null && tts.duration > 0 ? tts.duration : Math.max(0.2, dur - off)
      const { start: t0, duration: d } = clampSpan(off, rawD, dur)
      if (d > 0) {
        out.push({
          id: `tts-${scene.id}`,
          globalStart: sceneStart + t0,
          globalEnd: sceneStart + t0 + d,
          label: 'Tts',
          title: 'TTS',
          color: '#38bdf8',
          z: -24,
        })
      }
    }

    if (scene.audioLayer?.music?.src?.trim()) {
      const off = clampTime(scene.audioLayer.startOffset ?? 0, dur)
      const w = Math.max(0, dur - off)
      if (w > 0) {
        out.push({
          id: `mus-${scene.id}`,
          globalStart: sceneStart + off,
          globalEnd: sceneStart + off + w,
          label: 'Mu',
          title: scene.audioLayer.music!.name || 'Music',
          color: '#c084fc',
          z: -28,
        })
      }
    }

    scene.audioLayer?.sfx?.forEach((sfx) => {
      const at = clampTime(sfx.triggerAt, dur)
      const sfxLen = Math.max(0.05, sfx.duration ?? 0.2)
      const { duration: sfxDur } = clampSpan(at, sfxLen, dur)
      if (sfxDur <= 0) return
      out.push({
        id: sfx.id,
        globalStart: sceneStart + at,
        globalEnd: sceneStart + at + sfxDur,
        label: 'Sfx',
        title: sfx.name,
        color: '#f472b6',
        z: -22,
      })
    })

    scene.interactions?.forEach((inter) => {
      const appear = clampTime(inter.appearsAt, dur)
      const hide = inter.hidesAt
      const rawEnd = hide != null ? hide : dur
      const span = Math.max(0, rawEnd - appear)
      const { start: a0, duration: spanClamped } = clampSpan(appear, span, dur)
      if (spanClamped <= 0) return
      const shortSpan = spanClamped < 0.12
      const g0 = sceneStart + a0
      const g1 = shortSpan ? g0 + Math.max(0.06, spanClamped) : g0 + spanClamped
      out.push({
        id: inter.id,
        globalStart: g0,
        globalEnd: g1,
        label: shortSpan ? '◇' : 'In',
        title: inter.type,
        color: '#f97316',
        z: 90,
      })
    })
    ;(scene.cameraMotion ?? []).forEach((move, mi) => {
      const at = typeof move.params?.at === 'number' ? move.params.at : 0
      const t = clampTime(at, dur)
      const half = 0.08
      const g0 = Math.max(sceneStart, sceneStart + t - half)
      const g1 = Math.min(sceneStart + dur, sceneStart + t + half)
      if (g1 <= g0) return
      out.push({
        id: `cam-${scene.id}-${mi}`,
        globalStart: g0,
        globalEnd: g1,
        label: '◇',
        title: `${move.type} @ ${t.toFixed(1)}s`,
        color: '#f59e0b',
        z: 100,
      })
    })
  })

  return out
}

interface Props {
  pps: number
  scrollX: number
  heightBudget: number
}

export default function OverlayTracks({ pps, scrollX, heightBudget }: Props) {
  const { scenes } = useVideoStore()

  const { packed, numTracks, totalDuration, laneHeight } = useMemo(() => {
    let acc = 0
    const sceneStarts = scenes.map((s) => {
      const start = acc
      acc += s.duration
      return start
    })
    const totalDuration = acc
    const clips = collectLayerClips(scenes, sceneStarts)
    const packed = packIntoTracks(clips)
    const numTracks = packed.length === 0 ? 0 : Math.max(1, ...packed.map((c) => c.track + 1))
    const laneHeight = Math.max(9, Math.min(12, Math.floor(heightBudget / Math.max(1, numTracks)) || 10))
    return { packed, numTracks, totalDuration, laneHeight }
  }, [scenes, heightBudget])

  if (scenes.length === 0 || totalDuration <= 0) return null

  if (numTracks === 0) {
    return (
      <div
        className="flex items-center justify-center text-[var(--color-text-muted)]"
        style={{ height: Math.max(10, heightBudget), fontSize: 8 }}
      >
        No layer clips
      </div>
    )
  }

  const byTrack: PackedClip[][] = Array.from({ length: numTracks }, () => [])
  for (const c of packed) {
    byTrack[c.track].push(c)
  }

  // Premiere-like: highest track index at top of stack
  const laneIndices = Array.from({ length: numTracks }, (_, i) => numTracks - 1 - i)

  return (
    <div className="relative flex flex-col" style={{ minHeight: laneHeight * numTracks }}>
      {laneIndices.map((trackIdx) => {
        const clipsOnLane = byTrack[trackIdx]
        const displayNum = trackIdx + 1
        return (
          <div
            key={trackIdx}
            className="relative flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-panel)]/80"
            style={{ height: laneHeight }}
          >
            <span
              className="absolute z-10 font-mono tabular-nums pointer-events-none select-none"
              style={{
                left: Math.max(2, scrollX + 2),
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 7,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                opacity: 0.9,
              }}
            >
              L{displayNum}
            </span>

            <div
              className="absolute top-0 bottom-0 left-0"
              style={{
                width: totalDuration * pps,
                transform: `translateX(${-scrollX}px)`,
              }}
            >
              {clipsOnLane.map((clip) => {
                const left = clip.globalStart * pps
                const width = Math.max(1, (clip.globalEnd - clip.globalStart) * pps)
                const isMarker = clip.label === '◇'

                if (isMarker) {
                  const cx = (clip.globalStart + clip.globalEnd) / 2
                  return (
                    <div
                      key={clip.id}
                      title={clip.title}
                      className="absolute"
                      style={{
                        left: cx * pps - 3,
                        top: Math.max(0, Math.floor((laneHeight - 6) / 2)),
                        width: 6,
                        height: 6,
                        background: clip.color,
                        transform: 'rotate(45deg)',
                        borderRadius: 1,
                        boxShadow: `0 0 4px ${clip.color}88`,
                      }}
                    />
                  )
                }

                return (
                  <div
                    key={clip.id}
                    title={clip.title}
                    className="absolute overflow-hidden rounded-[2px] text-[6px] font-semibold leading-none flex items-center px-0.5"
                    style={{
                      left,
                      width,
                      top: 1,
                      bottom: 1,
                      background: `${clip.color}aa`,
                      boxShadow: `inset 0 0 0 1px ${clip.color}`,
                      color: 'rgba(255,255,255,0.92)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    }}
                  >
                    {width > 14 ? clip.label : ''}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

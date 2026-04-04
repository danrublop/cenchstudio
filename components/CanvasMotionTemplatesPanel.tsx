'use client'

import { useMemo, useState } from 'react'
import { useVideoStore } from '@/lib/store'
import type { Scene } from '@/lib/types'
import {
  CANVAS_MOTION_TEMPLATES,
  buildCanvasAnimationCode,
  getCanvasMotionTemplate,
} from '@/lib/templates/canvas-animation-templates'

interface Props {
  scene: Scene
}

const BG_ELIGIBLE = new Set(['motion', 'd3', 'svg', 'physics'])

export default function CanvasMotionTemplatesPanel({ scene }: Props) {
  const { updateScene, saveSceneHTML, _pushUndo } = useVideoStore()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string>('all')
  const canLayerBehind = BG_ELIGIBLE.has(scene.sceneType ?? '')
  const [mode, setMode] = useState<'background' | 'full'>(canLayerBehind ? 'background' : 'full')

  const tags = useMemo(() => {
    const s = new Set<string>()
    for (const t of CANVAS_MOTION_TEMPLATES) t.tags.forEach((x) => s.add(x))
    return ['all', ...[...s].sort()]
  }, [])

  const filtered = useMemo(() => {
    let list = CANVAS_MOTION_TEMPLATES
    if (tag !== 'all') list = list.filter((t) => t.tags.includes(tag))
    if (q.trim()) {
      const n = q.toLowerCase()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(n) ||
          t.description.toLowerCase().includes(n) ||
          t.id.includes(n) ||
          t.tags.some((x) => x.includes(n)),
      )
    }
    return list
  }, [q, tag])

  const applyFullScene = async (id: string) => {
    const meta = getCanvasMotionTemplate(id)
    if (!meta) return
    _pushUndo()
    const code = buildCanvasAnimationCode(id)
    updateScene(scene.id, {
      sceneType: 'canvas2d',
      canvasCode: code,
      canvasBackgroundCode: '',
      bgColor: meta.suggestedBgColor,
      sceneCode: '',
      sceneHTML: '',
      sceneStyles: '',
      lottieSource: '',
      d3Data: null,
      chartLayers: [],
      physicsLayers: [],
      worldConfig: null,
      svgContent: '',
      svgObjects: [],
    })
    await saveSceneHTML(scene.id)
  }

  const applyAsBackground = async (id: string) => {
    const meta = getCanvasMotionTemplate(id)
    if (!meta) return
    _pushUndo()
    const code = buildCanvasAnimationCode(id, { layout: 'fill' })
    updateScene(scene.id, {
      canvasBackgroundCode: code,
      bgColor: meta.suggestedBgColor,
    })
    await saveSceneHTML(scene.id)
  }

  const clearBackground = async () => {
    if (!scene.canvasBackgroundCode?.trim()) return
    _pushUndo()
    updateScene(scene.id, { canvasBackgroundCode: '' })
    await saveSceneHTML(scene.id)
  }

  const apply = async (id: string) => {
    if (mode === 'background' && canLayerBehind) await applyAsBackground(id)
    else await applyFullScene(id)
  }

  return (
    <div className="px-3 py-2 space-y-2">
      {canLayerBehind ? (
        <div
          className="flex rounded-lg border overflow-hidden text-[10px]"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            className="flex-1 py-1.5 px-2 transition-colors"
            style={{
              background: mode === 'background' ? '#e84545' : 'transparent',
              color: mode === 'background' ? '#fff' : '#6b6b7a',
            }}
            onClick={() => setMode('background')}
          >
            Full background
          </button>
          <button
            type="button"
            className="flex-1 py-1.5 px-2 transition-colors border-l"
            style={{
              borderColor: 'var(--color-border)',
              background: mode === 'full' ? '#e84545' : 'transparent',
              color: mode === 'full' ? '#fff' : '#6b6b7a',
            }}
            onClick={() => setMode('full')}
          >
            Whole scene (Canvas2D)
          </button>
        </div>
      ) : null}
      <p className="text-[11px] text-[#6b6b7a] leading-snug">
        {mode === 'background' && canLayerBehind
          ? 'Animates behind your current Motion, D3, or SVG content (1920×1080 canvas, scrub-friendly).'
          : 'Replaces this scene with a Canvas2D-only loop. Use Full background if you want to keep Motion / D3 / SVG on top.'}
      </p>
      {scene.canvasBackgroundCode?.trim() ? (
        <button
          type="button"
          onClick={() => void clearBackground()}
          className="text-[10px] px-2 py-1 rounded border w-full transition-colors hover:border-[#e84545]"
          style={{ borderColor: 'var(--color-border)', color: '#6b6b7a' }}
        >
          Remove canvas background
        </button>
      ) : null}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search templates…"
        className="w-full border rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#e84545]"
        style={{
          backgroundColor: 'var(--color-input-bg)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(t)}
            className="rounded-full px-2 py-0.5 text-[10px] border transition-colors"
            style={{
              background: tag === t ? '#e84545' : 'transparent',
              borderColor: tag === t ? '#e84545' : 'var(--color-border)',
              color: tag === t ? '#fff' : '#6b6b7a',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => apply(t.id)}
            className="text-left rounded border px-2 py-1.5 transition-colors hover:border-[#e84545]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">{t.name}</div>
            <div className="text-[10px] text-[#6b6b7a] line-clamp-2">{t.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

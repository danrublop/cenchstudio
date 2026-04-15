'use client'

import { useMemo } from 'react'
import type { CameraMove } from '@/lib/types/scene'
import {
  CAMERA_EFFECT_CATALOG,
  type CameraEffectId,
  cameraEffectIdFromScene,
  defaultCameraMoveParams,
} from '@/lib/camera-effects'
import './camera-effect-preview.css'

function hashSeed(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return String(Math.abs(h))
}

function picsumForEffect(id: CameraEffectId): string {
  const seed = hashSeed(`camera-fx-${id}`)
  return `https://picsum.photos/seed/${seed}/480/270`
}

function effectTypeToPreviewClass(id: CameraEffectId): string {
  if (id === 'none') return 'ce-m-none'
  const kebab = id.replace(/([A-Z])/g, '-$1').toLowerCase()
  return `ce-m-${kebab}`
}

function EffectThumb({ id, url }: { id: CameraEffectId; url: string }) {
  const common = 'pointer-events-none h-full w-full select-none object-cover'
  if (id === 'none') {
    return <img src={url} alt="" className={`absolute inset-0 ${common}`} draggable={false} />
  }
  const cls = effectTypeToPreviewClass(id)
  const use3d = id === 'orbit' || id === 'dolly3D' || id === 'rackFocus3D'
  return (
    <div className={use3d ? 'ce-stage-3d absolute inset-0' : 'absolute inset-0'}>
      <div className={`ce-layer absolute inset-0 ${cls}`}>
        <img src={url} alt="" className={common} draggable={false} />
      </div>
    </div>
  )
}

export type CameraEffectPickerGridProps = {
  sceneDuration: number
  cameraMotion: CameraMove[] | null | undefined
  onApplyMotion: (motion: CameraMove[] | null) => void
  onUpdateTiming: (patch: { at?: number; duration?: number }) => void
  importableCount: number
  onImportFromCode: () => void
}

export default function CameraEffectPickerGrid({
  sceneDuration,
  cameraMotion,
  onApplyMotion,
  onUpdateTiming,
  importableCount,
  onImportFromCode,
}: CameraEffectPickerGridProps) {
  const selectedId = cameraEffectIdFromScene(cameraMotion)
  const first = cameraMotion?.[0]
  const at = typeof first?.params?.at === 'number' ? first.params.at : 0
  const duration =
    typeof first?.params?.duration === 'number'
      ? first.params.duration
      : Math.max(1, sceneDuration - 0.5)

  const byCategory = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, typeof CAMERA_EFFECT_CATALOG>()
    for (const row of CAMERA_EFFECT_CATALOG) {
      if (!map.has(row.category)) {
        order.push(row.category)
        map.set(row.category, [])
      }
      map.get(row.category)!.push(row)
    }
    return order.map((category) => ({ category, items: map.get(category)! }))
  }, [])

  const select = (id: CameraEffectId) => {
    if (id === 'none') {
      onApplyMotion(null)
      return
    }
    const prev = cameraMotion?.[0]
    onApplyMotion([
      {
        type: id as CameraMove['type'],
        params: defaultCameraMoveParams(sceneDuration, prev),
      },
    ])
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-snug text-[var(--color-text-muted)]">
        Pick one camera effect for this scene. Hover a card to preview motion on demo photos (Picsum). Export uses
        your scene&apos;s camera pipeline.
      </p>

      {importableCount > 0 && (
        <div
          className="rounded-lg border p-2.5 text-[11px]"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p className="text-[var(--color-text-muted)]">
            Found {importableCount} camera move{importableCount === 1 ? '' : 's'} in scene code. Import to edit timing
            here.
          </p>
          <button
            type="button"
            onClick={onImportFromCode}
            className="kbd mt-2 h-7 px-2 text-[11px] text-[var(--color-text-muted)] hover:text-[#e84545]"
          >
            Import from code
          </button>
        </div>
      )}

      {byCategory.map(({ category, items }) => (
        <div key={category}>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#8b8b99]">{category}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {items.map((t) => {
              const url = picsumForEffect(t.id)
              const selected = selectedId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => select(t.id)}
                  className={`ce-card group text-left rounded-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] ${
                    selected
                      ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-panel)]'
                      : ''
                  }`}
                  aria-pressed={selected}
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#0d0d0f] shadow-inner ring-1 ring-white/10">
                    <EffectThumb id={t.id} url={url} />
                  </div>
                  <div className="mt-1.5 truncate px-0.5 text-[11px] font-medium leading-tight text-[var(--color-text-primary)]">
                    {t.label}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {selectedId !== 'none' && (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
          <div>
            <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">Start (s)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={at}
              onChange={(e) => onUpdateTiming({ at: parseFloat(e.target.value) || 0 })}
              className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">Duration (s)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={duration}
              onChange={(e) => onUpdateTiming({ duration: Math.max(0.1, parseFloat(e.target.value) || 1) })}
              className="w-full rounded border px-2 py-1 text-[12px] focus:border-[#e84545] focus:outline-none"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

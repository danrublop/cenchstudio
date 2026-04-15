'use client'

import { useMemo } from 'react'
import type { TransitionCatalogEntry, TransitionType } from '@/lib/transitions'
import { TRANSITION_CATALOG } from '@/lib/transitions'
import './transition-preview.css'

function hashSeed(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return String(Math.abs(h))
}

function picsumPair(id: TransitionType): { a: string; b: string } {
  const sa = hashSeed(`${id}-demo-a`)
  const sb = hashSeed(`${id}-demo-b`)
  return {
    a: `https://picsum.photos/seed/${sa}/480/270`,
    b: `https://picsum.photos/seed/${sb}/480/270`,
  }
}

type ThumbProps = {
  transition: TransitionCatalogEntry
  urlA: string
  urlB: string
}

function TransitionThumb({ transition, urlA, urlB }: ThumbProps) {
  const xfade = transition.xfade
  const commonImg = 'absolute inset-0 h-full w-full object-cover pointer-events-none select-none'

  if (xfade === null) {
    return (
      <>
        <img src={urlA} alt="" className={commonImg} draggable={false} />
        <img src={urlB} alt="" className={`${commonImg} z-[1] tp-b-cut`} draggable={false} />
      </>
    )
  }

  if (xfade === 'fadeblack') {
    return (
      <>
        <img src={urlA} alt="" className={`${commonImg} tp-a-fadeblack`} draggable={false} />
        <div
          className="absolute inset-0 z-[1] bg-black tp-mid-fadeblack pointer-events-none"
          aria-hidden
        />
        <img src={urlB} alt="" className={`${commonImg} z-[2] tp-b-fadeblack`} draggable={false} />
      </>
    )
  }

  if (xfade === 'fadewhite') {
    return (
      <>
        <img src={urlA} alt="" className={`${commonImg} tp-a-fadewhite`} draggable={false} />
        <div
          className="absolute inset-0 z-[1] bg-white tp-mid-fadewhite pointer-events-none"
          aria-hidden
        />
        <img src={urlB} alt="" className={`${commonImg} z-[2] tp-b-fadewhite`} draggable={false} />
      </>
    )
  }

  if (xfade === 'revealleft' || xfade === 'revealright') {
    return (
      <>
        <img src={urlB} alt="" className={commonImg} draggable={false} />
        <img
          src={urlA}
          alt=""
          className={`${commonImg} z-[1] ${xfade === 'revealleft' ? 'tp-a-revealleft' : 'tp-a-revealright'}`}
          draggable={false}
        />
      </>
    )
  }

  const bClass = `tp-b-${xfade}`
  return (
    <>
      <img src={urlA} alt="" className={commonImg} draggable={false} />
      <img src={urlB} alt="" className={`${commonImg} z-[1] ${bClass}`} draggable={false} />
    </>
  )
}

export type TransitionPickerGridProps = {
  selectedId: TransitionType
  onSelect: (id: TransitionType) => void
}

export default function TransitionPickerGrid({ selectedId, onSelect }: TransitionPickerGridProps) {
  const byCategory = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, TransitionCatalogEntry[]>()
    for (const row of TRANSITION_CATALOG) {
      if (!map.has(row.category)) {
        order.push(row.category)
        map.set(row.category, [])
      }
      map.get(row.category)!.push(row)
    }
    return order.map((category) => ({ category, items: map.get(category)! }))
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-snug text-[var(--color-text-muted)]">
        Hover a preset to preview with demo photos (Picsum). Export uses FFmpeg xfade; the hosted player
        blends with a short fade for non-cut transitions.
      </p>
      {byCategory.map(({ category, items }) => (
        <div key={category}>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#8b8b99]">
            {category}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {items.map((t) => {
              const { a, b } = picsumPair(t.id)
              const selected = selectedId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className={`tp-card group text-left rounded-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] ${
                    selected ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-panel)]' : ''
                  }`}
                  aria-pressed={selected}
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#0d0d0f] shadow-inner ring-1 ring-white/10">
                    <TransitionThumb transition={t} urlA={a} urlB={b} />
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
    </div>
  )
}

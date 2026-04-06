'use client'

import { ToggleLeft, ToggleRight } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { MEDIA_PROVIDERS, MEDIA_API_KEYS } from '@/lib/media/provider-registry'
import { SectionLabel, ListContainer, KeyInputRow } from './shared'

const CATEGORY_LABELS: Record<string, string> = {
  video: 'Video',
  image: 'Image',
  avatar: 'Avatar',
  utility: 'Utility',
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    video: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    image: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    avatar: 'text-green-400 bg-green-400/10 border-green-400/30',
    utility: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  }
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors[category] || ''} uppercase tracking-tighter`}
    >
      {CATEGORY_LABELS[category] || category}
    </span>
  )
}

export function MediaGenSettingsTab() {
  const { mediaGenEnabled, toggleMediaGen } = useVideoStore()

  return (
    <div className="space-y-10">
      {/* Media Providers */}
      <div>
        <SectionLabel>Media Generation</SectionLabel>
        <ListContainer>
          {MEDIA_PROVIDERS.map((p) => {
            const isEnabled = mediaGenEnabled[p.id] ?? p.defaultEnabled
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-none">
                    {p.name}
                  </span>
                  <CategoryBadge category={p.category} />
                </div>
                <button
                  onClick={() => toggleMediaGen(p.id)}
                  className="no-style text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all"
                >
                  {isEnabled ? (
                    <ToggleRight size={22} className="text-[var(--color-accent)]" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                </button>
              </div>
            )
          })}
        </ListContainer>
      </div>

      {/* API Keys */}
      <div>
        <SectionLabel>API Keys</SectionLabel>
        <p className="text-[11px] text-[#6b6b7a] px-1 mb-2 -mt-1">
          Set in{' '}
          <code className="text-[10px] px-1 py-0.5 rounded bg-white/5 border border-[var(--color-border)]">.env</code>
        </p>
        <div className="grid grid-cols-1 gap-1">
          {MEDIA_API_KEYS.map((k) => (
            <KeyInputRow key={k.provider} provider={k.provider} label={k.label} envVar={k.envVar} />
          ))}
        </div>
      </div>
    </div>
  )
}

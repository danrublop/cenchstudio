'use client'

import { useVideoStore } from '@/lib/store'

export default function GeneralSettingsTab() {
  const { globalStyle, updateGlobalStyle } = useVideoStore()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">General Settings</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Default project and editor preferences
        </p>
      </div>

      <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)] overflow-hidden">
        {/* Default scene duration */}
        <div className="px-4 py-3 bg-[var(--color-panel)]">
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Default Scene Duration
          </label>
          <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
            Duration applied to new scenes (seconds)
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={30}
              step={1}
              value={globalStyle.duration}
              onChange={(e) => updateGlobalStyle({ duration: parseInt(e.target.value) })}
              className="flex-1 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-mono text-[var(--color-text-primary)] w-8 text-right">
              {globalStyle.duration}s
            </span>
          </div>
        </div>

        {/* Theme */}
        <div className="px-4 py-3 bg-[var(--color-panel)]">
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Editor Theme
          </label>
          <div className="flex gap-2 mt-2">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateGlobalStyle({ theme: t })}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors capitalize ${
                  globalStyle.theme === t
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

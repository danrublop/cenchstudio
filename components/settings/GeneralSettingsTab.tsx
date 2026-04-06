'use client'

import { useVideoStore } from '@/lib/store'
import FontPicker from '@/components/FontPicker'

interface GeneralSettingsTabProps {
  /** When true, omit the page title (e.g. inside SettingsPanel → General). */
  embedded?: boolean
}

export default function GeneralSettingsTab({ embedded }: GeneralSettingsTabProps) {
  const { globalStyle, updateGlobalStyle } = useVideoStore()

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">General Settings</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Default project and editor preferences</p>
        </div>
      )}

      <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)] overflow-hidden">
        {/* Default scene duration */}
        <div className="px-4 py-3 bg-[var(--color-panel)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Default Scene Duration
          </label>
          <p className="text-[12px] text-[var(--color-text-muted)] mb-2">Duration applied to new scenes (seconds)</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={30}
              step={1}
              value={globalStyle.duration ?? 8}
              onChange={(e) => updateGlobalStyle({ duration: parseInt(e.target.value) })}
              className="flex-1 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-mono text-[var(--color-text-primary)] w-8 text-right">
              {globalStyle.duration ?? 8}s
            </span>
          </div>
        </div>

        {/* UI typography */}
        <div className="px-4 py-3 bg-[var(--color-panel)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">UI typography</label>
          <p className="text-[12px] text-[var(--color-text-muted)] mb-2">
            Font for the header, panels, timeline, and settings. Does not change text inside generated scenes.
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {(['system', 'app', 'custom'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => updateGlobalStyle({ uiTypography: key })}
                className={`flex-1 min-w-[5.5rem] py-1.5 text-sm rounded border transition-colors ${
                  (globalStyle.uiTypography ?? 'app') === key
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                {key === 'system' ? 'System' : key === 'app' ? 'App (Geist)' : 'Custom'}
              </button>
            ))}
          </div>
          {(globalStyle.uiTypography ?? 'app') === 'custom' && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <FontPicker
                hidePresetOption
                hideOverrideHint
                value={globalStyle.uiFontFamily ?? 'Inter'}
                presetFont="Inter"
                onChange={(family) =>
                  updateGlobalStyle({
                    uiTypography: 'custom',
                    uiFontFamily: family ?? 'Inter',
                  })
                }
              />
            </div>
          )}
        </div>

        {/* UI Text Size */}
        <div className="px-4 py-3 bg-[var(--color-panel)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Text Size</label>
          <p className="text-[12px] text-[var(--color-text-muted)] mb-2">Scale all UI text across the editor</p>
          <div className="flex gap-2 mt-2">
            {([
              [0, 'Compact'],
              [1, 'Default'],
              [2, 'Large'],
              [3, 'Extra Large'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => updateGlobalStyle({ uiTextSize: val })}
                className={`flex-1 py-1.5 text-sm rounded border transition-colors ${
                  (globalStyle.uiTextSize ?? 1) === val
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="px-4 py-3 bg-[var(--color-panel)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Editor Theme</label>
          <div className="flex gap-2 mt-2">
            {(['dark', 'light', 'blue'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateGlobalStyle({ theme: t })}
                className={`flex-1 py-1.5 text-sm rounded border transition-colors capitalize ${
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

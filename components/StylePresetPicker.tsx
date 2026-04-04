'use client'

import { STYLE_PRESETS, type StylePresetId } from '@/lib/styles/presets'

interface Props {
  currentPresetId: StylePresetId | null
  onChange: (id: StylePresetId | null) => void
}

export default function StylePresetPicker({ currentPresetId, onChange }: Props) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: '#6b6b7a',
          fontFamily: 'DM Mono, monospace',
          marginBottom: 4,
        }}
      >
        Style starting point
      </div>
      <div
        style={{
          fontSize: 9,
          color: '#55555f',
          fontFamily: 'DM Mono, monospace',
          marginBottom: 8,
        }}
      >
        Agent may override per scene
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
        }}
      >
        {/* None / Custom tile */}
        <span
          onClick={() => onChange(null)}
          title="No preset — agent has full style autonomy"
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: currentPresetId === null ? '2px solid #e84545' : '2px dashed #3a3a42',
            background: '#1a1a1f',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            transition: 'border-color 0.15s',
          }}
        >
          <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
            {['#374151', '#6b7280', '#9ca3af', '#d1d5db'].map((color, i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#9ca3af',
              lineHeight: 1,
            }}
          >
            🎨 None / Custom
          </div>
          <div
            style={{
              fontSize: 9,
              color: '#9ca3af',
              opacity: 0.6,
              fontFamily: 'DM Mono, monospace',
            }}
          >
            Full agent autonomy
          </div>
        </span>

        {Object.values(STYLE_PRESETS).map((preset) => (
          <span
            key={preset.id}
            onClick={() => onChange(preset.id)}
            title={preset.description}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: currentPresetId === preset.id ? '2px solid #e84545' : '2px solid #2a2a32',
              background: preset.bgColor,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              transition: 'border-color 0.15s',
            }}
          >
            {/* Mini palette strip */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
              {preset.palette.map((color, i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: color,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: preset.strokeColorOverride ?? preset.palette[0],
                fontFamily:
                  preset.font === 'Caveat'
                    ? 'Caveat, cursive'
                    : preset.font === 'DM Mono' || preset.font === 'Space Mono'
                      ? `${preset.font}, monospace`
                      : preset.font === 'Nunito'
                        ? 'Nunito, sans-serif'
                        : 'Georgia, serif',
                lineHeight: 1,
              }}
            >
              {preset.emoji} {preset.name}
            </div>

            <div
              style={{
                fontSize: 9,
                color: preset.strokeColorOverride ?? preset.palette[0],
                opacity: 0.6,
                fontFamily: 'DM Mono, monospace',
              }}
            >
              {preset.description.split('.')[0]}
            </div>
          </span>
        ))}
      </div>

      {/* Show what the preset does */}
      <div
        style={{
          marginTop: 10,
          padding: '8px 10px',
          background: '#1a1a1f',
          borderRadius: 6,
          fontSize: 10,
          color: '#6b6b7a',
          fontFamily: 'DM Mono, monospace',
          lineHeight: 1.6,
        }}
      >
        {currentPresetId && STYLE_PRESETS[currentPresetId] ? (
          (() => {
            const p = STYLE_PRESETS[currentPresetId]
            return (
              <>
                <div>Renderer: {p.preferredRenderer}</div>
                <div>Roughness: {p.roughnessLevel} / 3</div>
                <div>Tool: {p.defaultTool}</div>
                <div>
                  Texture: {p.textureStyle}
                  {p.textureStyle !== 'none' ? ` (${Math.round(p.textureIntensity * 100)}%)` : ''}
                </div>
              </>
            )
          })()
        ) : (
          <div>No preset active. Agent has full style autonomy.</div>
        )}
      </div>
    </div>
  )
}

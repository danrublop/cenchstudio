'use client'

import { useCallback } from 'react'
import { Mic } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { AvatarLayer, AvatarMood, AvatarPosition, AvatarView, NarrationScript, PipShape, Scene } from '@/lib/types'
import { defaultNarrationScript } from '@/lib/avatar-layer-sync'
import {
  isTalkingHeadModelId,
  resolveTalkingHeadModelIdFromLayer,
  TALKING_HEAD_AVATAR_MODELS,
  type TalkingHeadAvatarModelId,
} from '@/lib/avatars/talkinghead-models'
import type { LayersTabSectionId } from '@/lib/layers-tab-header'

const PLACEMENTS: AvatarPosition[] = [
  'pip_bottom_right',
  'pip_bottom_left',
  'pip_top_right',
  'fullscreen',
  'fullscreen_left',
  'fullscreen_right',
]
const MOODS: AvatarMood[] = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise']
const VIEWS: AvatarView[] = ['full', 'mid', 'upper', 'head']
const SHAPES: PipShape[] = ['circle', 'rounded', 'square']
const ENTRANCE: NonNullable<NarrationScript['entranceAnimation']>[] = ['fade', 'scale-in', 'slide-up']
const EXIT: NonNullable<NarrationScript['exitAnimation']>[] = ['fade', 'scale-out', 'slide-down']

const TALKING_HEAD_MODELS_LOCAL = TALKING_HEAD_AVATAR_MODELS.filter((m) => m.path.startsWith('/'))
const TALKING_HEAD_MODELS_CDN = TALKING_HEAD_AVATAR_MODELS.filter((m) => !m.path.startsWith('/'))

function SubLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="no-style w-full rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors hover:bg-white/[0.04]"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
    >
      {label}
    </button>
  )
}

interface Props {
  scene: Scene
  layerId: string
  onCommit: () => void
  openLayersSection: (id: LayersTabSectionId) => void
}

export default function AvatarLayerPropertiesForm({ scene, layerId, onCommit, openLayersSection }: Props) {
  const { updateAILayer } = useVideoStore()
  const layer = (scene.aiLayers ?? []).find((l) => l.id === layerId) as AvatarLayer | undefined
  if (!layer || layer.type !== 'avatar') {
    return <p className="text-[11px] text-[var(--color-text-muted)]">Avatar layer not found.</p>
  }

  const asc = layer.avatarSceneConfig
  const ns = layer.narrationScript ?? asc?.narrationScript ?? defaultNarrationScript()
  const isTalkingHead = !!layer.talkingHeadUrl?.startsWith('talkinghead://')

  const patch = useCallback(
    (updates: Partial<AvatarLayer>) => {
      updateAILayer(scene.id, layerId, updates)
    },
    [scene.id, layerId, updateAILayer],
  )

  const patchNs = useCallback(
    (partial: Partial<NarrationScript>) => {
      const base = layer.narrationScript ?? defaultNarrationScript()
      patch({ narrationScript: { ...base, ...partial } })
    },
    [layer.narrationScript, patch],
  )

  const narrationText = layer.script?.trim() || ns.lines.map((l) => l.text).join(' ')

  const setNarrationText = (text: string) => {
    const t = text.trim() || '.'
    patch({
      script: text,
      narrationScript: {
        ...ns,
        lines: [{ text: t }],
      },
    })
  }

  return (
    <section className="space-y-4">
      <div
        className="flex items-start gap-2 rounded-lg border p-2.5"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-input-bg)' }}
      >
        <Mic size={14} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium text-[var(--color-text-primary)]">Play preview to speak</p>
          <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
            Press play in the preview. The avatar uses lip sync (cloud TTS if configured, otherwise browser speech).
            Pause resets speech so you can play again.
          </p>
        </div>
      </div>

      {isTalkingHead && (
        <>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)]">Narration</label>
            <textarea
              value={narrationText}
              onChange={(e) => setNarrationText(e.target.value)}
              onBlur={onCommit}
              rows={4}
              className="kbd w-full resize-y px-2 py-1.5 font-mono text-[11px] leading-relaxed"
              placeholder="What the avatar says…"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Character</label>
              <select
                value={ns.character ?? 'friendly'}
                onChange={(e) => patchNs({ character: e.target.value as NarrationScript['character'] })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="energetic">Energetic</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Placement</label>
              <select
                value={ns.position}
                onChange={(e) => patchNs({ position: e.target.value as AvatarPosition })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                {PLACEMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)]">3D presenter model</label>
            <select
              value={
                ns.avatarModelId && isTalkingHeadModelId(ns.avatarModelId)
                  ? ns.avatarModelId
                  : resolveTalkingHeadModelIdFromLayer(layer)
              }
              onChange={(e) => patchNs({ avatarModelId: e.target.value as TalkingHeadAvatarModelId })}
              onBlur={onCommit}
              className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
            >
              <optgroup label="Local (add GLB to public/avatars/)">
                {TALKING_HEAD_MODELS_LOCAL.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="TalkingHead samples (CDN, no install)">
                {TALKING_HEAD_MODELS_CDN.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">PIP size (px)</label>
              <input
                type="number"
                min={120}
                max={900}
                step={10}
                value={ns.pipSize ?? 280}
                onChange={(e) => patchNs({ pipSize: Math.max(80, parseInt(e.target.value, 10) || 280) })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">PIP shape</label>
              <select
                value={ns.pipShape ?? 'circle'}
                onChange={(e) => patchNs({ pipShape: e.target.value as PipShape })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                {SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)]">Avatar scale</label>
            <input
              type="number"
              min={0.5}
              max={2}
              step={0.05}
              value={ns.avatarScale ?? 1.15}
              onChange={(e) => patchNs({ avatarScale: Math.max(0.3, parseFloat(e.target.value) || 1.15) })}
              onBlur={onCommit}
              className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
            />
          </div>

          <div className="space-y-2 rounded-lg border p-2" style={{ borderColor: 'var(--color-border)' }}>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={ns.containerEnabled !== false}
                onChange={(e) => patchNs({ containerEnabled: e.target.checked })}
                onBlur={onCommit}
              />
              Glass container
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Backdrop blur (px)</label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={ns.containerBlur ?? 0}
                  onChange={(e) => patchNs({ containerBlur: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  onBlur={onCommit}
                  className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Card background</label>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(ns.background ?? '') ? (ns.background as string) : '#6366f1'}
                  onChange={(e) => patchNs({ background: e.target.value })}
                  onBlur={onCommit}
                  className="mt-0.5 h-8 w-full cursor-pointer rounded border bg-transparent"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Border color</label>
                <input
                  type="color"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(ns.containerBorderColor ?? '')
                      ? (ns.containerBorderColor as string)
                      : '#ffffff'
                  }
                  onChange={(e) => patchNs({ containerBorderColor: e.target.value })}
                  onBlur={onCommit}
                  className="mt-0.5 h-8 w-full cursor-pointer rounded border bg-transparent"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Border opacity</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ns.containerBorderOpacity ?? 0.3}
                  onChange={(e) =>
                    patchNs({ containerBorderOpacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })
                  }
                  onBlur={onCommit}
                  className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Border width (px)</label>
                <input
                  type="number"
                  min={0}
                  max={16}
                  value={ns.containerBorderWidth ?? 3}
                  onChange={(e) => patchNs({ containerBorderWidth: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  onBlur={onCommit}
                  className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Shadow opacity</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ns.containerShadowOpacity ?? 0.4}
                  onChange={(e) =>
                    patchNs({ containerShadowOpacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })
                  }
                  onBlur={onCommit}
                  className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Inner glow</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ns.containerInnerGlow ?? 0}
                  onChange={(e) =>
                    patchNs({ containerInnerGlow: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })
                  }
                  onBlur={onCommit}
                  className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)]">Fill opacity</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ns.containerBgOpacity ?? 1}
                  onChange={(e) =>
                    patchNs({ containerBgOpacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })
                  }
                  onBlur={onCommit}
                  className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Mood (when speaking)</label>
              <select
                value={ns.mood}
                onChange={(e) => patchNs({ mood: e.target.value as AvatarMood })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Camera view</label>
              <select
                value={ns.view}
                onChange={(e) => patchNs({ view: e.target.value as AvatarView })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                {VIEWS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)]">
              Eye contact ({ns.eyeContact?.toFixed(2) ?? '0.70'})
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ns.eyeContact ?? 0.7}
              onChange={(e) => patchNs({ eyeContact: parseFloat(e.target.value) })}
              onMouseUp={onCommit}
              onBlur={onCommit}
              className="mt-1 w-full"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={ns.lipsyncHeadMovement !== false}
              onChange={(e) => patchNs({ lipsyncHeadMovement: e.target.checked })}
              onBlur={onCommit}
            />
            Head motion during lip sync
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Entrance</label>
              <select
                value={ns.entranceAnimation ?? 'fade'}
                onChange={(e) => patchNs({ entranceAnimation: e.target.value as NarrationScript['entranceAnimation'] })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                {ENTRANCE.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Enter at (s)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={ns.enterAt ?? layer.startAt ?? 0}
                onChange={(e) => patchNs({ enterAt: Math.max(0, parseFloat(e.target.value) || 0) })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Exit</label>
              <select
                value={ns.exitAnimation ?? 'fade'}
                onChange={(e) => patchNs({ exitAnimation: e.target.value as NarrationScript['exitAnimation'] })}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                {EXIT.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Exit at (s)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={ns.exitAt != null ? String(ns.exitAt) : ''}
                onChange={(e) => {
                  const v = e.target.value
                  patchNs({ exitAt: v === '' ? undefined : Math.max(0, parseFloat(v) || 0) })
                }}
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
                placeholder="optional"
              />
            </div>
          </div>
        </>
      )}

      {!isTalkingHead && (
        <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
          This avatar uses a video file (e.g. HeyGen). Trim and opacity are below; replace the source from the Setup tab
          if needed.
        </p>
      )}

      {scene.sceneType === 'avatar_scene' && asc && (
        <div className="space-y-2 rounded-lg border p-2" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Full avatar scene layout
          </p>
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)]">Backdrop</label>
            <div className="mt-0.5 flex gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(asc.backdrop) ? asc.backdrop : '#0f172a'}
                onChange={(e) =>
                  patch({
                    avatarSceneConfig: { ...asc, backdrop: e.target.value },
                  })
                }
                onBlur={onCommit}
                className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <input
                type="text"
                value={asc.backdrop}
                onChange={(e) => patch({ avatarSceneConfig: { ...asc, backdrop: e.target.value } })}
                onBlur={onCommit}
                className="kbd min-w-0 flex-1 px-2 py-1 font-mono text-[11px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Presenter width (%)</label>
              <input
                type="number"
                min={20}
                max={70}
                value={asc.avatarSize}
                onChange={(e) =>
                  patch({
                    avatarSceneConfig: {
                      ...asc,
                      avatarSize: Math.max(15, Math.min(80, parseInt(e.target.value, 10) || 40)),
                    },
                  })
                }
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)]">Side</label>
              <select
                value={asc.avatarPosition}
                onChange={(e) =>
                  patch({
                    avatarSceneConfig: {
                      ...asc,
                      avatarPosition: e.target.value as 'left' | 'right' | 'center',
                    },
                  })
                }
                onBlur={onCommit}
                className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="center">Center</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)]">Opacity</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) => patch({ opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
            onBlur={onCommit}
            className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)]">z-index</label>
          <input
            type="number"
            step={1}
            value={layer.zIndex}
            onChange={(e) => patch({ zIndex: parseInt(e.target.value, 10) || 0 })}
            onBlur={onCommit}
            className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-[var(--color-text-muted)]">Start at (s)</label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={layer.startAt ?? 0}
          onChange={(e) => patch({ startAt: Math.max(0, parseFloat(e.target.value) || 0) })}
          onBlur={onCommit}
          className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
        />
      </div>

      <SubLink label="Setup tab — more layers & tools" onClick={() => openLayersSection('scene')} />
    </section>
  )
}

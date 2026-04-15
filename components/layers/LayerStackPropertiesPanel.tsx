'use client'

import { useCallback } from 'react'
import {
  AudioWaveform,
  BarChart3,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Sparkles,
  Type,
  User,
  Video,
} from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type { Scene } from '@/lib/types'
import { BG_STAGE_STACK_KEY, parseLayerStackKey } from '@/lib/layer-stack-keys'
import CanvasMotionTemplatesPanel from '@/components/CanvasMotionTemplatesPanel'
import { deriveChartLayersFromScene } from '@/lib/charts/extract'
import { chartLayerTitleLine, MAIN_SCENE_SVG_LAYER_ID } from '@/lib/text-slots'
import ChartLayerPropertiesForm from '@/components/layers/ChartLayerPropertiesForm'
import AvatarLayerPropertiesForm from '@/components/layers/AvatarLayerPropertiesForm'
import { InteractionFormBody } from '@/components/tabs/InteractTab'

const BG_ELIGIBLE = new Set(['motion', 'd3', 'svg', 'physics'])

interface Props {
  scene: Scene
}

function SubLink({ icon: Icon, label, onClick }: { icon: typeof Layers; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="no-style flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors hover:bg-white/[0.04]"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
    >
      <Icon size={12} className="shrink-0 text-[var(--color-text-muted)]" />
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  )
}

export default function LayerStackPropertiesPanel({ scene }: Props) {
  const {
    layerStackPropertiesKey,
    setLayerStackPropertiesKey,
    updateScene,
    saveSceneHTML,
    openLayersSection,
    openTextTabForSlot,
    openLayerStackProperties,
  } = useVideoStore()

  const commit = useCallback(() => {
    void saveSceneHTML(scene.id)
  }, [scene.id, saveSceneHTML])

  const key = layerStackPropertiesKey
  if (!key) {
    return (
      <div className="px-3 py-10 text-center">
        <Layers size={22} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-50" />
        <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
          Double-click a row in the layer stack to edit it here. Background, overlays, and scene types each have quick
          controls and shortcuts to related tabs.
        </p>
      </div>
    )
  }

  const { kind, id } = parseLayerStackKey(key)
  const title =
    kind === 'bg'
      ? 'Background'
      : kind === 'video'
        ? 'Video layer'
        : kind === 'audio'
          ? 'Audio'
          : kind === 'scene' && id
            ? ((
                {
                  canvas2d: 'Canvas 2D',
                  motion: 'Motion',
                  d3: 'D3',
                  three: 'Three.js',
                  lottie: 'Lottie',
                  zdog: 'Zdog',
                  avatar_scene: 'Avatar scene',
                  '3d_world': '3D world',
                  canvas_bg: 'Canvas background (behind scene)',
                } as Record<string, string>
              )[id] ?? id)
            : kind === 'ai' && id
              ? ((scene.aiLayers ?? []).find((l) => l.id === id)?.label ?? 'AI layer')
              : kind === 'physics' && id
                ? ((scene.physicsLayers ?? []).find((p) => p.id === id)?.name ?? 'Physics')
                : kind === 'chart' && id
                  ? (deriveChartLayersFromScene(scene).find((c) => c.id === id)?.name ?? 'Chart')
                  : kind === 'svg' && id
                    ? id === MAIN_SCENE_SVG_LAYER_ID
                      ? 'Scene SVG'
                      : 'SVG object'
                    : kind === 'text' && id
                      ? 'Text overlay'
                      : kind === 'interaction' && id
                        ? (() => {
                            const ix = (scene.interactions ?? []).find((x) => x.id === id)
                            return ix ? `Interaction · ${ix.type}` : 'Interaction'
                          })()
                        : 'Layer'

  return (
    <div className="space-y-4 px-3 py-3">
      <div className="border-b pb-2" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Layer properties
        </p>
        <p className="mt-0.5 text-[12px] font-medium text-[var(--color-text-primary)]">{title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)] opacity-80">{key}</p>
          <button
            type="button"
            className="kbd px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            onClick={() => setLayerStackPropertiesKey(null)}
          >
            Close
          </button>
        </div>
      </div>

      {kind === 'bg' && id === 'stage' && (
        <section className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--color-text-muted)]">Scene background color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(scene.bgColor) ? scene.bgColor : '#ffffff'}
                onChange={(e) => {
                  updateScene(scene.id, { bgColor: e.target.value })
                  commit()
                }}
                className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <input
                type="text"
                value={scene.bgColor}
                onChange={(e) => updateScene(scene.id, { bgColor: e.target.value })}
                onBlur={commit}
                className="kbd min-w-0 flex-1 px-2 py-1 font-mono text-[12px]"
                placeholder="#hex or css"
              />
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">
              Per-scene background. Combine with Style tab for palette, font, and texture on the page shell.
            </p>
          </div>

          {BG_ELIGIBLE.has(scene.sceneType ?? '') && (
            <div className="space-y-2 rounded-lg border p-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                <LayoutTemplate size={11} />
                Canvas motion background
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">
                Animated Canvas2D loop behind {scene.sceneType} content (full-frame{' '}
                <code className="text-[8px]">#c</code>
                ).
              </p>
              <CanvasMotionTemplatesPanel scene={scene} />
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-[var(--color-text-muted)]">Related</p>
            <div className="space-y-1">
              <SubLink
                icon={Film}
                label="Setup tab — name, duration, style & grid"
                onClick={() => openLayersSection('scene')}
              />
              <SubLink
                icon={Clapperboard}
                label="Transitions tab — cuts, wipes & camera"
                onClick={() => openLayersSection('transitions')}
              />
            </div>
          </div>
        </section>
      )}

      {kind === 'scene' && id && id !== 'canvas_bg' && (
        <section className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-[var(--color-text-muted)]">Duration (s)</label>
            <input
              type="number"
              min={1}
              max={600}
              step={0.5}
              value={scene.duration}
              onChange={(e) => updateScene(scene.id, { duration: Math.max(0.5, parseFloat(e.target.value) || 8) })}
              onBlur={commit}
              className="kbd w-full px-2 py-1 text-[12px]"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-[var(--color-text-muted)]">Related</p>
            <div className="space-y-1">
              <SubLink
                icon={Layers}
                label="Setup tab — physics, SVG & layers (charts → Charts tab)"
                onClick={() => openLayersSection('scene')}
              />
              <SubLink icon={Film} label="Setup tab — name, style & grid" onClick={() => openLayersSection('scene')} />
              <SubLink
                icon={Clapperboard}
                label="Transitions tab — cuts, wipes & camera"
                onClick={() => openLayersSection('transitions')}
              />
              {id === 'motion' || id === 'd3' || id === 'svg' ? (
                <SubLink
                  icon={Sparkles}
                  label="Elements tab — click-to-select in preview"
                  onClick={() => openLayersSection('elements')}
                />
              ) : null}
            </div>
          </div>
        </section>
      )}

      {kind === 'scene' && id === 'canvas_bg' && (
        <section className="space-y-3">
          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
            Procedural Canvas2D layer behind the main scene. Pick a template or clear from the library below.
          </p>
          <CanvasMotionTemplatesPanel scene={scene} />
          <button
            type="button"
            className="no-style w-full rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors hover:bg-white/[0.04]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}
            onClick={() => openLayerStackProperties(BG_STAGE_STACK_KEY)}
          >
            Scene background color & full library →
          </button>
        </section>
      )}

      {kind === 'ai' && id ? (
        (scene.aiLayers ?? []).find((l) => l.id === id)?.type === 'avatar' ? (
          <div className="space-y-3">
            <SubLink
              icon={User}
              label="Avatar tab — open full view"
              onClick={() => openLayersSection('avatar', { avatarLayerId: id })}
            />
            <AvatarLayerPropertiesForm
              scene={scene}
              layerId={id}
              onCommit={commit}
              openLayersSection={openLayersSection}
            />
          </div>
        ) : (
          <AILayerQuickProps scene={scene} layerId={id} onCommit={commit} openLayersSection={openLayersSection} />
        )
      ) : null}

      {kind === 'video' && (
        <section className="space-y-2">
          <SubLink
            icon={Video}
            label="Setup tab — video source, trim, opacity"
            onClick={() => openLayersSection('scene')}
          />
        </section>
      )}

      {kind === 'audio' && (
        <section className="space-y-2">
          <SubLink
            icon={AudioWaveform}
            label="Audio tab — narration, SFX, music"
            onClick={() => openLayersSection('audio')}
          />
        </section>
      )}

      {kind === 'physics' && id && (
        <section className="space-y-2">
          <SubLink icon={Layers} label="3D tab — physics layers & card" onClick={() => openLayersSection('three')} />
        </section>
      )}

      {kind === 'chart' && id && (
        <section className="space-y-3">
          <ChartLayerPropertiesForm scene={scene} chartId={id} />
          <div className="space-y-1">
            <SubLink
              icon={BarChart3}
              label="Charts tab — all charts & add/remove"
              onClick={() => openLayersSection('charts')}
            />
            {(() => {
              const layer = deriveChartLayersFromScene(scene).find((c) => c.id === id)
              if (!layer) return null
              return (
                <SubLink
                  icon={Type}
                  label={`Text tab — title · ${chartLayerTitleLine(layer).slice(0, 32)}${chartLayerTitleLine(layer).length > 32 ? '…' : ''}`}
                  onClick={() => openTextTabForSlot(`chart:${id}:title`)}
                />
              )
            })()}
          </div>
        </section>
      )}

      {kind === 'text' && id && (
        <section className="space-y-2">
          <SubLink icon={Type} label="Edit text in Text tab" onClick={() => openTextTabForSlot(`overlay:${id}`)} />
        </section>
      )}

      {kind === 'svg' && id && (
        <section className="space-y-2">
          <SubLink icon={ImageIcon} label="Setup tab — SVG & objects" onClick={() => openLayersSection('scene')} />
          <SubLink icon={Type} label="Text tab — SVG text slots" onClick={() => openLayersSection('text')} />
        </section>
      )}

      {kind === 'interaction' &&
        id &&
        (() => {
          const el = (scene.interactions ?? []).find((x) => x.id === id)
          if (!el) {
            return (
              <p className="text-[11px] text-[var(--color-text-muted)]">
                This interaction was removed. Close and pick another layer.
              </p>
            )
          }
          return (
            <section className="space-y-3">
              <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                Change type, position, timing, branching, and glass style. Edit all visible copy from the layer stack ▸{' '}
                <strong>Text & labels</strong>, or below (same fields).
              </p>
              <InteractionFormBody scene={scene} el={el} showTypeSwitcher />
            </section>
          )
        })()}
    </div>
  )
}

function AILayerQuickProps({
  scene,
  layerId,
  onCommit,
  openLayersSection,
}: {
  scene: Scene
  layerId: string
  onCommit: () => void
  openLayersSection: (
    id: import('@/lib/layers-tab-header').LayersTabSectionId,
    opts?: { avatarLayerId?: string },
  ) => void
}) {
  const { updateAILayer } = useVideoStore()
  const layer = (scene.aiLayers ?? []).find((l) => l.id === layerId)
  if (!layer) {
    return <p className="text-[11px] text-[var(--color-text-muted)]">Layer not found.</p>
  }
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)]">Opacity</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) =>
              updateAILayer(scene.id, layerId, { opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })
            }
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
            onChange={(e) => updateAILayer(scene.id, layerId, { zIndex: parseInt(e.target.value, 10) || 0 })}
            onBlur={onCommit}
            className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
          />
        </div>
      </div>
      {'startAt' in layer && (
        <div>
          <label className="text-[10px] text-[var(--color-text-muted)]">Start at (s)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={(layer as { startAt?: number }).startAt ?? 0}
            onChange={(e) =>
              updateAILayer(scene.id, layerId, { startAt: Math.max(0, parseFloat(e.target.value) || 0) } as any)
            }
            onBlur={onCommit}
            className="kbd mt-0.5 w-full px-1.5 py-1 text-[11px]"
          />
        </div>
      )}
      <SubLink icon={Sparkles} label="Setup tab — AI layer settings" onClick={() => openLayersSection('scene')} />
    </section>
  )
}

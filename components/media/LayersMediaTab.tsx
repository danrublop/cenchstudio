'use client'

// Media sub-tab inside LayersTab. Scene-scoped — every generation or library
// pick lands as an ImageLayer on the current scene. Sits next to Transitions /
// Avatar / Effects etc. Top-level Media tab (GalleryPanel) is the free-browse
// surface; this panel is the "make or pick something for THIS scene" surface.

import { useState } from 'react'
import { Sparkles, ImageUp, Loader2, Plus, X } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { useConfiguredProviders } from '@/lib/hooks/useConfiguredProviders'
import { listCandidatesForIntent } from '@/lib/media/router'
import { ALL_ENHANCE_TAGS, QUICK_PROMPTS } from '@/lib/media/prompt-enhancer'
import { resolveProjectDimensions } from '@/lib/dimensions'
import type { ImageModel, ProjectAsset, Scene } from '@/lib/types'

const ASPECT_RATIOS: { id: string; label: string }[] = [
  { id: '1:1', label: '1:1' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '4:3', label: '4:3' },
  { id: '3:4', label: '3:4' },
]

interface Props {
  scene: Scene
}

export default function LayersMediaTab({ scene }: Props) {
  const { project, projectAssets, addProjectAsset, updateScene, saveSceneHTML, mediaGenEnabled } = useVideoStore()
  const configured = useConfiguredProviders()

  // Generate form state — local to this panel. We don't persist it to the
  // store because the user typically finishes in one pass; losing draft state
  // when switching scenes is actually the desired behavior (the form should
  // reflect the currently-selected scene).
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ImageModel>('flux-schnell')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [showTags, setShowTags] = useState(false)
  const [referenceAssetId, setReferenceAssetId] = useState<string | null>(null)
  const [showRefPicker, setShowRefPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoPlace, setAutoPlace] = useState(true)

  const availableCandidates = (() => {
    const intent = referenceAssetId ? 'i2i' : 't2i'
    const raw = listCandidatesForIntent(intent as 't2i' | 'i2i')
    return raw.filter((c) => {
      if (!c.ready) return false
      if (!configured.loaded) return true
      if (!configured.media.has(c.providerId)) return false
      if (mediaGenEnabled?.[c.providerId] === false) return false
      return true
    })
  })()

  const referenceAsset = referenceAssetId ? (projectAssets.find((a) => a.id === referenceAssetId) ?? null) : null
  const imageAssetsForRef = projectAssets.filter((a) => a.type === 'image' || a.type === 'svg')

  const placeAssetOnScene = (asset: ProjectAsset) => {
    const dims = resolveProjectDimensions(project.mp4Settings?.aspectRatio, project.mp4Settings?.resolution)
    const newLayer = {
      id: `asset-${asset.id}-${Date.now()}`,
      type: 'image' as const,
      prompt: asset.prompt ?? '',
      model: (asset.model as ImageModel) ?? 'flux-schnell',
      style: null,
      imageUrl: asset.publicUrl,
      x: Math.round(dims.width / 2),
      y: Math.round(dims.height / 2),
      width: asset.width ? Math.min(asset.width, dims.width) : Math.round(dims.width * 0.6),
      height: asset.height ? Math.min(asset.height, dims.height) : Math.round(dims.height * 0.6),
      rotation: 0,
      opacity: 1,
      zIndex: 10,
      status: 'ready' as const,
      label: asset.name,
    }
    updateScene(scene.id, { aiLayers: [...(scene.aiLayers || []), newLayer] })
    saveSceneHTML(scene.id)
  }

  const handleGenerate = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Enter a prompt')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/assets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          model,
          aspectRatio,
          enhanceTags: Array.from(selectedTags),
          referenceAssetId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Generation failed (${res.status})`)
      }
      const { asset } = await res.json()
      addProjectAsset(asset)
      if (autoPlace) placeAssetOnScene(asset)
      setPrompt('')
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed')
    } finally {
      setBusy(false)
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      {/* ── Generate form ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={12} className="text-[var(--color-accent)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            Generate for this scene
          </span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image…"
          rows={2}
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] resize-none"
        />
        <div className="flex flex-wrap gap-1 mt-1.5">
          {QUICK_PROMPTS.slice(0, 4).map((q) => (
            <span
              key={q.label}
              onClick={() => setPrompt(q.prompt)}
              className="cursor-pointer bg-[var(--color-border)] hover:bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded px-1.5 py-0.5 text-[10px]"
            >
              {q.label}
            </span>
          ))}
        </div>
      </div>

      <div className="px-3 pb-2 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ImageModel)}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[11px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
          >
            {availableCandidates.length === 0 ? (
              <option value="">No provider</option>
            ) : (
              availableCandidates.map((c) => (
                <option key={c.modelId} value={c.modelId}>
                  {c.name} · {c.modelId}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Aspect
          </label>
          <div className="flex gap-1">
            {ASPECT_RATIOS.map((ar) => (
              <span
                key={ar.id}
                onClick={() => setAspectRatio(ar.id)}
                className={`cursor-pointer rounded px-1.5 py-1 text-[10px] transition-colors ${
                  aspectRatio === ar.id
                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                    : 'bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {ar.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Reference picker */}
      <div className="px-3 pb-2">
        {referenceAsset ? (
          <div className="flex items-center gap-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-1.5">
            <img
              src={referenceAsset.thumbnailUrl ?? referenceAsset.publicUrl}
              alt={referenceAsset.name}
              className="w-10 h-10 object-cover rounded"
            />
            <span className="flex-1 text-[11px] text-[var(--color-text-primary)] truncate">
              Ref: {referenceAsset.name}
            </span>
            <span
              onClick={() => setReferenceAssetId(null)}
              className="cursor-pointer text-[var(--color-text-muted)] hover:text-red-400"
            >
              <X size={12} />
            </span>
          </div>
        ) : (
          <span
            onClick={() => setShowRefPicker((v) => !v)}
            className="cursor-pointer flex items-center gap-1.5 bg-[var(--color-bg)] border border-dashed border-[var(--color-border)] hover:border-[var(--color-text-muted)] rounded-md px-2 py-1 text-[11px] text-[var(--color-text-muted)]"
          >
            <ImageUp size={12} /> {showRefPicker ? 'Hide reference picker' : 'Add reference (i2i)'}
          </span>
        )}
        {showRefPicker && !referenceAsset && (
          <div className="mt-1 max-h-32 overflow-y-auto grid grid-cols-5 gap-1 border border-[var(--color-border)] rounded p-1 bg-[var(--color-bg)]">
            {imageAssetsForRef.length === 0 ? (
              <span className="col-span-5 text-[10px] text-[var(--color-text-muted)] text-center py-2">
                No image assets yet
              </span>
            ) : (
              imageAssetsForRef.slice(0, 20).map((a) => (
                <img
                  key={a.id}
                  src={a.thumbnailUrl ?? a.publicUrl}
                  alt={a.name}
                  title={a.name}
                  onClick={() => {
                    setReferenceAssetId(a.id)
                    setShowRefPicker(false)
                  }}
                  className="w-full aspect-square object-cover rounded cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)]"
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Enhance tags (collapsed by default) */}
      <div className="px-3 pb-2">
        <span
          onClick={() => setShowTags((v) => !v)}
          className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Enhance ({selectedTags.size}) {showTags ? '−' : '+'}
        </span>
        {showTags && (
          <div className="flex flex-wrap gap-1 mt-1">
            {ALL_ENHANCE_TAGS.map(({ category, tag }) => {
              const active = selectedTags.has(tag)
              return (
                <span
                  key={`${category}-${tag}`}
                  onClick={() => toggleTag(tag)}
                  className={`cursor-pointer rounded-full px-1.5 py-0.5 text-[9px] transition-colors ${
                    active
                      ? 'bg-[var(--color-accent)] text-black'
                      : 'bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="px-3 pb-3 space-y-1.5">
        {error && (
          <div className="px-2 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[11px]">
            {error}
          </div>
        )}
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoPlace}
            onChange={(e) => setAutoPlace(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Auto-place result on this scene
        </label>
        <button
          type="button"
          disabled={busy || availableCandidates.length === 0 || !prompt.trim()}
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-black font-semibold rounded-md py-1.5 text-[12px] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {busy ? 'Generating…' : 'Generate'}
        </button>
        {availableCandidates.length === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)]">
            No image provider enabled. Open Settings → Media to turn one on.
          </p>
        )}
      </div>

      {/* ── From library ── */}
      {imageAssetsForRef.length > 0 && (
        <div className="px-3 pt-2 pb-3 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              From library
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">{imageAssetsForRef.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {imageAssetsForRef.slice(0, 12).map((a) => (
              <div
                key={a.id}
                className="group relative rounded overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors cursor-pointer"
                onClick={() => placeAssetOnScene(a)}
                title={a.prompt ?? a.name}
              >
                <img src={a.thumbnailUrl ?? a.publicUrl} alt={a.name} className="w-full aspect-square object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Plus size={14} className="text-[var(--color-accent)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

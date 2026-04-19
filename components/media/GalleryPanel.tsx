'use client'

import { useState, useRef, useCallback } from 'react'
import { useVideoStore } from '@/lib/store'
import { resolveProjectDimensions } from '@/lib/dimensions'
import type { ProjectAsset, AssetType, AssetSource } from '@/lib/types'
import {
  Upload,
  Image as ImageIcon,
  Film,
  FileCode,
  Trash2,
  X,
  Tag,
  Pencil,
  Check,
  Plus,
  ChevronDown,
  Box,
  Sparkles,
  RotateCcw,
} from 'lucide-react'

const SUGGESTED_TAGS = ['logo', 'watermark', 'brand', 'background', 'broll']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AssetTypeIcon({ type }: { type: AssetType }) {
  switch (type) {
    case 'image':
      return <ImageIcon size={12} />
    case 'video':
      return <Film size={12} />
    case 'svg':
      return <FileCode size={12} />
  }
}

function AssetTypeBadge({ type }: { type: AssetType }) {
  const colors: Record<AssetType, string> = {
    image: 'bg-blue-500/20 text-blue-400',
    video: 'bg-purple-500/20 text-purple-400',
    svg: 'bg-green-500/20 text-green-400',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${colors[type]}`}
    >
      <AssetTypeIcon type={type} />
      {type}
    </span>
  )
}

function SourceBadge({ source }: { source: AssetSource }) {
  if (source !== 'generated') return null
  return (
    <span className="inline-flex items-center gap-1 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
      <Sparkles size={10} />
      AI
    </span>
  )
}

interface AssetCardProps {
  asset: ProjectAsset
  onDelete: (id: string) => void
  onAddToTimeline: (asset: ProjectAsset) => void
  onExtrude3D?: (asset: ProjectAsset) => void
  onRegenerate?: (asset: ProjectAsset) => void
}

function AssetCard({ asset, onDelete, onAddToTimeline, onExtrude3D, onRegenerate }: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(asset.name)
  const [showTags, setShowTags] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const { updateProjectAsset, project } = useVideoStore()

  const saveName = async () => {
    if (editName.trim() && editName !== asset.name) {
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.projects : undefined
      if (ipc) {
        try {
          const { asset: updated } = await ipc.patchAsset({
            projectId: project.id,
            assetId: asset.id,
            name: editName.trim(),
          })
          updateProjectAsset(asset.id, updated as unknown as ProjectAsset)
        } catch {
          /* silent — matches HTTP fallback's res.ok gate */
        }
      } else {
        const res = await fetch(`/api/projects/${project.id}/assets/${asset.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim() }),
        })
        if (res.ok) {
          const { asset: updated } = await res.json()
          updateProjectAsset(asset.id, updated)
        }
      }
    }
    setIsEditing(false)
  }

  const patchTags = async (newTags: string[]) => {
    const ipc = typeof window !== 'undefined' ? window.cenchApi?.projects : undefined
    if (ipc) {
      try {
        const { asset: updated } = await ipc.patchAsset({
          projectId: project.id,
          assetId: asset.id,
          tags: newTags,
        })
        updateProjectAsset(asset.id, updated as unknown as ProjectAsset)
      } catch {
        /* silent — matches HTTP fallback's res.ok gate */
      }
    } else {
      const res = await fetch(`/api/projects/${project.id}/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })
      if (res.ok) {
        const { asset: updated } = await res.json()
        updateProjectAsset(asset.id, updated)
      }
    }
  }

  const addTag = async (tag: string) => {
    const t = tag.trim().toLowerCase()
    if (!t || asset.tags.includes(t)) return
    await patchTags([...asset.tags, t])
    setTagInput('')
  }

  const removeTag = async (tag: string) => {
    await patchTags(asset.tags.filter((t) => t !== tag))
  }

  const provenanceTooltip = asset.prompt
    ? `"${asset.prompt.slice(0, 120)}${asset.prompt.length > 120 ? '…' : ''}"${asset.provider ? ` — ${asset.provider}` : ''}${asset.model ? ` / ${asset.model}` : ''}`
    : undefined

  return (
    <div className="group border border-[var(--color-border)] rounded-md overflow-hidden bg-[var(--color-bg)] hover:border-[var(--color-text-muted)] transition-colors">
      <div className="relative aspect-video bg-black/20 flex items-center justify-center overflow-hidden">
        {asset.thumbnailUrl ? (
          asset.type === 'svg' ? (
            <img src={asset.thumbnailUrl} className="max-w-full max-h-full object-contain p-2" alt={asset.name} />
          ) : (
            <img src={asset.thumbnailUrl} className="w-full h-full object-cover" alt={asset.name} />
          )
        ) : (
          <AssetTypeIcon type={asset.type} />
        )}

        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span
            onClick={() => onAddToTimeline(asset)}
            className="kbd h-6 px-2 text-[11px] cursor-pointer"
            data-tooltip="Add to timeline"
            data-tooltip-pos="bottom"
          >
            <Plus size={11} /> Timeline
          </span>
          {asset.type === 'svg' && onExtrude3D && (
            <span
              onClick={() => onExtrude3D(asset)}
              className="kbd h-6 px-2 text-[11px] cursor-pointer text-[#56b6c2]"
              data-tooltip="Extrude to 3D"
              data-tooltip-pos="bottom"
            >
              <Box size={11} /> 3D
            </span>
          )}
          {asset.source === 'generated' && onRegenerate && (
            <span
              onClick={() => onRegenerate(asset)}
              className="kbd h-6 w-6 p-0 flex items-center justify-center cursor-pointer text-[var(--color-accent)]"
              data-tooltip="Regenerate"
              data-tooltip-pos="bottom"
            >
              <RotateCcw size={11} />
            </span>
          )}
          <span
            onClick={() => onDelete(asset.id)}
            className="kbd h-6 w-6 p-0 flex items-center justify-center cursor-pointer text-red-400"
            data-tooltip="Delete"
            data-tooltip-pos="bottom"
          >
            <Trash2 size={11} />
          </span>
        </div>

        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          <SourceBadge source={asset.source} />
          <AssetTypeBadge type={asset.type} />
        </div>

        {asset.type === 'video' && asset.durationSeconds != null && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-[11px] px-1.5 py-0.5 rounded text-white/80">
            {Math.floor(asset.durationSeconds / 60)}:{String(Math.floor(asset.durationSeconds % 60)).padStart(2, '0')}
          </div>
        )}

        {asset.extractedColors && asset.extractedColors.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex">
            {asset.extractedColors.slice(0, 6).map((c, i) => (
              <div key={i} className="flex-1 h-1.5" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>

      <div className="px-2 py-1.5 space-y-1">
        <div className="flex items-center gap-1">
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') setIsEditing(false)
                }}
                className="flex-1 bg-transparent border border-[var(--color-border)] rounded px-1 py-0.5 text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                autoFocus
              />
              <span onClick={saveName} className="cursor-pointer text-green-400 hover:text-green-300">
                <Check size={12} />
              </span>
              <span
                onClick={() => setIsEditing(false)}
                className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X size={12} />
              </span>
            </div>
          ) : (
            <>
              <span
                className="text-[12px] text-[var(--color-text-primary)] truncate flex-1 font-medium"
                title={provenanceTooltip}
              >
                {asset.name}
              </span>
              <span
                onClick={() => {
                  setEditName(asset.name)
                  setIsEditing(true)
                }}
                className="opacity-0 group-hover:opacity-100 cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <Pencil size={10} />
              </span>
            </>
          )}
        </div>

        <div className="text-[11px] text-[var(--color-text-muted)] flex gap-2">
          <span>{formatBytes(asset.sizeBytes)}</span>
          {asset.width && asset.height && (
            <span>
              {asset.width}x{asset.height}
            </span>
          )}
          {asset.costCents != null && asset.costCents > 0 && (
            <span className="text-[var(--color-accent)]">${(asset.costCents / 100).toFixed(2)}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {asset.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 bg-[var(--color-border)] text-[var(--color-text-muted)] rounded px-1.5 py-0 text-[10px]"
            >
              {tag}
              <span onClick={() => removeTag(tag)} className="cursor-pointer hover:text-red-400 ml-0.5">
                <X size={8} />
              </span>
            </span>
          ))}
          <span
            onClick={() => setShowTags(!showTags)}
            className="cursor-pointer inline-flex items-center gap-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[10px]"
          >
            <Tag size={8} /> <ChevronDown size={8} />
          </span>
        </div>

        {showTags && (
          <div className="space-y-1 pt-1 border-t border-[var(--color-border)]">
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTag(tagInput)
                }}
                placeholder="Add tag..."
                className="flex-1 bg-transparent border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[11px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_TAGS.filter((t) => !asset.tags.includes(t)).map((t) => (
                <span
                  key={t}
                  onClick={() => addTag(t)}
                  className="cursor-pointer bg-[var(--color-border)] hover:bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] rounded px-1.5 py-0 text-[10px]"
                >
                  + {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GalleryPanel() {
  const { project, projectAssets, assetsLoading, addProjectAsset, removeProjectAsset } = useVideoStore()
  const [uploading, setUploading] = useState<Record<string, number>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<AssetSource | 'all'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      const tempId = `uploading-${Date.now()}-${file.name}`
      setUploadError(null)
      setUploading((prev) => ({ ...prev, [tempId]: 0 }))

      try {
        const formData = new FormData()
        formData.append('file', file)

        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploading((prev) => ({ ...prev, [tempId]: Math.round((e.loaded / e.total) * 100) }))
          }
        })

        const result = await new Promise<any>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText))
            } else {
              try {
                reject(new Error(JSON.parse(xhr.responseText).error))
              } catch {
                reject(new Error(`Upload failed: ${xhr.status}`))
              }
            }
          }
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.open('POST', `/api/projects/${project.id}/assets`)
          xhr.send(formData)
        })

        addProjectAsset(result.asset)
      } catch (err: any) {
        setUploadError(err.message || 'Upload failed')
      } finally {
        setUploading((prev) => {
          const next = { ...prev }
          delete next[tempId]
          return next
        })
      }
    },
    [project.id, addProjectAsset],
  )

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach(uploadFile)
    },
    [uploadFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles],
  )

  const handleDelete = async (assetId: string) => {
    const ipc = typeof window !== 'undefined' ? window.cenchApi?.projects : undefined
    if (ipc) {
      try {
        await ipc.deleteAsset({ projectId: project.id, assetId })
        removeProjectAsset(assetId)
      } catch {
        /* leave asset in store on failure */
      }
    } else {
      const res = await fetch(`/api/projects/${project.id}/assets/${assetId}`, { method: 'DELETE' })
      if (res.ok) removeProjectAsset(assetId)
    }
  }

  const handleAddToTimeline = (asset: ProjectAsset) => {
    const store = useVideoStore.getState()
    const scene = store.scenes.find((s) => s.id === store.selectedSceneId)
    if (!scene) return

    const newLayer = {
      id: `asset-${asset.id}-${Date.now()}`,
      type: 'image' as const,
      prompt: asset.prompt ?? '',
      model: 'flux-schnell' as const,
      style: null,
      imageUrl: asset.publicUrl,
      x: 960,
      y: 540,
      width: asset.width
        ? Math.min(
            asset.width,
            resolveProjectDimensions(store.project.mp4Settings?.aspectRatio, store.project.mp4Settings?.resolution)
              .width,
          )
        : 800,
      height: asset.height
        ? Math.min(
            asset.height,
            resolveProjectDimensions(store.project.mp4Settings?.aspectRatio, store.project.mp4Settings?.resolution)
              .height,
          )
        : 600,
      rotation: 0,
      opacity: 1,
      zIndex: 10,
      status: 'ready' as const,
      label: asset.name,
    }

    store.updateScene(scene.id, { aiLayers: [...(scene.aiLayers || []), newLayer] })
    store.saveSceneHTML(scene.id)
  }

  const handleExtrude3D = (asset: ProjectAsset) => {
    // Keep the 3D extrusion flow exactly as it was — moved verbatim from the old MediaLibrary.
    const store = useVideoStore.getState()
    const sceneId = store.addScene(`3D: ${asset.name}`)
    const baseUrl = window.location.origin
    const svgUrl = `${baseUrl}${asset.publicUrl}`
    const sceneCode = buildExtrudeSceneCode(svgUrl)
    store.updateScene(sceneId, { sceneType: 'three', sceneCode, name: `3D: ${asset.name}` })
    store.selectScene(sceneId)
    store.saveSceneHTML(sceneId)
  }

  const handleRegenerate = async (asset: ProjectAsset) => {
    try {
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.projects : undefined
      if (ipc) {
        const { asset: newAsset } = await ipc.regenerateAsset({ projectId: project.id, assetId: asset.id })
        addProjectAsset(newAsset as unknown as ProjectAsset)
      } else {
        const res = await fetch(`/api/projects/${project.id}/assets/${asset.id}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setUploadError(err?.error ?? 'Regeneration failed')
          return
        }
        const { asset: newAsset } = await res.json()
        addProjectAsset(newAsset)
      }
    } catch (e: any) {
      setUploadError(e?.message ?? 'Regeneration failed')
    }
  }

  const filteredAssets = projectAssets.filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (sourceFilter !== 'all' && a.source !== sourceFilter) return false
    return true
  })

  const uploadingCount = Object.keys(uploading).length

  return (
    <div className="flex flex-col h-full">
      <div
        ref={dropRef}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mx-3 mt-3 mb-2 border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
        }`}
      >
        <Upload size={20} className="mx-auto mb-1 text-[var(--color-text-muted)]" />
        <p className="text-[12px] text-[var(--color-text-muted)]">Drop files here or click to upload</p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Images (10MB), Video (100MB), SVG</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {uploadingCount > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {Object.entries(uploading).map(([id, pct]) => (
            <div key={id} className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-[var(--color-text-muted)]">{pct}%</span>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <div className="mx-3 mb-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] flex items-center gap-2">
          <span className="flex-1">{uploadError}</span>
          <span onClick={() => setUploadError(null)} className="cursor-pointer">
            <X size={12} />
          </span>
        </div>
      )}

      {/* Two filter rows: type + source */}
      <div className="flex gap-1 px-3 pb-1 flex-wrap">
        {(['all', 'image', 'video', 'svg'] as const).map((t) => (
          <span
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`cursor-pointer px-2 py-0.5 rounded text-[11px] transition-colors ${
              typeFilter === t
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {t === 'all' ? 'All' : t.toUpperCase()}
            {t !== 'all' && ` (${projectAssets.filter((a) => a.type === t).length})`}
          </span>
        ))}
      </div>
      <div className="flex gap-1 px-3 pb-2 flex-wrap border-b border-[var(--color-border)]">
        {(['all', 'upload', 'generated'] as const).map((s) => (
          <span
            key={s}
            onClick={() => setSourceFilter(s)}
            className={`cursor-pointer px-2 py-0.5 rounded text-[11px] transition-colors ${
              sourceFilter === s
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {s === 'all' ? 'Any source' : s === 'upload' ? 'Uploads' : 'Generated'}
            {s !== 'all' && ` (${projectAssets.filter((a) => a.source === s).length})`}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {assetsLoading ? (
          <div className="text-[12px] text-[var(--color-text-muted)] text-center py-8 animate-pulse">Loading...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-[12px] text-[var(--color-text-muted)] text-center py-8">
            {projectAssets.length === 0
              ? 'No assets yet. Upload images, videos, or SVGs — or switch to Generate.'
              : 'No matching assets.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
                onAddToTimeline={handleAddToTimeline}
                onExtrude3D={handleExtrude3D}
                onRegenerate={handleRegenerate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Extrusion template kept out of the render path — it's a ~60-line string literal.
function buildExtrudeSceneCode(svgUrl: string): string {
  return `import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const { WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment } = window;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor(PALETTE[3] || '#1a1a2e');
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 0, 8);

window.THREE = THREE;
window.scene = scene;
window.camera = camera;
window.renderer = renderer;

setupEnvironment(scene, renderer);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-4, 3, -2);
scene.add(fill);
scene.add(Object.assign(new THREE.DirectionalLight(0xffffff, 0.6), {})).position.set(0, -2, -5);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: PALETTE[3] || '#1a1a2e', roughness: 0.3, metalness: 0.6 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3.5;
floor.receiveShadow = true;
scene.add(floor);

const pivot = new THREE.Group();
scene.add(pivot);

fetch('${svgUrl}').then(r => r.text()).then(text => {
  const inner = new THREE.Group();
  const data = new SVGLoader().parse(text);
  let i = 0;
  for (const path of data.paths) {
    const shapes = SVGLoader.createShapes(path);
    for (const shape of shapes) {
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 20, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.5,
        bevelSegments: 8, curveSegments: 24
      });
      const mat = new THREE.MeshPhysicalMaterial({
        color: PALETTE[i % PALETTE.length],
        metalness: 0.75, roughness: 0.15,
        clearcoat: 0.4, clearcoatRoughness: 0.1, envMapIntensity: 1.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      inner.add(mesh);
      i++;
    }
  }
  const box = new THREE.Box3().setFromObject(inner);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  inner.position.set(-center.x, -center.y, -center.z);
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = 4 / maxDim;
  pivot.scale.set(s, -s, s);
  pivot.add(inner);
});

window.__tl.to({}, {
  duration: DURATION,
  onUpdate() {
    const elapsed = window.__tl.time();
    pivot.rotation.y = elapsed * 0.3;
    renderer.render(scene, camera);
  }
}, 0);
`
}

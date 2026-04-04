'use client'

import { useState, useRef, useCallback } from 'react'
import { useVideoStore } from '@/lib/store'
import type { ProjectAsset, AssetType } from '@/lib/types'
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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${colors[type]}`}
    >
      <AssetTypeIcon type={type} />
      {type}
    </span>
  )
}

interface AssetCardProps {
  asset: ProjectAsset
  onDelete: (id: string) => void
  onAddToTimeline: (asset: ProjectAsset) => void
}

function AssetCard({ asset, onDelete, onAddToTimeline }: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(asset.name)
  const [showTags, setShowTags] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const { updateProjectAsset, project } = useVideoStore()

  const saveName = async () => {
    if (editName.trim() && editName !== asset.name) {
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
    setIsEditing(false)
  }

  const addTag = async (tag: string) => {
    const t = tag.trim().toLowerCase()
    if (!t || asset.tags.includes(t)) return
    const newTags = [...asset.tags, t]
    const res = await fetch(`/api/projects/${project.id}/assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    if (res.ok) {
      const { asset: updated } = await res.json()
      updateProjectAsset(asset.id, updated)
    }
    setTagInput('')
  }

  const removeTag = async (tag: string) => {
    const newTags = asset.tags.filter((t) => t !== tag)
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

  return (
    <div className="group border border-[var(--color-border)] rounded-md overflow-hidden bg-[var(--color-bg)] hover:border-[var(--color-text-muted)] transition-colors">
      {/* Thumbnail */}
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

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span
            onClick={() => onAddToTimeline(asset)}
            className="kbd h-6 px-2 text-[10px] cursor-pointer"
            data-tooltip="Add to timeline"
            data-tooltip-pos="bottom"
          >
            <Plus size={11} /> Timeline
          </span>
          <span
            onClick={() => onDelete(asset.id)}
            className="kbd h-6 w-6 p-0 flex items-center justify-center cursor-pointer text-red-400"
            data-tooltip="Delete"
            data-tooltip-pos="bottom"
          >
            <Trash2 size={11} />
          </span>
        </div>

        {/* Type badge */}
        <div className="absolute top-1.5 right-1.5">
          <AssetTypeBadge type={asset.type} />
        </div>

        {/* Duration for video */}
        {asset.type === 'video' && asset.durationSeconds != null && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-[10px] px-1.5 py-0.5 rounded text-white/80">
            {Math.floor(asset.durationSeconds / 60)}:{String(Math.floor(asset.durationSeconds % 60)).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2 py-1.5 space-y-1">
        {/* Name row */}
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
                className="flex-1 bg-transparent border border-[var(--color-border)] rounded px-1 py-0.5 text-[11px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
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
              <span className="text-[11px] text-[var(--color-text-primary)] truncate flex-1 font-medium">
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

        {/* Size + dimensions */}
        <div className="text-[10px] text-[var(--color-text-muted)] flex gap-2">
          <span>{formatBytes(asset.sizeBytes)}</span>
          {asset.width && asset.height && (
            <span>
              {asset.width}x{asset.height}
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {asset.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 bg-[var(--color-border)] text-[var(--color-text-muted)] rounded px-1.5 py-0 text-[9px]"
            >
              {tag}
              <span onClick={() => removeTag(tag)} className="cursor-pointer hover:text-red-400 ml-0.5">
                <X size={8} />
              </span>
            </span>
          ))}
          <span
            onClick={() => setShowTags(!showTags)}
            className="cursor-pointer inline-flex items-center gap-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[9px]"
          >
            <Tag size={8} /> <ChevronDown size={8} />
          </span>
        </div>

        {/* Tag input (expanded) */}
        {showTags && (
          <div className="space-y-1 pt-1 border-t border-[var(--color-border)]">
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addTag(tagInput)
                  }
                }}
                placeholder="Add tag..."
                className="flex-1 bg-transparent border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_TAGS.filter((t) => !asset.tags.includes(t)).map((t) => (
                <span
                  key={t}
                  onClick={() => addTag(t)}
                  className="cursor-pointer bg-[var(--color-border)] hover:bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] rounded px-1.5 py-0 text-[9px]"
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

export default function MediaLibrary() {
  const { project, projectAssets, assetsLoading, addProjectAsset, removeProjectAsset } = useVideoStore()
  const [uploading, setUploading] = useState<Record<string, number>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all')
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
    const res = await fetch(`/api/projects/${project.id}/assets/${assetId}`, { method: 'DELETE' })
    if (res.ok) {
      removeProjectAsset(assetId)
    }
  }

  const handleAddToTimeline = (asset: ProjectAsset) => {
    const store = useVideoStore.getState()
    const scene = store.scenes.find((s) => s.id === store.selectedSceneId)
    if (!scene) return

    // Add as an AI image layer on the selected scene
    const newLayer = {
      id: `asset-${asset.id}-${Date.now()}`,
      type: 'image' as const,
      prompt: '',
      model: 'flux-schnell' as const,
      style: null,
      imageUrl: asset.publicUrl,
      x: 960,
      y: 540,
      width: asset.width ? Math.min(asset.width, 1920) : 800,
      height: asset.height ? Math.min(asset.height, 1080) : 600,
      rotation: 0,
      opacity: 1,
      zIndex: 10,
      status: 'ready' as const,
      label: asset.name,
    }

    store.updateScene(scene.id, {
      aiLayers: [...(scene.aiLayers || []), newLayer],
    })
    store.saveSceneHTML(scene.id)
  }

  const filteredAssets = typeFilter === 'all' ? projectAssets : projectAssets.filter((a) => a.type === typeFilter)

  const uploadingCount = Object.keys(uploading).length

  return (
    <div className="flex flex-col h-full">
      {/* Upload zone */}
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
        <p className="text-[11px] text-[var(--color-text-muted)]">Drop files here or click to upload</p>
        <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">Images (10MB), Video (100MB), SVG</p>
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

      {/* Upload progress */}
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
              <span className="text-[10px] text-[var(--color-text-muted)]">{pct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div className="mx-3 mb-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] flex items-center gap-2">
          <span className="flex-1">{uploadError}</span>
          <span onClick={() => setUploadError(null)} className="cursor-pointer">
            <X size={12} />
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pb-2">
        {(['all', 'image', 'video', 'svg'] as const).map((t) => (
          <span
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`cursor-pointer px-2 py-0.5 rounded text-[10px] transition-colors ${
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

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {assetsLoading ? (
          <div className="text-[11px] text-[var(--color-text-muted)] text-center py-8 animate-pulse">Loading...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-[11px] text-[var(--color-text-muted)] text-center py-8">
            {projectAssets.length === 0 ? 'No assets yet. Upload images, videos, or SVGs.' : 'No matching assets.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} onAddToTimeline={handleAddToTimeline} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

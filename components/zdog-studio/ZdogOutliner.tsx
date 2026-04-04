'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Box,
  Circle,
  Square,
  Hexagon,
  Dot,
  Layers,
  Database,
  Triangle,
  ChevronRight,
  FolderOpen,
  Save,
} from 'lucide-react'
import type { ZdogStudioShape, ZdogStudioShapeType, ZdogStudioAsset } from '@/lib/types/zdog-studio'
import { useZdogStudio, DEFAULT_PERSON_SHAPES } from './store'

function ShapeIcon({ type, size = 11 }: { type: ZdogStudioShapeType; size?: number }) {
  switch (type) {
    case 'Ellipse':
    case 'Hemisphere':
      return <Circle size={size} />
    case 'Rect':
    case 'RoundedRect':
      return <Square size={size} />
    case 'Polygon':
      return <Hexagon size={size} />
    case 'Box':
      return <Box size={size} />
    case 'Cylinder':
      return <Database size={size} />
    case 'Cone':
      return <Triangle size={size} />
    case 'Anchor':
      return <Plus size={size} />
    case 'Group':
      return <Layers size={size} />
    default:
      return <Dot size={size} />
  }
}

interface ZdogOutlinerProps {
  projectId: string
}

export default function ZdogOutliner({ projectId }: ZdogOutlinerProps) {
  const scene = useZdogStudio((s) => s.scene)
  const activeTab = useZdogStudio((s) => s.activeTab)
  const assets = useZdogStudio((s) => s.assets)
  const assetName = useZdogStudio((s) => s.assetName)
  const saving = useZdogStudio((s) => s.saving)
  const { select, deleteShape, loadShapes, pushToHistory, setActiveTab, setAssets, setAssetName, setSaving } =
    useZdogStudio()

  // Load assets
  const loadAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/zdog-library`)
      if (res.ok) {
        const data = await res.json()
        setAssets(data.assets || [])
      }
    } catch {}
  }, [projectId, setAssets])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const saveToLibrary = useCallback(async () => {
    if (!assetName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/zdog-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: assetName.trim(), shapes: scene.shapes, assetType: 'studio', tags: [] }),
      })
      if (res.ok) {
        setAssetName('')
        loadAssets()
      }
    } catch {
    } finally {
      setSaving(false)
    }
  }, [assetName, scene.shapes, projectId, loadAssets, setSaving, setAssetName])

  const deleteAsset = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/projects/${projectId}/zdog-library`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        loadAssets()
      } catch {}
    },
    [projectId, loadAssets],
  )

  const rootShapes = useMemo(() => scene.shapes.filter((s) => !s.parentId), [scene.shapes])
  const getChildren = useCallback((pid: string) => scene.shapes.filter((s) => s.parentId === pid), [scene.shapes])

  function TreeItem({ shape, depth = 0 }: { shape: ZdogStudioShape; depth?: number }) {
    const children = getChildren(shape.id)
    const [expanded, setExpanded] = useState(true)
    const isSelected = scene.selectedId === shape.id

    return (
      <div>
        <div
          onClick={() => select(shape.id)}
          className={`flex items-center gap-1 py-[3px] px-1.5 cursor-pointer transition-colors group text-[10px] ${
            isSelected ? 'bg-blue-600/80 text-white' : 'hover:bg-[var(--color-bg-hover)]'
          }`}
          style={{ paddingLeft: `${6 + depth * 12}px` }}
        >
          {children.length > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
              className="w-2.5 flex-shrink-0 cursor-pointer"
            >
              <ChevronRight size={8} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </span>
          ) : (
            <span className="w-2.5 flex-shrink-0" />
          )}
          <span className="flex-shrink-0 opacity-50">
            <ShapeIcon type={shape.type} />
          </span>
          <span className="truncate flex-1">{shape.name}</span>
          <span
            onClick={(e) => {
              e.stopPropagation()
              deleteShape(shape.id)
            }}
            className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity flex-shrink-0 cursor-pointer"
          >
            <Trash2 size={8} />
          </span>
        </div>
        {expanded && children.map((c) => <TreeItem key={c.id} shape={c} depth={depth + 1} />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] flex-shrink-0">
        <span
          onClick={() => setActiveTab('outliner')}
          className={`flex-1 text-center py-1.5 text-[10px] font-medium cursor-pointer ${
            activeTab === 'outliner'
              ? 'text-[var(--color-text)] border-b-2 border-blue-500'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Outliner
        </span>
        <span
          onClick={() => setActiveTab('library')}
          className={`flex-1 text-center py-1.5 text-[10px] font-medium cursor-pointer ${
            activeTab === 'library'
              ? 'text-[var(--color-text)] border-b-2 border-teal-500'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Library
        </span>
      </div>

      {activeTab === 'outliner' ? (
        <>
          <div className="flex-1 overflow-y-auto py-0.5">
            {rootShapes.map((s) => (
              <TreeItem key={s.id} shape={s} />
            ))}
            {scene.shapes.length === 0 && (
              <div className="p-3 text-center text-[9px] text-[var(--color-text-muted)]">
                No shapes. Add from toolbar.
              </div>
            )}
          </div>
          {/* Save bar */}
          <div className="border-t border-[var(--color-border)] p-2 flex gap-1">
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="Save as..."
              className="flex-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] focus:border-teal-500 outline-none"
            />
            <span
              onClick={saveToLibrary}
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                assetName.trim() && !saving
                  ? 'bg-teal-600 hover:bg-teal-500 text-white'
                  : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] cursor-not-allowed'
              }`}
            >
              <Save size={10} /> {saving ? '...' : 'Save'}
            </span>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* Presets */}
          <div className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
            Presets
          </div>
          <span
            onClick={() => {
              loadShapes(DEFAULT_PERSON_SHAPES)
              setActiveTab('outliner')
            }}
            className="block text-[10px] px-2 py-1 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
          >
            Person Rig
          </span>
          <span
            onClick={() => {
              loadShapes([])
              setActiveTab('outliner')
            }}
            className="block text-[10px] px-2 py-1 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
          >
            Empty Scene
          </span>

          {assets.length > 0 && (
            <>
              <div className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-3 mb-1">
                Saved
              </div>
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-[var(--color-bg-primary)] rounded px-2 py-1 group flex items-center justify-between"
                >
                  <span
                    onClick={() => {
                      loadShapes(asset.shapes || [])
                      setActiveTab('outliner')
                    }}
                    className="text-[10px] cursor-pointer hover:text-teal-400 truncate flex-1"
                  >
                    {asset.name}
                  </span>
                  <span
                    onClick={() => deleteAsset(asset.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 cursor-pointer ml-1"
                  >
                    <Trash2 size={9} />
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

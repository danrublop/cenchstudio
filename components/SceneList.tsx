'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, PanelLeft, FolderOpen, Trash2, Check } from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import SceneCard from './SceneCard'

interface Props {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

function SortableSceneCard({ id, index }: { id: string; index: number }) {
  const { scenes, selectedSceneId } = useVideoStore()
  const scene = scenes.find((s) => s.id === id)!
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SceneCard
        scene={scene}
        index={index}
        isSelected={selectedSceneId === id}
        isDragging={isDragging}
      />
    </div>
  )
}

export function ProjectSwitcher({ isCollapsed }: { isCollapsed: boolean }) {
  const {
    project, projectList, isLoadingProjects,
    fetchProjectList, createNewProject, loadProject, deleteProjectFromDb,
  } = useVideoStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) fetchProjectList()
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-tooltip={!isOpen ? "Projects" : undefined}
        data-tooltip-pos={!isOpen ? (isCollapsed ? "right" : "bottom") : undefined}
        className="kbd w-7 h-7 p-0 flex items-center justify-center shrink-0"
      >
        <FolderOpen size={15} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[200] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl p-1.5 flex flex-col w-max min-w-[160px] max-w-[280px] max-h-[320px] overflow-y-auto gap-0.5 animate-in slide-in-from-top-1 duration-150"
        >
          {/* New project button */}
          <button
            onClick={async () => {
              await createNewProject()
              setIsOpen(false)
            }}
            className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer text-[var(--color-text-primary)] shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} className="opacity-70 flex-shrink-0 mr-3" />
            <span className="text-[14px] font-normal leading-none tracking-wide whitespace-nowrap">New Project</span>
          </button>

          {/* Project list */}
          {isLoadingProjects ? (
            <div className="px-3 py-3 text-[11px] text-[var(--color-text-secondary)] uppercase tracking-widest text-center">
              Loading...
            </div>
          ) : projectList.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-[var(--color-text-secondary)] uppercase tracking-widest text-center">
              No saved projects
            </div>
          ) : (
            projectList.map((p) => (
              <button
                key={p.id}
                onClick={async () => {
                  if (p.id !== project.id) await loadProject(p.id)
                  setIsOpen(false)
                }}
                className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer text-[var(--color-text-primary)] shrink-0"
              >
                <FolderOpen size={16} strokeWidth={1.5} className="opacity-70 flex-shrink-0 mr-3" />
                <span className="text-[14px] font-normal leading-none tracking-wide truncate flex-1 text-left">{p.name}</span>
                {p.id === project.id && (
                  <Check size={16} strokeWidth={1.5} className="ml-2 text-[var(--color-text-primary)] flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function SceneList({ isCollapsed, onToggleCollapse }: Props) {
  const { scenes, addScene, reorderScenes, selectedSceneId } = useVideoStore()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isFullyExpanded, setIsFullyExpanded] = useState(!isCollapsed)

  // Sync isFullyExpanded with isCollapsed with a delay for clean expansion
  useEffect(() => {
    if (isCollapsed) {
      setIsFullyExpanded(false)
    } else {
      const timer = setTimeout(() => setIsFullyExpanded(true), 200)
      return () => clearTimeout(timer)
    }
  }, [isCollapsed])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const fromIndex = scenes.findIndex((s) => s.id === active.id)
    const toIndex = scenes.findIndex((s) => s.id === over.id)
    reorderScenes(fromIndex, toIndex)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scenes - only show when fully expanded to avoid 'scaling-up' flicker during animation */}
      <div className={`flex-1 overflow-y-auto pt-1 ${isFullyExpanded ? 'block' : 'hidden'}`}>
        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#3a3a45] text-[11px] text-center px-4 uppercase font-bold tracking-widest">
            No scenes yet.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={scenes.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {scenes.map((scene, index) => (
                <SortableSceneCard key={scene.id} id={scene.id} index={index} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

    </div>
  )
}

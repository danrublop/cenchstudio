'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Film,
  Type,
  BarChart3,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
  Palette,
  Grid3X3,
  Volume2,
  X,
  Box,
  Eye,
  EyeOff,
  Sparkles,
  Camera,
  User,
  Clapperboard,
  Code2,
  SlidersHorizontal,
  Paintbrush,
  Boxes,
  Stamp,
} from 'lucide-react'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })
import { useVideoStore } from '@/lib/store'
import type {
  AILayer,
  AvatarLayer,
  Scene,
  InteractionElement,
  CameraMove,
  D3ChartLayer,
  D3ChartType,
  PhysicsLayer,
  PhysicsSimulationType,
} from '@/lib/types'
import TransitionPickerGrid from '@/components/transitions/TransitionPickerGrid'
import CameraEffectPickerGrid from '@/components/camera/CameraEffectPickerGrid'
import type { GridConfig } from '@/lib/grid'
import type { SceneStyleOverride, SceneStylePresetName } from '@/lib/types'
import { SCENE_STYLE_PRESETS, getScenePresetName } from '@/lib/styles/scene-presets'
import AudioTabPanel from '@/components/audio/AudioTabPanel'
import { createDefaultInteraction, TYPE_COLORS, TYPE_ICONS } from '@/components/tabs/InteractTab'
import StylePresetPicker from '@/components/StylePresetPicker'
import FontPicker from '@/components/FontPicker'
import BrandKitPanel from '@/components/brand/BrandKitPanel'
import { STYLE_PRESETS, type StylePresetId } from '@/lib/styles/presets'
import { ElementInspector } from '@/components/inspector/PropertyInspector'
import { highlightElementInIframe, patchElementInIframe, requestElementsFromIframe } from '@/lib/scene-patcher'
import { compileD3SceneFromLayers } from '@/lib/charts/compile'
import { compilePhysicsSceneFromLayers } from '@/lib/physics/compile'
import ZdogOutliner from '@/components/zdog-studio/ZdogOutliner'
import ColorSelect from '@/components/ui/ColorSelect'
import { ASPECT_RATIO_OPTIONS, resolveProjectDimensions, type AspectRatio } from '@/lib/dimensions'
import SceneLayersStackPanel from '@/components/layers/SceneLayersStackPanel'
import TextTab from '@/components/tabs/TextTab'
import AvatarLayerPropertiesForm from '@/components/layers/AvatarLayerPropertiesForm'
import type { LayersTabSectionId } from '@/lib/layers-tab-header'
import { CENCH_THREE_ENVIRONMENTS } from '@/lib/three-environments/registry'
import {
  parseAppliedThreeEnvironmentId,
  patchThreeEnvironmentInSceneCode,
} from '@/lib/three-environments/patch-scene-code-environment'
import { buildThreeEnvironmentShowcaseSceneCode } from '@/lib/threeEnvironmentShowcaseScenes'

const CAMERA_MOVE_TYPES: CameraMove['type'][] = [
  'presetReveal',
  'presetEmphasis',
  'presetCinematicPush',
  'presetRackTransition',
  'kenBurns',
  'dollyIn',
  'dollyOut',
  'pan',
  'rackFocus',
  'cut',
  'shake',
  'reset',
  'orbit',
  'dolly3D',
  'rackFocus3D',
]

const D3_CHART_TYPES: D3ChartType[] = [
  'bar',
  'horizontalBar',
  'stackedBar',
  'groupedBar',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'number',
  'gauge',
  'funnel',
  'plotly',
  'recharts',
]

const PHYSICS_SIM_TYPES: PhysicsSimulationType[] = [
  'pendulum',
  'double_pendulum',
  'projectile',
  'orbital',
  'wave_interference',
  'double_slit',
  'electric_field',
  'harmonic_oscillator',
]

const PHYSICS_PARAM_FIELDS: Record<
  PhysicsSimulationType,
  Array<{ key: string; label: string; min?: number; max?: number; step?: number }>
> = {
  pendulum: [
    { key: 'g', label: 'Gravity (g)', min: 0.1, max: 30, step: 0.1 },
    { key: 'length', label: 'Length', min: 0.1, max: 20, step: 0.1 },
    { key: 'angle', label: 'Angle (deg/rad)', min: -360, max: 360, step: 0.1 },
    { key: 'damping', label: 'Damping', min: 0, max: 20, step: 0.01 },
  ],
  double_pendulum: [
    { key: 'g', label: 'Gravity (g)', min: 0.1, max: 30, step: 0.1 },
    { key: 'L1', label: 'Length 1', min: 0.1, max: 20, step: 0.1 },
    { key: 'L2', label: 'Length 2', min: 0.1, max: 20, step: 0.1 },
    { key: 'm1', label: 'Mass 1', min: 0.05, max: 200, step: 0.05 },
    { key: 'm2', label: 'Mass 2', min: 0.05, max: 200, step: 0.05 },
    { key: 'theta1', label: 'Theta 1 (deg/rad)', min: -360, max: 360, step: 0.1 },
    { key: 'theta2', label: 'Theta 2 (deg/rad)', min: -360, max: 360, step: 0.1 },
  ],
  projectile: [
    { key: 'v0', label: 'Initial Speed', min: 0.1, max: 500, step: 0.1 },
    { key: 'angle', label: 'Launch Angle (deg/rad)', min: -360, max: 360, step: 0.1 },
    { key: 'g', label: 'Gravity (g)', min: 0.1, max: 30, step: 0.1 },
    { key: 'drag', label: 'Drag', min: 0, max: 2, step: 0.001 },
  ],
  orbital: [
    { key: 'G', label: 'G', min: 0.000001, max: 1000000, step: 0.001 },
    { key: 'm1', label: 'Mass 1', min: 0.001, max: 1000000, step: 0.1 },
    { key: 'm2', label: 'Mass 2', min: 0.001, max: 1000000, step: 0.1 },
    { key: 'eccentricity', label: 'Eccentricity', min: 0, max: 0.995, step: 0.001 },
    { key: 'semiMajorAxis', label: 'Semi-major Axis', min: 10, max: 3000, step: 1 },
  ],
  wave_interference: [
    { key: 'frequency', label: 'Frequency', min: 0.01, max: 100, step: 0.01 },
    { key: 'wavelength', label: 'Wavelength', min: 0.01, max: 5000, step: 0.01 },
    { key: 'source_separation', label: 'Source Separation', min: 1, max: 5000, step: 1 },
    { key: 'phase_diff', label: 'Phase Diff (deg/rad)', min: -360, max: 360, step: 0.1 },
  ],
  double_slit: [
    { key: 'wavelength', label: 'Wavelength', min: 0.0001, max: 1000, step: 0.0001 },
    { key: 'slit_separation', label: 'Slit Separation', min: 0.001, max: 10000, step: 0.001 },
    { key: 'slit_width', label: 'Slit Width', min: 0.001, max: 10000, step: 0.001 },
    { key: 'screen_distance', label: 'Screen Distance', min: 0.01, max: 100000, step: 0.01 },
  ],
  electric_field: [],
  harmonic_oscillator: [
    { key: 'mass', label: 'Mass', min: 0.001, max: 10000, step: 0.001 },
    { key: 'k', label: 'Spring k', min: 0.001, max: 100000, step: 0.01 },
    { key: 'damping', label: 'Damping', min: 0, max: 10000, step: 0.001 },
    { key: 'driving_frequency', label: 'Drive Freq', min: 0, max: 10000, step: 0.001 },
    { key: 'driving_amplitude', label: 'Drive Amp', min: 0, max: 100000, step: 0.01 },
    { key: 'x0', label: 'x0 (units or px-like)', min: -500, max: 500, step: 0.1 },
    { key: 'v0', label: 'v0 (units or px-like)', min: -500, max: 500, step: 0.1 },
  ],
}

function extractCameraMovesFromSceneCode(sceneCode: string): CameraMove[] {
  if (!sceneCode || !sceneCode.includes('CenchCamera.')) return []
  const moves: CameraMove[] = []
  const regex = /CenchCamera\.(\w+)\((\{[\s\S]*?\})\);/g
  for (const match of sceneCode.matchAll(regex)) {
    const type = match[1] as CameraMove['type']
    if (!CAMERA_MOVE_TYPES.includes(type)) continue
    let params: Record<string, unknown> = {}
    try {
      params = JSON.parse(match[2])
    } catch {
      params = {}
    }
    moves.push({ type, params })
  }
  return moves
}

function extractCameraMovesFromSceneHTML(sceneHTML: string): CameraMove[] {
  if (!sceneHTML || !sceneHTML.includes('CenchCamera.')) return []
  const moves: CameraMove[] = []
  const regex = /CenchCamera\.(\w+)\((\{[\s\S]*?\})\);/g
  for (const match of sceneHTML.matchAll(regex)) {
    const type = match[1] as CameraMove['type']
    if (!CAMERA_MOVE_TYPES.includes(type)) continue
    let params: Record<string, unknown> = {}
    try {
      params = JSON.parse(match[2])
    } catch {
      params = {}
    }
    moves.push({ type, params })
  }
  return moves
}

interface Props {
  scene: Scene
  /** Electron left rail: New Scene shortcut above setup (scene list lives in timeline / layer stack) */
  showScenesSection?: boolean
  isLeftCollapsed?: boolean
}

// Top-level group dropdown for the reorganized Controls tab
function SectionGroup({
  title,
  icon: Icon,
  color,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: any
  color: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[var(--color-border)]">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{ background: color + '18' }}
        >
          <Icon size={13} style={{ color }} />
        </div>
        <span
          className="text-[12px] font-semibold tracking-wide flex-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: color + '20', color }}
          >
            {count}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 shrink-0 text-[var(--color-text-muted)]${isOpen ? '' : ' -rotate-90'}`}
        />
      </div>
      {isOpen && (
        <div className="pb-1">
          {children}
        </div>
      )}
    </div>
  )
}

// Stable colors for section headers when active
const SECTION_COLORS: Record<string, string> = {
  'Scene Settings': '#e8a849',
  'Style': '#c678dd',
  'Scene Style': '#e06c75',
  'Grid & Snapping': '#61afef',
  'Transition to Next Scene': '#d19a66',
  'Camera Animation': '#56b6c2',
  'Physics': '#5ec4b6',
  'Charts': '#98c379',
  'SVG Layer': '#e5c07b',
  'Video Layer': '#61afef',
  'Audio Layer': '#c678dd',
  'SVG Objects': '#e8a849',
  'Text Overlays': '#e06c75',
  'Canvas motion templates': '#56b6c2',
  'AI Layers': '#be5046',
  'Zdog Studio': '#5ec4b6',
  'SFX Tracks': '#98c379',
  'Music Tracks': '#d19a66',
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  extraHeaderContent,
  badge,
  enabled,
  onEnabledChange,
  active,
}: {
  title: string
  icon: any
  children: React.ReactNode
  defaultOpen?: boolean
  extraHeaderContent?: React.ReactNode
  badge?: React.ReactNode
  enabled?: boolean
  onEnabledChange?: (val: boolean) => void
  /** When true, the section title is colored to indicate it has content in use */
  active?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Auto-expand when enabled transitions to true
  useEffect(() => {
    if (enabled) setIsOpen(true)
  }, [enabled])

  const isActive = active ?? enabled
  const activeColor = isActive ? (SECTION_COLORS[title] ?? '#e8a849') : undefined

  return (
    <section className="overflow-hidden transition-all duration-200">
      <div
        className="flex items-center gap-1.5 pl-1.5 pr-3 py-2 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronRight
          size={14}
          strokeWidth={2.5}
          className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`}
          style={{ color: activeColor ?? 'var(--color-text-muted)' }}
        />
        <span
          className="text-[11px] font-semibold uppercase tracking-widest truncate flex-1 transition-colors"
          style={{ color: activeColor ?? 'var(--color-text-muted)' }}
        >
          {title}
        </span>
        {isActive && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: activeColor }}
          />
        )}
        {onEnabledChange && (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <input
                type="checkbox"
                className="tgl"
                id={`toggle-${title.replace(/\s+/g, '-').toLowerCase()}`}
                checked={enabled}
                onChange={(e) => onEnabledChange(e.target.checked)}
              />
              <label className="tgl-btn" htmlFor={`toggle-${title.replace(/\s+/g, '-').toLowerCase()}`} />
            </div>
          </div>
        )}
        {isOpen && extraHeaderContent && (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            {extraHeaderContent}
          </div>
        )}
        {isOpen && badge}
      </div>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="pl-7 pr-3 pb-3 pt-1 space-y-4">{children}</div>
      </div>
    </section>
  )
}

async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload failed')
  const { url } = await res.json()
  return url
}

export default function LayersTab({
  scene,
  showScenesSection = false,
  isLeftCollapsed = false,
}: Props) {
  const {
    addScene,
    updateScene,
    saveSceneHTML,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    globalStyle,
    updateGlobalStyle,
    gridConfig,
    updateGridConfig,
    addInteraction,
    project,
    updateProject,
    inspectorSelectedElement,
    inspectorElements,
    selectInspectorElement,
    patchInspectorElement,
    clearInspector,
    selectedSceneId,
    layersTabSectionPending,
    clearLayersTabSectionPending,
    openLayersSection,
    addAILayer,
    removeAILayer,
  } = useVideoStore()

  const [isRecordingScreen, setIsRecordingScreen] = useState(false)
  const [recordingFps, setRecordingFps] = useState<number>(30)
  const [recordingResolution, setRecordingResolution] = useState<'source' | '720p' | '1080p' | '1440p' | '2160p'>(
    '1080p',
  )
  const [cameraParamsDraft, setCameraParamsDraft] = useState<Record<number, string>>({})
  const [chartDataDraft, setChartDataDraft] = useState<Record<string, string>>({})
  const [chartConfigDraft, setChartConfigDraft] = useState<Record<string, string>>({})
  const [physicsCardDrag, setPhysicsCardDrag] = useState<{
    idx: number
    mode: 'move' | 'resize'
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    startW: number
  } | null>(null)

  const zdogStudioMode = useVideoStore((s) => s.zdogStudioMode)
  const setZdogStudioMode = useVideoStore((s) => s.setZdogStudioMode)
  const [threeEnvPatchHint, setThreeEnvPatchHint] = useState<string | null>(null)
  const [layerViewMode, setLayerViewMode] = useState<
    'properties' | 'scene' | 'transitions' | 'effects' | 'audio' | 'text' | 'charts' | 'avatar' | 'three' | 'elements' | 'code'
  >('properties')
  const [avatarTabLayerId, setAvatarTabLayerId] = useState<string | null>(null)
  const [codeSubTab, setCodeSubTab] = useState<'jsx' | 'css'>('jsx')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!layersTabSectionPending) return
    const avatarPick = useVideoStore.getState().layersTabAvatarLayerIdPending
    const pendingToMode: Partial<
      Record<
        LayersTabSectionId,
        'properties' | 'scene' | 'transitions' | 'audio' | 'text' | 'charts' | 'avatar' | 'three' | 'elements'
      >
    > = {
      properties: 'properties',
      scene: 'scene',
      transitions: 'transitions',
      audio: 'audio',
      text: 'text',
      charts: 'charts',
      avatar: 'avatar',
      three: 'three',
      elements: 'elements',
    }
    const mode = pendingToMode[layersTabSectionPending]
    if (mode) {
      setLayerViewMode(mode)
      if (mode === 'avatar' && avatarPick) setAvatarTabLayerId(avatarPick)
    }
    clearLayersTabSectionPending()
  }, [layersTabSectionPending, clearLayersTabSectionPending])

  useEffect(() => {
    setThreeEnvPatchHint(null)
  }, [scene.id])

  useEffect(() => {
    const marker = scene.videoLayer?.src
    if (!marker || !marker.startsWith('recording://request')) return
    try {
      const qs = marker.includes('?') ? marker.split('?')[1] : ''
      const params = new URLSearchParams(qs)
      const parsedFps = Number(params.get('fps') || '')
      const parsedResolution = params.get('resolution')
      if (Number.isFinite(parsedFps) && parsedFps > 0) {
        setRecordingFps(Math.max(1, Math.min(120, Math.round(parsedFps))))
      }
      if (
        parsedResolution === 'source' ||
        parsedResolution === '720p' ||
        parsedResolution === '1080p' ||
        parsedResolution === '1440p' ||
        parsedResolution === '2160p'
      ) {
        setRecordingResolution(parsedResolution)
      }
    } catch {}
    updateScene(scene.id, { videoLayer: { ...scene.videoLayer, src: null, enabled: true } })
    void handleToggleScreenRecord()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.videoLayer?.src, scene.id])

  // Get palette for inline inspector
  const palette = globalStyle.paletteOverride ?? ['#2d2d2d', '#e84545', '#4a90d9', '#50c878']

  // Inspector element patch handler — live preview only, no HTML regen
  // (saveSceneHTML regenerates from scene store which doesn't have inspector changes,
  //  so calling it would reload the iframe and wipe the live edits)
  const handleInspectorPatch = useCallback(
    (elementId: string, property: string, value: unknown) => {
      patchInspectorElement(elementId, property, value)
      const iframe = document.querySelector(`iframe[data-scene-id="${selectedSceneId}"]`) as HTMLIFrameElement | null
      patchElementInIframe(iframe, elementId, property, value)
    },
    [patchInspectorElement, selectedSceneId],
  )

  // ── Code editor handlers ─────────────────────────────────
  const handleCodeEdit = useCallback(
    (value: string | undefined) => {
      if (!scene) return
      const isReact = scene.sceneType === 'react'
      if (codeSubTab === 'jsx') {
        if (isReact) updateScene(scene.id, { reactCode: value ?? '' })
        else if (scene.sceneType === 'svg') updateScene(scene.id, { svgContent: value ?? '' })
        else if (scene.sceneType === 'canvas2d') updateScene(scene.id, { canvasCode: value ?? '' })
        else updateScene(scene.id, { sceneCode: value ?? '' })
      } else {
        updateScene(scene.id, { sceneStyles: value ?? '' })
      }
      // Debounced auto-save for live preview
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveSceneHTML(scene.id)
      }, 800)
    },
    [scene?.id, scene?.sceneType, codeSubTab, updateScene, saveSceneHTML],
  )

  const codeEditorLanguage = useMemo(() => {
    if (codeSubTab === 'css') return 'css'
    if (scene?.sceneType === 'svg') return 'xml'
    if (scene?.sceneType === 'react') return 'typescript'
    return 'javascript'
  }, [codeSubTab, scene?.sceneType])

  const codeEditorValue = useMemo(() => {
    if (!scene) return ''
    if (codeSubTab === 'css') return scene.sceneStyles || ''
    if (scene.sceneType === 'react') return scene.reactCode || ''
    if (scene.sceneType === 'svg') return scene.svgContent || ''
    if (scene.sceneType === 'canvas2d') return scene.canvasCode || ''
    return scene.sceneCode || ''
  }, [scene, codeSubTab])

  const handleSelectElement = useCallback(
    (element: any) => {
      const isAlreadySelected = inspectorSelectedElement?.id === element.id
      if (isAlreadySelected) {
        clearInspector()
        const iframe = document.querySelector(`iframe[data-scene-id="${selectedSceneId}"]`) as HTMLIFrameElement | null
        highlightElementInIframe(iframe, null)
      } else {
        selectInspectorElement(element, null)
        const iframe = document.querySelector(`iframe[data-scene-id="${selectedSceneId}"]`) as HTMLIFrameElement | null
        highlightElementInIframe(iframe, element.id)
      }
    },
    [inspectorSelectedElement, selectedSceneId, selectInspectorElement, clearInspector],
  )

  // Request elements from iframe when scene changes or on mount
  useEffect(() => {
    const iframe = document.querySelector(`iframe[data-scene-id="${selectedSceneId}"]`) as HTMLIFrameElement | null
    if (iframe) {
      requestElementsFromIframe(iframe)
    }
  }, [selectedSceneId])

  const videoInputRef = useRef<HTMLInputElement>(null)
  const screenRecorderRef = useRef<MediaRecorder | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenChunksRef = useRef<Blob[]>([])

  const handleVideoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const url = await uploadFile(file)
        updateScene(scene.id, { videoLayer: { ...scene.videoLayer, src: url, enabled: true } })
        await saveSceneHTML(scene.id)
      } catch {
        alert('Upload failed')
      }
    },
    [scene, updateScene, saveSceneHTML],
  )

  const stopScreenRecording = useCallback(() => {
    try {
      screenRecorderRef.current?.stop()
    } catch {}
    try {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {}
  }, [])

  const handleToggleScreenRecord = useCallback(async () => {
    if (!(window as any).electronAPI) {
      alert('Screen recording is only available in Electron mode.')
      return
    }
    if (isRecordingScreen) {
      stopScreenRecording()
      return
    }
    try {
      const resolutionMap: Record<
        'source' | '720p' | '1080p' | '1440p' | '2160p',
        { width: number; height: number } | null
      > = {
        source: null,
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
        '1440p': { width: 2560, height: 1440 },
        '2160p': { width: 3840, height: 2160 },
      }
      const sizeHint = resolutionMap[recordingResolution]
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: sizeHint
          ? {
              frameRate: { ideal: recordingFps, max: Math.max(15, recordingFps) },
              width: { ideal: sizeHint.width },
              height: { ideal: sizeHint.height },
            }
          : { frameRate: { ideal: recordingFps, max: Math.max(15, recordingFps) } },
        audio: true,
      })
      screenStreamRef.current = stream
      screenChunksRef.current = []

      const preferred = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      const mime = preferred.find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      screenRecorderRef.current = recorder
      setIsRecordingScreen(true)

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) screenChunksRef.current.push(ev.data)
      }

      recorder.onstop = async () => {
        setIsRecordingScreen(false)
        try {
          const blob = new Blob(screenChunksRef.current, { type: mime || 'video/webm' })
          const bytes = await blob.arrayBuffer()
          const ext = (mime || 'video/webm').includes('mp4') ? 'mp4' : 'webm'
          const projectSlug = (project.name || 'project')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          const sceneSlug = (scene.name || `scene-${scene.order + 1}`)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          const hint = `${projectSlug || 'project'}-${sceneSlug || `scene-${scene.order + 1}`}-${recordingResolution}-${recordingFps}fps`
          const saved = await (window as any).electronAPI.saveRecording({ bytes, extension: ext, nameHint: hint })
          updateScene(scene.id, {
            videoLayer: {
              ...scene.videoLayer,
              src: saved.fileUrl,
              enabled: true,
              trimStart: 0,
              trimEnd: null,
            },
          })
          await saveSceneHTML(scene.id)
        } catch {
          alert('Recording save failed')
        } finally {
          screenRecorderRef.current = null
          screenChunksRef.current = []
          try {
            screenStreamRef.current?.getTracks().forEach((t) => t.stop())
          } catch {}
          screenStreamRef.current = null
        }
      }

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (screenRecorderRef.current?.state === 'recording') {
          stopScreenRecording()
        }
      })

      recorder.start(200)
    } catch {
      setIsRecordingScreen(false)
      alert('Screen recording failed or was cancelled.')
    }
  }, [
    isRecordingScreen,
    project.name,
    recordingFps,
    recordingResolution,
    saveSceneHTML,
    scene.id,
    scene.name,
    scene.order,
    scene.videoLayer,
    stopScreenRecording,
    updateScene,
  ])

  const commitLayer = useCallback(async () => {
    await saveSceneHTML(scene.id)
  }, [scene.id, saveSceneHTML])

  // Debounced commit for sliders — fires 150ms after last change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitLayerDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveSceneHTML(scene.id)
    }, 150)
  }, [scene.id, saveSceneHTML])

  const cameraMoves = scene.cameraMotion ?? []
  const importableCameraMoves =
    cameraMoves.length === 0
      ? [
          ...extractCameraMovesFromSceneCode(scene.sceneCode || ''),
          ...extractCameraMovesFromSceneHTML(scene.sceneHTML || ''),
        ]
      : []

  const updateCameraMove = useCallback(
    (index: number, patch: Partial<CameraMove>) => {
      const next = [...cameraMoves]
      next[index] = { ...next[index], ...patch }
      updateScene(scene.id, { cameraMotion: next })
      commitLayerDebounced()
    },
    [cameraMoves, updateScene, scene.id, commitLayerDebounced],
  )

  const removeCameraMove = useCallback(
    (index: number) => {
      const next = cameraMoves.filter((_, i) => i !== index)
      updateScene(scene.id, { cameraMotion: next.length ? next : null })
      commitLayer()
    },
    [cameraMoves, updateScene, scene.id, commitLayer],
  )

  const moveCameraMove = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= cameraMoves.length) return
      const next = [...cameraMoves]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      updateScene(scene.id, { cameraMotion: next })
      commitLayer()
    },
    [cameraMoves, updateScene, scene.id, commitLayer],
  )

  const chartLayers = scene.chartLayers ?? []
  const physicsLayers = scene.physicsLayers ?? []
  const addChartLayer = useCallback(() => {
    const next: D3ChartLayer[] = [
      ...chartLayers,
      {
        id: crypto.randomUUID(),
        name: `Chart ${chartLayers.length + 1}`,
        chartType: 'bar',
        data: [
          { label: 'A', value: 20 },
          { label: 'B', value: 45 },
          { label: 'C', value: 30 },
        ],
        config: { title: `Chart ${chartLayers.length + 1}` },
        layout: { x: 10, y: 12, width: 80, height: 72 },
        timing: { startAt: 0, duration: Math.max(1, scene.duration - 0.5), animated: true },
      },
    ]
    const compiled = compileD3SceneFromLayers(next)
    updateScene(scene.id, {
      sceneType: 'd3',
      chartLayers: next,
      sceneCode: compiled.sceneCode,
      d3Data: compiled.d3Data as any,
    })
    commitLayer()
  }, [chartLayers, scene.duration, updateScene, scene.id, commitLayer])

  const updateChartLayers = useCallback(
    (next: D3ChartLayer[]) => {
      const compiled = compileD3SceneFromLayers(next)
      updateScene(scene.id, {
        sceneType: 'd3',
        chartLayers: next,
        sceneCode: compiled.sceneCode,
        d3Data: compiled.d3Data as any,
      })
      commitLayerDebounced()
    },
    [updateScene, scene.id, commitLayerDebounced],
  )

  const avatarLayers = useMemo(
    () => (scene.aiLayers ?? []).filter((l): l is AvatarLayer => l.type === 'avatar'),
    [scene.aiLayers],
  )

  const resolvedAvatarLayerId = useMemo(() => {
    if (avatarLayers.length === 0) return null
    if (avatarTabLayerId && avatarLayers.some((l) => l.id === avatarTabLayerId)) return avatarTabLayerId
    return avatarLayers[0]!.id
  }, [avatarLayers, avatarTabLayerId])

  const addTalkingHeadAvatar = useCallback(async () => {
    const id = crypto.randomUUID()
    const script = 'Welcome! Let me explain this scene.'
    const layer: AvatarLayer = {
      id,
      type: 'avatar',
      avatarId: '',
      voiceId: '',
      script,
      removeBackground: false,
      x: 1640,
      y: 800,
      width: 320,
      height: 320,
      opacity: 1,
      zIndex: 100,
      videoUrl: null,
      thumbnailUrl: null,
      status: 'ready',
      heygenVideoId: null,
      estimatedDuration: scene.duration,
      startAt: 0,
      label: 'Avatar Overlay',
      avatarPlacement: 'pip_bottom_right',
      avatarProvider: 'talkinghead',
      talkingHeadUrl: `talkinghead://render?text=${encodeURIComponent(script)}&audio=&character=friendly`,
      narrationScript: {
        mood: 'happy',
        view: 'upper',
        lipsyncHeadMovement: true,
        eyeContact: 0.7,
        position: 'pip_bottom_right',
        pipSize: 320,
        pipShape: 'circle',
        avatarScale: 1.15,
        containerEnabled: true,
        background: '#6366f1',
        character: 'friendly',
        containerBlur: 16,
        containerBorderColor: '#ffffff',
        containerBorderOpacity: 0.35,
        containerBorderWidth: 2,
        containerShadowOpacity: 0.35,
        containerInnerGlow: 0.08,
        containerBgOpacity: 0.2,
        entranceAnimation: 'fade',
        exitAnimation: 'fade',
        lines: [],
      },
    }
    addAILayer(scene.id, layer as AILayer)
    setAvatarTabLayerId(id)
    await saveSceneHTML(scene.id)
  }, [addAILayer, scene.id, scene.duration, saveSceneHTML])

  const addPhysicsLayer = useCallback(() => {
    const next: PhysicsLayer[] = [
      ...(scene.physicsLayers ?? []),
      {
        id: crypto.randomUUID(),
        name: `Physics ${physicsLayers.length + 1}`,
        simulation: 'pendulum',
        layout: 'split',
        params: { g: 9.81, length: 2, angle: 30, damping: 0.02 },
        equations: ['pendulum_ode'],
        title: 'Physics Simulation',
        narration: 'Describe what changes over time and why.',
      },
    ]
    const primary = next[0]
    const compiled = compilePhysicsSceneFromLayers(scene.id, primary)
    updateScene(scene.id, {
      sceneType: 'physics',
      physicsLayers: next,
      sceneCode: compiled.sceneCode,
      sceneHTML: compiled.sceneHTML,
    })
    commitLayer()
  }, [scene.physicsLayers, physicsLayers.length, scene.id, updateScene, commitLayer])

  const updatePhysicsLayers = useCallback(
    (next: PhysicsLayer[]) => {
      const primary = next[0]
      const patch: Partial<Scene> = { physicsLayers: next, sceneType: 'physics' }
      if (primary) {
        const compiled = compilePhysicsSceneFromLayers(scene.id, primary)
        patch.sceneCode = compiled.sceneCode
        patch.sceneHTML = compiled.sceneHTML
      } else {
        patch.sceneCode = ''
        patch.sceneHTML = ''
      }
      updateScene(scene.id, patch)
      commitLayerDebounced()
    },
    [scene.id, updateScene, commitLayerDebounced],
  )

  useEffect(() => {
    if (!physicsCardDrag) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - physicsCardDrag.startClientX
      const dy = e.clientY - physicsCardDrag.startClientY
      const panelW = 260 // approximate control preview width in px
      const panelH = 150
      const dxPct = (dx / panelW) * 100
      const dyPct = (dy / panelH) * 100

      const next = [...physicsLayers]
      const layer = next[physicsCardDrag.idx]
      if (!layer) return
      const params = { ...(layer.params || {}) } as Record<string, unknown>

      if (physicsCardDrag.mode === 'move') {
        const width = Math.max(16, Math.min(55, Number(params.ui_cardWidth ?? physicsCardDrag.startW)))
        const half = width / 2
        const nx = Math.max(half + 1, Math.min(99 - half, physicsCardDrag.startX + dxPct))
        const ny = Math.max(8, Math.min(92, physicsCardDrag.startY + dyPct))
        params.ui_cardX = nx
        params.ui_cardY = ny
      } else {
        const nw = Math.max(16, Math.min(55, physicsCardDrag.startW + dxPct))
        params.ui_cardWidth = nw
        const half = nw / 2
        const currX = Number(params.ui_cardX ?? physicsCardDrag.startX)
        params.ui_cardX = Math.max(half + 1, Math.min(99 - half, currX))
      }

      next[physicsCardDrag.idx] = { ...layer, params }
      updatePhysicsLayers(next)
    }

    const onUp = () => setPhysicsCardDrag(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [physicsCardDrag, physicsLayers, updatePhysicsLayers])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
        onChange={handleVideoUpload}
        className="hidden"
        aria-hidden
      />
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 px-2 pt-1.5 pb-1 shrink-0 overflow-x-auto scrollbar-none" role="tablist">
        {([
          { id: 'properties' as const, label: 'Properties', icon: SlidersHorizontal },
          { id: 'scene' as const, label: 'Scene', icon: Film },
          { id: 'transitions' as const, label: 'Transitions', icon: Clapperboard },
          { id: 'effects' as const, label: 'Effects', icon: Sparkles },
          { id: 'audio' as const, label: 'Audio', icon: Volume2 },
          { id: 'text' as const, label: 'Text', icon: Type },
          { id: 'charts' as const, label: 'Charts', icon: BarChart3 },
          { id: 'avatar' as const, label: 'Avatar', icon: User },
          { id: 'three' as const, label: '3D', icon: Boxes },
          { id: 'elements' as const, label: 'Elements', icon: Box },
          { id: 'code' as const, label: 'Code', icon: Code2 },
        ] as const).map((tab) => {
          const isActive = layerViewMode === tab.id
          const TabIcon = tab.icon
          return (
            <span
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setLayerViewMode(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md cursor-pointer transition-colors select-none whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--agent-chat-user-surface)]'
                  : 'hover:text-[var(--color-text-primary)]'
              }`}
            >
              <TabIcon size={11} />
              {tab.label}
            </span>
          )
        })}
      </div>

      {/* ── Code tab ── */}
      {layerViewMode === 'code' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--color-border)] shrink-0">
            <span
              role="tab"
              aria-selected={codeSubTab === 'jsx'}
              onClick={() => setCodeSubTab('jsx')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded cursor-pointer transition-all ${
                codeSubTab === 'jsx' ? 'bg-[#e84545]/15 text-[#e84545]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {scene.sceneType === 'react' ? 'JSX' : scene.sceneType === 'svg' ? 'SVG' : 'JS'}
            </span>
            <span
              role="tab"
              aria-selected={codeSubTab === 'css'}
              onClick={() => setCodeSubTab('css')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded cursor-pointer transition-all ${
                codeSubTab === 'css' ? 'bg-[#4a90d9]/15 text-[#4a90d9]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              CSS
            </span>
            <span className="ml-auto text-[10px] text-[var(--color-text-muted)] font-mono">{scene.sceneType}</span>
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              language={codeEditorLanguage} value={codeEditorValue} onChange={handleCodeEdit} theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, tabSize: 2, renderWhitespace: 'none', folding: true, automaticLayout: true }}
            />
          </div>
        </div>
      )}

      {/* ── Text tab ── */}
      {layerViewMode === 'text' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TextTab scene={scene} />
        </div>
      )}

      {/* ── Charts tab ── */}
      {layerViewMode === 'charts' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[var(--color-text-primary)]">Charts</h3>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {chartLayers.length} chart{chartLayers.length === 1 ? '' : 's'} · D3 / data viz layers
              </p>
            </div>
            <button
              type="button"
              onClick={addChartLayer}
              className="kbd flex h-7 shrink-0 items-center gap-1 px-2 text-[11px] text-[#6b6b7a] hover:text-[#e84545]"
            >
              <Plus size={11} />
              Add
            </button>
          </div>

          {scene.sceneType !== 'd3' && chartLayers.length === 0 && (
            <div
              className="mb-3 text-[11px] text-[#6b6b7a] border rounded p-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Add a chart to convert this scene to D3 mode.
            </div>
          )}
          {chartLayers.length === 0 ? (
            <div
              className="text-[11px] text-[#6b6b7a] text-center py-8 border border-dashed rounded"
              style={{ borderColor: 'var(--color-border)' }}
            >
              No chart layers yet. Use Add to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {chartLayers.map((layer, idx) => (
                <div
                  key={layer.id}
                  className="border rounded p-2.5 space-y-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={layer.name}
                      onChange={(e) => {
                        const next = [...chartLayers]
                        next[idx] = { ...layer, name: e.target.value }
                        updateChartLayers(next)
                      }}
                      className="flex-1 border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-[#e84545]"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <ColorSelect
                      value={layer.chartType}
                      onChange={(v) => {
                        const next = [...chartLayers]
                        next[idx] = { ...layer, chartType: v as D3ChartType }
                        updateChartLayers(next)
                      }}
                      options={D3_CHART_TYPES.map((t) => ({ value: t, label: t }))}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = chartLayers.filter((_, i) => i !== idx)
                        updateChartLayers(next)
                      }}
                      className="text-[#6b6b7a] hover:text-[#e84545]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="number"
                      value={layer.layout.x}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(e) => {
                        const next = [...chartLayers]
                        next[idx] = { ...layer, layout: { ...layer.layout, x: parseFloat(e.target.value) || 0 } }
                        updateChartLayers(next)
                      }}
                      className="border rounded px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <input
                      type="number"
                      value={layer.layout.y}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(e) => {
                        const next = [...chartLayers]
                        next[idx] = { ...layer, layout: { ...layer.layout, y: parseFloat(e.target.value) || 0 } }
                        updateChartLayers(next)
                      }}
                      className="border rounded px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <input
                      type="number"
                      value={layer.layout.width}
                      min={1}
                      max={100}
                      step={1}
                      onChange={(e) => {
                        const next = [...chartLayers]
                        next[idx] = {
                          ...layer,
                          layout: { ...layer.layout, width: parseFloat(e.target.value) || 1 },
                        }
                        updateChartLayers(next)
                      }}
                      className="border rounded px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <input
                      type="number"
                      value={layer.layout.height}
                      min={1}
                      max={100}
                      step={1}
                      onChange={(e) => {
                        const next = [...chartLayers]
                        next[idx] = {
                          ...layer,
                          layout: { ...layer.layout, height: parseFloat(e.target.value) || 1 },
                        }
                        updateChartLayers(next)
                      }}
                      className="border rounded px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <input
                      type="number"
                      value={layer.timing.startAt}
                      min={0}
                      step={0.1}
                      title="Start (s)"
                      onChange={(e) => {
                        const next = [...chartLayers]
                        next[idx] = {
                          ...layer,
                          timing: { ...layer.timing, startAt: parseFloat(e.target.value) || 0 },
                        }
                        updateChartLayers(next)
                      }}
                      className="border rounded px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <input
                      type="number"
                      value={layer.timing.duration}
                      min={0.1}
                      step={0.1}
                      title="Duration (s)"
                      onChange={(e) => {
                        const next = [...chartLayers]
                        next[idx] = {
                          ...layer,
                          timing: { ...layer.timing, duration: parseFloat(e.target.value) || 0.1 },
                        }
                        updateChartLayers(next)
                      }}
                      className="border rounded px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <label className="flex items-center gap-1 text-[11px] text-[#6b6b7a]">
                      <input
                        type="checkbox"
                        checked={layer.timing.animated}
                        onChange={(e) => {
                          const next = [...chartLayers]
                          next[idx] = { ...layer, timing: { ...layer.timing, animated: e.target.checked } }
                          updateChartLayers(next)
                        }}
                      />
                      animated
                    </label>
                  </div>

                  <details>
                    <summary className="text-[11px] text-[#6b6b7a] cursor-pointer">Data JSON</summary>
                    <textarea
                      rows={4}
                      value={chartDataDraft[layer.id] ?? JSON.stringify(layer.data ?? [], null, 2)}
                      onChange={(e) => setChartDataDraft((p) => ({ ...p, [layer.id]: e.target.value }))}
                      onBlur={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || '[]')
                          const next = [...chartLayers]
                          next[idx] = { ...layer, data: parsed }
                          updateChartLayers(next)
                          setChartDataDraft((p) => {
                            const n = { ...p }
                            delete n[layer.id]
                            return n
                          })
                        } catch {
                          /* keep draft */
                        }
                      }}
                      className="w-full mt-1 border rounded px-2 py-1 text-[11px] font-mono"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </details>

                  <details>
                    <summary className="text-[11px] text-[#6b6b7a] cursor-pointer">Config JSON</summary>
                    <textarea
                      rows={4}
                      value={chartConfigDraft[layer.id] ?? JSON.stringify(layer.config ?? {}, null, 2)}
                      onChange={(e) => setChartConfigDraft((p) => ({ ...p, [layer.id]: e.target.value }))}
                      onBlur={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || '{}')
                          const next = [...chartLayers]
                          next[idx] = { ...layer, config: parsed }
                          updateChartLayers(next)
                          setChartConfigDraft((p) => {
                            const n = { ...p }
                            delete n[layer.id]
                            return n
                          })
                        } catch {
                          /* keep draft */
                        }
                      }}
                      className="w-full mt-1 border rounded px-2 py-1 text-[11px] font-mono"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Avatar tab ── */}
      {layerViewMode === 'avatar' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[var(--color-text-primary)]">Avatar</h3>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {avatarLayers.length} avatar layer{avatarLayers.length === 1 ? '' : 's'} · talking-head & HeyGen-style
                overlays
              </p>
            </div>
            <button
              type="button"
              onClick={() => void addTalkingHeadAvatar()}
              className="kbd flex h-7 shrink-0 items-center gap-1 px-2 text-[11px] text-[#6b6b7a] hover:text-[#e84545]"
            >
              <Plus size={11} />
              Add
            </button>
          </div>

          {avatarLayers.length === 0 ? (
            <div
              className="text-[11px] text-[#6b6b7a] text-center py-8 border border-dashed rounded space-y-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <p>No avatar layer yet. Add a local talking-head overlay or use the Agent / HeyGen flows to generate one.</p>
              <button
                type="button"
                onClick={() => void addTalkingHeadAvatar()}
                className="kbd inline-flex h-8 items-center gap-1 px-3 text-[11px] text-[#e84545] border-[#e84545]/40"
              >
                <Plus size={12} />
                Add talking-head avatar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {avatarLayers.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {avatarLayers.map((l) => {
                    const active = l.id === resolvedAvatarLayerId
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setAvatarTabLayerId(l.id)}
                        className={`kbd px-2 py-1 text-[10px] font-medium ${
                          active
                            ? 'border-[#e84545] text-[#e84545] bg-[#e84545]/10'
                            : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {l.label?.trim() || 'Avatar'}
                      </button>
                    )
                  })}
                </div>
              )}
              {resolvedAvatarLayerId && (
                <>
                  <AvatarLayerPropertiesForm
                    scene={scene}
                    layerId={resolvedAvatarLayerId}
                    onCommit={() => void saveSceneHTML(scene.id)}
                    openLayersSection={openLayersSection}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      removeAILayer(scene.id, resolvedAvatarLayerId)
                      setAvatarTabLayerId(null)
                      void saveSceneHTML(scene.id)
                    }}
                    className="text-[11px] text-[#6b6b7a] hover:text-[#e84545]"
                  >
                    Remove this avatar layer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Effects tab ── */}
      {layerViewMode === 'effects' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <CameraEffectPickerGrid
            sceneDuration={scene.duration}
            cameraMotion={scene.cameraMotion}
            onApplyMotion={(motion) => {
              updateScene(scene.id, { cameraMotion: motion })
              commitLayer()
            }}
            onUpdateTiming={(patch) => {
              const m = cameraMoves[0]
              if (!m) return
              const next = [...cameraMoves]
              next[0] = { ...m, params: { ...m.params, ...patch } }
              updateScene(scene.id, { cameraMotion: next })
              commitLayerDebounced()
            }}
            importableCount={importableCameraMoves.length}
            onImportFromCode={() => {
              if (importableCameraMoves.length === 0) return
              updateScene(scene.id, { cameraMotion: [importableCameraMoves[0]!] })
              commitLayer()
            }}
          />
        </div>
      )}

      {/* ── Transitions tab ── */}
      {layerViewMode === 'transitions' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <TransitionPickerGrid
            selectedId={scene.transition}
            onSelect={(id) => {
              updateScene(scene.id, { transition: id })
              commitLayer()
            }}
          />
        </div>
      )}

      {/* ── Scene tab ── */}
      {layerViewMode === 'scene' && (
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {showScenesSection && (
          <div className="mb-2 flex flex-shrink-0 border-b px-2 py-2" style={{ borderBottomColor: 'var(--color-hairline)' }}>
            <button
              type="button"
              onClick={() => addScene()}
              className={`kbd h-8 !py-0 gap-2 text-sm font-medium shadow-black/40 transition-all duration-200 flex w-full items-center justify-center overflow-hidden ${
                isLeftCollapsed ? 'px-0' : 'px-3'
              }`}
            >
              <Plus size={14} strokeWidth={1.5} className="flex-shrink-0" />
              {!isLeftCollapsed && <span className="whitespace-nowrap">New Scene</span>}
            </button>
          </div>
        )}

          {/* ═══ SCENE ═══ */}
          <SectionGroup title="Scene" icon={Film} color="#e8a849" defaultOpen>
          <CollapsibleSection title="Scene Settings" icon={Film} active>
            <div>
              <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">Name</label>
              <input
                type="text"
                placeholder="Untitled scene"
                value={scene.name}
                onChange={(e) => updateScene(scene.id, { name: e.target.value })}
                onBlur={commitLayer}
                className="w-full border rounded px-3 py-2 text-sm placeholder-[#6b6b7a] focus:outline-none focus:border-[#e84545] transition-colors"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <div>
              <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">
                Duration: {scene.duration}s
              </label>
              <input
                type="range"
                min={3}
                max={20}
                step={1}
                value={scene.duration}
                onChange={(e) => updateScene(scene.id, { duration: parseInt(e.target.value) })}
                onMouseUp={commitLayer}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-[#6b6b7a] mt-0.5">
                <span>3s</span>
                <span>20s</span>
              </div>
            </div>
            <div>
              <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">
                Background color
              </label>
              <div className="flex items-center gap-2">
                <label className="relative cursor-pointer group flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-lg border-2 transition-all overflow-hidden group-hover:border-[#e84545]"
                    style={{ background: scene.bgColor, borderColor: 'var(--color-border)' }}
                  />
                  <input
                    type="color"
                    value={scene.bgColor}
                    onChange={(e) => updateScene(scene.id, { bgColor: e.target.value })}
                    onBlur={commitLayer}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </label>
                <input
                  type="text"
                  value={scene.bgColor}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value))
                      updateScene(scene.id, { bgColor: e.target.value })
                  }}
                  onBlur={commitLayer}
                  className="flex-1 border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-[#e84545] transition-colors"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">Aspect Ratio</label>
              <div className="flex gap-1.5">
                {ASPECT_RATIO_OPTIONS.map((opt) => {
                  const active = (project.mp4Settings?.aspectRatio ?? '16:9') === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        updateProject({ mp4Settings: { ...project.mp4Settings, aspectRatio: opt.value } })
                      }}
                      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-md border text-[10px] transition-all flex-1"
                      style={{
                        borderColor: active ? '#e84545' : 'var(--color-border)',
                        backgroundColor: active ? 'rgba(232,69,69,0.1)' : 'var(--color-input-bg)',
                        color: active ? '#e84545' : 'var(--color-text-secondary)',
                      }}
                    >
                      <div
                        className="rounded-sm border"
                        style={{
                          borderColor: active ? '#e84545' : 'var(--color-border)',
                          width: opt.value === '16:9' ? 24 : opt.value === '9:16' ? 14 : opt.value === '1:1' ? 18 : 16,
                          height: opt.value === '16:9' ? 14 : opt.value === '9:16' ? 24 : opt.value === '1:1' ? 18 : 20,
                        }}
                      />
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="text-[10px] text-[#6b6b7a] mt-1">
                {(() => {
                  const d = resolveProjectDimensions(project.mp4Settings?.aspectRatio, project.mp4Settings?.resolution)
                  return `${d.width}×${d.height}`
                })()}
              </div>
            </div>

          </CollapsibleSection>
          </SectionGroup>

              {/* ═══ BRAND KIT ═══ */}
              <SectionGroup title="Brand Kit" icon={Stamp} color="#e8a849">
                <BrandKitPanel />
              </SectionGroup>

              {/* ═══ PRESETS ═══ */}
              <SectionGroup title="Presets" icon={Paintbrush} color="#c678dd">
              <CollapsibleSection title="Style" icon={Palette} active={!!globalStyle.presetId}>
                <StylePresetPicker
                  currentPresetId={globalStyle.presetId}
                  onChange={(id) =>
                    updateGlobalStyle({
                      presetId: id,
                      paletteOverride: null,
                      bgColorOverride: null,
                      fontOverride: null,
                      strokeColorOverride: null,
                    })
                  }
                />

                {/* Font picker */}
                <FontPicker
                  value={globalStyle.fontOverride ?? null}
                  presetFont={
                    globalStyle.presetId && STYLE_PRESETS[globalStyle.presetId as StylePresetId]
                      ? STYLE_PRESETS[globalStyle.presetId as StylePresetId].font
                      : 'Inter'
                  }
                  onChange={(family) => updateGlobalStyle({ fontOverride: family })}
                />

                {/* Advanced overrides (collapsed) */}
                <details className="group">
                  <summary className="text-[11px] text-[#6b6b7a] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
                    <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
                    Advanced overrides
                  </summary>
                  <div className="mt-2 space-y-3">
                    {/* Palette override */}
                    <div>
                      <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">
                        Palette override
                      </label>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => {
                          const presetPalette = globalStyle.presetId
                            ? STYLE_PRESETS[globalStyle.presetId as StylePresetId]?.palette
                            : (['#374151', '#6b7280', '#9ca3af', '#d1d5db'] as [string, string, string, string])
                          return (
                            <input
                              key={i}
                              type="color"
                              value={globalStyle.paletteOverride?.[i] ?? presetPalette?.[i] ?? '#000000'}
                              onChange={(e) => {
                                const current =
                                  globalStyle.paletteOverride ??
                                  ([...(presetPalette ?? ['#000000', '#000000', '#000000', '#000000'])] as [
                                    string,
                                    string,
                                    string,
                                    string,
                                  ])
                                const updated = [...current] as [string, string, string, string]
                                updated[i] = e.target.value
                                updateGlobalStyle({ paletteOverride: updated })
                              }}
                              className="w-8 h-6 border border-[var(--color-border)] rounded cursor-pointer"
                            />
                          )
                        })}
                        {globalStyle.paletteOverride && (
                          <button
                            onClick={() => updateGlobalStyle({ paletteOverride: null })}
                            className="text-[10px] text-[#6b6b7a] hover:text-[var(--color-accent)] ml-1"
                          >
                            reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Background override */}
                    <div>
                      <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">
                        Background override
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={globalStyle.bgColorOverride ?? '#ffffff'}
                          onChange={(e) => updateGlobalStyle({ bgColorOverride: e.target.value })}
                          className="w-8 h-6 border border-[var(--color-border)] rounded cursor-pointer"
                        />
                        {globalStyle.bgColorOverride && (
                          <button
                            onClick={() => updateGlobalStyle({ bgColorOverride: null })}
                            className="text-[10px] text-[#6b6b7a] hover:text-[var(--color-accent)]"
                          >
                            reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </CollapsibleSection>

              <CollapsibleSection title="Scene Style" icon={Palette} active={Object.keys(scene.styleOverride ?? {}).length > 0}>
                {Object.keys(scene.styleOverride ?? {}).length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#6b6b7a]">Inheriting from project style</p>
                    <details className="group">
                      <summary className="text-[11px] text-[#e84545] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
                        <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
                        Apply scene override
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        {(Object.keys(SCENE_STYLE_PRESETS) as SceneStylePresetName[]).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              updateScene(scene.id, { styleOverride: SCENE_STYLE_PRESETS[name] })
                              commitLayer()
                            }}
                            className="kbd h-7 text-[11px] text-[#6b6b7a] hover:text-[#f0ece0] flex items-center gap-1.5"
                          >
                            <div className="flex gap-0.5">
                              {SCENE_STYLE_PRESETS[name].palette?.map((c, i) => (
                                <div key={i} className="w-2 h-2 rounded-full" style={{ background: c }} />
                              ))}
                            </div>
                            <span className="truncate">{name}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {(scene.styleOverride.palette ?? []).map((c, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded border"
                            style={{ background: c, borderColor: 'var(--color-border)' }}
                          />
                        ))}
                      </div>
                      {scene.styleOverride.bgColor && (
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ background: scene.styleOverride.bgColor, borderColor: 'var(--color-border)' }}
                          title="Background"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">Preset</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(Object.keys(SCENE_STYLE_PRESETS) as SceneStylePresetName[]).map((name) => {
                          const isActive =
                            JSON.stringify(scene.styleOverride.palette) ===
                            JSON.stringify(SCENE_STYLE_PRESETS[name].palette)
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                updateScene(scene.id, { styleOverride: SCENE_STYLE_PRESETS[name] })
                                commitLayer()
                              }}
                              className={`kbd h-7 text-[11px] flex items-center gap-1.5 ${
                                isActive
                                  ? 'border-[#e84545] text-[#e84545] shadow-[#800]'
                                  : 'text-[#6b6b7a] hover:text-[#f0ece0]'
                              }`}
                            >
                              <div className="flex gap-0.5">
                                {SCENE_STYLE_PRESETS[name].palette?.map((c, i) => (
                                  <div key={i} className="w-2 h-2 rounded-full" style={{ background: c }} />
                                ))}
                              </div>
                              <span className="truncate">{name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateScene(scene.id, { styleOverride: {} })
                        commitLayer()
                      }}
                      className="text-[11px] text-[#e84545] hover:underline"
                    >
                      Clear override — inherit from project
                    </button>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Grid & Snapping" icon={Grid3X3} active={gridConfig.enabled}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridConfig.enabled}
                    onChange={(e) => updateGridConfig({ enabled: e.target.checked })}
                    className="accent-[#e84545]"
                  />
                  <span className="text-[12px] text-[var(--color-text-primary)]">Enable snapping</span>
                </label>
                <div>
                  <label className="text-[#6b6b7a] text-[11px] uppercase tracking-wider block mb-1.5">Grid size</label>
                  <div className="flex gap-1.5">
                    {([20, 40, 80] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => updateGridConfig({ size })}
                        className={`kbd h-7 flex-1 text-[11px] ${
                          gridConfig.size === size
                            ? 'border-[#e84545] text-[#e84545] shadow-[#800]'
                            : 'text-[#6b6b7a] hover:text-[#f0ece0]'
                        }`}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridConfig.showGrid}
                    onChange={(e) => updateGridConfig({ showGrid: e.target.checked })}
                    className="accent-[#e84545]"
                  />
                  <span className="text-[12px] text-[var(--color-text-primary)]">Show grid overlay</span>
                  <span className="text-[10px] text-[#6b6b7a] ml-auto">G</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridConfig.snapToElements}
                    onChange={(e) => updateGridConfig({ snapToElements: e.target.checked })}
                    className="accent-[#e84545]"
                  />
                  <span className="text-[12px] text-[var(--color-text-primary)]">Snap to other elements</span>
                </label>
              </CollapsibleSection>
              </SectionGroup>

      </div>
      )}

      {/* ── 3D tab ── */}
      {layerViewMode === 'three' && (
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          <SectionGroup title="3D" icon={Boxes} color="#56b6c2" defaultOpen>
              <div className="space-y-2 border-t pt-3 mt-1" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <Box size={12} className="text-[#6b6b7a] shrink-0" />
                  <span className="text-[#6b6b7a] text-[11px] uppercase tracking-wider">3D stage environment</span>
                </div>
                <p className="text-[10px] leading-snug text-[#6b6b7a]">
                  For Three.js scenes: built-in world behind your models (
                  <span className="font-mono text-[var(--color-text-muted)]">applyCenchThreeEnvironment</span>
                  ). With an empty scene code, choosing an environment creates a starter Three.js scene you can edit.
                  Animated worlds need{' '}
                  <span className="font-mono text-[var(--color-text-muted)]">
                    updateCenchThreeEnvironment(t)
                  </span>{' '}
                  each frame.
                </p>
                <ColorSelect
                  size="md"
                  value={
                    parseAppliedThreeEnvironmentId(scene.sceneCode || '') ?? scene.threeEnvironmentPresetId ?? ''
                  }
                  onChange={async (v) => {
                    const envId = v === '' ? null : v
                    const code = scene.sceneCode || ''
                    const res = patchThreeEnvironmentInSceneCode(code, envId)

                    if (envId && res.injectFailed && !code.trim()) {
                      setThreeEnvPatchHint(null)
                      updateScene(scene.id, {
                        sceneType: 'three',
                        threeEnvironmentPresetId: envId,
                        sceneCode: buildThreeEnvironmentShowcaseSceneCode(envId),
                      })
                      await saveSceneHTML(scene.id)
                      return
                    }

                    if (res.injectFailed && envId) {
                      setThreeEnvPatchHint(
                        'Could not patch this code. Add camera.lookAt(...) or applyCenchThreeEnvironment, or clear Three.js code and pick an environment again for a fresh starter.',
                      )
                      updateScene(scene.id, { threeEnvironmentPresetId: envId })
                      await saveSceneHTML(scene.id)
                      return
                    }

                    setThreeEnvPatchHint(null)
                    updateScene(scene.id, {
                      threeEnvironmentPresetId: envId,
                      sceneCode: res.sceneCode,
                    })
                    await saveSceneHTML(scene.id)
                  }}
                  options={[
                    { value: '', label: 'None (custom backdrop only)' },
                    ...CENCH_THREE_ENVIRONMENTS.map((env) => ({ value: env.id, label: env.name })),
                  ]}
                />
                {threeEnvPatchHint ? (
                  <p className="text-[10px] leading-snug text-amber-600 dark:text-amber-400/90">{threeEnvPatchHint}</p>
                ) : null}
              </div>


              <CollapsibleSection
                title="Physics"
                icon={Sparkles}
                active={physicsLayers.length > 0}
                extraHeaderContent={
                  <button onClick={addPhysicsLayer} className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]">
                    <Plus size={11} />
                    <span className="text-[11px]">Add</span>
                  </button>
                }
                badge={
                  <span className="text-[11px] text-[#6b6b7a]">
                    {physicsLayers.length} layer{physicsLayers.length === 1 ? '' : 's'}
                  </span>
                }
              >
                {physicsLayers.length === 0 ? (
                  <div
                    className="text-[11px] text-[#6b6b7a] text-center py-3 border border-dashed rounded"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    No physics layers yet. Add one to edit simulation params manually.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {physicsLayers.map((layer, idx) => (
                      <div
                        key={layer.id}
                        className="border rounded p-2.5 space-y-2"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            value={layer.name}
                            onChange={(e) => {
                              const next = [...physicsLayers]
                              next[idx] = { ...layer, name: e.target.value }
                              updatePhysicsLayers(next)
                            }}
                            className="flex-1 border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-[#e84545]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                          <ColorSelect
                            value={layer.simulation}
                            onChange={(v) => {
                              const next = [...physicsLayers]
                              next[idx] = { ...layer, simulation: v as PhysicsSimulationType }
                              updatePhysicsLayers(next)
                            }}
                            options={PHYSICS_SIM_TYPES.map((t) => ({ value: t, label: t }))}
                          />
                          <button
                            onClick={() => {
                              const next = physicsLayers.filter((_, i) => i !== idx)
                              updatePhysicsLayers(next)
                            }}
                            className="text-[#6b6b7a] hover:text-[#e84545]"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <ColorSelect
                              className="w-full"
                              label="Layout"
                              value={layer.layout}
                              onChange={(v) => {
                                const next = [...physicsLayers]
                                next[idx] = { ...layer, layout: v as PhysicsLayer['layout'] }
                                updatePhysicsLayers(next)
                              }}
                              options={[
                                { value: 'split', label: 'split' },
                                { value: 'fullscreen', label: 'fullscreen' },
                                { value: 'equation_focus', label: 'equation_focus' },
                              ]}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Equation Keys (comma)</label>
                            <input
                              value={(layer.equations || []).join(', ')}
                              onChange={(e) => {
                                const next = [...physicsLayers]
                                next[idx] = {
                                  ...layer,
                                  equations: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                                updatePhysicsLayers(next)
                              }}
                              className="w-full border rounded px-2 py-1 text-[11px]"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Title</label>
                          <input
                            value={layer.title}
                            onChange={(e) => {
                              const next = [...physicsLayers]
                              next[idx] = { ...layer, title: e.target.value }
                              updatePhysicsLayers(next)
                            }}
                            className="w-full border rounded px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Narration</label>
                          <textarea
                            rows={2}
                            value={layer.narration}
                            onChange={(e) => {
                              const next = [...physicsLayers]
                              next[idx] = { ...layer, narration: e.target.value }
                              updatePhysicsLayers(next)
                            }}
                            className="w-full border rounded px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </div>

                        {layer.simulation === 'electric_field' ? (
                          <div>
                            <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Charges JSON</label>
                            <textarea
                              rows={4}
                              value={JSON.stringify(
                                (layer.params as any)?.charges ?? [{ x: 960, y: 540, q: 1 }],
                                null,
                                2,
                              )}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value || '[]')
                                  const next = [...physicsLayers]
                                  next[idx] = { ...layer, params: { ...(layer.params || {}), charges: parsed } }
                                  updatePhysicsLayers(next)
                                } catch {}
                              }}
                              className="w-full border rounded px-2 py-1 text-[11px] font-mono"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {(PHYSICS_PARAM_FIELDS[layer.simulation] || []).map((f) => (
                              <div key={f.key}>
                                <label className="text-[10px] text-[#6b6b7a] block mb-0.5">{f.label}</label>
                                <input
                                  type="number"
                                  min={f.min}
                                  max={f.max}
                                  step={f.step ?? 0.1}
                                  value={Number((layer.params as any)?.[f.key] ?? 0)}
                                  onChange={(e) => {
                                    const next = [...physicsLayers]
                                    next[idx] = {
                                      ...layer,
                                      params: { ...(layer.params || {}), [f.key]: parseFloat(e.target.value) },
                                    }
                                    updatePhysicsLayers(next)
                                  }}
                                  className="w-full border rounded px-2 py-1 text-[11px]"
                                  style={{
                                    backgroundColor: 'var(--color-input-bg)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-primary)',
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {layer.layout !== 'fullscreen' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Card X (%)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={Number((layer.params as any)?.ui_cardX ?? 74)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardX: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Card Y (%)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={Number((layer.params as any)?.ui_cardY ?? 50)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardY: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Card Width (%)</label>
                              <input
                                type="number"
                                min={16}
                                max={55}
                                step={1}
                                value={Number((layer.params as any)?.ui_cardWidth ?? 30)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardWidth: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Sim Scale</label>
                              <input
                                type="number"
                                min={0.35}
                                max={1.2}
                                step={0.01}
                                value={Number(
                                  (layer.params as any)?.ui_simScale ??
                                    (String(layer.layout) === 'fullscreen' ? 1 : 0.82),
                                )}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_simScale: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <ColorSelect
                                className="w-full"
                                label="Card Preset"
                                value={String((layer.params as any)?.ui_cardPreset ?? 'glass_dark')}
                                onChange={(v) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardPreset: v },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                options={[
                                  { value: 'glass_dark', label: 'glass_dark' },
                                  { value: 'glass_light', label: 'glass_light' },
                                  { value: 'neon', label: 'neon' },
                                  { value: 'chalk', label: 'chalk' },
                                ]}
                              />
                            </div>
                            <label className="flex items-center gap-1 text-[11px] text-[#6b6b7a]">
                              <input
                                type="checkbox"
                                checked={Boolean((layer.params as any)?.ui_cardAuto)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardAuto: e.target.checked },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                              />
                              auto card position
                            </label>
                          </div>
                        )}

                        {layer.layout !== 'fullscreen' && (
                          <div>
                            <label className="text-[10px] text-[#6b6b7a] block mb-1">Visual card position/size</label>
                            <div
                              className="relative h-36 rounded border overflow-hidden"
                              style={{
                                borderColor: 'var(--color-border)',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.08))',
                              }}
                              onClick={(e) => {
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                                const xPct = ((e.clientX - rect.left) / rect.width) * 100
                                const yPct = ((e.clientY - rect.top) / rect.height) * 100
                                const width = Number((layer.params as any)?.ui_cardWidth ?? 30)
                                const half = width / 2
                                const next = [...physicsLayers]
                                next[idx] = {
                                  ...layer,
                                  params: {
                                    ...(layer.params || {}),
                                    ui_cardX: Math.max(half + 1, Math.min(99 - half, xPct)),
                                    ui_cardY: Math.max(8, Math.min(92, yPct)),
                                  },
                                }
                                updatePhysicsLayers(next)
                              }}
                            >
                              <div className="absolute inset-0 opacity-40 pointer-events-none">
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-[#6b6b7a]">
                                  simulation center
                                </div>
                              </div>

                              <div
                                className="absolute border rounded cursor-move"
                                style={{
                                  left: `${Number((layer.params as any)?.ui_cardX ?? 74)}%`,
                                  top: `${Number((layer.params as any)?.ui_cardY ?? 50)}%`,
                                  width: `${Number((layer.params as any)?.ui_cardWidth ?? 30)}%`,
                                  height: '34%',
                                  transform: 'translate(-50%, -50%)',
                                  borderColor: '#e84545',
                                  background: 'rgba(232,69,69,0.08)',
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  setPhysicsCardDrag({
                                    idx,
                                    mode: 'move',
                                    startClientX: e.clientX,
                                    startClientY: e.clientY,
                                    startX: Number((layer.params as any)?.ui_cardX ?? 74),
                                    startY: Number((layer.params as any)?.ui_cardY ?? 50),
                                    startW: Number((layer.params as any)?.ui_cardWidth ?? 30),
                                  })
                                }}
                              >
                                <div className="absolute left-1 top-1 text-[10px] text-[#f0b4b4] pointer-events-none">
                                  card
                                </div>
                                <div
                                  className="absolute right-0 bottom-0 w-3 h-3 bg-[#e84545] cursor-ew-resize"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    setPhysicsCardDrag({
                                      idx,
                                      mode: 'resize',
                                      startClientX: e.clientX,
                                      startClientY: e.clientY,
                                      startX: Number((layer.params as any)?.ui_cardX ?? 74),
                                      startY: Number((layer.params as any)?.ui_cardY ?? 50),
                                      startW: Number((layer.params as any)?.ui_cardWidth ?? 30),
                                    })
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <details>
                          <summary className="text-[11px] text-[#6b6b7a] cursor-pointer">
                            Card style + text controls
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Card Opacity</label>
                              <input
                                type="number"
                                min={0.2}
                                max={1}
                                step={0.05}
                                value={Number((layer.params as any)?.ui_cardOpacity ?? 1)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardOpacity: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Blur (px)</label>
                              <input
                                type="number"
                                min={0}
                                max={18}
                                step={0.5}
                                value={Number((layer.params as any)?.ui_cardBlur ?? 3)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardBlur: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Radius (px)</label>
                              <input
                                type="number"
                                min={0}
                                max={40}
                                step={1}
                                value={Number((layer.params as any)?.ui_cardRadius ?? 14)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardRadius: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Padding (px)</label>
                              <input
                                type="number"
                                min={8}
                                max={56}
                                step={1}
                                value={Number((layer.params as any)?.ui_cardPadding ?? 22)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardPadding: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <ColorSelect
                                className="w-full"
                                label="Text Align"
                                value={String(
                                  (layer.params as any)?.ui_textAlign ??
                                    (layer.layout === 'equation_focus' ? 'center' : 'left'),
                                )}
                                onChange={(v) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_textAlign: v },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                options={[
                                  { value: 'left', label: 'left' },
                                  { value: 'center', label: 'center' },
                                ]}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Title Size (px)</label>
                              <input
                                type="number"
                                min={16}
                                max={84}
                                step={1}
                                value={Number((layer.params as any)?.ui_titleSize ?? 42)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_titleSize: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Body Size (px)</label>
                              <input
                                type="number"
                                min={12}
                                max={54}
                                step={1}
                                value={Number((layer.params as any)?.ui_bodySize ?? 26)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_bodySize: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b6b7a] block mb-0.5">Equation Size (px)</label>
                              <input
                                type="number"
                                min={14}
                                max={88}
                                step={1}
                                value={Number((layer.params as any)?.ui_equationSize ?? 32)}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_equationSize: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[11px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                          </div>
                        </details>

                        <details>
                          <summary className="text-[11px] text-[#6b6b7a] cursor-pointer">Params JSON</summary>
                          <textarea
                            rows={5}
                            value={JSON.stringify(layer.params ?? {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value || '{}')
                                const next = [...physicsLayers]
                                next[idx] = { ...layer, params: parsed }
                                updatePhysicsLayers(next)
                              } catch {
                                // keep invalid draft in field; user can fix JSON
                              }
                            }}
                            className="w-full mt-1 border rounded px-2 py-1 text-[11px] font-mono"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </details>
                      </div>
                    ))}
                    <p className="text-[10px] text-[#6b6b7a]">
                      Primary render currently uses the first physics layer in this list.
                    </p>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Zdog Studio"
                icon={User}
                active={zdogStudioMode}
                badge={
                  zdogStudioMode ? (
                    <span className="text-[11px] text-teal-400">active</span>
                  ) : (
                    <span className="text-[11px] text-[#6b6b7a]">shape builder</span>
                  )
                }
              >
                {zdogStudioMode ? (
                  <div className="space-y-2">
                    <ZdogOutliner projectId={project.id} />
                    <button
                      onClick={() => setZdogStudioMode(false)}
                      className="kbd h-7 px-3 text-[11px] text-[#6b6b7a] hover:text-[#e84545] w-full"
                    >
                      Exit Zdog Studio
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#6b6b7a]">Build reusable Zdog shapes, characters, and items.</p>
                    <button
                      onClick={() => setZdogStudioMode(true)}
                      className="kbd h-7 px-3 text-[11px] text-[#6b6b7a] hover:text-teal-400 w-full"
                    >
                      Enter Zdog Studio
                    </button>
                  </div>
                )}
              </CollapsibleSection>

          </SectionGroup>
        </div>
      )}


      {/* ── Audio tab ── */}
      {layerViewMode === 'audio' && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AudioTabPanel scene={scene} />
        </div>
      )}

      {/* ── Elements tab ── */}
      {(layerViewMode === 'elements' || layerViewMode === 'properties') && (
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {/* ═══ ELEMENTS ═══ */}
              <SectionGroup title="Elements" icon={Box} color="#e8a849" count={Object.keys(inspectorElements).length} defaultOpen>

              {/* Scene Elements (registered from iframe) — primary content */}
              {Object.keys(inspectorElements).length > 0 ? (
              <div className="px-2 py-1 space-y-1">
                {Object.values(inspectorElements).map((element) => {
                  const isSelected = inspectorSelectedElement?.id === element.id
                  return (
                    <div key={element.id}>
                      <div
                        onClick={() => handleSelectElement(element)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#e84545]/10 border border-[#e84545]/30'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <Box size={10} className={isSelected ? 'text-[#e84545]' : 'text-[#6b6b7a]'} />
                        <span
                          className={`text-[12px] flex-1 truncate ${
                            isSelected ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-primary)]'
                          }`}
                        >
                          {element.label || element.id}
                        </span>
                        <span className="text-[10px] font-mono text-[#4a4a52] bg-[#1a1a1f] px-1 py-0.5 rounded flex-shrink-0">
                          {element.type}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            handleInspectorPatch(element.id, 'visible', !element.visible)
                          }}
                          className="text-[#6b6b7a] hover:text-[var(--color-text-primary)] cursor-pointer flex-shrink-0"
                        >
                          {element.visible !== false ? <Eye size={11} /> : <EyeOff size={11} />}
                        </span>
                        <ChevronDown
                          size={10}
                          className={`text-[#6b6b7a] transition-transform flex-shrink-0 ${isSelected ? 'rotate-0' : '-rotate-90'}`}
                        />
                      </div>
                      {isSelected && inspectorSelectedElement && (
                        <div className="ml-2 border-l-2 border-[#e84545]/20 pl-1 mt-1 mb-2">
                          <ElementInspector
                            element={inspectorSelectedElement}
                            layerId={null}
                            sceneId={selectedSceneId}
                            palette={palette}
                            onPatch={handleInspectorPatch}
                            hasOverrides={!!(scene.elementOverrides?.[inspectorSelectedElement.id] && Object.keys(scene.elementOverrides[inspectorSelectedElement.id]).length > 0)}
                            onResetOverrides={() => {
                              if (!scene.elementOverrides?.[inspectorSelectedElement.id]) return
                              const next = { ...scene.elementOverrides }
                              delete next[inspectorSelectedElement.id]
                              updateScene(scene.id, { elementOverrides: next })
                              saveSceneHTML(scene.id)
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              ) : (
                <p className="py-4 text-center text-[11px] text-[var(--color-text-muted)]">
                  Click an element in the preview to inspect it.
                </p>
              )}
              </SectionGroup>

          {/* Interactions (only in interactive mode) */}
          {layerViewMode === 'elements' && project.outputMode === 'interactive' && (
            <CollapsibleSection
              title="Interactions"
              icon={Layers}
              active={(scene.interactions ?? []).length > 0}
              badge={
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#e84545]/20 text-[#e84545] font-bold">
                  Interactive
                </span>
              }
            >
              <InteractionsSection scene={scene} addInteraction={addInteraction} />
            </CollapsibleSection>
          )}
      </div>
      )}

      <SceneLayersStackPanel scene={scene} />

    </div>
  )
}

// ── Interactions Section ──────────────────────────────────────────────────────

function InteractionsSection({
  scene,
  addInteraction: addInteractionFn,
}: {
  scene: Scene
  addInteraction: (sceneId: string, el: InteractionElement) => void
}) {
  const addElement = (type: InteractionElement['type']) => {
    const el = createDefaultInteraction(type)
    addInteractionFn(scene.id, el)
  }

  const typeButtons: { type: InteractionElement['type']; label: string }[] = [
    { type: 'hotspot', label: 'Hotspot' },
    { type: 'choice', label: 'Choice' },
    { type: 'quiz', label: 'Quiz' },
    { type: 'gate', label: 'Gate' },
    { type: 'tooltip', label: 'Tooltip' },
    { type: 'form', label: 'Form' },
  ]

  return (
    <div className="space-y-3">
      {/* Add buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        {typeButtons.map(({ type, label }) => (
          <span
            key={type}
            role="button"
            tabIndex={0}
            onClick={() => addElement(type)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') addElement(type)
            }}
            className="kbd h-7 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            style={{ borderColor: (TYPE_COLORS[type] ?? '#e84545') + '60', color: TYPE_COLORS[type] ?? '#e84545' }}
          >
            {TYPE_ICONS[type]} {label}
          </span>
        ))}
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed rounded-lg border border-[var(--color-border)] px-3 py-2.5">
        Each interaction appears in the <strong>layer stack</strong> below. Expand ▸ to edit{' '}
        <strong>Text & labels</strong> in one place. <strong>Double-click</strong> the row for full properties (type,
        size, timing, style presets & sliders). Use <strong>+</strong> in the stack to add interactions.
      </p>
    </div>
  )
}

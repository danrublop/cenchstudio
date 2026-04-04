'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Film,
  Music,
  Type,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
  Palette,
  Grid3X3,
  RefreshCw,
  Volume2,
  X,
  Box,
  Eye,
  EyeOff,
  Sparkles,
  Camera,
  User,
  LayoutTemplate,
  Clapperboard,
} from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import type {
  Scene,
  SFXTrack,
  MusicTrack,
  InteractionElement,
  CameraMove,
  D3ChartLayer,
  D3ChartType,
  PhysicsLayer,
  PhysicsSimulationType,
} from '@/lib/types'
import { TRANSITION_UI_GROUPS } from '@/lib/transitions'
import type { GridConfig } from '@/lib/grid'
import type { SceneStyleOverride, SceneStylePresetName } from '@/lib/types'
import { SCENE_STYLE_PRESETS, getScenePresetName } from '@/lib/styles/scene-presets'
import { normalizeAudioLayer } from '@/lib/audio/normalize'
import AILayersPanel from '@/components/AILayersPanel'
import { createDefaultInteraction, TYPE_COLORS, TYPE_ICONS } from '@/components/tabs/InteractTab'
import StylePresetPicker from '@/components/StylePresetPicker'
import FontPicker from '@/components/FontPicker'
import { STYLE_PRESETS, type StylePresetId } from '@/lib/styles/presets'
import { SFXSearchPopover } from '@/components/audio/SFXSearchPopover'
import { MusicSearchPopover } from '@/components/audio/MusicSearchPopover'
import { ElementInspector } from '@/components/inspector/PropertyInspector'
import { highlightElementInIframe, patchElementInIframe, requestElementsFromIframe } from '@/lib/scene-patcher'
import { compileD3SceneFromLayers } from '@/lib/charts/compile'
import { compilePhysicsSceneFromLayers } from '@/lib/physics/compile'
import ZdogOutliner from '@/components/zdog-studio/ZdogOutliner'
import CanvasMotionTemplatesPanel from '@/components/CanvasMotionTemplatesPanel'
import SceneLayersStackPanel from '@/components/layers/SceneLayersStackPanel'
import LayerStackPropertiesPanel from '@/components/layers/LayerStackPropertiesPanel'
import LayersTabSubheader from '@/components/layers/LayersTabSubheader'
import TextTab from '@/components/tabs/TextTab'
import {
  DEFAULT_LAYERS_VISIBLE_TABS,
  loadLayersTabHeader,
  saveLayersTabHeader,
  type LayersTabSectionId,
} from '@/lib/layers-tab-header'
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
}: {
  title: string
  icon: any
  children: React.ReactNode
  defaultOpen?: boolean
  extraHeaderContent?: React.ReactNode
  badge?: React.ReactNode
  enabled?: boolean
  onEnabledChange?: (val: boolean) => void
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Auto-expand when enabled transitions to true
  useEffect(() => {
    if (enabled) setIsOpen(true)
  }, [enabled])

  return (
    <section
      className="border rounded-lg overflow-hidden transition-all duration-200"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="flex items-center gap-2 p-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon size={13} className="text-[#6b6b7a] shrink-0" />
          <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-3">
          {onEnabledChange && (
            <div className="flex items-center gap-2 mr-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-[#6b6b7a] uppercase tracking-wider">{enabled ? 'On' : 'Off'}</span>
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
          {extraHeaderContent && (
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              {extraHeaderContent}
            </div>
          )}
          <ChevronRight
            size={12}
            className={`text-[#6b6b7a] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
        </div>
      </div>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[5000px] opacity-100 border-t' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="p-3 space-y-4">{children}</div>
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

export default function LayersTab({ scene }: Props) {
  const {
    updateScene,
    saveSceneHTML,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    addSvgObject,
    updateSvgObject,
    removeSvgObject,
    generateSvgObject,
    isGenerating,
    generatingSceneId,
    globalStyle,
    updateGlobalStyle,
    gridConfig,
    updateGridConfig,
    generateNarration,
    addSFXToScene,
    removeSFXFromScene,
    setSceneMusic,
    addInteraction,
    project,
    inspectorSelectedElement,
    inspectorElements,
    selectInspectorElement,
    patchInspectorElement,
    clearInspector,
    selectedSceneId,
    layersTabSectionPending,
    clearLayersTabSectionPending,
  } = useVideoStore()

  const [showSFXSearch, setShowSFXSearch] = useState(false)
  const [showMusicSearch, setShowMusicSearch] = useState(false)
  const [isRecordingScreen, setIsRecordingScreen] = useState(false)
  const [recordingFps, setRecordingFps] = useState<number>(30)
  const [recordingResolution, setRecordingResolution] = useState<'source' | '720p' | '1080p' | '1440p' | '2160p'>(
    '1080p',
  )
  const [generatingTTS, setGeneratingTTS] = useState(false)
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

  const [objectPrompts, setObjectPrompts] = useState<Record<string, string>>({})
  const zdogStudioMode = useVideoStore((s) => s.zdogStudioMode)
  const setZdogStudioMode = useVideoStore((s) => s.setZdogStudioMode)
  const [threeEnvPatchHint, setThreeEnvPatchHint] = useState<string | null>(null)

  const [layersVisibleTabIds, setLayersVisibleTabIds] = useState<LayersTabSectionId[]>(
    () => loadLayersTabHeader().visibleTabIds,
  )
  const [layersActiveTab, setLayersActiveTab] = useState<LayersTabSectionId>(() => loadLayersTabHeader().activeTabId)

  useEffect(() => {
    saveLayersTabHeader({
      visibleTabIds: layersVisibleTabIds,
      activeTabId: layersActiveTab,
    })
  }, [layersVisibleTabIds, layersActiveTab])

  useEffect(() => {
    if (!layersVisibleTabIds.includes(layersActiveTab)) {
      setLayersActiveTab(layersVisibleTabIds[0])
    }
  }, [layersVisibleTabIds, layersActiveTab])

  useEffect(() => {
    if (!layersTabSectionPending) return
    setLayersActiveTab(layersTabSectionPending)
    setLayersVisibleTabIds((prev) =>
      prev.includes(layersTabSectionPending) ? prev : [...prev, layersTabSectionPending],
    )
    clearLayersTabSectionPending()
  }, [layersTabSectionPending, clearLayersTabSectionPending])

  useEffect(() => {
    if (project.outputMode === 'interactive') return
    setLayersVisibleTabIds((prev) => {
      const next = prev.filter((id) => id !== 'interact')
      return next.length > 0 ? next : [...DEFAULT_LAYERS_VISIBLE_TABS]
    })
    setLayersActiveTab((a) => (a === 'interact' ? 'scene' : a))
  }, [project.outputMode])

  useEffect(() => {
    setThreeEnvPatchHint(null)
  }, [scene.id])

  useEffect(() => {
    const marker = scene.videoLayer.src
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
  }, [scene.videoLayer.src, scene.id])

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
  const audioInputRef = useRef<HTMLInputElement>(null)
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

  const handleAudioUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const url = await uploadFile(file)
        updateScene(scene.id, { audioLayer: { ...scene.audioLayer, src: url, enabled: true } })
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

  const handleGenerateVoiceover = useCallback(async () => {
    const text = scene.prompt
    if (!text) return
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sceneId: scene.id }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const { url } = await res.json()
      updateScene(scene.id, { audioLayer: { ...scene.audioLayer, src: url, enabled: true } })
      await saveSceneHTML(scene.id)
    } catch (err) {
      alert('TTS generation failed. Check your ElevenLabs API key.')
    }
  }, [scene, updateScene, saveSceneHTML])

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

  const addCameraMove = useCallback(() => {
    const next = [
      ...cameraMoves,
      { type: 'presetReveal', params: { at: 0, duration: Math.max(1, scene.duration - 0.5) } },
    ]
    updateScene(scene.id, { cameraMotion: next })
    commitLayer()
  }, [cameraMoves, updateScene, scene.id, scene.duration, commitLayer])

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
      <LayersTabSubheader
        visibleTabIds={layersVisibleTabIds}
        onVisibleTabIdsChange={setLayersVisibleTabIds}
        activeTabId={layersActiveTab}
        onActiveTabChange={setLayersActiveTab}
        hasInteractTab={project.outputMode === 'interactive'}
      />
      {layersActiveTab === 'text' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TextTab scene={scene} />
        </div>
      ) : layersActiveTab === 'properties' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <LayerStackPropertiesPanel scene={scene} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">
          {layersActiveTab === 'scene' && (
            <>
              <CollapsibleSection title="Scene Settings" icon={Film}>
                <div>
                  <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">Name</label>
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
                  <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
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
                  <div className="flex justify-between text-[9px] text-[#6b6b7a] mt-0.5">
                    <span>3s</span>
                    <span>20s</span>
                  </div>
                </div>
                <div>
                  <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
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
                      className="flex-1 border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#e84545] transition-colors"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3 mt-1" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-2">
                    <Box size={12} className="text-[#6b6b7a] shrink-0" />
                    <span className="text-[#6b6b7a] text-[10px] uppercase tracking-wider">3D stage environment</span>
                  </div>
                  <p className="text-[9px] leading-snug text-[#6b6b7a]">
                    For Three.js scenes: built-in world behind your models (
                    <span className="font-mono text-[var(--color-text-muted)]">applyCenchThreeEnvironment</span>
                    ). With an empty scene code, choosing an environment creates a starter Three.js scene you can edit.
                    Animated worlds need{' '}
                    <span className="font-mono text-[var(--color-text-muted)]">
                      updateCenchThreeEnvironment(t)
                    </span>{' '}
                    each frame.
                  </p>
                  <select
                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    value={
                      parseAppliedThreeEnvironmentId(scene.sceneCode || '') ?? scene.threeEnvironmentPresetId ?? ''
                    }
                    onChange={async (e) => {
                      const v = e.target.value
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
                  >
                    <option value="">None (custom backdrop only)</option>
                    {CENCH_THREE_ENVIRONMENTS.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                  </select>
                  {threeEnvPatchHint ? (
                    <p className="text-[9px] leading-snug text-amber-600 dark:text-amber-400/90">{threeEnvPatchHint}</p>
                  ) : null}
                </div>

                <p className="text-[9px] leading-snug text-[#6b6b7a]">
                  Transitions and camera moves are in the{' '}
                  <span className="text-[var(--color-text-muted)]">Transitions</span> tab.
                </p>
              </CollapsibleSection>

              {/* Project-wide style preset */}
              <CollapsibleSection title="Style" icon={Palette}>
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
                  <summary className="text-[10px] text-[#6b6b7a] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
                    <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
                    Advanced overrides
                  </summary>
                  <div className="mt-2 space-y-3">
                    {/* Palette override */}
                    <div>
                      <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
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
                            className="text-[9px] text-[#6b6b7a] hover:text-[var(--color-accent)] ml-1"
                          >
                            reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Background override */}
                    <div>
                      <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">
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
                            className="text-[9px] text-[#6b6b7a] hover:text-[var(--color-accent)]"
                          >
                            reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </CollapsibleSection>

              <CollapsibleSection title="Scene Style" icon={Palette}>
                {Object.keys(scene.styleOverride ?? {}).length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[#6b6b7a]">Inheriting from project style</p>
                    <details className="group">
                      <summary className="text-[10px] text-[#e84545] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
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
                            className="kbd h-7 text-[10px] text-[#6b6b7a] hover:text-[#f0ece0] flex items-center gap-1.5"
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
                      <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">Preset</label>
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
                              className={`kbd h-7 text-[10px] flex items-center gap-1.5 ${
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
                      className="text-[10px] text-[#e84545] hover:underline"
                    >
                      Clear override — inherit from project
                    </button>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Grid & Snapping" icon={Grid3X3}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridConfig.enabled}
                    onChange={(e) => updateGridConfig({ enabled: e.target.checked })}
                    className="accent-[#e84545]"
                  />
                  <span className="text-[11px] text-[var(--color-text-primary)]">Enable snapping</span>
                </label>
                <div>
                  <label className="text-[#6b6b7a] text-[10px] uppercase tracking-wider block mb-1.5">Grid size</label>
                  <div className="flex gap-1.5">
                    {([20, 40, 80] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => updateGridConfig({ size })}
                        className={`kbd h-7 flex-1 text-[10px] ${
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
                  <span className="text-[11px] text-[var(--color-text-primary)]">Show grid overlay</span>
                  <span className="text-[9px] text-[#6b6b7a] ml-auto">G</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridConfig.snapToElements}
                    onChange={(e) => updateGridConfig({ snapToElements: e.target.checked })}
                    className="accent-[#e84545]"
                  />
                  <span className="text-[11px] text-[var(--color-text-primary)]">Snap to other elements</span>
                </label>
              </CollapsibleSection>
            </>
          )}

          {layersActiveTab === 'transitions' && (
            <>
              <CollapsibleSection title="Transition to Next Scene" icon={Clapperboard}>
                <p className="mb-2 text-[10px] leading-snug text-[#6b6b7a]">
                  How this scene hands off to the next in MP4 export (FFmpeg xfade). The hosted player uses a short fade
                  for any blend style.
                </p>
                <div className="max-h-[min(52vh,420px)] overflow-y-auto pr-0.5 space-y-3">
                  {TRANSITION_UI_GROUPS.map((group) => (
                    <div key={group.category}>
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#8b8b99] mb-1.5">
                        {group.category}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.items.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              updateScene(scene.id, { transition: t.id })
                              commitLayer()
                            }}
                            className={`kbd h-7 text-[10px] text-left px-2 truncate ${
                              scene.transition === t.id
                                ? 'border-[#e84545] text-[#e84545] shadow-[#800]'
                                : 'text-[#6b6b7a] hover:text-[#f0ece0]'
                            }`}
                            title={t.label}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Camera Animation"
                icon={Camera}
                extraHeaderContent={
                  <button
                    type="button"
                    onClick={addCameraMove}
                    className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]"
                  >
                    <Plus size={11} />
                    <span className="text-[10px]">Add</span>
                  </button>
                }
                badge={
                  <span className="text-[10px] text-[#6b6b7a]">
                    {cameraMoves.length} move{cameraMoves.length === 1 ? '' : 's'}
                  </span>
                }
              >
                {importableCameraMoves.length > 0 && (
                  <div
                    className="space-y-2 rounded border p-2 text-[10px]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <p className="text-[#6b6b7a]">
                      Found {importableCameraMoves.length} camera move{importableCameraMoves.length === 1 ? '' : 's'} in
                      scene code. Import to make them editable here.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        updateScene(scene.id, { cameraMotion: importableCameraMoves })
                        commitLayer()
                      }}
                      className="kbd h-7 px-2 text-[10px] text-[#6b6b7a] hover:text-[#e84545]"
                    >
                      Import Camera Moves
                    </button>
                  </div>
                )}

                {cameraMoves.length === 0 ? (
                  <div
                    className="space-y-1 rounded border border-dashed py-3 text-center text-[10px] text-[#6b6b7a]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div>No camera moves. Add one to animate scene framing.</div>
                    {(scene.sceneCode?.includes('camera') || scene.sceneCode?.includes('scene-camera')) && (
                      <div className="text-[9px] text-[#8b8b99]">
                        This scene appears to use inline camera logic in code (not structured `cameraMotion` data).
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cameraMoves.map((move, idx) => {
                      const at = typeof move.params?.at === 'number' ? move.params.at : 0
                      const duration = typeof move.params?.duration === 'number' ? move.params.duration : 1
                      const paramsText = cameraParamsDraft[idx] ?? JSON.stringify(move.params ?? {}, null, 2)
                      return (
                        <div
                          key={`${move.type}-${idx}`}
                          className="space-y-2 rounded border p-2.5"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#6b6b7a]">#{idx + 1}</span>
                            <select
                              value={move.type}
                              onChange={(e) => updateCameraMove(idx, { type: e.target.value as CameraMove['type'] })}
                              className="flex-1 rounded border px-2 py-1 text-[11px] focus:border-[#e84545] focus:outline-none"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              {CAMERA_MOVE_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => moveCameraMove(idx, idx - 1)}
                              className="kbd h-7 w-7 text-[10px]"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCameraMove(idx, idx + 1)}
                              className="kbd h-7 w-7 text-[10px]"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCameraMove(idx)}
                              className="text-[#6b6b7a] hover:text-[#e84545]"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-0.5 block text-[9px] text-[#6b6b7a]">At (s)</label>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={at}
                                onChange={(e) =>
                                  updateCameraMove(idx, {
                                    params: { ...(move.params ?? {}), at: parseFloat(e.target.value) || 0 },
                                  })
                                }
                                className="w-full rounded border px-2 py-1 text-[11px] focus:border-[#e84545] focus:outline-none"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[9px] text-[#6b6b7a]">Duration (s)</label>
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={duration}
                                onChange={(e) =>
                                  updateCameraMove(idx, {
                                    params: {
                                      ...(move.params ?? {}),
                                      duration: Math.max(0.1, parseFloat(e.target.value) || 1),
                                    },
                                  })
                                }
                                className="w-full rounded border px-2 py-1 text-[11px] focus:border-[#e84545] focus:outline-none"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-0.5 block text-[9px] text-[#6b6b7a]">Advanced params (JSON)</label>
                            <textarea
                              value={paramsText}
                              onChange={(e) => setCameraParamsDraft((prev) => ({ ...prev, [idx]: e.target.value }))}
                              onBlur={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value || '{}')
                                  updateCameraMove(idx, { params: parsed })
                                  setCameraParamsDraft((prev) => {
                                    const next = { ...prev }
                                    delete next[idx]
                                    return next
                                  })
                                } catch {
                                  /* keep draft */
                                }
                              }}
                              rows={4}
                              className="w-full rounded border px-2 py-1 font-mono text-[10px] focus:border-[#e84545] focus:outline-none"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CollapsibleSection>
            </>
          )}

          {layersActiveTab === 'scene' && (
            <>
              <CollapsibleSection
                title="Physics"
                icon={Sparkles}
                extraHeaderContent={
                  <button onClick={addPhysicsLayer} className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]">
                    <Plus size={11} />
                    <span className="text-[10px]">Add</span>
                  </button>
                }
                badge={
                  <span className="text-[10px] text-[#6b6b7a]">
                    {physicsLayers.length} layer{physicsLayers.length === 1 ? '' : 's'}
                  </span>
                }
              >
                {physicsLayers.length === 0 ? (
                  <div
                    className="text-[10px] text-[#6b6b7a] text-center py-3 border border-dashed rounded"
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
                            className="flex-1 border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[#e84545]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                          <select
                            value={layer.simulation}
                            onChange={(e) => {
                              const next = [...physicsLayers]
                              next[idx] = { ...layer, simulation: e.target.value as PhysicsSimulationType }
                              updatePhysicsLayers(next)
                            }}
                            className="border rounded px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {PHYSICS_SIM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
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
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Layout</label>
                            <select
                              value={layer.layout}
                              onChange={(e) => {
                                const next = [...physicsLayers]
                                next[idx] = { ...layer, layout: e.target.value as PhysicsLayer['layout'] }
                                updatePhysicsLayers(next)
                              }}
                              className="w-full border rounded px-2 py-1 text-[10px]"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              <option value="split">split</option>
                              <option value="fullscreen">fullscreen</option>
                              <option value="equation_focus">equation_focus</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Equation Keys (comma)</label>
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
                              className="w-full border rounded px-2 py-1 text-[10px]"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Title</label>
                          <input
                            value={layer.title}
                            onChange={(e) => {
                              const next = [...physicsLayers]
                              next[idx] = { ...layer, title: e.target.value }
                              updatePhysicsLayers(next)
                            }}
                            className="w-full border rounded px-2 py-1 text-[10px]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </div>

                        <div>
                          <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Narration</label>
                          <textarea
                            rows={2}
                            value={layer.narration}
                            onChange={(e) => {
                              const next = [...physicsLayers]
                              next[idx] = { ...layer, narration: e.target.value }
                              updatePhysicsLayers(next)
                            }}
                            className="w-full border rounded px-2 py-1 text-[10px]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </div>

                        {layer.simulation === 'electric_field' ? (
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Charges JSON</label>
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
                              className="w-full border rounded px-2 py-1 text-[10px] font-mono"
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
                                <label className="text-[9px] text-[#6b6b7a] block mb-0.5">{f.label}</label>
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
                                  className="w-full border rounded px-2 py-1 text-[10px]"
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
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Card X (%)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Card Y (%)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Card Width (%)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Sim Scale</label>
                              <input
                                type="number"
                                min={0.35}
                                max={1.2}
                                step={0.01}
                                value={Number(
                                  (layer.params as any)?.ui_simScale ?? (layer.layout === 'fullscreen' ? 1 : 0.82),
                                )}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_simScale: parseFloat(e.target.value) },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Card Preset</label>
                              <select
                                value={String((layer.params as any)?.ui_cardPreset ?? 'glass_dark')}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_cardPreset: e.target.value },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                <option value="glass_dark">glass_dark</option>
                                <option value="glass_light">glass_light</option>
                                <option value="neon">neon</option>
                                <option value="chalk">chalk</option>
                              </select>
                            </div>
                            <label className="flex items-center gap-1 text-[10px] text-[#6b6b7a]">
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
                            <label className="text-[9px] text-[#6b6b7a] block mb-1">Visual card position/size</label>
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
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] text-[#6b6b7a]">
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
                                <div className="absolute left-1 top-1 text-[9px] text-[#f0b4b4] pointer-events-none">
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
                          <summary className="text-[10px] text-[#6b6b7a] cursor-pointer">
                            Card style + text controls
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Card Opacity</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Blur (px)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Radius (px)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Padding (px)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Text Align</label>
                              <select
                                value={String(
                                  (layer.params as any)?.ui_textAlign ??
                                    (layer.layout === 'equation_focus' ? 'center' : 'left'),
                                )}
                                onChange={(e) => {
                                  const next = [...physicsLayers]
                                  next[idx] = {
                                    ...layer,
                                    params: { ...(layer.params || {}), ui_textAlign: e.target.value },
                                  }
                                  updatePhysicsLayers(next)
                                }}
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                <option value="left">left</option>
                                <option value="center">center</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Title Size (px)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Body Size (px)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
                                style={{
                                  backgroundColor: 'var(--color-input-bg)',
                                  borderColor: 'var(--color-border)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Equation Size (px)</label>
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
                                className="w-full border rounded px-2 py-1 text-[10px]"
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
                          <summary className="text-[10px] text-[#6b6b7a] cursor-pointer">Params JSON</summary>
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
                            className="w-full mt-1 border rounded px-2 py-1 text-[10px] font-mono"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </details>
                      </div>
                    ))}
                    <p className="text-[9px] text-[#6b6b7a]">
                      Primary render currently uses the first physics layer in this list.
                    </p>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Charts"
                icon={Grid3X3}
                extraHeaderContent={
                  <button onClick={addChartLayer} className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]">
                    <Plus size={11} />
                    <span className="text-[10px]">Add</span>
                  </button>
                }
                badge={
                  <span className="text-[10px] text-[#6b6b7a]">
                    {chartLayers.length} chart{chartLayers.length === 1 ? '' : 's'}
                  </span>
                }
              >
                {scene.sceneType !== 'd3' && chartLayers.length === 0 && (
                  <div
                    className="text-[10px] text-[#6b6b7a] border rounded p-2"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    Add a chart to convert this scene to D3 mode.
                  </div>
                )}
                {chartLayers.length === 0 ? (
                  <div
                    className="text-[10px] text-[#6b6b7a] text-center py-3 border border-dashed rounded"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    No chart layers yet. Add one to edit directly in Layers.
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
                            className="flex-1 border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[#e84545]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                          <select
                            value={layer.chartType}
                            onChange={(e) => {
                              const next = [...chartLayers]
                              next[idx] = { ...layer, chartType: e.target.value as D3ChartType }
                              updateChartLayers(next)
                            }}
                            className="border rounded px-2 py-1 text-[11px]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {D3_CHART_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <button
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
                            className="border rounded px-2 py-1 text-[10px]"
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
                            className="border rounded px-2 py-1 text-[10px]"
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
                            className="border rounded px-2 py-1 text-[10px]"
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
                            className="border rounded px-2 py-1 text-[10px]"
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
                            onChange={(e) => {
                              const next = [...chartLayers]
                              next[idx] = {
                                ...layer,
                                timing: { ...layer.timing, startAt: parseFloat(e.target.value) || 0 },
                              }
                              updateChartLayers(next)
                            }}
                            className="border rounded px-2 py-1 text-[10px]"
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
                            onChange={(e) => {
                              const next = [...chartLayers]
                              next[idx] = {
                                ...layer,
                                timing: { ...layer.timing, duration: parseFloat(e.target.value) || 0.1 },
                              }
                              updateChartLayers(next)
                            }}
                            className="border rounded px-2 py-1 text-[10px]"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                          <label className="flex items-center gap-1 text-[10px] text-[#6b6b7a]">
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
                          <summary className="text-[10px] text-[#6b6b7a] cursor-pointer">Data JSON</summary>
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
                              } catch {}
                            }}
                            className="w-full mt-1 border rounded px-2 py-1 text-[10px] font-mono"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </details>

                        <details>
                          <summary className="text-[10px] text-[#6b6b7a] cursor-pointer">Config JSON</summary>
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
                              } catch {}
                            }}
                            className="w-full mt-1 border rounded px-2 py-1 text-[10px] font-mono"
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
              </CollapsibleSection>
            </>
          )}

          {layersActiveTab === 'scene' && (
            <>
              {/* SVG Layer (always) */}
              <CollapsibleSection
                title="SVG Layer"
                icon={Layers}
                badge={<span className="text-[10px] text-[#6b6b7a] ml-auto">always present</span>}
              >
                <div
                  className="w-full h-full"
                  style={{ pointerEvents: 'none', overflow: 'hidden', backgroundColor: 'var(--color-input-bg)' }}
                >
                  {scene.svgContent
                    ? `${scene.svgContent.length.toLocaleString()} chars · z-index 2`
                    : 'No SVG generated yet'}
                </div>
              </CollapsibleSection>

              {/* Video Layer */}
              <CollapsibleSection
                title="Video Layer"
                icon={Film}
                enabled={scene.videoLayer.enabled}
                onEnabledChange={(val) => {
                  updateScene(scene.id, {
                    videoLayer: { ...scene.videoLayer, enabled: val },
                  })
                  commitLayer()
                }}
              >
                {/* Upload / URL */}
                <div className="space-y-2">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="kbd w-full h-8 border-dashed border-[#444] text-[#6b6b7a] hover:text-[#e84545] hover:border-[#e84545] transition-colors"
                  >
                    <Plus size={14} />
                    <span className="text-xs">{scene.videoLayer.src ? 'Replace video' : 'Upload MP4'}</span>
                  </button>
                  <button
                    onClick={handleToggleScreenRecord}
                    className={`kbd w-full h-8 transition-colors ${
                      isRecordingScreen
                        ? 'border-[#e84545] text-[#e84545]'
                        : 'border-dashed border-[#444] text-[#6b6b7a] hover:text-[#e84545] hover:border-[#e84545]'
                    }`}
                  >
                    <Camera size={14} />
                    <span className="text-xs">{isRecordingScreen ? 'Stop recording' : 'Record Screen'}</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#6b6b7a] block mb-1">Recording FPS</label>
                      <select
                        value={recordingFps}
                        onChange={(e) => setRecordingFps(parseInt(e.target.value, 10) || 30)}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                        style={{
                          backgroundColor: 'var(--color-input-bg)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <option value={24}>24</option>
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6b6b7a] block mb-1">Resolution hint</label>
                      <select
                        value={recordingResolution}
                        onChange={(e) =>
                          setRecordingResolution((e.target.value as typeof recordingResolution) || '1080p')
                        }
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                        style={{
                          backgroundColor: 'var(--color-input-bg)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <option value="source">Source/native</option>
                        <option value="720p">1280x720</option>
                        <option value="1080p">1920x1080</option>
                        <option value="1440p">2560x1440</option>
                        <option value="2160p">3840x2160</option>
                      </select>
                    </div>
                  </div>
                  {scene.videoLayer.src && (
                    <p className="text-[#6b6b7a] text-[10px] truncate">{scene.videoLayer.src}</p>
                  )}
                  <div>
                    <label className="text-[10px] text-[#6b6b7a] block mb-1">Or paste URL</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={scene.videoLayer.src ?? ''}
                      onChange={(e) =>
                        updateScene(scene.id, {
                          videoLayer: { ...scene.videoLayer, src: e.target.value || null },
                        })
                      }
                      onBlur={commitLayer}
                      className="w-full border rounded px-2 py-1 text-xs placeholder-[#6b6b7a] focus:outline-none focus:border-[#e84545] transition-colors"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <label className="text-[10px] text-[#6b6b7a] block mb-1">
                    Opacity: {Math.round(scene.videoLayer.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={scene.videoLayer.opacity}
                    onChange={(e) => {
                      updateScene(scene.id, {
                        videoLayer: { ...scene.videoLayer, opacity: parseFloat(e.target.value) },
                      })
                      commitLayerDebounced()
                    }}
                    className="w-full"
                  />
                </div>

                {/* Trim */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b6b7a] block mb-1">Trim start (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={scene.videoLayer.trimStart}
                      onChange={(e) =>
                        updateScene(scene.id, {
                          videoLayer: { ...scene.videoLayer, trimStart: parseFloat(e.target.value) || 0 },
                        })
                      }
                      onBlur={commitLayer}
                      className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b6b7a] block mb-1">Trim end (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={scene.videoLayer.trimEnd ?? ''}
                      placeholder="auto"
                      onChange={(e) =>
                        updateScene(scene.id, {
                          videoLayer: {
                            ...scene.videoLayer,
                            trimEnd: e.target.value ? parseFloat(e.target.value) : null,
                          },
                        })
                      }
                      onBlur={commitLayer}
                      className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                </div>
              </CollapsibleSection>
            </>
          )}

          {layersActiveTab === 'audio' && (
            <>
              {/* Audio Layer */}
              <CollapsibleSection
                title="Audio Layer"
                icon={Music}
                enabled={scene.audioLayer.enabled}
                onEnabledChange={(val) => {
                  updateScene(scene.id, {
                    audioLayer: { ...scene.audioLayer, enabled: val },
                  })
                  commitLayer()
                }}
              >
                {(() => {
                  const audio = normalizeAudioLayer(scene.audioLayer)
                  return (
                    <>
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/mp3,audio/wav,audio/mpeg"
                        onChange={handleAudioUpload}
                        className="hidden"
                      />

                      <div className="flex gap-2">
                        <span
                          onClick={() => audioInputRef.current?.click()}
                          className="kbd flex-1 h-8 border-dashed border-[#444] text-[#6b6b7a] hover:text-[#e84545] hover:border-[#e84545] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span className="text-[10px] shrink-0 whitespace-nowrap">
                            {scene.audioLayer.src ? 'Replace' : 'Upload MP3'}
                          </span>
                        </span>
                        <span
                          onClick={handleGenerateVoiceover}
                          className="kbd flex-1 h-8 text-[#6b6b7a] hover:text-[#f0ece0] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Music size={14} />
                          <span className="text-[10px]">ElevenLabs</span>
                        </span>
                      </div>

                      {/* TTS Narration */}
                      {audio.tts && audio.tts.text && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#6b6b7a]">Narration</span>
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
                            >
                              {audio.tts.provider}
                            </span>
                            {audio.tts.status === 'ready' && <span className="text-[9px] text-green-500">ready</span>}
                            {audio.tts.status === 'generating' && (
                              <span className="text-[9px] text-yellow-500">generating...</span>
                            )}
                            {audio.tts.status === 'error' && <span className="text-[9px] text-red-400">error</span>}
                          </div>
                          <textarea
                            readOnly
                            value={audio.tts.text}
                            rows={2}
                            className="w-full border rounded px-2 py-1 text-[10px] resize-none"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-muted)',
                            }}
                          />
                          <span
                            onClick={async () => {
                              if (generatingTTS || !audio.tts?.text) return
                              setGeneratingTTS(true)
                              try {
                                await generateNarration(
                                  scene.id,
                                  audio.tts.text,
                                  audio.tts.provider,
                                  audio.tts.voiceId || undefined,
                                )
                              } catch {}
                              setGeneratingTTS(false)
                            }}
                            className="kbd w-full h-7 flex items-center justify-center gap-1 text-[10px] cursor-pointer"
                          >
                            <RefreshCw size={10} className={generatingTTS ? 'animate-spin' : ''} />
                            {generatingTTS ? 'Regenerating...' : 'Regenerate'}
                          </span>
                        </div>
                      )}

                      {scene.audioLayer.src && (
                        <p className="text-[#6b6b7a] text-[10px] truncate">{scene.audioLayer.src}</p>
                      )}

                      {/* Volume */}
                      <div>
                        <label className="text-[10px] text-[#6b6b7a] block mb-1">
                          Volume: {Math.round(scene.audioLayer.volume * 100)}%
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={scene.audioLayer.volume}
                          onChange={(e) => {
                            updateScene(scene.id, {
                              audioLayer: { ...scene.audioLayer, volume: parseFloat(e.target.value) },
                            })
                            commitLayerDebounced()
                          }}
                          className="w-full"
                        />
                      </div>

                      {/* Start offset */}
                      <div>
                        <label className="text-[10px] text-[#6b6b7a] block mb-1">Start offset (s)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={scene.audioLayer.startOffset}
                          onChange={(e) =>
                            updateScene(scene.id, {
                              audioLayer: {
                                ...scene.audioLayer,
                                startOffset: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          onBlur={commitLayer}
                          className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                          style={{
                            backgroundColor: 'var(--color-input-bg)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text-primary)',
                          }}
                        />
                      </div>

                      {/* Fade toggles */}
                      <div className="flex gap-4">
                        {[
                          { key: 'fadeIn', label: 'Fade In' },
                          { key: 'fadeOut', label: 'Fade Out' },
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={scene.audioLayer[key as 'fadeIn' | 'fadeOut']}
                              onChange={(e) => {
                                updateScene(scene.id, {
                                  audioLayer: { ...scene.audioLayer, [key]: e.target.checked },
                                })
                                commitLayer()
                              }}
                              className="w-3 h-3 accent-[#e84545]"
                            />
                            <span className="text-[10px] text-[#6b6b7a]">{label}</span>
                          </label>
                        ))}
                      </div>

                      {/* SFX Sub-section */}
                      <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-[var(--color-text-primary)]">
                            Sound Effects
                          </span>
                          <span
                            onClick={() => setShowSFXSearch(!showSFXSearch)}
                            className="kbd h-6 px-2 flex items-center gap-1 text-[10px] cursor-pointer"
                          >
                            <Plus size={10} />
                            Add SFX
                          </span>
                        </div>
                        {showSFXSearch && (
                          <SFXSearchPopover
                            onSelect={(result, triggerAt) => {
                              const sfx: SFXTrack = {
                                id: result.id,
                                name: result.name,
                                provider: 'freesound' as const,
                                src: result.audioUrl,
                                triggerAt,
                                volume: 1,
                                duration: result.duration,
                              }
                              addSFXToScene(scene.id, sfx)
                              commitLayer()
                            }}
                            onClose={() => setShowSFXSearch(false)}
                          />
                        )}
                        {audio.sfx && audio.sfx.length > 0 && (
                          <div className="space-y-1">
                            {audio.sfx.map((sfx) => (
                              <div
                                key={sfx.id}
                                className="flex items-center gap-2 text-[10px]"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                <span className="flex-1 truncate">{sfx.name}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>@{sfx.triggerAt}s</span>
                                <span
                                  onClick={() => {
                                    removeSFXFromScene(scene.id, sfx.id)
                                    commitLayer()
                                  }}
                                  className="cursor-pointer hover:text-red-400"
                                >
                                  <X size={10} />
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Music Sub-section */}
                      <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-[var(--color-text-primary)]">Music</span>
                          {!audio.music && (
                            <span
                              onClick={() => setShowMusicSearch(!showMusicSearch)}
                              className="kbd h-6 px-2 flex items-center gap-1 text-[10px] cursor-pointer"
                            >
                              <Plus size={10} />
                              Add Music
                            </span>
                          )}
                        </div>
                        {showMusicSearch && !audio.music && (
                          <MusicSearchPopover
                            onSelect={(result) => {
                              const music: MusicTrack = {
                                name: result.name,
                                provider: 'pixabay-music' as const,
                                src: result.audioUrl,
                                volume: 0.5,
                                loop: true,
                                duckDuringTTS: true,
                                duckLevel: 0.15,
                              }
                              setSceneMusic(scene.id, music)
                              commitLayer()
                            }}
                            onClose={() => setShowMusicSearch(false)}
                          />
                        )}
                        {audio.music && (
                          <div className="space-y-2">
                            <div
                              className="flex items-center gap-2 text-[10px]"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              <span className="flex-1 truncate">{audio.music.name}</span>
                              <span
                                onClick={() => {
                                  setSceneMusic(scene.id, null)
                                  commitLayer()
                                }}
                                className="cursor-pointer hover:text-red-400"
                              >
                                <X size={10} />
                              </span>
                            </div>
                            {/* Music volume */}
                            <div className="flex items-center gap-2">
                              <Volume2 size={10} className="text-[#6b6b7a]" />
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={audio.music.volume}
                                onChange={(e) => {
                                  if (!audio.music) return
                                  setSceneMusic(scene.id, { ...audio.music, volume: parseFloat(e.target.value) })
                                  commitLayerDebounced()
                                }}
                                className="flex-1"
                              />
                              <span className="text-[9px] w-7" style={{ color: 'var(--color-text-muted)' }}>
                                {Math.round(audio.music.volume * 100)}%
                              </span>
                            </div>
                            {/* Loop toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={audio.music.loop}
                                onChange={(e) => {
                                  if (!audio.music) return
                                  setSceneMusic(scene.id, { ...audio.music, loop: e.target.checked })
                                  commitLayer()
                                }}
                                className="w-3 h-3 accent-[#e84545]"
                              />
                              <span className="text-[10px] text-[#6b6b7a]">Loop</span>
                            </label>
                            {/* Duck toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={audio.music.duckDuringTTS}
                                onChange={(e) => {
                                  if (!audio.music) return
                                  setSceneMusic(scene.id, { ...audio.music, duckDuringTTS: e.target.checked })
                                  commitLayer()
                                }}
                                className="w-3 h-3 accent-[#e84545]"
                              />
                              <span className="text-[10px] text-[#6b6b7a]">Duck during narration</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}
              </CollapsibleSection>
            </>
          )}

          {layersActiveTab === 'scene' && (
            <>
              {/* SVG Objects */}
              <CollapsibleSection
                title="SVG Objects"
                icon={Layers}
                badge={<span className="text-[10px] text-[#6b6b7a]">transparent stickers</span>}
                extraHeaderContent={
                  <button
                    onClick={() => addSvgObject(scene.id)}
                    className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]"
                  >
                    <Plus size={11} />
                    <span className="text-[10px]">Add</span>
                  </button>
                }
              >
                {(scene.svgObjects ?? []).length === 0 ? (
                  <div
                    className="text-[10px] text-[#6b6b7a] text-center py-3 border border-dashed rounded"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    No SVG objects
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(scene.svgObjects ?? []).map((obj, idx) => {
                      const isThisGenerating = isGenerating && generatingSceneId === scene.id
                      const prompt = objectPrompts[obj.id] ?? obj.prompt
                      return (
                        <div
                          key={obj.id}
                          className="border rounded p-2.5 space-y-2"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-[#6b6b7a] shrink-0">#{idx + 1}</span>
                            <input
                              type="text"
                              value={prompt}
                              onChange={(e) => setObjectPrompts((p) => ({ ...p, [obj.id]: e.target.value }))}
                              placeholder="Describe this object..."
                              className="flex-1 border rounded px-2 py-1 text-[10px] placeholder-[#6b6b7a] focus:outline-none focus:border-[#e84545] transition-colors"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                            <button
                              onClick={async () => {
                                if (!prompt.trim() || isThisGenerating) return
                                setObjectPrompts((p) => ({ ...p, [obj.id]: prompt }))
                                await generateSvgObject(scene.id, obj.id, prompt)
                              }}
                              disabled={!prompt.trim() || isThisGenerating}
                              className="kbd h-8 px-2 bg-[#e84545] border-[#e84545] shadow-[#800] text-white disabled:opacity-40 shrink-0"
                            >
                              <span className="text-[10px] uppercase tracking-wider">
                                {isThisGenerating ? '...' : obj.svgContent ? 'Regen' : 'Gen'}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                removeSvgObject(scene.id, obj.id)
                                saveSceneHTML(scene.id)
                              }}
                              className="text-[#6b6b7a] hover:text-[#e84545] transition-colors"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                              {/* X Position */}
                              <div>
                                <div className="flex justify-between items-end mb-1">
                                  <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">
                                    X Position
                                  </label>
                                  <span className="text-[9px] text-[var(--color-text-muted)] font-mono">
                                    {Math.round(obj.x)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Math.round(obj.x)}
                                  onChange={(e) => {
                                    updateSvgObject(scene.id, obj.id, { x: parseFloat(e.target.value) || 0 })
                                    commitLayerDebounced()
                                  }}
                                  className="w-full"
                                />
                              </div>

                              {/* Y Position */}
                              <div>
                                <div className="flex justify-between items-end mb-1">
                                  <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">
                                    Y Position
                                  </label>
                                  <span className="text-[9px] text-[var(--color-text-muted)] font-mono">
                                    {Math.round(obj.y)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Math.round(obj.y)}
                                  onChange={(e) => {
                                    updateSvgObject(scene.id, obj.id, { y: parseFloat(e.target.value) || 0 })
                                    commitLayerDebounced()
                                  }}
                                  className="w-full"
                                />
                              </div>

                              {/* Scale (Width) */}
                              <div>
                                <div className="flex justify-between items-end mb-1">
                                  <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">Scale</label>
                                  <span className="text-[9px] text-[var(--color-text-muted)] font-mono">
                                    {Math.round(obj.width)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={5}
                                  max={150}
                                  step={1}
                                  value={Math.round(obj.width)}
                                  onChange={(e) => {
                                    updateSvgObject(scene.id, obj.id, { width: parseFloat(e.target.value) || 50 })
                                    commitLayerDebounced()
                                  }}
                                  className="w-full"
                                />
                              </div>

                              {/* Opacity */}
                              <div>
                                <div className="flex justify-between items-end mb-1">
                                  <label className="text-[9px] text-[#6b6b7a] uppercase tracking-wider">Opacity</label>
                                  <span className="text-[9px] text-[var(--color-text-muted)] font-mono">
                                    {Math.round(obj.opacity * 100)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={obj.opacity}
                                  onChange={(e) => {
                                    updateSvgObject(scene.id, obj.id, { opacity: parseFloat(e.target.value) })
                                    commitLayerDebounced()
                                  }}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>

                          {obj.svgContent && (
                            <div className="text-[9px] text-[#6b6b7a]">
                              {obj.svgContent.length.toLocaleString()} chars generated
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CollapsibleSection>

              {/* Text Overlays */}
              <CollapsibleSection
                title="Text Overlays"
                icon={Type}
                extraHeaderContent={
                  <button
                    onClick={() => addTextOverlay(scene.id)}
                    className="kbd h-6 px-2 text-[#6b6b7a] hover:text-[#e84545]"
                  >
                    <Plus size={11} />
                    <span className="text-[10px]">Add</span>
                  </button>
                }
              >
                {scene.textOverlays.length === 0 ? (
                  <div
                    className="text-[10px] text-[#6b6b7a] text-center py-3 border border-dashed rounded"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    No text overlays
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scene.textOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className="border rounded p-2.5 space-y-2"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={overlay.content}
                            onChange={(e) => {
                              updateTextOverlay(scene.id, overlay.id, { content: e.target.value })
                              commitLayerDebounced()
                            }}
                            className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#e84545] transition-colors"
                            style={{
                              backgroundColor: 'var(--color-input-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                          <button
                            onClick={() => {
                              removeTextOverlay(scene.id, overlay.id)
                              commitLayer()
                            }}
                            className="text-[#6b6b7a] hover:text-[#e84545] transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">X%</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={overlay.x}
                              onChange={(e) => {
                                updateTextOverlay(scene.id, overlay.id, { x: parseFloat(e.target.value) || 0 })
                                commitLayerDebounced()
                              }}
                              className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Y%</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={overlay.y}
                              onChange={(e) => {
                                updateTextOverlay(scene.id, overlay.id, { y: parseFloat(e.target.value) || 0 })
                                commitLayerDebounced()
                              }}
                              className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Size</label>
                            <input
                              type="number"
                              min={10}
                              max={200}
                              value={overlay.size}
                              onChange={(e) => {
                                updateTextOverlay(scene.id, overlay.id, { size: parseInt(e.target.value) || 48 })
                                commitLayerDebounced()
                              }}
                              className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Color</label>
                            <input
                              type="color"
                              value={overlay.color}
                              onChange={(e) => {
                                updateTextOverlay(scene.id, overlay.id, { color: e.target.value })
                                commitLayerDebounced()
                              }}
                              className="w-full h-6 bg-transparent border border-[#2a2a32] rounded cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Delay (s)</label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={overlay.delay}
                              onChange={(e) => {
                                updateTextOverlay(scene.id, overlay.id, { delay: parseFloat(e.target.value) || 0 })
                                commitLayerDebounced()
                              }}
                              className="w-full border rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#6b6b7a] block mb-0.5">Animation</label>
                            <select
                              value={overlay.animation}
                              onChange={(e) => {
                                updateTextOverlay(scene.id, overlay.id, {
                                  animation: e.target.value as 'fade-in' | 'slide-up' | 'typewriter',
                                })
                                commitLayerDebounced()
                              }}
                              className="w-full border rounded px-1 py-0.5 text-[10px] focus:outline-none focus:border-[#e84545] transition-colors"
                              style={{
                                backgroundColor: 'var(--color-input-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              <option value="fade-in">Fade In</option>
                              <option value="slide-up">Slide Up</option>
                              <option value="typewriter">Typewriter</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Canvas motion templates"
                icon={LayoutTemplate}
                defaultOpen={false}
                badge={<span className="text-[10px] text-[#6b6b7a]">backgrounds</span>}
              >
                <CanvasMotionTemplatesPanel scene={scene} />
              </CollapsibleSection>

              {/* AI Generated Layers */}
              <CollapsibleSection title="AI Layers" icon={Sparkles}>
                <AILayersPanel scene={scene} />
              </CollapsibleSection>

              <CollapsibleSection
                title="Zdog Studio"
                icon={User}
                badge={
                  zdogStudioMode ? (
                    <span className="text-[10px] text-teal-400">active</span>
                  ) : (
                    <span className="text-[10px] text-[#6b6b7a]">shape builder</span>
                  )
                }
              >
                {zdogStudioMode ? (
                  <div className="space-y-2">
                    <ZdogOutliner projectId={project.id} />
                    <button
                      onClick={() => setZdogStudioMode(false)}
                      className="kbd h-7 px-3 text-[10px] text-[#6b6b7a] hover:text-[#e84545] w-full"
                    >
                      Exit Zdog Studio
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[#6b6b7a]">Build reusable Zdog shapes, characters, and items.</p>
                    <button
                      onClick={() => setZdogStudioMode(true)}
                      className="kbd h-7 px-3 text-[10px] text-[#6b6b7a] hover:text-teal-400 w-full"
                    >
                      Enter Zdog Studio
                    </button>
                  </div>
                )}
              </CollapsibleSection>
            </>
          )}

          {/* Scene Elements (registered from iframe) */}
          {layersActiveTab === 'elements' && Object.keys(inspectorElements).length > 0 && (
            <CollapsibleSection
              title="Scene Elements"
              icon={Box}
              badge={
                <span className="text-[10px] text-[#6b6b7a] ml-auto">
                  {Object.keys(inspectorElements).length} element
                  {Object.keys(inspectorElements).length !== 1 ? 's' : ''}
                </span>
              }
            >
              <div className="space-y-1">
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
                          className={`text-[11px] flex-1 truncate ${
                            isSelected
                              ? 'text-[var(--color-text-primary)] font-medium'
                              : 'text-[var(--color-text-primary)]'
                          }`}
                        >
                          {element.label || element.id}
                        </span>
                        <span className="text-[9px] font-mono text-[#4a4a52] bg-[#1a1a1f] px-1 py-0.5 rounded flex-shrink-0">
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
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )}

          {layersActiveTab === 'elements' && Object.keys(inspectorElements).length === 0 && (
            <p className="py-8 text-center text-[10px] text-[var(--color-text-muted)]">
              No elements listed yet. Click something in the preview to inspect it here.
            </p>
          )}

          {/* Interactions (only in interactive mode) */}
          {layersActiveTab === 'interact' && project.outputMode === 'interactive' && (
            <CollapsibleSection
              title="Interactions"
              icon={Layers}
              badge={
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#e84545]/20 text-[#e84545] font-bold">
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
            className="kbd h-7 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            style={{ borderColor: (TYPE_COLORS[type] ?? '#e84545') + '60', color: TYPE_COLORS[type] ?? '#e84545' }}
          >
            {TYPE_ICONS[type]} {label}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed rounded-lg border border-[var(--color-border)] px-3 py-2.5">
        Each interaction appears in the <strong>layer stack</strong> below. Expand ▸ to edit{' '}
        <strong>Text & labels</strong> in one place. <strong>Double-click</strong> the row for full properties (type,
        size, timing, style presets & sliders). Use <strong>+</strong> in the stack to add interactions.
      </p>
    </div>
  )
}

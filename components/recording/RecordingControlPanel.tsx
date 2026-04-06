'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Circle,
  Square,
  Pause,
  Play,
  RotateCcw,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  CameraOff,
  ChevronDown,
  Monitor,
  Video,
  Plus,
} from 'lucide-react'
import { useVideoStore } from '@/lib/store'
import { useScreenRecorder } from '@/hooks/useScreenRecorder'
import { useMicrophoneDevices } from '@/hooks/useMicrophoneDevices'
import { useCameraDevices } from '@/hooks/useCameraDevices'
import { useAudioLevelMeter } from '@/hooks/useAudioLevelMeter'
import {
  AudioLevelBars,
  RecordingTimer,
  ControlButton,
  DevicePicker,
  Divider,
} from './RecordingControls'

const log = (...args: any[]) => console.log('[RecordingControlPanel]', ...args)

/**
 * OBS-style recording control panel for the bottom tab.
 * 3 columns: Sources | Audio Mixer | Recording Controls
 */
export default function RecordingControlPanel() {
  const studioRecordStream = useVideoStore((s) => s.studioRecordStream)
  const setStudioRecordStream = useVideoStore((s) => s.setStudioRecordStream)
  const setStudioRecordMode = useVideoStore((s) => s.setStudioRecordMode)

  const [micEnabled, setMicEnabled] = useState(true)
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(true)
  const [webcamEnabled, setWebcamEnabled] = useState(false)
  const [showMicPicker, setShowMicPicker] = useState(false)
  const [showCamPicker, setShowCamPicker] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [streamStats, setStreamStats] = useState<{ width: number; height: number; fps: number } | null>(null)

  const mic = useMicrophoneDevices()
  const cam = useCameraDevices()

  // Log device enumeration results
  useEffect(() => {
    log(`Mic devices: ${mic.devices.length}`, mic.devices.map((d) => `${d.label} (${d.deviceId.slice(0, 8)})`))
    log(`Mic selected: ${mic.selectedId?.slice(0, 8) ?? 'none'}, loading: ${mic.isLoading}, error: ${mic.error}`)
  }, [mic.devices, mic.selectedId, mic.isLoading, mic.error])

  useEffect(() => {
    log(`Camera devices: ${cam.devices.length}`, cam.devices.map((d) => `${d.label} (${d.deviceId.slice(0, 8)})`))
    log(`Camera selected: ${cam.selectedId?.slice(0, 8) ?? 'none'}, loading: ${cam.isLoading}, error: ${cam.error}`)
  }, [cam.devices, cam.selectedId, cam.isLoading, cam.error])

  // Webcam preview
  const webcamPreviewRef = useRef<MediaStream | null>(null)

  const recorder = useScreenRecorder({
    micEnabled,
    micDeviceId: mic.selectedId,
    systemAudioEnabled,
    webcamEnabled,
    webcamDeviceId: cam.selectedId,
    preAcquiredStream: studioRecordStream,
  })

  // Log recorder state changes
  useEffect(() => {
    log(`Recorder state: ${recorder.state}, elapsed: ${recorder.elapsed}, error: ${recorder.error}`)
    if (recorder.warnings.length > 0) log('Recorder warnings:', recorder.warnings)
  }, [recorder.state, recorder.elapsed, recorder.error, recorder.warnings])

  const audioLevel = useAudioLevelMeter(recorder.micStream)

  // Read stream stats
  useEffect(() => {
    if (studioRecordStream) {
      const vt = studioRecordStream.getVideoTracks()[0]
      const settings = vt?.getSettings()
      if (settings) {
        const stats = {
          width: settings.width ?? 0,
          height: settings.height ?? 0,
          fps: Math.round(settings.frameRate ?? 0),
        }
        setStreamStats(stats)
        log(`Stream stats: ${stats.width}x${stats.height} @${stats.fps}fps`)
      }
    } else {
      setStreamStats(null)
      log('No studioRecordStream')
    }
  }, [studioRecordStream])

  // Clean up webcam on unmount
  useEffect(() => {
    return () => {
      webcamPreviewRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const exitStudio = useCallback(() => {
    log('exitStudio()')
    studioRecordStream?.getTracks().forEach((t) => t.stop())
    setStudioRecordStream(null)
    webcamPreviewRef.current?.getTracks().forEach((t) => t.stop())
    recorder.cancel()
    setStudioRecordMode(false)
  }, [studioRecordStream, setStudioRecordStream, setStudioRecordMode, recorder])

  const handleRecord = useCallback(async () => {
    log('handleRecord() — studioRecordStream:', !!studioRecordStream)
    if (!studioRecordStream) {
      log('No studioRecordStream — cannot start')
      return
    }
    log('Calling recorder.start()')
    await recorder.start()
    log('recorder.start() resolved, state:', recorder.state)
  }, [studioRecordStream, recorder])

  const handleStop = useCallback(async () => {
    log('handleStop()')
    const manifest = await recorder.stop()
    log('recorder.stop() resolved, manifest:', manifest ? 'received' : 'null')
    if (manifest) {
      const store = useVideoStore.getState()
      const sceneId = store.selectedSceneId || store.scenes[0]?.id
      log(`Attaching to scene: ${sceneId}, url: ${manifest.screenVideoUrl?.slice(0, 60)}`)
      if (sceneId) {
        store.updateScene(sceneId, {
          videoLayer: {
            src: manifest.screenVideoUrl,
            enabled: true,
            opacity: 1,
            trimStart: 0,
            trimEnd: null,
          },
        })
        try { await store.saveSceneHTML(sceneId) } catch {}
      }
    }
    studioRecordStream?.getTracks().forEach((t) => t.stop())
    setStudioRecordStream(null)
    webcamPreviewRef.current?.getTracks().forEach((t) => t.stop())
    setStudioRecordMode(false)
  }, [recorder, studioRecordStream, setStudioRecordStream, setStudioRecordMode])

  const handleAddSource = useCallback(async (type: 'screen' | 'mic' | 'webcam' | 'system-audio') => {
    log(`Add source: ${type}`)
    setShowAddSource(false)
    switch (type) {
      case 'screen': {
        log('Acquiring new screen source via getDisplayMedia...')
        try {
          let stream: MediaStream
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          } catch {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
          }
          log(`New screen source acquired: ${stream.getVideoTracks().length} video, ${stream.getAudioTracks().length} audio`)
          // Stop old stream
          studioRecordStream?.getTracks().forEach((t) => t.stop())
          setStudioRecordStream(stream)
        } catch (err: any) {
          log(`Screen source failed: ${err.name}: ${err.message}`)
        }
        break
      }
      case 'mic': {
        setMicEnabled(true)
        await mic.refresh()
        log('Mic enabled and refreshed')
        break
      }
      case 'webcam': {
        setWebcamEnabled(true)
        await cam.refresh()
        log('Webcam enabled and refreshed')
        break
      }
      case 'system-audio': {
        setSystemAudioEnabled(true)
        log('System audio enabled')
        break
      }
    }
  }, [studioRecordStream, setStudioRecordStream, mic, cam])

  const isIdle = recorder.state === 'idle'
  const isRecording = recorder.state === 'recording'
  const isPaused = recorder.state === 'paused'
  const isSaving = recorder.state === 'saving'
  const sourceName = recorder.sourceName || studioRecordStream?.getVideoTracks()[0]?.label || null

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#0e0e12' }}>
      {/* ── Left: Sources ────────────────────────────── */}
      <div
        className="flex flex-col gap-1 py-3 px-3 overflow-y-auto"
        style={{ width: 200, borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: '#4a4a55' }}>
            Sources
          </div>
          <div className="relative">
            <span
              onClick={() => setShowAddSource(!showAddSource)}
              className="flex items-center justify-center w-5 h-5 rounded cursor-pointer transition-colors"
              style={{ color: '#6b6b7a', background: 'rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              title="Add Source"
            >
              <Plus size={12} />
            </span>
            {showAddSource && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-md py-1 shadow-xl"
                style={{ background: '#1a1a22', border: '1px solid rgba(255,255,255,0.08)', minWidth: 160 }}
              >
                <AddSourceItem icon={<Monitor size={12} />} label="Screen Capture" onClick={() => handleAddSource('screen')} />
                <AddSourceItem icon={<Mic size={12} />} label="Microphone" onClick={() => handleAddSource('mic')} />
                <AddSourceItem icon={<Camera size={12} />} label="Webcam" onClick={() => handleAddSource('webcam')} />
                <AddSourceItem icon={<Volume2 size={12} />} label="System Audio" onClick={() => handleAddSource('system-audio')} />
              </div>
            )}
          </div>
        </div>

        {/* Screen source */}
        <SourceRow
          icon={<Monitor size={13} />}
          label={sourceName || 'Screen Capture'}
          active={!!studioRecordStream}
          statusColor={studioRecordStream ? '#52e087' : '#e05252'}
        />

        {/* Mic source */}
        <div className="relative">
          <SourceRow
            icon={micEnabled ? <Mic size={13} /> : <MicOff size={13} />}
            label={mic.devices.find((d) => d.deviceId === mic.selectedId)?.label || 'Microphone'}
            active={micEnabled}
            onClick={() => { setMicEnabled(!micEnabled); log(`Mic toggled: ${!micEnabled}`) }}
            onChevron={mic.devices.length > 1 ? () => setShowMicPicker(!showMicPicker) : undefined}
          />
          {showMicPicker && (
            <DevicePicker
              devices={mic.devices.map((d) => ({ id: d.deviceId, label: d.label }))}
              selectedId={mic.selectedId}
              onSelect={(id) => { mic.setSelectedId(id); setShowMicPicker(false); log(`Mic selected: ${id.slice(0, 8)}`) }}
              onClose={() => setShowMicPicker(false)}
            />
          )}
        </div>

        {/* Webcam source */}
        <div className="relative">
          <SourceRow
            icon={webcamEnabled ? <Camera size={13} /> : <CameraOff size={13} />}
            label={cam.devices.find((d) => d.deviceId === cam.selectedId)?.label || 'Camera'}
            active={webcamEnabled}
            onClick={() => { setWebcamEnabled(!webcamEnabled); log(`Webcam toggled: ${!webcamEnabled}`) }}
            onChevron={cam.devices.length > 1 ? () => setShowCamPicker(!showCamPicker) : undefined}
          />
          {showCamPicker && (
            <DevicePicker
              devices={cam.devices.map((d) => ({ id: d.deviceId, label: d.label }))}
              selectedId={cam.selectedId}
              onSelect={(id) => { cam.setSelectedId(id); setShowCamPicker(false); log(`Camera selected: ${id.slice(0, 8)}`) }}
              onClose={() => setShowCamPicker(false)}
            />
          )}
        </div>

        {/* System audio source */}
        <SourceRow
          icon={systemAudioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          label="System Audio"
          active={systemAudioEnabled}
          onClick={() => { setSystemAudioEnabled(!systemAudioEnabled); log(`System audio toggled: ${!systemAudioEnabled}`) }}
        />
      </div>

      {/* ── Center: Audio Mixer ──────────────────────── */}
      <div
        className="flex-1 flex flex-col gap-2 py-3 px-4 overflow-y-auto"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="text-[10px] font-medium uppercase tracking-widest mb-1" style={{ color: '#4a4a55' }}>
          Audio Mixer
        </div>

        {/* Mic level */}
        <MixerStrip
          icon={micEnabled ? <Mic size={12} /> : <MicOff size={12} />}
          label={mic.devices.find((d) => d.deviceId === mic.selectedId)?.label || 'Mic'}
          level={micEnabled ? audioLevel : 0}
          muted={!micEnabled}
          onMute={() => setMicEnabled(!micEnabled)}
        />

        {/* System audio level */}
        <MixerStrip
          icon={systemAudioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          label="System"
          level={0} // System audio level not separately metered
          muted={!systemAudioEnabled}
          onMute={() => setSystemAudioEnabled(!systemAudioEnabled)}
        />
      </div>

      {/* ── Right: Recording Controls ────────────────── */}
      <div className="flex flex-col items-center justify-center gap-3 py-3 px-5" style={{ width: 200 }}>
        {/* Record / Stop / Pause */}
        {isIdle ? (
          <span
            onClick={handleRecord}
            title="Start Recording"
            className="flex items-center justify-center w-12 h-12 rounded-full cursor-pointer transition-all"
            style={{
              background: studioRecordStream ? 'rgba(224,82,82,0.2)' : 'rgba(255,255,255,0.04)',
              color: studioRecordStream ? '#e05252' : '#4a4a55',
            }}
            onMouseEnter={(e) => { if (studioRecordStream) e.currentTarget.style.background = 'rgba(224,82,82,0.35)' }}
            onMouseLeave={(e) => { if (studioRecordStream) e.currentTarget.style.background = 'rgba(224,82,82,0.2)' }}
          >
            <Circle size={22} fill="currentColor" stroke="none" />
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <ControlButton onClick={handleStop} title="Stop" variant="stop" size="lg">
              <Square size={16} fill="currentColor" />
            </ControlButton>
            <ControlButton
              onClick={isPaused ? recorder.resume : recorder.pause}
              title={isPaused ? 'Resume' : 'Pause'}
              size="lg"
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </ControlButton>
            <ControlButton onClick={recorder.restart} title="Restart" size="lg">
              <RotateCcw size={14} />
            </ControlButton>
          </div>
        )}

        <RecordingTimer
          elapsed={recorder.elapsed}
          isRecording={isRecording}
          isPaused={isPaused}
          isSaving={isSaving}
        />

        {/* Status */}
        <div className="flex flex-col items-center gap-1" style={{ fontSize: 10, color: '#4a4a55' }}>
          {isRecording && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#e05252' }} />
              Recording
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#e0a852' }} />
              Paused
            </span>
          )}
          {isIdle && studioRecordStream && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#52e087' }} />
              Ready
            </span>
          )}
          {isIdle && !studioRecordStream && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#e05252' }} />
              No screen source
            </span>
          )}
          {streamStats && (
            <span>{streamStats.width}×{streamStats.height} @ {streamStats.fps}fps</span>
          )}
        </div>

        {/* Exit button */}
        <span
          onClick={exitStudio}
          title="Exit Recording Studio"
          className="text-[10px] px-3 py-1 rounded cursor-pointer transition-colors"
          style={{ color: '#6b6b7a', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#c0bdb0' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#6b6b7a' }}
        >
          Exit Studio
        </span>

        {recorder.error && (
          <span className="text-[10px] text-center" style={{ color: '#e05252' }}>{recorder.error}</span>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────

function AddSourceItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
      style={{ color: '#c0bdb0' }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-[11px]">{label}</span>
    </div>
  )
}

function SourceRow({
  icon,
  label,
  active,
  statusColor,
  onClick,
  onChevron,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  statusColor?: string
  onClick?: () => void
  onChevron?: () => void
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: active ? '#c0bdb0' : '#4a4a55',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(255,255,255,0.04)' : 'transparent' }}
    >
      {statusColor && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
      )}
      <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.5 }}>{icon}</span>
      <span className="text-[11px] truncate flex-1">{label}</span>
      {onChevron && (
        <span
          className="flex-shrink-0 cursor-pointer p-0.5"
          style={{ color: '#6b6b7a' }}
          onClick={(e) => { e.stopPropagation(); onChevron() }}
        >
          <ChevronDown size={10} />
        </span>
      )}
    </div>
  )
}

function MixerStrip({
  icon,
  label,
  level,
  muted,
  onMute,
}: {
  icon: React.ReactNode
  label: string
  level: number
  muted: boolean
  onMute: () => void
}) {
  // Visual level bar width (0-100%)
  const barPct = Math.min(100, Math.round(level * 100))

  return (
    <div className="flex items-center gap-2">
      <span
        onClick={onMute}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors"
        style={{
          color: muted ? '#4a4a55' : '#c0bdb0',
          background: 'rgba(255,255,255,0.04)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      >
        {icon}
      </span>
      <span className="text-[10px] w-12 truncate" style={{ color: muted ? '#4a4a55' : '#8a8a95' }}>
        {label}
      </span>
      {/* Level meter bar */}
      <div
        className="flex-1 h-2.5 rounded-sm overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div
          className="h-full rounded-sm transition-all"
          style={{
            width: `${barPct}%`,
            background: muted
              ? '#2a2a30'
              : barPct > 80
                ? '#e05252'
                : barPct > 60
                  ? '#e0a852'
                  : '#52e087',
            transition: 'width 50ms linear',
          }}
        />
      </div>
      <AudioLevelBars level={muted ? 0 : level} />
    </div>
  )
}

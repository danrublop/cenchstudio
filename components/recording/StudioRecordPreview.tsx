'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Monitor } from 'lucide-react'
import { useVideoStore } from '@/lib/store'

const log = (...args: any[]) => console.log('[StudioRecordPreview]', ...args)
const warn = (...args: any[]) => console.warn('[StudioRecordPreview]', ...args)

/**
 * Video-only live preview for studio record mode.
 * Acquires the getDisplayMedia stream on mount and renders it.
 * Recording controls live in RecordingControlPanel (bottom tab).
 */
export default function StudioRecordPreview() {
  const setStudioRecordMode = useVideoStore((s) => s.setStudioRecordMode)
  const setStudioRecordStream = useVideoStore((s) => s.setStudioRecordStream)
  const studioRecordStream = useVideoStore((s) => s.studioRecordStream)
  const recordingState = useVideoStore((s) => s.recordingState)

  const [streamError, setStreamError] = useState<string | null>(null)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const cancelledRef = useRef(false)

  const addLog = useCallback((msg: string) => {
    log(msg)
    setDebugLog((prev) => [...prev.slice(-19), `${new Date().toISOString().slice(11, 23)} ${msg}`])
  }, [])

  const acquireStream = useCallback(async () => {
    setStreamError(null)
    addLog('acquireStream() called')

    // Check API availability
    if (!navigator.mediaDevices) {
      const msg = 'navigator.mediaDevices is undefined'
      addLog(`FATAL: ${msg}`)
      setStreamError(msg)
      return
    }
    if (!navigator.mediaDevices.getDisplayMedia) {
      const msg = 'getDisplayMedia is not available'
      addLog(`FATAL: ${msg}`)
      setStreamError(msg)
      return
    }

    addLog(`isElectron=${!!window.electronAPI}, isSecureContext=${window.isSecureContext}`)

    // Attempt 1: video + audio
    try {
      addLog('Attempt 1: getDisplayMedia({ video: true, audio: true })')
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      addLog(`Attempt 1 SUCCESS — tracks: video=${stream.getVideoTracks().length} audio=${stream.getAudioTracks().length}`)
      return onStreamAcquired(stream)
    } catch (err: any) {
      addLog(`Attempt 1 FAILED: ${err.name}: ${err.message}`)
    }

    // Attempt 2: video only
    try {
      addLog('Attempt 2: getDisplayMedia({ video: true })')
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      addLog(`Attempt 2 SUCCESS — tracks: video=${stream.getVideoTracks().length} audio=${stream.getAudioTracks().length}`)
      return onStreamAcquired(stream)
    } catch (err: any) {
      addLog(`Attempt 2 FAILED: ${err.name}: ${err.message}`)
    }

    // Attempt 3: minimal constraints
    try {
      addLog('Attempt 3: getDisplayMedia({ video: { displaySurface: "monitor" } })')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as any,
      })
      addLog(`Attempt 3 SUCCESS — tracks: video=${stream.getVideoTracks().length} audio=${stream.getAudioTracks().length}`)
      return onStreamAcquired(stream)
    } catch (err: any) {
      addLog(`Attempt 3 FAILED: ${err.name}: ${err.message}`)
    }

    // All attempts failed
    addLog('ALL ATTEMPTS FAILED')
    setStreamError('Screen capture not available. Check console for details.')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStudioRecordStream])

  const onStreamAcquired = useCallback((stream: MediaStream) => {
    const vt = stream.getVideoTracks()[0]
    if (vt) {
      const settings = vt.getSettings()
      addLog(`Stream settings: ${settings.width}x${settings.height} @${settings.frameRate}fps label="${vt.label}"`)
      try { vt.applyConstraints({ frameRate: { ideal: 60, max: 60 } }) } catch {}
    }
    if (cancelledRef.current) {
      addLog('Cancelled — stopping tracks')
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    setStudioRecordStream(stream)

    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      addLog('Video track ended event fired')
      setStudioRecordStream(null)
      setStreamError('Screen share ended. Click Retry to reconnect.')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStudioRecordStream])

  // Acquire display stream on mount
  useEffect(() => {
    if (studioRecordStream) {
      log('Already have stream, skipping acquire')
      return
    }
    cancelledRef.current = false
    acquireStream()
    return () => { cancelledRef.current = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wire stream to video element
  useEffect(() => {
    if (videoRef.current && studioRecordStream) {
      videoRef.current.srcObject = studioRecordStream
    }
  }, [studioRecordStream])

  const isRecording = recordingState === 'recording'

  return (
    <div className="w-full h-full flex items-center justify-center relative" style={{ background: '#0b0b0f' }}>
      {studioRecordStream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="max-w-full max-h-full object-contain"
          style={{ borderRadius: 4 }}
        />
      ) : streamError ? (
        <div className="flex flex-col items-center gap-3" style={{ color: '#6b6b7a' }}>
          <Monitor size={48} />
          <span className="text-sm text-center max-w-sm">{streamError}</span>
          <span
            className="text-xs px-3 py-1.5 rounded-md cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#c0bdb0' }}
            onClick={acquireStream}
          >
            Retry
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3" style={{ color: '#6b6b7a' }}>
          <Monitor size={48} className="animate-pulse" />
          <span className="text-sm">Waiting for screen share...</span>
        </div>
      )}

      {/* Recording indicator badge */}
      {isRecording && (
        <div
          className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{ background: 'rgba(224,82,82,0.2)', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#e05252' }} />
          <span className="text-xs font-medium" style={{ color: '#e05252' }}>REC</span>
        </div>
      )}

      {/* Debug log overlay */}
      {debugLog.length > 0 && (
        <div
          className="absolute bottom-2 left-2 right-2 max-h-48 overflow-y-auto rounded-md p-2"
          style={{ background: 'rgba(0,0,0,0.85)', fontSize: 10, fontFamily: 'monospace', color: '#8f8' }}
        >
          {debugLog.map((line, i) => (
            <div key={i} style={{ color: line.includes('FAILED') || line.includes('FATAL') ? '#f88' : line.includes('SUCCESS') ? '#8f8' : '#aaa' }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

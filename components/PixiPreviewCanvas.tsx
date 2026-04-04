'use client'

/**
 * Continuous Pixi-based preview canvas.
 *
 * Renders the full timeline on a single canvas using the Pixi compositor.
 * Used in Electron mode as an alternative to the iframe-per-scene preview.
 *
 * Props:
 * - scenes: ordered Scene[] from the store
 * - selectedSceneId: currently selected scene
 * - globalStyle: project global style
 * - isPlaying / onPlayingChange: playback state
 * - currentTime / onTimeUpdate: global timeline time
 * - onSceneChange: called when compositor switches scenes
 */

import { useEffect, useRef, useCallback } from 'react'
import { PixiPreview, type PreviewScene } from '@/lib/compositor/pixi-preview'
import type { SceneCompositorConfig } from '@/lib/compositor/types'
import type { Scene, GlobalStyle, Timeline } from '@/lib/types'
import { useVideoStore } from '@/lib/store'

interface Props {
  scenes: Scene[]
  globalStyle: GlobalStyle
  timeline?: Timeline | null
  width?: number
  height?: number
  isPlaying: boolean
  onPlayingChange: (playing: boolean) => void
  currentTime: number
  onTimeUpdate: (globalTime: number) => void
  onSceneChange?: (sceneIndex: number) => void
  onEnded?: () => void
}

function sceneToConfig(scene: Scene): SceneCompositorConfig {
  return {
    sceneId: scene.id,
    width: 1920,
    height: 1080,
    durationSeconds: scene.duration,
    sceneType: scene.sceneType,
    svgContent: scene.svgContent,
    sceneHTML: scene.sceneHTML,
    bgColor: scene.bgColor || '#000000',
    textOverlays: scene.textOverlays as any,
    svgObjects: scene.svgObjects as any,
    aiLayers: scene.aiLayers as any,
    layerHiddenIds: scene.layerHiddenIds ?? [],
    layerPanelOrder: scene.layerPanelOrder ?? [],
    cameraMotion: scene.cameraMotion as any,
  }
}

function buildPreviewScenes(scenes: Scene[]): PreviewScene[] {
  let acc = 0
  return scenes.map((s) => {
    const ps: PreviewScene = {
      config: sceneToConfig(s),
      startTime: acc,
      endTime: acc + s.duration,
    }
    acc += s.duration
    return ps
  })
}

export default function PixiPreviewCanvas({
  scenes,
  globalStyle,
  timeline,
  width = 1920,
  height = 1080,
  isPlaying,
  onPlayingChange,
  currentTime,
  onTimeUpdate,
  onSceneChange,
  onEnded,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<PixiPreview | null>(null)
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes

  // Initialize Pixi preview
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const previewScenes = buildPreviewScenes(scenes)
    const preview = new PixiPreview({
      canvas,
      width,
      height,
      scenes: previewScenes,
      onTimeUpdate,
      onSceneChange,
      onEnded: () => {
        onPlayingChange(false)
        onEnded?.()
      },
    })

    previewRef.current = preview
    preview.init().catch(console.error)

    return () => {
      preview.dispose()
      previewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Init once — scenes update via updateScenes

  // Update scenes when they change
  useEffect(() => {
    if (!previewRef.current) return
    const previewScenes = buildPreviewScenes(scenes)
    previewRef.current.updateScenes(previewScenes)
  }, [scenes])

  // Pass timeline for multi-track clip compositing
  useEffect(() => {
    if (!previewRef.current) return
    previewRef.current.setTimeline(timeline ?? null)
  }, [timeline])

  // Sync play/pause
  useEffect(() => {
    if (!previewRef.current) return
    if (isPlaying) {
      previewRef.current.play()
    } else {
      previewRef.current.pause()
    }
  }, [isPlaying])

  // Seek from external source (timeline scrub, etc.)
  const lastExternalSeek = useRef(currentTime)
  useEffect(() => {
    if (!previewRef.current) return
    // Only seek if time changed externally (not from our own onTimeUpdate)
    if (Math.abs(currentTime - lastExternalSeek.current) > 0.05) {
      lastExternalSeek.current = currentTime
      previewRef.current.seek(currentTime)
    }
  }, [currentTime])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
      }}
    />
  )
}

/**
 * Continuous timeline preview using the Pixi compositor.
 *
 * Renders scenes sequentially on a single canvas using the same
 * compositor core that the export engine uses. Supports:
 * - Play / pause / seek across the full timeline
 * - Scene iframe bridge for generated content (canvas2d, d3, three, motion, zdog)
 * - SVG content, text overlays, AI layers, camera motion
 * - Automatic scene transitions
 *
 * This is the Electron-path preview engine. The web version
 * continues to use the iframe-per-scene approach.
 */

import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { SceneCompositorConfig, TextOverlayConfig, AiLayerConfig, SvgObjectConfig } from './types'
import type { Clip, Track, Timeline } from '../types'
import { VideoPool } from './video-pool'
import { evaluateKeyframes, evaluateAllKeyframes, remapTime } from './interpolate'
import { createPixiFilters, resolveBlendMode } from './filters'
import {
  parseHexColor,
  createSceneBridge,
  getCameraState,
  applyAiLayerAnimation,
  applyTextAnimation,
  type SceneBridge,
} from './pixi-compositor'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PreviewScene {
  config: SceneCompositorConfig
  startTime: number // absolute start in timeline (seconds)
  endTime: number // absolute end in timeline (seconds)
}

export interface PixiPreviewOptions {
  canvas: HTMLCanvasElement
  width: number
  height: number
  scenes: PreviewScene[]
  onTimeUpdate?: (globalTime: number) => void
  onSceneChange?: (sceneIndex: number) => void
  onEnded?: () => void
}

/** Active video clip being composited from the timeline */
interface ActiveVideoClip {
  clip: Clip
  sprite: Sprite
  texture: Texture
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

interface LoadedScene {
  index: number
  config: SceneCompositorConfig
  bridge: SceneBridge | null
  bridgeSprite: Sprite | null
  bridgeTexture: Texture | null
  svgSprite: Sprite | null
  textSprites: Array<{ overlay: TextOverlayConfig; sprite: Text; fullContent: string }>
  svgSprites: Array<{ object: SvgObjectConfig; sprite: Sprite }>
  aiSprites: Array<{ layer: AiLayerConfig; sprite: Sprite; baseX: number; baseY: number }>
}

// ── Preview Engine ───────────────────────────────────────────────────────────

export class PixiPreview {
  private app: Application | null = null
  private root: Container | null = null
  private cameraContainer: Container | null = null
  private bg: Graphics | null = null
  private scenes: PreviewScene[]
  private loadedScene: LoadedScene | null = null
  private currentSceneIndex = -1
  private globalTime = 0
  private playing = false
  private lastFrameTime = 0
  private rafId: number | null = null
  private opts: PixiPreviewOptions
  private disposed = false

  // Multi-video compositing
  private videoPool = new VideoPool()
  private activeVideoClips: ActiveVideoClip[] = []
  private timeline: Timeline | null = null

  constructor(opts: PixiPreviewOptions) {
    this.opts = opts
    this.scenes = opts.scenes
  }

  /**
   * Set the NLE timeline for clip-aware rendering.
   * When set, video/image clips from tracks are composited
   * alongside scene content.
   */
  setTimeline(timeline: Timeline | null): void {
    this.timeline = timeline
  }

  async init(): Promise<void> {
    this.app = new Application()
    await this.app.init({
      canvas: this.opts.canvas,
      width: this.opts.width,
      height: this.opts.height,
      backgroundAlpha: 1,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })

    this.root = new Container()
    this.cameraContainer = new Container()
    this.cameraContainer.sortableChildren = true
    this.app.stage.addChild(this.root)
    this.root.addChild(this.cameraContainer)

    this.bg = new Graphics()
    this.bg.rect(0, 0, this.opts.width, this.opts.height)
    this.bg.fill(0x000000)
    this.root.addChildAt(this.bg, 0)

    // Load first scene
    if (this.scenes.length > 0) {
      await this.loadScene(0)
      this.renderFrame(0)
    }
  }

  // ── Playback control ─────────────────────────────────────────────────────

  play(): void {
    if (this.playing || this.disposed) return
    this.playing = true
    this.lastFrameTime = performance.now()
    this.tick()
  }

  pause(): void {
    this.playing = false
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  async seek(globalTime: number): Promise<void> {
    this.globalTime = Math.max(0, globalTime)
    const sceneIdx = this.findSceneAt(this.globalTime)
    if (sceneIdx !== this.currentSceneIndex && sceneIdx >= 0) {
      await this.loadScene(sceneIdx)
    }
    this.renderFrame(this.globalTime)
    this.opts.onTimeUpdate?.(this.globalTime)
  }

  isPlaying(): boolean {
    return this.playing
  }
  getCurrentTime(): number {
    return this.globalTime
  }

  getTotalDuration(): number {
    if (this.scenes.length === 0) return 0
    const last = this.scenes[this.scenes.length - 1]
    return last.endTime
  }

  // ── Scene management ─────────────────────────────────────────────────────

  updateScenes(scenes: PreviewScene[]): void {
    this.scenes = scenes
  }

  private findSceneAt(t: number): number {
    for (let i = 0; i < this.scenes.length; i++) {
      if (t >= this.scenes[i].startTime && t < this.scenes[i].endTime) return i
    }
    // Past end — return last scene
    if (this.scenes.length > 0 && t >= this.scenes[this.scenes.length - 1].endTime) {
      return this.scenes.length - 1
    }
    return 0
  }

  private async loadScene(index: number): Promise<void> {
    if (index === this.currentSceneIndex) return
    if (index < 0 || index >= this.scenes.length) return

    // Tear down previous scene layers
    this.teardownLoadedScene()

    const scene = this.scenes[index]
    const config = scene.config
    this.currentSceneIndex = index
    this.opts.onSceneChange?.(index)

    if (!this.cameraContainer || !this.root || !this.bg) return

    // Update background
    this.bg.clear()
    this.bg.rect(0, 0, this.opts.width, this.opts.height)
    this.bg.fill(parseHexColor(config.bgColor))

    const loaded: LoadedScene = {
      index,
      config,
      bridge: null,
      bridgeSprite: null,
      bridgeTexture: null,
      svgSprite: null,
      textSprites: [],
      svgSprites: [],
      aiSprites: [],
    }

    // Scene bridge (iframe-based capture for generated scenes)
    try {
      const result = await createSceneBridge(config, this.cameraContainer)
      loaded.bridge = result.bridge
      loaded.bridgeSprite = result.sprite
      loaded.bridgeTexture = result.texture
    } catch {
      // Bridge failed — scene may not have HTML content
    }

    // SVG content (static SVG scenes)
    if ((config.sceneType === 'svg' || !config.sceneType) && config.svgContent) {
      try {
        const tx = await this.loadTextureFromSvg(config.svgContent)
        if (tx) {
          const sp = new Sprite(tx)
          sp.x = 0
          sp.y = 0
          sp.width = this.opts.width
          sp.height = this.opts.height
          sp.alpha = 1
          sp.zIndex = 10
          this.cameraContainer.addChild(sp)
          loaded.svgSprite = sp
        }
      } catch {}
    }

    // Text overlays
    const hiddenIds = new Set(config.layerHiddenIds ?? [])
    if (config.textOverlays?.length) {
      for (const ov of config.textOverlays) {
        if (hiddenIds.has(ov.id)) continue
        const sp = new Text({
          text: ov.content || '',
          style: {
            fontFamily: ov.font || 'Inter, sans-serif',
            fontSize: Math.max(8, Number(ov.size || 32)),
            fill: ov.color || '#ffffff',
            wordWrap: true,
            wordWrapWidth: this.opts.width * 0.8,
          },
        })
        sp.x = (Math.max(0, Number(ov.x || 0)) / 100) * this.opts.width
        sp.y = (Math.max(0, Number(ov.y || 0)) / 100) * this.opts.height
        sp.alpha = 0
        sp.zIndex = 50
        this.cameraContainer.addChild(sp)
        loaded.textSprites.push({ overlay: ov, sprite: sp, fullContent: ov.content || '' })
      }
    }

    // SVG objects
    if (config.svgObjects?.length) {
      for (const obj of config.svgObjects) {
        if (hiddenIds.has(obj.id)) continue
        try {
          const tx = await this.loadTextureFromSvg(obj.svgContent || '')
          if (!tx) continue
          const sp = new Sprite(tx)
          const widthPx = (Math.max(0, Number(obj.width || 0)) / 100) * this.opts.width
          const ratio = tx.width > 0 ? tx.height / tx.width : 1
          sp.width = Math.max(1, widthPx)
          sp.height = Math.max(1, widthPx * ratio)
          sp.x = (Math.max(0, Number(obj.x || 0)) / 100) * this.opts.width
          sp.y = (Math.max(0, Number(obj.y || 0)) / 100) * this.opts.height
          sp.alpha = Math.max(0, Math.min(1, Number(obj.opacity ?? 1)))
          sp.zIndex = Number(obj.zIndex ?? 4)
          this.cameraContainer.addChild(sp)
          loaded.svgSprites.push({ object: obj, sprite: sp })
        } catch {}
      }
    }

    // AI layers (static images/stickers only for now — video layers need decode pipeline)
    if (config.aiLayers?.length) {
      for (const layer of config.aiLayers) {
        if (hiddenIds.has(layer.id)) continue
        const isStatic = layer.type === 'image' || layer.type === 'sticker'
        if (!isStatic) continue
        const src = layer.type === 'sticker' ? (layer.stickerUrl ?? layer.imageUrl) : layer.imageUrl
        if (!src) continue
        try {
          const tx = await this.loadTextureFromUrl(src)
          if (!tx) continue
          const sp = new Sprite(tx)
          sp.anchor.set(0.5, 0.5)
          sp.width = Math.max(1, Number(layer.width || 1))
          sp.height = Math.max(1, Number(layer.height || 1))
          const baseX = Number(layer.x || 0)
          const baseY = Number(layer.y || 0)
          sp.position.set(baseX, baseY)
          sp.alpha = Math.max(0, Math.min(1, Number(layer.opacity ?? 1)))
          sp.rotation = (Number(layer.rotation || 0) * Math.PI) / 180
          sp.zIndex = Number(layer.zIndex ?? 4)
          this.cameraContainer.addChild(sp)
          loaded.aiSprites.push({ layer, sprite: sp, baseX, baseY })
        } catch {}
      }
    }

    this.loadedScene = loaded
  }

  private teardownLoadedScene(): void {
    if (!this.loadedScene || !this.cameraContainer) return
    const ls = this.loadedScene

    ls.bridge?.dispose()
    if (ls.bridgeSprite) {
      this.cameraContainer.removeChild(ls.bridgeSprite)
      ls.bridgeSprite.destroy()
    }
    if (ls.svgSprite) {
      this.cameraContainer.removeChild(ls.svgSprite)
      ls.svgSprite.destroy()
    }
    for (const { sprite } of ls.textSprites) {
      this.cameraContainer.removeChild(sprite)
      sprite.destroy()
    }
    for (const { sprite } of ls.svgSprites) {
      this.cameraContainer.removeChild(sprite)
      sprite.destroy()
    }
    for (const { sprite } of ls.aiSprites) {
      this.cameraContainer.removeChild(sprite)
      sprite.destroy()
    }

    this.loadedScene = null
  }

  // ── Render loop ──────────────────────────────────────────────────────────

  private tick = () => {
    if (!this.playing || this.disposed) return

    const now = performance.now()
    const dt = (now - this.lastFrameTime) / 1000
    this.lastFrameTime = now
    this.globalTime += dt

    const totalDur = this.getTotalDuration()
    if (this.globalTime >= totalDur) {
      this.globalTime = totalDur
      this.playing = false
      this.renderFrame(this.globalTime)
      this.opts.onTimeUpdate?.(this.globalTime)
      this.opts.onEnded?.()
      return
    }

    // Check if we need to switch scenes
    const sceneIdx = this.findSceneAt(this.globalTime)
    if (sceneIdx !== this.currentSceneIndex) {
      // Load new scene (async, but we don't await — skip frame if needed)
      this.loadScene(sceneIdx).then(() => {
        if (this.playing) this.renderFrame(this.globalTime)
      })
    } else {
      this.renderFrame(this.globalTime)
    }

    this.opts.onTimeUpdate?.(this.globalTime)
    this.rafId = requestAnimationFrame(this.tick)
  }

  private renderFrame(globalTime: number): void {
    if (!this.app || !this.cameraContainer) return

    // ── Timeline clip rendering (multi-track video/image compositing) ──
    if (this.timeline) {
      this.renderTimelineClips(globalTime)
    }

    // ── Scene-based rendering (existing per-scene content) ──
    if (this.loadedScene) {
      const scene = this.scenes[this.currentSceneIndex]
      if (scene) {
        const localTime = globalTime - scene.startTime
        const config = scene.config
        const ls = this.loadedScene

        // Scene bridge (iframe-based content)
        if (ls.bridge) {
          ls.bridge.seekAndCopy(localTime).catch(() => {})
        }

        // Camera motion
        const cam = getCameraState(localTime, config.cameraMotion ?? [], this.opts.width, this.opts.height)
        this.cameraContainer.scale.set(cam.scale, cam.scale)
        this.cameraContainer.position.set(cam.x, cam.y)

        // Text overlay animation
        for (const { overlay, sprite, fullContent } of ls.textSprites) {
          applyTextAnimation(sprite, overlay, localTime, fullContent)
        }

        // AI layer animation
        for (const { layer, sprite, baseX, baseY } of ls.aiSprites) {
          applyAiLayerAnimation(sprite, layer, localTime, baseX, baseY)
        }
      }
    }

    // Render
    this.app.renderer.render(this.app.stage)
  }

  // ── Multi-track video clip compositing ─────────────────────────────────

  /**
   * Find all video/image clips active at the given global time,
   * decode their frames, and composite them onto the stage.
   */
  private renderTimelineClips(globalTime: number): void {
    if (!this.timeline || !this.cameraContainer) return

    // Collect all active clips across all tracks (sorted by track position)
    const sortedTracks = [...this.timeline.tracks].sort((a, b) => a.position - b.position)
    const activeClips: { clip: Clip; track: Track; trackZBase: number }[] = []

    for (let ti = 0; ti < sortedTracks.length; ti++) {
      const track = sortedTracks[ti]
      if (track.muted) continue
      for (const clip of track.clips) {
        const clipEnd = clip.startTime + clip.duration
        if (globalTime >= clip.startTime && globalTime < clipEnd) {
          activeClips.push({ clip, track, trackZBase: (ti + 1) * 100 })
        }
      }
    }

    // Remove sprites for clips that are no longer active
    const activeClipIds = new Set(activeClips.map((a) => a.clip.id))
    this.activeVideoClips = this.activeVideoClips.filter((avc) => {
      if (activeClipIds.has(avc.clip.id)) return true
      // Remove from stage
      try {
        this.cameraContainer!.removeChild(avc.sprite)
      } catch {}
      avc.sprite.destroy()
      return false
    })

    // Update or create sprites for each active clip
    for (const { clip, trackZBase } of activeClips) {
      const clipLocalTime = globalTime - clip.startTime
      // Compute source time with speed ramp support
      const sourceTime = remapTime(clipLocalTime, clip.speed, clip.trimStart, clip.keyframes)

      // Evaluate keyframed properties at current clip-local time
      const kfValues = evaluateAllKeyframes(clip.keyframes, clipLocalTime)

      if (clip.sourceType === 'video') {
        this.renderVideoClip(clip, sourceTime, trackZBase, kfValues)
      } else if (clip.sourceType === 'image') {
        this.renderImageClip(clip, trackZBase, kfValues)
      }
      // 'scene' clips are handled by the scene loading system
      // 'audio' clips have no visual representation
      // 'title' clips could be rendered as text (future)
    }
  }

  private renderVideoClip(clip: Clip, sourceTime: number, zBase: number, kfValues: Record<string, number>): void {
    if (!this.cameraContainer) return

    // Find or create the active video clip entry
    let avc = this.activeVideoClips.find((a) => a.clip.id === clip.id)
    if (!avc) {
      // Create canvas + sprite for this video clip
      const canvas = document.createElement('canvas')
      canvas.width = this.opts.width
      canvas.height = this.opts.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const texture = Texture.from(canvas as unknown as CanvasImageSource)
      const sprite = new Sprite(texture)
      sprite.width = this.opts.width * clip.scale.x
      sprite.height = this.opts.height * clip.scale.y
      sprite.x = clip.position.x
      sprite.y = clip.position.y
      sprite.alpha = clip.opacity
      sprite.rotation = (clip.rotation * Math.PI) / 180
      sprite.zIndex = zBase
      // Apply filters and blend mode
      if (clip.filters.length > 0) sprite.filters = createPixiFilters(clip.filters)
      sprite.blendMode = resolveBlendMode((clip as any).blendMode) as any
      this.cameraContainer.addChild(sprite)

      avc = { clip, sprite, texture, canvas, ctx }
      this.activeVideoClips.push(avc)

      // Ensure video source is loaded in the pool
      this.videoPool.ensureSource(clip.sourceId).catch(() => {})
    }

    // Update sprite properties — keyframes override clip defaults
    avc.sprite.alpha = kfValues.opacity ?? clip.opacity
    avc.sprite.x = kfValues.x ?? clip.position.x
    avc.sprite.y = kfValues.y ?? clip.position.y
    avc.sprite.rotation = ((kfValues.rotation ?? clip.rotation) * Math.PI) / 180
    const sx = kfValues.scaleX ?? clip.scale.x
    const sy = kfValues.scaleY ?? clip.scale.y
    avc.sprite.width = this.opts.width * sx
    avc.sprite.height = this.opts.height * sy
    avc.sprite.zIndex = zBase

    // Decode frame (async, fire-and-forget for real-time preview)
    if (this.videoPool.isReady(clip.sourceId)) {
      this.videoPool
        .decodeFrame(clip.sourceId, sourceTime)
        .then((frame) => {
          if (!frame || !avc?.ctx || !avc.texture) return
          // Draw VideoFrame to intermediate canvas
          avc.ctx.clearRect(0, 0, this.opts.width, this.opts.height)
          avc.ctx.drawImage(frame as unknown as CanvasImageSource, 0, 0, this.opts.width, this.opts.height)
          avc.texture.update()
        })
        .catch(() => {})
    }
  }

  private renderImageClip(clip: Clip, zBase: number, kfValues: Record<string, number>): void {
    if (!this.cameraContainer) return

    let avc = this.activeVideoClips.find((a) => a.clip.id === clip.id)
    if (avc) {
      // Already loaded — update properties with keyframe overrides
      avc.sprite.alpha = kfValues.opacity ?? clip.opacity
      avc.sprite.x = kfValues.x ?? clip.position.x
      avc.sprite.y = kfValues.y ?? clip.position.y
      avc.sprite.rotation = ((kfValues.rotation ?? clip.rotation) * Math.PI) / 180
      avc.sprite.zIndex = zBase
      return
    }

    // Load image and create sprite
    this.loadTextureFromUrl(clip.sourceId)
      .then((tx) => {
        if (!tx || !this.cameraContainer) return
        const sprite = new Sprite(tx)
        sprite.width = this.opts.width * clip.scale.x
        sprite.height = this.opts.height * clip.scale.y
        sprite.x = clip.position.x
        sprite.y = clip.position.y
        sprite.alpha = clip.opacity
        sprite.rotation = (clip.rotation * Math.PI) / 180
        sprite.zIndex = zBase
        if (clip.filters.length > 0) sprite.filters = createPixiFilters(clip.filters)
        sprite.blendMode = resolveBlendMode((clip as any).blendMode) as any
        this.cameraContainer.addChild(sprite)

        // Use a dummy canvas/ctx — image clips don't need per-frame decode
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d')!
        this.activeVideoClips.push({
          clip,
          sprite,
          texture: tx,
          canvas,
          ctx,
        })
      })
      .catch(() => {})
  }

  // ── Texture loading ──────────────────────────────────────────────────────

  private async loadTextureFromSvg(svgMarkup: string): Promise<Texture | null> {
    if (!svgMarkup.trim()) return null
    try {
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = url
      })
      URL.revokeObjectURL(url)
      return Texture.from(img as unknown as CanvasImageSource)
    } catch {
      return null
    }
  }

  private async loadTextureFromUrl(url: string): Promise<Texture | null> {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = url
      })
      return Texture.from(img as unknown as CanvasImageSource)
    } catch {
      return null
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  dispose(): void {
    this.disposed = true
    this.pause()
    this.teardownLoadedScene()
    // Clean up video clips
    for (const avc of this.activeVideoClips) {
      try {
        avc.sprite.destroy()
      } catch {}
    }
    this.activeVideoClips = []
    this.videoPool.dispose()
    try {
      this.app?.destroy(true)
    } catch {}
    this.app = null
    this.root = null
    this.cameraContainer = null
    this.bg = null
  }
}

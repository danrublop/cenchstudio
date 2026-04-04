/**
 * Video decoder pool for multi-source compositing.
 *
 * Manages N WebDemuxer + VideoDecoder pairs, one per video source.
 * Used by both the export engine and the continuous preview to
 * decode frames from multiple video files simultaneously.
 *
 * Each source is identified by its URL. The pool lazily initializes
 * decoders on first use and caches them for subsequent frames.
 */

import { WebDemuxer } from 'web-demuxer'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/web-demuxer@4.0.0/dist/wasm-files/web-demuxer.wasm'

interface VideoSource {
  url: string
  demuxer: WebDemuxer
  decoder: VideoDecoder
  latestFrame: VideoFrame | null
  ready: boolean
}

export class VideoPool {
  private sources = new Map<string, VideoSource>()
  private initializing = new Map<string, Promise<VideoSource | null>>()
  private disposed = false

  /**
   * Ensure a video source is loaded and ready to decode.
   * Call this before decodeFrame() for any source URL.
   * Safe to call multiple times — idempotent.
   */
  async ensureSource(url: string): Promise<boolean> {
    if (this.disposed) return false
    if (this.sources.has(url)) return true

    // Deduplicate concurrent init calls for the same URL
    if (this.initializing.has(url)) {
      const result = await this.initializing.get(url)!
      return result !== null
    }

    const initPromise = this.initSource(url)
    this.initializing.set(url, initPromise)

    try {
      const source = await initPromise
      this.initializing.delete(url)
      return source !== null
    } catch {
      this.initializing.delete(url)
      return false
    }
  }

  private async initSource(url: string): Promise<VideoSource | null> {
    try {
      const demuxer = new WebDemuxer({ wasmFilePath: WASM_URL })
      await demuxer.load(url)
      const config = (await demuxer.getDecoderConfig('video')) as VideoDecoderConfig

      const source: VideoSource = {
        url,
        demuxer,
        decoder: null!,
        latestFrame: null,
        ready: false,
      }

      source.decoder = new VideoDecoder({
        output: (frame) => {
          if (source.latestFrame) source.latestFrame.close()
          source.latestFrame = frame
        },
        error: () => {
          source.ready = false
        },
      })
      source.decoder.configure(config)
      source.ready = true
      this.sources.set(url, source)
      return source
    } catch {
      return null
    }
  }

  /**
   * Decode a single frame at the given time from a video source.
   * Returns a VideoFrame that the caller must NOT close — the pool
   * owns it and will close it on the next decode or disposal.
   */
  async decodeFrame(url: string, timeSec: number): Promise<VideoFrame | null> {
    if (this.disposed) return null
    const source = this.sources.get(url)
    if (!source?.ready) return null

    try {
      const chunk = await source.demuxer.seek('video', Math.max(0, timeSec))
      source.decoder.decode(chunk as EncodedVideoChunk)
      await source.decoder.flush()
      return source.latestFrame
    } catch {
      return null
    }
  }

  /**
   * Get the list of currently loaded source URLs.
   */
  getLoadedSources(): string[] {
    return Array.from(this.sources.keys())
  }

  /**
   * Check if a source URL is loaded and ready.
   */
  isReady(url: string): boolean {
    return this.sources.get(url)?.ready ?? false
  }

  /**
   * Release a single video source.
   */
  releaseSource(url: string): void {
    const source = this.sources.get(url)
    if (!source) return
    this.sources.delete(url)
    try {
      if (source.latestFrame) source.latestFrame.close()
      source.decoder.close()
      source.demuxer.destroy()
    } catch {}
  }

  /**
   * Dispose of all sources and clean up resources.
   */
  dispose(): void {
    this.disposed = true
    for (const [url] of this.sources) {
      this.releaseSource(url)
    }
    this.sources.clear()
    this.initializing.clear()
  }
}

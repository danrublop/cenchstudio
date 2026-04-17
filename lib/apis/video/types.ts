// Provider-agnostic interface for text-to-video generators. Each provider
// returns an operation ID on start and is polled via `pollStatus`. When
// status resolves `done: true`, `download()` fetches the final MP4 bytes.

export type VideoAspectRatio = '16:9' | '9:16' | '1:1'

export interface VideoGenerateOptions {
  prompt: string
  negativePrompt?: string
  aspectRatio: VideoAspectRatio
  /** Target duration in seconds. Providers clamp to their own limits. */
  durationSeconds: number
  /** Optional seed for reproducibility. */
  seed?: number
}

export interface VideoStatus {
  done: boolean
  /** URI / URL where the finished clip lives once ready. */
  videoUri?: string
  error?: string
}

export interface VideoProviderClient {
  id: string
  /** Human-readable label for logs + UI. */
  name: string
  /** Env var whose presence indicates the provider is configured. */
  envKey: string
  /** Baseline cost per call in USD. Used for cost approval gate + logging. */
  costPerCallUsd: number
  /** Called to kick off generation. Returns an operation ID the route polls. */
  generate(opts: VideoGenerateOptions): Promise<{ operationId: string; enhancedPrompt?: string }>
  /** Poll for completion. */
  pollStatus(operationId: string): Promise<VideoStatus>
  /** Download the final MP4. */
  download(videoUri: string): Promise<Buffer>
}

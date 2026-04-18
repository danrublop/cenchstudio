// Global type declarations for `window.cenchApi` — the Week 2 IPC namespace
// that supersedes `window.electronAPI` (see types/electron.d.ts). Keep in
// sync with the preload bridge in `electron/preload.ts`.

export {}

export type TTSProviderId =
  | 'elevenlabs'
  | 'openai-tts'
  | 'gemini-tts'
  | 'google-tts'
  | 'openai-edge-tts'
  | 'pocket-tts'
  | 'voxcpm'
  | 'native-tts'
  | 'puter'
  | 'web-speech'

export type SFXProviderId = 'elevenlabs-sfx' | 'freesound' | 'pixabay'
export type MusicProviderId = 'pixabay-music' | 'freesound-music'

export interface ListProvidersResult {
  providers: {
    tts: { id: TTSProviderId; name: string; available: boolean }[]
    sfx: { id: SFXProviderId; name: string; available: boolean }[]
    music: { id: MusicProviderId; name: string; available: boolean }[]
  }
  media: {
    id: string
    name: string
    category: 'video' | 'image' | 'avatar' | 'utility'
    available: boolean
  }[]
}

export interface ConversationSummary {
  id: string
  projectId: string
  title: string | null
  isPinned: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
  messageCount?: number
  lastMessageAt?: string | null
}

export interface StoredMessage {
  id: string
  conversationId: string
  projectId: string
  role: 'user' | 'assistant'
  content: string
  status?: string | null
  agentType?: string | null
  modelUsed?: string | null
  thinkingContent?: string | null
  toolCalls?: unknown
  contentSegments?: unknown
  inputTokens?: number | null
  outputTokens?: number | null
  costUsd?: number | null
  durationMs?: number | null
  apiCalls?: number | null
  userRating?: number | null
  generationLogId?: string | null
  createdAt: string
}

export interface UsageSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  totalApiCalls: number
  totalToolCalls: number
  byAgent: Record<string, { inputTokens: number; outputTokens: number; costUsd: number; count: number }>
}

export type GenerationLogDimension = 'scene_type' | 'model_used' | 'thinking_mode' | 'style_preset_id' | 'agent_type'

export interface CenchApi {
  settings: {
    /** List audio + media provider availability based on configured API keys. */
    listProviders(): Promise<ListProvidersResult>
  }
  conversations: {
    list(projectId: string): Promise<{ conversations: ConversationSummary[] }>
    create(args: { projectId: string; title?: string }): Promise<{ conversation: ConversationSummary }>
    get(id: string): Promise<{ conversation: ConversationSummary; messages: StoredMessage[] }>
    update(args: {
      id: string
      updates: { title?: string; isPinned?: boolean; isArchived?: boolean }
    }): Promise<{ conversation: ConversationSummary }>
    delete(id: string): Promise<{ success: true }>
    listMessages(id: string): Promise<{ messages: StoredMessage[] }>
    addMessage(args: {
      id?: string
      messageId?: string
      conversationId: string
      projectId: string
      role: 'user' | 'assistant'
      content: string
      status?: string
      agentType?: string
      modelUsed?: string
      thinkingContent?: string
      toolCalls?: unknown
      contentSegments?: unknown
      inputTokens?: number
      outputTokens?: number
      costUsd?: number
      durationMs?: number
      apiCalls?: number
      userRating?: number | null
      generationLogId?: string
      _method?: 'PUT'
    }): Promise<{ message?: StoredMessage; success?: true }>
    updateMessage(args: {
      conversationId: string
      messageId: string
      userRating?: number | null
      content?: string
      status?: string
      agentType?: string
      modelUsed?: string
      thinkingContent?: string
      toolCalls?: unknown
      contentSegments?: unknown
      inputTokens?: number
      outputTokens?: number
      costUsd?: number
      durationMs?: number
      apiCalls?: number
      generationLogId?: string
    }): Promise<{ success: true }>
    clearMessages(id: string): Promise<{ success: true }>
  }
  usage: {
    getSummary(projectId?: string): Promise<UsageSummary>
  }
  generationLog: {
    update(args: {
      logId: string
      userAction?: string
      timeToActionMs?: number
      editDistance?: number
      userRating?: number
      exportSucceeded?: boolean
      exportErrorMessage?: string
      generatedCodeLength?: number
    }): Promise<{ success: true }>
    list(args: { projectId?: string; sceneId?: string; limit?: number; offset?: number }): Promise<{ logs: unknown[] }>
    listByDimension(args: { dimension: GenerationLogDimension; projectId?: string }): Promise<{ data: unknown }>
  }
  permissions: {
    /** Per-API session + monthly spend tracking. */
    getSpend(): Promise<Record<string, { sessionSpend: number; monthlySpend: number }>>
    perform(
      args:
        | { action: 'log_spend'; api: string; costUsd: number; description?: string; projectId?: string }
        | { action: 'set_session_permission'; api: string; decision: string }
        | { action: 'get_session_permission'; api: string },
    ): Promise<{ ok?: true; decision?: string | null }>
  }
  skills: {
    /** Read a markdown skill file from the bundled skill trees. */
    readFile(args: { source: string; file: string }): Promise<{ content: string; file: string; source: string }>
  }
  projects: {
    list(args?: {
      limit?: number
      cursor?: string
      workspaceId?: string | 'none'
    }): Promise<Array<Record<string, unknown>> | { items: Array<Record<string, unknown>>; nextCursor: string | null }>
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>
    get(projectId: string): Promise<Record<string, unknown>>
    update(args: { projectId: string; updates: Record<string, unknown> }): Promise<Record<string, unknown>>
    delete(projectId: string): Promise<{ ok: true }>
    listAssets(args: {
      projectId: string
      type?: 'image' | 'video' | 'svg'
      source?: 'upload' | 'generated'
    }): Promise<{ assets: unknown[] }>
    getBrandKit(projectId: string): Promise<{ brandKit: unknown }>
    updateBrandKit(args: { projectId: string; updates: Record<string, unknown> }): Promise<{ brandKit: unknown }>
    /** Partial update of a single project asset (rename / retag). */
    patchAsset(args: {
      projectId: string
      assetId: string
      name?: string
      tags?: string[]
    }): Promise<{ asset: Record<string, unknown> }>
    /** Delete an asset row + its on-disk storage + thumbnail. */
    deleteAsset(args: { projectId: string; assetId: string }): Promise<{ success: true }>
    /**
     * Regenerate an image asset as a sibling record (parentAssetId points
     * to the original). Optional overrides can change the prompt, model,
     * aspectRatio, or enrichment tags.
     */
    regenerateAsset(args: {
      projectId: string
      assetId: string
      promptOverride?: string
      model?: string
      aspectRatio?: string
      enhanceTags?: string[]
    }): Promise<{ asset: Record<string, unknown>; cost: number; finalPrompt: string }>
  }
  workspaces: {
    list(): Promise<Array<Record<string, unknown>>>
    get(workspaceId: string): Promise<Record<string, unknown>>
    create(args: {
      name: string
      description?: string | null
      color?: string | null
      icon?: string | null
      isDefault?: boolean
    }): Promise<Record<string, unknown>>
    update(args: { workspaceId: string; updates: Record<string, unknown> }): Promise<Record<string, unknown>>
    delete(workspaceId: string): Promise<{ success: true }>
    assignProjects(args: { workspaceId: string; projectIds: string[] }): Promise<{ success: true }>
    unassignProjects(args: { projectIds: string[] }): Promise<{ success: true }>
  }
  publish: {
    run(args: {
      project: Record<string, unknown>
      scenes: unknown[]
      globalStyle?: unknown
    }): Promise<{ publishedUrl: string; version: number }>
  }
  scene: {
    /** Write a raw scene HTML file to the scenes dir (dev: public/scenes, packaged: userData/scenes). */
    writeHtml(args: { id: string; html: string }): Promise<{ success: true; path: string }>
    /** Fetch a single scene by id from the project's scene store. */
    get(args: { projectId: string; sceneId: string }): Promise<{ scene: Record<string, unknown> }>
    /** Server-side HTML generation + disk write for world scenes (needs template access). */
    generateWorld(args: {
      scene: Record<string, unknown>
      aspectRatio?: string
      resolution?: string
    }): Promise<{ success: true; path: string }>
  }
  media: {
    /**
     * Write a file to the uploads dir. Dev returns `/uploads/<filename>`
     * (served by Next); packaged returns `cench://uploads/<filename>`
     * (served by the cench protocol handler). Enforces 100MB cap +
     * whitelist of video/audio/json mime types; validates Lottie JSON
     * before writing.
     */
    upload(args: {
      data: ArrayBuffer
      mimeType: string
      originalName?: string
    }): Promise<{ url: string; filename: string }>
  }
  avatarConfigs: {
    /** List all avatar configs for a project + the registry of available providers. */
    list(args: { projectId: string }): Promise<{
      configs: Array<Record<string, unknown>>
      providers: Array<Record<string, unknown>>
    }>
    /** Create a new config. `isDefault: true` clears siblings first (non-atomic). */
    create(args: {
      projectId: string
      provider: string
      name: string
      config?: Record<string, unknown>
      isDefault?: boolean
    }): Promise<Record<string, unknown>>
    /** Partial update. `isDefault: true` clears siblings first (non-atomic). */
    update(args: {
      projectId: string
      configId: string
      provider?: string
      name?: string
      config?: Record<string, unknown>
      isDefault?: boolean
      thumbnailUrl?: string
    }): Promise<Record<string, unknown>>
    delete(args: { projectId: string; configId: string }): Promise<{ success: true }>
  }
  zdogLibrary: {
    /** Fetch all zdog studio + person assets saved on a project. */
    list(args: { projectId: string }): Promise<{ assets: Array<Record<string, unknown>> }>
    /** Append a studio shape-tree or legacy person formula to the library. Optimistic-lock retry on CONFLICT. */
    save(args: {
      projectId: string
      name: string
      assetType?: 'studio' | 'person'
      tags?: string[]
      shapes?: unknown[]
      formula?: unknown
    }): Promise<{ success: true; asset: Record<string, unknown> }>
    delete(args: { projectId: string; id: string }): Promise<{ success: true }>
  }
  tts: {
    /**
     * Server-side TTS synthesis. Returns either `{mode: 'client', ...}`
     * (web-speech / puter — renderer speaks) or `{url, duration, provider, captions}`
     * (MP3/WAV written to the audio dir; URL is `/audio/<name>` in dev
     * or `cench://audio/<name>` in packaged).
     */
    synthesize(args: {
      text: string
      sceneId: string
      voiceId?: string
      provider?: string
      model?: string
      instructions?: string
      localMode?: boolean
    }): Promise<Record<string, unknown>>
  }
  sfx: {
    /** Search Freesound/Pixabay or generate via ElevenLabs when `prompt` is set. */
    search(args: {
      query?: string
      prompt?: string
      provider?: string
      limit?: number
      duration?: number
      download?: boolean
      mode?: 'search' | 'library' | 'generated'
      categoryId?: string
      page?: number
      commercialOnly?: boolean
    }): Promise<Record<string, unknown>>
  }
  music: {
    /** Search Pixabay-music/Freesound-music. Set `download: true` to pull remote tracks to the local audio dir. */
    search(args: {
      query: string
      provider?: string
      limit?: number
      download?: boolean
    }): Promise<Record<string, unknown>>
  }
  ingest: {
    /**
     * yt-dlp probe (no `formatId`) or download (with `formatId`). Rejects
     * with a validation error if yt-dlp binary isn't on PATH; the UI
     * should prompt the user to install it.
     */
    fromUrl(args: { url: string; projectId: string; formatId?: string }): Promise<Record<string, unknown>>
    /**
     * Direct-URL fetch (assumes `url` points at an actual media file).
     * Downloads, dedups by content hash, transcodes `.mov`/`.ogv` to
     * `.mp4` via ffmpeg, generates a thumbnail, inserts into
     * `project_assets`.
     */
    fromDirectUrl(args: {
      url: string
      projectId: string
      name?: string
      tags?: string[]
    }): Promise<Record<string, unknown>>
  }
  generate: {
    /**
     * Scene-code generators. Each routes through `lib/generation/generate.ts`
     * which picks Anthropic / OpenAI / Google / local based on `modelId` +
     * `modelConfigs`. Response shapes match the HTTP routes they replaced
     * so call sites can swap transports without adapting parse logic.
     */
    canvas(args: GenerateCodeArgs): Promise<GenerateCodeStringResult>
    motion(
      args: GenerateCodeArgs & { font?: string },
    ): Promise<GenerateCodeStructuredResult<{ sceneCode: string; styles?: unknown; htmlContent?: unknown }>>
    three(args: GenerateCodeArgs): Promise<GenerateCodeStructuredResult<{ sceneCode: string }>>
    react(
      args: GenerateCodeArgs & { font?: string },
    ): Promise<GenerateCodeStructuredResult<{ sceneCode: string; styles?: unknown }>>
    /**
     * Lottie overlay animation. Returns serialized JSON string in `result`
     * plus a quality score. May produce `fixCount > 0` when the validator
     * auto-repairs the model's output.
     */
    lottie(args: GenerateCodeArgs & { font?: string; motionPersonality?: string }): Promise<{
      result: string
      usage: GenerateCodeUsage
      quality: { score: number; dimensions: unknown; suggestions: unknown }
      fixCount?: number
    }>
    /**
     * D3 data visualization via the `cench_charts` structured pipeline.
     * `result.chartLayers` is the canonical compiled output; `sceneCode` +
     * `styles` are legacy compatibility fields that scenes still read.
     */
    d3(args: GenerateCodeArgs & { font?: string; d3Data?: unknown }): Promise<{
      result: {
        chartLayers: unknown[]
        sceneCode: string
        d3Data: unknown
        styles: unknown
        suggestedData: unknown
      }
      usage: GenerateCodeUsage
      mode: 'cench_charts' | 'legacy'
    }>
    /**
     * AI image generation (Flux / DALL-E / Recraft via the image-gen
     * router). When `removeBackground` is true, follows with a
     * background-removal pass and returns `stickerUrl` alongside.
     */
    image(args: {
      prompt: string
      negativePrompt?: string
      model?: string
      aspectRatio?: string
      style?: string | null
      removeBackground?: boolean
      projectId?: string
      sceneId?: string
    }): Promise<{
      imageUrl: string
      stickerUrl: string | null
      width: number
      height: number
      cost: number
    }>
    /**
     * Poll a HeyGen avatar video job. Returns `status: 'completed'` with
     * `videoUrl` when the video is downloaded + cached; otherwise reports
     * the upstream job status.
     */
    pollHeygen(videoId: string): Promise<{
      status: string
      videoUrl?: string
      thumbnailUrl?: string
      error?: string
    }>
    /**
     * Poll a Veo3 / Kling / Runway text-to-video job. Returns
     * `done: true, videoUrl` on success (after saving to cache +
     * calling `logSpend`) or `done: false` if still processing.
     */
    pollVideo(args: {
      operationName: string
      projectId?: string
      prompt?: string
      providerId?: string
      reservationId?: string
    }): Promise<{
      done: boolean
      videoUrl?: string
      provider?: string
      error?: string
    }>
    /** Default SVG generation. */
    svg(args: GenerateCodeArgs & { strokeWidth?: number; font?: string }): Promise<{
      result: string
      usage: GenerateCodeUsage
    }>
    /** One-shot enhancement of a scene prompt (~512 tokens). */
    enhancePrompt(args: { prompt: string; modelId?: string; modelConfigs?: unknown[] }): Promise<{
      result: string
      usage: GenerateCodeUsage
    }>
    /** 200-token summary of a prompt + SVG content (used for `previousSummary` chaining). */
    summarize(args: {
      prompt: string
      svgContent?: string
      modelId?: string
      modelConfigs?: unknown[]
    }): Promise<{ result: string }>
    /** Rewrite an existing SVG per a natural-language edit instruction. */
    editSvg(args: {
      svgContent: string
      editInstruction: string
      modelId?: string
      modelConfigs?: unknown[]
    }): Promise<{ result: string; usage: GenerateCodeUsage }>
  }
}

interface GenerateCodeArgs {
  prompt: string
  palette?: string[]
  bgColor?: string
  duration?: number
  previousSummary?: string
  modelId?: string
  modelConfigs?: unknown[]
}

interface GenerateCodeUsage {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

interface GenerateCodeStringResult {
  result: string
  usage: GenerateCodeUsage
  truncated?: boolean
}

interface GenerateCodeStructuredResult<R> {
  result: R
  usage: GenerateCodeUsage
  truncated?: boolean
}

declare global {
  interface Window {
    /**
     * The desktop IPC surface. Only present in Electron (dev or packaged).
     * In a pure browser context it is `undefined`.
     */
    cenchApi?: CenchApi
  }
}

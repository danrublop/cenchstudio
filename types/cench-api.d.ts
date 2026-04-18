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

'use client'

import type { Scene, GlobalStyle, APIPermissions, AILayer } from '../types'
import type {
  ChatMessage,
  AgentType,
  ModelId,
  ModelTier,
  ThinkingMode,
  ConversationSummary,
  Storyboard,
} from '../agents/types'
import { messageContentToText } from '../agents/types'
import type { ModelConfig, ProviderConfig } from '../agents/model-config'
import type { AgentConfig } from '../agents/agent-config'
import type { PermissionRule } from '../types/permissions'

type WirePermissionRule = Omit<PermissionRule, 'createdAt' | 'expiresAt'> & {
  createdAt: string
  expiresAt: string | null
}

function hydrateWireRule(r: WirePermissionRule): PermissionRule {
  return {
    ...r,
    createdAt: new Date(r.createdAt),
    expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
  }
}
import { DEFAULT_MODELS, DEFAULT_PROVIDER_CONFIGS } from '../agents/model-config'
import { DEFAULT_AGENTS } from '../agents/agent-config'
import type { Set, Get, UndoableState } from './types'
import { MAX_UNDO, normalizeScene, sceneHasRenderableContent } from './helpers'

/**
 * Conversation IPC adapter. Prefers `window.cenchApi.conversations.*` when
 * running inside Electron (both dev and packaged — preload always provides
 * it). Falls back to the legacy `/api/conversations*` fetch path for pure
 * browser preview and during the Week 2 migration window before every
 * route is deleted.
 *
 * The adapter normalizes HTTP vs IPC error semantics: IPC handlers throw
 * plain `Error`s on failure; legacy fetch returns `res.ok=false`. Both
 * surface as thrown errors here so the caller's retry logic is uniform.
 */
function getConversationsIpc() {
  return typeof window !== 'undefined' ? window.cenchApi?.conversations : undefined
}
async function fetchJsonOrThrow(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export function createAgentActions(set: Set, get: Get) {
  let switchConversationCounter = 0
  let renameDebounceTimer: ReturnType<typeof setTimeout> | null = null

  return {
    // ── Conversation actions ────────────────────────────────────────────────

    loadConversations: async (projectId: string) => {
      if (get().conversationsLoading) {
        console.log('[Conversations] Already loading, skipping duplicate call')
        return
      }
      set({ conversationsLoading: true })
      try {
        const ipc = getConversationsIpc()
        const data = ipc
          ? await ipc.list(projectId)
          : await fetchJsonOrThrow(`/api/conversations?projectId=${projectId}`)
        const convs: ConversationSummary[] = (data.conversations ?? []) as ConversationSummary[]
        set({ conversations: convs, conversationsLoading: false })

        if (convs.length === 0) {
          // Auto-create first conversation
          await get().newConversation(projectId)
        } else {
          // Auto-select most recent
          await get().switchConversation(convs[0].id)
        }
      } catch (err) {
        console.error('[Conversations] Failed to load:', err)
        set({ conversationsLoading: false })
        // Fallback: create first conversation even if load failed
        if (get().conversations.length === 0) {
          await get().newConversation(projectId)
        }
      }
    },

    newConversation: async (projectId: string) => {
      try {
        const ipc = getConversationsIpc()
        const data = ipc
          ? await ipc.create({ projectId })
          : await fetchJsonOrThrow('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId }),
            })
        const conv: ConversationSummary = data.conversation as ConversationSummary
        set((state) => ({
          conversations: [conv, ...state.conversations],
          activeConversationId: conv.id,
          chatMessages: [],
          _persistedMessageIds: new Set<string>(),
        }))
        return conv.id
      } catch (err) {
        console.error('[Conversations] Failed to create:', err)
        return ''
      }
    },

    switchConversation: async (conversationId: string) => {
      // Validate conversation belongs to the current project's list
      const validIds = new Set(get().conversations.map((c) => c.id))
      if (!validIds.has(conversationId)) return
      // Abort any in-flight agent stream before switching
      if (get().isAgentRunning) {
        get().abortAgentRun()
      }
      const requestId = ++switchConversationCounter
      // Only update the active ID — don't clear messages yet to avoid flash
      set({ activeConversationId: conversationId })
      try {
        const ipc = getConversationsIpc()
        const data = ipc
          ? await ipc.listMessages(conversationId)
          : await fetchJsonOrThrow(`/api/conversations/${conversationId}/messages`).catch(() => null)
        if (!data) return
        // Bail if a newer switch happened while we were fetching
        if (requestId !== switchConversationCounter) return
        // Map DB messages to ChatMessage format
        const orphanedIds: string[] = []
        const msgs: ChatMessage[] = (data.messages ?? []).map((m: any) => {
          const isOrphaned = m.status === 'streaming'
          // Grace period: don't mark recent messages as orphaned (they may still be completing)
          const createdAt = m.createdAt ? new Date(m.createdAt).getTime() : 0
          const isRecent = createdAt > 0 && Date.now() - createdAt < 30_000
          if (isOrphaned && !isRecent) orphanedIds.push(m.id)
          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: isOrphaned && !isRecent ? m.content || 'Generation interrupted.' : m.content,
            agentType: m.agentType ?? undefined,
            modelId: m.modelUsed ?? undefined,
            thinking: m.thinkingContent ?? undefined,
            toolCalls: m.toolCalls ?? [],
            contentSegments: m.contentSegments ?? undefined,
            usage: m.inputTokens
              ? {
                  inputTokens: m.inputTokens,
                  outputTokens: m.outputTokens ?? 0,
                  apiCalls: m.apiCalls ?? 1,
                  costUsd: m.costUsd ?? 0,
                  totalDurationMs: m.durationMs ?? 0,
                  provider: m.modelUsed?.startsWith('claude-code:')
                    ? 'claude-code'
                    : m.modelUsed?.startsWith('codex-cli:')
                      ? 'codex-cli'
                      : undefined,
                }
              : undefined,
            userRating: m.userRating ?? undefined,
            generationLogId: m.generationLogId ?? undefined,
            timestamp: new Date(m.createdAt).getTime(),
          }
        })
        // Guard against stale switch (belt-and-suspenders with counter above)
        if (requestId !== switchConversationCounter) return
        if (get().activeConversationId === conversationId) {
          console.log(
            `[switchConversation] Loaded ${msgs.length} messages for conversation ${conversationId.slice(0, 8)}…`,
          )
          // Track all loaded message IDs as persisted (for INSERT vs UPDATE discrimination)
          set({
            chatMessages: msgs,
            _persistedMessageIds: new Set(msgs.map((m) => m.id)),
          })
          // Background: mark orphaned 'streaming' messages as 'aborted' in DB
          for (const orphanId of orphanedIds) {
            const ipcInner = getConversationsIpc()
            if (ipcInner) {
              ipcInner.updateMessage({ conversationId, messageId: orphanId, status: 'aborted' }).catch(() => {})
            } else {
              fetch(`/api/conversations/${conversationId}/messages`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: orphanId, status: 'aborted' }),
              }).catch(() => {})
            }
          }
        }
      } catch (err) {
        console.error('[Conversations] Failed to load messages:', err)
        // On error, clear messages so stale ones from previous conversation aren't shown
        if (get().activeConversationId === conversationId) {
          set({ chatMessages: [] })
        }
      }
    },

    renameConversation: async (id: string, title: string) => {
      // Optimistic UI update immediately
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
      }))
      // Debounce the API call to avoid firing on every keystroke
      if (renameDebounceTimer) clearTimeout(renameDebounceTimer)
      renameDebounceTimer = setTimeout(() => {
        renameDebounceTimer = null
        const ipc = getConversationsIpc()
        const op = ipc
          ? ipc.update({ id, updates: { title } })
          : fetch(`/api/conversations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title }),
            })
        Promise.resolve(op).catch((err) => console.error('[Conversations] Failed to rename:', err))
      }, 400)
    },

    pinConversation: async (id: string, pinned: boolean) => {
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? { ...c, isPinned: pinned } : c)),
      }))
      const ipc = getConversationsIpc()
      const op = ipc
        ? ipc.update({ id, updates: { isPinned: pinned } })
        : fetch(`/api/conversations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPinned: pinned }),
          })
      Promise.resolve(op).catch((err) => console.error('[Conversations] Failed to pin:', err))
    },

    deleteConversation: async (id: string) => {
      const remaining = get().conversations.filter((c) => c.id !== id)
      set({ conversations: remaining })
      const ipc = getConversationsIpc()
      const op = ipc ? ipc.delete(id) : fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      Promise.resolve(op).catch((err) => console.error('[Conversations] Failed to delete:', err))

      if (get().activeConversationId === id) {
        if (remaining.length > 0) {
          await get().switchConversation(remaining[0].id)
        } else {
          const projectId = get().project?.id
          if (projectId) await get().newConversation(projectId)
        }
      }
    },

    // ── Chat / Agent actions ───────────────────────────────────────────────

    setChatOpen: (open: boolean) => set({ isChatOpen: open }),

    addChatMessage: (msg: ChatMessage) => {
      const before = get().chatMessages.length
      set((state) => ({ chatMessages: [...state.chatMessages, msg] }))
      console.log(
        `[Chat] addChatMessage: role=${msg.role} id=${msg.id.slice(0, 8)}… before=${before} after=${get().chatMessages.length}`,
      )
      // User messages are persisted via persistUserMessage (awaitable).
      // Assistant messages are persisted via persistChatMessage after the agent run.
    },

    /** Persist a user message to the DB. Returns a promise so callers can await it. */
    persistUserMessage: async (msg: ChatMessage) => {
      const projectId = get().project?.id
      const conversationId = get().activeConversationId
      if (!projectId || !conversationId || msg.role !== 'user' || !msg.content) return
      const textContent = typeof msg.content === 'string' ? msg.content : messageContentToText(msg.content)
      if (!textContent) return
      try {
        const ipc = getConversationsIpc()
        if (ipc) {
          await ipc.addMessage({
            id: msg.id,
            conversationId,
            projectId,
            role: msg.role,
            content: textContent,
          })
        } else {
          await fetchJsonOrThrow(`/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: msg.id,
              projectId,
              role: msg.role,
              content: textContent,
            }),
          })
        }
        // Track that this message has been INSERTed
        const ids = new Set(get()._persistedMessageIds)
        ids.add(msg.id)
        set({ _persistedMessageIds: ids })
      } catch (err) {
        console.error('[Chat] Failed to persist user message:', err)
      }
    },

    updateChatMessage: (id: string, updates: Partial<ChatMessage>) => {
      const contentLen = typeof updates.content === 'string' ? updates.content.length : 0
      const hasSegments = !!updates.contentSegments?.length
      const hasTools = !!updates.toolCalls?.length
      console.log(
        `[Chat] updateChatMessage: id=${id.slice(0, 8)}… contentLen=${contentLen} segments=${hasSegments} tools=${hasTools} msgCount=${get().chatMessages.length}`,
      )
      set((state) => ({
        chatMessages: state.chatMessages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      }))
    },

    /** Persist a chat message to DB. INSERT on first call, UPDATE on subsequent calls. */
    persistChatMessage: async (id: string, opts?: { status?: string }) => {
      const msg = get().chatMessages.find((m) => m.id === id)
      const projectId = get().project?.id
      const conversationId = get().activeConversationId
      if (!msg || !projectId || !conversationId) return

      const textContent = typeof msg.content === 'string' ? msg.content : messageContentToText(msg.content)
      const persisted = get()._persistedMessageIds

      const isUpdate = persisted.has(id)
      const insertBody = {
        id,
        conversationId,
        projectId,
        role: msg.role,
        content: textContent || '',
        status: opts?.status ?? 'complete',
        agentType: msg.agentType,
        modelUsed: msg.modelId,
        thinkingContent: msg.thinking,
        toolCalls: msg.toolCalls,
        contentSegments: msg.contentSegments,
        inputTokens: msg.usage?.inputTokens,
        outputTokens: msg.usage?.outputTokens,
        costUsd: msg.usage?.costUsd,
        durationMs: msg.usage?.totalDurationMs,
        apiCalls: msg.usage?.apiCalls,
        generationLogId: msg.generationLogId,
      }
      const updateBody = {
        conversationId,
        messageId: id,
        content: textContent || '',
        status: opts?.status ?? 'complete',
        agentType: msg.agentType,
        modelUsed: msg.modelId,
        thinkingContent: msg.thinking,
        toolCalls: msg.toolCalls,
        contentSegments: msg.contentSegments,
        inputTokens: msg.usage?.inputTokens,
        outputTokens: msg.usage?.outputTokens,
        costUsd: msg.usage?.costUsd,
        durationMs: msg.usage?.totalDurationMs,
        apiCalls: msg.usage?.apiCalls,
        generationLogId: msg.generationLogId,
      }

      const doPersist = async () => {
        const ipc = getConversationsIpc()
        if (ipc) {
          if (isUpdate) await ipc.updateMessage(updateBody)
          else await ipc.addMessage(insertBody)
          return
        }
        await fetchJsonOrThrow(`/api/conversations/${conversationId}/messages`, {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isUpdate ? updateBody : insertBody),
        })
      }

      try {
        await doPersist()
        if (!persisted.has(id)) {
          const ids = new Set(get()._persistedMessageIds)
          ids.add(id)
          set({ _persistedMessageIds: ids })
        }
      } catch (err) {
        // Retry once — prevents message loss on transient DB or IPC hiccup.
        console.warn('[Chat] persistChatMessage failed, retrying...', err)
        try {
          await new Promise((r) => setTimeout(r, 1000))
          await doPersist()
          if (!persisted.has(id)) {
            const ids = new Set(get()._persistedMessageIds)
            ids.add(id)
            set({ _persistedMessageIds: ids })
          }
        } catch (retryErr) {
          console.error('[Chat] persistChatMessage retry failed:', retryErr)
        }
      }
    },

    removeChatMessage: (id: string) =>
      set((state) => ({
        chatMessages: state.chatMessages.filter((m) => m.id !== id),
      })),

    clearChat: () => {
      set({ chatMessages: [], _persistedMessageIds: new Set<string>() })
      const conversationId = get().activeConversationId
      if (conversationId) {
        const ipc = getConversationsIpc()
        const op = ipc
          ? ipc.clearMessages(conversationId)
          : fetch(`/api/conversations/${conversationId}/messages`, { method: 'DELETE' })
        Promise.resolve(op).catch((err) => console.error('[Chat] Failed to clear messages:', err))
      }
    },

    setAgentRunning: (running: boolean) => {
      // Capture undo snapshot when agent starts (before any tool mutations)
      if (running && !get().isAgentRunning) {
        const { scenes, globalStyle, project, _undoStack } = get()
        const safeScenes = scenes.map((s) =>
          s.d3Data !== null && s.d3Data !== undefined ? { ...s, d3Data: JSON.parse(JSON.stringify(s.d3Data)) } : s,
        )
        try {
          const snapshot: UndoableState = structuredClone({ scenes: safeScenes, globalStyle, project })
          const newStack = [..._undoStack, snapshot]
          if (newStack.length > MAX_UNDO) newStack.shift()
          set({ _undoStack: newStack, _redoStack: [], isAgentRunning: running, _agentRunStartedAt: Date.now() })
        } catch (err) {
          console.error('[Store] structuredClone failed for undo snapshot — skipping undo capture:', err)
          set({ isAgentRunning: running, _agentRunStartedAt: Date.now() })
        }
        return
      }
      set({ isAgentRunning: running, ...(running ? { _agentRunStartedAt: Date.now() } : {}) })
    },
    setAgentType: (type: AgentType | null) => set({ agentType: type }),
    setAgentModelId: (id: ModelId | null) => set({ agentModelId: id }),
    setAgentOverride: (type: AgentType | null) => set({ agentOverride: type }),
    setPendingStoryboard: (sb: Storyboard | null) => set({ pendingStoryboard: sb }),
    setStoryboardProposed: (sb: Storyboard | null) => set({ storyboardProposed: sb }),
    setPausedAgentRun: (
      v: {
        toolName: string
        toolInput: Record<string, unknown>
        agentType?: string | null
        reason?: string | null
        createdAt: string
      } | null,
    ) => set({ pausedAgentRun: v }),
    setRunCheckpoint: (v: import('../agents/types').RunCheckpoint | null) => set({ runCheckpoint: v }),
    setPlanFirstMode: (v: boolean) => set({ planFirstMode: v }),
    setModelOverride: (id: ModelId | null) => set({ modelOverride: id }),
    setModelTier: (tier: ModelTier) => set({ modelTier: tier }),
    setThinkingMode: (mode: ThinkingMode) => set({ thinkingMode: mode }),
    setLocalMode: (enabled: boolean) => set({ localMode: enabled }),
    setLocalModelId: (id: string | null) => set({ localModelId: id }),
    setSceneContext: (ctx: 'all' | 'selected' | 'auto' | string) => set({ sceneContext: ctx }),
    setActiveTools: (tools: string[]) => set({ activeTools: tools }),

    toggleActiveTool: (toolId: string) => {
      set((state) => {
        const current = state.activeTools
        const isEnabling = !current.includes(toolId)
        const next = isEnabling ? [...current, toolId] : current.filter((t) => t !== toolId)
        // Auto-switch outputMode when interactions chip is toggled
        if (toolId === 'interactions') {
          const newOutputMode = isEnabling ? 'interactive' : 'mp4'
          return {
            activeTools: next,
            project: { ...state.project, outputMode: newOutputMode, updatedAt: new Date().toISOString() },
          }
        }
        return { activeTools: next }
      })
    },

    setChatInputValue: (v: string) => set({ chatInputValue: v }),

    syncScenesFromAgent: async (updatedScenes: Scene[], updatedGlobalStyle: GlobalStyle) => {
      // Undo snapshot already captured in setAgentRunning(true)
      console.log(`[Store] syncScenesFromAgent: ${updatedScenes.length} scenes`)
      for (const s of updatedScenes) {
        console.log(
          `[Store]   scene ${s.id.slice(0, 8)}… type=${s.sceneType} html=${s.sceneHTML?.length ?? 0} svg=${s.svgContent?.length ?? 0} canvas=${s.canvasCode?.length ?? 0} code=${s.sceneCode?.length ?? 0} react=${(s as any).reactCode?.length ?? 0} lottie=${s.lottieSource?.length ?? 0}`,
        )
      }

      // Auto-remove empty default scenes if the agent created new ones with content
      const hasContentScene = updatedScenes.some(sceneHasRenderableContent)

      set((state) => {
        // Check which existing scenes have chat messages worth preserving
        const scenesWithMessages = new Set(state.scenes.filter((s) => s.messages?.length).map((s) => s.id))
        // Never remove scenes that already had content in the store — only remove newly-created empty ones
        const existingSceneIds = new Set(state.scenes.map((s) => s.id))
        const existingScenesWithContent = new Set(
          state.scenes.filter((s) => sceneHasRenderableContent(s) || s.prompt).map((s) => s.id),
        )

        const cleanedScenes = hasContentScene
          ? updatedScenes.filter((s) => {
              if (sceneHasRenderableContent(s)) return true
              if (s.prompt) return true
              // Keep scenes that have local chat messages (user was talking on this scene)
              if (scenesWithMessages.has(s.id)) return true
              // Never remove scenes that previously had content — the agent may have just failed to update them
              if (existingScenesWithContent.has(s.id)) {
                console.log(`[Store] Keeping pre-existing scene (had content): ${s.id.slice(0, 8)}… "${s.name}"`)
                return true
              }
              // Only remove scenes that were created by the agent in this run and have no content
              if (!existingSceneIds.has(s.id)) {
                console.log(`[Store] Removing empty agent-created scene: ${s.id.slice(0, 8)}… "${s.name}"`)
                return false
              }
              return true
            })
          : updatedScenes
        const finalScenes = cleanedScenes.length > 0 ? cleanedScenes : updatedScenes

        // Preserve per-scene messages and content — server-side scenes don't carry local chat history.
        // The agent request strips content for non-focused scenes (replaced with "[N chars]" placeholders).
        // When the agent returns, those placeholders must NOT overwrite the real content in the store.
        const isPlaceholderContent = (val: string | undefined | null): boolean => !!val && /^\[\d+ chars\]$/.test(val)

        const agentRunStart = state._agentRunStartedAt || 0

        const mergedScenes = finalScenes.map((newScene) => {
          const existing = state.scenes.find((s) => s.id === newScene.id)
          if (!existing) return normalizeScene(newScene as Scene)

          // If the user edited this scene AFTER the agent run started, preserve their version
          if (
            agentRunStart > 0 &&
            existing.updatedAt &&
            existing.updatedAt > agentRunStart &&
            sceneHasRenderableContent(existing)
          ) {
            console.log(
              `[Store] Preserving user-edited scene ${existing.id.slice(0, 8)}… (edited at ${existing.updatedAt}, agent started at ${agentRunStart})`,
            )
            return existing
          }

          // Detect if the agent returned placeholder content — restore store's real content
          const hasPlaceholder =
            isPlaceholderContent(newScene.svgContent) ||
            isPlaceholderContent(newScene.canvasCode) ||
            isPlaceholderContent(newScene.sceneCode) ||
            isPlaceholderContent(newScene.lottieSource)

          if (hasPlaceholder) {
            console.log(
              `[Store] Restoring real content for scene ${newScene.id.slice(0, 8)}… (had placeholder strings)`,
            )
            return normalizeScene({
              ...newScene,
              svgContent: isPlaceholderContent(newScene.svgContent) ? existing.svgContent : newScene.svgContent,
              canvasCode: isPlaceholderContent(newScene.canvasCode) ? existing.canvasCode : newScene.canvasCode,
              sceneCode: isPlaceholderContent(newScene.sceneCode) ? existing.sceneCode : newScene.sceneCode,
              sceneHTML:
                isPlaceholderContent(newScene.sceneCode) ||
                isPlaceholderContent(newScene.svgContent) ||
                isPlaceholderContent(newScene.canvasCode)
                  ? existing.sceneHTML
                  : newScene.sceneHTML,
              lottieSource: isPlaceholderContent(newScene.lottieSource) ? existing.lottieSource : newScene.lottieSource,
              messages: existing.messages,
            } as Scene)
          }

          // If agent returned truly empty content but store has real content, preserve it
          const agentHasContent = sceneHasRenderableContent(newScene)
          const storeHasContent = sceneHasRenderableContent(existing)
          if (storeHasContent && !agentHasContent) {
            console.log(
              `[Store] Preserving existing content for scene ${newScene.id.slice(0, 8)}… (agent returned empty)`,
            )
            return normalizeScene({
              ...newScene,
              svgContent: existing.svgContent,
              canvasCode: existing.canvasCode,
              sceneCode: existing.sceneCode,
              reactCode: existing.reactCode,
              sceneHTML: existing.sceneHTML,
              lottieSource: existing.lottieSource,
              messages: existing.messages,
            } as Scene)
          }

          const merged = existing.messages?.length ? { ...newScene, messages: existing.messages } : newScene
          return normalizeScene(merged as Scene)
        })

        // Auto-select the first scene with content (don't change if user's scene still exists)
        const currentStillExists = mergedScenes.some((s) => s.id === state.selectedSceneId)
        const firstWithContent = mergedScenes.find((s) => sceneHasRenderableContent(s))

        return {
          scenes: mergedScenes,
          globalStyle: (() => {
            const g = state.globalStyle
            const typ = g.uiTypography ?? 'app'
            return {
              ...updatedGlobalStyle,
              theme: g.theme ?? updatedGlobalStyle.theme,
              uiTypography: typ,
              uiFontFamily: typ === 'custom' ? (g.uiFontFamily ?? 'Inter') : null,
            }
          })(),
          sceneHtmlVersion: state.sceneHtmlVersion + 1,
          // Only switch selected scene if current one was removed
          ...(!currentStillExists && firstWithContent ? { selectedSceneId: firstWithContent.id } : {}),
        }
      })
      // Persist all updated scene HTMLs (awaited to prevent data loss on tab close)
      const writeEntries: { sceneId: string; promise: Promise<void> }[] = []
      for (const scene of updatedScenes) {
        if (scene.sceneHTML) {
          const p = fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html: scene.sceneHTML }),
          }).then(async (r) => {
            if (!r.ok) {
              console.error(`[Store] POST /api/scene failed for ${scene.id}: ${r.status}`)
              // Retry once after a short delay with timeout (helps with 409 conflicts)
              await new Promise((resolve) => setTimeout(resolve, 100))
              const retryController = new AbortController()
              const retryTimeout = setTimeout(() => retryController.abort(), 15000)
              try {
                const r2 = await fetch('/api/scene', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: scene.id, html: scene.sceneHTML }),
                  signal: retryController.signal,
                })
                if (!r2.ok) throw new Error(`Save failed for scene ${scene.id} (${r2.status})`)
              } finally {
                clearTimeout(retryTimeout)
              }
            }
          })
          writeEntries.push({ sceneId: scene.id, promise: p as Promise<void> })
        } else {
          console.warn(`[Store] Scene ${scene.id.slice(0, 8)}… has empty sceneHTML, skipping file write`)
        }
      }
      // Await all writes — prevents data loss if browser closes before writes finish
      const results = await Promise.allSettled(writeEntries.map((e) => e.promise))
      const errorEntries: Record<string, string> = {}
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'rejected') {
          const sceneId = writeEntries[i].sceneId
          console.error(`[Store] Scene HTML write failed for ${sceneId}:`, (results[i] as PromiseRejectedResult).reason)
          errorEntries[sceneId] = 'Scene file write failed after agent run'
        }
      }
      if (Object.keys(errorEntries).length > 0) {
        set({ sceneWriteErrors: { ...get().sceneWriteErrors, ...errorEntries } })
      }
    },

    // ── Model configuration ────────────────────────────────────────────────
    setModelConfigs: (configs: ModelConfig[]) => set({ modelConfigs: configs }),

    toggleModelEnabled: (modelId: string) => {
      set((state) => ({
        modelConfigs: state.modelConfigs.map((m) => (m.id === modelId ? { ...m, enabled: !m.enabled } : m)),
      }))
    },

    updateProviderConfig: (provider: string, updates: Partial<ProviderConfig>) => {
      set((state) => ({
        providerConfigs: state.providerConfigs.map((p) => (p.provider === provider ? { ...p, ...updates } : p)),
      }))
    },

    addCustomModel: (config: ModelConfig) => {
      set((state) => ({
        modelConfigs: [...state.modelConfigs, { ...config, isDefault: false }],
      }))
    },

    removeCustomModel: (modelId: string) => {
      set((state) => ({
        modelConfigs: state.modelConfigs.filter((m) => m.id !== modelId || m.isDefault),
      }))
    },

    // ── Agent configuration ────────────────────────────────────────────────
    setAgentConfigs: (configs: AgentConfig[]) => set({ agentConfigs: configs }),

    toggleAgentEnabled: (agentId: string) => {
      set((state) => ({
        agentConfigs: state.agentConfigs.map((a) => (a.id === agentId ? { ...a, isEnabled: !a.isEnabled } : a)),
      }))
    },

    updateAgentPrompt: (agentId: string, prompt: string) => {
      set((state) => ({
        agentConfigs: state.agentConfigs.map((a) => (a.id === agentId ? { ...a, systemPrompt: prompt } : a)),
      }))
    },

    addCustomAgent: (config: AgentConfig) => {
      set((state) => ({
        agentConfigs: [...state.agentConfigs, { ...config, isBuiltIn: false }],
      }))
    },

    removeCustomAgent: (agentId: string) => {
      set((state) => ({
        agentConfigs: state.agentConfigs.filter((a) => a.id !== agentId || a.isBuiltIn),
      }))
    },

    // ── Permission actions ────────────────────────────────────────────────────
    updateAPIPermissions: (updates: Partial<APIPermissions>) => {
      set((state) => ({
        project: {
          ...state.project,
          apiPermissions: { ...state.project.apiPermissions, ...updates },
          updatedAt: new Date().toISOString(),
        },
      }))
    },

    setPendingPermissionRequest: (req: import('../types').PermissionRequest | null) =>
      set({ pendingPermissionRequest: req }),

    setSessionPermission: (api: string, decision: string) => {
      set((state) => {
        const newMap = new Map(state.sessionPermissions)
        newMap.set(api, decision)
        return { sessionPermissions: newMap }
      })
    },

    refreshPermissionRules: async () => {
      try {
        const res = await fetch('/api/permissions/rules', { credentials: 'include' })
        if (!res.ok) return
        const json = (await res.json()) as { rules: WirePermissionRule[] }
        set({ permissionRules: json.rules.map(hydrateWireRule) })
      } catch (e) {
        console.warn('[store] refreshPermissionRules failed', e)
      }
    },

    createPermissionRule: async (
      input: Omit<import('../types/permissions').PermissionRule, 'id' | 'userId' | 'createdAt'>,
    ) => {
      try {
        const res = await fetch('/api/permissions/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          console.warn('[store] createPermissionRule failed', err)
          return null
        }
        const { rule } = (await res.json()) as { rule: WirePermissionRule }
        const hydrated = hydrateWireRule(rule)
        set((state) => ({ permissionRules: [...state.permissionRules, hydrated] }))
        return hydrated
      } catch (e) {
        console.warn('[store] createPermissionRule failed', e)
        return null
      }
    },

    deletePermissionRule: async (id: string) => {
      try {
        const res = await fetch(`/api/permissions/rules?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) return false
        set((state) => ({ permissionRules: state.permissionRules.filter((r) => r.id !== id) }))
        return true
      } catch (e) {
        console.warn('[store] deletePermissionRule failed', e)
        return false
      }
    },

    setGenerationOverride: (
      api: string,
      overrides: { provider?: string; prompt?: string; config?: Record<string, any> },
    ) => {
      set((state) => ({
        generationOverrides: { ...state.generationOverrides, [api]: overrides },
      }))
    },
    clearGenerationOverride: (api: string) => {
      set((state) => {
        const { [api]: _, ...rest } = state.generationOverrides
        return { generationOverrides: rest }
      })
    },
    setAutoChooseDefault: (genType: string, defaults: { provider: string; config: Record<string, any> }) => {
      set((state) => ({
        autoChooseDefaults: { ...state.autoChooseDefaults, [genType]: defaults },
      }))
    },

    openAgentWithContext: (context: NonNullable<import('./types').VideoStore['agentEditContext']>) => {
      set({
        agentEditContext: context,
        isChatOpen: true,
        chatInputValue:
          context.type === 'element'
            ? `Edit the "${context.elementType}" element "${context.elementId}": `
            : `Edit this layer: `,
      })
    },
  }
}

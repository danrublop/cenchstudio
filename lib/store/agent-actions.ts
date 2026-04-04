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
import { DEFAULT_MODELS, DEFAULT_PROVIDER_CONFIGS } from '../agents/model-config'
import { DEFAULT_AGENTS } from '../agents/agent-config'
import type { Set, Get, UndoableState } from './types'
import { MAX_UNDO, normalizeScene, sceneHasRenderableContent } from './helpers'

export function createAgentActions(set: Set, get: Get) {
  return {
    // ── Conversation actions ────────────────────────────────────────────────

    loadConversations: async (projectId: string) => {
      set({ conversationsLoading: true })
      try {
        const res = await fetch(`/api/conversations?projectId=${projectId}`)
        if (!res.ok) throw new Error('Failed to fetch conversations')
        const data = await res.json()
        const convs: ConversationSummary[] = data.conversations ?? []
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
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
        if (!res.ok) throw new Error('Failed to create conversation')
        const data = await res.json()
        const conv: ConversationSummary = data.conversation
        set((state) => ({
          conversations: [conv, ...state.conversations],
          activeConversationId: conv.id,
          chatMessages: [],
        }))
        return conv.id
      } catch (err) {
        console.error('[Conversations] Failed to create:', err)
        return ''
      }
    },

    switchConversation: async (conversationId: string) => {
      set({ activeConversationId: conversationId, chatMessages: [] })
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`)
        if (!res.ok) return
        const data = await res.json()
        // Map DB messages to ChatMessage format
        const msgs: ChatMessage[] = (data.messages ?? []).map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          agentType: m.agentType ?? undefined,
          modelId: m.modelUsed ?? undefined,
          thinking: m.thinkingContent ?? undefined,
          toolCalls: m.toolCalls ?? [],
          usage: m.inputTokens
            ? {
                inputTokens: m.inputTokens,
                outputTokens: m.outputTokens ?? 0,
                apiCalls: m.apiCalls ?? 1,
                costUsd: m.costUsd ?? 0,
                totalDurationMs: m.durationMs ?? 0,
              }
            : undefined,
          userRating: m.userRating ?? undefined,
          generationLogId: m.generationLogId ?? undefined,
          timestamp: new Date(m.createdAt).getTime(),
        }))
        // Guard against stale switch
        if (get().activeConversationId === conversationId) {
          set({ chatMessages: msgs })
        }
      } catch (err) {
        console.error('[Conversations] Failed to load messages:', err)
      }
    },

    renameConversation: async (id: string, title: string) => {
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
      }))
      fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).catch((err) => console.error('[Conversations] Failed to rename:', err))
    },

    pinConversation: async (id: string, pinned: boolean) => {
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? { ...c, isPinned: pinned } : c)),
      }))
      fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: pinned }),
      }).catch((err) => console.error('[Conversations] Failed to pin:', err))
    },

    deleteConversation: async (id: string) => {
      const remaining = get().conversations.filter((c) => c.id !== id)
      set({ conversations: remaining })
      fetch(`/api/conversations/${id}`, { method: 'DELETE' }).catch((err) =>
        console.error('[Conversations] Failed to delete:', err),
      )

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
      set((state) => ({ chatMessages: [...state.chatMessages, msg] }))
      // Persist user messages immediately via conversations API
      const projectId = get().project?.id
      const conversationId = get().activeConversationId
      if (projectId && conversationId && msg.role === 'user' && msg.content) {
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            role: msg.role,
            content: msg.content,
          }),
        }).catch((err) => console.error('[Chat] Failed to persist user message:', err))
      }
    },

    updateChatMessage: (id: string, updates: Partial<ChatMessage>) => {
      set((state) => ({
        chatMessages: state.chatMessages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      }))
    },

    persistChatMessage: (id: string) => {
      const msg = get().chatMessages.find((m) => m.id === id)
      const projectId = get().project?.id
      const conversationId = get().activeConversationId
      if (msg && projectId && conversationId && msg.content) {
        // Persist text content only — images are ephemeral and too large for DB
        const textContent = messageContentToText(msg.content)
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            role: msg.role,
            content: textContent,
            agentType: msg.agentType,
            modelUsed: msg.modelId,
            thinkingContent: msg.thinking,
            toolCalls: msg.toolCalls,
            inputTokens: msg.usage?.inputTokens,
            outputTokens: msg.usage?.outputTokens,
            costUsd: msg.usage?.costUsd,
            durationMs: msg.usage?.totalDurationMs,
            apiCalls: msg.usage?.apiCalls,
            userRating: msg.userRating,
            generationLogId: msg.generationLogId,
          }),
        }).catch((err) => console.error('[Chat] Failed to persist message:', err))
      }
    },

    removeChatMessage: (id: string) =>
      set((state) => ({
        chatMessages: state.chatMessages.filter((m) => m.id !== id),
      })),

    clearChat: () => {
      set({ chatMessages: [] })
      const conversationId = get().activeConversationId
      if (conversationId) {
        fetch(`/api/conversations/${conversationId}/messages`, { method: 'DELETE' }).catch((err) =>
          console.error('[Chat] Failed to clear messages:', err),
        )
      }
    },

    setAgentRunning: (running: boolean) => {
      // Capture undo snapshot when agent starts (before any tool mutations)
      if (running && !get().isAgentRunning) {
        const { scenes, globalStyle, project, _undoStack } = get()
        const safeScenes = scenes.map((s) =>
          s.d3Data !== null && s.d3Data !== undefined ? { ...s, d3Data: JSON.parse(JSON.stringify(s.d3Data)) } : s,
        )
        const snapshot: UndoableState = structuredClone({ scenes: safeScenes, globalStyle, project })
        const newStack = [..._undoStack, snapshot]
        if (newStack.length > MAX_UNDO) newStack.shift()
        set({ _undoStack: newStack, _redoStack: [], isAgentRunning: running })
        return
      }
      set({ isAgentRunning: running })
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

    syncScenesFromAgent: (updatedScenes: Scene[], updatedGlobalStyle: GlobalStyle) => {
      // Undo snapshot already captured in setAgentRunning(true)
      console.log(`[Store] syncScenesFromAgent: ${updatedScenes.length} scenes`)
      for (const s of updatedScenes) {
        console.log(
          `[Store]   scene ${s.id.slice(0, 8)}… type=${s.sceneType} html=${s.sceneHTML?.length ?? 0} svg=${s.svgContent?.length ?? 0} canvas=${s.canvasCode?.length ?? 0} code=${s.sceneCode?.length ?? 0} lottie=${s.lottieSource?.length ?? 0}`,
        )
      }

      // Auto-remove empty default scenes if the agent created new ones with content
      const hasContentScene = updatedScenes.some(sceneHasRenderableContent)

      set((state) => {
        // Check which existing scenes have chat messages worth preserving
        const scenesWithMessages = new Set(state.scenes.filter((s) => s.messages?.length).map((s) => s.id))

        const cleanedScenes = hasContentScene
          ? updatedScenes.filter((s) => {
              if (sceneHasRenderableContent(s)) return true
              if (s.prompt) return true
              // Keep scenes that have local chat messages (user was talking on this scene)
              if (scenesWithMessages.has(s.id)) return true
              console.log(`[Store] Removing empty scene: ${s.id.slice(0, 8)}… "${s.name}"`)
              return false
            })
          : updatedScenes
        const finalScenes = cleanedScenes.length > 0 ? cleanedScenes : updatedScenes

        // Preserve per-scene messages — server-side scenes don't carry local chat history
        const mergedScenes = finalScenes.map((newScene) => {
          const existing = state.scenes.find((s) => s.id === newScene.id)
          const merged = existing?.messages?.length ? { ...newScene, messages: existing.messages } : newScene
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
      // Persist all updated scene HTMLs
      const writePromises: Promise<void>[] = []
      for (const scene of updatedScenes) {
        if (scene.sceneHTML) {
          const p = fetch('/api/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: scene.id, html: scene.sceneHTML }),
          })
            .then(async (r) => {
              if (!r.ok) {
                console.error(`[Store] POST /api/scene failed for ${scene.id}: ${r.status}`)
                // Retry once after a short delay (helps with 409 conflicts)
                await new Promise((resolve) => setTimeout(resolve, 100))
                const r2 = await fetch('/api/scene', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: scene.id, html: scene.sceneHTML }),
                })
                if (!r2.ok) console.error(`[Store] Retry also failed for ${scene.id}: ${r2.status}`)
              }
            })
            .catch((err) => console.error('[Store] Failed to write scene HTML:', scene.id, err))
          writePromises.push(p as Promise<void>)
        } else {
          console.warn(`[Store] Scene ${scene.id.slice(0, 8)}… has empty sceneHTML, skipping file write`)
        }
      }
      // Wait for all writes to complete (or fail) before proceeding
      Promise.allSettled(writePromises).then((results) => {
        const failures = results.filter((r) => r.status === 'rejected')
        if (failures.length > 0) {
          console.error(`[Store] ${failures.length}/${results.length} scene HTML writes failed`)
        }
      })
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

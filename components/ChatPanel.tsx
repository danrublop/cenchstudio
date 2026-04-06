'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Send,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Bot,
  X,
  Loader2,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  XCircle,
  Wrench,
  Plus,
  Pin,
  Trash2,
  History,
  ShieldAlert,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useVideoStore } from '@/lib/store'
import type {
  ChatMessage,
  AgentType,
  ModelId,
  ThinkingMode,
  SSEEvent,
  ToolCallRecord,
  UsageStats,
  ImageAttachment,
  ModelTier,
} from '@/lib/agents/types'
import { messageContentToText } from '@/lib/agents/types'
import { AGENT_COLORS, AGENT_LABELS } from '@/lib/agents/prompts'
import type { Scene } from '@/lib/types'
import { syncSceneGraphWithScenes } from '@/lib/scene-graph-sync'

import { MessageBubble } from './chat/MessageBubble'
import { ConversationContextMenu } from './chat/ConversationContextMenu'
import { ThinkingBubble } from './chat/ThinkingBubble'

function parseChatPanelSseEvent(jsonStr: string, label: string): SSEEvent | null {
  try {
    return JSON.parse(jsonStr) as SSEEvent
  } catch (e) {
    console.warn(
      `[ChatPanel] SSE JSON parse failed (${label}):`,
      (e as Error).message,
      `len=${jsonStr.length}`,
      jsonStr.slice(0, 160),
    )
    return null
  }
}

// ── Main ChatPanel ────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const {
    chatMessages,
    addChatMessage,
    persistUserMessage,
    updateChatMessage,
    persistChatMessage,
    clearChat,
    sessionPermissions,
    setSessionPermission,
    isAgentRunning,
    setAgentRunning,
    setAgentType,
    setAgentModelId,
    agentOverride,
    setAgentOverride,
    modelOverride,
    setModelOverride,
    modelTier,
    setModelTier,
    thinkingMode,
    setThinkingMode,
    sceneContext,
    activeTools,
    scenes,
    globalStyle,
    project,
    selectedSceneId,
    modelConfigs,
    syncScenesFromAgent,
    updateSceneGraph,
    sceneHtmlVersion,
    chatInputValue,
    setChatInputValue,
    isChatOpen,
    conversations,
    activeConversationId,
    conversationsLoading,
    loadConversations,
    newConversation,
    switchConversation,
    renameConversation,
    pinConversation,
    deleteConversation,
  } = useVideoStore()

  const [isThinking, setIsThinking] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showThinkingMenu, setShowThinkingMenu] = useState(false)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [activeToolName, setActiveToolName] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)

  // Handle thumbs up/down feedback
  const handleRate = useCallback(
    (msgId: string, rating: number) => {
      const msg = chatMessages.find((m) => m.id === msgId)
      if (!msg) return

      // Update local state immediately
      const effectiveRating = rating === 0 ? undefined : rating
      updateChatMessage(msgId, { userRating: effectiveRating })

      // Send to backend if we have a generation log ID
      if (msg.generationLogId && rating > 0) {
        fetch('/api/generation-log', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logId: msg.generationLogId,
            userRating: rating,
          }),
        }).catch((err) => console.error('[Chat] Failed to send feedback:', err))
      }
    },
    [chatMessages, updateChatMessage],
  )

  const handlePermission = useCallback(
    (msgId: string, api: string, decision: 'allow' | 'deny') => {
      setSessionPermission(api, decision)
      const msg = chatMessages.find((m) => m.id === msgId)
      if (!msg?.pendingPermissions) return
      const updated = msg.pendingPermissions.map((p) => (p.api === api ? { ...p, resolved: decision } : p))
      updateChatMessage(msgId, { pendingPermissions: updated })
    },
    [chatMessages, setSessionPermission, updateChatMessage],
  )

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, isThinking])

  const sendMessage = useCallback(async () => {
    const text = chatInputValue.trim()
    if (!text || isAgentRunning || sendingRef.current) return
    sendingRef.current = true

    setChatInputValue('')
    setShowModelMenu(false)
    setShowAgentMenu(false)

    // Ensure we have an active conversation before sending
    let convId = activeConversationId
    if (!convId && project?.id) {
      convId = await newConversation(project.id)
    }
    if (!convId) {
      sendingRef.current = false
      return
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    addChatMessage(userMsg)
    await persistUserMessage(userMsg)

    // Auto-title conversation from first message
    if (chatMessages.length === 0 && activeConversationId) {
      const autoTitle = text.slice(0, 40) + (text.length > 40 ? '...' : '')
      renameConversation(activeConversationId, autoTitle)
    }

    // Add pending assistant message
    const assistantMsgId = uuidv4()
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      agentType: agentOverride ?? undefined,
      timestamp: Date.now(),
    }
    addChatMessage(assistantMsg)
    setStreamingMsgId(assistantMsgId)
    setIsThinking(true)
    setAgentRunning(true)

    // Build history (last 10 messages, excluding the pending assistant msg)
    const historyMsgs = chatMessages.slice(-10)

    const requestBody = {
      message: text,
      agentOverride: agentOverride ?? undefined,
      modelOverride: modelOverride ?? undefined,
      modelTier,
      thinkingMode,
      sceneContext,
      activeTools,
      history: historyMsgs,
      projectId: project.id,
      conversationId: activeConversationId,
      scenes,
      globalStyle,
      projectName: project.name,
      outputMode: project.outputMode,
      selectedSceneId,
      enabledModelIds: modelConfigs.filter((m) => m.enabled).map((m) => m.modelId),
    }

    const controller = new AbortController()
    abortRef.current = controller

    let accumulatedText = ''
    let accumulatedThinking = ''
    let accumulatedToolCalls = 0
    const toolCalls: ToolCallRecord[] = []
    let currentToolCall: Partial<ToolCallRecord> | null = null

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.statusText}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const processSSEEvent = (event: SSEEvent) => {
        switch (event.type) {
          case 'thinking':
            setIsThinking(true)
            break

          case 'thinking_start':
            setIsThinking(true)
            updateChatMessage(assistantMsgId, { isThinkingStreaming: true, thinking: '' })
            break

          case 'thinking_token':
            if (event.token) {
              accumulatedThinking += event.token
              updateChatMessage(assistantMsgId, { thinking: accumulatedThinking })
            }
            break

          case 'thinking_complete':
            setIsThinking(false)
            updateChatMessage(assistantMsgId, {
              thinking: event.fullThinking ?? '',
              isThinkingStreaming: false,
            })
            break

          case 'token':
            if (event.token) {
              setIsThinking(false)
              accumulatedText += event.token
              updateChatMessage(assistantMsgId, { content: accumulatedText })
            }
            break

          case 'tool_start':
            if (event.toolName) {
              currentToolCall = {
                id: uuidv4(),
                toolName: event.toolName,
                input: event.toolInput ?? {},
              }
              setActiveToolName(event.toolName)
            }
            break

          case 'tool_complete':
            if (currentToolCall && event.toolResult) {
              const completed: ToolCallRecord = {
                ...(currentToolCall as ToolCallRecord),
                output: event.toolResult,
              }
              toolCalls.push(completed)
              accumulatedToolCalls++
              updateChatMessage(assistantMsgId, { toolCalls: [...toolCalls] })
              currentToolCall = null
            }
            setActiveToolName(null)
            break

          case 'state_change': {
            console.log('[Chat] State change:', event.changes?.[0]?.description)
            if (event.updatedScenes && event.updatedGlobalStyle) {
              const scenes = event.updatedScenes as any[]
              console.log(`[Chat] Final state sync: ${scenes.length} scenes`)
              for (const s of scenes) {
                console.log(
                  `[Chat]   ${s.id?.slice(0, 8)}… "${s.name}" type=${s.sceneType} html=${s.sceneHTML?.length ?? 0} canvas=${s.canvasCode?.length ?? 0} code=${s.sceneCode?.length ?? 0}`,
                )
              }
              syncScenesFromAgent(event.updatedScenes as typeof scenes, event.updatedGlobalStyle as typeof globalStyle)
              const mergedGraph = syncSceneGraphWithScenes(
                event.updatedScenes as Scene[],
                event.updatedSceneGraph ?? useVideoStore.getState().project.sceneGraph,
              )
              updateSceneGraph(mergedGraph)
            }
            if (event.generationLogId) {
              updateChatMessage(assistantMsgId, { generationLogId: event.generationLogId })
            }
            break
          }

          case 'done': {
            console.log(
              '[Chat] Done event:',
              event.agentType,
              event.modelId,
              event.usage ? `$${event.usage.costUsd}` : 'no usage',
            )
            if (event.agentType) {
              setAgentType(event.agentType)
              updateChatMessage(assistantMsgId, {
                agentType: event.agentType,
                modelId: event.modelId,
                content: event.fullText ?? accumulatedText,
                toolCalls: event.toolCalls ?? toolCalls,
                usage: event.usage,
              })
            }
            break
          }

          case 'error':
            console.error('[Chat] Agent error:', event.error)
            updateChatMessage(assistantMsgId, {
              content: event.error ? `Error: ${event.error}` : 'An error occurred.',
            })
            break
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[Chat] Stream ended')
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          const ev = parseChatPanelSseEvent(jsonStr, 'chunk')
          if (ev) processSSEEvent(ev)
        }
      }

      // Flush any remaining buffered event after stream ends
      const remaining = buffer.trim()
      if (remaining.startsWith('data: ')) {
        const jsonStr = remaining.slice(6).trim()
        if (jsonStr) {
          const evRem = parseChatPanelSseEvent(jsonStr, 'flush')
          if (evRem) processSSEEvent(evRem)
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // If aborted before any content arrived, remove the empty message
        const hadChanges = accumulatedToolCalls > 0
        if (!accumulatedText) {
          updateChatMessage(assistantMsgId, {
            content: hadChanges
              ? '*(cancelled — partial changes may have been applied. Use Ctrl+Z to undo.)*'
              : '*(cancelled)*',
          })
        } else if (hadChanges) {
          updateChatMessage(assistantMsgId, {
            content: accumulatedText + '\n\n*(cancelled — partial changes applied. Use Ctrl+Z to undo.)*',
          })
        }
      } else {
        updateChatMessage(assistantMsgId, {
          content: `Failed to connect to agent: ${(err as Error).message}`,
        })
      }
    } finally {
      setIsThinking(false)
      setStreamingMsgId(null)
      setActiveToolName(null)
      setAgentRunning(false)
      abortRef.current = null
      sendingRef.current = false
      // Persist the finalized assistant message to DB
      persistChatMessage(assistantMsgId)
      void useVideoStore.getState().refreshProjectFromServer()
      setTimeout(() => {
        void useVideoStore.getState().refreshProjectFromServer()
      }, 2500)
    }
  }, [
    chatInputValue,
    isAgentRunning,
    agentOverride,
    modelOverride,
    modelTier,
    thinkingMode,
    sceneContext,
    activeTools,
    chatMessages,
    scenes,
    globalStyle,
    project,
    selectedSceneId,
    modelConfigs,
    addChatMessage,
    persistUserMessage,
    updateChatMessage,
    persistChatMessage,
    syncScenesFromAgent,
    updateSceneGraph,
    setChatInputValue,
    setAgentRunning,
    setAgentType,
    activeConversationId,
    newConversation,
    renameConversation,
  ])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleAbort = () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setIsThinking(false)
    setStreamingMsgId(null)
    setActiveToolName(null)
    setAgentRunning(false)
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel)] relative">
      {/* Conversation tabs header */}
      <div className="flex items-center flex-shrink-0 border-b border-[var(--color-border)]">
        <div
          className="flex-1 flex items-center gap-0.5 overflow-x-auto px-1.5 py-1.5"
          style={{ scrollbarWidth: 'none' }}
        >
          {conversations.map((conv) => (
            <span
              key={conv.id}
              onClick={() => conv.id !== activeConversationId && switchConversation(conv.id)}
              onDoubleClick={() => {
                setRenamingId(conv.id)
                setRenameValue(conv.title)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ id: conv.id, x: e.clientX, y: e.clientY })
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[12px] whitespace-nowrap cursor-pointer select-none transition-all flex-shrink-0 ${
                conv.id === activeConversationId
                  ? 'bg-[var(--color-bg)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]/50'
              }`}
            >
              {conv.isPinned && <Pin size={8} className="opacity-40 flex-shrink-0" />}
              {renamingId === conv.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    renameConversation(conv.id, renameValue)
                    setRenamingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameConversation(conv.id, renameValue)
                      setRenamingId(null)
                    }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-b border-[var(--color-accent)] outline-none text-[12px] text-[var(--color-text-primary)] w-24"
                />
              ) : (
                <span
                  className="overflow-hidden whitespace-nowrap max-w-[120px]"
                  style={{
                    WebkitMaskImage: 'linear-gradient(to right, black 85px, transparent 115px)',
                    maskImage: 'linear-gradient(to right, black 85px, transparent 115px)',
                  }}
                >
                  {conv.title}
                </span>
              )}
            </span>
          ))}
          <span
            onClick={() => project?.id && newConversation(project.id)}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]/50 cursor-pointer transition-all flex-shrink-0"
            title="New conversation"
          >
            <Plus size={13} />
          </span>
        </div>
        <span
          onClick={() => setShowHistory(true)}
          className="flex items-center justify-center w-7 h-7 mr-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]/50 cursor-pointer transition-all flex-shrink-0"
          title="Chat history"
        >
          <History size={13} />
        </span>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ConversationContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            const conv = conversations.find((c) => c.id === contextMenu.id)
            setRenamingId(contextMenu.id)
            setRenameValue(conv?.title ?? '')
            setContextMenu(null)
          }}
          onPin={() => {
            const conv = conversations.find((c) => c.id === contextMenu.id)
            pinConversation(contextMenu.id, !conv?.isPinned)
            setContextMenu(null)
          }}
          onClear={() => {
            if (contextMenu.id === activeConversationId) clearChat()
            setContextMenu(null)
          }}
          onDelete={() => {
            deleteConversation(contextMenu.id)
            setContextMenu(null)
          }}
        />
      )}

      {/* History modal */}
      {showHistory && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[var(--color-panel)]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] flex-shrink-0">
            <History size={13} className="text-[var(--color-text-muted)]" />
            <span className="text-[12px] font-medium text-[var(--color-text-primary)] flex-1">Chat History</span>
            <span
              onClick={() => project?.id && newConversation(project.id).then(() => setShowHistory(false))}
              className="text-[11px] px-2 py-0.5 rounded cursor-pointer bg-[var(--kbd-bg)] border border-[var(--kbd-border)] text-[var(--kbd-text)] hover:brightness-110 transition-all"
            >
              New Chat
            </span>
            <span
              onClick={() => setShowHistory(false)}
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-all"
            >
              <X size={14} />
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 && (
              <div className="flex items-center justify-center h-20 text-sm text-[var(--color-text-muted)]">
                No conversations yet
              </div>
            )}
            {conversations.map((conv) => {
              const preview = conv.messages?.[0]
              const isActive = conv.id === activeConversationId
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    switchConversation(conv.id)
                    setShowHistory(false)
                  }}
                  className={`rounded-lg px-3 py-2.5 cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-[var(--color-bg)] border-[var(--color-border)]'
                      : 'border-transparent hover:bg-[var(--color-bg)]/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {conv.isPinned && (
                      <Pin size={9} className="text-[var(--color-text-muted)] opacity-50 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm overflow-hidden whitespace-nowrap flex-1 ${isActive ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]'}`}
                      style={{
                        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)',
                        maskImage: 'linear-gradient(to right, black calc(100% - 20px), transparent 100%)',
                      }}
                    >
                      {conv.title}
                    </span>
                    {conv.totalCostUsd > 0 && (
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono flex-shrink-0">
                        ${conv.totalCostUsd.toFixed(4)}
                      </span>
                    )}
                  </div>
                  {preview && (
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-1 truncate opacity-60">
                      {preview.role === 'assistant' ? 'Agent: ' : ''}
                      {(typeof preview.content === 'string'
                        ? preview.content
                        : messageContentToText(preview.content)
                      ).slice(0, 60)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-0 min-h-0">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-muted)] select-none">
            <Bot size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1 opacity-60">Cench Studio AI</p>
            <p className="text-sm opacity-40 max-w-[200px] leading-relaxed">
              Describe what you want to create or edit. I'll build it for you.
            </p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isStreaming={streamingMsgId === msg.id}
            activeToolName={streamingMsgId === msg.id ? activeToolName : null}
            onRate={handleRate}
            onPermission={handlePermission}
          />
        ))}

        {isThinking && streamingMsgId === null && <ThinkingBubble />}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-3 pt-2">
        <div className="rounded-xl border-[3px] border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden focus-within:border-[var(--color-text-muted)]/40 transition-colors">
          {/* Textarea */}
          <textarea
            value={chatInputValue}
            onChange={(e) => setChatInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to Agent..."
            disabled={isAgentRunning}
            rows={2}
            className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none disabled:opacity-50 min-h-[48px] max-h-[120px]"
          />

          {/* Bottom bar: controls + send */}
          <div className="flex items-center gap-1 px-2.5 pb-2.5">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowModelMenu((o) => !o)
                  setShowThinkingMenu(false)
                  setShowAgentMenu(false)
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <span className="font-medium">
                  {modelTier === 'auto' ? 'Auto' : modelTier === 'premium' ? 'Premium' : 'Budget'}
                </span>
                <ChevronUp size={10} className="opacity-50" />
              </button>

              {showModelMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl z-50 py-1 overflow-hidden">
                  {(
                    [
                      { id: 'auto' as ModelTier, label: 'Auto', sub: 'Balanced — good for most things' },
                      { id: 'premium' as ModelTier, label: 'Premium', sub: 'Most capable models' },
                      { id: 'budget' as ModelTier, label: 'Budget', sub: 'Cheapest models' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setModelTier(opt.id)
                        setModelOverride(null)
                        setShowModelMenu(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-border)]/30 transition-colors ${
                        modelTier === opt.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                  <div className="border-t border-[var(--color-border)] my-1" />
                  <div className="px-3 py-1 text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">
                    Override
                  </div>
                  {[
                    { id: null as ModelId | null, label: 'None' },
                    ...modelConfigs
                      .filter((m) => m.enabled && m.supportsTools !== false)
                      .map((m) => ({ id: m.modelId as ModelId | null, label: m.displayName })),
                  ].map((opt) => (
                    <button
                      key={opt.id ?? 'none'}
                      onClick={() => {
                        setModelOverride(opt.id as ModelId | null)
                        setShowModelMenu(false)
                      }}
                      className={`w-full text-left px-3 py-1 text-[12px] hover:bg-[var(--color-border)]/30 transition-colors ${
                        modelOverride === opt.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Thinking mode selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowThinkingMenu((o) => !o)
                  setShowModelMenu(false)
                  setShowAgentMenu(false)
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <span className="font-medium" style={thinkingMode === 'deep' ? { color: '#f59e0b' } : {}}>
                  {thinkingMode === 'off' ? 'Think Off' : thinkingMode === 'adaptive' ? 'Think Auto' : 'Think Deep'}
                </span>
                <ChevronUp size={10} className="opacity-50" />
              </button>

              {showThinkingMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl z-50 py-1 overflow-hidden">
                  {(
                    [
                      { id: 'off' as ThinkingMode, label: 'Off', sub: 'Fastest — no reasoning', color: '#6b7280' },
                      {
                        id: 'adaptive' as ThinkingMode,
                        label: 'Auto',
                        sub: 'Claude decides when to think',
                        color: '#f59e0b',
                      },
                      {
                        id: 'deep' as ThinkingMode,
                        label: 'Deep',
                        sub: 'Always thinks — best for complex',
                        color: '#f59e0b',
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setThinkingMode(opt.id)
                        setShowThinkingMenu(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-border)]/30 transition-colors ${
                        thinkingMode === opt.id ? 'font-semibold' : ''
                      }`}
                    >
                      <div className="font-medium flex items-center gap-1.5">
                        <Lightbulb
                          size={9}
                          className="flex-shrink-0"
                          style={{ color: opt.color, width: 9, height: 9, strokeWidth: 2.5 }}
                        />
                        <span
                          style={
                            thinkingMode === opt.id ? { color: opt.color } : { color: 'var(--color-text-primary)' }
                          }
                        >
                          {opt.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 ml-[16.5px]">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Agent mode selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAgentMenu((o) => !o)
                  setShowModelMenu(false)
                  setShowThinkingMenu(false)
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <span className="font-medium" style={agentOverride ? { color: AGENT_COLORS[agentOverride] } : {}}>
                  {agentOverride ? AGENT_LABELS[agentOverride] : 'Agent'}
                </span>
                <ChevronUp size={10} className="opacity-50" />
              </button>

              {showAgentMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl z-50 py-1 overflow-hidden">
                  {(
                    [
                      { id: null, label: 'Agent', sub: 'Auto-routes to the right agent', color: '#6b7280' },
                      {
                        id: 'planner' as AgentType,
                        label: 'Planner',
                        sub: 'Storyboard only — review before build',
                        color: AGENT_COLORS['planner'],
                      },
                      {
                        id: 'director' as AgentType,
                        label: 'Director',
                        sub: 'Plans multi-scene videos',
                        color: AGENT_COLORS['director'],
                      },
                      {
                        id: 'scene-maker' as AgentType,
                        label: 'Scene Maker',
                        sub: 'Generates scene content',
                        color: AGENT_COLORS['scene-maker'],
                      },
                      {
                        id: 'editor' as AgentType,
                        label: 'Editor',
                        sub: 'Surgical edits to elements',
                        color: AGENT_COLORS['editor'],
                      },
                      {
                        id: 'dop' as AgentType,
                        label: 'DoP',
                        sub: 'Global style & transitions',
                        color: AGENT_COLORS['dop'],
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id ?? 'auto'}
                      onClick={() => {
                        setAgentOverride(opt.id)
                        setShowAgentMenu(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-border)]/30 transition-colors ${
                        agentOverride === opt.id ? 'font-semibold' : ''
                      }`}
                    >
                      <div className="font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                        <span
                          style={
                            agentOverride === opt.id ? { color: opt.color } : { color: 'var(--color-text-primary)' }
                          }
                        >
                          {opt.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 ml-3">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Send / Stop button */}
            {isAgentRunning ? (
              <button
                onClick={handleAbort}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-900/60 text-red-300 hover:bg-red-800/70 transition-colors"
                title="Stop"
              >
                <X size={14} />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!chatInputValue.trim()}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] hover:bg-[var(--color-text-muted)]/30 hover:text-[var(--color-text-primary)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="Send (Enter)"
              >
                <ChevronUp size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, ChevronUp, ChevronDown, ChevronRight, Bot, X, Loader2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useVideoStore } from '@/lib/store'
import type { ChatMessage, AgentType, ModelId, SSEEvent, ToolCallRecord, UsageStats } from '@/lib/agents/types'
import { AGENT_COLORS, AGENT_LABELS } from '@/lib/agents/prompts'
import type { ModelTier } from '@/lib/agents/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const AGENT_BORDER_COLORS: Record<AgentType, string> = {
  router: '#6b7280',
  director: '#a855f7',
  'scene-maker': '#3b82f6',
  editor: '#22c55e',
  dop: '#f97316',
}

// ── Tool Call Display ──────────────────────────────────────────────────────────

function ToolCallItem({ call }: { call: ToolCallRecord }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden text-[11px]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-[var(--color-border)]/30 transition-colors"
      >
        {open ? (
          <ChevronDown size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" />
        )}
        <span className="font-mono text-[var(--color-accent)]">{call.toolName}</span>
        {call.output && (
          <span className={`ml-auto text-[10px] font-medium ${call.output.success ? 'text-green-400' : 'text-red-400'}`}>
            {call.output.success ? 'OK' : 'ERR'}
          </span>
        )}
        {call.durationMs !== undefined && (
          <span className="text-[var(--color-text-muted)] text-[10px] ml-1">{call.durationMs}ms</span>
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-[var(--color-border)]">
          <div>
            <div className="text-[var(--color-text-muted)] text-[10px] mb-0.5 mt-1.5">Input</div>
            <pre className="text-[10px] text-[var(--color-text-muted)] whitespace-pre-wrap font-mono overflow-x-auto max-h-32">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.output && (
            <div>
              <div className="text-[var(--color-text-muted)] text-[10px] mb-0.5">Output</div>
              <pre className={`text-[10px] whitespace-pre-wrap font-mono overflow-x-auto max-h-32 ${
                call.output.success ? 'text-green-400/80' : 'text-red-400/80'
              }`}>
                {call.output.error
                  ? call.output.error
                  : JSON.stringify({ success: call.output.success, changes: call.output.changes }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Usage Display ─────────────────────────────────────────────────────────────

function UsageBadge({ usage }: { usage: UsageStats }) {
  const formatCost = (cost: number) => {
    if (cost < 0.001) return `$${(cost * 1000).toFixed(2)}m`
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(3)}`
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] font-mono">
      <span title="Input tokens">{usage.inputTokens.toLocaleString()} in</span>
      <span className="opacity-40">/</span>
      <span title="Output tokens">{usage.outputTokens.toLocaleString()} out</span>
      <span className="opacity-40">|</span>
      <span title="Estimated cost" className="text-[var(--color-accent)]">{formatCost(usage.costUsd)}</span>
      {usage.apiCalls > 1 && (
        <>
          <span className="opacity-40">|</span>
          <span title="API calls">{usage.apiCalls} calls</span>
        </>
      )}
      <span className="opacity-40">|</span>
      <span title="Duration">{(usage.totalDurationMs / 1000).toFixed(1)}s</span>
    </div>
  )
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const isUser = msg.role === 'user'

  const borderColor = msg.agentType ? AGENT_BORDER_COLORS[msg.agentType] : '#4b5563'
  const agentLabel = msg.agentType ? AGENT_LABELS[msg.agentType] : 'Agent'

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] bg-[var(--color-accent)] rounded-xl rounded-tr-sm px-3 py-2">
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-3">
      <div
        className="max-w-[92%] rounded-xl rounded-tl-sm bg-[var(--color-panel)] overflow-hidden"
        style={{ borderLeft: `2px solid ${borderColor}` }}
      >
        {/* Agent badge bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)]">
          <Bot size={11} style={{ color: borderColor }} />
          <span className="text-[11px] font-semibold" style={{ color: borderColor }}>
            {agentLabel}
          </span>
          {msg.modelId && (
            <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg)] px-1.5 py-0.5 rounded font-mono">
              {msg.modelId.replace('claude-', '')}
            </span>
          )}
          {isStreaming && (
            <Loader2 size={10} className="ml-auto animate-spin text-[var(--color-text-muted)]" />
          )}
        </div>

        {/* Message text */}
        <div className="px-3 py-2">
          {msg.content ? (
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>
          ) : isStreaming ? (
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] text-sm">
              <span className="animate-pulse">thinking</span>
              <span className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          ) : null}
        </div>

        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="px-3 pb-2">
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
              {msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? 's' : ''}
            </div>
            {msg.toolCalls.map(call => (
              <ToolCallItem key={call.id} call={call} />
            ))}
          </div>
        )}

        {/* Usage stats */}
        {msg.usage && !isStreaming && <UsageBadge usage={msg.usage} />}
      </div>
    </div>
  )
}

// ── Typing indicator placeholder ───────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl rounded-tl-sm px-3 py-2">
        <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
          <Loader2 size={11} className="animate-spin" />
          <span className="text-xs">routing</span>
        </div>
      </div>
    </div>
  )
}

// ── Main ChatPanel ─────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const {
    chatMessages, addChatMessage, updateChatMessage, clearChat,
    isAgentRunning, setAgentRunning, setAgentType, setAgentModelId,
    agentOverride, setAgentOverride,
    modelOverride, setModelOverride,
    modelTier, setModelTier,
    sceneContext, activeTools,
    scenes, globalStyle, project, selectedSceneId,
    syncScenesFromAgent, sceneHtmlVersion,
    chatInputValue, setChatInputValue,
    isChatOpen,
  } = useVideoStore()

  const [isThinking, setIsThinking] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, isThinking])

  const sendMessage = useCallback(async () => {
    const text = chatInputValue.trim()
    if (!text || isAgentRunning) return

    setChatInputValue('')
    setShowModelMenu(false)
    setShowAgentMenu(false)

    // Add user message
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    addChatMessage(userMsg)

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
      sceneContext,
      activeTools,
      history: historyMsgs,
      projectId: project.id,
      scenes,
      globalStyle,
      projectName: project.name,
      outputMode: project.outputMode,
      selectedSceneId,
    }

    const controller = new AbortController()
    abortRef.current = controller

    let accumulatedText = ''
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          let event: SSEEvent
          try {
            event = JSON.parse(jsonStr)
          } catch {
            continue
          }

          switch (event.type) {
            case 'thinking':
              setIsThinking(true)
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
              }
              break

            case 'tool_complete':
              if (currentToolCall && event.toolResult) {
                const completed: ToolCallRecord = {
                  ...currentToolCall as ToolCallRecord,
                  output: event.toolResult,
                }
                toolCalls.push(completed)
                updateChatMessage(assistantMsgId, { toolCalls: [...toolCalls] })
                currentToolCall = null
              }
              break

            case 'state_change': {
              // Check for __final_state__ signal with updated scenes
              const ext = event as SSEEvent & { updatedScenes?: unknown; updatedGlobalStyle?: unknown }
              if (ext.updatedScenes && ext.updatedGlobalStyle) {
                syncScenesFromAgent(
                  ext.updatedScenes as typeof scenes,
                  ext.updatedGlobalStyle as typeof globalStyle,
                )
              }
              break
            }

            case 'done':
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

            case 'error':
              updateChatMessage(assistantMsgId, {
                content: event.error ? `Error: ${event.error}` : 'An error occurred.',
              })
              break
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        updateChatMessage(assistantMsgId, {
          content: `Failed to connect to agent: ${(err as Error).message}`,
        })
      }
    } finally {
      setIsThinking(false)
      setStreamingMsgId(null)
      setAgentRunning(false)
      abortRef.current = null
    }
  }, [
    chatInputValue, isAgentRunning, agentOverride, modelOverride, modelTier, sceneContext,
    activeTools, chatMessages, scenes, globalStyle, project, selectedSceneId,
    addChatMessage, updateChatMessage, syncScenesFromAgent,
    setChatInputValue, setAgentRunning, setAgentType,
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
    setAgentRunning(false)
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0 border-b border-[var(--color-border)]">
        <Bot size={14} className="text-[var(--color-text-primary)] opacity-70" />
        <span className="text-[10px] font-bold text-[var(--color-text-primary)] uppercase tracking-widest">Assistant</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={clearChat}
            disabled={chatMessages.length === 0 || isAgentRunning}
            className="no-style p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-30"
            title="Clear chat"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-0 min-h-0"
      >
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-muted)] select-none">
            <Bot size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1 opacity-60">Cench Studio AI</p>
            <p className="text-xs opacity-40 max-w-[200px] leading-relaxed">
              Describe what you want to create or edit. I'll build it for you.
            </p>
          </div>
        )}

        {chatMessages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isStreaming={streamingMsgId === msg.id}
          />
        ))}

        {isThinking && streamingMsgId === null && <ThinkingBubble />}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-3 pt-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden focus-within:border-[var(--color-text-muted)]/40 transition-colors">
          {/* Textarea */}
          <textarea
            value={chatInputValue}
            onChange={e => setChatInputValue(e.target.value)}
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
                onClick={() => { setShowModelMenu(o => !o); setShowAgentMenu(false) }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <span className="font-medium">
                  {modelTier === 'auto' ? 'Auto' : modelTier === 'performance' ? 'Perf' : modelTier === 'fast' ? 'Fast' : 'Balanced'}
                </span>
                <ChevronUp size={10} className="opacity-50" />
              </button>

              {showModelMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl z-50 py-1 overflow-hidden">
                  {([
                    { id: 'auto' as ModelTier, label: 'Auto', sub: 'Default per agent' },
                    { id: 'fast' as ModelTier, label: 'Fast', sub: 'Haiku — cheapest' },
                    { id: 'balanced' as ModelTier, label: 'Balanced', sub: 'Sonnet — good quality' },
                    { id: 'performance' as ModelTier, label: 'Performance', sub: 'Opus + Sonnet — best' },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setModelTier(opt.id); setModelOverride(null); setShowModelMenu(false) }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--color-border)]/30 transition-colors ${
                        modelTier === opt.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                  <div className="border-t border-[var(--color-border)] my-1" />
                  <div className="px-3 py-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Override</div>
                  {([
                    { id: null, label: 'None' },
                    { id: 'claude-haiku-4-5-20251001' as ModelId, label: 'Haiku 4.5' },
                    { id: 'claude-sonnet-4-5-20250514' as ModelId, label: 'Sonnet 4.5' },
                    { id: 'claude-opus-4-5-20250514' as ModelId, label: 'Opus 4.5' },
                  ] as const).map(opt => (
                    <button
                      key={opt.id ?? 'none'}
                      onClick={() => { setModelOverride(opt.id); setShowModelMenu(false) }}
                      className={`w-full text-left px-3 py-1 text-[11px] hover:bg-[var(--color-border)]/30 transition-colors ${
                        modelOverride === opt.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Agent mode selector */}
            <div className="relative">
              <button
                onClick={() => { setShowAgentMenu(o => !o); setShowModelMenu(false) }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <span className="font-medium" style={agentOverride ? { color: AGENT_COLORS[agentOverride] } : {}}>
                  {agentOverride ? AGENT_LABELS[agentOverride] : 'Agent'}
                </span>
                <ChevronUp size={10} className="opacity-50" />
              </button>

              {showAgentMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl z-50 py-1 overflow-hidden">
                  {([
                    { id: null, label: 'Agent', sub: 'Auto-routes to the right agent', color: '#6b7280' },
                    { id: 'director' as AgentType, label: 'Director', sub: 'Plans multi-scene videos', color: AGENT_COLORS['director'] },
                    { id: 'scene-maker' as AgentType, label: 'Scene Maker', sub: 'Generates scene content', color: AGENT_COLORS['scene-maker'] },
                    { id: 'editor' as AgentType, label: 'Editor', sub: 'Surgical edits to elements', color: AGENT_COLORS['editor'] },
                    { id: 'dop' as AgentType, label: 'DoP', sub: 'Global style & transitions', color: AGENT_COLORS['dop'] },
                  ] as const).map(opt => (
                    <button
                      key={opt.id ?? 'auto'}
                      onClick={() => { setAgentOverride(opt.id); setShowAgentMenu(false) }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--color-border)]/30 transition-colors ${
                        agentOverride === opt.id ? 'font-semibold' : ''
                      }`}
                    >
                      <div className="font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                        <span style={agentOverride === opt.id ? { color: opt.color } : { color: 'var(--color-text-primary)' }}>
                          {opt.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 ml-3">{opt.sub}</div>
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

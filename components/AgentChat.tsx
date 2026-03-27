'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, StopCircle, RefreshCw, Check, ChevronUp, Infinity, Zap, Film, Scissors, Palette, PenLine, Paintbrush, BarChart2, Box, Sparkles, MoreHorizontal, Clock, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { TOOL_FILTER_CHIPS } from '@/lib/agent-tools'
import { useVideoStore } from '@/lib/store'
import type { Scene, Message } from '@/lib/types'
import type { AgentType, ModelTier, SSEEvent, ToolCallRecord, UsageStats } from '@/lib/agents/types'
import { AGENT_COLORS } from '@/lib/agents/prompts'
import { v4 as uuidv4 } from 'uuid'

// ── Model tier options ──────────────────────────────────────────────────────────

const MODEL_OPTIONS: { id: ModelTier; modelName: string; tierLabel: string }[] = [
  { id: 'auto', modelName: 'Auto', tierLabel: 'Smart routing' },
  { id: 'fast', modelName: 'Haiku 4.5', tierLabel: 'Budget' },
  { id: 'balanced', modelName: 'Sonnet 4.5', tierLabel: 'Balanced' },
  { id: 'performance', modelName: 'Opus 4.5', tierLabel: 'Performance' },
]

// ── Agent mode options ──────────────────────────────────────────────────────────

const AGENT_OPTIONS: { id: AgentType | null; label: string; desc: string; icon: typeof Infinity; color: string }[] = [
  { id: null, label: 'Agent', desc: 'Auto-routes to the right agent', icon: Infinity, color: '#6b7280' },
  { id: 'director', label: 'Director', desc: 'Plans multi-scene videos', icon: Film, color: AGENT_COLORS['director'] },
  { id: 'scene-maker', label: 'Scene Maker', desc: 'Generates scene content', icon: Zap, color: AGENT_COLORS['scene-maker'] },
  { id: 'editor', label: 'Editor', desc: 'Surgical edits', icon: Scissors, color: AGENT_COLORS['editor'] },
  { id: 'dop', label: 'DoP', desc: 'Global style & transitions', icon: Palette, color: AGENT_COLORS['dop'] },
  // Specialized animation agents
  { id: 'scene-maker', label: 'SVG Artist', desc: 'SVG illustration specialist', icon: PenLine, color: '#f472b6' },
  { id: 'scene-maker', label: 'Canvas Animator', desc: 'Canvas2D & generative art', icon: Paintbrush, color: '#38bdf8' },
  { id: 'scene-maker', label: 'D3 Analyst', desc: 'Data charts & visualization', icon: BarChart2, color: '#4ade80' },
  { id: 'scene-maker', label: '3D Designer', desc: 'Three.js 3D scenes', icon: Box, color: '#c084fc' },
  { id: 'scene-maker', label: 'Motion Designer', desc: 'Choreographed animations', icon: Sparkles, color: '#fbbf24' },
]

// ── Keyword guard map ────────────────────────────────────────────────────────────

const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  'avatars': ['heygen', 'avatar', 'talking head'],
  'ai-video': ['veo3', 'veo', 'ai video', 'generate video'],
  'three': ['3d', 'three.js', 'threejs', '3d scene', '3d object'],
  'd3': ['d3 chart', 'bar chart', 'line chart', 'pie chart', 'scatter plot', 'data visualization'],
  'ai-images': ['generate image', 'ai image', 'flux', 'dall-e', 'ideogram', 'recraft'],
  'lottie': ['lottie', 'lottie animation'],
  'interactions': ['hotspot', 'quiz', 'branching', 'interactive'],
}

// ── Props ────────────────────────────────────────────────────────────────────────

interface Props {
  scene: Scene
  onOpenEditor?: () => void
}

export default function AgentChat({ scene, onOpenEditor }: Props) {
  const {
    updateScene, scenes, globalStyle, project, selectedSceneId,
    agentOverride, setAgentOverride,
    modelTier, setModelTier,
    modelOverride,
    sceneContext, activeTools, toggleActiveTool,
    setSettingsTab,
  } = useVideoStore()

  const [input, setInput] = useState('')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [keywordWarning, setKeywordWarning] = useState<{ capability: string; label: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const messages = scene.messages || []

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText])

  // ── Send message to agent framework ─────────────────────────────────────────

  // ── Keyword guard ──────────────────────────────────────────────────────────

  const checkKeywordGuard = useCallback((text: string): { capability: string; label: string } | null => {
    const lower = text.toLowerCase()
    for (const [capId, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
      if (!activeTools.includes(capId)) {
        for (const kw of keywords) {
          if (lower.includes(kw)) {
            const chip = TOOL_FILTER_CHIPS.find(c => c.id === capId)
            return { capability: capId, label: chip?.label ?? capId }
          }
        }
      }
    }
    return null
  }, [activeTools])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return

    // Keyword guard — check for disabled capabilities
    if (!keywordWarning) {
      const warning = checkKeywordGuard(input)
      if (warning) {
        setKeywordWarning(warning)
        return // Don't send yet, show warning
      }
    }
    setKeywordWarning(null)

    const userText = input.trim()
    setInput('')
    setShowModelMenu(false)
    setShowAgentMenu(false)
    setShowFilterMenu(false)

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      status: 'done',
    }

    const pendingAssistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'pending',
    }

    const newMessages = [...messages, userMsg, pendingAssistantMsg]
    updateScene(scene.id, { messages: newMessages, prompt: userText })

    setIsGenerating(true)
    setStreamingText('')

    const historyMsgs = messages
      .filter(m => m.status === 'done')
      .slice(-10)
      .map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      }))

    const controller = new AbortController()
    abortRef.current = controller

    let accumulatedText = ''
    let finalAgentType: AgentType | undefined
    let finalUsage: UsageStats | undefined
    const toolCalls: ToolCallRecord[] = []

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
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
          selectedSceneId: scene.id,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Agent error: ${response.statusText}`)
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
          try { event = JSON.parse(jsonStr) } catch { continue }

          switch (event.type) {
            case 'token':
              if (event.token) {
                accumulatedText += event.token
                setStreamingText(accumulatedText)
              }
              break

            case 'tool_complete':
              if (event.toolResult) {
                toolCalls.push({
                  id: uuidv4(),
                  toolName: event.toolName ?? 'unknown',
                  input: event.toolInput ?? {},
                  output: event.toolResult,
                })
              }
              break

            case 'state_change': {
              const ext = event as SSEEvent & { updatedScenes?: Scene[]; updatedGlobalStyle?: typeof globalStyle }
              if (ext.updatedScenes && ext.updatedGlobalStyle) {
                const { syncScenesFromAgent } = useVideoStore.getState()
                syncScenesFromAgent(ext.updatedScenes, ext.updatedGlobalStyle)
              }
              break
            }

            case 'done':
              finalAgentType = event.agentType
              finalUsage = event.usage
              if (event.fullText) accumulatedText = event.fullText
              break

            case 'error':
              accumulatedText = `Error: ${event.error ?? 'Something went wrong'}`
              break
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        accumulatedText = `Failed: ${(err as Error).message}`
      }
    } finally {
      setIsGenerating(false)
      setStreamingText('')
      abortRef.current = null

      let finalContent = accumulatedText
      if (toolCalls.length > 0) {
        const toolSummary = toolCalls
          .map(t => `${t.output?.success ? '✓' : '✗'} ${t.toolName}`)
          .join(', ')
        finalContent = `${accumulatedText}\n\n_Tools: ${toolSummary}_`
      }
      if (finalUsage) {
        finalContent += `\n_${finalUsage.inputTokens + finalUsage.outputTokens} tokens · $${finalUsage.costUsd.toFixed(4)} · ${(finalUsage.totalDurationMs / 1000).toFixed(1)}s_`
      }

      const updatedMessages = [...messages, userMsg, {
        ...pendingAssistantMsg,
        content: finalContent || 'Done.',
        status: 'done' as const,
      }]
      updateScene(scene.id, { messages: updatedMessages })
    }
  }, [
    input, isGenerating, messages, scene.id, agentOverride, modelTier,
    modelOverride, sceneContext, activeTools, scenes, globalStyle, project,
    updateScene, selectedSceneId, keywordWarning, checkKeywordGuard,
  ])

  const handleAbort = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
    setStreamingText('')
  }

  // ── Derived state ──────────────────────────────────────────────────────────────

  const currentModel = MODEL_OPTIONS.find(m => m.id === modelTier) ?? MODEL_OPTIONS[0]
  const currentAgent = AGENT_OPTIONS.find(a => a.id === agentOverride) ?? AGENT_OPTIONS[0]
  const AgentIcon = currentAgent.icon

  // Separate core agents from specialized ones
  const coreAgents = AGENT_OPTIONS.slice(0, 5)
  const specializedAgents = AGENT_OPTIONS.slice(5)

  // Derive chat name from first user message
  const chatName = messages.find(m => m.role === 'user' && m.status === 'done')?.content.slice(0, 30) || 'New Chat'

  const handleNewChat = () => {
    updateScene(scene.id, { messages: [] })
    setInput('')
    setStreamingText('')
    setKeywordWarning(null)
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] overflow-hidden">
      {/* ── Chat Header ── */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 border-b border-[var(--color-border)]">
        <div className="flex items-center px-2 py-1 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-md translate-y-[-0.5px]">
          <span className="text-[10px] font-bold text-[var(--color-text-primary)] truncate max-w-[140px]">
            {chatName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="no-style flex items-center justify-center w-8 h-6 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
            data-tooltip="New Chat"
            data-tooltip-pos="bottom"
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
          <button
            className="no-style flex items-center justify-center w-8 h-6 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all opacity-40 cursor-default"
            data-tooltip="Chat history coming soon"
            data-tooltip-pos="bottom"
          >
            <Clock size={15} strokeWidth={2.5} />
          </button>
          <div className="relative">
            <button
              onClick={() => { setShowFilterMenu(o => !o); setShowModelMenu(false); setShowAgentMenu(false) }}
              className={`no-style flex items-center justify-center w-8 h-6 transition-all ${
                showFilterMenu
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
              data-tooltip="Chat settings"
              data-tooltip-pos="bottom-left"
            >
              <MoreHorizontal size={15} strokeWidth={2.5} className="translate-y-[1px]" />
            </button>

            {/* ── Capability filter dropdown ── */}
            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setShowFilterMenu(false)} />
                <div className="fixed top-[62px] right-4 z-[9999] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-4 w-[600px] animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
                  <div className="flex gap-6">
                    {/* Intelligence Section */}
                    <div className="flex-1">
                      <div className="px-1 mb-3 border-b border-[var(--color-border)] pb-2 transition-colors">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Intelligence</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {TOOL_FILTER_CHIPS.filter(c => ['ai-video', 'ai-images', 'avatars', 'stickers', 'eleven-labs', 'unsplash'].includes(c.id)).map(chip => {
                          const isOn = activeTools.includes(chip.id)
                          return (
                            <button
                              key={chip.id}
                              onClick={() => toggleActiveTool(chip.id)}
                              className="w-full flex items-center justify-between py-1.5 transition-colors group no-style"
                            >
                              <span className={`text-[11px] font-medium transition-colors ${isOn ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                {chip.label}
                              </span>
                              <div className="transition-colors text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]">
                                {isOn ? <ToggleRight size={18} className="text-[var(--color-accent)]" /> : <ToggleLeft size={18} />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Foundations Section */}
                    <div className="flex-1 border-x border-[var(--color-border)] px-4">
                      <div className="px-1 mb-3 border-b border-[var(--color-border)] pb-2 transition-colors">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Foundations</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {TOOL_FILTER_CHIPS.filter(c => ['video', 'audio', 'interactions', 'assets'].includes(c.id)).map(chip => {
                          const isOn = activeTools.includes(chip.id)
                          return (
                            <button
                              key={chip.id}
                              onClick={() => toggleActiveTool(chip.id)}
                              className="w-full flex items-center justify-between py-1.5 transition-colors group no-style"
                            >
                              <span className={`text-[11px] font-medium transition-colors ${isOn ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                {chip.label}
                              </span>
                              <div className="transition-colors text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]">
                                {isOn ? <ToggleRight size={18} className="text-[var(--color-accent)]" /> : <ToggleLeft size={18} />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Animation Section */}
                    <div className="flex-1 pl-4">
                      <div className="px-1 mb-3 border-b border-[var(--color-border)] pb-2 transition-colors">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Animation</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {TOOL_FILTER_CHIPS.filter(c => 
                          !['ai-video', 'ai-images', 'avatars', 'stickers', 'eleven-labs', 'unsplash', 'video', 'audio', 'interactions', 'assets'].includes(c.id)
                        ).map(chip => {
                          const isOn = activeTools.includes(chip.id)
                          return (
                            <button
                              key={chip.id}
                              onClick={() => toggleActiveTool(chip.id)}
                              className="w-full flex items-center justify-between py-1.5 transition-colors group no-style"
                            >
                              <span className={`text-[11px] font-medium transition-colors ${isOn ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                {chip.label}
                              </span>
                              <div className="transition-colors text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]">
                                {isOn ? <ToggleRight size={18} className="text-[var(--color-accent)]" /> : <ToggleLeft size={18} />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {messages.filter(m => m.status === 'done' && m.content).map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all shadow-sm ${
              msg.role === 'user'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-panel)] border border-[var(--color-border)] text-[var(--color-text-primary)]'
            }`}>
              <span className="whitespace-pre-wrap break-words">{msg.content}</span>
            </div>
            <span className="mt-1 text-[9px] text-[var(--color-text-muted)] px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {/* Streaming text */}
        {isGenerating && streamingText && (
          <div className="flex flex-col items-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-[var(--color-panel)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
              <span className="whitespace-pre-wrap">{streamingText}</span>
              <span className="inline-block w-1.5 h-3.5 bg-[var(--color-accent)] ml-0.5 animate-pulse rounded-sm" />
            </div>
          </div>
        )}

        {/* Pending indicator */}
        {isGenerating && !streamingText && (
          <div className="flex flex-col items-start">
            <div className="rounded-2xl px-4 py-3 bg-[var(--color-panel)] border border-[var(--color-border)]">
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                <RefreshCw size={10} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Keyword warning */}
      {keywordWarning && (
        <div className="mx-4 mb-1 px-3 py-2 rounded-lg bg-amber-900/30 border border-amber-700/40 flex items-center gap-2 text-[11px]">
          <span className="text-amber-300 flex-1">
            <strong>{keywordWarning.label}</strong> is disabled for this chat.
          </span>
          <button
            onClick={() => { toggleActiveTool(keywordWarning.capability); setKeywordWarning(null) }}
            className="text-[10px] font-medium text-amber-200 hover:text-white px-2 py-0.5 rounded bg-amber-800/50 hover:bg-amber-700/60 transition-colors"
          >
            Enable
          </button>
          <button
            onClick={() => { setKeywordWarning(null); handleSend() }}
            className="text-[10px] text-amber-400/70 hover:text-amber-200 transition-colors"
          >
            Dismiss
          </button>
          <button onClick={() => setKeywordWarning(null)} className="text-amber-500/50 hover:text-amber-300 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent pt-8">
        <div className="relative bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl transition-all p-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Talk to Agent..."
            disabled={isGenerating}
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-[var(--color-text-primary)] px-4 py-2 min-h-[44px] max-h-[200px] resize-none scrollbar-hide disabled:opacity-50"
            rows={1}
          />

          <div className="flex items-center justify-between px-3 py-2 mt-1">
            <div className="flex items-center gap-1.5">
              <button
                className="flex items-center justify-center p-1 no-style h-7 w-7"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <Plus size={14} strokeWidth={2.5} />
              </button>

              <div className="flex items-center gap-2">
                {/* ── 1. Model Selection ── */}
                <div className="relative">
                  <button
                    onClick={() => { setShowModelMenu(!showModelMenu); setShowAgentMenu(false) }}
                    className="no-style !flex items-center gap-1 px-1.5 transition-all rounded-md whitespace-nowrap h-7 border border-transparent box-border"
                    style={{ color: showModelMenu ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                  >
                    <span className="font-semibold text-xs leading-none">{currentModel.modelName}</span>
                    <ChevronUp size={10} strokeWidth={2.5} className="opacity-70 ml-0.5" />
                  </button>

                  {showModelMenu && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={() => setShowModelMenu(false)} />
                      <div className="absolute bottom-[calc(100%+8px)] left-0 z-[100] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl p-1.5 flex flex-col w-max min-w-[170px] gap-0.5 animate-in slide-in-from-bottom-1 duration-150">
                        {MODEL_OPTIONS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setModelTier(m.id); setShowModelMenu(false) }}
                            className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer text-[var(--color-text-primary)]"
                          >
                            <div className="flex flex-col items-start flex-1 min-w-0">
                              <span className="text-[13px] font-medium leading-none whitespace-nowrap">{m.modelName}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)] mt-1">{m.tierLabel}</span>
                            </div>
                            {modelTier === m.id && (
                              <Check size={14} strokeWidth={2} className="ml-3 text-[var(--color-accent)] flex-shrink-0" />
                            )}
                          </button>
                        ))}

                        {/* Add Model button — same row style as model options */}
                        <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                          <button
                            onClick={() => { setShowModelMenu(false); setSettingsTab('models') }}
                            className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer"
                          >
                            <Plus size={14} strokeWidth={2} className="flex-shrink-0 mr-2.5 text-[var(--color-text-muted)]" />
                            <div className="flex flex-col items-start flex-1 min-w-0">
                              <span className="text-[13px] font-medium leading-none whitespace-nowrap text-[var(--color-text-primary)]">Add Model</span>
                              <span className="text-[10px] text-[var(--color-text-muted)] mt-1">Configure in settings</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ── 2. Agent Mode Selection ── */}
                <div className="relative">
                  <button
                    onClick={() => { setShowAgentMenu(!showAgentMenu); setShowModelMenu(false) }}
                    className={`no-style !flex items-center gap-1.5 px-2.5 transition-all rounded-full border box-border ${
                      showAgentMenu
                        ? 'border-[var(--color-border)]/50 bg-[var(--color-bg)]'
                        : 'border-[var(--color-border)]/30 hover:border-[var(--color-border)] bg-[var(--color-bg)]/50'
                    } whitespace-nowrap h-7`}
                    style={{ color: showAgentMenu ? 'var(--color-text-primary)' : agentOverride ? currentAgent.color : 'var(--color-text-muted)' }}
                  >
                    <AgentIcon size={14} strokeWidth={2.5} />
                    <ChevronUp size={10} strokeWidth={2.5} className="opacity-70 ml-0.5 translate-y-[1px]" />
                  </button>

                  {showAgentMenu && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={() => setShowAgentMenu(false)} />
                      <div className="absolute bottom-[calc(100%+8px)] left-0 z-[100] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl p-1.5 flex flex-col w-max min-w-[190px] max-h-[400px] overflow-y-auto gap-0.5 animate-in slide-in-from-bottom-1 duration-150">
                        {/* Core agents */}
                        {coreAgents.map((a) => (
                          <button
                            key={a.id ?? 'auto'}
                            onClick={() => { setAgentOverride(a.id); setShowAgentMenu(false) }}
                            className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer"
                          >
                            <a.icon size={14} strokeWidth={2} style={{ color: a.color }} className="flex-shrink-0 mr-2.5" />
                            <div className="flex flex-col items-start flex-1 min-w-0">
                              <span className="text-[13px] font-medium leading-none whitespace-nowrap" style={{ color: agentOverride === a.id ? a.color : 'var(--color-text-primary)' }}>
                                {a.label}
                              </span>
                              <span className="text-[10px] text-[var(--color-text-muted)] mt-1">{a.desc}</span>
                            </div>
                            {agentOverride === a.id && (
                              <Check size={14} strokeWidth={2} className="ml-2 flex-shrink-0" style={{ color: a.color }} />
                            )}
                          </button>
                        ))}

                        {/* Specialized agents divider */}
                        <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                          <div className="px-3 py-1">
                            <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] font-semibold">Specialists</span>
                          </div>
                        </div>

                        {specializedAgents.map((a, i) => (
                          <button
                            key={`spec-${i}`}
                            onClick={() => { setAgentOverride(a.id); setShowAgentMenu(false) }}
                            className="w-full !flex !flex-row items-center px-3 py-2 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer"
                          >
                            <a.icon size={13} strokeWidth={2} style={{ color: a.color }} className="flex-shrink-0 mr-2.5" />
                            <div className="flex flex-col items-start flex-1 min-w-0">
                              <span className="text-[12px] font-medium leading-none whitespace-nowrap text-[var(--color-text-primary)]">
                                {a.label}
                              </span>
                              <span className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{a.desc}</span>
                            </div>
                          </button>
                        ))}

                        {/* Add Agent button — same row style as agent options */}
                        <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                          <button
                            onClick={() => { setShowAgentMenu(false); setSettingsTab('agents') }}
                            className="w-full !flex !flex-row items-center px-3 py-2.5 !rounded-[8px] transition-colors no-style hover:bg-white/10 cursor-pointer"
                          >
                            <Plus size={14} strokeWidth={2} className="flex-shrink-0 mr-2.5 text-[var(--color-text-muted)]" />
                            <div className="flex flex-col items-start flex-1 min-w-0">
                              <span className="text-[13px] font-medium leading-none whitespace-nowrap text-[var(--color-text-primary)]">Add Agent</span>
                              <span className="text-[10px] text-[var(--color-text-muted)] mt-1">Configure in settings</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Send / Stop button */}
            <div className="flex items-center flex-shrink-0 relative">
              {isGenerating ? (
                <button
                  onClick={handleAbort}
                  className="flex items-center justify-center no-style"
                  style={{ width: '32px', height: '32px', borderRadius: '9999px', backgroundColor: 'var(--color-bg)' }}
                >
                  <StopCircle size={16} className="animate-pulse text-[var(--color-accent)]" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex items-center justify-center transition-all cursor-pointer no-style"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-bg)',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    position: 'relative',
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                      src="/icons/send.png"
                      alt="Send"
                      className="transition-all duration-200"
                      style={{
                        width: '26px',
                        height: '26px',
                        objectFit: 'contain',
                        filter: input.trim()
                          ? 'brightness(0) invert(1)'
                          : 'brightness(0) invert(0.6)',
                      }}
                    />
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

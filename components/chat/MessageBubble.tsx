'use client'

import { useState } from 'react'
import { Loader2, Copy, Check, Pencil, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import type { ChatMessage, AgentType, ImageAttachment } from '@/lib/agents/types'
import { messageContentToText } from '@/lib/agents/types'
import { AGENT_COLORS, AGENT_LABELS } from '@/lib/agents/prompts'
import { resolveAgentModelDisplayName } from '@/lib/agents/model-config'
import { useVideoStore } from '@/lib/store'
import { ThinkingBlock } from '../ThinkingBlock'
import { ToolCallItem } from './ToolCallItem'
import { UsageBadge } from './UsageBadge'
import { FeedbackButtons } from './FeedbackButtons'
import { PermissionCard } from './PermissionCard'

const AGENT_BORDER_COLORS: Record<AgentType, string> = {
  router: '#6b7280',
  director: '#a855f7',
  planner: '#06b6d4',
  'scene-maker': '#3b82f6',
  editor: '#22c55e',
  dop: '#f97316',
  tutor: '#8b5cf6',
}

export type AgentPhase = 'idle' | 'routing' | 'thinking' | 'generating' | 'tool'

export interface MessageBubbleProps {
  msg: ChatMessage
  isStreaming?: boolean
  activeToolName?: string | null
  agentPhase?: AgentPhase
  onRate: (msgId: string, rating: number) => void
  onPermission?: (msgId: string, api: string, decision: 'allow' | 'deny') => void
  onResume?: () => void
  onEdit?: (msgId: string, newText: string) => void
  onRetry?: (msgId: string) => void
}

export function MessageBubble({
  msg,
  isStreaming,
  activeToolName,
  agentPhase,
  onRate,
  onPermission,
  onResume,
  onEdit,
  onRetry,
}: MessageBubbleProps) {
  const modelConfigs = useVideoStore((s) => s.modelConfigs)
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const borderColor = msg.agentType ? AGENT_BORDER_COLORS[msg.agentType] : '#4b5563'
  const agentLabel = msg.agentType ? AGENT_LABELS[msg.agentType] : 'Agent'

  const textContent = typeof msg.content === 'string' ? msg.content : messageContentToText(msg.content)

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isError =
    typeof msg.content === 'string' && (msg.content.startsWith('Error:') || msg.content.startsWith('Failed to connect'))

  const phaseLabel: Record<AgentPhase, string> = {
    routing: 'Routing to agent...',
    thinking: 'Thinking...',
    generating: 'Writing response...',
    tool: `Running ${activeToolName ?? 'tool'}...`,
    idle: '',
  }

  if (isUser) {
    return (
      <div className="flex justify-center mb-3 group">
        <div className="w-full max-w-[92%]">
          {isEditing ? (
            <div className="rounded-xl border border-[var(--color-accent)]/50 bg-[var(--agent-chat-user-surface)] overflow-hidden">
              <textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full resize-none bg-transparent px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onEdit?.(msg.id, editValue)
                    setIsEditing(false)
                  }
                  if (e.key === 'Escape') setIsEditing(false)
                }}
              />
              <div className="flex items-center gap-2 px-3 pb-2">
                <button
                  onClick={() => {
                    onEdit?.(msg.id, editValue)
                    setIsEditing(false)
                  }}
                  className="px-2.5 py-1 rounded text-[12px] bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
                >
                  Send
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--agent-chat-user-surface)] px-3.5 py-2.5 relative">
              <button
                onClick={() => {
                  setEditValue(textContent)
                  setIsEditing(true)
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--color-border)]/30"
              >
                <Pencil size={11} className="text-[var(--color-text-muted)]" />
              </button>
              {typeof msg.content === 'string' ? (
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              ) : (
                <div className="space-y-2">
                  {msg.content.some((b) => b.type === 'image') && (
                    <div className="flex gap-2 flex-wrap">
                      {msg.content
                        .filter((b) => b.type === 'image')
                        .map((b, i) => {
                          const img = (b as { type: 'image'; image: ImageAttachment }).image
                          return (
                            <div
                              key={i}
                              className="relative cursor-pointer group"
                              onClick={() => window.open(img.dataUri, '_blank')}
                            >
                              <img
                                src={img.dataUri}
                                className="max-h-32 max-w-[200px] rounded-lg border border-[var(--color-border)] object-cover"
                                alt={img.fileName ?? 'Attached'}
                              />
                              <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </div>
                          )
                        })}
                    </div>
                  )}
                  {msg.content
                    .filter((b) => b.type === 'text')
                    .map((b, i) => (
                      <p
                        key={i}
                        className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap"
                      >
                        {(b as { type: 'text'; text: string }).text}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center mb-3">
      <div className="relative w-full max-w-[92%]">
        {/* Agent badge bar */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="text-[12px] font-semibold" style={{ color: borderColor }}>
            {agentLabel}
          </span>
          {msg.modelId && (
            <span className="text-[11px] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded">
              {resolveAgentModelDisplayName(msg.modelId, modelConfigs)}
            </span>
          )}
          {msg.routeMethod && msg.routeMethod !== 'override' && (
            <span className="text-[10px] text-[var(--color-text-muted)]/50 px-1 py-0.5">
              {msg.routeMethod === 'llm' ? 'auto' : msg.routeMethod === 'heuristic' ? 'rule' : '\u26A0 fallback'}
            </span>
          )}
          {isStreaming && <Loader2 size={10} className="ml-auto animate-spin text-[var(--color-text-muted)]" />}
        </div>

        {/* Routing fallback warning */}
        {msg.routingFallback && (
          <div className="px-3 pb-1">
            <span className="text-[11px] text-amber-400/70">
              {'\u26A0'} Router unavailable — used heuristic agent selection
            </span>
          </div>
        )}

        {/* Thinking block */}
        {(msg.thinking || msg.isThinkingStreaming) && (
          <div className="px-3 pt-1">
            <ThinkingBlock thinking={msg.thinking ?? ''} isStreaming={msg.isThinkingStreaming} />
          </div>
        )}

        {/* Message text — rendered as markdown for assistant messages */}
        <div className="px-3 py-2">
          {msg.content ? (
            <div className="text-sm text-[var(--color-text-primary)] leading-relaxed prose prose-invert prose-sm max-w-none chat-markdown">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match
                    if (isInline) {
                      return (
                        <code
                          className="bg-[var(--color-border)]/50 px-1 py-0.5 rounded text-[12px] font-mono text-[var(--color-text-primary)]"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    }
                    return (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-lg text-[12px] my-2"
                        customStyle={{
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          margin: '8px 0',
                        }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0">{children}</p>
                  },
                  ul({ children }) {
                    return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
                  },
                  li({ children }) {
                    return <li className="text-sm">{children}</li>
                  },
                  strong({ children }) {
                    return <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>
                  },
                  h1({ children }) {
                    return <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
                  },
                  h2({ children }) {
                    return <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>
                  },
                  h3({ children }) {
                    return <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
                  },
                }}
              >
                {textContent}
              </ReactMarkdown>
              {isStreaming && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 ml-1 align-middle"
                  style={{ animation: 'cursorPulse 1.2s ease-in-out infinite' }}
                />
              )}
            </div>
          ) : isStreaming && !msg.isThinkingStreaming ? (
            <div className="px-3 py-2">
              <span className="shimmer-text text-sm font-medium">{phaseLabel[agentPhase ?? 'generating']}</span>
            </div>
          ) : null}
        </div>

        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="px-3 pb-2">
            <div className="text-[11px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
              {msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? 's' : ''}
            </div>
            {msg.toolCalls.map((call) => (
              <ToolCallItem key={call.id} call={call} />
            ))}
          </div>
        )}

        {/* Permission cards */}
        {msg.pendingPermissions && msg.pendingPermissions.length > 0 && (
          <div className="px-3 pb-2">
            {msg.pendingPermissions.map((perm, i) => (
              <PermissionCard
                key={`${perm.api}-${i}`}
                perm={perm}
                onAllow={() => onPermission?.(msg.id, perm.api, 'allow')}
                onDeny={() => onPermission?.(msg.id, perm.api, 'deny')}
              />
            ))}
          </div>
        )}

        {/* Active tool indicator */}
        {isStreaming && activeToolName && (
          <div className="mx-3 mb-2 flex items-center gap-2 px-2.5 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <span
              className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"
              style={{ animation: 'cursorPulse 1.2s ease-in-out infinite' }}
            />
            <span className="text-sm text-[var(--color-text-primary)] font-mono truncate">{activeToolName}</span>
            <span className="text-[11px] text-blue-400 ml-auto flex-shrink-0">Running</span>
          </div>
        )}

        {/* Checkpoint resume button */}
        {msg.hasCheckpoint && !isStreaming && (
          <div className="mx-3 mb-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <p className="text-[12px] text-amber-400 mb-2">
              {msg.checkpointReason === 'cost_cap'
                ? '\u26A0 Cost limit reached'
                : msg.checkpointReason === 'tool_limit'
                  ? '\u26A0 Tool call limit reached'
                  : '\u26A0 Iteration limit reached'}{' '}
              &mdash; {msg.checkpointScenesBuilt} scene{msg.checkpointScenesBuilt !== 1 ? 's' : ''} built. Progress
              saved.
            </p>
            <button
              onClick={() => onResume?.()}
              className="px-3 py-1.5 rounded text-[12px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
            >
              Continue building &rarr;
            </button>
          </div>
        )}

        {/* Usage stats */}
        {msg.usage && !isStreaming && <UsageBadge usage={msg.usage} />}

        {/* Feedback buttons + Copy + Retry */}
        {!isStreaming && msg.content && (
          <div className="flex items-center gap-1 px-3 pb-2">
            <FeedbackButtons msg={msg} onRate={onRate} />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {/* Retry button for error messages */}
        {!isStreaming && isError && (
          <button
            onClick={() => onRetry?.(msg.id)}
            className="mx-3 mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <RotateCcw size={11} />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

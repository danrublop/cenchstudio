'use client'

import { Loader2 } from 'lucide-react'
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
}

export interface MessageBubbleProps {
  msg: ChatMessage
  isStreaming?: boolean
  activeToolName?: string | null
  onRate: (msgId: string, rating: number) => void
  onPermission?: (msgId: string, api: string, decision: 'allow' | 'deny') => void
}

export function MessageBubble({ msg, isStreaming, activeToolName, onRate, onPermission }: MessageBubbleProps) {
  const modelConfigs = useVideoStore((s) => s.modelConfigs)
  const isUser = msg.role === 'user'

  const borderColor = msg.agentType ? AGENT_BORDER_COLORS[msg.agentType] : '#4b5563'
  const agentLabel = msg.agentType ? AGENT_LABELS[msg.agentType] : 'Agent'

  if (isUser) {
    return (
      <div className="flex justify-center mb-3">
        <div className="w-full max-w-[92%] rounded-xl border border-[var(--color-border)] bg-[var(--agent-chat-user-surface)] px-3.5 py-2.5">
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
                  <p key={i} className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                    {(b as { type: 'text'; text: string }).text}
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center mb-3">
      <div
        className="relative w-full max-w-[92%]"
      >
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
          {isStreaming && <Loader2 size={10} className="ml-auto animate-spin text-[var(--color-text-muted)]" />}
        </div>

        {/* Thinking block */}
        {(msg.thinking || msg.isThinkingStreaming) && (
          <div className="px-3 pt-1">
            <ThinkingBlock thinking={msg.thinking ?? ''} isStreaming={msg.isThinkingStreaming} />
          </div>
        )}

        {/* Message text */}
        <div className="px-3 py-2">
          {msg.content ? (
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
              {typeof msg.content === 'string' ? msg.content : messageContentToText(msg.content)}
              {isStreaming && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 ml-1 align-middle"
                  style={{ animation: 'cursorPulse 1.2s ease-in-out infinite' }}
                />
              )}
            </p>
          ) : isStreaming && !msg.isThinkingStreaming ? (
            <span className="shimmer-text text-sm font-medium">Thinking...</span>
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

        {/* Usage stats */}
        {msg.usage && !isStreaming && <UsageBadge usage={msg.usage} />}

        {/* Feedback buttons — show after streaming completes */}
        {!isStreaming && msg.content && <FeedbackButtons msg={msg} onRate={onRate} />}
      </div>
    </div>
  )
}

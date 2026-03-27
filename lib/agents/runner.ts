/**
 * Main agent execution loop for Cench Studio.
 *
 * Handles:
 * - Agent routing (auto or override)
 * - Context building with world state
 * - Streaming Claude API calls
 * - Multi-turn tool_use loops
 * - SSE event emission
 */

import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import type { Scene, GlobalStyle, APIPermissions } from '../types'
import type {
  AgentType, ModelId, ModelTier, SSEEvent, ToolCallRecord, ToolResult, ChatMessage, UsageStats,
} from './types'
import { MODEL_PRICING } from './types'
import { routeMessage } from './router'
import { buildAgentContext, trimHistory } from './context-builder'
import { executeTool, type WorldStateMutable } from './tool-executor'
import { logSpend, logAgentUsage } from '../db'

const client = new Anthropic()

const MAX_TOOL_ITERATIONS = 10

/** Calculate cost in USD from token counts and model */
function calculateCost(modelId: ModelId, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[modelId]
  if (!pricing) return 0
  return (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M
}

export interface RunnerOptions {
  message: string
  agentOverride?: AgentType
  modelOverride?: ModelId | null
  modelTier?: ModelTier
  sceneContext?: 'all' | 'selected' | 'auto' | string
  activeTools?: string[]
  history?: ChatMessage[]
  projectId?: string
  // World state references (mutated in-place during execution)
  scenes: Scene[]
  globalStyle: GlobalStyle
  projectName: string
  outputMode: 'mp4' | 'interactive'
  selectedSceneId?: string | null
  apiPermissions?: APIPermissions
  // SSE emitter
  emit: (event: SSEEvent) => void
}

/**
 * Run the agent execution loop, emitting SSE events throughout.
 * Returns the final accumulated state of scenes and globalStyle after all tool calls.
 */
export async function runAgent(opts: RunnerOptions): Promise<{
  agentType: AgentType
  modelId: ModelId
  fullText: string
  toolCalls: ToolCallRecord[]
  updatedScenes: Scene[]
  updatedGlobalStyle: GlobalStyle
  usage: UsageStats
}> {
  const {
    message, agentOverride, modelOverride, sceneContext, activeTools, history,
    scenes, globalStyle, projectName, outputMode, selectedSceneId, apiPermissions, emit,
  } = opts

  // ── 1. Route to agent ────────────────────────────────────────────────────

  emit({ type: 'thinking' })

  let agentType: AgentType
  if (agentOverride) {
    agentType = agentOverride
  } else {
    agentType = await routeMessage(message, scenes, globalStyle, projectName, outputMode, opts.projectId)
  }

  // ── 2. Build context ─────────────────────────────────────────────────────

  const focusedSceneId = selectedSceneId ?? null
  const contextOpts = {
    agentType,
    activeTools: activeTools ?? [],
    sceneContext: sceneContext ?? (focusedSceneId ? 'selected' : 'all'),
    focusedSceneId,
  }

  const ctx = buildAgentContext(
    agentType,
    contextOpts,
    scenes,
    globalStyle,
    projectName,
    outputMode,
    modelOverride,
    opts.modelTier,
  )

  const modelId = ctx.modelId

  // ── 3. Build message history ─────────────────────────────────────────────

  const trimmedHistory = trimHistory(
    (history ?? []).map(m => ({
      role: m.role,
      content: m.content,
    }))
  )

  const messages: Anthropic.MessageParam[] = [
    ...(trimmedHistory as Anthropic.MessageParam[]),
    { role: 'user', content: message },
  ]

  // ── 4. Mutable world state for tool execution ────────────────────────────

  const world: WorldStateMutable = {
    scenes: JSON.parse(JSON.stringify(scenes)), // deep clone
    globalStyle: { ...globalStyle },
    projectName,
    outputMode,
    ...(apiPermissions ? { apiPermissions } : {}),
  }

  // ── 5. Multi-turn tool loop ──────────────────────────────────────────────

  const runStartTime = Date.now()
  let fullText = ''
  const allToolCalls: ToolCallRecord[] = []
  let iteration = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalApiCalls = 0

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++
    totalApiCalls++

    // Call Claude with streaming
    const stream = await client.messages.create({
      model: modelId as string,
      max_tokens: ctx.maxTokens,
      system: ctx.systemPrompt,
      tools: ctx.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      messages,
      stream: true,
    })

    // Accumulate streaming response
    let chunkText = ''
    const toolUseBlocks: Array<{
      id: string
      name: string
      input: string // JSON string being built
    }> = []
    let currentToolIndex = -1
    let stopReason: string | null = null

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start': {
          if (event.content_block.type === 'text') {
            // text block starting
          } else if (event.content_block.type === 'tool_use') {
            currentToolIndex = toolUseBlocks.length
            toolUseBlocks.push({
              id: event.content_block.id,
              name: event.content_block.name,
              input: '',
            })
            emit({ type: 'tool_start', toolName: event.content_block.name, toolInput: {} })
          }
          break
        }

        case 'content_block_delta': {
          if (event.delta.type === 'text_delta') {
            chunkText += event.delta.text
            fullText += event.delta.text
            emit({ type: 'token', token: event.delta.text })
          } else if (event.delta.type === 'input_json_delta' && currentToolIndex >= 0) {
            toolUseBlocks[currentToolIndex].input += event.delta.partial_json
          }
          break
        }

        case 'message_delta': {
          stopReason = event.delta.stop_reason ?? null
          // Capture token usage from the final message_delta
          if ('usage' in event && event.usage) {
            const u = event.usage as { output_tokens?: number }
            if (u.output_tokens) totalOutputTokens += u.output_tokens
          }
          break
        }

        case 'message_start': {
          // Capture input tokens from the message start event
          if ('message' in event && event.message?.usage) {
            const u = event.message.usage as { input_tokens?: number }
            if (u.input_tokens) totalInputTokens += u.input_tokens
          }
          break
        }
      }
    }

    // Build the assistant turn content blocks
    const assistantContent: Anthropic.Messages.ContentBlock[] = []

    if (chunkText) {
      assistantContent.push({ type: 'text', text: chunkText, citations: [] })
    }

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of toolUseBlocks) {
      let toolInput: Record<string, unknown> = {}
      try {
        toolInput = block.input ? JSON.parse(block.input) : {}
      } catch {
        toolInput = {}
      }

      assistantContent.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: toolInput,
      })

      const startTime = Date.now()
      const result: ToolResult = await executeTool(block.name, toolInput, world)
      const durationMs = Date.now() - startTime

      const toolCallRecord: ToolCallRecord = {
        id: block.id,
        toolName: block.name,
        input: toolInput,
        output: result,
        durationMs,
      }
      allToolCalls.push(toolCallRecord)

      emit({
        type: 'tool_complete',
        toolName: block.name,
        toolResult: result,
      })

      if (result.affectedSceneId) {
        emit({
          type: 'preview_update',
          sceneId: result.affectedSceneId,
          changes: result.changes,
        })
      }

      if (result.changes && result.changes.length > 0) {
        emit({ type: 'state_change', changes: result.changes })
      }

      // Add tool result to messages
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify({
          success: result.success,
          ...(result.error ? { error: result.error } : {}),
          ...(result.data ? { data: result.data } : {}),
          ...(result.changes ? { changes: result.changes } : {}),
        }),
      })
    }

    // Add assistant message
    if (assistantContent.length > 0) {
      messages.push({ role: 'assistant', content: assistantContent })
    }

    // If there were tool calls, add tool results and continue
    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults })
    }

    // Stop if no tool calls or stop reason is end_turn
    if (toolUseBlocks.length === 0 || stopReason === 'end_turn') {
      break
    }
  }

  // ── 6. Calculate usage and cost ──────────────────────────────────────────

  const totalDurationMs = Date.now() - runStartTime
  const costUsd = calculateCost(modelId, totalInputTokens, totalOutputTokens)

  const usage: UsageStats = {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    apiCalls: totalApiCalls,
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000, // 6 decimal places
    totalDurationMs,
  }

  // Log spend to Postgres for persistent tracking
  try {
    const pid = opts.projectId ?? 'unknown'
    await logSpend(
      pid,
      `agent:${agentType}`,
      costUsd,
      `Agent ${agentType} (${modelId}): ${totalInputTokens} in / ${totalOutputTokens} out, ${totalApiCalls} API call(s), ${allToolCalls.length} tool call(s)`,
    )
    await logAgentUsage(
      pid,
      agentType,
      modelId,
      totalInputTokens,
      totalOutputTokens,
      totalApiCalls,
      allToolCalls.length,
      costUsd,
      totalDurationMs,
    )
  } catch (e) {
    console.error('[Agent] Failed to log spend:', e)
  }

  // ── 7. Emit done ─────────────────────────────────────────────────────────

  emit({
    type: 'done',
    agentType,
    modelId,
    fullText,
    toolCalls: allToolCalls,
    usage,
  })

  return {
    agentType,
    modelId,
    fullText,
    toolCalls: allToolCalls,
    updatedScenes: world.scenes,
    updatedGlobalStyle: world.globalStyle,
    usage,
  }
}

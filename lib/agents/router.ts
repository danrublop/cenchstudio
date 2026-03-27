/**
 * Router agent: classifies user intent and returns which agent should handle it.
 * Uses the cheapest model (Haiku) for fast, cheap routing decisions.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AgentType, ModelId } from './types'
import { MODEL_PRICING } from './types'
import { buildRouterContext } from './context-builder'
import type { Scene, GlobalStyle } from '../types'
import { logSpend } from '../db'

const client = new Anthropic()

const VALID_AGENT_TYPES = new Set<AgentType>(['director', 'scene-maker', 'editor', 'dop'])

/**
 * Route a user message to the appropriate agent.
 * Returns the agent type that should handle this request.
 * Also tracks token usage and cost for the routing call.
 */
export async function routeMessage(
  message: string,
  scenes: Scene[],
  globalStyle: GlobalStyle,
  projectName: string,
  outputMode: 'mp4' | 'interactive',
  projectId?: string,
): Promise<AgentType> {
  const { systemPrompt, modelId, maxTokens } = buildRouterContext(
    scenes,
    globalStyle,
    projectName,
    outputMode,
  )

  try {
    const response = await client.messages.create({
      model: modelId as string,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    })

    // Track token usage for the router call
    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0
    const pricing = MODEL_PRICING[modelId]
    const costUsd = pricing
      ? (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M
      : 0

    try {
      await logSpend(
        projectId ?? 'unknown',
        'agent:router',
        costUsd,
        `Router (${modelId}): ${inputTokens} in / ${outputTokens} out`,
      )
    } catch (e) {
      console.error('[Router] Failed to log spend:', e)
    }

    const rawText = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .toLowerCase()

    // Parse out the agent type from response
    for (const agentType of VALID_AGENT_TYPES) {
      if (rawText.includes(agentType)) {
        return agentType
      }
    }

    // Fallback: use heuristics on the user message
    return heuristicRoute(message)
  } catch (err) {
    console.error('[Router] Routing failed, using heuristics:', err)
    return heuristicRoute(message)
  }
}

/**
 * Fallback routing via simple keyword heuristics.
 * Used when the router LLM call fails.
 */
function heuristicRoute(message: string): AgentType {
  const lower = message.toLowerCase()

  // Director signals
  if (
    lower.includes('create a video') ||
    lower.includes('make a video') ||
    lower.includes('build a presentation') ||
    lower.includes('plan') ||
    lower.includes('storyboard') ||
    lower.includes('new project') ||
    (lower.includes('scene') && (lower.includes('multiple') || lower.includes('all') || /\d+ scene/.test(lower)))
  ) {
    return 'director'
  }

  // DoP signals
  if (
    lower.includes('global style') ||
    lower.includes('all scenes') ||
    lower.includes('color palette') ||
    lower.includes('font for') ||
    lower.includes('transition') ||
    lower.includes('roughness') ||
    lower.includes('theme') ||
    lower.includes('cinematic') ||
    lower.includes('visual style')
  ) {
    return 'dop'
  }

  // Scene maker signals
  if (
    lower.includes('add a scene') ||
    lower.includes('new scene') ||
    lower.includes('make this scene') ||
    lower.includes('generate scene') ||
    lower.includes('create scene')
  ) {
    return 'scene-maker'
  }

  // Default to editor for targeted changes
  return 'editor'
}

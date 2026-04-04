/**
 * Router agent: classifies user intent and returns which agent should handle it.
 * Uses the cheapest model (Haiku) for fast, cheap routing decisions.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AgentType, ModelId } from './types'
import { MODEL_PRICING, getModelProvider } from './types'
import { buildRouterContext } from './context-builder'
import type { Scene, GlobalStyle } from '../types'
import { logSpend } from '../db'
import type { AgentLogger } from './logger'

const client = new Anthropic()

const VALID_AGENT_TYPES = new Set<AgentType>(['director', 'scene-maker', 'editor', 'dop'])

/**
 * Route a user message to the appropriate agent.
 * Returns the agent type that should handle this request.
 * Also tracks token usage and cost for the routing call.
 *
 * If no Anthropic model is available (e.g. user only has OpenAI/Gemini enabled),
 * falls back to heuristic routing to avoid needing multi-provider support here.
 */
export async function routeMessage(
  message: string,
  scenes: Scene[],
  globalStyle: GlobalStyle,
  projectName: string,
  outputMode: 'mp4' | 'interactive',
  projectId?: string,
  logger?: AgentLogger,
  enabledModelIds?: string[],
): Promise<AgentType> {
  // Build state context for smarter routing
  const routeCtx: RouteContext = {
    sceneCount: scenes.filter((s) => s.prompt || s.svgContent || s.canvasCode || s.sceneCode).length,
    hasStoryboard: false, // Will be true if storyboard exists (passed via scenes metadata)
  }

  // Try heuristics first for obvious patterns — saves an LLM call (~500ms + cost)
  const heuristicResult = heuristicRoute(message, routeCtx)
  if (heuristicResult !== 'editor') {
    // Heuristics matched a specific pattern (not the default fallback)
    logger?.log('route', `Heuristic match → ${heuristicResult}`, {
      method: 'heuristic',
      result: heuristicResult,
      sceneCount: routeCtx.sceneCount,
    })
    return heuristicResult
  }

  // Ambiguous — use LLM for accurate routing
  logger?.log('route', 'Heuristic inconclusive, calling LLM router', { heuristicDefault: heuristicResult })
  const { systemPrompt, modelId, maxTokens } = buildRouterContext(
    scenes,
    globalStyle,
    projectName,
    outputMode,
    enabledModelIds,
  )

  // If the resolved router model is non-Anthropic, fall back to heuristics.
  // Routing is a trivial classification — not worth multi-provider complexity here.
  const provider = getModelProvider(modelId)
  if (provider !== 'anthropic') {
    logger?.log('route', `Router model ${modelId} is ${provider}, using heuristic fallback`, {
      method: 'heuristic',
      reason: 'non-anthropic-router',
    })
    return heuristicResult
  }

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
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .toLowerCase()

    // Parse out the agent type from response
    for (const agentType of VALID_AGENT_TYPES) {
      if (rawText.includes(agentType)) {
        logger?.log('route', `LLM routed → ${agentType}`, {
          method: 'llm',
          result: agentType,
          modelId,
          inputTokens,
          outputTokens,
          costUsd,
        })
        return agentType
      }
    }

    logger?.warn('route', `LLM response unrecognized: "${rawText.slice(0, 50)}", falling back to heuristic`)
    // Fallback: use heuristic default
    return heuristicResult
  } catch (err) {
    console.error('[Router] Routing failed, using heuristics:', err)
    return heuristicResult
  }
}

/** State signals passed to routing for context-aware decisions */
interface RouteContext {
  sceneCount: number
  hasStoryboard: boolean
  lastAgentType?: AgentType
}

/**
 * Fallback routing via simple keyword heuristics.
 * Uses project state to make smarter routing decisions — e.g. if the project
 * already has 8 scenes, "make it better" should route to editor, not director.
 */
function heuristicRoute(message: string, ctx?: RouteContext): AgentType {
  const lower = message.toLowerCase()
  const hasScenes = (ctx?.sceneCount ?? 0) > 0
  const hasManyScenes = (ctx?.sceneCount ?? 0) >= 3

  // Educational / explanatory / descriptive content → director
  // These prompts describe a topic and imply multi-scene video creation
  if (
    /\b(explain|teach|lesson|tutorial|walkthrough|overview|introduction to|history of|how .+ works?|what (is|are) .+|compare .+ (and|vs|versus))\b/i.test(
      lower,
    ) ||
    // Multi-topic detection: 3+ comma/and-separated concepts in a long message
    (lower.split(/,\s*| and /).length >= 3 && lower.length > 50)
  ) {
    return 'director'
  }

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

  // "Continue" / "keep going" after a storyboard was approved → director (to build remaining scenes)
  if (
    ctx?.hasStoryboard &&
    (lower.includes('continue') ||
      lower.includes('keep going') ||
      lower.includes('build it') ||
      lower.includes('go ahead'))
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

  // Vague improvement requests on existing projects → editor (not director)
  if (
    hasManyScenes &&
    (lower.includes('make it better') ||
      lower.includes('improve') ||
      lower.includes('polish') ||
      lower.includes('fix') ||
      lower.includes('tweak') ||
      lower.includes('adjust'))
  ) {
    return 'editor'
  }

  // Default to editor for targeted changes
  return 'editor'
}

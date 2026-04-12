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

  // Try heuristics first for obvious patterns — saves an LLM call (~500ms + cost).
  // Only trust high-confidence matches; low-confidence results still go to LLM.
  const heuristicResult = heuristicRoute(message, routeCtx)
  if (heuristicResult.confidence === 'high') {
    logger?.log('route', `Heuristic match → ${heuristicResult.agent}`, {
      method: 'heuristic',
      result: heuristicResult.agent,
      confidence: heuristicResult.confidence,
      sceneCount: routeCtx.sceneCount,
    })
    return heuristicResult.agent
  }

  // Low-confidence or ambiguous — use LLM for accurate routing
  logger?.log('route', 'Heuristic inconclusive, calling LLM router', {
    heuristicSuggestion: heuristicResult.agent,
    confidence: heuristicResult.confidence,
  })
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
    return heuristicResult.agent
  }

  // Check if Anthropic API key is available before attempting LLM routing
  if (!process.env.ANTHROPIC_API_KEY) {
    logger?.log('route', 'No Anthropic API key — using heuristic routing')
    return heuristicResult.agent
  }

  let client: Anthropic
  try {
    client = new Anthropic()
  } catch (e) {
    logger?.log('route', `Anthropic client init failed: ${(e as Error).message} — using heuristic`)
    return heuristicResult.agent
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

    // Parse the agent type from response using last-occurrence matching.
    // Models typically state their final answer last, so if the response says
    // "NOT scene-maker, use director", we pick "director" (rightmost match).
    let lastMatch: AgentType | null = null
    let lastIndex = -1
    for (const agentType of VALID_AGENT_TYPES) {
      const idx = rawText.lastIndexOf(agentType)
      if (idx !== -1 && idx > lastIndex) {
        lastIndex = idx
        lastMatch = agentType
      }
    }

    if (lastMatch) {
      logger?.log('route', `LLM routed → ${lastMatch}`, {
        method: 'llm',
        result: lastMatch,
        modelId,
        inputTokens,
        outputTokens,
        costUsd,
      })
      return lastMatch
    }

    logger?.warn('route', `LLM response unrecognized: "${rawText.slice(0, 50)}", falling back to heuristic`)
    // Fallback: use heuristic default
    return heuristicResult.agent
  } catch (err) {
    console.error('[Router] Routing failed, using heuristics:', err)
    return heuristicResult.agent
  }
}

/** State signals passed to routing for context-aware decisions */
interface RouteContext {
  sceneCount: number
  hasStoryboard: boolean
  lastAgentType?: AgentType
}

interface HeuristicResult {
  agent: AgentType
  confidence: 'high' | 'low'
}

/**
 * Fallback routing via keyword heuristics with confidence levels.
 *
 * Only returns confidence='high' for unambiguous patterns (multi-word phrases
 * that clearly signal intent). Single keywords that could be part of an edit
 * request (e.g. "make", "create") return confidence='low' to defer to the LLM.
 *
 * Uses project state to make smarter routing decisions — e.g. if the project
 * already has 8 scenes, "make it better" should route to editor, not director.
 */
function heuristicRoute(message: string, ctx?: RouteContext): HeuristicResult {
  const lower = message.toLowerCase()
  const hasManyScenes = (ctx?.sceneCount ?? 0) >= 3

  // ── High-confidence: Director ──
  // Multi-word phrases that unambiguously signal video/project creation
  if (
    /\b(create a video|make a video|build a (video|presentation)|new project|plan the (video|scenes|project))\b/i.test(
      lower,
    ) ||
    lower.includes('storyboard')
  ) {
    return { agent: 'director', confidence: 'high' }
  }

  // Educational prompts starting with clear intent verbs
  if (/^(explain|teach me|make a? ?(lesson|tutorial|walkthrough|overview) (about|on|for))\b/i.test(lower)) {
    return { agent: 'director', confidence: 'high' }
  }

  // Explicit multi-scene requests
  if (lower.includes('scene') && (lower.includes('multiple') || /\d+ scene/.test(lower))) {
    return { agent: 'director', confidence: 'high' }
  }

  // "Continue" / "keep going" after a storyboard was approved → director
  if (ctx?.hasStoryboard && /\b(continue|keep going|build it|go ahead|proceed)\b/i.test(lower)) {
    return { agent: 'director', confidence: 'high' }
  }

  // ── High-confidence: DoP ──
  // Phrases that clearly target global/cross-scene styling
  if (
    lower.includes('global style') ||
    lower.includes('all scenes') ||
    lower.includes('color palette') ||
    lower.includes('visual style') ||
    /\b(font|roughness|transitions?) for (all|every|the (whole|entire))\b/i.test(lower)
  ) {
    return { agent: 'dop', confidence: 'high' }
  }

  // ── High-confidence: Scene-Maker ──
  if (/\b(add a (new )?scene|new scene|generate ?(a )?scene|create ?(a )?scene)\b/i.test(lower)) {
    return { agent: 'scene-maker', confidence: 'high' }
  }

  // ── Low-confidence hints (defer to LLM for final decision) ──

  // Topic-like descriptions without explicit action verbs → probably director, but let LLM decide
  if (
    /\b(explain|teach|lesson|tutorial|walkthrough|overview|introduction to|history of|how .+ works?|compare .+ (and|vs|versus))\b/i.test(
      lower,
    ) ||
    (lower.split(/,\s*| and /).length >= 3 && lower.length > 50)
  ) {
    return { agent: 'director', confidence: 'low' }
  }

  // Single keywords that could be edit requests or creation requests
  if (/\b(plan|create|make|build)\b/i.test(lower)) {
    return { agent: 'director', confidence: 'low' }
  }

  // Style-adjacent but could be scene-specific
  if (/\b(theme|cinematic|roughness|transition)\b/i.test(lower)) {
    return { agent: 'dop', confidence: 'low' }
  }

  // Vague improvement requests on existing projects → editor
  if (hasManyScenes && /\b(make it better|improve|polish|fix|tweak|adjust)\b/i.test(lower)) {
    return { agent: 'editor', confidence: 'low' }
  }

  // Default: low-confidence editor (will go to LLM)
  return { agent: 'editor', confidence: 'low' }
}

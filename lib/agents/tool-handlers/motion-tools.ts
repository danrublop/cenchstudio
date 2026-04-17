/**
 * Motion design tool handlers.
 *
 * Deterministic tools that help the agent make motion design decisions
 * before generating animations. No LLM calls — pure lookup from the
 * easing library based on emotion/personality.
 */

import type { AgentLogger } from '@/lib/agents/logger'
import { okGlobal, err, type ToolResult } from './_shared'
import {
  PERSONALITIES,
  getPersonalityEasing,
  getPersonalityGsap,
  easingToCSS,
  easingToLottieHandles,
  type MotionPersonality,
  type MotionCategory,
} from '@/lib/motion/easing'

export const MOTION_TOOL_NAMES = ['choose_motion_style'] as const

// Emotion-to-personality mapping
const EMOTION_MAP: Record<string, MotionPersonality> = {
  // Joy / fun
  joy: 'playful',
  fun: 'playful',
  delight: 'playful',
  celebration: 'playful',
  // Urgency / energy
  urgency: 'energetic',
  excitement: 'energetic',
  energy: 'energetic',
  speed: 'energetic',
  action: 'energetic',
  // Trust / professionalism
  trust: 'corporate',
  professionalism: 'corporate',
  reliability: 'corporate',
  stability: 'corporate',
  clarity: 'corporate',
  // Elegance / premium
  elegance: 'premium',
  luxury: 'premium',
  sophistication: 'premium',
  calm: 'premium',
  serenity: 'premium',
  // Neutral defaults
  neutral: 'corporate',
  informational: 'corporate',
  educational: 'corporate',
  growth: 'energetic',
  success: 'playful',
  warning: 'energetic',
  error: 'energetic',
}

interface ChooseMotionStyleArgs {
  sceneContext: string
  emotion: string
  brand?: MotionPersonality
}

export function createMotionToolHandler() {
  return async function handleMotionTool(
    toolName: string,
    args: Record<string, unknown>,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'choose_motion_style': {
        const { sceneContext, emotion, brand } = args as unknown as ChooseMotionStyleArgs

        // If brand is explicitly provided, use it directly
        const personality: MotionPersonality =
          brand && PERSONALITIES[brand] ? brand : EMOTION_MAP[emotion.toLowerCase()] || 'corporate'

        const profile = PERSONALITIES[personality]
        const categories: MotionCategory[] = ['entrance', 'exit', 'emphasis', 'ambient']

        const easingConfig: Record<
          string,
          {
            css: string
            gsap: string
            lottie1d: ReturnType<typeof easingToLottieHandles>
            lottie3d: ReturnType<typeof easingToLottieHandles>
          }
        > = {}
        for (const cat of categories) {
          const bezier = getPersonalityEasing(personality, cat)
          easingConfig[cat] = {
            css: easingToCSS(bezier),
            gsap: getPersonalityGsap(personality, cat),
            lottie1d: easingToLottieHandles(bezier, 1),
            lottie3d: easingToLottieHandles(bezier, 3),
          }
        }

        const result = {
          personality,
          name: profile.name,
          durationRange: profile.durationRange,
          staggerMs: profile.staggerMs,
          maxStaggerMs: profile.maxStaggerMs,
          overshoot: profile.overshoot,
          easing: easingConfig,
          guidance: buildGuidance(personality, emotion, sceneContext),
        }

        logger?.log('motion', `Motion style: ${personality} (emotion: ${emotion})`)

        return okGlobal(`Selected "${personality}" motion personality for "${emotion}" emotion`, result)
      }

      default:
        return err(`Unknown motion tool: ${toolName}`)
    }
  }
}

function buildGuidance(personality: MotionPersonality, emotion: string, context: string): string {
  const p = PERSONALITIES[personality]
  const lines = [
    `Use ${p.name} motion personality for this scene.`,
    `Transition durations: ${p.durationRange[0]}-${p.durationRange[1]}s per element.`,
    `Stagger items at ${p.staggerMs}ms intervals (cap at ${p.maxStaggerMs}ms total).`,
  ]

  if (p.overshoot > 0) {
    lines.push(`Allow up to ${Math.round(p.overshoot * 100)}% overshoot on entrances for liveliness.`)
  } else {
    lines.push('No overshoot — keep motion smooth and controlled.')
  }

  lines.push('Exit animations at 75% of entrance duration.')
  lines.push('Use entrance easing for elements appearing, exit easing for elements leaving.')
  lines.push('Use emphasis easing for scale pulses, highlights, and attention-drawing moments.')

  return lines.join('\n')
}

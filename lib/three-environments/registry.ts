/**
 * Named Three.js stage environments — runtime is bundled in `inlined-runtimes.ts` and injected in generateThreeHTML.
 * Use these IDs with applyCenchThreeEnvironment.
 */
export interface CenchThreeEnvironmentMeta {
  id: string
  name: string
  description: string
  tags: string[]
}

/** Scatter tool / legacy alias — only `track_rolling_topdown` is available */
export const CENCH_STUDIO_ENV_IDS = ['track_rolling_topdown'] as const

export type CenchStudioEnvId = (typeof CENCH_STUDIO_ENV_IDS)[number]

export const CENCH_THREE_ENVIRONMENTS: CenchThreeEnvironmentMeta[] = [
  {
    id: 'track_rolling_topdown',
    name: 'Rolling track lanes (top-down)',
    description:
      'White surface, four horizontal lane dividers, patterned marbles rolling alternately left/right per track; top-down camera and studio lighting.',
    tags: ['top-down', 'tracks', 'marbles', 'lanes', 'white', 'diagram', 'rolling'],
  },
]

/** Compact list for LLM system prompts */
export function formatThreeEnvironmentsForPrompt(): string {
  return CENCH_THREE_ENVIRONMENTS.map((e) => `- \`${e.id}\` — ${e.name}: ${e.description}`).join('\n')
}

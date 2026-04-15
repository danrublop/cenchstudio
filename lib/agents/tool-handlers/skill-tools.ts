/**
 * Skill discovery tools — search, load, and browse the skill library.
 *
 * These are "meta tools" (Composio pattern) that let the agent discover
 * capabilities at runtime instead of having all knowledge inlined in the prompt.
 */

import { searchSkills, loadSkill, listCategories, getSkillCount } from '@/lib/skills/registry'
import type { SkillCategory } from '@/lib/skills/types'
import { okGlobal, err, type ToolResult } from './_shared'

export const SKILL_TOOL_NAMES = ['search_skills', 'load_skill', 'list_skill_categories'] as const

export function createSkillToolHandler() {
  return async function handleSkillTools(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'search_skills': {
        const { query, category, sceneType, tags } = args as {
          query: string
          category?: SkillCategory
          sceneType?: string
          tags?: string[]
        }

        if (!query && !category && !tags?.length) {
          return err('Provide at least a query, category, or tags to search for skills.')
        }

        const results = searchSkills(query || '', { category, sceneType, tags })

        if (results.length === 0) {
          return okGlobal('No matching skills found.', {
            results: [],
            totalSkills: getSkillCount(),
            suggestion: 'Try broader search terms or browse categories with list_skill_categories.',
          })
        }

        // Return lightweight summaries (no full guide)
        const summaries = results.map((r) => ({
          id: r.metadata.id,
          name: r.metadata.name,
          description: r.metadata.description,
          category: r.metadata.category,
          tags: r.metadata.tags,
          sceneType: r.metadata.sceneType,
          complexity: r.metadata.complexity,
          score: Math.round(r.score * 100) / 100,
        }))

        return okGlobal(`Found ${results.length} matching skill(s).`, {
          results: summaries,
          hint: 'Use load_skill(skillId) to get full implementation guide for any skill.',
        })
      }

      case 'load_skill': {
        const { skillId } = args as { skillId: string }

        if (!skillId) {
          return err('skillId is required.')
        }

        const skill = loadSkill(skillId)
        if (!skill) {
          return err(
            `Skill "${skillId}" not found. Use search_skills to find available skills.`,
          )
        }

        // Return full guide content — this is what the agent uses to build
        return okGlobal(`Loaded skill: ${skill.metadata.name}`, {
          skill: {
            id: skill.metadata.id,
            name: skill.metadata.name,
            category: skill.metadata.category,
            sceneType: skill.metadata.sceneType,
            parameters: skill.metadata.parameters,
            requires: skill.metadata.requires,
          },
          guide: skill.guide,
        })
      }

      case 'list_skill_categories': {
        const categories = listCategories()
        const total = getSkillCount()

        return okGlobal(`${total} skills across ${categories.length} categories.`, {
          totalSkills: total,
          categories,
          hint: 'Use search_skills(query, category) to find skills in a specific category.',
        })
      }

      default:
        return err(`Unknown skill tool: ${toolName}`)
    }
  }
}

/**
 * Skill registry — indexes skill metadata at startup, loads full content on demand.
 *
 * Architecture inspired by:
 * - Claude Code's snapshot-based tool registry with token-based routing
 * - Composio's meta-tool discovery pattern
 * - Memvid's hybrid search (text + tag matching)
 *
 * Skills are markdown files in lib/skills/library/ with YAML frontmatter.
 * Only frontmatter is indexed (fast). Full guide content loaded when agent calls load_skill.
 */

import fs from 'fs'
import path from 'path'
import type {
  SkillMetadata,
  SkillContent,
  SkillSearchResult,
  SkillCategory,
  SkillCategorySummary,
} from './types'

// ── Parsing ─────────────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

/** Parse a skill markdown file into metadata + guide content */
function parseSkillFile(filePath: string): SkillContent | null {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  const match = raw.match(FRONTMATTER_RE)
  if (!match) return null

  const [, frontmatter, guide] = match
  const metadata = parseFrontmatter(frontmatter, path.basename(filePath, '.md'))
  if (!metadata) return null

  return { metadata, guide: guide.trim() }
}

/** Simple YAML-subset parser for frontmatter (avoids yaml dependency) */
function parseFrontmatter(yaml: string, fallbackId: string): SkillMetadata | null {
  const lines = yaml.split('\n')
  const obj: Record<string, unknown> = {}
  let currentKey = ''
  let currentArray: unknown[] | null = null
  let currentArrayOfObjects: Record<string, unknown>[] | null = null
  let currentObject: Record<string, unknown> | null = null

  for (const line of lines) {
    // Array item with object fields (parameters)
    if (currentArrayOfObjects !== null && /^\s{2,}- /.test(line)) {
      // New object in array
      if (currentObject) currentArrayOfObjects.push(currentObject)
      currentObject = {}
      const content = line.replace(/^\s*- /, '').trim()
      if (content) {
        const [k, ...v] = content.split(':')
        if (k && v.length) currentObject[k.trim()] = parseYamlValue(v.join(':').trim())
      }
      continue
    }

    // Continuation of object fields in array
    if (currentObject !== null && /^\s{4,}\w/.test(line)) {
      const content = line.trim()
      const [k, ...v] = content.split(':')
      if (k && v.length) currentObject[k.trim()] = parseYamlValue(v.join(':').trim())
      continue
    }

    // Simple array item
    if (currentArray !== null && /^\s*- /.test(line)) {
      currentArray.push(line.replace(/^\s*- /, '').trim())
      continue
    }

    // End current array/object collection
    if (currentArray !== null) {
      obj[currentKey] = currentArray
      currentArray = null
    }
    if (currentArrayOfObjects !== null) {
      if (currentObject) currentArrayOfObjects.push(currentObject)
      obj[currentKey] = currentArrayOfObjects
      currentArrayOfObjects = null
      currentObject = null
    }

    // Top-level key
    const keyMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
    if (!keyMatch) continue

    const [, key, value] = keyMatch
    currentKey = key

    if (value === '' || value === undefined) {
      // Could be array or multiline — peek handled by next iteration
      // Check if this is a parameters-style array (objects) or simple array
      if (key === 'parameters') {
        currentArrayOfObjects = [] as Record<string, unknown>[]
      } else {
        currentArray = [] as unknown[]
      }
      continue
    }

    // Inline array: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      obj[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
      continue
    }

    obj[key] = parseYamlValue(value)
  }

  // Flush remaining collections after loop ends
  if (currentArray !== null) obj[currentKey] = currentArray
  if (currentArrayOfObjects !== null) {
    if (currentObject) (currentArrayOfObjects as Record<string, unknown>[]).push(currentObject)
    obj[currentKey] = currentArrayOfObjects
  }

  // Handle parameters array specially
  if (currentKey === 'parameters' && currentArray === null && currentArrayOfObjects === null) {
    // parameters was the last key with no items
    obj['parameters'] = []
  }

  return {
    id: (obj.id as string) || fallbackId,
    name: (obj.name as string) || fallbackId,
    category: (obj.category as SkillCategory) || 'technique',
    tags: Array.isArray(obj.tags) ? (obj.tags as string[]) : [],
    sceneType: (obj.sceneType as string) || 'any',
    complexity: (obj.complexity as 'simple' | 'medium' | 'complex') || 'medium',
    requires: Array.isArray(obj.requires) ? (obj.requires as string[]) : [],
    description: (obj.description as string) || '',
    parameters: Array.isArray(obj.parameters)
      ? (obj.parameters as Record<string, unknown>[]).map((p) => ({
          name: (p.name as string) || '',
          type: (p.type as string) || 'string',
          default: p.default,
          description: (p.description as string) || '',
          enum: Array.isArray(p.enum) ? (p.enum as string[]) : undefined,
        }))
      : [],
  }
}

function parseYamlValue(val: string): unknown {
  if (val === 'true') return true
  if (val === 'false') return false
  if (val === 'null' || val === '~') return null
  const num = Number(val)
  if (!isNaN(num) && val !== '') return num
  // Strip quotes
  return val.replace(/^['"]|['"]$/g, '')
}

// ── Registry ────────────────────────────────────────────────────────────────

const SKILLS_DIR = path.join(process.cwd(), 'lib', 'skills', 'library')

/** In-memory skill index — metadata only, loaded once */
let skillIndex: SkillMetadata[] | null = null

/** Full content cache — populated lazily by loadSkill */
const contentCache = new Map<string, SkillContent>()

/** Category descriptions */
const CATEGORY_DESCRIPTIONS: Record<SkillCategory, string> = {
  renderer: 'Scene type foundations — Canvas2D, Three.js, Motion, SVG, etc.',
  effect: 'Visual effects — particles, shaders, distortion, glow',
  animation: 'Animation patterns — reveals, transitions, morphs, staggers',
  layout: 'Layout systems — grids, split views, responsive arrangements',
  'data-viz': 'Data visualization — charts, graphs, dashboards, infographics',
  interaction: 'Interactive elements — buttons, sliders, hover effects',
  audio: 'Audio-reactive visuals, music sync, narration timing',
  typography: 'Text effects, kinetic type, font animations',
  '3d': '3D scenes, environments, models, camera paths',
  physics: 'Physics simulations — pendulums, projectiles, waves',
  media: 'Video, images, avatars, screen recordings',
  template: 'Pre-built scene templates for common patterns',
  technique: 'General techniques — PRNG, easing, color manipulation',
}

/** Build the skill index by scanning the library directory */
function buildIndex(): SkillMetadata[] {
  if (skillIndex) return skillIndex

  skillIndex = []

  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true })
    return skillIndex
  }

  const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'))

  for (const file of files) {
    const content = parseSkillFile(path.join(SKILLS_DIR, file))
    if (content) {
      skillIndex.push(content.metadata)
      contentCache.set(content.metadata.id, content)
    }
  }

  return skillIndex
}

/** Force re-index (useful after adding new skill files) */
export function reindexSkills(): void {
  skillIndex = null
  contentCache.clear()
  buildIndex()
}

// ── Public API (used by skill tools) ────────────────────────────────────────

/**
 * Search for skills by query text, optional category, scene type, and tags.
 * Uses token-based scoring (inspired by Claude Code's route_prompt).
 */
export function searchSkills(
  query: string,
  filters?: {
    category?: SkillCategory
    sceneType?: string
    tags?: string[]
  },
  limit = 8,
): SkillSearchResult[] {
  const index = buildIndex()
  const queryTokens = tokenize(query)

  const results: SkillSearchResult[] = []

  for (const skill of index) {
    // Apply filters first (fast rejection)
    if (filters?.category && skill.category !== filters.category) continue
    if (filters?.sceneType && skill.sceneType !== 'any' && skill.sceneType !== filters.sceneType) continue
    if (filters?.tags?.length && !filters.tags.some((t) => skill.tags.includes(t))) continue

    // Score against query tokens
    const score = scoreSkill(queryTokens, skill)
    if (score > 0) {
      results.push({ metadata: skill, score })
    }
  }

  // Sort by score descending, then by name for stability
  results.sort((a, b) => b.score - a.score || a.metadata.name.localeCompare(b.metadata.name))

  return results.slice(0, limit)
}

/**
 * Load a skill's full implementation guide.
 * Returns null if skill not found.
 */
export function loadSkill(skillId: string): SkillContent | null {
  buildIndex() // ensure indexed

  // Check cache first
  if (contentCache.has(skillId)) return contentCache.get(skillId)!

  // Try loading from disk
  const filePath = path.join(SKILLS_DIR, `${skillId}.md`)
  const content = parseSkillFile(filePath)
  if (content) {
    contentCache.set(skillId, content)
    return content
  }

  return null
}

/**
 * List all skill categories with counts and sample skills.
 */
export function listCategories(): SkillCategorySummary[] {
  const index = buildIndex()
  const byCategory = new Map<SkillCategory, SkillMetadata[]>()

  for (const skill of index) {
    const list = byCategory.get(skill.category) || []
    list.push(skill)
    byCategory.set(skill.category, list)
  }

  const summaries: SkillCategorySummary[] = []
  for (const [category, skills] of byCategory) {
    summaries.push({
      category,
      count: skills.length,
      description: CATEGORY_DESCRIPTIONS[category] || category,
      sampleSkills: skills.slice(0, 5).map((s) => s.name),
    })
  }

  // Sort by count descending
  summaries.sort((a, b) => b.count - a.count)
  return summaries
}

/**
 * Get all skill IDs (for validation).
 */
export function getAllSkillIds(): string[] {
  return buildIndex().map((s) => s.id)
}

/**
 * Get metadata for specific skill IDs (for pinned skills in custom agents).
 */
export function getSkillMetadata(ids: string[]): SkillMetadata[] {
  const index = buildIndex()
  return index.filter((s) => ids.includes(s.id))
}

/**
 * Get the total number of registered skills.
 */
export function getSkillCount(): number {
  return buildIndex().length
}

// ── Scoring (token-based, inspired by Claude Code) ──────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1)
}

function scoreSkill(queryTokens: string[], skill: SkillMetadata): number {
  if (queryTokens.length === 0) return 0.5 // empty query matches everything weakly

  // Build searchable haystack from skill fields
  const haystacks = [
    skill.name.toLowerCase(),
    skill.description.toLowerCase(),
    skill.tags.join(' ').toLowerCase(),
    skill.category.toLowerCase(),
    skill.sceneType.toLowerCase(),
  ]
  const fullHaystack = haystacks.join(' ')

  let matched = 0
  let totalWeight = 0

  for (const token of queryTokens) {
    // Weight: name match > tag match > description match
    if (skill.name.toLowerCase().includes(token)) {
      matched += 3
    } else if (skill.tags.some((t) => t.toLowerCase().includes(token))) {
      matched += 2
    } else if (fullHaystack.includes(token)) {
      matched += 1
    }
    totalWeight += 3 // max possible per token
  }

  return totalWeight > 0 ? matched / totalWeight : 0
}

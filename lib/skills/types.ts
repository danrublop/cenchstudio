/**
 * Skill registry types for the Cench Studio agent framework.
 *
 * Skills are discoverable capability packages — markdown files with frontmatter
 * that the Builder agent can search, load, and use at runtime.
 * Inspired by Claude Agent SDK's SKILL.md pattern and Composio's meta-tool discovery.
 */

// ── Skill Metadata (indexed at startup, kept in memory) ─────────────────────

export interface SkillParameter {
  name: string
  type: string
  default?: unknown
  description: string
  enum?: string[]
}

export interface SkillMetadata {
  /** Unique skill ID (filename without extension) */
  id: string
  /** Human-readable name */
  name: string
  /** Skill category for browsing */
  category: SkillCategory
  /** Searchable tags */
  tags: string[]
  /** Which scene type this skill targets (or 'any') */
  sceneType: string
  /** How complex the implementation is */
  complexity: 'simple' | 'medium' | 'complex'
  /** IDs of skills this one depends on */
  requires: string[]
  /** Short description for search results */
  description: string
  /** Customizable parameters the agent can tune */
  parameters: SkillParameter[]
}

export type SkillCategory =
  | 'renderer'      // Scene type foundations (canvas2d, three, motion, etc.)
  | 'effect'        // Visual effects (particles, shaders, distortion)
  | 'animation'     // Animation patterns (reveals, transitions, morphs)
  | 'layout'        // Layout systems (grids, split, stacked)
  | 'data-viz'      // Data visualization (charts, graphs, dashboards)
  | 'interaction'   // Interactive elements (buttons, sliders, hover)
  | 'audio'         // Audio-reactive, music sync, narration
  | 'typography'    // Text effects, kinetic type
  | '3d'            // 3D scenes, environments, models
  | 'physics'       // Physics simulations
  | 'media'         // Video, images, avatars
  | 'template'      // Pre-built scene templates
  | 'technique'     // General techniques (PRNG, easing, color)

// ── Full Skill Content (loaded on demand) ───────────────────────────────────

export interface SkillContent {
  metadata: SkillMetadata
  /** Full implementation guide (markdown body after frontmatter) */
  guide: string
}

// ── Search Results ──────────────────────────────────────────────────────────

export interface SkillSearchResult {
  /** Skill metadata (no guide — lightweight) */
  metadata: SkillMetadata
  /** Relevance score (0-1) */
  score: number
}

// ── Category Summary ────────────────────────────────────────────────────────

export interface SkillCategorySummary {
  category: SkillCategory
  count: number
  description: string
  sampleSkills: string[]
}

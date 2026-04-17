// ── Pipeline playbooks (agent-internal) ─────────────────────────────────────
//
// Loads the YAML-headed markdown files in `.claude/skills/cench/pipelines/`
// and exposes them as typed `Playbook` records the agent can reference. The
// goal is for the agent to pick a playbook based on the user's request and
// ground its storyboard decisions — without the playbooks becoming
// user-facing product SKUs.
//
// The loader is server-side (reads from disk) and caches the parsed result
// for the lifetime of the process. No migration or DB storage — playbooks
// are code, not data.

import fs from 'fs'
import path from 'path'

export interface Playbook {
  id: string
  label: string
  matchHints: string[]
  recommendedDurationSeconds: [number, number]
  sceneCount: [number, number]
  /** Capability categories this playbook expects — e.g. `tts`, `avatar`,
   *  `video`. Used to check feasibility before recommending. */
  requires: string[]
  compatiblePlaybooks: string[]
  /** Raw markdown body (after the front-matter). */
  body: string
  /** Absolute path the playbook was loaded from. */
  sourcePath: string
}

const PLAYBOOK_DIR = path.join(process.cwd(), '.claude', 'skills', 'cench', 'pipelines')

let cache: Playbook[] | null = null

/** Parse a single `{id}.md` file with YAML front-matter into a Playbook. */
function parsePlaybook(absPath: string): Playbook | null {
  const raw = fs.readFileSync(absPath, 'utf8')
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return null
  const [, header, body] = match

  const fields: Record<string, unknown> = {}
  let currentKey: string | null = null
  let currentList: string[] | null = null

  for (const rawLine of header.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line) continue
    if (line.startsWith('  - ') && currentList) {
      currentList.push(
        line
          .slice(4)
          .trim()
          .replace(/^"(.*)"$/, '$1')
          .replace(/^'(.*)'$/, '$1'),
      )
      continue
    }
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (!m) continue
    const [, key, rawValue] = m
    currentKey = key
    const value = rawValue.trim()
    if (!value) {
      currentList = []
      fields[key] = currentList
    } else if (value.startsWith('[') && value.endsWith(']')) {
      fields[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (isNaN(Number(s)) ? s.replace(/^"(.*)"$/, '$1') : Number(s)))
    } else {
      fields[key] = value.replace(/^"(.*)"$/, '$1')
      currentList = null
    }
  }

  const id = String(fields.id ?? '')
  if (!id) return null
  const asRange = (v: unknown): [number, number] => {
    if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number')) {
      return [v[0] as number, v[1] as number]
    }
    return [0, 0]
  }
  return {
    id,
    label: String(fields.label ?? id),
    matchHints: Array.isArray(fields.matchHints) ? (fields.matchHints as string[]) : [],
    recommendedDurationSeconds: asRange(fields.recommendedDurationSeconds),
    sceneCount: asRange(fields.sceneCount),
    requires: Array.isArray(fields.requires) ? (fields.requires as string[]) : [],
    compatiblePlaybooks: Array.isArray(fields.compatible_playbooks) ? (fields.compatible_playbooks as string[]) : [],
    body: body.trim(),
    sourcePath: absPath,
  }
}

export function loadPlaybooks(options?: { fresh?: boolean }): Playbook[] {
  if (!options?.fresh && cache) return cache
  // On-disk first (local dev, self-hosted). On Vercel the `.claude/` dir is
  // not in the build output — fall back to the inline TS definitions so the
  // feature works in every deployment target.
  let loaded: Playbook[] = []
  try {
    if (fs.existsSync(PLAYBOOK_DIR)) {
      const files = fs.readdirSync(PLAYBOOK_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md')
      loaded = files.map((f) => parsePlaybook(path.join(PLAYBOOK_DIR, f))).filter((p): p is Playbook => p !== null)
    }
  } catch {
    // fs access failed (read-only, sandboxed, etc.) — use inline fallback.
    loaded = []
  }
  if (loaded.length === 0) {
    // Require lazily so this module works in edge runtimes that don't support
    // static import of the inline file.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { INLINE_PLAYBOOKS } = require('./pipeline-playbooks-inline') as {
      INLINE_PLAYBOOKS: Playbook[]
    }
    loaded = INLINE_PLAYBOOKS
  }
  cache = loaded
  return cache
}

export function getPlaybook(id: string): Playbook | null {
  return loadPlaybooks().find((p) => p.id === id) ?? null
}

/** Rank playbooks against a free-form user message. Returns an array sorted
 *  by match score descending. `score === 0` means no hint matched. */
export function rankPlaybooks(userMessage: string): Array<{ playbook: Playbook; score: number }> {
  const msg = userMessage.toLowerCase()
  return loadPlaybooks()
    .map((playbook) => {
      let score = 0
      for (const hint of playbook.matchHints) {
        const h = hint.toLowerCase()
        if (msg.includes(h)) score += 10
        else {
          // Token overlap fallback
          const tokens = h.split(/\s+/).filter((t) => t.length > 3)
          for (const t of tokens) if (msg.includes(t)) score += 2
        }
      }
      return { playbook, score }
    })
    .sort((a, b) => b.score - a.score)
}

/** Pick the best-matching playbook, or null if no hint matched. */
export function matchPlaybook(userMessage: string): Playbook | null {
  const ranking = rankPlaybooks(userMessage)
  if (ranking.length === 0 || ranking[0].score === 0) return null
  return ranking[0].playbook
}

/** Test utility — clear the module-level cache. */
export function __resetPlaybookCache(): void {
  cache = null
}

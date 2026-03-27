---
name: Cench Studio Agent SDK
description: Files created for the Cench Studio Agent SDK — skill architecture, rule files, and how /cench works
type: project
---

The Cench Studio Agent SDK was restructured on 2026-03-26 to follow Remotion's pure-knowledge-injection pattern.

## Architecture

The `/cench` skill is now split into three layers:

1. **`/Users/daniellopez/SVG.vide.new/CLAUDE.md`** — Auto-loaded project context. Covers stack, directory structure, all API routes, scene types, globals available in scene HTML, and a pointer to `.claude/skills/cench/SKILL.md`. Does NOT contain templates or generation rules (those live in the skill/rules layer).

2. **`.claude/commands/cench.md`** — Thin redirect only. 6 lines. Loads SKILL.md and passes `$ARGUMENTS`. Zero embedded logic.

3. **`.claude/skills/cench/SKILL.md`** — Skill entry point. Covers: pre-flight check (verify dev server), prompt parsing, scene type selection guide, planning, which rule file to read per type, file writing instructions, editing workflow, output format.

4. **`.claude/skills/cench/rules/`** — One file per scene type + core:
   - `core.md` — Globals, mulberry32, text rules, timing, safe area, fonts
   - `svg.md` — SVG structure, animation classes, layering, text, colors, patterns, DON'Ts, full HTML template
   - `canvas2d.md` — Required skeleton, animation patterns, DON'Ts, HTML template
   - `d3.md` — Output format, globals, SVG setup, animation patterns, font sizes, chart types, colors, HTML template
   - `three.md` — Globals, required boilerplate, lighting, materials, camera, geometry list, constraints, animation pattern, HTML template
   - `motion.md` — Output format, libraries, CSS rules, HTML content rules, sceneCode patterns, timing, DON'Ts, HTML template

## Key decisions

- HTML templates live in rule files, not in CLAUDE.md or cench.md — reducing token cost when skill is not active
- Zero curl commands or hardcoded API calls in any skill file — pure domain knowledge
- Scenes are written directly to `public/scenes/{id}.html` using the Write tool
- `scripts/templates/` directory was deleted — replaced by templates in rule files

## API reality check (2026-03-26)

- `POST /api/scene` accepts `{ id, html }` — writes file only, no DB record, only POST exists (no GET, no PATCH)
- `GET /api/projects` — lists projects from PostgreSQL
- `POST /api/projects` — creates project record with full scene data as JSONB in `description` field
- No `/api/scene` GET or PATCH exists — scene state lives in the project record via `/api/projects`

**Why:** Restructured to reduce token cost of the /cench skill (templates were duplicated in CLAUDE.md and cench.md) and to enable skills to be updated independently of the main command file.

**How to apply:** When adding a new scene type, add a rule file in `.claude/skills/cench/rules/` and add an entry to the type selection table in SKILL.md. Update CLAUDE.md scene types table too.

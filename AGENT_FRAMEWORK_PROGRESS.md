# Agent Framework Progress and Goals

This document tracks what has been implemented so far in the Cench Studio agent framework, and what we are aiming to complete next.

Reference architecture inspiration: [ultraworkers/claw-code](https://github.com/ultraworkers/claw-code)

## Why this work

The goal is to make the Cench agent framework feel "Cursor-like" in reliability and control while preserving Cench strengths (scene semantics, timeline awareness, storyboard-first workflow, and multimodal generation tools).

We want:

- Strong tool contract enforcement
- Safer and more modular execution
- Better pause/resume and human-in-the-loop approvals
- Deterministic persistence and recovery
- Clear migration path from monolithic execution logic to explicit handlers

## What we have implemented so far

## 1) Planner and review flow hardening

- Added storyboard persistence fields on projects:
  - `storyboardProposed`
  - `storyboardEdited`
  - `storyboardApplied`
- Added paused-run durability:
  - `pausedAgentRun` persisted in DB and store
- Added resume path for blocked tool calls:
  - API supports `resumeToolCall`
  - runner can execute resumed call before normal loop
- Added UI support for:
  - plan review persistence
  - field-level and scene-level revert
  - paused run banner and resume action

## 2) Tool execution safety upgrades

- Replaced lightweight tool-arg checks with AJV JSON Schema validation
- Enforced strict parsing and validation across Anthropic/OpenAI/Gemini paths
- Added stop-on-invalid-tool-args behavior
- Improved permission pause behavior and user-facing pause messaging
- Improved parallel global style merge to avoid clobbering unrelated fields

## 3) Scene storage migration progress

- Added transitional scene blob adapter (`project-scene-storage`)
- Introduced table-backed scene persistence:
  - `scene_blob` on scenes
  - dual-write from API and agent persistence paths
- Added table-native scene graph persistence:
  - `scene_nodes`
  - `scene_graph_start_scene_id`
- Implemented table-first reads with blob fallback and lazy backfill
- Upgraded table sync from delete/reinsert to diffed upsert behavior
- Added collision safety checks for scene IDs across projects
- Made agent-run persistence more atomic by moving project update + table sync into one transaction path

## 4) Permission framework unification

- Unified tool permission checks to use canonical logic from `lib/permissions.ts`
- Preserved current UX behavior for repeated session approvals
- Enriched permission payloads with:
  - reason
  - details (prompt/model/duration/resolution)
- Applied enriched context across major tool families

## 5) Registry architecture migration (major ongoing track)

- Added base tool registry (`tool-registry.ts`)
- Routed tool execution through registry
- Added registry coverage checks against canonical tool list
- Added dev visibility:
  - logs for default-backed tools
  - dev endpoint: `GET /api/dev/agent-registry-status`
- Added strict-mode flag:
  - `AGENT_TOOL_REGISTRY_STRICT=true` requires full explicit coverage
- Added migrated-family enforcement:
  - migrated tools cannot silently use legacy fallback

### Explicit handler families (ALL 16 extracted — migration complete)

- Scene tools (`scene-tools.ts`) — 7 tools
- Style/timeline tools (`style-tools.ts`) — 6 tools
- Interaction graph tools (`interaction-tools.ts`) — 4 tools
- Audio tools (`audio-tools.ts`) — 4 tools
- Image/video tools (`image-video-tools.ts`) — 5 tools
- Avatar tools (`avatar-tools.ts`) — 4 tools
- Layer tools (`layer-tools.ts`) — 14 tools (including build_zdog_asset)
- Chart tools (`chart-tools.ts`) — 4 tools
- Element tools (`element-tools.ts`) — 7 tools
- AI layer tools (`ai-layer-tools.ts`) — 4 tools
- Parenting tools (`parenting-tools.ts`) — 2 tools
- Asset/media tools (`asset-media-tools.ts`) — 5 tools
- Template tools (`template-tools.ts`) — 3 tools
- Planning & export tools (`planning-export-tools.ts`) — 3 tools
- Three.js/world/model library tools (`three-world-tools.ts`) — 5 tools
- Physics tools (`physics-tools.ts`) — 4 tools

## Current status

**Registry migration is complete.** All canonical tools (~75) have explicit handlers in dedicated files under `lib/agents/tool-handlers/`. The legacy monolithic `executeToolLegacy` switch and its default fallback handler have been removed entirely. The `ensureRegistryCoverage()` check now enforces that every canonical tool has an explicit handler at startup — no silent fallback is possible.

`tool-executor.ts` reduced from ~3400 lines to ~500 lines. It now contains only:

- Snapshot system
- WorldStateMutable interface
- Shared helpers (clearStaleCodeFields, generateLayerContent)
- Permission helpers (checkApiPermission, checkMediaEnabled, enrichPermission)
- Unified handler registration
- HTML regeneration

## Remaining goals for the agent framework

## A) ~~Complete explicit handler migration~~ ✓ DONE

- ✓ All tool families extracted from legacy switch
- ✓ Default fallback removed
- Strict mode (`AGENT_TOOL_REGISTRY_STRICT=true`) now effectively a no-op — all tools are explicit
- TODO: Add CI check to prevent regression

## B) Single authoritative persistence orchestration

- Unify blob/table/html persistence semantics
- Add explicit compensation and retry strategy for partial failures
- Ensure export and preview always read consistent state

## C) Permission and spend governance

- Complete transactional spend accounting updates
- Enforce budget caps with hard stops
- Keep permission prompts rich, consistent, and auditable

## D) Router and planner alignment

- Ensure planner is first-class in routing policy (not only override-driven)
- Keep storyboard-first plan/review/apply behavior predictable

## E) Runtime and streaming contract stability

- Reduce race windows between `done` and final state delivery
- Improve run checkpointing and resume semantics

## F) Internal service composition

- Replace internal API self-fetches from tool executor with service-level calls
- Improve latency and trace consistency

## G) Security and tenancy readiness

- Enforce project ownership and authorization checks on all mutation paths
- Harden assumptions around multi-user data access

## Next recommended implementation order

1. ~~Finish remaining explicit handler extraction~~ ✓ DONE
2. Add CI check for registry coverage (all canonical tools must be explicit).
3. Unify final state emission semantics around run completion.
4. Consolidate scene persistence into a single orchestrator with clear failure semantics.
5. Complete spend/budget accounting loop and enforcement.
6. Move executor internal fetch calls to direct shared services.
7. Tighten authz guards on projects/scenes/agent routes.

## Notes

- TypeScript build currently still reports pre-existing errors outside this migration track.
- Lint checks for files touched in this effort are clean.
- Progress is intentionally incremental to preserve runtime behavior while hardening architecture.

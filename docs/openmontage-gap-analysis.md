# OpenMontage vs Cench Studio — Gap Analysis

> **Status (2026-04-17):** All HIGH and MEDIUM gaps from this report have shipped. Only items explicitly marked LOW / skip remain. See the "Implementation status" table near the bottom.

Reference doc from an audit comparing Cench Studio against [OpenMontage](https://github.com/calesthio/OpenMontage) (a CLI-native agentic video pipeline system, ~2.4k stars, AGPL-3.0).

OpenMontage has no GUI — it's a set of YAML pipelines + 57+ Python tools + Markdown skills that a host coding assistant (Claude Code, Cursor, Codex, etc.) orchestrates. This makes it Cench's philosophical opposite on the UI axis but meaningfully deeper on orchestration, governance, and provider breadth.

## One-line verdict

Cench wins on editor surface, multi-renderer scene composition, interactive publishing, per-layer editing, and project persistence. OpenMontage wins on budget discipline, provider breadth per capability, pre-baked pipelines, canonical stage artifacts, and cross-vendor knowledge depth. **Most of OpenMontage's advantages are policies and schemas, not features — cheap to port if we want them.**

---

## What NOT to borrow

- **Pure-agent orchestration model.** OpenMontage works because it has no app; the host LLM is the control plane. Cench has a UI, store, timeline, DB — a declarative YAML-driven pipeline layered on top would fight the existing architecture.
- **Python tooling layer.** Cench is TypeScript end-to-end. Rewriting tools in Python to match would be strictly negative.
- **12 preset pipelines as top-level product.** Cench's value prop is "prompt → edit → publish interactive or MP4." Pipelines belong as agent-internal playbooks, not user-facing SKUs.
- **Remotion as primary composer.** Cench's React default + bridge components already beats OpenMontage's Remotion breadth. Don't regress.

---

## Gaps that actually matter — ranked

### HIGH value, LOW lift

1. **Honest capability disclosure at preflight.**
   OpenMontage's contract: agent announces "N of M providers configured" before degrading silently. Cench tracks which providers are configured+enabled but doesn't surface this at the start of a run.
   - Evidence: `lib/audio/provider-registry.ts` has the registry; `lib/agents/prompts.ts` mentions providers in context but doesn't enumerate enabled ones up front.

2. **Platform export profiles.**
   YouTube landscape/shorts, IG Reels/Feed, TikTok, LinkedIn — each with codec, bitrate, CRF, duration cap. Cench has aspect ratio + resolution in `lib/dimensions.ts` but no platform preset. Trivial to add as a layer over existing export settings; big perceived-polish gain.
   - Reference: OpenMontage's `lib/media_profiles.py`.

3. **Cost approval gate for expensive single tool calls.**
   Cench has `maxRunCostUsd` as a circuit breaker in `lib/agents/runner.ts:91` and per-project `totalCostUsd` aggregation. Missing: "this next call will cost $X, approve?" for anything above a threshold (OpenMontage defaults to $0.50). A one-tool-call gate is small; the win is spreading it across 122 tools.

4. **SRT/VTT caption generation from TTS.**
   Cench already runs TTS and knows the text. Emitting word-timed captions is nearly free when providers return timestamps (ElevenLabs, OpenAI TTS both do). Not transcription — the easy version that uses what we already have.

### HIGH value, MEDIUM lift

5. **Provider selector with scoring.**
   OpenMontage ranks providers across 7 dimensions (task fit, quality, control, reliability, cost, latency, continuity). Cench has registries but no ranker. A small scorer reading provider metadata would let the agent make honest "best available" choices instead of hardcoded preferences.
   - Evidence: `lib/audio/resolve-best-tts-provider.ts` is a skeleton; generalize to image/video/avatar.

6. **Canonical stage artifacts with schemas.**
   Cench has `Storyboard` (`lib/db/schema.ts:183-185`) and `RunCheckpoint` (`lib/agents/checkpoint-schema.ts`). Extending to script, scene_plan, asset_manifest, render_report as Zod schemas would make multi-stage runs inspectable and resumable mid-stage (not just mid-scene).

7. **Video generation provider breadth.**
   Cench has one text-to-video (Veo 3). OpenMontage has 14 including Kling, Runway Gen-4, Grok Imagine, MiniMax, plus local WAN/Hunyuan/LTX. Adding Kling + Runway would match the 80th-percentile case without infra lift — both are HTTP APIs.
   - Files: `app/api/generate-video/route.ts`, `lib/apis/veo3.ts`.

### MEDIUM value, MEDIUM lift

8. **Asset enhancement suite.**
   Cench has BG removal (fal.ai/BRIA). Missing: Real-ESRGAN upscale, CodeFormer/GFPGAN face restore, FFmpeg LUT color grading.

9. **Preset pipelines as agent-internal playbooks.**
   Not user-facing SKUs. Internal templates the agent can load: "talking-head flow", "animated-explainer flow", "podcast-repurpose flow". Store as YAML/JSON skills under `.claude/skills/cench/pipelines/` — Cench already uses this pattern for renderer rules.

10. **Budget lifecycle (estimate → reserve → reconcile).**
    Cench tracks cost after the fact (`api_spend` table, `lib/db/schema.ts:543-556`). Reserving budget before a call and reconciling after catches runaway parallel tool calls that the post-hoc circuit breaker misses.

### LOW priority / skip

- **Reference-driven creation** (paste URL → generate variants). Novel but niche.
- **Eval harness with tolerance testing.** Valuable in theory but requires a tagged test corpus Cench doesn't have.
- **Layer-3 vendor skills beyond renderers.** Cench's `.claude/skills/cench/rules/` is strong on renderers but thin on vendor APIs. Add opportunistically.

---

## Ideas worth internalizing even without porting

- **Three-layer knowledge stack** (tools → how-we-use-them → vendor-docs). Cench has layers 1 and 2 in `rules/`. Making layer 3 explicit would scale better as providers multiply.
- **PROMPT_GALLERY with tested prompts + costs.** OpenMontage publishes $1.33 for a 60s Pixar-style short. A Cench equivalent (tested project templates with known cost + duration) would be both a sales asset and a regression checklist.
- **Per-assistant onboarding files** (CLAUDE.md, CURSOR.md, CODEX.md) pointing to a shared AGENT_GUIDE. Relevant once we target multiple hosts for the SDK product.

---

## Files to revisit when any of these get picked up

- `lib/agents/runner.ts` — cost limits, capability disclosure hook
- `lib/agents/prompts.ts` — where preflight disclosure would be injected
- `lib/audio/provider-registry.ts`, `lib/audio/resolve-best-tts-provider.ts` — selector pattern to generalize
- `lib/db/schema.ts` — artifact tables, per-project cost_log
- `lib/dimensions.ts`, export settings — platform profiles
- `app/api/generate-video/route.ts`, `lib/apis/veo3.ts` — video provider expansion
- `.claude/skills/cench/rules/` — where pipeline playbooks and vendor skills would live

---

## Priority order

1. **Capability disclosure** — preflight summary of which providers are configured.
2. **Platform export profiles** — YouTube/IG/TikTok presets layered on existing export settings.
3. **SRT/VTT caption generation** — timestamps from TTS responses into standard caption files.

All three are small, user-visible, and plug into code that already exists. Everything below that is a real trade-off call.

---

## Implementation status (2026-04-17)

| #   | Gap                                          | Status                                        | Landed in                                                                                                                                                                                                                                                               |
| --- | -------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Capability disclosure                        | ✅ Shipped                                    | `lib/agents/context-builder.ts` — "## Capability Disclosure" block with X-of-Y counts, image-gate honesty, caption sub-caveats, skipped when no rows apply.                                                                                                             |
| 2   | Platform export profiles                     | ✅ Shipped                                    | `lib/export/platform-profiles.ts` (8 profiles + Custom), `components/ExportModal.tsx` picker with aspect/duration warnings + "switch project aspect" inline action, persisted on `mp4Settings.platformProfileId`.                                                       |
| 3   | Cost approval gate                           | ✅ Shipped                                    | `lib/permissions.ts` (`API_COST_SCALARS`, `estimateApiCostUsd`, `resolveCostThreshold`), `PermissionConfig.singleCallCostThreshold`, `checkPermission` upgrades auto-allow→ask when over threshold. `PermissionDialog` surfaces `costThresholdExceeded`. Default $0.50. |
| 4   | SRT/VTT captions                             | ✅ Shipped                                    | `lib/audio/captions.ts` (aligned + naive fallback + project merge), ElevenLabs `/with-timestamps`, fallback for every TTS provider, sidecar `.srt`/`.vtt` files, Electron export writes project-level captions, web export exposes Blob download.                       |
| 5   | Provider selector with scoring               | ✅ Shipped                                    | `lib/providers/selector.ts` (6-axis scorer + weight presets), `tts-profiles.ts`, `image-profiles.ts`, `video-profiles.ts`. `getBestTTSProvider` now delegates to the scorer. `resolveTTSProviderWithReason` exposes the "why" for disclosure.                           |
| 6   | Canonical stage artifacts                    | ✅ Shipped                                    | `lib/agents/stage-artifacts.ts` — Zod schemas for `script`, `scene_plan`, `asset_manifest`, `render_report` plus `parseStageArtifact` validator. Intermediate outputs now have contracts; mid-stage resumption is unblocked.                                            |
| 7   | Video provider breadth                       | ✅ Shipped                                    | `lib/apis/video/` (types, Kling via fal.ai, Runway Gen-4 direct, registry). `/api/generate-video/route.ts` dispatches by provider. Registry + permissions + selector profiles + cost scalars added for Kling + Runway.                                                  |
| 8   | Asset enhancement suite                      | ✅ Shipped (partial — upscale + face restore) | `lib/apis/enhancement.ts` (Real-ESRGAN upscale, CodeFormer face restore via fal.ai), `/api/enhance-image`. FFmpeg LUT color grading deferred.                                                                                                                           |
| 9   | Preset pipelines as agent-internal playbooks | ✅ Shipped                                    | `.claude/skills/cench/pipelines/` (talking-head, animated-explainer, podcast-repurpose), `lib/agents/pipeline-playbooks.ts` loader + `matchPlaybook`/`rankPlaybooks`.                                                                                                   |
| 10  | Budget lifecycle                             | ✅ Shipped                                    | `lib/agents/budget-tracker.ts` with `reserveSpend` / `reconcileSpend` / `releaseSpend` / `sweepStaleReservations`. `logSpend` mirrors into the in-memory tracker so live queries see worst-case committed cost.                                                         |

### Still open (intentionally deferred from the original list)

- **Reference-driven creation** — flagged LOW / niche.
- **Eval harness with tolerance testing** — blocked on a tagged test corpus.
- **Layer-3 vendor skills beyond renderers** — add opportunistically, not a project.
- **FFmpeg LUT color grading** — partial of #8; needs server-side FFmpeg integration + LUT file handling that is larger than the other enhancements.
- **Interactive publish captions** — `<track>` injection in the publish player. Flagged during the caption audit.
- **Web render-server SRT/VTT sidecar** — the Electron path writes sidecar files; the web render-server path still relies on the client-side download.

### Test coverage added during implementation

10 test files / 80 tests covering:

- Caption extraction (`charAlignmentToWords`, grouping, gap/whitespace edge cases, naive fallback, project merge)
- Cost approval gate (threshold resolution, mode upgrades, per-API overrides, free-provider bypass)
- Provider selector (availability filters, task-fit bias, continuity tiebreak, throws-safe)
- Stage artifacts (schema validation, error path)
- Budget tracker (reserve/reconcile/release, project isolation, stale sweep, negative clamp)
- Playbook loader (YAML parsing, ranking, matching)

### Internalised ideas (not directly ported)

- **Three-layer knowledge stack** — tool → how-we-use-it → vendor-doc. Cench has layers 1 and 2; layer 3 is added opportunistically.
- **PROMPT_GALLERY with tested prompts + costs** — future regression harness asset.
- **Per-assistant onboarding files** — relevant once the SDK product targets multiple coding assistants.

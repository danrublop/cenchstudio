# Graph Report - . (2026-04-07)

## Corpus Check

- 148 files · ~153,521 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 502 nodes · 742 edges · 41 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 128 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)

1. `runAgent()` - 12 edges
2. `POST()` - 12 edges
3. `AgentLogger` - 11 edges
4. `ToolRegistry` - 10 edges
5. `executeTool()` - 10 edges
6. `wrapSceneAsReact()` - 7 edges
7. `Cench Studio` - 7 edges
8. `Agent System (lib/agents/)` - 7 edges
9. `Gap 3: Clip-on-Timeline Model` - 7 edges
10. `Tool Executor (tool-executor.ts, ~1377 lines)` - 7 edges

## Surprising Connections (you probably didn't know these)

- `Core Execution Engine (~5226 lines)` --conceptually_related_to--> `Agent Framework (Claude API + Tool Use)` [INFERRED]
  docs/agent-system-map.md → CLAUDE.md
- `Gap 1: Visual Feedback for Agent (capture_frame)` --references--> `Agent System (lib/agents/)` [EXTRACTED]
  ROADMAP.md → CODEBASE_MAP.md
- `Custom Avatar Pipeline` --conceptually_related_to--> `Avatar System (lib/avatar/)` [INFERRED]
  docs/avatar-pipeline.md → CODEBASE_MAP.md
- `14 Timeline NLE Tools` --conceptually_related_to--> `Gap 3: Clip-on-Timeline Model` [INFERRED]
  docs/SYSTEM-INVENTORY.md → ROADMAP.md
- `Scene HTML Serialization (lib/scene-html/)` --references--> `Scene Types (SVG, Canvas2D, D3, Three, Motion, Lottie)` [INFERRED]
  CODEBASE_MAP.md → CLAUDE.md

## Hyperedges (group relationships)

- **Roadmap Gap Dependency Chain (Gap1 -> Gap2 -> Gap3 -> Gaps 4-7)** — roadmap_gap1_visual_feedback, roadmap_gap2_continuous_preview, roadmap_gap3_clip_track_model, roadmap_gap4_multi_video, roadmap_gap5_trim_split_speed, roadmap_gap6_keyframe_animation, roadmap_gap7_visual_effects [EXTRACTED 1.00]
- **Agent Execution Pipeline (API -> Runner -> Context -> Executor -> Orchestrator)** — agentmap_api_routes, agentmap_runner, agentmap_context_builder, agentmap_tool_executor, agentmap_orchestrator [EXTRACTED 1.00]
- **Agent Framework Hardening (Registry + Safety + Permissions + Storage)** — progress_registry_migration, progress_tool_execution_safety, progress_permission_framework, progress_scene_storage_migration, progress_planner_review_flow [EXTRACTED 1.00]

## Communities

### Community 0 - "Tool Handlers"

Cohesion: 0.04
Nodes (27): clampNum(), createPhysicsToolHandler(), normalizeAngle(), sanitizePhysicsParams(), toFiniteNumber(), err(), findSceneOrErr(), ok() (+19 more)

### Community 1 - "Store Actions"

Cohesion: 0.04
Nodes (2): ensureStoryboardSceneIds(), ensureStoryboardSceneIdsForPair()

### Community 2 - "Database Queries"

Cohesion: 0.05
Nodes (4): escapeLike(), searchAssets(), patchLayerCode(), updateLayer()

### Community 3 - "Agent System Map"

Cohesion: 0.07
Nodes (35): Agent API Routes (~2330 lines), Context Builder (context-builder.ts, ~1031 lines), Core Execution Engine (~5226 lines), Agent Data Flow (User -> API -> Runner -> Tools -> DB -> UI), Orchestrator (orchestrator.ts, ~522 lines), Agent Router (router.ts, ~246 lines), Agent Runner (runner.ts, ~2050 lines), Tool Executor (tool-executor.ts, ~1377 lines) (+27 more)

### Community 4 - "Agent API Route"

Cohesion: 0.1
Nodes (15): calcCost(), callLocalSimple(), classifyType(), createMockAgentResponse(), DELETE(), extractText(), generateOnceLegacy(), GET() (+7 more)

### Community 5 - "Scene Persistence"

Cohesion: 0.09
Nodes (5): edgeSemanticKey(), normalizeEdgeCondition(), writeProjectScenesToTablesTx(), archiveProject(), updateProject()

### Community 6 - "Context Builder"

Cohesion: 0.15
Nodes (17): buildAgentContext(), buildRouterContext(), buildWorldState(), compactInFlightMessages(), estimateContentTokens(), filterToolsForAgent(), getModelQualityTier(), resolveMaxTokensForThinking() (+9 more)

### Community 7 - "Agent Runner"

Cohesion: 0.19
Nodes (13): calculateCost(), emitToolCompleteWithStoryboard(), getGoogleClient(), getLocalClient(), getOpenAIClient(), getToolTimeout(), isRetryableError(), runAgent() (+5 more)

### Community 8 - "Config & Hooks"

Cohesion: 0.16
Nodes (6): deepMerge(), isPlainObject(), resolveAgentConfig(), loadProjectHooks(), wrapPostHook(), wrapPreHook()

### Community 9 - "LLM Generation"

Cohesion: 0.18
Nodes (8): callAnthropic(), callGoogle(), callLocal(), callOpenAI(), generateCode(), getGoogleClient(), getLocalClient(), getOpenAIClient()

### Community 10 - "Prompts & D3"

Cohesion: 0.15
Nodes (5): generateOnce(), runStructuredD3Generation(), buildSceneMakerPrompt(), buildStyleGuidanceBlock(), getAgentPrompt()

### Community 11 - "Media Schema"

Cohesion: 0.19
Nodes (0):

### Community 12 - "Architecture Docs"

Cohesion: 0.14
Nodes (14): Agent Framework (Claude API + Tool Use), Cench Studio, Drizzle ORM (PostgreSQL), Next.js App Router, Rationale: Motion is Default Renderer, Render Server (Puppeteer + FFmpeg), Scene API (CRUD + HTML generation), Scene HTML Globals (WIDTH, HEIGHT, PALETTE, etc.) (+6 more)

### Community 13 - "NLE Roadmap"

Cohesion: 0.2
Nodes (12): Pixi.js Compositor (lib/compositor/), Electron Desktop Shell, 14 Timeline NLE Tools, Gap 1: Visual Feedback for Agent (capture_frame), Gap 2: Continuous Timeline Preview, Gap 3: Clip-on-Timeline Model, Gap 4: Multi-Video Compositing, Gap 5: Trim / Split / Speed (+4 more)

### Community 14 - "Tool Registry"

Cohesion: 0.2
Nodes (1): ToolRegistry

### Community 15 - "Agent Logger"

Cohesion: 0.27
Nodes (1): AgentLogger

### Community 16 - "MCP Adapter"

Cohesion: 0.29
Nodes (5): apiFetch(), executeToolCall(), listProjects(), loadWorldState(), refreshWorld()

### Community 17 - "Orchestrator"

Cohesion: 0.36
Nodes (7): aggregateUsage(), buildActiveToolsForSceneType(), buildScenePrompt(), buildSceneWithSubAgent(), checkCrossSceneConsistency(), matchStoryboardToScenes(), runOrchestrated()

### Community 18 - "Generation Logs"

Cohesion: 0.28
Nodes (3): createGenerationLog(), truncateForDB(), updateGenerationLog()

### Community 19 - "Avatar Pipeline"

Cohesion: 0.25
Nodes (9): brunette.glb (CC BY-NC 4.0, Dev Only), mpfb.glb (CC0, Limited Lip-Sync), Option A: Avaturn (Recommended), Option B: Blender + MPFB, Option C: Mixamo Rigging, Custom Avatar Pipeline, Rationale: Dev Avatars Have Licensing Restrictions, TalkingHead.js Avatar Requirements (+1 more)

### Community 20 - "Community 20"

Cohesion: 0.46
Nodes (7): wrapCanvasAsReact(), wrapD3AsReact(), wrapLottieAsReact(), wrapMotionAsReact(), wrapSceneAsReact(), wrapSVGAsReact(), wrapThreeAsReact()

### Community 21 - "Community 21"

Cohesion: 0.6
Nodes (4): computeRunMetrics(), detectFrustration(), logRunAnalytics(), serializeRunMetrics()

### Community 22 - "Community 22"

Cohesion: 0.67
Nodes (3): 13 Permission-Gated APIs, Permission Framework Unification, Goal C: Permission and Spend Governance

### Community 23 - "Community 23"

Cohesion: 1.0
Nodes (2): Rationale: Settings Panel for System Config Only, UI Panel Layout (Layers Tab vs Settings Panel)

### Community 24 - "Community 24"

Cohesion: 1.0
Nodes (0):

### Community 25 - "Community 25"

Cohesion: 1.0
Nodes (1): Standalone Embeddable Player (packages/player/)

### Community 26 - "Community 26"

Cohesion: 1.0
Nodes (1): Marketing Website (website/)

### Community 27 - "Community 27"

Cohesion: 1.0
Nodes (1): 3D Environments (lib/three-environments/)

### Community 28 - "Community 28"

Cohesion: 1.0
Nodes (1): Zdog 3D Characters (lib/zdog/)

### Community 29 - "Community 29"

Cohesion: 1.0
Nodes (1): Goal G: Security and Tenancy Readiness

### Community 30 - "Community 30"

Cohesion: 1.0
Nodes (1): Weakpoint: No SSE Keepalive Heartbeat

### Community 31 - "Community 31"

Cohesion: 1.0
Nodes (1): Weakpoint: Checkpoint Resume Can Lose User Edits

### Community 32 - "Community 32"

Cohesion: 1.0
Nodes (1): SSE Event Stream (17 Events)

### Community 33 - "Community 33"

Cohesion: 1.0
Nodes (1): 39 Scene Transitions

### Community 34 - "Community 34"

Cohesion: 1.0
Nodes (1): AI Models (Anthropic, OpenAI, Google)

### Community 35 - "Community 35"

Cohesion: 1.0
Nodes (1): 12 Audio Providers

### Community 36 - "Community 36"

Cohesion: 1.0
Nodes (1): 11 Media Providers

### Community 37 - "Community 37"

Cohesion: 1.0
Nodes (1): Skill Files (.claude/skills/cench/)

### Community 38 - "Community 38"

Cohesion: 1.0
Nodes (1): Config Hierarchy (Env > Local > Project)

### Community 39 - "Community 39"

Cohesion: 1.0
Nodes (1): Supporting Systems (Logger, Memory, Analytics, Session, Hooks)

### Community 40 - "Community 40"

Cohesion: 1.0
Nodes (1): Agent System Total ~17,500+ Lines

## Knowledge Gaps

- **53 isolated node(s):** `Next.js App Router`, `Drizzle ORM (PostgreSQL)`, `Render Server (Puppeteer + FFmpeg)`, `Scene API (CRUD + HTML generation)`, `UI Panel Layout (Layers Tab vs Settings Panel)` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 23`** (2 nodes): `Rationale: Settings Panel for System Config Only`, `UI Panel Layout (Layers Tab vs Settings Panel)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `elements.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `Standalone Embeddable Player (packages/player/)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `Marketing Website (website/)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `3D Environments (lib/three-environments/)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `Zdog 3D Characters (lib/zdog/)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `Goal G: Security and Tenancy Readiness`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Weakpoint: No SSE Keepalive Heartbeat`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `Weakpoint: Checkpoint Resume Can Lose User Edits`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `SSE Event Stream (17 Events)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `39 Scene Transitions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `AI Models (Anthropic, OpenAI, Google)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `12 Audio Providers`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `11 Media Providers`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `Skill Files (.claude/skills/cench/)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Config Hierarchy (Env > Local > Project)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `Supporting Systems (Logger, Memory, Analytics, Session, Hooks)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Agent System Total ~17,500+ Lines`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `AgentLogger` connect `Agent Logger` to `Tool Handlers`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `Agent System (lib/agents/)` connect `Agent System Map` to `NLE Roadmap`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `runAgent()` (e.g. with `validateToolInputAgainstSchema()` and `withTimeout()`) actually correct?**
  _`runAgent()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `POST()` (e.g. with `GET()` and `parseBlob()`) actually correct?**
  _`POST()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `executeTool()` (e.g. with `ensureAllHandlersRegistered()` and `ensureRegistryCoverage()`) actually correct?**
  _`executeTool()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js App Router`, `Drizzle ORM (PostgreSQL)`, `Render Server (Puppeteer + FFmpeg)` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Tool Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._

# Agent Framework Audit: Flow, Weakpoints & Hardening

## Current Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. CLIENT (AgentChat.tsx)                                              │
│     User types message → POST /api/agent with:                         │
│     { message, scenes, globalStyle, history, images, agentOverride }    │
│     Opens SSE stream for real-time events                               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│  2. API ROUTE (app/api/agent/route.ts)                                  │
│     • Validate request (≤50KB msg, ≤100 scenes, ≤200 history)          │
│     • Load project assets from DB                                       │
│     • Load user memories (cross-session learnings)                      │
│     • Handle checkpoint resume if prior run was interrupted             │
│     • Create SSE stream with sendEvent()                                │
│     • Call runAgent() → pipe events to stream                           │
│     • On completion: persist scenes to DB, log generation, store memory │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│  3. RUNNER (lib/agents/runner.ts)                                       │
│                                                                         │
│  Phase A — Agent Resolution                                             │
│     If agentOverride: use that agent                                    │
│     Else: always use 'scene-maker' (Master Builder) — router bypassed   │
│                                                                         │
│  Phase B — Context Building (context-builder.ts)                        │
│     • Resolve model by tier (budget/balanced/performance)               │
│     • Build system prompt (MASTER_BUILDER_PROMPT + skill library ref)   │
│     • Build world state (scene summaries + focused scene detail)        │
│     • Select tools from agent's toolAccess list                         │
│     • Set thinking budget (16K tokens for deep mode)                    │
│                                                                         │
│  Phase C — Streaming LLM Call                                           │
│     • Call Claude/OpenAI/Gemini API with streaming                      │
│     • Emit 'token' events as text arrives                               │
│     • Emit 'thinking_token' events for extended thinking                │
│                                                                         │
│  Phase D — Tool-Use Loop                                                │
│     while stop_reason === 'tool_use' AND iterations < 15:              │
│       for each tool_call:                                               │
│         1. Validate args against JSON schema (AJV)                      │
│         2. Take state snapshot (for rollback)                           │
│         3. Execute tool (tool-executor → tool-handlers/*)               │
│         4. Emit tool_start / tool_complete events                       │
│         5. If tool throws → restore snapshot                            │
│       Collect tool results → build user message                         │
│       Refresh world state (every 3 iterations)                          │
│       Call Claude again with tool results                               │
│                                                                         │
│  Phase E — Finalization                                                 │
│     • Compute token usage + cost                                        │
│     • Log spend to DB                                                   │
│     • Return updatedScenes, globalStyle, usage                          │
│                                                                         │
│  Hard Limits: 15 iterations, 50 tool calls, $2.00 cost, 60s/tool      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│  4. TOOL EXECUTION (tool-executor.ts → tool-handlers/*.ts)              │
│                                                                         │
│  Pipeline per tool call:                                                │
│     Pre-hook → Permission check → Snapshot → Execute → Post-hook       │
│                                                                         │
│  Handler files:                                                         │
│     scene-tools.ts    — create/delete/duplicate/reorder scenes          │
│     layer-tools.ts    — add/regenerate/delete/patch layers              │
│     element-tools.ts  — edit/move/resize elements                       │
│     style-tools.ts    — global style, roughness, transitions            │
│     audio-tools.ts    — narration, music, SFX                           │
│     chart-tools.ts    — D3 chart generation                             │
│     skill-tools.ts    — search/load/list skills (NEW)                   │
│     template-tools.ts — canvas/three templates                          │
│     physics-tools.ts  — physics simulations                             │
│     three-world-tools.ts — immersive 3D environments                    │
│     + 8 more handler files                                              │
│                                                                         │
│  State mutation: tools mutate plain Scene[] + GlobalStyle objects       │
│  Rollback: snapshot restored if tool throws                             │
│  HTML generation: writeSceneHTML() writes to public/scenes/{id}.html   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│  5. PERSISTENCE (route.ts post-run)                                     │
│                                                                         │
│  Dual storage:                                                          │
│     1. projects.description JSON blob (legacy, primary)                 │
│     2. scenes/layers/sceneNodes/sceneEdges tables (structured)          │
│                                                                         │
│  Write flow:                                                            │
│     • Optimistic lock: read version → write with version check          │
│     • Retry 4x on version conflict                                      │
│     • Transaction: update project blob + sync structured tables         │
│     • Log to generationLogs + agentUsage tables                         │
│     • Extract + store user memories                                     │
│     • Send final SSE events with updated state                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│  6. CLIENT APPLIES RESULTS (AgentChat.tsx)                              │
│     • Parse SSE events, stream tokens into chat message                 │
│     • Show tool call cards and thinking blocks                          │
│     • Update Zustand store with new/modified scenes + globalStyle       │
│     • Display cost breakdown                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Weakpoints

### 1. Stream failure doesn't abort the runner
**File:** `app/api/agent/route.ts:167-173`

When `streamController.enqueue()` throws (client disconnected), only a `streamClosed` flag is set. The runner keeps executing tools — burning LLM tokens and mutating state with no way to send results to the client.

**Fix:** Call `abortController.abort()` immediately on stream write failure.

### 2. No concurrent run locking per project
**File:** `app/api/agent/route.ts:342`

Two simultaneous POST `/api/agent` calls for the same `projectId` can both run. Both mutate scenes independently, both call `persistScenesFromAgentRun()`. The optimistic lock catches version conflicts on write, but both runs already consumed LLM tokens.

**Fix:** Use a per-project mutex (Redis lock, or in-memory Map) to reject concurrent runs.

### 3. Snapshot creation can fail silently
**File:** `lib/agents/tool-executor.ts` (snapshot creation)

`createSnapshot()` uses `JSON.parse(JSON.stringify())` to deep clone. If scenes contain circular references or non-serializable values (e.g., `BigInt`, `undefined` in arrays), this throws. The exception isn't caught at the call site — tool executes without rollback protection.

**Fix:** Wrap `createSnapshot()` in try-catch. If it fails, return error result instead of executing tool.

### 4. No SSE keepalive heartbeat
**File:** `app/api/agent/route.ts:554-561`

Standard SSE headers set, but no periodic keepalive events during long tool executions. Proxies (Cloudflare, Vercel, nginx) may close the connection after 30-60s of silence.

**Fix:** Emit `{ type: 'heartbeat' }` every 15-30s during silent periods.

### 5. Checkpoint resume can lose user edits
**File:** `app/api/agent/route.ts:289-320`

Merge logic: if a scene was "completed" in checkpoint, checkpoint version wins. But if the user manually edited that scene after the checkpoint was saved, their edit is silently overwritten.

**Fix:** Compare scene version timestamps, not just `completedSceneIds`. Newer wins.

### 6. Token/cost tracking can undercount
**File:** `lib/agents/runner.ts:851-862, 1715-1729`

Streaming token counts are accumulated from events, but actual billed tokens (from `finalMessage().usage`) may be 2-5% higher due to cache overhead, tool JSON encoding, and message framing. The $2.00 cost cap check uses the underestimated count.

**Fix:** Use `finalMessage().usage` as source of truth. Apply 5% buffer to pre-checks.

### 7. Parallel tool HTML writes can race
**File:** `lib/agents/tool-executor.ts` (regenerateHTML)

Two parallel `add_layer` calls for the same scene both try to write `public/scenes/{id}.html` simultaneously. No file locking. Result can be corrupted or partial HTML.

**Fix:** Use atomic write (write to `.tmp`, then rename) or serialize HTML writes per scene.

### 8. finalMessage() timeout loses token counts
**File:** `lib/agents/runner.ts:1738-1758`

If `stream.finalMessage()` times out (10s), a synthetic message with empty content is created. Token counts from streaming events may be incomplete — cost tracking is inaccurate for the run.

**Fix:** Use accumulated streaming counts as fallback, but log a warning for reconciliation.

---

## Areas to Harden

### Input Validation

| Area | Current | Should Be |
|------|---------|-----------|
| Tool arg size | No limit | Max 100KB per arg |
| Request body scenes | Count limited (100) | Also limit total size (e.g., 50MB) |
| Scene ID regex | Different patterns in 2 files | Centralize as shared constant |
| Layer ID in HTML template | Unescaped in `getElementById('${layer.id}')` | Use `escapeAttr(layer.id)` |
| Checkpoint shape | Cast `as RunCheckpoint` | Validate with Zod before use |

### Error Recovery

| Area | Current | Should Be |
|------|---------|-----------|
| Tool execution timeout | `Promise.race()` — can still mutate if "slow success" | Wrap in AbortController, cancel on timeout |
| Abort signal checks | Only before expensive ops | Also check between tool calls in sequence |
| Permission request wait | No timeout | 30-minute timeout, auto-deny |
| Stream hang on Anthropic SDK | `for await` with no timeout | Wrap stream consumption in `withTimeout()` |
| Module-level API clients | Cached forever, stale keys | Add reset mechanism or use DI |

### Observability

| Area | Current | Should Be |
|------|---------|-----------|
| Checkpoint load failure | `console.warn()` | Emit SSE warning event to client |
| Tool execution errors | Logged, snapshot restored | Also track error rate per tool for monitoring |
| Stream backpressure | No check | Check `controller.desiredSize` before enqueue |
| Token count discrepancy | Silent | Log delta between streaming and final counts |

---

## Database Status

### Schema Summary: 44 Tables, 18 Migrations

**Status: Fully set up.** All migrations applied correctly. Schema is comprehensive.

### Core Tables

| Table | Purpose | FK Cascade | Issues |
|-------|---------|------------|--------|
| `users` | Auth.js user accounts | - | None |
| `accounts` | OAuth provider links | CASCADE from users | None |
| `sessions` | Auth.js session tokens | CASCADE from users | None |
| `projects` | Project container | CASCADE from users | None |
| `scenes` | Scene definitions (position-ordered) | CASCADE from projects | None |
| `layers` | Layer hierarchy with parenting | CASCADE from scenes, self-ref | **Missing onDelete for mediaId FK** |
| `sceneNodes` | Scene graph node positions | CASCADE from projects+scenes | None |
| `sceneEdges` | Scene graph connections | CASCADE from projects+scenes (both dirs) | None |
| `interactions` | Interactive elements | CASCADE from scenes | None |

### Agent/Generation Tables

| Table | Purpose | Issues |
|-------|---------|--------|
| `generationLogs` | Full generation trace with quality scoring | None |
| `agentUsage` | Per-agent execution metrics | Table-missing handled gracefully |
| `apiSpend` | Per-API cost tracking | None |
| `userMemory` | Cross-session agent learnings (category+key unique) | None |
| `conversations` | Chat containers per project | None |
| `messages` | Individual chat messages with position | None |

### Media/Asset Tables

| Table | Purpose | Issues |
|-------|---------|--------|
| `generatedMedia` | Global media cache (decoupled from projects) | Orphaned on user delete (intentional) |
| `projectAssets` | Media library per project | CASCADE from projects |
| `assets` | SVG/canvas asset library | No FK to users for delete (intentional) |
| `mediaCache` | Media generation cache by hash | None |

### Other Tables

| Table | Purpose | Issues |
|-------|---------|--------|
| `avatarConfigs` | Avatar provider configs per project | None |
| `avatarVideos` | Generated avatar videos | SET NULL on scene/config delete |
| `timelineTracks` | NLE timeline tracks | CASCADE from projects |
| `timelineClips` | NLE timeline clips | CASCADE from tracks |
| `snapshots` | Undo/redo stack (50 item limit) | None |
| `publishedProjects` | Published/deployed embeds | CASCADE from projects |
| `analyticsEvents` | Viewer analytics | CASCADE from published |
| `githubLinks` | GitHub integration (encrypted tokens) | CASCADE from projects |
| `sceneTemplates` | Reusable scene templates | No FK for user delete (intentional) |
| `threeDComponents` | 3D component definitions | None |
| `permissionSessions` | API permission decisions | None |

### Database Issues Found

1. **Missing FK constraint:** `layers.mediaId` → `generatedMedia.id` has no `onDelete` rule
   - File: `lib/db/schema.ts` ~line 337
   - Risk: Orphaned media references if generatedMedia row deleted
   - Fix: Add `{ onDelete: 'set null' }` via migration

2. **Orphaned migration files:** `0010_add_content_segments.sql` and `0011_message_status.sql` exist but aren't in `_journal.json`
   - Impact: None at runtime (only journal matters)
   - Fix: Delete orphaned files to avoid confusion

3. **Dual storage sync risk:** Scenes stored in both `projects.description` (JSON blob) and `scenes` table
   - Mitigated by: atomic transaction writes + version locking
   - Risk: If transaction partially fails, stores can diverge
   - Status: Acceptably safe with current retry logic

4. **No text column size limits:** `userPrompt`, `generatedCode`, `thinkingContent` are unbounded text
   - Risk: Multi-MB generation logs or scene code can bloat DB
   - Fix: Application-layer truncation (e.g., 500KB max for thinkingContent)

### Connection Pool

```
Pool: 10 connections (cloud) / 5 (local)
Idle timeout: 30s
Connection timeout: 5s
SSL: auto-detect (enabled for non-localhost)
Error handling: logged, non-fatal
```

Pool config is reasonable for a single-server deployment. Would need adjustment for serverless (connection pooling via PgBouncer or Neon's pooler).

---

## Priority Fixes (Recommended Order)

### P0 — Data Safety
1. Add per-project mutex to reject concurrent agent runs
2. Wrap `createSnapshot()` in try-catch to prevent unprotected tool execution
3. Abort runner on stream write failure (not just flag)

### P1 — Reliability
4. Add SSE keepalive heartbeat (15-30s interval)
5. Add `withTimeout()` wrapper around Anthropic stream consumption
6. Fix checkpoint merge to use version timestamps instead of completedSceneIds
7. Use atomic file writes for scene HTML (write .tmp + rename)

### P2 — Accuracy
8. Use `finalMessage().usage` as cost source of truth, not streaming deltas
9. Validate checkpoint shape with Zod before use
10. Centralize scene ID regex as shared constant

### P3 — Database
11. Add `onDelete: 'set null'` to `layers.mediaId` FK (new migration)
12. Delete orphaned migration files
13. Add application-layer size limits for text columns

### P4 — Observability
14. Emit SSE warning events for checkpoint load failures
15. Track token count discrepancies between streaming and final
16. Log tool error rates for monitoring

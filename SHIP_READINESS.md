# Cench Studio — MVP Ship-Readiness Audit

**Date:** 2026-04-17
**Scope:** Everything required to ship MVP _except_ auth and billing (those are being tackled last).
**Business model in scope:** downloadable desktop app (Electron) + monthly subscription with quota across models + BYOK (bring-your-own-keys) + CLI/IDE path via MCP server.

---

## Progress (Week 1)

- [x] **P0-1** CI suppression flags removed (`ignoreBuildErrors`, `ignoreDuringBuilds`, `|| true` on lint/format).
- [x] **P0-2** All 48 TypeScript errors fixed. `tsc --noEmit` clean.
- [x] **P0-3** All 5 ESLint errors fixed. `eslint .` returns exit 0 (3868 warnings remain as P3).
- [x] **P0-5** `lib/db/index.ts` lazy-initialized via Proxy. Tests run without `DATABASE_URL`: 14 files / 110 tests / 2.64s.
- [x] **P0-6** Error boundaries added: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
- [ ] **P0-4** Electron production packaging (electron-builder, icons, signing, auto-update). Large, still ahead.

### Week 1 P1 progress

- [x] **P1-7** Deleted stubbed `/api/build` route (had zero callers).
- [x] **P1-10** Wired toast notifications. Installed `sonner`, added `<Toaster>` in `components/Providers.tsx`, replaced `// TODO: wire to toast` in `components/PreviewPlayer.tsx` with `toast.error(...)` on scene audio errors.
- [x] **P1-11** Audit false alarm: every Electron menu callback in `electron/main.ts` (Home / Undo / Redo / Toggle Fullscreen) already uses `if (store)` guards or optional chaining. No fix needed.
- [x] **P1-13** Audit false alarm: every server-side `getBestTTSProvider()` caller (`/api/tts`, `/api/projects/[projectId]/avatar/generate`, `/api/tts/talkinghead`, `lib/sceneTemplate.ts`) explicitly rejects `web-speech`/`puter` and returns 400/503/null. Defensive pattern could be tightened by adding `requiresServerOutput` to the resolver, but no bug in current behavior.
- [ ] **P1-8** Player seek stub (`packages/player/src/index.ts:102`). Medium — defer.
- [ ] **P1-9** TalkingHead 3D world integration (`public/worlds/*.html`). Medium — defer.
- [ ] **P1-12** FFmpeg concat path validation on Electron startup. Medium — defer.

### Real bugs uncovered while fixing types (not just cosmetic)

1. `components/AgentChat.tsx` — `return` inside a `finally` block was swallowing thrown stream errors. Refactored to an `else` branch so errors propagate.
2. `lib/export2/pixi-mp4.ts` — `music.duckDuringTTS` check used optional chaining that didn't narrow; the duck branch could have crashed if `music` was null. Fixed with explicit null guard.
3. `lib/agents/tool-handlers/layer-tools.ts` — dumping `layer.code` that never existed on any AILayer variant; was a silent dead string.

---

## The bad news up front

**Your CI is fake-green.**

- `next.config.js:5-10` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`.
- `package.json` has `"lint": "eslint . || true"` and `"format:check": "prettier --check . || true"`.
- The last five commits (`465f1f6`, `889e566`, `77ed11d`, `9d66273`, `ce0b054`) were all "unblock CI" patches that weakened gates rather than fixing the underlying issues.

Running the checks honestly:

| Check                             | Result                       |
| --------------------------------- | ---------------------------- |
| `npx tsc --noEmit`                | **48 TypeScript errors**     |
| `npx eslint .` (strict)           | **5 errors, 3,871 warnings** |
| `next build` (with flags removed) | Would currently fail         |

Nothing below this point can be trusted until the compiler is honest.

---

## P0 — Ship blockers

These will crash the app, block distribution, or mask real bugs.

### P0-1: Remove CI suppression flags

- **Where:** `next.config.js:5-10`
- **What:** Delete `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`. Delete the `|| true` from `lint` and `format:check` in `package.json`.
- **Why:** Without this, every subsequent fix is flying blind. You don't know what's broken.
- **Effort:** Trivial (flag removal). Fixing the resulting errors = medium-large.

### P0-2: Fix the 48 TypeScript errors

Hot spots (grouped by subsystem):

**Export / compositor pipeline (critical path):**

- `lib/compositor/pixi-compositor.ts`
- `lib/compositor/pixi-preview.ts`
- `lib/export2/pixi-mp4.ts`

**Agent framework (critical path):**

- `lib/agents/runner.ts:931,934` — `ContentBlock` discriminated union broken; `image` property accessed on text blocks.
- `lib/agents/claude-code-provider.ts:376,455` — phase-status type overlap and unknown property `phase`.
- `lib/agents/tool-handlers/interaction-tools.ts:61` — `SceneVariable.defaultValue` accepts `{}` which isn't in the union.
- `lib/agents/tool-handlers/layer-tools.ts`, `lib/agents/tools.ts` — misc.

**Chat UI (surface visible to every user):**

- `components/chat/MessageBubble.tsx:192,194,201,332,335,337,340` — six missing properties on `ChatMessage`: `routeMethod`, `routingFallback`, `hasCheckpoint`, `checkpointReason`, `checkpointScenesBuilt`. Either add to type or stop reading them.
- `components/chat/UsageBadge.tsx:44` — `progress.costMax` possibly undefined.
- `components/AgentChat.tsx:364` — `Uint8Array<ArrayBufferLike>` vs `Uint8Array<ArrayBuffer>` mismatch (TS 5.7 narrowing change).

**Editor:**

- `components/Editor.tsx:69,70` — duplicate identifier `LayersStripTabId`.
- `components/tabs/InteractTab.tsx:41` — function lacks return statement.
- `components/tabs/LayersTab.tsx:722,727,770` — `Scene.order` property doesn't exist.

**Viewer:**

- `app/v/[projectId]/page.tsx:628` — duplicate JSX attribute.

**Scripts:**

- `scripts/build-native-sfx-zzfx.ts` — misc.

### P0-3: Fix the 5 ESLint errors

- `app/api/agent/route.ts:1757` — `no-unsafe-finally`. `return` inside `finally` masks thrown errors. Real bug.
- Some file:179 — `Function` type used directly (needs explicit signature).
- Some file:76 — `@next/next/no-img-element` rule referenced but plugin not installed. Lint config itself is broken.
- Some file:290 — thrown error missing `{ cause }` (`preserve-caught-error` rule).
- `lib/storage/index.ts:51` — `@ts-ignore` should be `@ts-expect-error`.

### P0-4: Electron has no production packaging

- **Where:** `package.json` — `build:electron` is just `tsc -p electron/tsconfig.json`. `dev:electron` uses `wait-on http://localhost:3000` (dev-only).
- **Missing:**
  - `electron-builder` dependency + `build` config block.
  - DMG / exe / AppImage targets.
  - App icon assets.
  - Apple code signing + notarization.
  - Windows code signing certificate.
  - Auto-update via `electron-updater` + publish target (S3 / GitHub releases).
- **Why:** You can't ship a "download the app" product without this.
- **Effort:** Large. 1-2 weeks of setup including obtaining certificates.

### P0-5: Database init hard-throws at import time

- **Where:** `lib/db/index.ts:6-11`
- **What:** `DATABASE_URL` is required at module load. Any import chain that touches db-aware modules crashes without it.
- **Impact:** Tests can't run on a fresh clone without Docker Postgres. CI becomes brittle.
- **Fix:** Lazy-initialize the connection (defer until first query). Add a test stub.
- **Effort:** Medium.

### P0-6: No error boundaries in app root

- **Where:** `app/` has no `error.tsx`, `global-error.tsx`, `not-found.tsx`.
- **Impact:** One uncaught React exception blanks the screen with no recovery UI and no way to report.
- **Fix:** Add all three. Wire `global-error.tsx` to whatever telemetry you add later.
- **Effort:** Trivial.

---

## P1 — Broken or half-built features

### P1-7: `/api/build` is a stub with no callers

- **Where:** `app/api/build/route.ts:40-60`
- **What:** Returns dummy SSE events (`totalScenes: 0`). Comment says "TODO: Replace with actual build orchestration."
- **Grep shows zero callers.** Either delete the route or implement it.
- **Effort:** Trivial (delete) or large (implement Director → Scene Maker → DOP → Editor orchestration).

### P1-8: Player seek is stubbed

- **Where:** `packages/player/src/index.ts:102`
- **What:** `/* TODO: seek */` — timeline scrubbing in the preview player doesn't work.
- **Effort:** Medium.

### P1-9: Avatar TODOs in 3D worlds

- **Where:** `public/worlds/studio-room.html:543`, `public/worlds/meadow.html:478`
- **What:** `TODO: Integrate TalkingHead avatar system`. Avatar layers in 3D worlds are non-functional.
- **Effort:** Medium.

### P1-10: Avatar generation completes silently

- **Where:** `components/PreviewPlayer.tsx:819`
- **What:** `TODO: wire to toast notification system`. User has no idea when generation is done.
- **Effort:** Trivial.

### P1-11: Electron menu actions have no store guards

- **Where:** `electron/main.ts:78, 102, 119, 145`
- **What:** Injected `window.__cenchStore` accessed without null checks. Undo/redo/fullscreen/home nav silently die if the renderer hasn't booted or store failed to initialize.
- **Effort:** Trivial.

### P1-12: FFmpeg concat path fragile

- **Where:** `electron/main.ts:296, 302`
- **What:** Requires `render-server/stitcher.js` to exist at a specific path. Misconfigured install → cryptic error.
- **Fix:** Validate path on app startup, emit user-friendly error if missing.
- **Effort:** Medium.

### P1-13: TTS fallback is browser-only

- **Where:** `lib/audio/resolve-best-tts-provider.ts:29`
- **What:** `getBestTTSProvider()` falls back to `web-speech` if no provider is configured. But `web-speech` is browser-only. Breaks server-side MP4 export.
- **Fix:** Detect export context; either force a server-capable provider or error with a clear message.
- **Effort:** Medium.

---

## P2 — BYOK / subscription-model readiness (still deferring auth+billing)

### P2-14: Spend is logged, not enforced

- **Where:** `lib/permissions.ts`, `app/api/permissions/route.ts`
- **What:** Permission framework tracks per-provider spend but caps are soft (only checked at permission-gate prompts, not enforced server-side). A subscription user can run unlimited generations if the UI misbehaves.
- **Fix:** Hard per-user quota table (`user_quotas`, resets monthly), middleware on every generation endpoint that debits atomically, returns 429 when exhausted.
- **Effort:** Large. Prerequisite for the subscription tier.

### P2-15: No E2E test for the key-entry → generate flow

- **Where:** Settings / permissions UI
- **What:** No automated test covers "user enters API key → key is validated → provider enables → generation succeeds."
- **Impact:** Silent auth failures are the #1 category of user confusion on BYOK apps.
- **Effort:** Large.

### P2-16: No telemetry / error tracking

- **What:** No Sentry, no structured logs, no audit trail.
- **Impact:** When a user reports "export failed on my Mac," you have zero signal.
- **Fix:** Sentry (or Highlight / Axiom) + a `logger` wrapper replacing the ~112 `console.log` calls.
- **Effort:** Medium for integration; cleanup of logs is separate (P3).

### P2-17: No env-var validation at startup

- **What:** `.env.example` lists `ANTHROPIC_API_KEY`, `FAL_KEY`, `HEYGEN_API_KEY`, `GOOGLE_AI_KEY`, `ELEVENLABS_API_KEY` etc. but nothing checks on boot. User hits first API call to learn a key is missing.
- **Fix:** `scripts/validate-env.ts` + run on `next dev` / `next build` via a wrapper.
- **Effort:** Trivial.

---

## P3 — Tech debt (acceptable to ship with, but schedule cleanup)

- **3,871 lint warnings.** Mostly `no-undef` for `document`, `window`, `setTimeout`, `__dirname`, `AudioContext` in browser/Node boundary files. Fix with per-file `env` config in `.eslintrc` or better `overrides` blocks.
- **~112 `console.log` calls** across `app/api/**` and `lib/agents/**`. Gate behind `DEBUG` env var or strip.
- **No `down` migrations.** `drizzle/0000...0019` are forward-only. Emergency rollback impossible.
- **Test suite requires Docker Postgres.** `vitest.config.ts` + `vitest.setup.ts` assume a running Postgres. Add `pg-mem` or in-memory fallback for CI.
- **MCP server** (`scripts/mcp-server.ts:437`) silently continues if dev server is down — no retry, no connection pool.
- **Render-server temp cleanup** (`render-server/index.js:115`) swallows errors with `.catch(() => {})`. Leaks disk space under load.
- **Electron display-media callback** (`electron/main.ts:436`) cast to `any`.
- **Third-party audio licensing** — `THIRD_PARTY_AUDIO.md` exists; verify every bundled asset has correct `librarySource` / `license` fields in its manifest before shipping.

---

## Suggested execution order

### Week 1 — Foundations (makes everything else real)

1. P0-1: Remove `ignoreBuildErrors` + `ignoreDuringBuilds`. Remove `|| true` from lint/format scripts.
2. P0-3: Fix the 5 lint errors.
3. P0-2: Fix the 48 TS errors (compositor → agents → chat UI → editor, in that dependency order).
4. P0-6: Add `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
5. P0-5: Make `lib/db/index.ts` lazy.

### Week 2-3 — Electron distribution

6. P0-4: `electron-builder` config, icons, signing certs, notarization, auto-update.

### Week 4 — Critical feature gaps

7. P1-13: TTS server-side fallback.
8. P1-7: Delete or implement `/api/build`.
9. P1-8 through P1-12: Player seek, avatar TODOs, toast notification, Electron store guards, FFmpeg path validation.

### Week 5 — Subscription + BYOK readiness (still before billing hookup)

10. P2-14: Hard quota enforcement.
11. P2-16: Sentry + structured logging.
12. P2-15: E2E test for key-entry → generate flow.
13. P2-17: Env-var validator.

### Then and only then — auth + billing

- Auth.js + Stripe / Paddle integration.
- Subscription gating on top of the quota middleware.

---

## Recent commit context (for situational awareness)

```
465f1f6 Add motion design system with personality-driven easing, Lottie validation, and quality scoring.
889e566 Adjust build config to avoid CI type-check gate failures.   <- CI weakening
77ed11d Stabilize playbook ranking test against current hint scoring.
9d66273 Make format check non-blocking in CI.                       <- CI weakening
ce0b054 Unblock CI lint stage while preserving install stability.   <- CI weakening
19971dd Fix CI npm install dependency resolution.
218d712 Save workspace changes for agent, media, research, and website updates.
...
d77f803 Merge remote-tracking branch 'origin/chat-ui-overhaul'
3883f5a Merge remote-tracking branch 'origin/fix/endgame-agent-reliability'
6e17b71 Merge remote-tracking branch 'origin/fix/interactive-overlay-system'
ddd6180 Merge remote-tracking branch 'origin/fix/routing-fallback-snapshot-isolation'
aa19e0b Merge remote-tracking branch 'origin/fix/save-load-reliability'
```

Lots of recent reliability / fix branches being merged into `main`. That's consistent with the TS-error profile above — subsystems were stabilized under time pressure and the type system fell out of alignment.

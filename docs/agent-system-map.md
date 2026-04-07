# Agent System — Codebase Map

Reference document mapping the full agent/chat system into logical sections.

---

## Section Overview

| #   | Section                | Key Files                                                                                        | ~Lines       |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------ | ------------ |
| 1   | **API Routes**         | `app/api/agent/`, `app/api/conversations/`                                                       | 2,330        |
| 2   | **Core Engine**        | `lib/agents/runner.ts`, `router.ts`, `tool-executor.ts`, `context-builder.ts`, `orchestrator.ts` | 5,226        |
| 3   | **Config & Prompts**   | `lib/agents/types.ts`, `model-config.ts`, `agent-config.ts`, `prompts.ts`                        | 2,762        |
| 4   | **Tool System**        | `lib/agents/tools.ts`, `tool-registry.ts`, 18 handler modules                                    | 3,037+       |
| 5   | **UI Components**      | `components/AgentChat.tsx`, `ChatPanel.tsx`, `AgentControlPanel.tsx`, `components/chat/*`        | 2,338+       |
| 6   | **State Management**   | `lib/store/agent-actions.ts`                                                                     | 509          |
| 7   | **Database**           | `lib/db/queries/conversations.ts`                                                                | 100+         |
| 8   | **Supporting Systems** | logger, memory-extractor, analytics, session, hooks, commands                                    | 1,281        |
|     | **Total**              |                                                                                                  | **~17,500+** |

---

## 1. API Routes

| File                                           | Lines | Purpose                                                                                              |
| ---------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| `app/api/agent/route.ts`                       | ~2050 | Main SSE endpoint — validates request, calls `runAgent()`, persists results, streams 30+ event types |
| `app/api/conversations/route.ts`               | ~50   | `GET` list conversations, `POST` create conversation                                                 |
| `app/api/conversations/[id]/route.ts`          | ~90   | `GET/PATCH/DELETE` individual conversation (title, pin, archive)                                     |
| `app/api/conversations/[id]/messages/route.ts` | ~139  | `GET/POST/PATCH/DELETE` messages with full metadata (tokens, cost, rating, toolCalls)                |

---

## 2. Core Execution Engine

| File                            | Lines | Purpose                                                                                                                                                         |
| ------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/agents/runner.ts`          | ~2050 | **Main loop** — planning, execution, finalization. Multi-turn Claude calls, tool dispatch, retry logic, cost circuit breaker ($2 max), checkpointing for resume |
| `lib/agents/router.ts`          | ~246  | **Intent routing** — keyword heuristics + LLM fallback to pick agent type (director / scene-maker / editor / dop)                                               |
| `lib/agents/tool-executor.ts`   | ~1377 | **Tool dispatch** — executes tools, mutates `WorldStateMutable`, pre/post hooks, auto-validation, undo snapshots (50 max)                                       |
| `lib/agents/context-builder.ts` | ~1031 | **Prompt assembly** — system prompt + world state + tool list within token budgets. Model resolution by tier                                                    |
| `lib/agents/orchestrator.ts`    | ~522  | **Multi-scene builds** — spawns parallel sub-agents (max 3) for storyboard scenes, merges results back                                                          |

---

## 3. Agent Configuration & Prompts

| File                            | Lines | Purpose                                                                                                         |
| ------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| `lib/agents/types.ts`           | ~576  | Core types: `AgentType`, `ModelId`, `ChatMessage`, `SSEEvent`, `ToolCallRecord`, `RunCheckpoint`, model pricing |
| `lib/agents/model-config.ts`    | ~360  | Model registry — Anthropic / OpenAI / Gemini with tier, cost, context metadata                                  |
| `lib/agents/agent-config.ts`    | ~565  | Agent personas — system prompts, enable/disable, custom agent CRUD                                              |
| `lib/agents/prompts.ts`         | ~1053 | System prompts per agent: Router, Director, Scene-Maker, Editor, DoP, Planner                                   |
| `lib/agents/config-resolver.ts` | ~208  | Resolve effective config from defaults + user overrides                                                         |

---

## 4. Tool System

### Definitions

| File                          | Lines | Purpose                                                                                           |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| `lib/agent-tools.ts`          | ~289  | Public tool defs — permission, avatar, video, image, TTS. Tool presets and 19 filter chip toggles |
| `lib/agents/tools.ts`         | ~2689 | Full tool schemas — 100+ tools with JSON Schema input definitions                                 |
| `lib/agents/tool-registry.ts` | ~59   | Registry mapping tool names to handler functions                                                  |

### Handler Modules (`lib/agents/tool-handlers/`)

| Handler                | Tools                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `scene-tools.ts`       | create_scene, edit_scene, delete_scene, list_scenes, verify_scene     |
| `layer-tools.ts`       | add_layer, regenerate_layer, edit_layer, delete_layer, reorder_layers |
| `style-tools.ts`       | set_global_style, apply_style_preset, set_palette, set_transitions    |
| `chart-tools.ts`       | generate_chart, add_chart_data                                        |
| `audio-tools.ts`       | add_narration, add_music, add_sfx, remove_audio                       |
| `avatar-tools.ts`      | add_avatar_layer, generate_avatar_narration, generate_avatar_scene    |
| `image-video-tools.ts` | add_image, generate_image, remove_background                          |
| `element-tools.ts`     | add_element, edit_element, delete_element                             |
| `interaction-tools.ts` | add_interaction, edit_interaction, delete_interaction                 |
| `parenting-tools.ts`   | set_parent, unset_parent, list_hierarchy                              |
| `physics-tools.ts`     | generate_physics_scene                                                |
| `three-world-tools.ts` | create_world_scene, add_3d_object                                     |
| `recording-tools.ts`   | start_recording, stop_recording, get_recording_status                 |

---

## 5. UI Components

### Primary

| File                               | Lines  | Purpose                                                                                                                                                              |
| ---------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/AgentChat.tsx`         | ~1000+ | Main chat UI — message input, SSE stream parsing, tool inspection, thinking blocks, permission dialogs, image attachments, speech recognition, agent/model selectors |
| `components/ChatPanel.tsx`         | ~500+  | Chat sidebar — conversation history, message display, pinning/renaming/deletion, feedback                                                                            |
| `components/AgentControlPanel.tsx` | ~400+  | Config panel — agent type, model tier, thinking mode, scene context, tool presets, provider settings                                                                 |

### Sub-components (`components/chat/`)

| File                          | Lines | Purpose                                                             |
| ----------------------------- | ----- | ------------------------------------------------------------------- |
| `MessageBubble.tsx`           | ~174  | Single message — agent badge, thinking, tool calls, usage, feedback |
| `ToolCallItem.tsx`            | ~73   | Collapsible tool call inspector (name, status, duration, JSON I/O)  |
| `PermissionCard.tsx`          | ~48   | Inline permission request (API name, cost estimate, Allow/Deny)     |
| `UsageBadge.tsx`              | ~33   | Token count, cost, duration                                         |
| `FeedbackButtons.tsx`         | ~38   | Thumbs up/down rating                                               |
| `ConversationContextMenu.tsx` | ~63   | Right-click menu: rename, pin, clear, delete                        |
| `ThinkingBubble.tsx`          | ~9    | Shimmer loading indicator                                           |

---

## 6. State Management

| File                         | Lines | Purpose                                                                                                                                           |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/store/agent-actions.ts` | ~509  | Zustand actions: conversation CRUD, chat message add/update/persist, agent control setters, scene sync, model/agent config, permission management |

---

## 7. Database

| File                              | Purpose                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `lib/db/queries/conversations.ts` | Conversation + message CRUD — list, create, update, delete, load messages (limit 200), rating updates |

---

## 8. Supporting Systems

| File                             | Lines | Purpose                                                                                 |
| -------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `lib/agents/logger.ts`           | ~112  | Structured logging with runId correlation                                               |
| `lib/agents/memory-extractor.ts` | ~192  | Extract user preferences from tool calls (colors, fonts, styles) with confidence scores |
| `lib/agents/run-analytics.ts`    | ~263  | Run metrics — scene counts, tool efficiency, frustration signals                        |
| `lib/agents/session.ts`          | ~184  | Agent run session state management                                                      |
| `lib/agents/hook-config.ts`      | ~243  | Pre/post-tool hook configuration                                                        |
| `lib/agents/built-in-hooks.ts`   | ~81   | Default hooks for scene validation, permission checking                                 |
| `lib/agents/commands.ts`         | ~205  | Parse slash commands from user messages (`/draft`, `/quick`)                            |

---

## Data Flow

```
User message → ChatPanel / AgentChat
  → POST /api/agent (SSE stream)
    → runAgent()
      → router.ts → pick agent type
      → context-builder.ts → system prompt + tools + world state
      → Claude API (streaming)
      → tool_use blocks → tool-executor.ts → tool-handlers/*
      → SSE events back to client
    → persist scenes to DB + generation log
  → UI updates via SSE parsing
  → addChatMessage() → persist to conversations DB
  → syncScenesFromAgent() → Zustand store + scene HTML files
```

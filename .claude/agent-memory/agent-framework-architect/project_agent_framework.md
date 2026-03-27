---
name: Cench Studio Agent Framework Architecture
description: Architecture decisions, file locations, and implementation details for the AI agent framework
type: project
---

## Architecture Overview
Multi-agent system with 5 agent types: router, director, scene-maker, editor, dop.
The router classifies intent using Haiku (cheapest/fastest), then the appropriate agent executes.

## Key Files
- `lib/agents/types.ts` — All TypeScript interfaces (AgentType, SSEEvent, ToolResult, etc.)
- `lib/agents/prompts.ts` — System prompts + color/label maps per agent
- `lib/agents/tools.ts` — Claude API tool definitions (JSON Schema format)
- `lib/agents/tool-executor.ts` — Tool execution against world state (server-side)
- `lib/agents/context-builder.ts` — World state serialization + context building
- `lib/agents/router.ts` — Intent classification using Haiku
- `lib/agents/runner.ts` — Main execution loop with SSE streaming
- `app/api/agent/route.ts` — Next.js SSE streaming endpoint
- `components/ChatPanel.tsx` — Chat UI with streaming display and tool call collapse
- `components/AgentControlPanel.tsx` — Agent selector, model picker, tool filters
- `lib/agent-tools.ts` — Existing tool presets and filter chips (unchanged)

## Tool Executor Design
- Operates on plain `WorldStateMutable` object (deep-cloned scenes + globalStyle)
- Creates snapshot BEFORE each tool execution (in-memory undo stack, max 50)
- Returns `{ success, affectedSceneId, changes, data }`
- Calls `generateSceneHTML()` after any scene modification to keep HTML in sync
- Layer generation delegates to existing API routes (`/api/generate`, etc.)

## SSE Event Flow
1. `thinking` — routing in progress
2. `token` — streaming text
3. `tool_start` — tool call beginning, shows "calling {tool}..."
4. `tool_complete` — result with success/error
5. `preview_update` — scene HTML was rebuilt (triggers client refresh)
6. `state_change` — world state changed (includes `updatedScenes` on final)
7. `done` — stream complete with full text + all tool calls

## State Sync Pattern
- Runner deep-clones scenes at start, mutates in-place during tool calls
- After all tools execute, final `state_change` event carries `updatedScenes` + `updatedGlobalStyle`
- Client calls `syncScenesFromAgent()` which replaces store scenes and bumps `sceneHtmlVersion`
- Each changed scene's HTML is also POSTed to `/api/scene` for persistence

## Context Budget (token limits)
- World state summary: max 2000 tokens
- Full focused scene: max 3000 tokens (only included when scene context = 'selected')
- History: last 10 messages only
- Code previews in world state: first 500-800 chars

## Model Defaults Per Agent
- router: claude-haiku-4-5 (fast/cheap routing)
- director: claude-sonnet-4-5
- scene-maker: claude-sonnet-4-5
- editor: claude-haiku-4-5 (targeted edits don't need heavy model)
- dop: claude-haiku-4-5

## Chat State in Zustand Store
Added to `VideoStore`: `chatMessages`, `isChatOpen`, `isAgentRunning`, `agentType`, `agentModelId`, `agentOverride`, `modelOverride`, `sceneContext`, `activeTools`, `chatInputValue`
Actions: `setChatOpen`, `addChatMessage`, `updateChatMessage`, `clearChat`, `syncScenesFromAgent`, etc.

## Editor Layout Change
`components/Editor.tsx` now has a 4-panel layout: Left (SceneList) | Center (Preview) | Right (SceneEditor) | Chat (ChatPanel)
Chat panel is toggled via "AI" button in header. Width is draggable (280–560px, default 380px).

**Why:** Keeping chat in a resizable panel preserves existing editor layout while giving AI a dedicated workspace.
**How to apply:** Future UI changes should respect the 4-panel drag system in Editor.tsx.

## Model & Agent Configuration System (added 2026-03-26)

### New Files
- `lib/agents/model-config.ts` — ModelConfig/ProviderConfig types, DEFAULT_MODELS (Anthropic + OpenAI + Local), query helpers
- `lib/agents/agent-config.ts` — AgentConfig type, DEFAULT_AGENTS (10 agents), specialized prompts for SVG/Canvas/D3/Three.js/Motion
- `components/settings/SettingsModal.tsx` — Full-screen modal with Models/Agents/General tabs
- `components/settings/ModelsSettingsTab.tsx` — Provider sections with API key inputs, model toggles, add custom model form
- `components/settings/AgentsSettingsTab.tsx` — Agent cards by category, inline edit panel with prompt textarea, create/import/export
- `components/settings/GeneralSettingsTab.tsx` — Default scene duration, editor theme

### Store Changes (version 5 → 6)
Added to `VideoStore` interface and implementation:
- `modelConfigs: ModelConfig[]` — initialized from DEFAULT_MODELS, persisted
- `providerConfigs: ProviderConfig[]` — initialized from DEFAULT_PROVIDER_CONFIGS, persisted
- `agentConfigs: AgentConfig[]` — initialized from DEFAULT_AGENTS, persisted
- `setModelConfigs`, `toggleModelEnabled`, `updateProviderConfig`, `addCustomModel`, `removeCustomModel`
- `setAgentConfigs`, `toggleAgentEnabled`, `updateAgentPrompt`, `addCustomAgent`, `removeCustomAgent`
- `settingsTab` / `setSettingsTab` were already in the store; `SettingsModal` uses them

### Wiring
- Settings gear icon (`<Settings size={15} />`) added to bottom of SceneList sidebar in Editor.tsx
- `<SettingsModal />` rendered in the Modals section of Editor.tsx
- Clicking the gear calls `setSettingsTab('models')` to open on the Models tab

### Agent Roster (10 agents)
General: auto (router), director, scene-maker, editor, dop
Animation: svg-artist, canvas-animator, motion-designer, three-designer
Data: d3-analyst

### Model Roster (7 models)
Anthropic: claude-haiku-4-5 (budget), claude-sonnet-4-5 (balanced), claude-opus-4-5 (performance)
OpenAI: gpt-4o-mini (budget), gpt-4o (balanced), o1 (performance) — disabled by default
Local: ollama-llama3 (budget) — disabled by default

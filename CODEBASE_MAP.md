# Cench Studio — Full Codebase Map

AI-powered animated explainer video creator. Next.js + Electron desktop app with AI agent orchestration, real-time scene generation, and MP4/interactive export.

---

## Root Configuration

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, project metadata |
| `tsconfig.json` | TypeScript configuration |
| `next.config.js` | Next.js App Router configuration |
| `tailwind.config.ts` | Tailwind CSS theme and plugins |
| `drizzle.config.ts` | Drizzle ORM database config |
| `eslint.config.mjs` | ESLint rules |
| `postcss.config.js` | PostCSS plugins |
| `vitest.config.ts` | Vitest testing framework |
| `middleware.ts` | Next.js middleware (auth, redirects) |
| `components.json` | shadcn/ui component config |
| `docker-compose.yml` | PostgreSQL container setup |
| `.lintstagedrc.json` | Lint-staged config |

---

## Electron (Desktop Shell)

| File | Purpose |
|------|---------|
| `electron/main.ts` | Main process — window creation, IPC, menus |
| `electron/preload.ts` | Preload script — exposes safe APIs to renderer |
| `dist-electron/main.js` | Compiled main process |
| `dist-electron/preload.js` | Compiled preload |
| `types/electron.d.ts` | Electron type definitions |
| `index.js` | Electron entry point |

---

## App Directory (Next.js Pages + API)

### Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Home / welcome page |
| `/login` | `app/login/page.tsx` | Authentication page |
| `/docs` | `app/docs/page.tsx` | Documentation |
| `/v/[projectId]` | `app/v/[projectId]/page.tsx` | Published project viewer |
| `/dashboard/prompt-engineering` | `app/dashboard/prompt-engineering/page.tsx` | Prompt editor |
| `/dev/shadcn-charts` | `app/dev/shadcn-charts/page.tsx` | Chart component showcase |
| — | `app/layout.tsx` | Root layout wrapper |
| — | `app/globals.css` | Global styles |

### API Routes — Agent & Chat

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/agent` | AI agent SSE endpoint — orchestrates multi-turn tool use |
| GET/POST | `/api/conversations` | List / create conversations |
| GET/PATCH/DELETE | `/api/conversations/[id]` | Read / update / delete conversation |
| GET/POST/PATCH/DELETE | `/api/conversations/[id]/messages` | Message CRUD with atomic ordering |

### API Routes — Content Generation

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/generate` | SVG generation via Claude |
| POST | `/api/generate-canvas` | Canvas2D generation |
| POST | `/api/generate-d3` | D3 data visualization generation |
| POST | `/api/generate-three` | Three.js 3D scene generation |
| POST | `/api/generate-motion` | Motion/Anime.js generation |
| POST | `/api/generate-lottie` | Lottie animation generation |
| POST | `/api/generate-zdog` | Zdog 3D character generation |
| POST | `/api/generate-image` | AI image generation (Flux, DALL-E, Recraft, etc.) |
| POST | `/api/generate-video` | Veo3 video clip generation |
| POST | `/api/generate-avatar` | HeyGen talking-head avatar generation |

### API Routes — Projects & Scenes

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/projects` | List / create projects |
| GET/PATCH/DELETE | `/api/projects/[projectId]` | Project CRUD with optimistic locking |
| GET/POST/DELETE | `/api/projects/[projectId]/assets` | Project asset management |
| POST/PATCH | `/api/projects/[projectId]/avatar-configs` | Avatar config management |
| GET/POST/PATCH | `/api/scene` | Scene HTML read / write / update |
| POST | `/api/scene/generate-world` | 3D world generation |

### API Routes — Media & Audio

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/tts` | Text-to-speech (ElevenLabs, OpenAI, Google, etc.) |
| POST | `/api/sfx` | Sound effect generation |
| GET | `/api/music/search` | Music search (Pixabay, Freesound) |
| POST | `/api/upload` | File uploads |
| POST | `/api/remove-background` | Background removal |
| GET | `/api/list-avatars` | List available avatars |
| GET/POST | `/api/audio-settings` | Audio settings |

### API Routes — Export & Publishing

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/export` | MP4 export (SSE progress stream) |
| POST | `/api/publish` | Publish as hosted interactive embed |
| POST | `/api/build` | Scene build pipeline |

### API Routes — System

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/usage` | API usage statistics |
| GET/POST | `/api/permissions` | API permission management |
| POST | `/api/generation-log` | Log generation events |
| GET | `/api/analyze-logs` | Analyze generation logs |
| POST | `/api/analytics/track` | Usage analytics tracking |
| GET | `/api/dev/agent-registry-status` | Dev: agent registry status |

---

## Components

### Top-Level Components

| File | Purpose |
|------|---------|
| `Editor.tsx` | Main editor — orchestrates all panels, preview, timeline |
| `AgentChat.tsx` | AI conversation panel with SSE streaming, tool calls, permissions |
| `ChatPanel.tsx` | Chat UI — message input, conversation tabs, SSE event processing |
| `PreviewPlayer.tsx` | Scene preview/playback with iframe rendering |
| `GenerationConfirmCard.tsx` | Rich confirmation card for media generation (provider, cost, config) |
| `StoryboardReviewCard.tsx` | Storyboard review/edit before agent builds |
| `ExportModal.tsx` | MP4 export settings and progress |
| `SettingsPanel.tsx` | App settings (theme, usage, agents, API keys) |
| `ProjectPanel.tsx` | Project list, create, switch, delete |
| `MediaLibrary.tsx` | Project asset browser |
| `SceneEditor.tsx` | Per-scene code editor |
| `SceneList.tsx` | Scene sidebar list |
| `SceneCard.tsx` | Individual scene card (thumbnail, name, duration) |
| `SceneGraphEditor.tsx` | Interactive scene graph / node editor |
| `SvgElementEditor.tsx` | SVG element property editor |
| `SvgObjectEditor.tsx` | SVG object manipulation |
| `ScrubBar.tsx` | Timeline scrub bar |
| `TemplatePicker.tsx` | Scene template browser |
| `FontPicker.tsx` | Font selection UI |
| `PublishPanel.tsx` | Publish settings and URL |
| `CanvasMotionTemplatesPanel.tsx` | Canvas animation template browser |
| `AILayersPanel.tsx` | AI-generated layers panel |
| `AgentControlPanel.tsx` | Agent type, model, thinking mode selectors |
| `APIPermissionsSettings.tsx` | Per-API permission toggles |
| `PermissionDialog.tsx` | Modal permission request dialog |
| `ThinkingBlock.tsx` | Collapsible AI thinking display |

### `components/chat/`

| File | Purpose |
|------|---------|
| `MessageBubble.tsx` | Chat message — text, tool calls, thinking, feedback, usage |
| `ToolCallItem.tsx` | Expandable tool call card (input/output, duration, status) |
| `PermissionCard.tsx` | Inline permission request with Allow/Deny |
| `ConversationContextMenu.tsx` | Right-click menu for conversations |
| `ThinkingBubble.tsx` | "Thinking..." shimmer animation |
| `FeedbackButtons.tsx` | Thumbs up/down rating |
| `UsageBadge.tsx` | Token count, cost, duration badge |

### `components/audio/`

| File | Purpose |
|------|---------|
| `MusicSearchPopover.tsx` | Music search popover (Pixabay, Freesound) |
| `SFXSearchPopover.tsx` | Sound effect search popover |
| `VoicePicker.tsx` | Voice selection for TTS |

### `components/avatar/`

| File | Purpose |
|------|---------|
| `AvatarLayerSettings.tsx` | Avatar layer configuration form |

### `components/build/`

| File | Purpose |
|------|---------|
| `BuildPanel.tsx` | Build mode panel |
| `AgentStepTree.tsx` | Agent workflow step tree |
| `FrameGrid.tsx` | Frame grid preview |
| `FrameDetailPanel.tsx` | Frame detail inspector |
| `SceneCard.tsx` | Build-mode scene card |

### `components/inspector/`

| File | Purpose |
|------|---------|
| `PropertyInspector.tsx` | Main property inspector panel |
| `Section.tsx` | Collapsible inspector section |
| `controls/ColorPicker.tsx` | Color picker control |
| `controls/NumberInput.tsx` | Number input with drag |
| `controls/SelectInput.tsx` | Select dropdown |
| `controls/SliderInput.tsx` | Slider control |
| `controls/TextareaInput.tsx` | Multi-line text input |
| `controls/ToggleInput.tsx` | Toggle switch |
| `controls/ControlRow.tsx` | Label + control row layout |
| `controls/AgentEditButton.tsx` | "Edit with agent" button |

### `components/interactions/`

| File | Purpose |
|------|---------|
| `InteractionRenderer.tsx` | Renders interactive overlays on scenes |
| `ProfessionalTooltip.tsx` | Styled tooltip component |

### `components/layers/`

| File | Purpose |
|------|---------|
| `SceneLayersStackPanel.tsx` | Layer stack with drag reorder |
| `LayerStackPropertiesPanel.tsx` | Selected layer properties |
| `AvatarLayerPropertiesForm.tsx` | Avatar layer property form |
| `ChartLayerPropertiesForm.tsx` | Chart layer property form |
| `LayersTabSubheader.tsx` | Layers tab subheader |

### `components/recording/`

| File | Purpose |
|------|---------|
| `RecordingHUD.tsx` | Recording heads-up display |
| `SourceSelector.tsx` | Camera/mic source selector |

### `components/settings/`

| File | Purpose |
|------|---------|
| `SettingsModal.tsx` | Settings modal container |
| `GeneralSettingsTab.tsx` | General settings (theme, etc.) |
| `ModelsSettingsTab.tsx` | AI model enable/disable/config |
| `ModelsAndApiPanel.tsx` | API key management |
| `AudioSettingsTab.tsx` | Audio provider settings |
| `AvatarSettingsTab.tsx` | Avatar provider settings |
| `MediaGenSettingsTab.tsx` | Media generation provider settings |
| `AgentsSettingsTab.tsx` | Agent type configuration |
| `AgentEditorOverlay.tsx` | Agent prompt/config editor overlay |
| `PermissionsPanel.tsx` | API permission management |
| `UsageSection.tsx` | Usage statistics display |
| `shared.tsx` | Shared settings utilities |

### `components/tabs/`

| File | Purpose |
|------|---------|
| `LayersTab.tsx` | Right panel — style, scenes, layers, AI layers |
| `PromptTab.tsx` | Prompt input tab |
| `InteractTab.tsx` | Interaction designer tab |
| `TextTab.tsx` | Text overlay editor tab |

### `components/timeline/`

| File | Purpose |
|------|---------|
| `Timeline.tsx` | Main timeline component |
| `TimelineControls.tsx` | Play/pause/seek controls |
| `TimelineToolbar.tsx` | Timeline toolbar |
| `SceneTrack.tsx` | Scene duration track |
| `TrackRow.tsx` | Individual layer track row |
| `TrackHeader.tsx` | Track label header |
| `Playhead.tsx` | Playhead indicator |
| `TimeRuler.tsx` | Time ruler with ticks |
| `OverlayTracks.tsx` | Audio/video overlay tracks |
| `SnapEngine.ts` | Snap-to-grid logic |
| `usePlayheadDrag.ts` | Playhead drag interaction hook |
| `useTimelineZoom.ts` | Zoom level hook |
| `useWaveform.ts` | Audio waveform rendering hook |
| `constants.ts` | Timeline constants |

### `components/zdog-studio/`

| File | Purpose |
|------|---------|
| `ZdogViewport.tsx` | 3D Zdog viewport |
| `ZdogOutliner.tsx` | Scene object outliner |
| `ZdogProperties.tsx` | Zdog property editor |
| `store.ts` | Zdog studio state |

### `components/charts/`

| File | Purpose |
|------|---------|
| `ShadcnChartsShowcase.tsx` | Chart component showcase/demo |

### `components/ui/`

| File | Purpose |
|------|---------|
| `chart.tsx` | shadcn/ui chart wrapper |

---

## Lib (Core Business Logic)

### `lib/store/` — Zustand State Management

| File | Purpose |
|------|---------|
| `index.ts` | Store creation, persistence, hydration |
| `types.ts` | VideoStore interface — all state shape + action signatures |
| `agent-actions.ts` | Conversations, chat messages, agent run, scene sync, model/agent config |
| `generation-actions.ts` | SVG/Canvas/D3/Three/Motion/Lottie generation, saveSceneHTML, AI layers |
| `project-actions.ts` | Project CRUD, saveProjectToDb, loadProject, publish |
| `scene-actions.ts` | Scene CRUD, reorder, duplicate, updateScene |
| `export-actions.ts` | MP4 export orchestration |
| `timeline-actions.ts` | Timeline state, playback, seek |
| `audio-actions.ts` | Audio/TTS/SFX state |
| `undo-actions.ts` | Undo/redo stack management |
| `inspector-actions.ts` | Property inspector state |
| `dev-actions.ts` | Dev tools state |
| `helpers.ts` | normalizeScene, createDefaultProject, style resolution |

### `lib/agents/` — AI Agent System

| File | Purpose |
|------|---------|
| `runner.ts` | Multi-turn agent loop — iteration, retry, context refresh, abort |
| `tools.ts` | 60+ tool definitions (scene, layer, media, chart, 3D, planning, etc.) |
| `tool-executor.ts` | Tool execution with pre/post hooks, world state mutation |
| `prompts.ts` | Agent system prompts per agent type |
| `orchestrator.ts` | Agent orchestration and routing |
| `context-builder.ts` | Builds context messages from world state for Claude |
| `agent-config.ts` | Agent type definitions (Director, Planner, etc.) |
| `model-config.ts` | Model definitions and defaults |
| `router.ts` | Routes user messages to appropriate agent type |
| `commands.ts` | Agent CLI commands |
| `config-resolver.ts` | Resolves agent/model config from store + overrides |
| `hook-config.ts` | Pre/post tool hook configuration |
| `built-in-hooks.ts` | Built-in tool hooks |
| `session.ts` | Agent session management |
| `types.ts` | ChatMessage, Storyboard, RunCheckpoint, etc. |
| `memory-extractor.ts` | Extracts memorable facts from conversations |
| `logger.ts` | Agent execution logging |
| `run-analytics.ts` | Agent run analytics |
| `tool-registry.ts` | Dynamic tool registry |

### `lib/agents/tool-handlers/` — Tool Implementation

| File | Purpose |
|------|---------|
| `scene-tools.ts` | create_scene, delete_scene, duplicate_scene, reorder, set_duration, etc. |
| `layer-tools.ts` | add_layer, regenerate_layer, edit_layer |
| `style-tools.ts` | set_global_style, set_all_transitions |
| `element-tools.ts` | Element manipulation (text, shapes, images) |
| `chart-tools.ts` | create_chart, generate_chart (D3) |
| `image-video-tools.ts` | generate_image, generate_sticker, generate_veo3_video |
| `avatar-tools.ts` | generate_avatar, generate_avatar_narration |
| `audio-tools.ts` | elevenlabs_tts, add_sfx, add_music |
| `asset-media-tools.ts` | Asset upload, management |
| `ai-layer-tools.ts` | AI layer operations |
| `interaction-tools.ts` | Interaction/hotspot/tooltip setup |
| `template-tools.ts` | apply_canvas_motion_template |
| `physics-tools.ts` | Physics simulation tools |
| `three-world-tools.ts` | 3D world/environment tools |
| `parenting-tools.ts` | Element hierarchy/parenting |
| `planning-export-tools.ts` | plan_scenes, verify_scene, export |
| `recording-tools.ts` | Screen recording tools |

### `lib/db/` — Database Layer

| File | Purpose |
|------|---------|
| `index.ts` | Drizzle ORM initialization |
| `schema.ts` | Full PostgreSQL schema (projects, scenes, conversations, messages, etc.) |
| `project-scene-table.ts` | Table-backed scene storage |
| `project-scene-storage.ts` | JSONB blob scene storage |
| `queries/projects.ts` | Project DB queries |
| `queries/scenes.ts` | Scene DB queries |
| `queries/conversations.ts` | Conversation DB queries |
| `queries/assets.ts` | Asset DB queries |
| `queries/generation-logs.ts` | Generation log queries |
| `queries/analytics.ts` | Analytics queries |
| `queries/layers.ts` | Layer queries |
| `queries/media.ts` | Media queries |
| `queries/snapshots.ts` | Snapshot queries |
| `queries/user-memory.ts` | User memory queries |
| `seeds/` | Seed data for assets, templates, 3D components |

### `lib/audio/` — Audio System

| File | Purpose |
|------|---------|
| `router.ts` | Routes TTS/SFX requests to providers |
| `types.ts` | Audio type definitions |
| `download.ts` | Audio file download |
| `normalize.ts` | Audio normalization |
| `resolve-best-tts-provider.ts` | TTS provider auto-selection |
| `providers/elevenlabs-tts.ts` | ElevenLabs TTS provider |
| `providers/elevenlabs-sfx.ts` | ElevenLabs SFX provider |
| `providers/google-tts.ts` | Google Cloud TTS |
| `providers/openai-tts.ts` | OpenAI TTS |
| `providers/openai-edge-tts.ts` | OpenAI Edge TTS |
| `providers/gemini-tts.ts` | Gemini TTS |
| `providers/native-tts.ts` | Native browser TTS |
| `providers/web-speech.ts` | Web Speech API |
| `providers/puter-tts.ts` | Puter TTS |
| `providers/freesound.ts` | Freesound SFX |
| `providers/freesound-music.ts` | Freesound music |
| `providers/pixabay.ts` | Pixabay sounds |
| `providers/pixabay-music.ts` | Pixabay music |

### `lib/avatar/` — Avatar System

| File | Purpose |
|------|---------|
| `index.ts` | Avatar utilities |
| `types.ts` | Avatar types |
| `providers/heygen.ts` | HeyGen avatar provider |
| `providers/talkinghead.ts` | TalkingHead avatar provider |
| `providers/aurora.ts` | Aurora avatar provider |
| `providers/fabric.ts` | Fabric avatar provider |
| `providers/musetalk.ts` | MuseTalk avatar provider |

### `lib/apis/` — External API Integrations

| File | Purpose |
|------|---------|
| `image-gen.ts` | Image generation (Flux, DALL-E, Recraft, Ideogram, Stable Diffusion) |
| `veo3.ts` | Google Veo3 video generation |
| `heygen.ts` | HeyGen API client |
| `background-removal.ts` | Background removal API |
| `media-cache.ts` | Media URL caching |

### `lib/generation/` — LLM Generation Prompts

| File | Purpose |
|------|---------|
| `generate.ts` | Generation orchestration |
| `prompts.ts` | System prompts for SVG, Canvas, D3, Three.js, Motion, Lottie |
| `d3-structured-run.ts` | Structured D3 chart generation pipeline |

### `lib/types/` — Type Definitions

| File | Purpose |
|------|---------|
| `index.ts` | Re-exports all types |
| `scene.ts` | Scene interface |
| `project.ts` | Project interface |
| `elements.ts` | Element types (text, shape, image, video, etc.) |
| `ai-layer.ts` | AI layer types (image, sticker, avatar, video) |
| `interaction.ts` | Interaction types (hotspot, tooltip, choice, quiz, gate, form) |
| `audio.ts` | Audio settings, TTS config |
| `media.ts` | Media provider types |
| `permissions.ts` | API permission types |
| `timeline.ts` | Timeline types |
| `world.ts` | World state types (for agent) |
| `d3.ts` | D3 chart types |
| `physics.ts` | Physics simulation types |
| `zdog.ts` | Zdog 3D character types |
| `zdog-studio.ts` | Zdog studio types |

### `lib/compositor/` — Video Composition

| File | Purpose |
|------|---------|
| `pixi-compositor.ts` | Pixi.js scene compositor |
| `pixi-preview.ts` | Preview rendering pipeline |
| `filters.ts` | Video filters (blur, color, etc.) |
| `interpolate.ts` | Animation interpolation |
| `video-pool.ts` | Video element buffer pool |
| `types.ts` | Compositor types |

### `lib/scene-html/` — Scene HTML Serialization

| File | Purpose |
|------|---------|
| `element-registry.ts` | Runtime element registry for scenes |
| `element-serializer.ts` | Serialize elements to HTML |
| `gsap-head.ts` | GSAP script injection |
| `playback-controller.ts` | Scene playback control script |

### `lib/styles/` — Style Presets

| File | Purpose |
|------|---------|
| `presets.ts` | Style presets (whiteboard, chalkboard, blueprint, etc.) |
| `scene-presets.ts` | Scene-level style defaults |

### `lib/templates/` — Scene Templates

| File | Purpose |
|------|---------|
| `built-in.ts` | Built-in scene templates |
| `canvas-animation-templates.ts` | Canvas animation templates |
| `instantiate.ts` | Template instantiation |
| `types.ts` | Template types |

### `lib/three-environments/` — 3D Environments

| File | Purpose |
|------|---------|
| `registry.ts` | Environment registry |
| `index.ts` | Environment utilities |
| `build-three-data-scatter-scene-code.ts` | 3D scatter plot builder |
| `inlined-runtimes.ts` | Inlined Three.js runtime code |
| `patch-scene-code-environment.ts` | Environment patching |

### `lib/zdog/` — Zdog 3D Characters

| File | Purpose |
|------|---------|
| `index.ts` | Zdog utilities |
| `scene-match.ts` | Scene matching |
| `studio-blocks.ts` | Studio building blocks |
| `animations/` | Animation presets |
| `composer/` | Scene composition |
| `core/` | Core Zdog logic |
| `formulas/` | Character formulas |
| `modules/` | Zdog modules |
| `rigs/` | Character rigs |

### Other Lib Files

| File | Purpose |
|------|---------|
| `lib/sceneTemplate.ts` | HTML template assembly per scene type |
| `lib/auth.ts` | NextAuth v5 configuration |
| `lib/auth-edge.ts` | Edge-compatible auth |
| `lib/permissions.ts` | Permission defaults and helpers |
| `lib/utils.ts` | General utilities (cn, etc.) |
| `lib/env.ts` | Environment variable access |
| `lib/grid.ts` | Grid/layout system |
| `lib/image-utils.ts` | Image processing utilities |
| `lib/ui-font.ts` | UI font utilities |
| `lib/avatar-layer-sync.ts` | Avatar layer sync helpers |
| `lib/canvas-renderer/` | Canvas rendering pipeline |
| `lib/charts/compile.ts` | D3 chart compilation |
| `lib/charts/extract.ts` | Chart data extraction |
| `lib/physics/compile.ts` | Physics simulation compilation |
| `lib/github/` | GitHub serialization/deserialization |
| `lib/export2/pixi-mp4.ts` | Pixi.js MP4 export |
| `lib/fonts/catalog.ts` | Font catalog |
| `lib/build/` | Build pipeline (reducer, types, hook) |
| `lib/generation-logs/` | Generation log scoring |
| `lib/api/` | API utilities (response, validate, with-handler) |
| `lib/config/hierarchy.ts` | Config hierarchy resolution |
| `lib/storage/index.ts` | Storage abstraction |
| `lib/media/provider-registry.ts` | Media provider registry |

---

## Hooks

| File | Purpose |
|------|---------|
| `hooks/useAudioLevelMeter.ts` | Real-time audio level metering |
| `hooks/useCameraDevices.ts` | Camera device enumeration |
| `hooks/useMicrophoneDevices.ts` | Microphone device enumeration |
| `hooks/useScreenRecorder.ts` | Screen recording (capture + encoding) |
| `hooks/useRecordingBridge.ts` | Recording bridge between components |

---

## Render Server

| File | Purpose |
|------|---------|
| `render-server/index.js` | Express server — Puppeteer + FFmpeg orchestration |
| `render-server/renderer.js` | Scene-to-frame rendering engine |
| `render-server/audio-mixer.js` | Multi-track audio mixing |
| `render-server/stitcher.js` | Frame-to-MP4 video stitching |
| `render-server/.bin/chrome/` | Bundled Chrome binary for Puppeteer |

---

## Packages

### `packages/player/` — Standalone Embeddable Player

| File | Purpose |
|------|---------|
| `src/index.ts` | Player core — init, load, play |
| `src/renderer.ts` | Scene rendering |
| `src/runtime.ts` | Playback runtime |
| `src/interactions.ts` | Interaction event handling |
| `src/types.ts` | Player types |
| `ui/choice.ts` | Choice interaction UI |
| `ui/controls.ts` | Player controls |
| `ui/form.ts` | Form interaction UI |
| `ui/gate.ts` | Gate/lock interaction UI |
| `ui/hotspot.ts` | Hotspot interaction UI |
| `ui/quiz.ts` | Quiz interaction UI |
| `ui/tooltip.ts` | Tooltip interaction UI |
| `variables.ts` | Variable/state management |
| `vite.config.ts` | Vite build config |

---

## Website (Marketing Site)

| File | Purpose |
|------|---------|
| `website/app/layout.tsx` | Site layout |
| `website/app/page.tsx` | Landing page |
| `website/app/fonts.ts` | Font config |
| `website/app/components/TiltImage.tsx` | 3D tilt image effect |
| `website/app/components/UseCasesScroll.tsx` | Use-cases scroll section |
| `website/package.json` | Separate dependencies |
| `website/next.config.ts` | Next.js config |
| `website/tsconfig.json` | TypeScript config |

---

## Scripts

### Demo/Showcase Projects

| File | Purpose |
|------|---------|
| `scripts/create-avatar-showcase-project.ts` | Creates avatar demo project |
| `scripts/create-charts-showcase-project.ts` | Creates charts demo project |
| `scripts/create-svg-explainer-pack-v4.mjs` | Creates SVG explainer pack |
| `scripts/create-svg-explainer-pack-v3-lucide.mjs` | Creates Lucide icon pack |
| `scripts/create-renderer-comparison-project.mjs` | Renderer comparison demo |
| `scripts/create-structured-d3-demo.ts` | Structured D3 demo |
| `scripts/create-canvas-test-scenes.ts` | Canvas test scenes |
| `scripts/create-zdog-test-scenes.mjs` | Zdog test scenes |
| `scripts/create-zdog-person-demo.mjs` | Zdog character demo |
| `scripts/create-zdog-two-character-test-scenes.mjs` | Zdog multi-character test |
| `scripts/create-d3-camera-test-project.mjs` | D3 camera test |
| `scripts/create-transition-test-project.ts` | Transition test project |

### Utilities

| File | Purpose |
|------|---------|
| `scripts/inject-scene.ts` | CLI: wrap code in HTML template |
| `scripts/migrate-styles.ts` | Migrate style presets |
| `scripts/setup.ts` | Project setup |
| `scripts/export-transition-subset.ts` | Export transition data |
| `scripts/normalize-d3-scene-layout.mjs` | Normalize D3 layouts |
| `scripts/generate-zdog-character-library.mjs` | Generate Zdog library |

### Agent Tests

| File | Purpose |
|------|---------|
| `scripts/run-physics-tool-executor-test.ts` | Physics tool executor test |
| `scripts/run-agent-physics-test.mjs` | Agent physics integration test |
| `scripts/run-agent-d3-test.mjs` | Agent D3 integration test |
| `scripts/regenerate-d3-agent-test.mjs` | Regenerate D3 agent test |

---

## Public Assets

| Directory | Purpose |
|-----------|---------|
| `public/scenes/` | Generated scene HTML files (served as static) |
| `public/sdk/cench-analytics.js` | Analytics SDK |
| `public/sdk/cench-camera.js` | Camera SDK (pan/zoom/kenBurns) |
| `public/sdk/cench-charts.js` | Charts SDK (D3 wrappers) |
| `public/sdk/cench-motion.js` | Motion SDK (anime.js wrappers) |
| `public/sdk/interaction-components.js` | Interaction runtime components |
| `public/sdk/physics-equations.js` | Physics equation renderer |
| `public/sdk/physics-sims.js` | Physics simulation runtime |
| `public/audio/` | Audio files |
| `public/avatars/` | Avatar assets |
| `public/icons/` | Icon assets |
| `public/models/` | 3D model files |
| `public/uploads/` | User uploads |
| `public/worlds/` | 3D world files |
| `public/generated/` | Generated content |
| `public/published/` | Published project bundles |

---

## CI/CD & Infrastructure

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `docker-compose.yml` | PostgreSQL database container |
| `drizzle/` | Database migration files |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand (persisted to localStorage) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | NextAuth v5 (GitHub, Google OAuth) |
| Desktop | Electron |
| AI | Anthropic Claude (tool use), OpenAI, Google Gemini |
| 2D Graphics | Canvas2D, SVG, D3.js, Pixi.js |
| 3D Graphics | Three.js, Zdog |
| Animation | GSAP, Anime.js, Motion, Lottie |
| Video Export | Puppeteer + FFmpeg (render-server) |
| Audio | ElevenLabs, OpenAI TTS, Google TTS, Freesound, Pixabay |
| Avatars | HeyGen, TalkingHead, Aurora, Fabric, MuseTalk |
| Image Gen | Flux, DALL-E, Recraft, Ideogram, Stable Diffusion |
| Video Gen | Google Veo3 |
| Testing | Vitest |
| Linting | ESLint + lint-staged |
